import assert from 'node:assert/strict';
import test from 'node:test';
import { grantConsent, NO_CONSENT } from '../../shared/core/consent.ts';
import { err, isOk, ok } from '../../shared/core/result.ts';
import type { ConnectionState, GrammarVoiceMode, VoiceMode, VoiceState } from '../../shared/core/types.ts';
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
  executeVoiceMode,
  isInsertAfterTranscriptionOnly,
  planVoiceMode,
  VOICE_MODE_SOURCES,
  VOICE_MODE_TARGETS,
  type VoiceModeInput,
  type VoiceStep,
} from '../../shared/voice/voice-modes.ts';

/** Verbatim acceptance examples from Appendix E of the blueprint. */
const TRANSCRIPTS: Readonly<Record<VoiceMode, string>> = Object.freeze({
  A: 'আমি বাংলাদেশে থাকি।',
  B: 'I live in Bangladesh.',
  C: 'আমি ভালো আছি।',
  D: 'How are you?',
  // Banglish speech ("Ami valo achi") rendered into Bengali script by STT.
  E: 'আমি ভালো আছি',
  F: 'আজকে আমার একটা important meeting আছে।',
});

const TRANSLATIONS: Readonly<Record<string, string>> = Object.freeze({
  English: 'I am fine.',
  Bengali: 'তুমি কেমন আছো?',
});

const CONSENT = grantConsent('all', 1);

class RecordingProvider implements GeminiProvider {
  state: ConnectionState = 'connected';
  readonly transcribeCalls: TranscriptionInput[] = [];
  readonly translateCalls: TranslateInput[] = [];
  failTranscribe = false;
  failTranslate = false;
  readonly transcripts: Readonly<Record<VoiceMode, string>>;
  readonly translations: Readonly<Record<string, string>>;

  constructor(
    transcripts: Readonly<Record<VoiceMode, string>>,
    translations: Readonly<Record<string, string>>,
  ) {
    this.transcripts = transcripts;
    this.translations = translations;
  }

  async testConnection(_userConfirmed: boolean): Promise<ConnectionState> {
    return this.state;
  }
  async transcribe(input: TranscriptionInput) {
    this.transcribeCalls.push(input);
    return this.failTranscribe ? err('service_unavailable') : ok(this.transcripts[input.mode]);
  }
  async translate(input: TranslateInput) {
    this.translateCalls.push(input);
    return this.failTranslate
      ? err('service_unavailable')
      : ok(this.translations[input.targetLanguage] ?? input.text);
  }
  async correct(input: TextInput) {
    return ok(input.text);
  }
  async rewrite(input: RewriteInput) {
    return ok(input.text);
  }
  async summarize(input: TextInput) {
    return ok(input.text);
  }
}

function input(mode: VoiceMode, opts: Partial<VoiceModeInput> = {}): VoiceModeInput {
  return {
    ctx: { consent: CONSENT },
    mode,
    audioBase64: 'AAAA',
    mimeType: 'audio/wav',
    ...opts,
  };
}

function makeProvider(): RecordingProvider {
  return new RecordingProvider(TRANSCRIPTS, TRANSLATIONS);
}

test('mode A — Bangla speech → Bangla text (verbatim, transcription only)', async () => {
  const provider = makeProvider();
  const result = await executeVoiceMode(provider, input('A'));
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.finalText, 'আমি বাংলাদেশে থাকি।');
  assert.equal(result.value.transcript, result.value.finalText);
  assert.equal(result.value.translated, false);
  assert.equal(provider.transcribeCalls.length, 1);
  assert.equal(provider.translateCalls.length, 0);
  assert.deepEqual(provider.transcribeCalls[0].languageCodes, ['bn-BD']);
  assert.equal(provider.transcribeCalls[0].grammarMode, 'exact');
  assert.equal(result.value.steps.length, 1);
  assert.equal(result.value.steps[0].kind, 'transcribe');
});

test('mode B — English speech → English text (verbatim, transcription only)', async () => {
  const provider = makeProvider();
  const result = await executeVoiceMode(provider, input('B'));
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.finalText, 'I live in Bangladesh.');
  assert.equal(provider.translateCalls.length, 0);
  assert.deepEqual(provider.transcribeCalls[0].languageCodes, ['en-US', 'en-GB']);
});

test('mode C — Bangla speech → English translation (separate second call)', async () => {
  const provider = makeProvider();
  const result = await executeVoiceMode(provider, input('C'));
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.transcript, 'আমি ভালো আছি।');
  assert.equal(result.value.finalText, 'I am fine.');
  assert.equal(result.value.translated, true);
  assert.equal(provider.transcribeCalls.length, 1);
  assert.equal(provider.translateCalls.length, 1);
  assert.equal(provider.translateCalls[0].targetLanguage, 'English');
  assert.equal(provider.translateCalls[0].text, 'আমি ভালো আছি।');
  assert.equal(provider.translateCalls[0].source, 'voice');
  assert.deepEqual(result.value.steps.map((s) => s.kind), ['transcribe', 'translate']);
});

test('mode D — English speech → Bangla translation (separate second call)', async () => {
  const provider = makeProvider();
  const result = await executeVoiceMode(provider, input('D'));
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.transcript, 'How are you?');
  assert.equal(result.value.finalText, 'তুমি কেমন আছো?');
  assert.equal(provider.translateCalls.length, 1);
  assert.equal(provider.translateCalls[0].targetLanguage, 'Bengali');
});

test('mode E — Banglish speech → Bangla text (no translation call)', async () => {
  const provider = makeProvider();
  const result = await executeVoiceMode(provider, input('E'));
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.finalText, 'আমি ভালো আছি');
  assert.equal(provider.translateCalls.length, 0);
  assert.deepEqual(provider.transcribeCalls[0].languageCodes, ['bn-BD']);
});

test('mode F — mixed speech → mixed text with auto language detection', async () => {
  const provider = makeProvider();
  const result = await executeVoiceMode(provider, input('F'));
  assert.equal(isOk(result), true);
  if (!isOk(result)) return;
  assert.equal(result.value.finalText, 'আজকে আমার একটা important meeting আছে।');
  assert.equal(provider.translateCalls.length, 0);
  assert.equal(provider.transcribeCalls[0].languageCodes, undefined);
});

test('exact grammar NEVER auto-translates across all transcription-only modes', async () => {
  const grammars: readonly GrammarVoiceMode[] = ['exact', 'smart', 'clean', 'professional'];
  const modes: readonly VoiceMode[] = ['A', 'B', 'E', 'F'];
  for (const grammarMode of grammars) {
    for (const mode of modes) {
      const provider = makeProvider();
      const result = await executeVoiceMode(provider, input(mode, { grammarMode }));
      assert.equal(isOk(result), true, `${mode}/${grammarMode}`);
      assert.equal(provider.translateCalls.length, 0, `${mode}/${grammarMode} must not translate`);
      assert.equal(provider.transcribeCalls[0].grammarMode, grammarMode);
    }
  }
});

test('C/D translate in every grammar mode; raw transcript is never replaced by the translation', async () => {
  for (const mode of ['C', 'D'] as const) {
    const provider = makeProvider();
    const result = await executeVoiceMode(provider, input(mode, { grammarMode: 'exact' }));
    assert.equal(isOk(result), true);
    if (!isOk(result)) return;
    assert.equal(result.value.translated, true);
    assert.equal(result.value.transcript, TRANSCRIPTS[mode]);
    assert.notEqual(result.value.finalText, result.value.transcript);
    assert.equal(provider.transcribeCalls[0].grammarMode, 'exact');
  }
});

test('manual language override and auto detection are honored without changing the target', () => {
  assert.equal(planVoiceMode('A', { languageMode: 'auto' }).sourceLanguageCodes, undefined);
  assert.deepEqual(planVoiceMode('F').sourceLanguageCodes, undefined);
  const manual = planVoiceMode('D', { languageMode: 'bangla' });
  assert.deepEqual(manual.sourceLanguageCodes, ['bn-BD']);
  assert.equal(manual.targetLanguage, 'Bengali'); // target is fixed by mode, not by toggle
  assert.deepEqual(planVoiceMode('C', { languageMode: 'english' }).sourceLanguageCodes, ['en-US', 'en-GB']);
});

test('state callback sequence and audit steps match the real provider calls', async () => {
  const states: VoiceState[] = [];
  const steps: VoiceStep[] = [];
  const c = makeProvider();
  await executeVoiceMode(c, input('C'), {
    onState: (s) => states.push(s),
    onStep: (s) => steps.push(s),
  });
  assert.deepEqual(states, ['TRANSCRIBING', 'TRANSLATING', 'RESULT_READY']);
  assert.deepEqual(steps.map((s) => s.state), ['TRANSCRIBING', 'TRANSLATING']);

  const aStates: VoiceState[] = [];
  const a = makeProvider();
  await executeVoiceMode(a, input('A'), { onState: (s) => aStates.push(s) });
  assert.deepEqual(aStates, ['TRANSCRIBING', 'RESULT_READY']);
});

test('provider errors propagate; a failed translation never returns raw text as success', async () => {
  const transcribeFail = makeProvider();
  transcribeFail.failTranscribe = true;
  const t = await executeVoiceMode(transcribeFail, input('C'));
  assert.equal(t.ok, false);
  if (!t.ok) assert.equal(t.error, 'service_unavailable');
  assert.equal(transcribeFail.translateCalls.length, 0);

  const translateFail = makeProvider();
  translateFail.failTranslate = true;
  const r = await executeVoiceMode(translateFail, input('C'));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'service_unavailable');
});

class CountingTransport implements HttpTransport {
  calls = 0;
  async send(_request: GeminiRequest, _timeoutMs: number) {
    this.calls += 1;
    return {
      status: 200,
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'unexpected' }] } }] }),
    };
  }
}

test('NO CONSENT through the full orchestrator + real provider ⇒ zero network calls', async () => {
  const transport = new CountingTransport();
  const provider = new GeminiApiProvider({
    storage: new TestOnlyMemoryStorage(),
    config: withConfig(DEFAULT_GEMINI_CONFIG, { maxRetries: 0 }),
    transport,
  });
  const result = await executeVoiceMode(provider, input('A', { ctx: { consent: NO_CONSENT } }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(transport.calls, 0);
});

test('all six modes independently selectable; planner and insert-after-transcription agree', () => {
  const modes: readonly VoiceMode[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (const mode of modes) {
    const plan = planVoiceMode(mode);
    assert.equal(plan.mode, mode);
    assert.equal(plan.targetLanguage, VOICE_MODE_TARGETS[mode]);
    assert.equal(plan.translates, VOICE_MODE_TARGETS[mode] !== null);
    assert.equal(isInsertAfterTranscriptionOnly(mode), !plan.translates);
    assert.equal(
      (VOICE_MODE_SOURCES[mode] === undefined),
      mode === 'F',
    );
  }
});
