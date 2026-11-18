# Smart Bangla Voice Keyboard
### স্মার্ট বাংলা ভয়েস কীবোর্ড

**Type Naturally. Speak Clearly. Write Professionally.**

A real, system-wide multilingual keyboard and Gemini-powered AI writing platform for **Android**, **Windows 10/11** and **macOS**. This is not a mock keyboard: each platform uses its native input-method framework (Android `InputMethodService`, Windows TSF, macOS InputMethodKit). Offline typing never needs a network; AI features are opt-in and consent-gated.

> ⚠️ **Honest status:** shared core + Android IME are implemented and tested; a **real signed debug APK** is produced on this device. Windows and macOS are **source + docs + guarded CI only — UNVERIFIED** (no Windows/macOS host here). No WER/CER, live Gemini call, release APK, or device test is claimed. See the [status matrix](#status-matrix) and [`reports/final.md`](reports/final.md).

## Status matrix

| Area | Status | Notes |
|---|---|---|
| Repo scaffold, ADRs, secret hygiene | ✅ Implemented | Step 1 |
| Shared domain types + settings + consent | ✅ Implemented | Step 2 |
| Offline Bangla/English layouts + keyboard state | ✅ Implemented | Step 3 |
| Offline Banglish transliteration + dictionary | ✅ Implemented | Step 4 |
| Voice corpus harness + WER/CER/latency | 🔶 Harness only | Step 4b — no real corpus, metrics unavailable |
| Gemini provider + real connectivity check | ✅ Implemented | Step 5 — verified models/endpoint, injected fake transport in tests |
| Voice capture (consent-gated, 11 states) | ✅ Implemented | Step 6 |
| Voice modes A–F (transcription/translation split) | ✅ Implemented | Step 7 |
| Grammar engine + diff + fact guard | ✅ Implemented | Step 8 |
| 15 tones + rewrite actions + accept/reject/undo | ✅ Implemented | Step 9 |
| AI special features A–Q | 🔶 Implemented / platform-required | Step 10 — clipboard needs native bridge |
| Android `InputMethodService` + voice UI | ✅ Implemented | Steps 11–12 |
| Android launcher/setup screen | ✅ Implemented | device fix 01 — enable IME, consent, API key |
| Two-way voice translation (BN↔EN) via Gemini | ✅ Implemented | device fix 02 — mic → direction → translate |
| Android debug APK + signing gate | ✅ Buildable here | Real signed APK; release gated on keystore env secrets |
| Windows TSF + floating popup + tray + hotkeys | 🔶 Source only · **UNVERIFIED** | Step 13 — no Windows host |
| macOS InputMethodKit + panel + Keychain | 🔶 Source only · **UNVERIFIED** | Step 14 — no Xcode/macOS |
| Shared orchestration + idempotency + history | ✅ Implemented | Step 15 |
| Tests + CI + 80% coverage gate | ✅ Implemented | Step 16a — 108 tests, 97/86/93% coverage |
| Platform build jobs (guarded) | 🔶 CI only · **UNVERIFIED** | Step 16b — `workflow_dispatch` runners |
| Docs + final report | ✅ Implemented | Step 17 |

Legend: ✅ implemented & tested here · 🔶 partial / source-only / unverified · ⬜ planned.

**Test result:** `npm test` → **108 tests, 108 pass, 0 fail**. Coverage gate → **97.14% lines · 85.80% branches · 92.76% functions** (≥80% on all axes). Per-step evidence: [`reports/`](reports/).

## Features

**Offline (no network):** Bangla/English typing, Unicode input, four layouts, Banglish transliteration, local dictionaries, spelling suggestions, numbers/symbols, themes, manual language switch, local settings — all in `shared/`.

**Online (Gemini, consent-gated):** voice typing in Bangla/English/Banglish, auto language detection, speech-to-text, two-way voice translation, grammar/spelling/punctuation correction, professional writing, 15 tones, rewrite, summarize, reply assistant, context suggestions, sentence improvement, advanced translation.

**Voice modes:** A Bangla→Bangla · B English→English · C Bangla→English · D English→Bangla · E Banglish→Bangla · F mixed→mixed. Modes A/B/E/F never translate; C/D make two separate calls.

**AI specials (A–Q):** summarizer, expander, reply, vocabulary, language detector, formatter, templates, context suggestions, next word, smart spelling, custom dictionary/corrections, clipboard, voice history, translation history, undo/redo, original-vs-corrected compare. Full status in [`docs/offline-online-matrix.md`](docs/offline-online-matrix.md).

## Architecture

```
shared/     platform-neutral core — layouts, state, transliteration, consent,
            Gemini provider, voice modes, grammar, tone/rewrite, orchestration
android/    real InputMethodService + in-keyboard voice UI + Keystore storage
windows/    real TSF COM server + Win32 floating popup + tray + DPAPI store
macos/      real IMKInputController + NSPanel + Keychain store
tests/      unit + integration (counting fake transport, no real egress)
docs/       architecture, ADRs, privacy, device matrix, Gemini facts
reports/    step-by-step evidence + final report
.github/    core CI (push/PR) + guarded platform build jobs (manual)
```

One shared business-logic surface (`shared/service/voice-service.ts`) is called by every platform. Provider abstraction means no model ID or key lives in UI code.

## Privacy & security

- **Consent before upload.** `assertCanSend()` runs before every Gemini/audio call; default is `NO_CONSENT`; scopes `voice`/`text`/`all`, revocable.
- **Zero egress without consent** — proven by [`tests/integration/consent-egress.test.ts`](tests/integration/consent-egress.test.ts).
- **Encrypted storage only:** Android Keystore/EncryptedSharedPreferences, Windows DPAPI, macOS Keychain. No plaintext key; `.env.example` has placeholders only.
- **HTTPS only** to `generativelanguage.googleapis.com`; no optional proxy by default. No text/audio/key in logs or reports.
- No silent recording — a mic tap/engine is created only inside an active, consented voice session.
- See [`docs/privacy-policy.md`](docs/privacy-policy.md).

## Gemini setup (optional, for AI features)

Offline typing works with **no key**. To enable AI: obtain a key from Google AI Studio, enter it in the app's API settings (show/hide, save, test connection, replace/remove are all supported), and grant the relevant consent. The connection state is derived from a real request — see [`docs/gemini-facts.md`](docs/gemini-facts.md) and ADR-002/ADR-004. Never commit a real key.

## Build & install

**Shared core (this device):**
```bash
npm test
npm run test:coverage
npm run test:wer -- --fixtures tests/fixtures/voice/v1   # reports "no evaluated samples" until a real corpus is added
```

**Android debug APK (this device):** see [`docs/toolchain.md`](docs/toolchain.md).
```bash
. "$HOME/android-env.sh"
cd android && gradle assembleDebug --no-daemon --console=plain
# android/app/build/outputs/apk/debug/app-debug.apk  (apksigner verified)
```
Release APK requires `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` via `scripts/build-android-release.sh`; never commit the keystore.

**Windows / macOS:** source + build steps in [`windows/README.md`](windows/README.md) and [`macos/README.md`](macos/README.md). Both are **UNVERIFIED** here; use the manual `workflow_dispatch` CI jobs on a real runner.

## Troubleshooting

- **No suggestions / AI errors:** offline typing still works; check consent and connection state. A real error is shown, never a fake success.
- **APK build fails here:** source `$HOME/android-env.sh` and confirm the arm64 `aapt2` override in `docs/toolchain.md`.
- **WER/CER shows no samples:** add real recorded audio + reference transcripts to `tests/fixtures/voice/v1`; synthetic results are never fabricated.

## Contributing & license

See [`CONTRIBUTING.md`](CONTRIBUTING.md). MIT — see [`LICENSE`](LICENSE).
