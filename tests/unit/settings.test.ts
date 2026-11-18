import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_CONSENT, grantConsent, revokeConsent, canSend } from '../../shared/core/consent.ts';
import { DEFAULT_SETTINGS, updateSettings, validateProxyUrl } from '../../shared/settings/schema.ts';
import { SettingsStore } from '../../shared/settings/store.ts';

test('default settings start with no consent and safe defaults', () => {
  assert.equal(DEFAULT_SETTINGS.consent, NO_CONSENT);
  assert.equal(DEFAULT_SETTINGS.toneMode, 'normal');
  assert.equal(DEFAULT_SETTINGS.grammarOnVoice, 'exact');
  assert.equal(DEFAULT_SETTINGS.historyEnabled, false);
  assert.equal(DEFAULT_SETTINGS.connectivityMode, 'auto');
});

test('updateSettings returns a new frozen object and never mutates input', () => {
  const next = updateSettings(DEFAULT_SETTINGS, { theme: 'dark' });
  assert.notEqual(next, DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.theme, 'system');
  assert.equal(next.theme, 'dark');
  assert.equal(Object.isFrozen(next), true);
});

test('store notifies subscribers exactly once per real change', () => {
  const store = new SettingsStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.patch({ theme: 'dark' });
  store.patch({ theme: 'dark' });
  unsubscribe();
  store.patch({ theme: 'light' });
  assert.equal(calls, 1);
});

test('proxy URL must be HTTPS', () => {
  assert.equal(validateProxyUrl('http://example.com'), 'Proxy URL must use HTTPS');
  assert.equal(validateProxyUrl('https://example.com'), null);
  assert.throws(() => new SettingsStore().patch({ proxyUrl: 'http://x' }), /HTTPS/);
});

test('consent is revocable and scoped', () => {
  const voice = grantConsent('voice', 1000);
  assert.equal(canSend(voice, 'voice'), true);
  assert.equal(canSend(voice, 'text'), false);
  const all = grantConsent('all', 2000);
  assert.equal(canSend(all, 'text'), true);
  assert.equal(canSend(revokeConsent(), 'voice'), false);
});
