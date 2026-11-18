import assert from 'node:assert/strict';
import test from 'node:test';
import { allLayoutIds, getLayout, LAYOUTS } from '../../shared/keyboard/layouts.ts';
import {
  acceptSuggestion,
  backspace,
  initialKeyboardState,
  insertText,
  moveCursor,
  pressKey,
  setLanguage,
  setLayout,
  setSuggestions,
} from '../../shared/keyboard/keyboard-state.ts';

test('all four layouts exist and include a bottom action row', () => {
  assert.deepEqual(allLayoutIds(), ['bangla', 'english', 'numbers', 'symbols']);
  for (const id of allLayoutIds()) {
    const layout = getLayout(id);
    const keys = layout.rows.flat();
    assert.ok(keys.some((k) => k.value === 'space'), `${id} has space`);
    assert.ok(keys.some((k) => k.value === 'backspace'), `${id} has backspace`);
    assert.ok(keys.some((k) => k.value === 'voice'), `${id} has voice key`);
  }
  assert.equal(LAYOUTS.bangla.rows[0]?.[0]?.value, 'ক');
  assert.equal(LAYOUTS.english.rows[0]?.[0]?.value, 'q');
  assert.equal(LAYOUTS.english.rows[0]?.[0]?.shiftedValue, 'Q');
});

test('Bangla and English keys insert Unicode text at cursor', () => {
  const s0 = initialKeyboardState();
  const s1 = insertText(s0, 'আমি');
  assert.equal(s1.text, 'আমি');
  assert.equal(s1.cursor, 3);
  assert.equal(s0.text, '', 'original state unchanged');

  const s2 = insertText(s1, ' ');
  const s3 = insertText(s2, 'ok');
  assert.equal(s3.text, 'আমি ok');
  const s4 = insertText(moveCursor(s3, -2), 'X');
  assert.equal(s4.text, 'আমি Xok');
});

test('backspace never goes below zero', () => {
  const s = initialKeyboardState();
  assert.equal(backspace(s), s);
  assert.equal(backspace(insertText(s, 'ক')).text, '');
});

test('shift, language switch and layout switch behave immutably', () => {
  const s0 = initialKeyboardState();
  const s1 = pressKey(s0, getLayout('english').rows[0]?.[0] as never);
  assert.equal(s1.text, 'q');
  const shifted = pressKey(pressKey(s0, { id: 'shift', label: 'Shift', value: 'shift', kind: 'action' }), getLayout('english').rows[0]?.[0] as never);
  assert.equal(shifted.text, 'Q');
  assert.equal(s0.shift, false);

  const en = setLanguage(s0, 'english');
  assert.equal(en.layout, 'english');
  assert.equal(setLayout(en, 'numbers').layout, 'numbers');
  assert.equal(setLayout(en, 'numbers').language, 'english');
});

test('suggestions are immutable and accept inserts text plus space', () => {
  const s0 = initialKeyboardState();
  const s1 = setSuggestions(s0, [
    { text: 'ভালো', source: 'dictionary', score: 1 },
    { text: 'বালো', source: 'spelling', score: 0.5 },
  ]);
  assert.equal(s0.suggestions.length, 0);
  const s2 = acceptSuggestion(s1, 0);
  assert.equal(s2.text, 'ভালো ');
  assert.equal(acceptSuggestion(s1, 9), s1 as never);
});
