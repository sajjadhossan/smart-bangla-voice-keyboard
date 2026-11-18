import assert from 'node:assert/strict';
import test from 'node:test';
import { grantConsent, NO_CONSENT } from '../../shared/core/consent.ts';
import { isOk } from '../../shared/core/result.ts';
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
  correctOffline,
  correctWithGemini,
  detectLanguage,
  diffText,
  extractFacts,
  factsPreserved,
} from '../../shared/grammar/grammar.ts';

const CONSENT = grantConsent('all', 1);

class ScriptedProvider implements GeminiProvider {
  state = 'connected' as const;
  correction = '';
  correctCalls = 0;
  async testConnection(): Promise<'connected'> {
    return this.state;
  }
  async transcribe(_input: TranscriptionInput) {
    return { ok: false as const, error: 'unused' };
  }
  async translate(_input: TranslateInput) {
    return { ok: false as const, error: 'unused' };
  }
  async correct(_input: TextInput) {
    this.correctCalls += 1;
    return { ok: true as const, value: this.correction };
  }
  async rewrite(_input: RewriteInput) {
    return { ok: false as const, error: 'unused' };
  }
  async summarize(_input: TextInput) {
    return { ok: false as const, error: 'unused' };
  }
}

test('Appendix E grammar example 1 — Bangla correction is a real offline rule', () => {
  const result = correctOffline('আমি কালকে বাজার যাইবে।', 'bangla', 'clean');
  assert.equal(result.corrected, 'আমি আগামীকাল বাজারে যাব।');
  assert.equal(result.changed, true);
  assert.equal(result.factGuard, 'passed');
  assert.equal(result.source, 'offline');
  assert.ok(result.diff.some((t) => t.original === 'কালকে'));
  assert.ok(result.diff.some((t) => t.corrected === 'আগামীকাল'));
});

test('Appendix E grammar example 2 — English tense agreement with past marker', () => {
  const result = correctOffline('I am go to school yesterday.', 'english', 'clean');
  assert.equal(result.corrected, 'I went to school yesterday.');
  assert.equal(result.changed, true);
  assert.ok(result.diff.some((t) => t.original === 'am'));
  assert.ok(result.diff.some((t) => t.corrected === 'went'));
});

test('exact mode is byte-for-byte identity with no diff, offline and online', async () => {
  const text = 'আমি কালকে ৳500 দিব।';
  const offline = correctOffline(text, 'auto', 'exact');
  assert.equal(offline.corrected, text);
  assert.equal(offline.changed, false);
  assert.equal(offline.diff.every((t) => t.kind === 'equal'), true, 'exact mode diff has only equal tokens');

  const provider = new ScriptedProvider();
  provider.correction = 'MUST NOT BE USED';
  const online = await correctWithGemini(provider, { consent: CONSENT }, text, 'auto', 'exact');
  assert.equal(isOk(online), true);
  if (!isOk(online)) return;
  assert.equal(online.value.corrected, text);
  assert.equal(provider.correctCalls, 0, 'exact must make zero Gemini calls');
});

test('smart mode is formatting-only; clean/professional apply word substitutions', () => {
  const text = 'I  am  go to school yesterday.';
  const smart = correctOffline(text, 'english', 'smart');
  assert.equal(smart.corrected, 'I am go to school yesterday.');
  const clean = correctOffline(text, 'english', 'clean');
  assert.equal(clean.corrected, 'I went to school yesterday.');
  const professional = correctOffline(text, 'english', 'professional');
  assert.equal(professional.corrected, 'I went to school yesterday.');
});

test('fact guard: numbers, dates, amounts, technical terms and protected names survive offline correction', () => {
  const original = 'I am go to school yesterday with Rahim on 2026-12-31 for ৳500 using API key.';
  const result = correctOffline(original, 'english', 'professional', ['Rahim']);
  assert.equal(result.factGuard, 'passed');
  assert.equal(result.corrected.includes('Rahim'), true);
  assert.equal(result.corrected.includes('2026-12-31'), true);
  assert.equal(result.corrected.includes('৳500'), true);
  assert.equal(result.corrected.includes('API'), true);
  assert.equal(result.corrected, 'I went to school yesterday with Rahim on 2026-12-31 for ৳500 using API key.');
});

test('fact guard REJECTS altered or added facts in offline candidate', () => {
  const original = 'Call 12345 on 2026-12-31.';
  // Direct guard check — the guard is the last line of defence for any source.
  assert.equal(factsPreserved(original, 'Call 12345 on 2026-12-31.'), true);
  assert.equal(factsPreserved(original, 'Call 99999 on 2026-12-31.'), false);
  assert.equal(factsPreserved(original, 'Call 12345 on 2026-12-31 at 5.'), false);
  assert.equal(factsPreserved(original, 'Call 12345.'), false);
});

test('fact guard REJECTS a Gemini correction that changes amount/date', async () => {
  const original = 'Pay ৳500 to Rahim on 2026-12-31.';
  const provider = new ScriptedProvider();
  provider.correction = 'Pay ৳999 to Rahim on 2026-01-01.';
  const result = await correctWithGemini(provider, { consent: CONSENT }, original, 'english', 'professional', ['Rahim']);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'fact_guard_rejected');
});

test('fact guard REJECTS a Gemini correction that invents a new number', async () => {
  const provider = new ScriptedProvider();
  provider.correction = 'I went to school yesterday at 5.';
  const result = await correctWithGemini(provider, { consent: CONSENT }, 'I am go to school yesterday.', 'english', 'clean');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'fact_guard_rejected');
});

test('valid Gemini correction passes the guard and is returned as a preview', async () => {
  const provider = new ScriptedProvider();
  provider.correction = 'I went to school yesterday.';
  const result = await correctWithGemini(
    provider, { consent: CONSENT }, 'I am go to school yesterday.', 'english', 'clean',
  );
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.source, 'gemini');
  assert.equal(result.value.corrected, 'I went to school yesterday.');
  assert.equal(result.value.factGuard, 'passed');
  assert.equal(provider.correctCalls, 1);
});

test('extractFacts finds emails, URLs, Bengali digits and technical terms', () => {
  const facts = extractFacts('ref: ABC123 a@b.com https://example.com ১২৩ 2026-01-01', ['ABC123']);
  const values = facts.map((f) => f.value);
  assert.ok(values.includes('https://example.com'));
  assert.ok(values.includes('a@b.com'));
  assert.ok(values.includes('ABC123'));
  assert.ok(values.includes('১২৩'));
  assert.ok(values.includes('2026-01-01'));
});

test('detectLanguage uses Unicode script, not network', () => {
  assert.equal(detectLanguage('আমি ভালো আছি'), 'bangla');
  assert.equal(detectLanguage('I am fine'), 'english');
  assert.equal(detectLanguage(''), 'english');
});

test('diffText handles pure insert, pure delete and equal text', () => {
  assert.deepEqual(diffText('a b', 'a b'), [{ kind: 'equal', original: 'a', corrected: 'a' }, { kind: 'equal', original: 'b', corrected: 'b' }]);
  const inserted = diffText('a', 'a b');
  assert.equal(inserted.some((t) => t.kind === 'added' && t.corrected === 'b'), true);
  const removed = diffText('a b', 'a');
  assert.equal(removed.some((t) => t.kind === 'removed' && t.original === 'b'), true);
});

class CountingTransport implements HttpTransport {
  calls = 0;
  async send(_request: GeminiRequest, _timeoutMs: number) {
    this.calls += 1;
    return { status: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] } }] }) };
  }
}

test('NO CONSENT through correctWithGemini + real provider ⇒ zero network calls', async () => {
  const transport = new CountingTransport();
  const provider = new GeminiApiProvider({
    storage: new TestOnlyMemoryStorage(),
    config: withConfig(DEFAULT_GEMINI_CONFIG, { maxRetries: 0 }),
    transport,
  });
  const result = await correctWithGemini(
    provider, { consent: NO_CONSENT }, 'I am go to school yesterday.', 'english', 'clean',
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(transport.calls, 0);
});
