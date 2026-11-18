# Floating voice popup behavior

The floating panel is real in each native framework (Win32 window, macOS `NSPanel`, Android in-keyboard voice view). It mirrors the 11 shared voice states:

`IDLE → LISTENING → PROCESSING → TRANSCRIBING → CORRECTING → TRANSLATING → RESULT_READY → INSERTING → COMPLETED`, with `ERROR` and `CANCELLED` as exit branches.

Rules:
- Draggable, always-on-top, focus-preserving — accepting text does not steal focus from the current text field.
- A transcript is shown as a **preview**; text is inserted only after an explicit second action (Insert/tap). `Discard`/`Esc` cancels with no insert.
- Each state has a distinct label in all three platforms (verified in source).
- Consent is checked before capture: denied ⇒ `ERROR` state, no recognizer/engine, no egress.
- Insertion is guarded by an idempotency key so a retry never double-inserts.

Android: in-keyboard voice panel. Windows: `windows/src/VoicePopup.cpp`. macOS: `macos/SmartBanglaVoiceKeyboard/VoicePanel.swift`. The shared state contract is `shared/core/types.ts` / `shared/speech/voice-state.ts`.

Runtime behavior on Windows/macOS is **UNVERIFIED** here (no host); these are source-level guarantees.
