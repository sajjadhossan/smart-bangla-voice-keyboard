# Step 8 report — Grammar engine, fact guard, diff preview

Status: **PASS** (deterministic offline rules + consent-gated online path) · **NO LIVE GEMINI** (scripted provider in tests)

## Implemented
- `shared/grammar/grammar.ts`:
  - `correctOffline(text, language, mode, protectedTerms)` — real deterministic rules, works fully offline. Bangla: `কালকে→আগামীকাল`, locative on place+verb, subject–verb agreement. English: tense agreement with past marker, subject–verb agreement, common spelling conflations, spacing/capitalization.
  - `correctWithGemini(provider, ctx, ...)` — consent-gated online correction through `provider.correct()`. `exact` mode makes **zero** Gemini calls.
  - `extractFacts` / `factsPreserved` — numbers incl. Bengali digits, dates, amounts (৳/₹/$/টাকা/BDT…), emails, URLs, technical terms (API/GPS/ABC123), plus caller-supplied protected names. Sequential value comparison ⇒ no drops, additions or moves allowed.
  - `diffText` — word-level LCS diff (`equal`/`removed`/`added`) for original-vs-corrected preview.
  - `GrammarResult` carries `original`, `corrected`, `diff`, `mode`, `language`, `source`, `factGuard`, `changed` — the UI never overwrites silently.
- If the fact guard fails, `corrected` is forced back to `original` and `factGuard: 'rejected'`; a Gemini result that changes facts returns `err('fact_guard_rejected')` instead of text.

## Verify commands & exact output
1. `node --experimental-strip-types --test tests/unit/grammar.test.ts` → `ℹ tests 13` · `ℹ pass 13` · `ℹ fail 0`
2. `npm test` → `ℹ tests 79` · `ℹ pass 79` · `ℹ fail 0` · `ℹ duration_ms 1794.414634`

## 2/2 Appendix E grammar examples
| # | Input | Output | Route |
|---|---|---|---|
| 1 | `আমি কালকে বাজার যাইbbe।` | `আমি আগামীকাল বাজারে যাব।` | offline Bangla rules |
| 2 | `I am go to school yesterday.` | `I went to school yesterday.` | offline English rules |

Both produce a non-empty diff with the changed tokens asserted.

## Invariants proven
- `exact` = byte-for-byte identity, zero diff changes, zero Gemini calls (offline and online).
- `smart` = formatting-only (double spaces collapsed); `clean`/`professional` = full substitutions.
- Facts (numbers, dates, `৳500`, `2026-12-31`, `Rahim`, `API`) survive a professional correction.
- Guard REJECTS changed amount/date, invented numbers, dropped facts — both for offline candidates and scripted Gemini output.
- `NO CONSENT` + real provider + counting transport ⇒ `consent_denied`, `transport.calls === 0`.

## Deviations / limits
- The offline rules are a deterministic baseline, not a full NLP engine; Gemini handles unrestricted corrections when online and consented. Rule coverage is intentionally narrow and asserted rather than overclaimed.
- `detectLanguage('')` defaults to `english`; mixed script uses the majority script (ties → English). Mode F's auto detection in Step 7 uses Gemini's own detection, not this heuristic.

## Next
Step 9 — 15 tones + rewrite actions + accept/reject/undo with an explicit confirmation gate.
