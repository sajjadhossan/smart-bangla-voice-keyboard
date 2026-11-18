# Windows 10/11 — TSF input method (source only)

**BUILD AND RUNTIME STATUS: UNVERIFIED ON THIS DEVICE.**
This repository was authored on a Termux/Linux host with no Windows SDK, MSVC,
or Windows host. No Windows binary has been built, registered, or run here. The
CI job is `workflow_dispatch`-only, so nothing is claimed until a real
`windows-2022` runner executes it.

## What is implemented in source
- `src/BanglaIme.h/.cpp` — `ITfTextInputProcessor` COM server. Activation
  registers the CLSID under `GUID_TFCAT_TIP_KEYBOARD` via `ITfCategoryMgr`,
  so Windows lists it as a real keyboard, not a popup app.
- `src/TextInsertion.h/.cpp` — focus-preserving insertion into the current
  `ITfDocumentMgr` / `ITfContext` using `ITfInsertAtSelection::InsertTextAtSelection`.
  No `SendInput`, no focus stealing, no clipboard side effects.
- `src/VoicePopup.h/.cpp` — draggable, always-on-top floating Win32 panel with
  its own UI thread and **all eleven** shared voice states (`IDLE` …
  `CANCELLED`). A transcript is shown as a preview; a second explicit action
  is required before insertion.
- `src/GlobalHotkeys.h/.cpp` — global shortcut registration with real conflict
  detection: candidate keys are tried in order and the first registration that
  succeeds wins; conflicts are recorded rather than silently ignored.
- `src/TrayIcon.h/.cpp` — per-user shell tray icon that toggles the panel.
- `src/ConsentStore.h/.cpp` — consent defaults to **off**; API key is sealed
  with DPAPI under `HKCU\Software\SmartBanglaVoiceKeyboard` (never plaintext).
- `src/VoiceCapture.h/.cpp` — WinRT `SpeechRecognizer`, constructed only after
  the consent gate passes. No consent ⇒ empty result, no recognizer, no mic.
- `src/BanglaIme.rgs` / `resource.h` / `BanglaIme.rc` — COM registration script.

## Build (Windows host only, not run here)
```powershell
cmake -S windows -B windows/build -A x64
cmake --build windows/build --config Release
regsvr32 /n /i:user windows\build\Release\SmartBanglaIme.dll
```
Then: Settings → Time & language → Language & region → Keyboard → Add a
language / keyboard → Smart Bangla Voice Keyboard.

## What is NOT verified
- No DLL was compiled, registered, or loaded.
- No keystroke insertion, tray behavior, hotkey conflict, or mic capture was
  exercised in a real Windows session.
- The C++/WinRT `find_package(cppwinrt)` link is a source-level assumption
  that must be confirmed by the guarded CI job or a Windows developer.
- `WM_HOTKEY` forwarding from the TSF host into `GlobalHotkeys::OnHotkey` must
  be confirmed at integration time.

Evidence belongs in `reports/step-13.md` and any GitHub Actions run result —
not in this README.
