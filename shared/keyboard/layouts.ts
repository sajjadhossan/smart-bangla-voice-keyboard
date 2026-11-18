import type { KeyDef, KeyboardLayout, LayoutId } from '../core/types.ts';

function char(id: string, label: string, value: string, shiftedValue?: string): KeyDef {
  return Object.freeze(
    shiftedValue === undefined
      ? { id, label, value, kind: 'char' as const }
      : { id, label, value, shiftedValue, kind: 'char' as const },
  );
}

function action(id: string, label: string, value: string): KeyDef {
  return Object.freeze({ id, label, value, kind: 'action' as const });
}

const BOTTOM_ROW: readonly KeyDef[] = Object.freeze([
  action('lang', '🌐', 'language_switch'),
  action('emoji', '😊', 'emoji'),
  char('comma', ',', ','),
  action('space', 'space', 'space'),
  char('period', '.', '.'),
  char('voice', '🎤', 'voice'),
  action('enter', '↵', 'enter'),
  action('backspace', '⌫', 'backspace'),
]);

const BANGLA_ROWS: readonly (readonly KeyDef[])[] = Object.freeze([
  Object.freeze(['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'].map((k, i) => char(`bn-r1-${i}`, k, k))),
  Object.freeze(['ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন'].map((k, i) => char(`bn-r2-${i}`, k, k))),
  Object.freeze(['প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'র', 'ল', 'শ', 'ষ'].map((k, i) => char(`bn-r3-${i}`, k, k))),
  Object.freeze(['স', 'হ', 'ড়', 'ঢ়', 'য়', 'অ', 'আ', 'ই', 'ঈ', 'উ'].map((k, i) => char(`bn-r4-${i}`, k, k))),
  Object.freeze(['ঊ', 'এ', 'ঐ', 'ও', 'ঔ', 'া', 'ি', 'ু', 'ূ', 'ৃ'].map((k, i) => char(`bn-r5-${i}`, k, k))),
  Object.freeze(['ে', 'ৈ', 'ো', 'ৌ', 'ং', 'ঃ', 'ঁ', '্য', '০', '১'].map((k, i) => char(`bn-r6-${i}`, k, k))),
  BOTTOM_ROW,
]);

const ENGLISH_ROWS: readonly (readonly KeyDef[])[] = Object.freeze([
  Object.freeze('qwertyuiop'.split('').map((k) => char(`en-${k}`, k, k, k.toUpperCase()))),
  Object.freeze('asdfghjkl'.split('').map((k) => char(`en-${k}`, k, k, k.toUpperCase()))),
  Object.freeze([
    action('shift', 'Shift', 'shift'),
    ...'zxcvbnm'.split('').map((k) => char(`en-${k}`, k, k, k.toUpperCase())),
    action('backspace-r3', '⌫', 'backspace'),
  ]),
  Object.freeze('1234567890'.split('').map((k, i) => char(`en-num-${i}`, k, k))),
  BOTTOM_ROW,
]);

const NUMBER_ROWS: readonly (readonly KeyDef[])[] = Object.freeze([
  Object.freeze(['১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯', '০'].map((k, i) => char(`num-${i}`, k, k))),
  Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((k, i) => char(`num-en-${i}`, k, k))),
  Object.freeze(['+', '-', '×', '÷', '=', '%', '(', ')', '[', ']'].map((k, i) => char(`num-op-${i}`, k, k))),
  Object.freeze([
    action('to-abc', 'ABC', 'layout_english'),
    action('to-symbols', '#+=', 'layout_symbols'),
    ...BOTTOM_ROW,
  ]),
]);

const SYMBOL_ROWS: readonly (readonly KeyDef[])[] = Object.freeze([
  Object.freeze(['!', '@', '#', '$', '₹', '^', '&', '*', '(', ')'].map((k, i) => char(`sym-${i}`, k, k))),
  Object.freeze(['–', '—', '_', '=', '+', '{', '}', '[', ']', '\\'].map((k, i) => char(`sym2-${i}`, k, k))),
  Object.freeze([';', ':', '"', "'", '<', '>', ',', '.', '?', '/'].map((k, i) => char(`sym3-${i}`, k, k))),
  Object.freeze([
    action('to-abc-2', 'ABC', 'layout_english'),
    action('to-numbers', '123', 'layout_numbers'),
    ...BOTTOM_ROW,
  ]),
]);

function layout(id: LayoutId, language: 'bangla' | 'english', rows: readonly (readonly KeyDef[])[]): KeyboardLayout {
  return Object.freeze({ id, language, rows });
}

export const LAYOUTS: Readonly<Record<LayoutId, KeyboardLayout>> = Object.freeze({
  bangla: layout('bangla', 'bangla', BANGLA_ROWS),
  english: layout('english', 'english', ENGLISH_ROWS),
  numbers: layout('numbers', 'auto', NUMBER_ROWS),
  symbols: layout('symbols', 'auto', SYMBOL_ROWS),
});

export function getLayout(id: LayoutId): KeyboardLayout {
  return LAYOUTS[id];
}

export function allLayoutIds(): readonly LayoutId[] {
  return Object.freeze(['bangla', 'english', 'numbers', 'symbols'] as const);
}
