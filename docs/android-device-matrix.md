# Android device test matrix (Step 12)

**Status: UNVERIFIED ON THIS DEVICE.** There is no physical Android device or
emulator in this environment. The debug APK was built and signature-verified
locally, but none of the rows below were executed. Do not read "built" as
"tested on a device".

Artifact used for manual verification:
`android/app/build/outputs/apk/debug/app-debug.apk` (debug-signed, verified).

## Install / enable (one-time)
1. `adb install -r app/build/outputs/apk/debug/app-debug.apk`
2. Android Settings → System → Languages & input → On-screen keyboard → Manage keyboards → enable **Smart Bangla Voice Keyboard (Bangla)**.
3. Switch the active keyboard to it in any text field.
4. Confirm the IME appears as a system input method (not just a launcher Activity).

Each row below must be marked PASS/FAIL by a human with a device. Default is **UNVERIFIED**.

| ID | Target app / context | Scenario | Expected | Status |
|---|---|---|---|---|
| D01 | SMS / messaging | Type `ami bhalo achi` with network off | Suggestions show `আমি / ভালো / আছি`; tapping inserts Bangla | UNVERIFIED |
| D02 | Messaging | Backspace over a multi-codepoint Bangla glyph | Exactly one user-perceived character removed | UNVERIFIED |
| D03 | Messaging | Move cursor mid-word, type a key | Text inserted at cursor, not appended | UNVERIFIED |
| D04 | Messaging | Press the keyboard Enter key with `imeOptions=send` | Editor action fires (send), not a newline | UNVERIFIED |
| D05 | Chrome address bar / search | Type Bangla; switch BN→EN; switch back | Both scripts insert correctly; layers reset | UNVERIFIED |
| D06 | Gmail compose | Long body, scroll, insert at end | No dropped keystrokes; suggestion bar updates | UNVERIFIED |
| D07 | Google Keep | Portrait → rotate → landscape | Keyboard view re-inflates; keys fit; no clipping | UNVERIFIED |
| D08 | Any field | Tap mic **without** consent | Consent gate appears (`Enable` / `Not now`); NO recognizer or permission dialog yet | UNVERIFIED |
| D09 | Any field | Tap `Not now`, then tap mic again | Gate reappears; no audio capture occurred | UNVERIFIED |
| D10 | Any field | Tap `Enable` | Runtime `RECORD_AUDIO` prompt appears only now; system recognizer opens | UNVERIFIED |
| D11 | Any field | Dictate a Bengali sentence, then tap `Discard` | Heard text shown in preview; nothing inserted | UNVERIFIED |
| D12 | Any field | Dictate, then tap `Insert` | Heard text inserted once, at cursor | UNVERIFIED |
| D13 | Any field | Airplane mode on, type + use Format text / Make shorter | Offline helpers still work; no Gemini/network needed | UNVERIFIED |
| D14 | Any field | Format text on a sentence | Original→candidate preview shown; text unchanged until `Apply` | UNVERIFIED |
| D15 | Any field | Tap `Cancel` in preview | Original text remains byte-identical | UNVERIFIED |
| D16 | Settings → keyboard | Revoke/clear consent via app data | Next mic tap shows gate again | UNVERIFIED |

## Consent / privacy evidence to record on-device
- Before D08–D10: with a network monitor (e.g. `adb shell dumpsys connectivity` or a packet capture), confirm zero outgoing requests from the IME.
- After D10: confirm `RECORD_AUDIO` is granted only following the explicit `Enable` tap.
- Confirm the API key is never displayed in the keyboard UI or adb logs (`adb logcat | grep -i api`).

## Release signing (blocked, not skipped)
`scripts/build-android-release.sh` exits with code 2 and names the four missing
environment variables when run without secrets:

```
BLOCKED: release signing secrets are missing: ANDROID_KEYSTORE_FILE ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD
```

A release APK will be built and `apksigner`-verified only when
`ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD` are supplied externally. No keystore material exists in
this repository.
