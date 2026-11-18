/**
 * Revocable consent gate. Every Gemini/audio egress must pass this before
 * a single byte leaves the device. No consent means zero network calls.
 */

export type ConsentScope = 'voice' | 'text' | 'all';

export interface ConsentRecord {
  readonly granted: boolean;
  readonly scope: ConsentScope;
  readonly grantedAtMs: number | null;
}

export const NO_CONSENT: ConsentRecord = Object.freeze({
  granted: false,
  scope: 'voice',
  grantedAtMs: null,
});

export function grantConsent(scope: ConsentScope, nowMs: number): ConsentRecord {
  return Object.freeze({ granted: true, scope, grantedAtMs: nowMs });
}

export function revokeConsent(): ConsentRecord {
  return NO_CONSENT;
}

export function canSend(consent: ConsentRecord, scope: Exclude<ConsentScope, 'all'>): boolean {
  return consent.granted && (consent.scope === 'all' || consent.scope === scope);
}

export class ConsentDeniedError extends Error {
  readonly scope: string;

  constructor(scope: string) {
    super(`Consent denied for ${scope}; no data may be sent`);
    this.name = 'ConsentDeniedError';
    this.scope = scope;
  }
}

export function assertCanSend(consent: ConsentRecord, scope: Exclude<ConsentScope, 'all'>): void {
  if (!canSend(consent, scope)) throw new ConsentDeniedError(scope);
}
