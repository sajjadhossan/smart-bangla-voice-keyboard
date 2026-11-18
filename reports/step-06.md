# Step 6 report — Voice capture (consent-gated, provider-agnostic, VAD)

Status: **PASS** (implementation + deterministic tests) · **NO REAL MICROPHONE** on this device (fake `AudioCaptureDevice` injected in tests)

## Implemented
- `shared/speech/voice-state.ts` — authoritative 11-state reducer (`IDLE`, `LISTENING`, `PROCESSING`, `TRANSCRIBING`, `CORRECTING`, `TRANSLATING`, `RESULT_READY`, `INSERTING`, `COMPLETED`, `ERROR`, `CANCELLED`). Invalid transitions are no-ops. `IDLE` also accepts `ERROR`/`CANCEL` from failed permission checks.
- `shared/speech/capture.ts` — provider-agnostic `AudioCaptureDevice` interface (no Gemini/fetch import), `AudioFormat` negotiation, VAD (`updateVad`) with threshold/hangover/min-speech, `classifyLevel` (silence/ok/loud/clipping), and `VoiceCaptureController`.
- **Consent gate before capture:** `start(consent)` calls `assertCanSend(consent,'voice')` and `requestPermission()` before the device ever starts. `NO_CONSENT` ⇒ zero permission requests, zero device starts, state stays `IDLE`.
- No upload path in this module (asserted by a source-scan test). Audio bytes are returned to the caller only after an explicit stop.

## Verify commands & exact output
1. `node --experimental-strip-types --test tests/unit/voice-capture.test.ts` → `ℹ tests 9` · `ℹ pass 9` · `ℹ fail 0`
2. `npm test` → `ℹ tests 53` · `ℹ pass 53` · `ℹ fail 0` · `ℹ duration_ms 1253.562135`

## Test coverage
- all 11 states reachable via valid transitions (asserted set equals `ALL_VOICE_STATES`)
- invalid transition is a no-op
- VAD speech start, end-of-speech after hangover, too-short-burst rejection, hangover renewal on new speech
- level monitor: silence / ok / loud / clipping
- `NO_CONSENT` ⇒ no permission request, no device start, stays `IDLE`
- granted consent ⇒ `start→LISTENING`, VAD events, `stop→PROCESSING` with real bytes
- permission denial ⇒ `ERROR`; `cancel→CANCELLED`; `reset→IDLE` + device cleanup
- capture module has no upload/HTTP import

## Invariants
- ✅ Offline typing never imports Gemini (capture is provider-agnostic; no upload path).
- ✅ No egress without consent (`assertCanSend('voice')` before capture).
- ✅ No secrets, no logging, no fabricated results.

## Deviations / limits
- No physical mic on this device; all capture tests use an injected `AudioCaptureDevice`. Real mic capture is exercised in the platform layer (Steps 12/13/14), not here.
- VAD thresholds/hangover are configurable constants; they are not tuned against a real corpus yet. Tuning requires recorded audio from Step 4b (corpus still empty).

## Step 5 review findings folded in (this session)
A code review returned 1 HIGH / 4 MEDIUM / 4 LOW on Step 5; all were addressed before Step 7:
- **HIGH** storage I/O exceptions now return `err('storage_unavailable')` instead of rejecting — wrapped in `provider.run`, `testConnection`, and all `api-key.ts` `Result` APIs.
- **MEDIUM** retry loop now has real coverage: 429→200 success (2 sends), exhausted 5xx and transport errors (3 sends, real states); `maxRetries` clamped ≥0; synthetic status-0 fallback removed.
- **MEDIUM** exact/verbatim now uses the verified `generationConfig.audioTranscriptionConfig.mode = "VERBATIM"` (not a prompt). `docs/gemini-facts.md` updated with the two documented API surfaces and the exact REST body.
- **MEDIUM** typed-text translation can no longer ride voice-only consent: `TranslateInput.source: 'voice'|'text'` chooses the consent scope.
- **LOW** response parser scans all candidates, skips `thought` parts, rejects non-string `text` (and reads Interactions `output_text` for forward compatibility).
- **LOW** `classifyStatus(404/405/422)` → `service_unavailable`; stale `testConnection` state documented as last-known.
- Gemini model IDs and request shapes re-verified from official `generate-content/transcribe` + `transcribe` docs (see `docs/gemini-facts.md`).

## Next
Step 7 — voice modes A–F orchestration (transcription/translation separation, language detection, 6/6 examples), using the verified VERBATIM/SMART config.
