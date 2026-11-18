/**
 * Voice modes A–F orchestration.
 *
 * This layer is the ONLY place that decides, for a selected voice mode, whether
 * a request is transcription-only or transcription+translation. It deliberately
 * keeps transcription and translation as TWO SEPARATE provider calls (never a
 * single "translate while transcribing" prompt), so:
 *   - modes A/B/E/F never translate — "exact" grammar can never auto-translate;
 *   - modes C/D transcribe with the source language, then translate in a
 *     second, independently consent-gated request;
 *   - auto language detection is represented by an absent language hint.
 *
 * It contains no network code of its own — all egress goes through the injected
 * GeminiProvider, which re-checks consent before every call.
 */
import type { ConsentRecord } from '../core/consent.ts';
import { err, ok, type Result } from '../core/result.ts';
import type {
  GrammarVoiceMode,
  LanguageMode,
  VoiceMode,
  VoiceState,
} from '../core/types.ts';
import type { RequestContext, GeminiProvider } from '../gemini/provider.ts';

/** Per-mode source language hints. undefined ⇒ let the model auto-detect. */
export const VOICE_MODE_SOURCES: Readonly<Record<VoiceMode, readonly string[] | undefined>> =
  Object.freeze({
    A: Object.freeze(['bn-BD']), // Bangla speech → Bangla text
    B: Object.freeze(['en-US', 'en-GB']), // English speech → English text
    C: Object.freeze(['bn-BD']), // Bangla speech → English translation
    D: Object.freeze(['en-US', 'en-GB']), // English speech → Bangla translation
    E: Object.freeze(['bn-BD']), // Banglish (romanized) speech → Bangla text
    F: undefined, // mixed Bangla-English → auto-detect, mixed output
  });

/** Only C and D request a translation; every other mode is transcription-only. */
export const VOICE_MODE_TARGETS: Readonly<Record<VoiceMode, string | null>> = Object.freeze({
  A: null,
  B: null,
  C: 'English',
  D: 'Bengali',
  E: null,
  F: null,
});

export interface VoiceModePlan {
  readonly mode: VoiceMode;
  readonly sourceLanguageCodes: readonly string[] | undefined;
  readonly grammarMode: GrammarVoiceMode;
  readonly targetLanguage: string | null;
  readonly translates: boolean;
}

export interface PlanOptions {
  /** Manual language override: 'auto' forces detection; unset uses mode default. */
  readonly languageMode?: LanguageMode;
  readonly grammarMode?: GrammarVoiceMode;
}

/**
 * Pure planner. Manual language overrides the source hint; 'auto' removes it.
 * Translation target is ALWAYS fixed by the mode — a language toggle can never
 * silently turn mode A into a translation request.
 */
export function planVoiceMode(mode: VoiceMode, options: PlanOptions = {}): VoiceModePlan {
  const grammarMode = options.grammarMode ?? 'exact';
  const sourceLanguageCodes =
    options.languageMode === 'auto'
      ? undefined
      : options.languageMode === 'bangla'
        ? ['bn-BD']
        : options.languageMode === 'english'
          ? ['en-US', 'en-GB']
          : VOICE_MODE_SOURCES[mode];
  const targetLanguage = VOICE_MODE_TARGETS[mode];
  return Object.freeze({
    mode,
    sourceLanguageCodes,
    grammarMode,
    targetLanguage,
    translates: targetLanguage !== null,
  });
}

export type VoiceStepKind = 'transcribe' | 'translate';

export interface VoiceStep {
  readonly kind: VoiceStepKind;
  readonly state: VoiceState;
  readonly detail: string;
}

export interface VoiceModeInput extends PlanOptions {
  readonly ctx: RequestContext;
  readonly mode: VoiceMode;
  readonly audioBase64: string;
  readonly mimeType: string;
}

export interface VoiceResult {
  readonly mode: VoiceMode;
  /** Raw transcript in the source language (before any translation). */
  readonly transcript: string;
  /** What the keyboard will insert. Equals transcript when no translation. */
  readonly finalText: string;
  readonly translated: boolean;
  /** Audit trail — two entries for C/D, one for A/B/E/F. */
  readonly steps: readonly VoiceStep[];
}

export interface VoiceModeCallbacks {
  readonly onState?: (state: VoiceState) => void;
  readonly onStep?: (step: VoiceStep) => void;
}

/**
 * Execute a voice mode end to end. Returns a Result; provider errors propagate
 * unchanged. A failed translation does NOT corrupt/return the raw transcript —
 * the caller sees the error and can decide whether to insert the original.
 */
export async function executeVoiceMode(
  provider: GeminiProvider,
  input: VoiceModeInput,
  callbacks: VoiceModeCallbacks = {},
): Promise<Result<VoiceResult>> {
  const plan = planVoiceMode(input.mode, input);
  const steps: VoiceStep[] = [];
  const emitState = (state: VoiceState): void => callbacks.onState?.(state);
  const recordStep = (step: VoiceStep): void => {
    steps.push(step);
    callbacks.onStep?.(step);
    emitState(step.state);
  };

  // Step 1 — always transcribe. Exact grammar ⇒ VERBATIM, others ⇒ SMART
  // (decided inside the provider from plan.grammarMode).
  recordStep({
    kind: 'transcribe',
    state: 'TRANSCRIBING',
    detail: `${input.mode} · ${plan.sourceLanguageCodes?.join(',') ?? 'auto'} · ${plan.grammarMode}`,
  });
  const transcribed = await provider.transcribe({
    ctx: input.ctx,
    audioBase64: input.audioBase64,
    mimeType: input.mimeType,
    mode: input.mode,
    grammarMode: plan.grammarMode,
    languageCodes: plan.sourceLanguageCodes,
  });
  if (!transcribed.ok) return err(transcribed.error);
  const transcript = transcribed.value;

  // Step 2 — translate ONLY for modes that explicitly request it (C/D).
  if (!plan.translates || plan.targetLanguage === null) {
    emitState('RESULT_READY');
    return ok(
      Object.freeze({
        mode: input.mode,
        transcript,
        finalText: transcript,
        translated: false,
        steps: Object.freeze([...steps]),
      }),
    );
  }

  recordStep({ kind: 'translate', state: 'TRANSLATING', detail: `→ ${plan.targetLanguage}` });
  const translated = await provider.translate({
    ctx: input.ctx,
    text: transcript,
    targetLanguage: plan.targetLanguage,
    source: 'voice', // voice-derived text; provider gates with voice consent
  });
  if (!translated.ok) return err(translated.error);

  emitState('RESULT_READY');
  return ok(
    Object.freeze({
      mode: input.mode,
      transcript,
      finalText: translated.value,
      translated: true,
      steps: Object.freeze([...steps]),
    }),
  );
}

/** Exposed for UI: does this mode insert the transcript directly? */
export function isInsertAfterTranscriptionOnly(mode: VoiceMode): boolean {
  return !planVoiceMode(mode).translates;
}
