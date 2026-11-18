/** Offline Banglish → Bangla mapping rules, longest match first. */

export type RuleKind = 'consonant' | 'vowel' | 'conjunct' | 'other';

export interface TransliterationRule {
  readonly pattern: string;
  readonly bangla: string;
  readonly kind: RuleKind;
}

const CONSONANT = (pattern: string, bangla: string): TransliterationRule => ({
  pattern,
  bangla,
  kind: 'consonant',
});
const VOWEL = (pattern: string, sign: string): TransliterationRule => ({
  pattern,
  bangla: sign,
  kind: 'vowel',
});
const CONJUNCT = (pattern: string, bangla: string): TransliterationRule => ({
  pattern,
  bangla,
  kind: 'conjunct',
});

export const RULES: readonly TransliterationRule[] = Object.freeze([
  CONJUNCT('ksh', 'ক্ষ'),
  CONJUNCT('jny', 'জ্ঞ'),
  CONSONANT('chh', 'ছ'),
  CONSONANT('kh', 'খ'),
  CONSONANT('gh', 'ঘ'),
  CONSONANT('ng', 'ঙ'),
  CONSONANT('jh', 'ঝ'),
  CONSONANT('th', 'থ'),
  CONSONANT('dh', 'ধ'),
  CONSONANT('ph', 'ফ'),
  CONSONANT('bh', 'ভ'),
  CONSONANT('rr', 'ড়'),
  CONSONANT('rh', 'ঢ়'),
  CONSONANT('yy', 'য়'),
  CONSONANT('ch', 'চ'),
  CONSONANT('sh', 'শ'),
  CONSONANT('k', 'ক'),
  CONSONANT('g', 'গ'),
  CONSONANT('c', 'চ'),
  CONSONANT('j', 'জ'),
  CONSONANT('t', 'ত'),
  CONSONANT('d', 'দ'),
  CONSONANT('n', 'ন'),
  CONSONANT('p', 'প'),
  CONSONANT('f', 'ফ'),
  CONSONANT('b', 'ব'),
  CONSONANT('v', 'ব'),
  CONSONANT('m', 'ম'),
  CONSONANT('y', 'য'),
  CONSONANT('r', 'র'),
  CONSONANT('l', 'ল'),
  CONSONANT('s', 'স'),
  CONSONANT('h', 'হ'),
  CONSONANT('z', 'জ'),
  CONSONANT('x', 'ক্স'),
  VOWEL('aa', 'া'),
  VOWEL('ai', 'ৈ'),
  VOWEL('au', 'ৌ'),
  VOWEL('a', 'া'),
  VOWEL('i', 'ি'),
  VOWEL('u', 'ু'),
  VOWEL('e', 'ে'),
  VOWEL('o', 'ো'),
]);

/** Word-start vowel forms; elsewhere the same rule emits the kar sign. */
export const INDEPENDENT_VOWEL_FOR: Readonly<Record<string, string>> = Object.freeze({
  aa: 'আ',
  ai: 'ঐ',
  au: 'ঔ',
  a: 'আ',
  i: 'ই',
  u: 'উ',
  e: 'এ',
  o: 'ও',
});

export function findRule(remaining: string): TransliterationRule | null {
  for (const rule of RULES) {
    if (remaining.startsWith(rule.pattern)) return rule;
  }
  return null;
}
