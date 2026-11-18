# Grammar, tone and writing engine

`shared/grammar/grammar.ts` — offline Bangla/English correction with four grammar voice modes (exact transcription, smart correction, clean voice typing, professional voice writing). A fact guard preserves names, dates, numbers, amounts and technical terms. Original-vs-corrected output is a word-level diff shown as a preview; nothing is silently overwritten.

Examples from the acceptance set:
- `আমি কালকে বাজার যাইবে।` → `আমি আগামীকাল বাজারে যাব।`
- `I am go to school yesterday.` → `I went to school yesterday.`

`shared/rewrite/rewrite.ts` — exactly 15 tones (normal default + professional, formal, friendly, casual, polite, business, academic, creative, simple_english, simple_bangla, concise, detailed, confident, empathetic), 16 rewrite actions, and immutable accept/reject/copy/replace/undo with a confirmation gate. Undo restores the exact original.

Online variants (Gemini `correct`/`rewrite`) run only with consent; offline corrections always work without a network.
