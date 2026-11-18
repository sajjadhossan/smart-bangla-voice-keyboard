# Step 4b report — Voice corpus + WER/CER/latency harness
Status: **PASS** (harness), **BLOCKED** (real metrics — no recorded audio yet)

- **Implemented:** Bangla-aware NFC normalization, word/char Levenshtein alignment with S/D/I counts, WER/CER, nearest-rank p50/p95 for end-of-speech→final-text latency, `npm run test:wer` CLI with per-mode table, versioned corpus manifest for modes A–F.
- **Files:** `shared/metrics/speech-metrics.ts`, `scripts/test-wer.ts`, `tests/unit/speech-metrics.test.ts`, `tests/fixtures/voice/v1/manifest.json`, `tests/fixtures/voice/v1/README.md`.
- **Verify command:** `npm test && npm run test:wer -- --fixtures tests/fixtures/voice/v1`
  Output: 24/24 tests pass. Harness: `Samples: 0 · scored: 0` → `NO EVALUATED SAMPLES — WER/CER/latency unavailable.` (no fabricated numbers).
- **Tests executed:** 24 · **passed:** 24 · **failed:** 0.
- **Remaining:** record real on-device/vendor-licensed audio for modes A–F, run the real engine, fill `hypothesis` + `endOfSpeechToFinalMs`, then re-run the harness for actual WER/CER/latency.
- **Build status:** N/A.
- **Deviations:** no score thresholds claimed because no corpus exists yet; algorithm tests use synthetic strings purely to verify the implementation.
