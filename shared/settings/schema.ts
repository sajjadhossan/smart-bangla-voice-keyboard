import { NO_CONSENT, type ConsentRecord } from '../core/consent.ts';
import type {
  ConnectivityMode,
  GrammarVoiceMode,
  LanguageMode,
  LayoutId,
  ThemeId,
  ToneMode,
} from '../core/types.ts';

/** All settings are plain data so they can cross native bridges safely. */
export interface AppSettings {
  readonly connectivityMode: ConnectivityMode;
  readonly consent: ConsentRecord;
  readonly languageMode: LanguageMode;
  readonly layout: LayoutId;
  readonly toneMode: ToneMode;
  readonly theme: ThemeId;
  readonly autoTransliteration: boolean;
  readonly grammarOnVoice: GrammarVoiceMode;
  readonly autoStopSilenceMs: number;
  readonly showPartialTranscription: boolean;
  readonly historyEnabled: boolean;
  /** null = direct personal key mode; otherwise HTTPS proxy base URL. */
  readonly proxyUrl: string | null;
  readonly textModel: string | null;
  readonly audioModel: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = Object.freeze({
  connectivityMode: 'auto',
  consent: NO_CONSENT,
  languageMode: 'bangla',
  layout: 'bangla',
  toneMode: 'normal',
  theme: 'system',
  autoTransliteration: false,
  grammarOnVoice: 'exact',
  autoStopSilenceMs: 1200,
  showPartialTranscription: true,
  historyEnabled: false,
  proxyUrl: null,
  textModel: null,
  audioModel: null,
});

/** Immutable patch — returns a new frozen object. */
export function updateSettings(
  current: AppSettings,
  patch: Partial<AppSettings>,
): AppSettings {
  return Object.freeze({ ...current, ...patch });
}

export function validateProxyUrl(url: string | null): string | null {
  if (url === null || url === '') return null;
  if (!url.startsWith('https://')) return 'Proxy URL must use HTTPS';
  return null;
}
