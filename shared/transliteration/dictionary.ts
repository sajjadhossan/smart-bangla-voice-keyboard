import type { Suggestion } from '../core/types.ts';

/** Local, offline dictionary. No network, no AI. */
export const WORD_DICTIONARY: Readonly<Record<string, string>> = Object.freeze({
  ami: 'আমি',
  amar: 'আমার',
  achi: 'আছি',
  acho: 'আছো',
  ache: 'আছে',
  bhalo: 'ভালো',
  valo: 'ভালো',
  bangladesh: 'বাংলাদেশ',
  chai: 'চাই',
  ekta: 'একটা',
  ghor: 'ঘর',
  jan: 'জান',
  jabo: 'যাবো',
  karo: 'কারো',
  kemon: 'কেমন',
  ki: 'কি',
  kintu: 'কিন্তু',
  kokhon: 'কখন',
  koro: 'করো',
  korbo: 'করবো',
  korchi: 'করছি',
  kothay: 'কোথায়',
  koto: 'কত',
  nam: 'নাম',
  nei: 'নেই',
  pani: 'পানি',
  rahim: 'রহিম',
  school: 'স্কুল',
  thaki: 'থাকি',
  thakbo: 'থাকবো',
  tumi: 'তুমি',
  college: 'কলেজ',
});

export const PHRASE_DICTIONARY: Readonly<Record<string, string>> = Object.freeze({
  'ami valo achi': 'আমি ভালো আছি',
  'tumi kemon acho': 'তুমি কেমন আছো',
  'amar nam rahim': 'আমার নাম রহিম',
  'ami bangladesh e thaki': 'আমি বাংলাদেশে থাকি',
});

export function lookupWord(token: string): string | null {
  const exact = WORD_DICTIONARY[token];
  if (exact !== undefined) return exact;
  const lower = token.toLowerCase();
  return WORD_DICTIONARY[lower] ?? null;
}

export function lookupPhrase(input: string): string | null {
  return PHRASE_DICTIONARY[input.trim().toLowerCase().replace(/\s+/g, ' ')] ?? null;
}

/** Levenshtein distance, used only for offline spelling suggestions. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

/** Nearby dictionary entries for a possibly misspelled Banglish token. */
export function spellingSuggestions(token: string, limit = 3): readonly Suggestion[] {
  const lower = token.toLowerCase();
  const found: Suggestion[] = [];
  for (const [key, bangla] of Object.entries(WORD_DICTIONARY)) {
    if (key === lower) continue;
    const distance = editDistance(lower, key);
    if (distance <= 2) {
      found.push({ text: bangla, source: 'spelling', score: 1 - distance / 3 });
    }
  }
  return Object.freeze(
    found
      .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))
      .slice(0, limit)
      .map((s) => Object.freeze(s)),
  );
}
