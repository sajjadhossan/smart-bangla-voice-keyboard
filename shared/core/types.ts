/** Platform-neutral vocabulary for Smart Bangla Voice Keyboard. */

export type LanguageMode = 'bangla' | 'english' | 'auto';
export type ConnectivityMode = 'offline' | 'online' | 'auto';
export type LayoutId = 'bangla' | 'english' | 'numbers' | 'symbols';
export type ThemeId = 'light' | 'dark' | 'system' | 'midnight' | 'solar';

/** Voice modes from section 05 of the brief. */
export type VoiceMode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** Four voice grammar modes from section 07. */
export type GrammarVoiceMode = 'exact' | 'smart' | 'clean' | 'professional';

/** Fifteen writing tones from section 08. */
export type ToneMode =
  | 'normal'
  | 'professional'
  | 'formal'
  | 'friendly'
  | 'casual'
  | 'polite'
  | 'business'
  | 'academic'
  | 'creative'
  | 'simple_english'
  | 'simple_bangla'
  | 'concise'
  | 'detailed'
  | 'confident'
  | 'empathetic';

/** Eight connection states from section 04. */
export type ConnectionState =
  | 'not_configured'
  | 'connecting'
  | 'connected'
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'network_error'
  | 'service_unavailable'
  | 'authentication_failed';

/** Eleven shared voice states from section 15. */
export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'TRANSCRIBING'
  | 'CORRECTING'
  | 'TRANSLATING'
  | 'RESULT_READY'
  | 'INSERTING'
  | 'COMPLETED'
  | 'ERROR'
  | 'CANCELLED';

export type SuggestionSource = 'dictionary' | 'transliteration' | 'ai' | 'spelling';

export interface Suggestion {
  readonly text: string;
  readonly source: SuggestionSource;
  readonly score: number;
}

export type KeyKind = 'char' | 'action';

export interface KeyDef {
  readonly id: string;
  readonly label: string;
  /** Inserted text for char keys, action identifier for action keys. */
  readonly value: string;
  readonly shiftedValue?: string;
  readonly kind: KeyKind;
}

export interface KeyboardLayout {
  readonly id: LayoutId;
  readonly language: LanguageMode;
  readonly rows: readonly (readonly KeyDef[])[];
}
