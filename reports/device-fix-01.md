# Device fix 01 — installed APK had no launcher / setup screen

Status: **FIXED, rebuilt, signature-verified**. Reported by user after installing `v0.1.0-debug` on a real device: "installed but it does not open, stays hidden."

## Root cause (source-level, confirmed)
`android/app/src/main/AndroidManifest.xml` declared only:
- the `BanglaVoiceIme` service (correct IME), and
- `VoicePermissionActivity` with `android:exported="false"` and **no** intent-filter.

There was **no `MAIN`/`LAUNCHER` activity**, so the launcher showed no icon and there was no screen to open, enable the IME, review consent, or configure the API key. This was a real usability defect, not user error — although enabling the keyboard in system settings is required for any IME.

## Fix
- Added `MainActivity.kt` — a real launcher/setup activity (`MAIN` + `LAUNCHER`), with **only wired controls**:
  - **Enable keyboard in system settings** → `Settings.ACTION_INPUT_METHOD_SETTINGS`.
  - **Choose active keyboard** → `InputMethodManager.showInputMethodPicker()`.
  - Live status: IME enabled / voice consent / text consent / key present — read from platform APIs and `SecureStore`.
  - Voice + text consent toggles (default off) persisted through `SecureStore`.
  - API key: save (Keystore AES-GCM via `SecureStore`), show/hide, remove, and **Test connection**.
  - Test connection is a **real HTTPS GET** to `https://generativelanguage.googleapis.com/v1beta/models` with `x-goog-api-key`, on a background thread, mapping HTTP 200/400/401/403/429/503/IO to the documented 8-state vocabulary. It sends only the key after an explicit tap — never user text or audio. No fake success path.
- Manifest: added `INTERNET` permission (used only by that explicit action; offline typing is unchanged) and the launcher activity.
- Added string resources; bumped `versionCode 1 → 2`, `versionName 1.0.0 → 1.0.1` so the new APK upgrades the installed one.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `gradle :app:compileDebugKotlin --no-daemon --console=plain` | `BUILD SUCCESSFUL in 1m 44s` |
| 2 | `gradle assembleDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL in 24s` |
| 3 | `apksigner verify app/build/outputs/apk/debug/app-debug.apk` | signature PASS (CN=Android Debug) |
| 4 | merged manifest grep | `MainActivity`, `android.intent.action.MAIN`, `android.intent.category.LAUNCHER`, `INTERNET` present |
| 5 | `unzip -p app-debug.apk classes3.dex \| strings \| grep -i mainactivity` | `MainActivity$onCreate`, `...$refreshStatus` present |
| 6 | `npm test` | `ℹ tests 108` · `ℹ pass 108` · `ℹ fail 0` |

## Remaining / honest limits
- Still **not device-tested** here (no device/emulator). The fix is verified at compile + manifest + DEX + signature level; real-device confirmation belongs to the user.
- `Test connection` requires a real key and network; none was available here, so no live probe was executed locally.
- Old `v0.1.0-debug` release is **superseded** by `v0.1.1-debug`.

## Install steps for the user
Install the new APK over the old one (versionCode 2), open **Smart Bangla Voice Keyboard** from the app drawer, tap **Enable keyboard in system settings**, then **Choose active keyboard**.
