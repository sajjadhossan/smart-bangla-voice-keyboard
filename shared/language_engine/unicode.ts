/** Bangla Unicode helpers. Pure, offline, no platform APIs. */

const BANGLA_LETTER_START = 0x09a0; // ক .. roughly through ৱ
const BANGLA_BLOCK_END = 0x09ff;

export function isBanglaCodePoint(code: number): boolean {
  return code >= BANGLA_LETTER_START && code <= BANGLA_BLOCK_END;
}

export function isBangla(text: string): boolean {
  return [...text].some((ch) => isBanglaCodePoint(ch.codePointAt(0) ?? 0));
}

export function normalizeBangla(text: string): string {
  return text.normalize('NFC');
}

/** Independent vowels used at word start. */
export const INDEPENDENT_VOWELS = new Set([
  'অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ',
]);

/** Vowel signs (kar) used after consonants. */
export const VOWEL_SIGNS = new Set([
  'া', 'ি', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ',
]);

export function isVowelSign(ch: string): boolean {
  return VOWEL_SIGNS.has(ch);
}

export function isIndependentVowel(ch: string): boolean {
  return INDEPENDENT_VOWELS.has(ch);
}

export function isBanglaConsonant(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x09a8 && code <= 0x09ea; // ক .. ৪ approximate consonant range
}
