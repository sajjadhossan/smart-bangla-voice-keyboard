# ADR-004: API key configuration and security

- **Status:** Accepted
- **Context:** The brief requires real Gemini integration, no hardcoded keys, encrypted platform storage, and a documented personal-use limitation.
- **Decision:** Two supported modes:
  1. **Personal direct mode** — user enters a key in-app, stored in encrypted platform storage (Keychain / DPAPI / EncryptedSharedPreferences). Documented limitation: the key is recoverable from a binary the user controls.
  2. **Production proxy mode** — authenticated backend proxy holds the key; client uses a short-lived session token over HTTPS.
- **Consequences:**
  - ✅ No secrets in repo, logs, APK or installer.
  - ✅ `.env.example` ships; `.env` is gitignored.
  - ⚠️ Proxy mode requires backend deployment outside this repository's current environment.
