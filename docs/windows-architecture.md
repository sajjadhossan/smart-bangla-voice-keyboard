# Windows architecture — Smart Bangla Voice Keyboard (source only · UNVERIFIED)

No Windows binary was built, registered or run on this device. This document describes source-level intent, not a verified build.

- `windows/src/BanglaIme.h/.cpp` — `ITfTextInputProcessor` COM server; activation registers `GUID_TFCAT_TIP_KEYBOARD` so Windows lists it as a real keyboard. Per-user registration via `BanglaIme.rgs` (`regsvr32 /n /i:user`).
- `TextInsertion.cpp` — focus-preserving insertion via the focused `ITfDocumentMgr` → `ITfContext` → `ITfInsertAtSelection`; no `SendInput`, no focus theft, no clipboard.
- `VoicePopup.cpp` — draggable, topmost Win32 panel on its own UI thread with all 11 voice states; preview requires a second explicit action before insert.
- `GlobalHotkeys.cpp` — global shortcut with candidate fallback and real conflict detection; `WM_HOTKEY` forwarding must be wired at integration time.
- `TrayIcon.cpp` — per-user shell tray icon.
- `ConsentStore.cpp` — consent default off; API key DPAPI-sealed under `HKCU\Software\SmartBanglaVoiceKeyboard`.
- `VoiceCapture.cpp` — WinRT `SpeechRecognizer`, constructed only after the consent gate passes.

Build on a Windows host (not done here): `cmake -S windows -B windows/build -A x64 && cmake --build windows/build --config Release`. Guarded CI: `.github/workflows/windows-build.yml` (`workflow_dispatch`, `windows-2022`).
