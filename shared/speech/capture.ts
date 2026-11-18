/**
 * Provider-agnostic, offline-capable voice capture. This module NEVER imports
 * the Gemini provider and has no upload path: it only records bytes to memory.
 * Microphone capture requires voice consent — no silent recording.
 */
import { assertCanSend, type ConsentRecord } from '../core/consent.ts';
import { err, ok, type Result } from '../core/result.ts';
import type { VoiceState } from '../core/types.ts';
import { nextVoiceState } from './voice-state.ts';

export interface AudioFormat {
  readonly mimeType: string;
  readonly sampleRateHz: number;
  readonly channels: 1 | 2;
  readonly encoding: 'pcm16' | 'opus' | 'aac';
}

export interface CaptureLevel {
  /** RMS amplitude 0..1. */
  readonly rms: number;
  /** Peak amplitude 0..1. */
  readonly peak: number;
  readonly timestampMs: number;
}

/** Platform adapter (Android/iOS/Windows/macOS). Shared core only defines the shape. */
export interface AudioCaptureDevice {
  readonly format: AudioFormat;
  requestPermission(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<Uint8Array>;
  cancel(): Promise<void>;
  level(): Promise<CaptureLevel | null>;
  cleanup(): Promise<void>;
}

export interface VadConfig {
  /** RMS at or above this counts as speech. */
  readonly threshold: number;
  /** Keep listening this long after speech drops. */
  readonly hangoverMs: number;
  /** Ignore speech bursts shorter than this. */
  readonly minSpeechMs: number;
}

export interface VadState {
  readonly speaking: boolean;
  readonly speechStartedAtMs: number | null;
  readonly lastSpeechAtMs: number | null;
}

export const INITIAL_VAD_STATE: VadState = Object.freeze({
  speaking: false,
  speechStartedAtMs: null,
  lastSpeechAtMs: null,
});

export type VadEvent = 'none' | 'speech_started' | 'end_of_speech';

/** Immutable VAD update. end_of_speech fires after hangover + minSpeech checks. */
export function updateVad(
  previous: VadState,
  rms: number,
  nowMs: number,
  config: VadConfig,
): { readonly state: VadState; readonly event: VadEvent } {
  const isSpeech = rms >= config.threshold;

  if (isSpeech) {
    if (!previous.speaking) {
      return {
        state: Object.freeze({ speaking: true, speechStartedAtMs: nowMs, lastSpeechAtMs: nowMs }),
        event: 'speech_started',
      };
    }
    return {
      state: Object.freeze({ speaking: true, speechStartedAtMs: previous.speechStartedAtMs, lastSpeechAtMs: nowMs }),
      event: 'none',
    };
  }

  if (!previous.speaking) return { state: previous, event: 'none' };

  const lastSpeechAtMs = previous.lastSpeechAtMs ?? nowMs;
  if (nowMs - lastSpeechAtMs < config.hangoverMs) return { state: previous, event: 'none' };

  const durationMs = lastSpeechAtMs - (previous.speechStartedAtMs ?? lastSpeechAtMs);
  const event: VadEvent = durationMs >= config.minSpeechMs ? 'end_of_speech' : 'none';
  return { state: INITIAL_VAD_STATE, event };
}

export type LevelStatus = 'silence' | 'ok' | 'loud' | 'clipping';

export function classifyLevel(level: CaptureLevel, threshold: number, ceiling = 0.99): LevelStatus {
  if (level.peak >= ceiling) return 'clipping';
  if (level.rms >= threshold) return 'loud';
  if (level.rms > 0) return 'ok';
  return 'silence';
}

export interface VoiceCaptureOptions {
  readonly device: AudioCaptureDevice;
  readonly vad: VadConfig;
  readonly onStateChange?: (state: VoiceState) => void;
}

/**
 * Drives capture state only (IDLE/LISTENING/PROCESSING/ERROR/CANCELLED).
 * Later pipeline states (TRANSCRIBING…COMPLETED) are driven by Step 7+ using
 * the same shared 11-state reducer.
 */
export class VoiceCaptureController {
  private readonly device: AudioCaptureDevice;
  private readonly vad: VadConfig;
  private readonly onStateChange?: (state: VoiceState) => void;
  private currentState: VoiceState = 'IDLE';
  private vadState: VadState = INITIAL_VAD_STATE;

  constructor(options: VoiceCaptureOptions) {
    this.device = options.device;
    this.vad = options.vad;
    this.onStateChange = options.onStateChange;
  }

  get state(): VoiceState {
    return this.currentState;
  }

  get format(): AudioFormat {
    return this.device.format;
  }

  private transition(event: Parameters<typeof nextVoiceState>[1]): VoiceState {
    const next = nextVoiceState(this.currentState, event);
    this.currentState = next;
    if (this.onStateChange !== undefined) this.onStateChange(next);
    return next;
  }

  /** Consent is checked BEFORE permission request or device.start(). */
  async start(consent: ConsentRecord): Promise<Result<void>> {
    try {
      assertCanSend(consent, 'voice');
    } catch {
      return err('consent_denied');
    }
    const granted = await this.device.requestPermission();
    if (!granted) {
      this.transition({ type: 'ERROR' });
      return err('permission_denied');
    }
    try {
      await this.device.start();
      this.vadState = INITIAL_VAD_STATE;
      this.transition({ type: 'START' });
      return ok(undefined);
    } catch {
      this.transition({ type: 'ERROR' });
      return err('capture_start_failed');
    }
  }

  /**
   * Feed one level sample. Returns 'end_of_speech' when VAD says the utterance
   * ended (caller decides whether to auto-stop based on settings).
   */
  async onLevel(level: CaptureLevel): Promise<VadEvent> {
    const result = updateVad(this.vadState, level.rms, level.timestampMs, this.vad);
    this.vadState = result.state;
    return result.event;
  }

  /** Stop recording and hand bytes back. No upload happens here. */
  async stop(): Promise<Result<Uint8Array>> {
    try {
      const bytes = await this.device.stop();
      this.transition({ type: 'CAPTURED' });
      return ok(bytes);
    } catch {
      this.transition({ type: 'ERROR' });
      return err('capture_stop_failed');
    }
  }

  async cancel(): Promise<void> {
    await this.device.cancel();
    this.vadState = INITIAL_VAD_STATE;
    this.transition({ type: 'CANCEL' });
  }

  async reset(): Promise<void> {
    await this.device.cleanup();
    this.vadState = INITIAL_VAD_STATE;
    this.transition({ type: 'RESET' });
  }
}
