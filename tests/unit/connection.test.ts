import assert from 'node:assert/strict';
import test from 'node:test';
import { grantConsent, NO_CONSENT, type ConsentRecord } from '../../shared/core/consent.ts';
import { isOk, type Result } from '../../shared/core/result.ts';
import type { ConnectionState } from '../../shared/core/types.ts';
import { TestOnlyMemoryStorage, type SecureStorage } from '../../shared/settings/secure-storage.ts';
import {
  getApiKey,
  getApiKeyInfo,
  maskApiKey,
  removeApiKey,
  setApiKey,
  validateApiKeyShape,
} from '../../shared/gemini/api-key.ts';
import { DEFAULT_GEMINI_CONFIG, withConfig } from '../../shared/gemini/config.ts';
import { classifyStatus, nextConnectionState } from '../../shared/gemini/connection.ts';
import { GeminiApiProvider } from '../../shared/gemini/provider.ts';
import {
  NetworkTransportError,
  type GeminiRequest,
  type HttpTransport,
  type TransportResponse,
} from '../../shared/gemini/transport.ts';

const OK_BODY = '{"candidates":[{"content":{"parts":[{"text":"নমস্কার"}]}}]}';
const FAKE_KEY = 'AIzaFakeKeyForDeterministicTests1234567890';

class FakeTransport implements HttpTransport {
  calls = 0;
  requests: GeminiRequest[] = [];
  private readonly queue: Array<TransportResponse | Error>;

  constructor(...responses: Array<TransportResponse | Error>) {
    this.queue = [...responses];
  }

  async send(request: GeminiRequest, _timeoutMs: number): Promise<TransportResponse> {
    this.calls += 1;
    this.requests.push(request);
    const next = this.queue.shift();
    if (next === undefined) return { status: 200, body: OK_BODY };
    if (next instanceof Error) throw next;
    return next;
  }
}

const TEST_CONFIG = withConfig(DEFAULT_GEMINI_CONFIG, {
  allowLiveCheck: true,
  retryBaseDelayMs: 0,
  maxRetries: 0,
});

const noSleep = async (_ms: number): Promise<void> => {};

interface Harness {
  provider: GeminiApiProvider;
  transport: FakeTransport;
  storage: TestOnlyMemoryStorage;
}

function harness(consent: ConsentRecord, ...responses: Array<TransportResponse | Error>): Harness {
  const storage = new TestOnlyMemoryStorage();
  const transport = new FakeTransport(...responses);
  const provider = new GeminiApiProvider({
    storage,
    config: TEST_CONFIG,
    transport,
    sleep: noSleep,
  });
  return { provider, transport, storage };
}

async function withKey(storage: TestOnlyMemoryStorage): Promise<void> {
  await storage.set('gemini_api_key', FAKE_KEY);
}

test('classifyStatus maps real HTTP statuses to connection states', () => {
  assert.equal(classifyStatus(200), 'connected');
  assert.equal(classifyStatus(201), 'connected');
  assert.equal(classifyStatus(400), 'invalid_api_key');
  assert.equal(classifyStatus(401), 'invalid_api_key');
  assert.equal(classifyStatus(403), 'authentication_failed');
  assert.equal(classifyStatus(429), 'quota_exceeded');
  assert.equal(classifyStatus(503), 'service_unavailable');
});

test('all 8 ConnectionState values are reachable from real events', () => {
  const observed = new Set<ConnectionState>([
    'not_configured',
    nextConnectionState('not_configured', { type: 'check_started' }),
    classifyStatus(200),
    classifyStatus(400),
    classifyStatus(403),
    classifyStatus(429),
    classifyStatus(503),
    nextConnectionState('connecting', { type: 'transport_error' }),
  ]);
  assert.equal(observed.size, 8, `expected 8 states, got ${[...observed].join(', ')}`);
});

test('testConnection requires explicit user confirmation — zero network without it', async () => {
  const { provider, transport, storage } = harness(NO_CONSENT);
  await withKey(storage);
  const state = await provider.testConnection(false);
  assert.equal(state, 'not_configured');
  assert.equal(transport.calls, 0);
});

test('testConnection with no stored key ⇒ not_configured, zero network', async () => {
  const { provider, transport } = harness(NO_CONSENT);
  const state = await provider.testConnection(true);
  assert.equal(state, 'not_configured');
  assert.equal(transport.calls, 0);
});

test('testConnection 200 ⇒ connected; GET sends only the key header', async () => {
  const { provider, transport, storage } = harness(NO_CONSENT, { status: 200, body: '{"models":[]}' });
  await withKey(storage);
  const state = await provider.testConnection(true);
  assert.equal(state, 'connected');
  assert.equal(provider.state, 'connected');
  assert.equal(transport.calls, 1);
  assert.equal(transport.requests[0].method, 'GET');
  assert.equal(transport.requests[0].headers['x-goog-api-key'], FAKE_KEY);
  assert.equal(transport.requests[0].body, undefined);
});

test('testConnection maps invalid key / quota / outage / network throw', async () => {
  const cases: Array<{ status?: number; error?: Error; expected: ConnectionState }> = [
    { status: 400, expected: 'invalid_api_key' },
    { status: 401, expected: 'invalid_api_key' },
    { status: 403, expected: 'authentication_failed' },
    { status: 429, expected: 'quota_exceeded' },
    { status: 503, expected: 'service_unavailable' },
    { error: new NetworkTransportError(), expected: 'network_error' },
  ];
  for (const item of cases) {
    const response = item.error ?? { status: item.status ?? 0, body: '' };
    const { provider, storage } = harness(NO_CONSENT, response);
    await withKey(storage);
    const state = await provider.testConnection(true);
    assert.equal(state, item.expected, `status=${item.status} error=${item.error?.name}`);
  }
});

test('connecting state is observable during a real probe', async () => {
  const seen: ConnectionState[] = [];
  const storage = new TestOnlyMemoryStorage();
  await withKey(storage);
  const provider = new GeminiApiProvider({
    storage,
    config: TEST_CONFIG,
    transport: new FakeTransport({ status: 200, body: '{}' }),
    sleep: noSleep,
    onStateChange: (state) => { seen.push(state); },
  });
  await provider.testConnection(true);
  assert.deepEqual(seen, ['connecting', 'connected']);
});

test('NO CONSENT ⇒ zero network calls for every capability', async () => {
  const { provider, transport } = harness(NO_CONSENT);
  const consent = NO_CONSENT;
  const results: Array<Result<string>> = [
    await provider.transcribe({ ctx: { consent }, audioBase64: 'AAAA', mimeType: 'audio/wav', mode: 'A' }),
    await provider.translate({ ctx: { consent }, text: 'hi', targetLanguage: 'বাংলা', source: 'voice' }),
    await provider.correct({ ctx: { consent }, text: 'hi', language: 'en' }),
    await provider.rewrite({ ctx: { consent }, text: 'hi', language: 'en', tone: 'normal' }),
    await provider.summarize({ ctx: { consent }, text: 'hi', language: 'en' }),
  ];
  assert.equal(transport.calls, 0);
  for (const result of results) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'consent_denied');
  }
});

test('voice consent allows transcribe but not text-only capabilities', async () => {
  const consent = grantConsent('voice', 1);
  const { provider, transport, storage } = harness(consent);
  await withKey(storage);
  const transcript = await provider.transcribe({
    ctx: { consent }, audioBase64: 'AAAA', mimeType: 'audio/wav', mode: 'A',
  });
  assert.equal(isOk(transcript), true);
  if (isOk(transcript)) assert.equal(transcript.value, 'নমস্কার');
  const corrected = await provider.correct({ ctx: { consent }, text: 'hi', language: 'en' });
  assert.equal(corrected.ok, false);
  if (!corrected.ok) assert.equal(corrected.error, 'consent_denied');
  assert.equal(transport.calls, 1);
});

test('granted consent sends a real HTTPS-shaped POST with verified model and key header', async () => {
  const consent = grantConsent('all', 1);
  const { provider, transport, storage } = harness(consent);
  await withKey(storage);
  const result = await provider.correct({ ctx: { consent }, text: 'আমি যাই', language: 'bn' });
  assert.equal(isOk(result), true);
  if (isOk(result)) assert.equal(result.value, 'নমস্কার');
  const request = transport.requests[0];
  assert.equal(request.method, 'POST');
  assert.match(request.url, /v1beta\/models\/gemini-3\.6-flash:generateContent$/);
  assert.equal(request.headers['x-goog-api-key'], FAKE_KEY);
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.equal(provider.state, 'connected');
});

test('invalid key response ⇒ invalid_api_key error, no fabricated success', async () => {
  const consent = grantConsent('all', 1);
  const { provider, storage } = harness(consent, { status: 400, body: '{"error":"bad"}' });
  await withKey(storage);
  const result = await provider.summarize({ ctx: { consent }, text: 'x', language: 'en' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'invalid_api_key');
  assert.equal(provider.state, 'invalid_api_key');
});

test('API key save/replace/remove/masked-show lifecycle', async () => {
  const storage = new TestOnlyMemoryStorage();
  const first = await setApiKey(storage, FAKE_KEY);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.value.present, true);
    assert.equal(first.value.masked, maskApiKey(FAKE_KEY));
    assert.equal(first.value.masked.includes(FAKE_KEY), false);
  }
  const replacement = 'AIzaReplacementKeyForDeterministicTests000';
  const second = await setApiKey(storage, replacement);
  assert.equal(second.ok, true);
  assert.equal(await getApiKey(storage), replacement);
  const info = await getApiKeyInfo(storage);
  assert.equal(info.ok, true);
  if (info.ok) {
    assert.equal(info.value.present, true);
    assert.equal(info.value.masked.includes(replacement), false);
  }

  const removed = await removeApiKey(storage);
  assert.equal(removed.ok, true);
  assert.equal(await getApiKey(storage), null);
  const afterRemoval = await getApiKeyInfo(storage);
  assert.equal(afterRemoval.ok, true);
  if (afterRemoval.ok) assert.equal(afterRemoval.value.present, false);
});

test('shape check rejects empty/short keys but is never presented as validation', async () => {
  assert.notEqual(validateApiKeyShape(''), null);
  assert.notEqual(validateApiKeyShape('short'), null);
  assert.equal(validateApiKeyShape(FAKE_KEY), null);
  const storage = new TestOnlyMemoryStorage();
  const result = await setApiKey(storage, 'bad key!');
  assert.equal(result.ok, false);
  assert.equal(await getApiKey(storage), null);
});

class ThrowingStorage implements SecureStorage {
  async get(_key: string): Promise<string | null> {
    throw new Error('keystore locked');
  }
  async set(_key: string, _value: string): Promise<void> {
    throw new Error('keystore locked');
  }
  async remove(_key: string): Promise<void> {
    throw new Error('keystore locked');
  }
}

test('404 / 422 map to service_unavailable, not authentication_failed', () => {
  assert.equal(classifyStatus(404), 'service_unavailable');
  assert.equal(classifyStatus(422), 'service_unavailable');
});

test('retry: 429 then 200 succeeds after two sends', async () => {
  const consent = grantConsent('all', 1);
  const storage = new TestOnlyMemoryStorage();
  await withKey(storage);
  const transport = new FakeTransport({ status: 429, body: '' }, { status: 200, body: OK_BODY });
  const provider = new GeminiApiProvider({
    storage,
    config: withConfig(TEST_CONFIG, { maxRetries: 2 }),
    transport,
    sleep: noSleep,
  });
  const result = await provider.correct({ ctx: { consent }, text: 'hi', language: 'en' });
  assert.equal(isOk(result), true);
  assert.equal(transport.calls, 2);
  assert.equal(provider.state, 'connected');
});

test('retry: exhausted 5xx and transport errors return real states', async () => {
  const consent = grantConsent('all', 1);
  for (const [responses, expectedState, expectedError] of [
    [[{ status: 503, body: '' }, { status: 503, body: '' }, { status: 503, body: '' }], 'service_unavailable', 'service_unavailable'],
    [new Array(3).fill(new NetworkTransportError()), 'network_error', 'network_error'],
  ] as const) {
    const storage = new TestOnlyMemoryStorage();
    await withKey(storage);
    const transport = new FakeTransport(...responses);
    const provider = new GeminiApiProvider({
      storage,
      config: withConfig(TEST_CONFIG, { maxRetries: 2 }),
      transport,
      sleep: noSleep,
    });
    const result = await provider.correct({ ctx: { consent }, text: 'hi', language: 'en' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, expectedError);
    assert.equal(provider.state, expectedState);
    assert.equal(transport.calls, 3);
  }
});

test('transcribe sends verified VERBATIM/SMART config and language hints', async () => {
  const consent = grantConsent('all', 1);
  const { provider, transport, storage } = harness(consent);
  await withKey(storage);
  const exact = await provider.transcribe({
    ctx: { consent }, audioBase64: 'AAAA', mimeType: 'audio/wav', mode: 'A',
    grammarMode: 'exact', languageCodes: ['bn-BD'],
  });
  assert.equal(isOk(exact), true);
  const body = JSON.parse(transport.requests[0].body ?? '{}');
  assert.equal(body.generationConfig.audioTranscriptionConfig.mode, 'VERBATIM');
  assert.deepEqual(body.generationConfig.audioTranscriptionConfig.languageCodes, ['bn-BD']);
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'audio/wav');
  assert.equal(body.contents[0].parts[0].inlineData.data, 'AAAA');

  await provider.transcribe({
    ctx: { consent }, audioBase64: 'AAAA', mimeType: 'audio/wav', mode: 'A', grammarMode: 'smart',
  });
  const body2 = JSON.parse(transport.requests[1].body ?? '{}');
  assert.equal(body2.generationConfig.audioTranscriptionConfig.mode, 'SMART');
  assert.equal('languageCodes' in body2.generationConfig.audioTranscriptionConfig, false);
});

test('typed-text translation cannot ride on voice-only consent', async () => {
  const voiceOnly = grantConsent('voice', 1);
  const { provider, transport, storage } = harness(voiceOnly);
  await withKey(storage);
  const typed = await provider.translate({
    ctx: { consent: voiceOnly }, text: 'hi', targetLanguage: 'বাংলা', source: 'text',
  });
  assert.equal(typed.ok, false);
  if (!typed.ok) assert.equal(typed.error, 'consent_denied');
  assert.equal(transport.calls, 0);

  const voice = await provider.translate({
    ctx: { consent: voiceOnly }, text: 'hi', targetLanguage: 'বাংলা', source: 'voice',
  });
  assert.equal(isOk(voice), true);
  assert.equal(transport.calls, 1);
});

test('response parser rejects non-strings and skips thought parts', async () => {
  const consent = grantConsent('all', 1);
  const body = JSON.stringify({
    candidates: [
      { content: { parts: [{ text: { notAString: true } }] } },
      { content: { parts: [
        { thought: true, text: 'hidden reasoning' },
        { audioTranscription: { text: 'final answer' } },
      ] } },
    ],
  });
  const good = harness(consent, { status: 200, body });
  await withKey(good.storage);
  const okResult = await good.provider.transcribe({
    ctx: { consent }, audioBase64: 'AAAA', mimeType: 'audio/wav', mode: 'A',
  });
  assert.equal(isOk(okResult), true);
  if (isOk(okResult)) assert.equal(okResult.value, 'final answer');

  const malformed = harness(consent, {
    status: 200, body: '{"candidates":[{"content":{"parts":[{"text":123}]}}]}',
  });
  await withKey(malformed.storage);
  const bad = await malformed.provider.transcribe({
    ctx: { consent }, audioBase64: 'AAAA', mimeType: 'audio/wav', mode: 'A',
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, 'invalid_response');
});

test('storage failures return err(storage_unavailable) instead of rejecting', async () => {
  const consent = grantConsent('all', 1);
  const storage = new ThrowingStorage();
  const transport = new FakeTransport();
  const provider = new GeminiApiProvider({ storage, config: TEST_CONFIG, transport, sleep: noSleep });

  const result = await provider.correct({ ctx: { consent }, text: 'hi', language: 'en' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'storage_unavailable');
  assert.equal(transport.calls, 0);

  assert.equal(await provider.testConnection(true), 'network_error');
  const saved = await setApiKey(storage, FAKE_KEY);
  assert.equal(saved.ok, false);
  if (!saved.ok) assert.equal(saved.error, 'storage_unavailable');
  const info = await getApiKeyInfo(storage);
  assert.equal(info.ok, false);
});
