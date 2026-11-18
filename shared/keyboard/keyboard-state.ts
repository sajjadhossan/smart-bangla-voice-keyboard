import type { KeyDef, LanguageMode, LayoutId, Suggestion, ToneMode } from '../core/types.ts';
import { getLayout } from './layouts.ts';

/** Immutable keyboard state shared by every platform's input method. */
export interface KeyboardState {
  readonly text: string;
  readonly cursor: number;
  readonly language: LanguageMode;
  readonly layout: LayoutId;
  readonly shift: boolean;
  readonly tone: ToneMode;
  readonly suggestions: readonly Suggestion[];
}

export function initialKeyboardState(
  language: LanguageMode = 'bangla',
  layout: LayoutId = 'bangla',
  tone: ToneMode = 'normal',
): KeyboardState {
  return Object.freeze({
    text: '',
    cursor: 0,
    language,
    layout,
    shift: false,
    tone,
    suggestions: Object.freeze([]),
  });
}

/** Insert text at the cursor. Always returns a new state. */
export function insertText(state: KeyboardState, text: string): KeyboardState {
  if (text === '') return state;
  const before = state.text.slice(0, state.cursor);
  const after = state.text.slice(state.cursor);
  return Object.freeze({
    ...state,
    text: before + text + after,
    cursor: state.cursor + text.length,
    suggestions: Object.freeze([]),
  });
}

export function backspace(state: KeyboardState): KeyboardState {
  if (state.cursor === 0) return state;
  const before = state.text.slice(0, state.cursor - 1);
  const after = state.text.slice(state.cursor);
  return Object.freeze({
    ...state,
    text: before + after,
    cursor: state.cursor - 1,
    suggestions: Object.freeze([]),
  });
}

export function moveCursor(state: KeyboardState, offset: number): KeyboardState {
  const next = Math.min(Math.max(state.cursor + offset, 0), state.text.length);
  return next === state.cursor ? state : Object.freeze({ ...state, cursor: next });
}

export function pressKey(state: KeyboardState, key: KeyDef): KeyboardState {
  if (key.kind === 'action') {
    switch (key.value) {
      case 'backspace': return backspace(state);
      case 'space': return insertText(state, ' ');
      case 'enter': return insertText(state, '\n');
      case 'shift': return Object.freeze({ ...state, shift: !state.shift });
      case 'language_switch':
        return setLanguage(state, state.language === 'bangla' ? 'english' : 'bangla');
      case 'layout_english': return setLayout(state, 'english');
      case 'layout_numbers': return setLayout(state, 'numbers');
      case 'layout_symbols': return setLayout(state, 'symbols');
      case 'emoji': return insertText(state, '😊');
      case 'voice': return state; // voice is handled by the platform voice controller
      default: return state;
    }
  }
  const value = state.shift && key.shiftedValue !== undefined ? key.shiftedValue : key.value;
  return insertText(state, value);
}

export function setLanguage(state: KeyboardState, language: LanguageMode): KeyboardState {
  if (state.language === language) return state;
  const nextLayout: LayoutId =
    language === 'english' ? 'english' : language === 'bangla' ? 'bangla' : state.layout;
  return Object.freeze({
    ...state,
    language,
    layout: nextLayout,
    shift: false,
    suggestions: Object.freeze([]),
  });
}

export function setLayout(state: KeyboardState, layout: LayoutId): KeyboardState {
  if (state.layout === layout) return state;
  const layoutLanguage = getLayout(layout).language;
  return Object.freeze({
    ...state,
    layout,
    language: layoutLanguage === 'auto' ? state.language : layoutLanguage,
    suggestions: Object.freeze([]),
  });
}

export function setTone(state: KeyboardState, tone: ToneMode): KeyboardState {
  return tone === state.tone ? state : Object.freeze({ ...state, tone });
}

export function setSuggestions(state: KeyboardState, suggestions: readonly Suggestion[]): KeyboardState {
  return Object.freeze({ ...state, suggestions: Object.freeze([...suggestions]) });
}

export function acceptSuggestion(state: KeyboardState, index: number): KeyboardState {
  const suggestion = state.suggestions[index];
  if (suggestion === undefined) return state;
  return insertText(state, suggestion.text + ' ');
}
