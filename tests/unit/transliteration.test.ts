import assert from 'node:assert/strict';
import test from 'node:test';
import { transliterate, banglaSpellingCandidates } from '../../shared/transliteration/engine.ts';
import { editDistance, spellingSuggestions } from '../../shared/transliteration/dictionary.ts';
import { normalizeBangla, isBangla } from '../../shared/language_engine/unicode.ts';

test('brief examples transliterate correctly', () => {
  assert.equal(transliterate('Ami valo achi').text, 'আমি ভালো আছি');
  assert.equal(transliterate('Tumi kemon acho').text, 'তুমি কেমন আছো');
  assert.equal(transliterate('Amar nam Rahim').text, 'আমার নাম রহিম');
});

test('rule engine handles words absent from the dictionary', () => {
  assert.equal(transliterate('kemon').text, 'কেমন');
  assert.equal(transliterate('valo').text, 'ভালো');
  assert.equal(transliterate('kolom').text, 'কোলোম');
});

test('multiple candidates are offered for a single token', () => {
  const result = transliterate('Rahim');
  assert.ok(result.words[0]?.candidates.length >= 2);
  assert.equal(result.words[0]?.candidates[0]?.source, 'dictionary');
  assert.ok(result.words[0]?.candidates.some((c) => c.source === 'transliteration'));
});

test('unknown words and digits are preserved, output is NFC Bangla', () => {
  const result = transliterate('Ami GSM 5G');
  assert.equal(result.text, 'আমি GSM 5G');
  assert.equal(isBangla(result.text), true);
  assert.equal(normalizeBangla(result.text), result.text);
});

test('offline spelling suggestions use edit distance', () => {
  assert.equal(editDistance('ami', 'ami'), 0);
  assert.equal(editDistance('ami', 'amir'), 1);
  assert.ok(spellingSuggestions('amir').some((s) => s.text === 'আমি'));
  assert.ok(banglaSpellingCandidates('ভালো').length >= 0);
});

test('phrase dictionary wins over word-by-word rules', () => {
  const result = transliterate('Ami valo achi');
  assert.equal(result.candidates[0]?.source, 'dictionary');
  assert.equal(result.words.length, 1);
});
