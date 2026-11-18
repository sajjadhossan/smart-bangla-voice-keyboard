/**
 * GeminiProvider — the only module allowed to send user text/audio off-device.
 *
 * Hard rules enforced here:
 *  - Every capability calls assertCanSend() BEFORE building or sending a request.
 *    No consent ⇒ zero network calls (ConsentDeniedError ⇒ err('consent_denied')).
 *  - All endpoints, models and headers come from verified config.
 *  - Connection state is derived only from real HTTP results.
 *  - Nothing logs the key, request body, audio or returned text.
 *  - The live key probe needs an explicit user-confirmed flag AND config.allowLiveCheck.
 */
import { assertCanSend, ConsentDeniedError, type ConsentRecord } from '../core/consent.ts';
import { err, ok, type Result } from '../core/result.ts';
import type {
  ConnectionState,
  GrammarVoiceMode,
  ToneMode,
  VoiceMode,
} from '../core/types.ts';
import type { SecureStorage } from '../settings/secure-storage.ts';
import { getApiKey } from './api-key.ts';
import {
  DEFAULT_GEMINI_CONFIG,
  generateContentUrl,
  modelsListUrl,
  withConfig,
  type GeminiConfig,
} from './config.ts';
import { classifyStatus, nextConnectionState } from './connection.ts';
import {
  FetchTransport,
  NetworkTransportError,
  type GeminiRequest,
  type HttpTransport,
  type TransportResponse,
} from './transport.ts';

export interface RequestContext {
  readonly consent: ConsentRecord;
}

export interface TranscriptionInput {
  readonly ctx: RequestContext;
  /** Base64 of the recorded audio (no silent capture happens here). */
  readonly audioBase64: string;
  readonly mimeType: string;
  readonly mode: VoiceMode;
  readonly grammarMode?: GrammarVoiceMode;
  /** Verified hints such as bn-BD, bn-IN, en-US, en-GB. */
  readonly languageCodes?: readonly string[];
}

export interface TranslateInput {
  readonly ctx: RequestContext;
  readonly text: string;
  readonly targetLanguage: string;
  /** Provenance decides the consent scope — voice-derived vs typed text. */
  readonly source: 'voice' | 'text';
}

export interface TextInput {
  readonly ctx: RequestContext;
  readonly text: string;
  readonly language: string;
}

export interface RewriteInput extends TextInput {
  readonly tone: ToneMode;
  /** Action-specific intent (Improve clarity, Expand, …). Optional. */
  readonly instruction?: string;
}

/** Explicit capability surface — UI never binds to a model ID. */
export interface GeminiProvider {
  readonly state: ConnectionState;
  testConnection(userConfirmed: boolean): Promise<ConnectionState>;
  transcribe(input: TranscriptionInput): Promise<Result<string>>;
  translate(input: TranslateInput): Promise<Result<string>>;
  correct(input: TextInput): Promise<Result<string>>;
  rewrite(input: RewriteInput): Promise<Result<string>>;
  summarize(input: TextInput): Promise<Result<string>>;
}

export interface GeminiProviderOptions {
  readonly storage: SecureStorage;
  readonly config?: GeminiConfig;
  /** Injected for deterministic tests; defaults to real HTTPS. */
  readonly transport?: HttpTransport;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onStateChange?: (state: ConnectionState) => void;
}

type EgressScope = 'voice' | 'text';

interface BuiltRequest {
  readonly url: string;
  readonly body: string;
}

function textBody(prompt: string): string {
  return JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
}

export interface TranscriptionConfig {
  /** Verified values from docs/gemini-facts.md. */
  readonly mode: 'VERBATIM' | 'SMART';
  readonly languageCodes?: readonly string[];
}

/** Exact ⇒ VERBATIM (never cleans up). Other grammar modes ⇒ SMART. */
export function transcriptionConfigFor(
  grammar: GrammarVoiceMode,
  languageCodes: readonly string[] | undefined,
): TranscriptionConfig {
  const mode: TranscriptionConfig['mode'] = grammar === 'exact' ? 'VERBATIM' : 'SMART';
  return languageCodes && languageCodes.length > 0 ? { mode, languageCodes } : { mode };
}

/**
 * Verified generateContent request shape from official docs:
 * inlineData part + generationConfig.audioTranscriptionConfig.
 * No prompt text part — the dedicated config is the supported mechanism.
 */
function audioBody(input: TranscriptionInput, config: TranscriptionConfig): string {
  return JSON.stringify({
    contents: [{ parts: [{ inlineData: { mimeType: input.mimeType, data: input.audioBase64 } }] }],
    generationConfig: {
      audioTranscriptionConfig: {
        mode: config.mode,
        ...(config.languageCodes ? { languageCodes: [...config.languageCodes] } : {}),
      },
    },
  });
}

function guardPrompt(kind: string, language: string, text: string): string {
  return `${kind} Preserve names, dates, numbers, amounts and technical terms exactly. Return only the result.\nLanguage: ${language}\n\n${text}`;
}

/** Extract text safely: scan all candidates, skip thoughts, reject non-strings. */
function extractResponseText(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      output_text?: unknown;
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: unknown;
            thought?: unknown;
            audioTranscription?: { text?: unknown };
          }>;
        };
      }>;
    };
    const pieces: string[] = [];
    for (const candidate of parsed.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.thought === true) continue;
        const raw = part.audioTranscription?.text ?? part.text;
        if (typeof raw === 'string' && raw.length > 0) pieces.push(raw);
      }
    }
    if (pieces.length === 0 && typeof parsed.output_text === 'string') {
      return parsed.output_text.trim().length > 0 ? parsed.output_text.trim() : null;
    }
    const text = pieces.join('').trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function sendWithRetry(
  transport: HttpTransport,
  request: GeminiRequest,
  config: GeminiConfig,
  sleep: (ms: number) => Promise<void>,
): Promise<TransportResponse> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const response = await transport.send(request, config.timeoutMs);
      const retryable = response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!retryable || attempt === config.maxRetries) return response;
      await sleep(config.retryBaseDelayMs * (attempt + 1));
    } catch (error) {
      if (attempt === config.maxRetries) {
        throw error instanceof NetworkTransportError ? error : new NetworkTransportError();
      }
      await sleep(config.retryBaseDelayMs * (attempt + 1));
    }
  }
  // Defensive: the loop always returns or throws. Never fabricate a response.
  throw new NetworkTransportError();
}

export class GeminiApiProvider implements GeminiProvider {
  private readonly storage: SecureStorage;
  private readonly config: GeminiConfig;
  private readonly transport: HttpTransport;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onStateChange?: (state: ConnectionState) => void;
  private currentState: ConnectionState = 'not_configured';

  constructor(options: GeminiProviderOptions) {
    this.storage = options.storage;
    const base = options.config ?? DEFAULT_GEMINI_CONFIG;
    // Clamp so the retry loop can never produce a synthetic status.
    this.config = base.maxRetries >= 0 ? base : withConfig(base, { maxRetries: 0 });
    this.transport = options.transport ?? new FetchTransport();
    this.sleep =
      options.sleep ??
      ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
    this.onStateChange = options.onStateChange;
  }

  get state(): ConnectionState {
    return this.currentState;
  }

  private setState(next: ConnectionState): void {
    this.currentState = next;
    if (this.onStateChange !== undefined) this.onStateChange(next);
  }

  /**
   * Real key validation. The GET /models request sends only the API key —
   * no user text or audio — and only after an explicit user-confirmed flag.
   * When the gate fails, the LAST KNOWN state is returned (not a fresh probe).
   */
  async testConnection(userConfirmed: boolean): Promise<ConnectionState> {
    if (!userConfirmed || !this.config.allowLiveCheck) return this.currentState;
    let key: string | null;
    try {
      key = await getApiKey(this.storage);
    } catch {
      this.setState('network_error');
      return this.currentState;
    }
    if (key === null) {
      this.setState(nextConnectionState(this.currentState, { type: 'key_removed' }));
      return this.currentState;
    }
    this.setState(nextConnectionState(this.currentState, { type: 'check_started' }));
    const request: GeminiRequest = {
      url: modelsListUrl(this.config),
      method: 'GET',
      headers: { 'x-goog-api-key': key },
    };
    let response: TransportResponse;
    try {
      response = await this.transport.send(request, this.config.timeoutMs);
    } catch {
      this.setState(nextConnectionState(this.currentState, { type: 'transport_error' }));
      return this.currentState;
    }
    this.setState(nextConnectionState(this.currentState, {
      type: 'http_result',
      status: response.status,
    }));
    return this.currentState;
  }

  async transcribe(input: TranscriptionInput): Promise<Result<string>> {
    const config = transcriptionConfigFor(input.grammarMode ?? 'exact', input.languageCodes);
    return this.run(input.ctx.consent, 'voice', () => ({
      url: generateContentUrl(this.config, this.config.transcribeModel),
      body: audioBody(input, config),
    }));
  }

  async translate(input: TranslateInput): Promise<Result<string>> {
    const prompt = `Translate the following text into ${input.targetLanguage}. Return only the translation.`;
    const scope: EgressScope = input.source === 'text' ? 'text' : 'voice';
    return this.run(input.ctx.consent, scope, () => ({
      url: generateContentUrl(this.config, this.config.textModel),
      body: textBody(`${prompt} Names, dates, numbers and amounts must be preserved.\n\n${input.text}`),
    }));
  }

  async correct(input: TextInput): Promise<Result<string>> {
    return this.run(input.ctx.consent, 'text', () => ({
      url: generateContentUrl(this.config, this.config.textModel),
      body: textBody(guardPrompt('Correct spelling and grammar in the following text.', input.language, input.text)),
    }));
  }

  async rewrite(input: RewriteInput): Promise<Result<string>> {
    return this.run(input.ctx.consent, 'text', () => ({
      url: generateContentUrl(this.config, this.config.textModel),
      body: textBody(guardPrompt(
        input.instruction ?? `Rewrite the following text in a ${input.tone} tone.`,
        input.language,
        input.text,
      )),
    }));
  }

  async summarize(input: TextInput): Promise<Result<string>> {
    return this.run(input.ctx.consent, 'text', () => ({
      url: generateContentUrl(this.config, this.config.textModel),
      body: textBody(guardPrompt('Summarize the following text.', input.language, input.text)),
    }));
  }

  /** Consent gate + real request. build() is only called after consent passes. */
  private async run(
    consent: ConsentRecord,
    scope: EgressScope,
    build: () => BuiltRequest,
  ): Promise<Result<string>> {
    try {
      assertCanSend(consent, scope);
    } catch (error) {
      if (error instanceof ConsentDeniedError) return err('consent_denied');
      throw error;
    }

    let key: string | null;
    try {
      key = await getApiKey(this.storage);
    } catch {
      this.setState('network_error');
      return err('storage_unavailable');
    }
    if (key === null) {
      this.setState('not_configured');
      return err('not_configured');
    }

    const built = build();
    const request: GeminiRequest = {
      url: built.url,
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: built.body,
    };

    let response: TransportResponse;
    try {
      response = await sendWithRetry(this.transport, request, this.config, this.sleep);
    } catch {
      this.setState('network_error');
      return err('network_error');
    }

    const state = classifyStatus(response.status);
    this.setState(state);
    if (state !== 'connected') return err(state);

    const text = extractResponseText(response.body);
    return text === null ? err('invalid_response') : ok(text);
  }
}
