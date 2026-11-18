# ADR-001: Shared core language and runtime

- **Status:** Accepted
- **Context:** Flutter/Dart is the brief's suggested shared UI layer, but this development environment (Termux/Android) has no Flutter or Dart SDK. A shared layer is still required so Android, Windows and macOS use identical business logic.
- **Decision:** Implement the shared core in strict TypeScript, runnable directly on Node 22.6+ via native type stripping. Platform layers embed the compiled bundle through a thin native bridge or mirror the interfaces in Kotlin/C#/Swift.
- **Consequences:**
  - ✅ Fully testable on this device today; no vendor SDK needed.
  - ✅ One source of truth for layouts, transliteration, voice state machine and settings.
  - ⚠️ UI remains natively authored per platform — explicitly allowed by the brief ("Flutter shared UI where appropriate").
  - ⚠️ A native bridge is needed if a platform wants to execute the TS bundle in-process.
- **Alternatives rejected:** Dart/Flutter (SDK unavailable); pure Kotlin shared module (cannot serve Windows/macOS C#/Swift directly).
