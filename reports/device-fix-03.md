# Device fix 03 — top-right mic, unlimited clipboard, language modes, translate menu

Status: **IMPLEMENTED, compiled, signature-verified**. User request: mic button at the top-right of the keyboard that requests permission and turns speech into text; an unlimited clipboard button; a language-change option (Bangla→English, English→Bangla, Banglish); and a translate option (BN→EN, EN→BN).

## What changed

### 1. Top toolbar with mic pinned top-right
`res/layout/keyboard_view.xml` gained a `toolbar` row above the suggestion bar:
`Clip` · `Lang` · `Tr` · `[weight-1 spacer]` · `🎤 mic`. The spacer pushes the mic to the far right — the exact "উপর দিকের ডান দিকে" placement requested. All four buttons are wired in `BanglaVoiceIme.onCreateInputView()`; none are decorative. The old mic in the suggestion bar was removed to avoid two mics.

### 2. Mic → permission → record → text
`onMicTapped()` → voice-consent gate (default off) → **source-language menu** (বাংলা / English / বাংলিশ) → `VoicePermissionActivity` requests `RECORD_AUDIO` if needed → real `RecognizerIntent` (`bn-BD` / `en-US`) → transcript delivered by `PendingIntent` → preview with **Insert / Translate / Discard**. Banglish speech is recognized as roman text and converted offline by `Banglish.toBangla()`.

### 3. Unlimited clipboard
`ClipboardStore.kt` — new file-backed (`filesDir/clipboard_history.json`), **no item cap**, newest-first history. A real `ClipboardManager.OnPrimaryClipChangedListener` is registered in the IME `onCreate()` and removed in `onDestroy()`, so every copy while this keyboard is active is captured. The `Clip` button opens a panel with: live saved count, **Copy field** (writes the real system clipboard via `setPrimaryClip`), **Clear**, **back**, and up to 12 tappable recent clips (each commits its text to the focused field). If more than 12 exist, an honest `…+N more saved` note is shown — all entries remain stored.

### 4. Language / typing modes
`Lang` button (and the row-4 mode key) cycles three real modes:
- **bn** — Bengali script key matrix (`BanglaKeys.LETTERS/VOWELS/NUMBERS`).
- **en** — English QWERTY.
- **banglish** — English QWERTY keys; on space, the current romanized token is transliterated to Bengali offline by `Banglish.toBangla()` (bounded common-word dictionary; unknown tokens pass through unchanged — no fake coverage, no network).

### 5. Translate menu (BN↔EN)
`Tr` button (and the Translate action on a voice transcript) opens: **বাংলা → English** (mode C) / **English → বাংলা** (mode D) → `GeminiVoiceClient.translateText()` (text-only consent, no voice consent needed for typed text) → preview → Insert/Discard. Real failure states show with Retry. `GeminiVoiceClient` was refactored into `translate()` (voice+text consent, for speech transcripts) and `translateText()` (text consent only, for typed text), sharing one real `request()` implementation.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `gradle :app:compileDebugKotlin --no-daemon --console=plain` | `BUILD SUCCESSFUL in 50s` |
| 2 | `gradle assembleDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL in 29s` |
| 3 | `apksigner verify app-debug.apk` | signature PASS |
| 4 | DEX scan | `Banglish$toBangla`, `ClipboardStore$add/all/clear/removeAt` in `classes3.dex` |
| 5 | merged manifest | `versionCode="4"`, `versionName="1.1.0"` |
| 6 | `resources.arsc` | `toolbar`, `btnClipboard`, `btnLang`, `btnTranslate`, `btnMic` present |
| 7 | `npm test` | `ℹ tests 108` · `ℹ pass 108` · `ℹ fail 0` |

Two real compile errors were found and fixed during the build (not hidden): `android:allCaps` → `android:textAllCaps` in XML; swapped `BanglaKeys.rows()` argument order; and `setPrimaryClip()` used instead of a `val` property assignment.

## Honest limits
- **Not device-tested here** (no device/emulator). Verified at compile + DEX + resource + signature level.
- **No live Gemini call** executed (no API key on host): translation quality/latency unmeasured.
- Unlimited clipboard is bounded only by device storage; UI shows the latest 12 clips (all are saved).
- Banglish is a bounded offline dictionary, not a full phonetic engine.
- Clipboard auto-capture works when this IME is the active/default keyboard (Android API restriction).
