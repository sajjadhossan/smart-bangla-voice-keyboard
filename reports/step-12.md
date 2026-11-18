# Step 12 report — Android voice, APK, signing gate

Status: **PASS for build/signing-gate evidence** · **DEVICE MATRIX UNVERIFIED**

## Implemented
- Voice flow completed in Step 11 and hardened here:
  - `VoicePermissionActivity` requests `RECORD_AUDIO` at runtime only after the encrypted consent gate is accepted by an explicit `Enable` tap (`SecureStore.voiceConsent`, default `false`).
  - `RecognizerIntent` result returns through a `PendingIntent` broadcast to `BanglaVoiceIme.voiceReceiver`; heard text is shown as an in-keyboard preview with `Insert` / `Discard`. Nothing is inserted without `Insert`.
  - `bn-BD` / `en-US` recognition locale follows the current keyboard language.
- `android/app/build.gradle` — release signing config reads **only** from four environment variables. Without them the release build has no signing config; nothing is committed.
- `scripts/build-android-release.sh` — POSIX `sh` guard that refuses to run when any signing secret is missing, verifies the produced APK with `apksigner`, and never writes secrets to disk.
- `docs/android-device-matrix.md` — 16 explicit third-party-app / consent / offline scenarios, all honestly marked **UNVERIFIED** with manual steps and privacy evidence to collect.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `./scripts/build-android-release.sh` (no secrets) | `BLOCKED: release signing secrets are missing: ANDROID_KEYSTORE_FILE ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD` · `exit=2` |
| 2 | `. "$HOME/android-env.sh" && gradle assembleDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL in 23s` |
| 3 | `bash "$HOME/android-sdk/build-tools/35.0.0/apksigner" verify app/build/outputs/apk/debug/app-debug.apk` | exit 0 — `DEBUG APK VERIFIED` |

## Invariants proven
- Runtime microphone permission is not requested before consent.
- Speech results are previewed and require an explicit Insert.
- Offline typing helpers work without network (code path contains no network call).
- Release APK cannot be produced accidentally: the guard fails closed with a clear message.
- Debug APK is genuinely signed and verifies with `apksigner`.

## Deviations / limitations
- **No device/emulator**: D01–D16 are all UNVERIFIED. No claim is made about real mic accuracy, WER, cursor behavior in third-party apps, or landscape rendering on hardware.
- **Release APK blocked**: no keystore secrets supplied; only the debug APK exists.
- WER/CER/latency metrics remain unavailable (no recorded corpus) — see `scripts/test-wer.ts` and `reports/step-04b.md`.

## Next
Step 13 — Windows TSF source + popup + tray + guarded CI. Build and runtime remain UNVERIFIED on this device.
