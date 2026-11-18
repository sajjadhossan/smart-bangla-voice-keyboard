# macOS 12+ — InputMethodKit input method (source only)

**BUILD AND RUNTIME STATUS: UNVERIFIED ON THIS DEVICE.**
This host is Linux/Termux with no Xcode, no macOS SDK and no InputMethodKit.
Nothing here was compiled, installed or run. The CI job is
`workflow_dispatch`-only; no macOS build claim is made locally.

## What is implemented in source
- `SmartBanglaVoiceKeyboard/SmartBanglaInputController.swift` — real
  `IMKInputController` registered through `Info.plist`; offline candidate
  replacement via `IMKCandidates`; insertion through the active IMK client
  (no synthetic keystrokes).
- `SmartBanglaVoiceKeyboard/VoicePanel.swift` — floating, draggable,
  focus-preserving `NSPanel` with the 11 shared voice states and a
  **Insert / Discard** preview gate before any text is committed.
- `SmartBanglaVoiceKeyboard/SpeechCapture.swift` — `SFSpeechRecognizer` +
  `AVAudioEngine`; no engine, request or microphone tap is created unless the
  consent store says voice is allowed.
- `SmartBanglaVoiceKeyboard/ConsentStore.swift` — consent defaults to off;
  Gemini API key stored in the Keychain with
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, never in plaintext.
- `SmartBanglaVoiceKeyboard/VoiceState.swift` — all eleven states.
- `SmartBanglaVoiceKeyboard/Info.plist` — `InputMethodKit`, controller class,
  microphone and speech-recognition usage strings.
- `project.yml` — XcodeGen definition for a `.bundle` product.

## Build (macOS host only, not run here)
```sh
brew install xcodegen
xcodegen generate -s macos/project.yml -p macos
xcodebuild -project macos/SmartBanglaVoiceKeyboard.xcodeproj \
  -scheme SmartBanglaVoiceKeyboard -configuration Release \
  -derivedDataPath macos/build
```
Copy the built `.bundle` to `~/Library/Input Methods/`, then enable it in
System Settings → Keyboard → Input Sources.

## What is NOT verified
- No Swift compilation, no bundle install, no InputMethodKit activation.
- No real dictation, insertion in third-party apps, or menu-bar behavior.
- XcodeGen/`xcodebuild` invocation is a source-level assumption to be proven by
  the guarded CI job or a macOS developer.

Evidence belongs in `reports/step-14.md` and any GitHub Actions run result.
