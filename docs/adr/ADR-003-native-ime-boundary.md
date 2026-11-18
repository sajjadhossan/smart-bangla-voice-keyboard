# ADR-003: Native IME boundary

- **Status:** Accepted
- **Context:** The brief forbids replacing system-wide keyboards with simulated UI. No Windows or macOS toolchain exists on this device.
- **Decision:** Android uses a real `InputMethodService`, Windows uses Text Services Framework, macOS uses InputMethodKit. Shared code supplies layouts/state; native code owns focus, insertion and lifecycle.
- **Consequences:**
  - ✅ Genuine system-wide integration is preserved.
  - ⚠️ Windows/macOS binaries cannot be compiled or verified here — source and CI definitions only, status reported honestly as unverified.
  - ⚠️ Android source is writable but APK build is blocked until Android SDK is provisioned.
