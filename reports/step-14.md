# Step 14 report — macOS InputMethodKit, floating panel, Keychain, guarded CI

Status: **SOURCE COMPLETE · UNVERIFIED ON THIS DEVICE**. No Swift file was
compiled, no `.bundle` was produced, installed, or activated. This host is
Linux/Termux with no Xcode, macOS SDK, or InputMethodKit.

## Implemented (under `macos/`)
- `SmartBanglaVoiceKeyboard/SmartBanglaInputController.swift` — real
  `IMKInputController`; offline candidates via `IMKCandidates`; insertion through
  the active IMK client (`insertText`), never synthetic keystrokes.
  `Ctrl+Shift+B` starts a consent-gated voice session.
- `SmartBanglaVoiceKeyboard/VoicePanel.swift` — floating, draggable,
  non-activating `NSPanel`; shows all 11 shared voice states and requires an
  explicit **Insert / Discard** action before text is committed.
- `SmartBanglaVoiceKeyboard/SpeechCapture.swift` — `SFSpeechRecognizer` +
  `AVAudioEngine`; no engine, tap, request, or recognizer is created unless the
  consent store allows voice. Final/partial/error callbacks handled.
- `SmartBanglaVoiceKeyboard/ConsentStore.swift` — consent defaults to off;
  Gemini key stored in the Keychain with
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, never in plaintext/UserDefaults.
- `SmartBanglaVoiceKeyboard/VoiceState.swift` — all eleven states, one label each.
- `SmartBanglaVoiceKeyboard/Info.plist` — `InputMethodKit`, controller class,
  microphone + speech usage strings.
- `project.yml` — XcodeGen definition for a `.bundle` product.
- `macos/README.md` — build/install steps and explicit NOT-verified section.
- `.github/workflows/macos-build.yml` — `workflow_dispatch`-only `macos-14` build.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `python3 -c "import yaml,...; yaml.safe_load(open('.github/workflows/macos-build.yml')); print('YAML OK')"` | `YAML OK .github/workflows/macos-build.yml` |
| 2 | `npm test` | `ℹ tests 98` · `ℹ pass 98` · `ℹ fail 0` · `ℹ duration_ms 2311.310936` |
| 3 | `xcodebuild ...` | **NOT RUN** — no macOS host; deferred to guarded CI (`workflow_dispatch`) |

## Invariants expressed in source (not runtime-proven)
- Consent checked before engine/request/tap creation; denied ⇒ error state, zero capture.
- Preview → explicit Insert → `client().insertText`; no silent overwrite.
- API key only in Keychain; masked display surface elsewhere.
- All 11 voice states have distinct labels.

## Deviations / limitations
- **UNVERIFIED**: no Swift compile, no bundle install, no IMK activation.
- XcodeGen/`xcodebuild` command is a source-level assumption for the guarded job.
- WER/CER and third-party-app insertion cannot be measured here.

## Next
Step 15 — shared service orchestration + duplicate guards + privacy join tests (runnable now).
