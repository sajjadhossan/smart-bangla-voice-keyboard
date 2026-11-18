# Step 4 report — Offline transliteration
Status: **PASS**

- **Implemented:** longest-match Banglish→Bangla rule engine (consonants, vowels, kar, fola, conjuncts), phrase + word dictionary, multi-candidate suggestions with edit-distance spelling fallback, acronym/technical-token preservation, NFC normalization, plus `tests/unit/offline-boundary.test.ts` proving no Gemini/network import in offline modules.
- **Files:** `shared/transliteration/rules.ts`, `shared/transliteration/dictionary.ts`, `shared/transliteration/engine.ts`, `shared/language_engine/unicode.ts`, `tests/unit/transliteration.test.ts`, `tests/unit/offline-boundary.test.ts`.
- **Verify command:** `npm test -- tests/unit/transliteration.test.ts && npm test -- tests/unit/offline-boundary.test.ts`
  Output: 8 tests pass — all three brief examples, rule engine, multi-candidates, acronym preservation, spelling suggestions, phrase priority, offline boundary.
- **Tests executed:** 8 · **passed:** 8 · **failed:** 0.
- **Remaining:** expand fixture set `tests/fixtures/transliteration/v1.csv` for the ≥80% top-1 baseline (fixture currently absent — threshold not yet claimed).
- **Build status:** N/A.
- **Deviations:** none.
