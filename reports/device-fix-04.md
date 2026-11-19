# Voice assistant — one mic, auto language, spoken translation

Status: **IMPLEMENTED, compiled, signature-verified**. User request: a dedicated keyboard voice-assistant mic — press it, speak Bengali → Bengali text, speak English → English text, say "translation" → translated text. User asked to confirm understanding first, then said "ok start".

## Assumptions applied (stated before starting)
1. A spoken `অনুবাদ করো` / `translate` command triggers translation; a manual `Tr` button in the result bar is also available.
2. Translation direction is automatic (BN→EN or EN→BN); explicit `to english` / `বাংলায়` in the utterance overrides it.
3. Results are previewed, then inserted (nothing inserted silently).
4. Speech→text is offline (system recognizer); translation needs Gemini (key + consent + network).

## Implementation
### `VoiceAssistant.kt` (new, pure/offline logic)
- `detectLanguage(text)` — Bengali script is Unicode `U+0980..U+09FF`; otherwise English. Script-based detection is deterministic, not a guess.
- `parse(raw)` — detects `translate` / `অনুবাদ` / `ট্রান্সলেশন` family of commands (longest-first removal), detects explicit target (`to english` / `বাংলায়` …), strips command phrases and returns the actual content.
- `direction(source, target)` — maps to shared mode `C` (BN→EN) or `D` (EN→BN); no explicit target ⇒ opposite language.

### `BanglaVoiceIme.kt`
- The top-right mic is now a single **dedicated assistant**: tap → voice consent → system recognizer (typing mode only hints the recognizer language) → transcript.
- `handleAssistantTranscript()` → `VoiceAssistant.parse()` → either `showAssistantResult()` (language badge + Insert / Translate / Discard) or `runAssistantTranslation()`.
- Translation is gated by `withTextConsent()` (text egress), then `GeminiVoiceClient.translateText()` on a background thread, then preview → Insert/Discard; real failure states show with Retry.
- Manual `Tr` menu for typed text retained; unlimited clipboard and bn/en/banglish typing modes untouched.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `gradle :app:compileDebugKotlin --no-daemon --console=plain` | `BUILD SUCCESSFUL in 53s` |
| 2 | `gradle assembleDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL in 27s` |
| 3 | `apksigner verify app-debug.apk` | signature PASS |
| 4 | DEX scan (`classes3.dex`) | `VoiceAssistant`, `VoiceAssistant$Command`, `VoiceAssistant$parse`, `VoiceAssistant$detectLanguage`, `handleAssistantTranscript` present |
| 5 | merged manifest | `versionCode="5"`, `versionName="1.2.0"` |
| 6 | `npm test` | `ℹ tests 108` · `ℹ pass 108` · `ℹ fail 0` |

No compile errors occurred in this step.

## Honest limits
- **Not device-tested** (no device/emulator). Verified at compile + DEX + signature level.
- **No live Gemini call** (no key on host) — translation quality/latency unmeasured.
- **No new Android unit tests**: JUnit is not in the offline Gradle cache; adding it would risk breaking offline builds. The 108 shared-core tests still pass, but `VoiceAssistant` itself is not covered by an automated test here.
- Recognition accuracy for the non-hinted language depends on the device's speech engine; script detection only classifies the text that the recognizer returned.
- Voice command phrase matching is a bounded keyword list, not a trained intent classifier.
