# Step 7 report — Voice modes A–F, transcription/translation separation

Status: **PASS** (orchestration + deterministic tests) · **NO LIVE GEMINI / NO REAL AUDIO** (fake provider + injected bytes; real WER/CER still blocked)

## Implemented
- `shared/voice/voice-modes.ts` — pure planner + orchestrator:
  - `VOICE_MODE_SOURCES` / `VOICE_MODE_TARGETS` — per-mode source hints and fixed targets (A Bangla→Bangla, B English→English, C Bangla→English, D English→Bangla, E Banglish→Bangla, F mixed→mixed).
  - `planVoiceMode(mode, { languageMode, grammarMode })` — manual language override honored; `languageMode: 'auto'` removes the hint; **target language is fixed by the mode**, so a language toggle cannot silently turn A into a translation.
  - `executeVoiceMode(provider, input, callbacks)` — ALWAYS transcribes first, then translates ONLY for C/D as a **second, independent provider call**. Provider errors propagate; a failed translation never returns the raw transcript as a fake success.
  - Emits the real 11-state sequence `TRANSCRIBING → (TRANSLATING) → RESULT_READY` and a call-level audit trail (1 step for A/B/E/F, 2 for C/D).
- Consent is never re-implemented here: the same `RequestContext` is forwarded, and the injected provider re-checks `assertCanSend()` before every call.

## Verify commands & exact output
1. `node --experimental-strip-types --test tests/unit/voice-modes.test.ts` → `ℹ tests 13` · `ℹ pass 13` · `ℹ fail 0`
2. `npm test` → `ℹ tests 66` · `ℹ pass 66` · `ℹ fail 0` · `ℹ duration_ms 1779.174062`

## 6/6 Appendix E voice examples (orchestration level)
| Mode | Input | Result | Translate call |
|---|---|---|---|
| A | Bangla speech | `আমি বাংলাদেশে থাকি।` | none |
| B | English speech | `I live in Bangladesh.` | none |
| C | Bangla speech | `আমি ভালো আছি।` → `I am fine.` | 1 (English) |
| D | English speech | `How are you?` → `তুমি কেমন আছো?` | 1 (Bengali) |
| E | Banglish speech | `আমি ভালো আছি` | none |
| F | mixed speech | `আজকে আমার একটা important meeting আছে।` (unchanged) | none |

Appendix E lists 5 verbatim voice examples; mode E is covered by the Banglish→Bangla example derived from the brief's transliteration acceptance line (`Ami valo achi → আমি ভালো আছি`). All 6 modes are independently selected and asserted.

## Key invariants proven
- **Exact mode never auto-translates:** all 4 grammar modes × all 4 transcription-only modes (A/B/E/F) ⇒ `translateCalls.length === 0`.
- **C/D separate calls:** transcribe (source language, VERBATIM under exact) then translate (`source: 'voice'`, voice-consent gated). Raw transcript is preserved alongside the final text, not overwritten.
- **NO CONSENT through the full orchestrator + REAL `GeminiApiProvider` + counting transport** ⇒ `consent_denied`, `transport.calls === 0`.
- Failed translation ⇒ `err('service_unavailable')`, never a silent raw-text insert.

## Deviations / limits
- The fake provider returns canned strings; these tests prove **call routing, ordering, consent and error propagation**, NOT transcription accuracy. Real WER/CER/latency remain unavailable until a voice corpus is recorded and a live key supplied (Step 4b harness still reports `NO EVALUATED SAMPLES`).
- **Partial→final** streaming is a platform/Live-API concern (`gemini-3.5-transcribe-live`); this unary orchestrator emits only final text and fabricates no partial results.
- Punctuation/capitalization for smart/clean/professional is delegated to the verified `audioTranscriptionConfig.mode = "SMART"` in the provider (Step 5 fix), not a prompt hack here.

## Next
Step 8 — grammar engine (Bangla + English correction), diff preview, fact guard; 2/2 Appendix E grammar examples.
