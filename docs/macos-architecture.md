# macOS architecture — Smart Bangla Voice Keyboard (source only · UNVERIFIED)

No Swift code was compiled and no bundle was installed on this device (Linux/Termux, no Xcode).

- `SmartBanglaInputController.swift` — real `IMKInputController` registered via `Info.plist`; offline candidates through `IMKCandidates`; insertion via `client().insertText` (no synthetic keystrokes). `Ctrl+Shift+B` starts a consent-gated voice session.
- `VoicePanel.swift` — floating, draggable, non-activating `NSPanel` with all 11 voice states and an explicit Insert/Discard preview gate.
- `SpeechCapture.swift` — `SFSpeechRecognizer` + `AVAudioEngine`; no engine/tap/request created without consent.
- `ConsentStore.swift` — consent default off; Gemini key in Keychain (`WhenUnlockedThisDeviceOnly`).
- `project.yml` — XcodeGen bundle definition.

Build on a macOS host (not done here): `xcodegen generate -s macos/project.yml -p macos` then `xcodebuild ... CODE_SIGNING_ALLOWED=NO`; copy the `.bundle` to `~/Library/Input Methods/`. Guarded CI: `.github/workflows/macos-build.yml` (`workflow_dispatch`, `macos-14`).
