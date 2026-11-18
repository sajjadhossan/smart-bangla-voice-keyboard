import assert from 'node:assert/strict';
import test from 'node:test';
import { grantConsent, NO_CONSENT } from '../../shared/core/consent.ts';
import { isOk } from '../../shared/core/result.ts';
import type { FeatureId } from '../../shared/features/ai-features.ts';
import {
  emptyHistory, executeFeature, expandTemplate, FEATURE_REGISTRY, featureStatusMatrix,
  historyAppend, historyRedo, historyUndo, nextWordSuggestions,
  type FeatureInput, type HistoryEntry,
} from '../../shared/features/ai-features.ts';
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

const CONSENT = grantConsent('all', 1);
const IDS: readonly FeatureId[] = [...'ABCDEFGHIJKLMNOPQ'] as FeatureId[];

class ScriptedProvider implements GeminiProvider {
  state = 'connected' as const;
  output = '';
  calls: string[] = [];
  lastRewrite: RewriteInput | null = null;
  async testConnection(): Promise<'connected'> { return this.state; }
  async transcribe(_input: TranscriptionInput) { return { ok: false as const, error: 'unused' }; }
  async translate(_input: TranslateInput) { this.calls.push('translate'); return { ok: true as const, value: this.output }; }
  async correct(_input: TextInput) { this.calls.push('correct'); return { ok: true as const, value: this.output }; }
  async rewrite(input: RewriteInput) {
    this.calls.push('rewrite');
    this.lastRewrite = input;
    return { ok: true as const, value: this.output };
  }
  async summarize(_input: TextInput) { this.calls.push('summarize'); return { ok: true as const, value: this.output }; }
}

function baseInput(provider: GeminiProvider, overrides: Partial<FeatureInput> = {}): FeatureInput {
  return {
    provider, ctx: { consent: CONSENT }, text: 'plain text', language: 'english',
    surroundingText: 'context', prefix: 'ami', templateId: 'greeting',
    templateVars: { name: 'Rahim' }, customDictionary: { Rahim: 'রহিম' },
    historyEntry: { kind: 'text', text: 'plain text', atMs: 1 },
    original: 'plain text', protectedTerms: [],
    ...overrides,
  };
}

test('registry covers A–Q (17 ids), every entry has a name, route and status', () => {
  assert.equal(FEATURE_REGISTRY.length, 17);
  assert.deepEqual(FEATURE_REGISTRY.map((f) => f.id), IDS);
  assert.equal(new Set(FEATURE_REGISTRY.map((f) => f.id)).size, 17);
  for (const f of FEATURE_REGISTRY) {
    assert.ok(f.name.length > 2);
    assert.ok(['offline', 'gemini', 'platform'].includes(f.route));
    assert.ok(['implemented', 'platform_required'].includes(f.status));
  }
  assert.deepEqual(featureStatusMatrix(), FEATURE_REGISTRY);
});

test('EVERY feature A–Q has an executable path (no decorative buttons)', async () => {
  for (const id of IDS) {
    const provider = new ScriptedProvider();
    provider.output = 'plain text'; // fact-preserving no-op result
    const result = await executeFeature(id, baseInput(provider));
    assert.equal(isOk(result), true, `feature ${id} failed: ${!isOk(result) ? result.error : ''}`);
    if (isOk(result)) {
      assert.equal(result.value.id, id);
      assert.ok(['offline', 'gemini', 'platform'].includes(result.value.source));
    }
  }
});

test('Gemini features route to the right capability with real intent', async () => {
  const cases: ReadonlyArray<readonly [FeatureId, string]> = [
    ['A', 'summarize'], ['B', 'rewrite'], ['C', 'rewrite'], ['D', 'rewrite'],
    ['H', 'rewrite'], ['Q', 'rewrite'],
  ];
  for (const [id, route] of cases) {
    const provider = new ScriptedProvider();
    provider.output = 'plain text';
    const result = await executeFeature(id, baseInput(provider));
    assert.equal(isOk(result), true, id);
    assert.deepEqual(provider.calls, [route], id);
  }
  const ctxProvider = new ScriptedProvider();
  ctxProvider.output = 'plain text';
  await executeFeature('H', baseInput(ctxProvider, { surroundingText: 'previous sentence' }));
  assert.ok(ctxProvider.lastRewrite?.instruction?.includes('previous sentence'));
});

test('offline features produce real results: detect, format, template, next word, spelling, dictionary, diff', async () => {
  const provider = new ScriptedProvider();
  const detect = await executeFeature('E', baseInput(provider, { text: 'আমি ভালো আছি' }));
  assert.equal(isOk(detect) && detect.value.output, 'bangla');

  const format = await executeFeature('F', baseInput(provider, { text: 'I  am  fine.' }));
  assert.equal(isOk(format) && format.value.output, 'I am fine.');

  const template = await executeFeature('G', baseInput(provider));
  assert.equal(isOk(template) && template.value.output, 'আসসালামু আলাইকুম, Rahim। আপনি কেমন আছেন?');
  assert.equal(expandTemplate('unknown', {}), '');

  const next = await executeFeature('I', baseInput(provider, { prefix: 'ami' }));
  assert.equal(isOk(next) && next.value.output, 'আমি');
  assert.ok(nextWordSuggestions('ami').length > 0);

  const spelling = await executeFeature('J', baseInput(provider, { text: 'bhalo' }));
  assert.equal(isOk(spelling), true);
  if (isOk(spelling)) assert.ok(spelling.value.suggestions !== undefined);

  const custom = await executeFeature('K', baseInput(provider, { text: 'Call Rahim now' }));
  assert.equal(isOk(custom) && custom.value.output, 'Call রহিম now');

  const diff = await executeFeature('P', baseInput(provider, { original: 'a b', text: 'a c' }));
  assert.equal(isOk(diff), true);
  if (isOk(diff)) {
    assert.equal(diff.value.diff?.some((t) => t.original === 'b'), true);
    assert.equal(diff.value.diff?.some((t) => t.corrected === 'c'), true);
  }
});

test('clipboard feature returns an explicit platform command, not a fake OS action', async () => {
  const result = await executeFeature('L', baseInput(new ScriptedProvider(), { text: 'copy me' }));
  assert.equal(isOk(result), true);
  if (isOk(result)) {
    assert.equal(result.value.source, 'platform');
    assert.deepEqual(result.value.clipboard, { kind: 'copy', text: 'copy me' });
    assert.equal(FEATURE_REGISTRY.find((f) => f.id === 'L')?.status, 'platform_required');
  }
});

test('voice/translation history append and undo/redo restore exact entries', async () => {
  const entry = (text: string, kind: HistoryEntry['kind'] = 'text'): HistoryEntry => ({ kind, text, atMs: 1 });
  let history = emptyHistory();
  history = historyAppend(history, entry('one'));
  history = historyAppend(history, entry('two', 'translation'));
  assert.equal(history.entries.length, 2);
  assert.equal(historyUndo(history).cursor, 0);
  assert.equal(historyRedo(historyUndo(history)).cursor, 1);

  const voice = await executeFeature('M', baseInput(new ScriptedProvider(), {
    history, historyEntry: entry('three', 'voice'),
  }));
  assert.equal(isOk(voice), true);
  if (isOk(voice)) assert.equal(voice.value.output, 'three');

  const undo = await executeFeature('O', baseInput(new ScriptedProvider(), { history }));
  assert.equal(isOk(undo), true);
  if (isOk(undo)) assert.equal(undo.value.output, 'one');
  const redo = await executeFeature('O', baseInput(new ScriptedProvider(), { history, redo: true }));
  // redo at the tip is a no-op, output stays at current entry
  assert.equal(isOk(redo), true);
});

test('Gemini feature output is fact-guarded; provider errors and unknown ids are surfaced', async () => {
  const provider = new ScriptedProvider();
  provider.output = 'Pay ৳999 on 2026-01-01.';
  const bad = await executeFeature('Q', baseInput(provider, {
    text: 'Pay ৳500 on 2026-12-31.',
  }));
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, 'fact_guard_rejected');

  const unknown = await executeFeature('Z' as FeatureId, baseInput(new ScriptedProvider()));
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error, 'unknown_feature');

  const noTemplate = await executeFeature('G', baseInput(new ScriptedProvider(), { templateId: '' }));
  assert.equal(noTemplate.ok, false);
  if (!noTemplate.ok) assert.equal(noTemplate.error, 'unknown_template');
});

class CountingTransport implements HttpTransport {
  calls = 0;
  async send(_request: GeminiRequest, _timeoutMs: number) {
    this.calls += 1;
    return { status: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'unexpected' }] } }] }) };
  }
}

test('NO CONSENT through a Gemini feature + real provider ⇒ zero network calls', async () => {
  const transport = new CountingTransport();
  const provider = new GeminiApiProvider({
    storage: new TestOnlyMemoryStorage(),
    config: withConfig(DEFAULT_GEMINI_CONFIG, { maxRetries: 0 }),
    transport,
  });
  const result = await executeFeature('A', baseInput(provider, { ctx: { consent: NO_CONSENT } }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(transport.calls, 0);
});
