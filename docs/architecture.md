# Architecture — Smart Bangla Voice Keyboard

## Guiding principle

One platform-neutral TypeScript core holds layouts, state, consent, transliteration, voice-mode planning, grammar/tone logic and orchestration. Each operating system supplies a **real** native input method that renders the UI and inserts text through its own framework. No visual-only keyboard, no synthetic keystrokes, no simulated AI.

```
platform IME (Android / Windows TSF / macOS IMK)
        │  renders keyboard + floating voice panel, captures consented audio
        ▼
shared/service/voice-service.ts   ← single orchestration surface
        │  consent gate → plan → provider → one-time insert → history
        ▼
shared/voice/voice-modes.ts       ← transcription/translation separation
        ▼
shared/gemini/provider.ts         ← ONLY network boundary; re-gates consent
        ▼
HttpTransport (injected fake in tests / real HTTPS in production)
```

## Layers

| Layer | Module | Responsibility |
|---|---|---|
| Core | `shared/core/` | immutable `Result`, domain types, revocable consent + `assertCanSend()` |
| Settings | `shared/settings/` | schema, `SecureStorage` interface, test-only memory impl |
| Keyboard | `shared/keyboard/` | Bangla/Unicode/QWERTY/number/symbol layouts, immutable keyboard state |
| Language | `shared/language_engine/`, `shared/transliteration/` | Unicode normalization, Banglish rules/dictionary, spelling |
| Speech | `shared/speech/`, `shared/metrics/` | consent-gated capture state machine, WER/CER/latency harness |
| Gemini | `shared/gemini/` | verified config, API-key lifecycle, 8-state connection, provider |
| Voice | `shared/voice/` | modes A–F, two-call translation, state callbacks |
| Writing | `shared/grammar/`, `shared/rewrite/`, `shared/features/` | correction, 15 tones, A–Q features |
| Service | `shared/service/` | `VoiceService`, `IdempotencyGuard`, `VoiceHistory` |

## Invariants

1. **Offline typing never imports/calls Gemini.** Enforced by `tests/unit/offline-boundary.test.ts`.
2. **No egress without consent.** `assertCanSend()` runs in `VoiceService` and in every provider capability.
3. **No duplicate insertion on retry.** `IdempotencyGuard` caches only successful results by key.
4. **Provider abstraction intact.** No model ID/key in UI; models live in `shared/gemini/config.ts`.
5. **≥80% coverage gate** before final delivery; no fabricated results.
6. **Honest platform status.** Windows/macOS are source-only and **UNVERIFIED** on this host.

## Platform integration points

- **Android** (`android/app/src/main/kotlin/...`): `BanglaVoiceIme : InputMethodService`, `BanglaKeys` view, `SecureStore` (Keystore AES-GCM), consent-gated voice preview. Real signed debug APK built with Gradle/AGP/Kotlin.
- **Windows** (`windows/src/`): `CBanglaIme : ITfTextInputProcessor` COM server, focus-preserving insertion via `ITfInsertAtSelection`, Win32 floating popup, tray, hotkeys with conflict detection, DPAPI store, WinRT `SpeechRecognizer`. **UNVERIFIED.**
- **macOS** (`macos/SmartBanglaVoiceKeyboard/`): `IMKInputController`, `IMKCandidates`, non-activating `NSPanel`, `SFSpeechRecognizer`, Keychain. **UNVERIFIED.**

## Verification reality

Buildable/testable here: shared core, tests, docs, CI YAML. Buildable after env setup: Android APK (proven). Cannot be built here: Windows TSF and macOS IMK binaries — source + docs + guarded CI only.
