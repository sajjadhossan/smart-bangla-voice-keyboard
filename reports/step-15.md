# Step 15 report — shared voice service, duplicate guards, privacy join

Status: **PASS** (runnable on this device). No platform binary involved; this
is pure shared business logic proven by a counting-fake integration test. All
platforms (Android/Windows/macOS) call this same surface.

## Implemented
- `shared/service/idempotency.ts` — `IdempotencyGuard<T>`: caches only successful
  results by key, shares one in-flight action for concurrent callers, never
  caches failures (so retries can succeed), and exposes `forget`/`clear`.
- `shared/service/voice-history.ts` — `VoiceHistory`: in-memory only, per-entry
  `delete(id)` and full `clear()`, no disk/network/logging.
- `shared/service/voice-service.ts` — `VoiceService`: the single orchestration
  surface joining consent gate → `executeVoiceMode` → exactly-one `TextSink`
  insert → history. Re-checks `assertCanSend('voice')` before touching audio and
  the provider re-checks on every call. Failed inserts are never cached.
- `tests/integration/consent-egress.test.ts` — 10 integration tests using a
  `CountingTransport` and `RecordingSink` so egress and inserts are measured.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `node --experimental-strip-types --test tests/integration/consent-egress.test.ts` | `ℹ tests 10` · `ℹ pass 10` · `ℹ fail 0` |
| 2 | `npm test` (unit + integration) | `ℹ tests 108` · `ℹ pass 108` · `ℹ fail 0` · `ℹ duration_ms 2213.693437` |

## Invariants proven by tests
- `NO_CONSENT` ⇒ zero provider calls, zero inserts, zero history entries.
- `text`-only consent cannot send voice-derived audio (scope isolation).
- Consent + key ⇒ exactly one transcription call, exactly one insert, one history entry.
- Retry with the same idempotency key ⇒ zero new egress, zero duplicate insert.
- Concurrent callers with the same key ⇒ one shared action, one insert.
- Mode C ⇒ two distinct provider calls (transcribe then translate), both voice-gated.
- Revoking consent after a grant stops all further egress.
- A failed insert is not cached; a later retry succeeds.
- History `delete`/`clear` are real and never "un-insert" committed text.

## Deviations / limitations
- No real microphone, API key, or platform IME involved — no WER/CER or live
  egress claimed. The counting fake proves control flow, not provider accuracy.

## Next
Step 16a — core CI + coverage gate; Step 16b — guarded platform build jobs.
