# Offline / online capability matrix

**Rule:** basic typing never depends on Gemini or the network.

| Capability | Offline | Online (Gemini) | Owner |
|---|---|---|---|
| Bangla typing / Unicode input | ✅ | — | `shared/keyboard` |
| English QWERTY typing | ✅ | — | `shared/keyboard` |
| Bangla/English layouts, numbers, symbols | ✅ | — | `shared/keyboard` |
| Banglish phonetic transliteration | ✅ | — | `shared/transliteration` |
| Local dictionaries + multi-candidates | ✅ | — | `shared/transliteration` |
| Basic word/spelling suggestions | ✅ | — | `shared/transliteration` |
| Themes, language lock, local settings | ✅ | — | `shared/settings` |
| Voice recognition (bn/en/mixed) | ❌ | ✅ | `shared/speech` + `shared/gemini` (planned) |
| Auto language detection | ❌ | ✅ | planned |
| Bangla↔English voice translation | ❌ | ✅ | planned |
| Grammar / spelling / punctuation AI | ❌ | ✅ | planned |
| Tone modes (15) + rewriting | ❌ | ✅ | planned |
| Summarize, reply, next-word, advanced suggestions | ❌ | ✅ | planned |

**Failure behavior:** when offline or Gemini is unavailable, online features show a real error from the 8-state connection model; offline typing continues unchanged.

**Enforcement:** `tests/unit/offline-boundary.test.ts` statically rejects any `gemini`, `fetch(`, `XMLHttpRequest` or URL reference in `shared/keyboard`, `shared/language_engine`, `shared/transliteration`.
