# Step 10 report — AI special features A–Q

Status: **PASS** (every feature has an executable path) · **PLATFORM-ONLY ITEMS MARKED, NOT FAKED**

## Implemented
- `shared/features/ai-features.ts` — registry of 17 features A–Q, `executeFeature()` dispatcher, and `featureStatusMatrix()` for the final report.
  - **Gemini-backed (real consent-gated calls):** A Summarizer, B Expander, C Reply Assistant, D Vocabulary, H Context Suggestions, Q Sentence Improvement. Each route uses `summarize`/`rewrite` on the injected provider; `H` includes the real surrounding text in the instruction.
  - **Offline (real deterministic paths):** E Language Detector (Unicode script), F Formatter, G Templates (built-in expandable templates), I Next Word (reuses Step 4 `WORD_DICTIONARY` — no duplicate dictionary), J Smart Spelling (reuses Step 4 `spellingSuggestions`), K Custom Dictionary/Corrections (user override map), M Voice History, N Translation History, O Undo/Redo (append-only cursor history), P Original-vs-Corrected (Step 8 `diffText`).
  - **Platform-only:** L Clipboard returns an explicit `ClipboardCommand` for the native layer; status `platform_required` — no claim that the OS clipboard was touched.
- Every Gemini feature result passes the Step 8 fact guard before being returned.
- Blueprint discrepancy handled honestly: Appendix F says "A–Q" but names 16 features. Q is filled from brief §03's "sentence improvement" (no invented capability); documented in the module header.

## Verify commands & exact output
1. `node --experimental-strip-types --test tests/unit/ai-features.test.ts` → `ℹ tests 8` · `ℹ pass 8` · `ℹ fail 0`
2. `npm test` → `ℹ tests 98` · `ℹ pass 98` · `ℹ fail 0` · `ℹ duration_ms 2194.523801`

## Invariants proven
- All 17 ids A–Q are unique and each returns a real result (`EVERY feature A–Q has an executable path`).
- Gemini features call the correct provider capability; context suggestions actually include `surroundingText`.
- Offline features produce real outputs (Bangla detection `bangla`, formatting, `Rahim` template expansion, `ami→আমি`, dictionary `Rahim→রহিম`, diff tokens).
- History append/undo/redo moves the cursor exactly; voice/translation entries distinct.
- Clipboard returns a command and is marked `platform_required`.
- Fact guard rejects a Gemini feature that changes `৳500`/`2026-12-31`; unknown ids and unknown templates ⇒ real errors.
- `NO CONSENT` + real provider + counting transport ⇒ `consent_denied`, zero network calls.

## Deviations / limits
- History is in-memory for the shared core; persistence is a platform concern (Steps 11–15).
- Clipboard copy/cut and OS-level insertion are executed by native code, not here (status matrix marks this).

## Next
Step 11 — Android `InputMethodService`, keyboard views, suggestion bar. Verify with real Kotlin compile (toolchain proven).
