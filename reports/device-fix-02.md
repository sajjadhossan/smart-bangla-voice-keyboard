# Device fix 02 — two-way voice translation (BN↔EN) via Gemini

Status: **IMPLEMENTED, compiled, signature-verified**. User request: "built-in mic — tap it, Bangla speech becomes English, English speech becomes Bengali; make the words nicer using the Gemini API."

## What was actually missing
`v0.1.1-debug` had a mic, but it only ran Android's own `RecognizerIntent` and displayed the raw transcript (`heard: …`). There was **no Gemini client in the APK**, no direction selection, no translation, no grammar/punctuation polish. The `.env`/API key could be saved in `SecureStore`, but nothing in Kotlin ever used it. The shared TypeScript Gemini provider existed only in the test/core layer — an APK cannot run Node TS.

## Fix
1. `GeminiVoiceClient.kt` — real Kotlin mirror of the shared translate contract:
   - `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent` with `x-goog-api-key`.
   - Re-checks **voice consent** and **text consent** before any request; no key ⇒ `not_configured`; empty input ⇒ `empty_input`. No fake success.
   - One prompt per direction: mode `D` (English→Bengali) and mode `C` (Bengali→English). "Translate into natural, correct [target], fix punctuation/grammar, sound professional, preserve names/dates/numbers/amounts, return only the translation."
   - Parses all `candidates[0].content.parts`, skips `thought` parts, joins real `text`; maps HTTP 400/401/403/429/503/IO to the documented state vocabulary.
   - Only the transcript is sent — never stored audio, never a log.
2. `BanglaVoiceIme.kt` — mic flow rebuilt:
   - Mic tap ⇒ voice-consent gate (default off) ⇒ **direction menu** (বাংলা→English / English→বাংলা).
   - Direction sets the recognizer's **source** language (`bn-BD` or `en-US`) via `VoicePermissionActivity`.
   - On transcript: text-consent gate (sending text to Gemini is separate egress) ⇒ translate on a background thread (`Handler(Looper.getMainLooper())` for UI) ⇒ **preview** the translated text ⇒ Insert / Discard.
   - Real provider failure states shown verbatim with **Insert original** / **Retry** / Discard. No silent insert.
3. Strings added for all new UI; strings carry the two-way labels.
4. `versionCode 2 → 3`, `versionName 1.0.1 → 1.0.2` so it upgrades the installed build.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `gradle :app:compileDebugKotlin --no-daemon --console=plain` | `BUILD SUCCESSFUL in 45s` |
| 2 | `gradle assembleDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL in 28s` |
| 3 | `apksigner verify app-debug.apk` | signature PASS (CN=Android Debug) |
| 4 | `unzip -p app-debug.apk classes3.dex \| strings \| grep GeminiVoiceClient` | `GeminiVoiceClient$translate…` present |
| 5 | `npm test` | `ℹ tests 108` · `ℹ pass 108` · `ℹ fail 0` |

## Honest limits
- **Not device-tested here** (no device/emulator). Verified at compile + DEX + signature level only.
- **No live Gemini call was executed** (no real API key available on the build host), so translation quality/latency is not measured here. The endpoint/model/prompt are the same as the shared core, but real output needs the user's key + device.
- Requires: mic permission granted, voice + text consents on, a valid Gemini API key, and network. Offline typing is unchanged.

## User steps
Install `v0.2.0-debug` over the old APK → open app → confirm voice + text consents and saved key → open a text field → tap **mic** → choose **বাংলা → English** or **English → বাংলা** → speak → review the translated preview → **Insert**.
