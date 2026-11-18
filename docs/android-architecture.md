# Android architecture — Smart Bangla Voice Keyboard

Real system-wide IME built and signed on this device (debug); release signing gated on env secrets.

- `MainActivity` — real `MAIN`/`LAUNCHER` setup screen (fix for "app stays hidden"): enable keyboard in system settings, choose active keyboard, consent toggles, and encrypted API-key settings with a real HTTPS `/models` connection test. No decorative buttons.
- `BanglaVoiceIme : InputMethodService` — the input method declared in `AndroidManifest.xml`; rendered by `BanglaKeys` with Bangla/Unicode/QWERTY/numbers/symbols layouts and a suggestion bar (word / transliteration / AI / mic / language). The mic runs a two-way, consent-gated flow: voice consent → direction (BN→EN / EN→BN) → system recognizer for the source language → text consent → `GeminiVoiceClient` translation + polish → preview → Insert/Discard.
- `GeminiVoiceClient` — Kotlin mirror of the shared translate contract: `POST .../models/gemini-3.6-flash:generateContent` with `x-goog-api-key`, direction-specific prompts, real response parsing, and documented failure states. Only the transcript is sent; both consents re-checked before egress.
- `SecureStore` — Keystore-backed AES-GCM / EncryptedSharedPreferences; no plaintext key.
- Voice panel — consent-gated result preview; text is inserted through the current input connection, not a fake UI.
- Offline path — layouts, transliteration and dictionary run with no network.
- Gemini path — opt-in, consent-gated, through the shared provider; errors shown, typing keeps working.

Build: `. "$HOME/android-env.sh"` then `gradle assembleDebug --no-daemon --console=plain`. The arm64 `aapt2` override is documented in `docs/toolchain.md`. Manual device scenarios D01–D16 are in `docs/android-device-matrix.md` and are **UNVERIFIED** (no device/emulator here).

Release: `scripts/build-android-release.sh` fails closed unless `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` are supplied.
