# Step 3 report — Offline layouts & keyboard state
Status: **PASS**

- **Implemented:** Bangla layout (letters, kar, fola, numerals), English QWERTY with shift, number/symbol layouts, bottom action row with mic/AI/language keys, immutable keyboard state (insert, backspace, cursor, shift, language/layout switch, suggestions, accept).
- **Files:** `shared/keyboard/layouts.ts`, `shared/keyboard/keyboard-state.ts`, `tests/unit/keyboard.test.ts`.
- **Verify command:** `npm test -- tests/unit/keyboard.test.ts`
  Output: 5 tests pass (all 4 layouts, Unicode insertion, backspace floor, shift/language/layout immutability, suggestion accept).
- **Tests executed:** 5 · **passed:** 5 · **failed:** 0.
- **Remaining:** native `InputMethodService` rendering (Step 11).
- **Build status:** N/A.
- **Deviations:** none.
