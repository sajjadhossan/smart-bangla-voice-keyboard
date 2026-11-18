/**
 * Gemini client configuration. Model IDs and endpoints live here (never in the
 * UI), so an upgrade is a config change. Values are verified in docs/gemini-facts.md.
 */

export interface GeminiConfig {
  readonly apiVersion: 'v1beta';
  readonly baseUrl: 'https://generativelanguage.googleapis.com';
  /** Audio/transcription model — verified in official docs. */
  readonly transcribeModel: string;
  /** Text/reasoning model — verified in official docs. */
  readonly textModel: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  /**
   * A live connection probe (which sends the API key to Google) may only run
   * when the UI flips this after an explicit user "Test connection" action.
   */
  readonly allowLiveCheck: boolean;
}

export const DEFAULT_GEMINI_CONFIG: GeminiConfig = Object.freeze({
  apiVersion: 'v1beta',
  baseUrl: 'https://generativelanguage.googleapis.com',
  transcribeModel: 'gemini-3.5-transcribe',
  textModel: 'gemini-3.6-flash',
  timeoutMs: 30_000,
  maxRetries: 2,
  retryBaseDelayMs: 500,
  allowLiveCheck: false,
});

/** Immutable patch. */
export function withConfig(base: GeminiConfig, patch: Partial<GeminiConfig>): GeminiConfig {
  return Object.freeze({ ...base, ...patch });
}

export function generateContentUrl(config: GeminiConfig, model: string): string {
  return `${config.baseUrl}/${config.apiVersion}/models/${encodeURIComponent(model)}:generateContent`;
}

/** GET /models consumes no generation quota and returns 400 for an invalid key. */
export function modelsListUrl(config: GeminiConfig): string {
  return `${config.baseUrl}/${config.apiVersion}/models`;
}
