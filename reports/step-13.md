# Step 13 report — Windows TSF, floating popup, tray, hotkeys

Status: **SOURCE COMPLETE · UNVERIFIED ON THIS DEVICE**. No Windows binary was
built, registered or run here. Do not interpret this as a passing Windows build.

## Implemented (under `windows/`)
- `src/BanglaIme.h/.cpp` — genuine `ITfTextInputProcessor` COM server; activation registers `GUID_TFCAT_TIP_KEYBOARD` so Windows exposes it as a keyboard.
- `src/TextInsertion.h/.cpp` — focus-preserving insertion through the focused `ITfDocumentMgr` → `ITfContext` → `ITfInsertAtSelection`; explicitly no `SendInput`/focus theft/clipboard.
- `src/VoicePopup.h/.cpp` — draggable, topmost floating Win32 panel on its own UI thread, with **all 11** shared voice states and a transcript preview requiring a second explicit action before insertion.
- `src/GlobalHotkeys.h/.cpp` — global shortcut with fallback candidates and real conflict detection.
- `src/TrayIcon.h/.cpp` — per-user tray icon that opens/toggles the panel.
- `src/ConsentStore.h/.cpp` — consent default off; API key DPAPI-encrypted under HKCU; no plaintext secrets.
- `src/VoiceCapture.h/.cpp` — WinRT `SpeechRecognizer` built only after the consent gate passes.
- `src/BanglaIme.rgs`, `resource.h`, `BanglaIme.rc`, `dllmain.cpp`, `CMakeLists.txt` — COM registration and build definition.
- `windows/README.md` — build/register steps and an explicit NOT-verified section.
- `.github/workflows/windows-build.yml` — `workflow_dispatch`-only `windows-2022` build job.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/windows-build.yml')); print('YAML OK')"` | `YAML OK` |
| 2 | `npm test` | `ℹ tests 98` · `ℹ pass 98` · `ℹ fail 0` · `ℹ duration_ms 2064.437395` |
| 3 | `actionlint .github/workflows/*.yml` | **NOT RUN** — actionlint is not installed on this device; deferred to Step 16a |

## Invariants expressed in source (not runtime-proven)
- Consent is checked before constructing the recognizer; a denied consent yields an empty transcript and zero capture.
- Insertion uses the current TSF context; no foreground-window change.
- Preview → second explicit action → insert; no silent overwrite.
- Hotkey conflicts are detected and recorded, not ignored.
- All 11 voice states have distinct labels in the floating panel.

## Deviations / limitations
- **UNVERIFIED**: no MSVC, Windows SDK or Windows host. The `find_package(cppwinrt REQUIRED)` assumption and COM registration need a real Windows runner.
- `GlobalHotkeys::OnHotkey` must be wired from the host's `WM_HOTKEY` message; that integration point is documented in `windows/README.md`.
- Windows audio/WER/CER cannot be measured here.

## Next
Step 14 — macOS InputMethodKit source + guarded CI, also UNVERIFIED on this device.
