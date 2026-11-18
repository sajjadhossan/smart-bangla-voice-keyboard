/**
 * Shared voice orchestration surface used by every platform (Android IME,
 * Windows TSF, macOS IMK). This is the single business-logic entry point that
 * joins capture → voice mode → consent-gated egress → one-time insertion →
 * history.
 *
 * Privacy / safety invariants (enforced here and in the provider):
 *  - Consent is checked BEFORE any provider call. Voice-derived translation is
 *    gated with voice consent; no text is sent with NO_CONSENT.
 *  - Insertion happens at most once per `idempotencyKey`, even if the caller
 *    retries after a transient error or the provider retried internally.
 *  - Failed runs are never cached, so a later retry can still succeed.
 *  - History can be deleted per entry or cleared entirely.
 *  - The service never logs audio, prompts, or inserted text.
 */
import { assertCanSend, ConsentDeniedError, type ConsentRecord } from '../core/consent.ts';
import { err, ok, type Result } from '../core/result.ts';
import type { LanguageMode, GrammarVoiceMode, VoiceMode } from '../core/types.ts';
import type { RequestContext, GeminiProvider } from '../gemini/provider.ts';
import {
  executeVoiceMode,
  type VoiceModeCallbacks,
  type VoiceResult,
} from '../voice/voice-modes.ts';
import { IdempotencyGuard, type GuardOutcome } from './idempotency.ts';
import { VoiceHistory, type HistoryEntry } from './voice-history.ts';

/** Platform text sink — must insert into the currently focused field. */
export interface TextSink {
  insert(text: string): Promise<Result<void>>;
}

export interface VoiceRunInput {
  /** Unique per user accept action; retrying the same action reuses this key. */
  readonly idempotencyKey: string;
  readonly ctx: RequestContext;
  readonly mode: VoiceMode;
  readonly audioBase64: string;
  readonly mimeType: string;
  readonly languageMode?: LanguageMode;
  readonly grammarMode?: GrammarVoiceMode;
  readonly callbacks?: VoiceModeCallbacks;
  readonly nowMs?: number;
}

export interface VoiceOutcome {
  readonly voice: VoiceResult;
  readonly historyId: string | null;
  /** true when this call reused a prior successful insertion. */
  readonly deduplicated: boolean;
}

export interface VoiceServiceOptions {
  readonly provider: GeminiProvider;
  readonly sink: TextSink;
  readonly history?: VoiceHistory;
  readonly clock?: () => number;
}

export class VoiceService {
  readonly history: VoiceHistory;
  private readonly provider: GeminiProvider;
  private readonly sink: TextSink;
  private readonly clock: () => number;
  private readonly guard: IdempotencyGuard<Result<VoiceOutcome>>;

  constructor(options: VoiceServiceOptions) {
    this.provider = options.provider;
    this.sink = options.sink;
    this.history = options.history ?? new VoiceHistory();
    this.clock = options.clock ?? (() => Date.now());
    // Only cache successful outcomes; failures remain retryable.
    this.guard = new IdempotencyGuard<Result<VoiceOutcome>>((value) => value.ok);
  }

  async run(input: VoiceRunInput): Promise<Result<VoiceOutcome>> {
    // Defense in depth: provider also gates, but fail before audio is handled
    // at all when consent is absent.
    try {
      assertCanSend(input.ctx.consent, 'voice');
    } catch (error) {
      if (error instanceof ConsentDeniedError) return err('consent_denied');
      throw error;
    }

    const outcome = await this.guard.run(input.idempotencyKey, async () => {
      const executed = await executeVoiceMode(this.provider, {
        ctx: input.ctx,
        mode: input.mode,
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
        languageMode: input.languageMode,
        grammarMode: input.grammarMode,
        callbacks: input.callbacks,
      });
      if (!executed.ok) return err(executed.error);

      const inserted = await this.sink.insert(executed.value.finalText);
      if (!inserted.ok) return err(inserted.error);

      const entry = this.history.add(
        executed.value.mode,
        executed.value.finalText,
        executed.value.translated,
        input.nowMs ?? this.clock(),
      );
      return ok<VoiceOutcome>({
        voice: executed.value,
        historyId: entry.id,
        deduplicated: false,
      });
    });

    if (!outcome.deduplicated) return outcome.value;
    if (!outcome.value.ok) return outcome.value;
    // Report the cached success with the deduplicated flag set.
    return ok<VoiceOutcome>({ ...outcome.value.value, deduplicated: true });
  }

  deleteHistory(id: string): boolean {
    return this.history.delete(id);
  }

  clearHistory(): void {
    this.history.clear();
    this.guard.clear();
  }
}
