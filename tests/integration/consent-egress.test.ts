/**
 * Step 15 — integration join: consent → provider → one-time insertion → history.
 *
 * These tests use a counting fake transport so "zero egress" and "exactly one
 * insert" are measured, not assumed. No real network or microphone is used.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { grantConsent, NO_CONSENT, type ConsentRecord } from '../../shared/core/consent.ts';
import { isOk, type Result } from '../../shared/core/result.ts';
import { TestOnlyMemoryStorage } from '../../shared/settings/secure-storage.ts';
import { DEFAULT_GEMINI_CONFIG, withConfig } from '../../shared/gemini/config.ts';
import { GeminiApiProvider } from '../../shared/gemini/provider.ts';
import type {
  GeminiRequest,
  HttpTransport,
  TransportResponse,
} from '../../shared/gemini/transport.ts';
import type { TextSink } from '../../shared/service/voice-service.ts';
import { VoiceService } from '../../shared/service/voice-service.ts';

const OK_BODY =
  '{"candidates":[{"content":{"parts":[{"text":"আমি বাংলাদেশে থাকি।"}]}}]}';
const FAKE_KEY = 'AIzaFakeKeyForDeterministicTests1234567890';

class CountingTransport implements HttpTransport {
  calls = 0;
  requests: GeminiRequest[] = [];

  async send(request: GeminiRequest, _timeoutMs: number): Promise<TransportResponse> {
    this.calls += 1;
    this.requests.push(request);
    return { status: 200, body: OK_BODY };
  }
}

class RecordingSink implements TextSink {
  inserts: string[] = [];

  async insert(text: string): Promise<Result<void>> {
    this.inserts.push(text);
    return { ok: true, value: undefined };
  }
}

function harness() {
  const storage = new TestOnlyMemoryStorage();
  const transport = new CountingTransport();
  const sink = new RecordingSink();
  const provider = new GeminiApiProvider({
    storage,
    transport,
    config: withConfig(DEFAULT_GEMINI_CONFIG, { maxRetries: 0, retryBaseDelayMs: 0 }),
    sleep: async () => {},
  });
  const service = new VoiceService({ provider, sink, clock: () => 1000 });
  return { storage, transport, sink, provider, service };
}

async function withKey(storage: TestOnlyMemoryStorage): Promise<void> {
  await storage.set('gemini_api_key', FAKE_KEY);
}

const voiceConsent: ConsentRecord = grantConsent('voice', 500);
const baseInput = {
  mode: 'A' as const,
  audioBase64: 'AA==',
  mimeType: 'audio/wav',
};

test('NO_CONSENT: zero provider calls, zero inserts, no history', async () => {
  const { transport, sink, service } = harness();
  const result = await service.run({
    ...baseInput,
    idempotencyKey: 'k-no-consent',
    ctx: { consent: NO_CONSENT },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(transport.calls, 0, 'no egress without consent');
  assert.equal(sink.inserts.length, 0, 'nothing inserted without consent');
  assert.equal(service.history.list().length, 0);
});

test('text-only consent cannot send voice-derived audio', async () => {
  const { storage, transport, sink, service } = harness();
  await withKey(storage);
  const result = await service.run({
    ...baseInput,
    idempotencyKey: 'k-text-scope',
    ctx: { consent: grantConsent('text', 500) },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(transport.calls, 0);
  assert.equal(sink.inserts.length, 0);
});

test('consent + key: one transcription call, exactly one insert, one history entry', async () => {
  const { storage, transport, sink, service } = harness();
  await withKey(storage);
  const result = await service.run({
    ...baseInput,
    idempotencyKey: 'k-once',
    ctx: { consent: voiceConsent },
  });
  assert.equal(result.ok, true);
  assert.equal(transport.calls, 1);
  assert.equal(sink.inserts.length, 1);
  assert.equal(sink.inserts[0], 'আমি বাংলাদেশে থাকি।');
  assert.equal(service.history.list().length, 1);
  if (result.ok) {
    assert.equal(result.value.deduplicated, false);
    assert.equal(result.value.historyId, 'v-1');
    assert.equal(result.value.voice.translated, false);
  }
});

test('retry with same idempotency key: zero new egress, zero duplicate insert', async () => {
  const { storage, transport, sink, service } = harness();
  await withKey(storage);
  const input = {
    ...baseInput,
    idempotencyKey: 'k-retry',
    ctx: { consent: voiceConsent },
  };
  const first = await service.run(input);
  const second = await service.run(input);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(transport.calls, 1, 'provider called only once');
  assert.equal(sink.inserts.length, 1, 'inserted only once on retry');
  assert.equal(service.history.list().length, 1);
  if (second.ok) assert.equal(second.value.deduplicated, true);
});

test('concurrent callers with same key share a single action', async () => {
  const { storage, transport, sink, service } = harness();
  await withKey(storage);
  const input = {
    ...baseInput,
    idempotencyKey: 'k-concurrent',
    ctx: { consent: voiceConsent },
  };
  const [a, b] = await Promise.all([service.run(input), service.run(input)]);
  assert.equal(isOk(a), true);
  assert.equal(isOk(b), true);
  assert.equal(transport.calls, 1);
  assert.equal(sink.inserts.length, 1);
});

test('different idempotency keys represent distinct user actions', async () => {
  const { storage, transport, sink, service } = harness();
  await withKey(storage);
  await service.run({
    ...baseInput,
    idempotencyKey: 'k-a',
    ctx: { consent: voiceConsent },
  });
  await service.run({
    ...baseInput,
    idempotencyKey: 'k-b',
    ctx: { consent: voiceConsent },
  });
  assert.equal(transport.calls, 2);
  assert.equal(sink.inserts.length, 2);
  assert.equal(service.history.list().length, 2);
});

test('translation mode C: separate transcribe + translate calls, both voice-gated', async () => {
  const { storage, transport, sink, service } = harness();
  await withKey(storage);
  const result = await service.run({
    ...baseInput,
    mode: 'C',
    idempotencyKey: 'k-mode-c',
    ctx: { consent: voiceConsent },
  });
  assert.equal(result.ok, true);
  assert.equal(transport.calls, 2, 'transcribe then translate are two calls');
  assert.equal(sink.inserts.length, 1);
  if (result.ok) assert.equal(result.value.voice.translated, true);
  const urls = transport.requests.map((r) => r.url);
  assert.match(urls[0] ?? '', /transcribe/);
  assert.match(urls[1] ?? '', /flash|generateContent/);
});

test('revoking consent after a grant stops all egress', async () => {
  const { storage, transport, sink, service } = harness();
  await withKey(storage);
  await service.run({
    ...baseInput,
    idempotencyKey: 'k-before-revoke',
    ctx: { consent: voiceConsent },
  });
  const result = await service.run({
    ...baseInput,
    idempotencyKey: 'k-after-revoke',
    ctx: { consent: NO_CONSENT },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(transport.calls, 1, 'only the pre-revoke call happened');
  assert.equal(sink.inserts.length, 1);
});

test('failed insertion is not cached: a later retry can succeed', async () => {
  const { storage, transport, provider } = harness();
  await withKey(storage);
  let fail = true;
  const flakySink: TextSink = {
    async insert(_text) {
      if (fail) {
        fail = false;
        return { ok: false, error: 'insert_failed' };
      }
      return { ok: true, value: undefined };
    },
  };
  const failingService = new VoiceService({
    provider,
    sink: flakySink,
    clock: () => 1000,
  });
  const input = {
    ...baseInput,
    idempotencyKey: 'k-flaky',
    ctx: { consent: voiceConsent },
  };
  const first = await failingService.run(input);
  assert.equal(first.ok, false);
  const second = await failingService.run(input);
  assert.equal(second.ok, true);
  assert.equal(transport.calls, 2, 'provider retried because first run failed');
});

test('history delete and clear are real and do not affect insertion', async () => {
  const { storage, sink, service } = harness();
  await withKey(storage);
  const first = await service.run({
    ...baseInput,
    idempotencyKey: 'k-h1',
    ctx: { consent: voiceConsent },
  });
  const second = await service.run({
    ...baseInput,
    idempotencyKey: 'k-h2',
    ctx: { consent: voiceConsent },
  });
  assert.equal(service.history.list().length, 2);
  if (!first.ok || !second.ok) throw new Error('setup failed');
  assert.equal(service.deleteHistory(first.value.historyId as string), true);
  assert.equal(service.history.list().length, 1);
  assert.equal(service.deleteHistory('does-not-exist'), false);
  service.clearHistory();
  assert.equal(service.history.list().length, 0);
  assert.equal(sink.inserts.length, 2, 'history deletion never un-inserts text');
});
