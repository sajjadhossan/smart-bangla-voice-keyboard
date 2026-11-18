# Troubleshooting — Smart Bangla Voice Keyboard

**Offline typing still works but AI features error.** Expected — AI needs a valid key, consent and network. Check connection state; a real error is shown, never a fake success. Offline typing never depends on Gemini.

**Connection shows `invalid_api_key` / `authentication_failed`.** Re-enter the key in API settings and use "Test connection" (a real GET `/models` probe). Remove then re-save if needed. See `docs/gemini-facts.md`.

**`not_configured` after restart.** The key is stored in the platform secure store; confirm it was saved and not removed, and that consent is still granted.

**Android APK build fails on this device.** Source `$HOME/android-env.sh`. The SDK `aapt2` is x86-64; the arm64 override at `~/.gradle/gradle.properties` is required (`docs/toolchain.md`). Invoke `apksigner` via `bash` (its shebang is broken here).

**WER/CER shows "no evaluated samples".** No real recorded corpus exists. Add real audio + reference transcripts under `tests/fixtures/voice/v1`; synthetic results are never fabricated.

**Windows/macOS install unclear.** Those builds are **UNVERIFIED** here; follow `docs/installation.md` on a real host or use the guarded `workflow_dispatch` CI jobs. No local build claim is made.

**Duplicate text inserted.** The shared `IdempotencyGuard` prevents this; if you see it, capture the exact idempotency key/state and report it — do not work around by disabling the guard.
