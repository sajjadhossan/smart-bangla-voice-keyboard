# Privacy policy — Smart Bangla Voice Keyboard

## Data that never leaves the device

Bangla/English typing, Unicode input, layouts, transliteration, local dictionaries, spelling suggestions, themes and settings are fully offline. No network permission is needed for these features.

## Data that can leave the device (only with consent)

Gemini-powered features (voice typing, translation, grammar correction, rewriting, summarization, reply/context suggestions) send the minimum relevant text or the consented audio clip to Google's `generativelanguage.googleapis.com` over HTTPS.

- **Consent is required and revocable.** Default `NO_CONSENT`; scopes `voice`, `text`, `all`; `assertCanSend()` gates every request. Tests prove zero requests without consent.
- **No silent recording.** The microphone tap/engine is created only after an active consented voice session starts.
- **No audio/text/key logging.** Nothing in source, logs, reports, or CI contains user content or secrets.
- **Captioning/transcription config:** exact mode uses `VERBATIM`; other modes use `SMART`. Translation is a separate, independently consent-gated call.

## Storage

- Gemini API key: Android Keystore / EncryptedSharedPreferences, Windows DPAPI under `HKCU`, macOS Keychain (`WhenUnlockedThisDeviceOnly`). Never plaintext, never in `UserDefaults`/repo.
- Voice history: in-memory only in the shared core; per-entry delete and full clear are supported. No disk persistence in the shared layer. `.env.example` contains placeholders only.

## Optional proxy

An authenticated proxy can be configured for enterprise deployments; it is HTTPS-only and off by default. No telemetry or analytics is collected by this project.

## Your controls

In API settings you can show/hide, save, validate, test, replace and remove the key. Revoking consent immediately stops all further egress. Removing the key returns the connection to `not_configured`.

## Limits of this statement

No live Gemini request, real microphone capture, or platform runtime was exercised on the build device; this policy describes the implemented contract and its tests, not an audited production deployment.
