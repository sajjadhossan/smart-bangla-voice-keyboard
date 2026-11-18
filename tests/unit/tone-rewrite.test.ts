import assert from 'node:assert/strict';
import test from 'node:test';
import { grantConsent, NO_CONSENT } from '../../shared/core/consent.ts';
import { isOk } from '../../shared/core/result.ts';
import type { ToneMode } from '../../shared/core/types.ts';
import { DEFAULT_GEMINI_CONFIG, withConfig } from '../../shared/gemini/config.ts';
import {
  GeminiApiProvider,
  type GeminiProvider,
  type RewriteInput,
  type TextInput,
  type TranscriptionInput,
  type TranslateInput,
} from '../../shared/gemini/provider.ts';
import type { GeminiRequest, HttpTransport } from '../../shared/gemini/transport.ts';
import { TestOnlyMemoryStorage } from '../../shared/settings/secure-storage.ts';
import {
  acceptRewrite, DEFAULT_TONE, executeRewrite, initialRewriteState, planRewrite,
  proposeRewrite, REWRITE_ACTIONS, rejectRewrite, rewriteOfflineText, TONE_INSTRUCTIONS,
  TONE_MODES, undoRewrite,
} from '../../shared/rewrite/rewrite.ts';

const CONSENT = grantConsent('all', 1);

class ScriptedProvider implements GeminiProvider {
  state = 'connected' as const;
  output = '';
  calls: string[] = [];
  lastRewrite: RewriteInput | null = null;
  lastTranslate: TranslateInput | null = null;
  async testConnection(): Promise<'connected'> { return this.state; }
  async transcribe(_input: TranscriptionInput) { return { ok: false as const, error: 'unused' }; }
  async translate(input: TranslateInput) {
    this.calls.push('translate');
    this.lastTranslate = input;
    return { ok: true as const, value: this.output };
  }
  async correct(input: TextInput) {
    this.calls.push('correct');
    return { ok: true as const, value: this.output };
  }
  async rewrite(input: RewriteInput) {
    this.calls.push('rewrite');
    this.lastRewrite = input;
    return { ok: true as const, value: this.output };
  }
  async summarize(_input: TextInput) {
    this.calls.push('summarize');
    return { ok: true as const, value: this.output };
  }
}

test('exactly 15 tones, default normal, each with a real instruction', () => {
  assert.equal(TONE_MODES.length, 15);
  assert.equal(DEFAULT_TONE, 'normal');
  assert.equal(new Set(TONE_MODES).size, 15);
  assert.equal(TONE_MODES.includes('normal'), true);
  for (const tone of TONE_MODES) {
    assert.equal(typeof TONE_INSTRUCTIONS[tone], 'string', `${tone} instruction missing`);
    assert.ok(TONE_INSTRUCTIONS[tone].length > 10, `${tone} instruction too short`);
  }
  const extra: ToneMode = 'empathetic';
  assert.ok(TONE_MODES.includes(extra));
});

test('all 16 rewrite actions have an executable plan with a valid route', () => {
  assert.equal(REWRITE_ACTIONS.length, 16);
  assert.equal(new Set(REWRITE_ACTIONS).size, 16);
  for (const action of REWRITE_ACTIONS) {
    const plan = planRewrite(action);
    assert.equal(plan.action, action);
    assert.ok(['offline', 'correct', 'rewrite', 'summarize', 'translate'].includes(plan.route));
    assert.ok(TONE_MODES.includes(plan.tone));
    assert.ok(plan.instruction.length > 5);
  }
});

test('offline routes propose a preview without touching current text', async () => {
  const provider = new ScriptedProvider();
  const session = initialRewriteState('I  am  fine.  ');
  const result = await executeRewrite(provider, session, {
    ctx: { consent: CONSENT }, action: 'format_text', text: session.original, language: 'english',
  });
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.source, 'offline');
  assert.equal(result.value.state.current, session.original, 'current text unchanged by propose');
  assert.equal(result.value.state.pending, 'I am fine.');
  assert.equal(result.value.state.status, 'pending');
  assert.equal(provider.calls.length, 0);
});

test('make_shorter removes fillers offline but preserves facts', async () => {
  const provider = new ScriptedProvider();
  const text = 'Actually, I will pay ৳500 on 2026-12-31 to Rahim.';
  const result = await executeRewrite(provider, initialRewriteState(text), {
    ctx: { consent: CONSENT }, action: 'make_shorter', text, language: 'english', protectedTerms: ['Rahim'],
  });
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.state.pending, 'I will pay ৳500 on 2026-12-31 to Rahim.');
  assert.equal(rewriteOfflineText('Hello,   world!', 'format_text'), 'Hello, world!');
});

test('accept requires explicit confirmation unless auto-apply is enabled', () => {
  const session = proposeRewrite(initialRewriteState('original'), 'proposed');
  const denied = acceptRewrite(session, false, false);
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, 'confirmation_required');
  const accepted = acceptRewrite(session, true, false);
  assert.equal(isOk(accepted), true);
  if (isOk(accepted)) assert.equal(accepted.value.current, 'proposed');
  const auto = acceptRewrite(session, false, true);
  assert.equal(isOk(auto), true);
  assert.equal(acceptRewrite(initialRewriteState('x'), true, false).ok, false);
});

test('reject discards the proposal and keeps the original', () => {
  const session = proposeRewrite(initialRewriteState('keep me'), 'drop me');
  const rejected = rejectRewrite(session);
  assert.equal(rejected.pending, null);
  assert.equal(rejected.current, 'keep me');
  assert.equal(rejected.status, 'rejected');
});

test('undo restores the EXACT previous string through two accepts', () => {
  let state = initialRewriteState('version-0');
  state = proposeRewrite(state, 'version-1');
  const a1 = acceptRewrite(state, true, false);
  assert.equal(isOk(a1), true);
  if (!isOk(a1)) return;
  state = a1.value;

  state = proposeRewrite(state, 'version-2');
  const a2 = acceptRewrite(state, true, false);
  assert.equal(isOk(a2), true);
  if (!isOk(a2)) return;
  state = a2.value;
  assert.equal(state.current, 'version-2');

  const u1 = undoRewrite(state);
  assert.equal(isOk(u1), true);
  if (!isOk(u1)) return;
  state = u1.value;
  assert.equal(state.current, 'version-1');

  const u2 = undoRewrite(state);
  assert.equal(isOk(u2), true);
  if (!isOk(u2)) return;
  assert.equal(u2.value.current, 'version-0');
  assert.equal(u2.value.original, 'version-0');
  assert.equal(undoRewrite(u2.value).ok, false);
});

test('online actions route to the correct provider capability with action intent', async () => {
  const cases = [
    ['fix_grammar', 'correct'],
    ['rewrite_professionally', 'rewrite'],
    ['summarize', 'summarize'],
    ['translate', 'translate'],
  ] as const;
  for (const [action, route] of cases) {
    const provider = new ScriptedProvider();
    provider.output = 'a different string';
    const result = await executeRewrite(provider, initialRewriteState('source text'), {
      ctx: { consent: CONSENT }, action, text: 'source text', language: 'english', targetLanguage: 'বাংলা',
    });
    assert.equal(isOk(result), true, action);
    assert.deepEqual(provider.calls, [route], action);
    if (action === 'translate') {
      assert.equal(provider.lastTranslate?.source, 'text', 'typed text must use text consent');
      assert.equal(provider.lastTranslate?.targetLanguage, 'বাংলা');
    }
    if (action === 'rewrite_professionally') {
      assert.equal(provider.lastRewrite?.tone, 'professional');
      assert.ok(provider.lastRewrite?.instruction?.length);
    }
  }
});

test('tone override is applied instantly without mutating the session', async () => {
  const provider = new ScriptedProvider();
  provider.output = 'nya Somoy khub的重要';
  const session = initialRewriteState('original');
  const result = await executeRewrite(provider, session, {
    ctx: { consent: CONSENT }, action: 'improve_writing', text: 'original',
    language: 'english', toneOverride: 'formal',
  });
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.plan.tone, 'formal');
  assert.equal(provider.lastRewrite?.tone, 'formal');
  assert.equal(session.current, 'original');
});

test('fact guard rejects a rewrite that alters facts; provider errors propagate', async () => {
  const guardian = new ScriptedProvider();
  guardian.output = 'Pay ৳999 on 2026-01-01.';
  const changed = await executeRewrite(guardian, initialRewriteState('Pay ৳500 on 2026-12-31.'), {
    ctx: { consent: CONSENT }, action: 'improve_writing', text: 'Pay ৳500 on 2026-12-31.', language: 'english',
  });
  assert.equal(changed.ok, false);
  if (!changed.ok) assert.equal(changed.error, 'fact_guard_rejected');

  const failing = new ScriptedProvider();
  failing.output = '';
  const original = 'plain text';
  // A scripted provider returning the empty string is a real (if poor) result;
  // simulate a transport failure explicitly instead.
  const providerWithError: GeminiProvider = {
    ...failing,
    async rewrite() { throw new Error('transport down'); },
  };
  await assert.rejects(
    executeRewrite(providerWithError, initialRewriteState(original), {
      ctx: { consent: CONSENT }, action: 'improve_writing', text: original, language: 'english',
    }),
  );
});

class CountingTransport implements HttpTransport {
  calls = 0;
  async send(_request: GeminiRequest, _timeoutMs: number) {
    this.calls += 1;
    return { status: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'unexpected' }] } }] }) };
  }
}

test('NO CONSENT through executeRewrite + real provider ⇒ zero network calls', async () => {
  const transport = new CountingTransport();
  const provider = new GeminiApiProvider({
    storage: new TestOnlyMemoryStorage(),
    config: withConfig(DEFAULT_GEMINI_CONFIG, { maxRetries: 0 }),
    transport,
  });
  const result = await executeRewrite(provider, initialRewriteState('some text'), {
    ctx: { consent: NO_CONSENT }, action: 'improve_writing', text: 'some text', language: 'english',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(transport.calls, 0);
});
