# UI refresh — number row, vertical pinned clipboard, full settings, live Banglish

Status: **IMPLEMENTED, compiled, signature-verified**. User request (Bangla): put a number row above the letters (Bengali digits in BN mode, English digits in EN mode); change the clipboard UI so a press shows copied items in a vertical list going downward, with pinned items arranged at the top; add a Settings option whose screen shows full details and has a more professional UI; and make the Bangla/Banglish option actually work (typing roman letters produces Bengali). User asked for understanding first, then said "ok start".

## Assumptions applied (stated before starting)
1. The number row is **added above** the letters; the existing vowel/123 layer is kept.
2. Settings lives in the toolbar **and** is reachable from the clipboard panel.
3. Banglish converts **as you type** (composing region), and space finalises the token.

## Implementation
### Number row
- `keyboard_view.xml`: new `keyRowNumbers` (40dp, tinted background) above `keyRow1`.
- `BanglaVoiceIme.renderNumberRow()`: 10 keys `০…৯` when `language == "bn"`, `0…9` otherwise; tapping a digit never passes through the Banglish dictionary. Visibility is persisted via `SecureStore.numberRowVisible()` (default ON) and can be toggled in Settings.

### Vertical, pinned clipboard
- `ClipboardStore`: pinned texts are kept in a separate `clipboard_pinned.json` (old history files still load). New `pinned()`, `isPinned()`, `togglePin()`, `allSorted()` (pinned first, newest-first inside each group); `clear()`/`removeAt()` also clean up pins.
- `keyboard_view.xml`: new `panelScroll` + `panelList` — a vertical scrollable panel that replaces the suggestion bar, number row and key rows while open.
- `showClipboardPanel()` renders **Pinned** and **Recent** sections as stacked rows (text + 📌 + Insert + ✕). Tap a row or Insert to paste; pin moves it to the top immediately.

### Full settings screen
- New toolbar `btnSettings` wired to `showSettingsPanel()`, also a shortcut from the clipboard panel.
- Sections with styled headers: Language (BN / EN / Banglish with current mode), Typing (number-row ON/OFF + Banglish note), Privacy (voice consent ON/OFF, text consent ON/OFF), Gemini (encrypted key status + a real button opening the existing setup Activity), Clipboard (count, Open, Clear), About (version + honest offline/AI note).
- `SecureStore.languageMode()` persists the chosen typing mode so the keyboard reopens in it.

### Real-time Banglish
- `BanglaVoiceIme.updateBanglishComposing()` keeps the roman buffer as the source of truth and writes `Banglish.toBangla(buffer)` into the input connection's composing region on every keystroke (e.g. `ami` → `আমি` while typing). Space commits the converted token; backspace rewrites the region from the remaining buffer. Unknown tokens stay roman — no faked transliteration.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `gradle :app:compileDebugKotlin --no-daemon --console=plain` | `BUILD SUCCESSFUL in 39s` (after fixing two `val` shadowing errors in a `Button.apply` block — `this.text` used) |
| 2 | `gradle assembleDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL in 26s` |
| 3 | `apksigner verify app-debug.apk` | signature PASS |
| 4 | merged manifest | `versionCode="6"`, `versionName="1.3.0"` |
| 5 | DEX scan | `renderNumberRow`, `showSettingsPanel`, `togglePin`, `allSorted`, `updateBanglishComposing`, `btnSettings`, `panelScroll` present |
| 6 | `resources.arsc` scan | `keyRowNumbers`, `panelScroll`, `panelList`, `btnSettings`, `suggestionScroll`, `tool_settings`, `clip_pin`, `settings_title` present |
| 7 | `npm test` | `ℹ tests 108` · `ℹ pass 108` · `ℹ fail 0` |
| 8 | `actionlint .github/workflows/*.yml` | exit 0 |

## Honest limits
- **Not device-tested** (no device/emulator here). Verified at compile + resource + DEX + signature level.
- **No live Gemini call** (no key on host); AI translation quality/latency remains unmeasured.
- **No new Android unit tests**: JUnit is not in the offline Gradle cache; adding it would risk breaking offline builds. The new behaviour is verified by compile/resource/DEX checks, not an automated test.
- Banglish is still a **bounded dictionary** (`Banglish.kt`), not a full phonetic engine; unknown words pass through unchanged.
- `Banglish.toBangla()` may convert a partial token that happens to match a dictionary word (e.g. `na` → `না`); continuing to type replaces it. The composing region keeps this visually consistent.
- Settings' Gemini area shows key status and opens the existing setup Activity; it does not embed a second key-entry field inside the IME view.
