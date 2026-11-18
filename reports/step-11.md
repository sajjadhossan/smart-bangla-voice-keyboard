# Step 11 report — Android native IME

Status: **PASS** — real `InputMethodService`, real debug APK, signature verified. Release signing still gated on `ANDROID_KEYSTORE_*`.

## Implemented (all under `android/app/src/main/`)
- `AndroidManifest.xml` — real system IME service with `BIND_INPUT_METHOD`, `android.view.InputMethod` intent filter and `@xml/method`; `RECORD_AUDIO` declared (only requested after consent); transparent `VoicePermissionActivity` broker.
- `res/xml/method.xml`, `res/layout/keyboard_view.xml`, `res/values/strings.xml`, `res/values/styles.xml` — declarative keyboard shell: horizontal suggestion bar + four key rows.
- `kotlin/.../BanglaKeys.kt` — native mirror of the shared layout contract: Bangla letters / vowels / numbers layers, English layer, and real offline helpers (`transliterate`, word suggestions, `format`, `shorter`). No network.
- `kotlin/.../SecureStore.kt` — real encrypted storage using Android Keystore AES-256-GCM (platform APIs only, no new Maven dependency). API key sealed, non-exportable key; **consent defaults to `false`**.
- `kotlin/.../BanglaVoiceIme.kt` — the actual IME:
  - key rows, shift, BN↔EN toggle, layer cycling, space, backspace (selection-aware), editor-action-aware Enter;
  - suggestion bar: up to 3 offline word/transliteration candidates + AI + mic + language toggle;
  - word suggestions derived from the current token via `currentInputConnection.getExtractedText()`;
  - AI actions `Format text` / `Make shorter` compute a deterministic candidate and show an **original→candidate preview** with Apply / Cancel — never silently overwrite;
  - mic: consent gate first (Enable / Not now). Enabling persists consent, then a real `RecognizerIntent` is launched with a `PendingIntent` result callback; heard text is shown with **Insert / Discard**, applied only on Insert.
- `kotlin/.../VoicePermissionActivity.kt` — transparent Activity that requests `RECORD_AUDIO` at runtime (an IME Service cannot do this itself) only after the consent gate was accepted, then launches the recognizer.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `. "$HOME/android-env.sh" && gradle :app:compileDebugKotlin --no-daemon --console=plain` | `BUILD SUCCESSFUL in 36s` |
| 2 | `. "$HOME/android-env.sh" && gradle assembleDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL in 39s` |
| 3 | `bash "$HOME/android-sdk/build-tools/35.0.0/apksigner" verify app/build/outputs/apk/debug/app-debug.apk` | exit 0 — `APK VERIFIED` |
| 4 | `npm test` | `ℹ tests 98` · `ℹ pass 98` · `ℹ fail 0` · `ℹ duration_ms 2341.656145` |

Artifact: `android/app/build/outputs/apk/debug/app-debug.apk` (816K, debug-signed `C=US, O=Android, CN=Android Debug`).

## Invariants proven
- Compiles against SDK 35 / AGP 8.7.3 / Kotlin 2.0.21 with real Android framework classes; no placeholder Kotlin stubs.
- Manifest declares a genuine system IME (not an Activity pretending to be a keyboard).
- Offline helpers are local-only; typing/suggestions do not require Gemini or network.
- Voice consent is encrypted and defaults to denied; mic tap shows an explicit gate before any recognizer launch or permission request.
- Recognizer results and AI corrections are previewed; insertion requires an explicit tap.
- JS core remains green (98/98) after the Step 9–10 provider changes.

## Deviations / limitations
- No physical device/emulator here: on-device behavior in third-party apps (messaging/browser/email/notes), portrait/landscape rendering and actual mic capture are **NOT verified locally**. That evidence belongs to Step 12's device matrix.
- Only debug signing is proven. Release APK requires `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` supplied as environment secrets; nothing is stored in the repo.
- Gemini HTTP calls are not made from the APK in this step; the consent-gated provider lives in the shared TypeScript core and platform wiring is a later integration concern. The APK's AI buttons use real deterministic offline text helpers, and this report does not claim online Gemini from the APK.

## Next
Step 12 — Android voice panel, third-party app test matrix (device-dependent), debug APK proof, release signing gate.
