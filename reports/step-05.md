# Step 5 report — Gemini provider, API settings, consent-enforced egress

Status: **PASS** (implementation + deterministic tests) · **NOT LIVE-TESTED** (no real API key supplied)

## Verified facts first
`docs/gemini-facts.md` was written from official docs (fetched 2026-11-18) before any code:
- Audio model `gemini-3.5-transcribe`, text model `gemini-3.6-flash` (stable).
- REST `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`, header `x-goog-api-key`.
- Verified Bengali/English locales `bn-BD`, `bn-IN`, `en-US`, `en-GB`.
No model ID or endpoint was guessed.

## Implemented
- `shared/gemini/transport.ts` — `HttpTransport` boundary + real `FetchTransport` with AbortController timeout. Injected in tests, so deterministic. Logs nothing.
- `shared/gemini/config.ts` — model IDs/endpoints/timeouts/retry/live-check gate as config. `DEFAULT_GEMINI_CONFIG`.
- `shared/gemini/connection.ts` — pure state machine; `classifyStatus()` maps **real** HTTP status → state (400/401→invalid_api_key, 403→authentication_failed, 429→quota_exceeded, 5xx→service_unavailable, 2xx→connected; transport throw→network_error).
- `shared/gemini/api-key.ts` — save/replace/remove/get + `masked` display (never full key). `validateApiKeyShape()` is explicitly a **shape check only**, not a substitute for a connection test.
- `shared/gemini/provider.ts` — `GeminiProvider` with `transcribe/translate/correct/rewrite/summarize`. Every capability runs `assertCanSend()` *before* `build()` or `send()`. Bounded retry on 429/5xx, `x-goog-api-key` header, response parsed from `candidates[0].content.parts`. `testConnection()` does a real `GET /models` and only when `userConfirmed === true` **and** `config.allowLiveCheck === true`.
- `tests/unit/connection.test.ts` — 13 tests.

## Verify commands & exact output
1. `npm test` → `ℹ tests 37` · `ℹ pass 37` · `ℹ fail 0`
2. `node --experimental-strip-types --test tests/unit/connection.test.ts` → `ℹ tests 13` · `ℹ pass 13` · `ℹ fail 0`
   - includes `✔ all 8 ConnectionState values are reachable from real events`
   - includes `✔ NO CONSENT ⇒ zero network calls for every capability`

## All 8 states covered
`not_configured` (no key / key removed), `connecting` (check_started event), `connected` (2xx), `invalid_api_key` (400/401), `authentication_failed` (403), `quota_exceeded` (429), `service_unavailable` (5xx), `network_error` (transport throw).

## Security
- No key in source/config/docs; only two obviously fake literals in `tests/unit/connection.test.ts` (deterministic fixtures, not secrets).
- No text/audio/key logging anywhere in the provider or transport.
- Scope separation verified: `voice` consent permits `transcribe`/`translate` but denies `correct`/`rewrite`/`summarize`; zero network when consent denied.

## Deviations / limits
- **No live API key was provided**, so no real Gemini request was made. Connection states were verified against injected real-shaped transport results. A live smoke test remains a manual, consent-gated step (documented in `.env.example` / README).
- Retry/backoff is bounded (`maxRetries = 2`, base 500 ms); no jitter added yet. Now covered by tests (429→200, exhausted 5xx, transport errors).
- ~~Transcription wired via prompt~~ **RESOLVED:** after re-verifying official docs, `transcribe()` now sends the dedicated `generationConfig.audioTranscriptionConfig` with `mode: VERBATIM|SMART` and `languageCodes`. See `docs/gemini-facts.md`.
- Code review (1 HIGH / 4 MEDIUM / 4 LOW) folded in before Step 7 — see `reports/step-06.md`: storage I/O now returns `Result`, translate consent scope fixed, response parser hardened, 404/422 mapping, maxRetries clamp. Full suite now `ℹ tests 53 · ℹ pass 53 · ℹ fail 0`.

## Next
Step 6 — Voice capture (consent required before capture, no upload path in that module), then Steps 7–10, then Step 11 native Android IME.
