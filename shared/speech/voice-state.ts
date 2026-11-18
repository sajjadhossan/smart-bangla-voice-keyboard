/**
 * Authoritative 11-state voice workflow machine (Appendix D).
 * Pure reducer: no timers, no I/O, no provider imports.
 */
import type { VoiceState } from '../core/types.ts';

export type VoiceEvent =
  | { readonly type: 'START' }
  | { readonly type: 'CAPTURED' }
  | { readonly type: 'TRANSCRIBE' }
  | { readonly type: 'TRANSCRIBED' }
  | { readonly type: 'CORRECT' }
  | { readonly type: 'CORRECTED' }
  | { readonly type: 'TRANSLATE' }
  | { readonly type: 'TRANSLATED' }
  | { readonly type: 'INSERT' }
  | { readonly type: 'INSERTED' }
  | { readonly type: 'ERROR' }
  | { readonly type: 'CANCEL' }
  | { readonly type: 'RESET' };

/** Explicit allowed transitions. Anything not listed is a no-op (stays put). */
const TRANSITIONS: Readonly<Record<VoiceState, Readonly<Partial<Record<VoiceEvent['type'], VoiceState>>>>> =
  Object.freeze({
    IDLE: Object.freeze({ START: 'LISTENING', ERROR: 'ERROR', CANCEL: 'CANCELLED' }),
    LISTENING: Object.freeze({ CAPTURED: 'PROCESSING', CANCEL: 'CANCELLED', ERROR: 'ERROR' }),
    PROCESSING: Object.freeze({ TRANSCRIBE: 'TRANSCRIBING', CANCEL: 'CANCELLED', ERROR: 'ERROR' }),
    TRANSCRIBING: Object.freeze({ TRANSCRIBED: 'CORRECTING', ERROR: 'ERROR', CANCEL: 'CANCELLED' }),
    CORRECTING: Object.freeze({
      CORRECTED: 'TRANSLATING',
      TRANSLATED: 'RESULT_READY',
      ERROR: 'ERROR',
      CANCEL: 'CANCELLED',
    }),
    TRANSLATING: Object.freeze({ TRANSLATED: 'RESULT_READY', ERROR: 'ERROR', CANCEL: 'CANCELLED' }),
    RESULT_READY: Object.freeze({ INSERT: 'INSERTING', CANCEL: 'CANCELLED', ERROR: 'ERROR' }),
    INSERTING: Object.freeze({ INSERTED: 'COMPLETED', ERROR: 'ERROR', CANCEL: 'CANCELLED' }),
    COMPLETED: Object.freeze({ RESET: 'IDLE' }),
    ERROR: Object.freeze({ RESET: 'IDLE' }),
    CANCELLED: Object.freeze({ RESET: 'IDLE' }),
  });

export function nextVoiceState(current: VoiceState, event: VoiceEvent): VoiceState {
  return TRANSITIONS[current][event.type] ?? current;
}

/** All 11 authoritative states, for tests and diagnostics. */
export const ALL_VOICE_STATES: readonly VoiceState[] = Object.freeze([
  'IDLE', 'LISTENING', 'PROCESSING', 'TRANSCRIBING', 'CORRECTING',
  'TRANSLATING', 'RESULT_READY', 'INSERTING', 'COMPLETED', 'ERROR', 'CANCELLED',
]);
