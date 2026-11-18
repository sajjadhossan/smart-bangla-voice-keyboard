# Step 9 report — 15 tones, 16 rewrite actions, confirmation gate, undo

Status: **PASS** (pure reducer + routed provider calls) · **NO LIVE GEMINI** (scripted provider in tests)

## Implemented
- `shared/rewrite/rewrite.ts`:
  - `TONE_MODES` — exactly 15 tones (normal default, professional, formal, friendly, casual, polite, business, academic, creative, simple_english, simple_bangla, concise, detailed, confident, empathetic) with a distinct instruction for each; instant switch via `toneOverride`.
  - `REWRITE_ACTIONS` — exactly 16 executable actions: Improve Writing, Fix Grammar, Fix Spelling, Rewrite Professionally, Make Friendly, Make Formal, Make Polite, Make Shorter, Make Longer, Simplify, Improve Clarity, Improve Vocabulary, Translate, Summarize, Expand, Format Text. Each has a real route (`offline`/`correct`/`rewrite`/`summarize`/`translate`), never a decorative stub.
  - Immutable session reducer: `initialRewriteState → proposeRewrite → acceptRewrite|rejectRewrite → undoRewrite`. `propose` never changes visible text; `accept` requires `confirm === true` unless `autoApply` is explicitly enabled; `undo` restores the exact prior string from history.
  - `executeRewrite` routes the action, reuses the Step 8 fact guard on every candidate, and returns a preview outcome. Typed-text translation uses `source: 'text'` (text consent), never voice consent.
- `shared/gemini/provider.ts` — `RewriteInput.instruction?` added so action intent reaches the model; still no model ID in UI.

## Verify commands & exact output
1. `node --experimental-strip-types --test tests/unit/tone-rewrite.test.ts` → `ℹ tests 11` · `ℹ pass 11` · `ℹ fail 0`
2. `npm test` → `ℹ tests 90` · `ℹ pass 90` · `ℹ fail 0` · `ℹ duration_ms 2150.232187`

## Invariants proven
- 15 tones exactly, all with non-trivial instructions; 16 actions exactly, all routed.
- Accept without confirmation ⇒ `err('confirmation_required')`, current unchanged; with confirmation ⇒ applied; reject ⇒ proposal discarded.
- Two accepts then two undos ⇒ byte-exact return to `version-0`; undo on empty history ⇒ `err('nothing_to_undo')`.
- Offline `format_text` / `make_shorter` make zero provider calls; `make_shorter` preserves `৳500`, `2026-12-31`, `Rahim`.
- Fact guard rejects a scripted rewrite that changes amount/date.
- `NO CONSENT` + real provider + counting transport ⇒ `consent_denied`, zero network calls.

## Deviations / limits
- "Make Longer"/"Expand" go to Gemini with a detail instruction; no content is fabricated offline. "Make Shorter"/"Format Text" are deterministic offline rules.
- Clipboard/Copy and Insert/Replace are platform actions (Steps 11–15); this layer exposes the accepted text but does not touch the OS clipboard.

## Next
Step 10 — AI special features A–Q with an executable path for each and a status matrix.
