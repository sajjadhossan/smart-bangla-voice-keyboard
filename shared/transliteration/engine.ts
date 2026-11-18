import type { Suggestion } from '../core/types.ts';
import { normalizeBangla } from '../language_engine/unicode.ts';
import { editDistance, lookupPhrase, lookupWord, spellingSuggestions, WORD_DICTIONARY } from './dictionary.ts';
import { findRule, INDEPENDENT_VOWEL_FOR, type TransliterationRule } from './rules.ts';

export interface WordTransliteration {
  readonly original: string;
  readonly primary: string;
  readonly candidates: readonly Suggestion[];
}

export interface TransliterationResult {
  readonly text: string;
  readonly words: readonly WordTransliteration[];
  readonly candidates: readonly Suggestion[];
}

function transliterateUnknownToken(token: string): string {
  const lower = token.toLowerCase();
  const out: string[] = [];
  let lastWasConsonant = false;
  let i = 0;

  while (i < lower.length) {
    const remaining = lower.slice(i);
    const rule: TransliterationRule | null = findRule(remaining);
    if (rule === null) {
      out.push(token[i] ?? '');
      lastWasConsonant = false;
      i += 1;
      continue;
    }

    if (rule.kind === 'vowel') {
      const atWordStart = out.length === 0;
      out.push(atWordStart ? (INDEPENDENT_VOWEL_FOR[rule.pattern] ?? rule.bangla) : rule.bangla);
      lastWasConsonant = false;
    } else if (rule.pattern === 'y' && lastWasConsonant) {
      out.push('্য'); // য-fola after a consonant
      lastWasConsonant = true;
    } else {
      out.push(rule.bangla);
      lastWasConsonant = rule.kind !== 'other';
    }
    i += rule.pattern.length;
  }
  return normalizeBangla(out.join(''));
}

function transliterateToken(token: string): WordTransliteration {
  // Preserve acronyms / technical tokens verbatim (never invent facts).
  if (/^[A-Z0-9]+$/u.test(token) && /[A-Z]/u.test(token)) {
    const suggestion: Suggestion = Object.freeze({ text: token, source: 'transliteration', score: 1 });
    return Object.freeze({
      original: token,
      primary: token,
      candidates: Object.freeze([suggestion]),
    });
  }

  const dictionaryHit = lookupWord(token);
  const ruleResult = transliterateUnknownToken(token);
  const primary = dictionaryHit ?? ruleResult;
  const candidates: Suggestion[] = [];

  if (dictionaryHit !== null) {
    candidates.push(Object.freeze({ text: dictionaryHit, source: 'dictionary' as const, score: 1 }));
  }
  if (ruleResult !== primary) {
    candidates.push(Object.freeze({ text: ruleResult, source: 'transliteration' as const, score: 0.8 }));
  }
  for (const suggestion of spellingSuggestions(token)) {
    if (!candidates.some((c) => c.text === suggestion.text)) {
      candidates.push(suggestion);
    }
  }
  if (candidates.length === 0) {
    candidates.push(Object.freeze({ text: primary, source: 'transliteration' as const, score: 0.5 }));
  }

  return Object.freeze({
    original: token,
    primary,
    candidates: Object.freeze(candidates),
  });
}

/** Fully offline transliteration. No network, no AI. */
export function transliterate(input: string): TransliterationResult {
  const phrase = lookupPhrase(input);
  if (phrase !== null) {
    const suggestion: Suggestion = Object.freeze({ text: phrase, source: 'dictionary', score: 1 });
    return Object.freeze({
      text: phrase,
      words: Object.freeze([Object.freeze({ original: input.trim(), primary: phrase, candidates: Object.freeze([suggestion]) })]),
      candidates: Object.freeze([suggestion]),
    });
  }

  const parts = input.split(/(\s+)/u);
  const words: WordTransliteration[] = [];
  const textParts: string[] = [];

  for (const part of parts) {
    if (/^\s+$/u.test(part) || part === '') {
      textParts.push(part);
      continue;
    }
    const word = transliterateToken(part);
    words.push(word);
    textParts.push(word.primary);
  }

  return Object.freeze({
    text: normalizeBangla(textParts.join('')),
    words: Object.freeze(words),
    candidates: Object.freeze(words[0]?.candidates ?? []),
  });
}

/** Basic offline spelling suggestions over Bangla dictionary values. */
export function banglaSpellingCandidates(input: string, limit = 3): readonly string[] {
  const found = [...new Set(Object.values(WORD_DICTIONARY))]
    .filter((word) => word !== input)
    .map((word) => ({ word, distance: editDistance(input, word) }))
    .filter((entry) => entry.distance <= 2)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => entry.word);
  return Object.freeze(found);
}
