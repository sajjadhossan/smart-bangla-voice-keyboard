/**
 * Grammar engine — deterministic offline rules + an online Gemini path.
 *
 * Hard rules:
 *  - 'exact' mode never changes a single character and never calls Gemini.
 *  - A fact guard compares numbers (incl. Bengali digits), dates, amounts,
 *    emails, URLs, technical terms and caller-supplied protected terms between
 *    original and corrected. Any change ⇒ the correction is REJECTED, never
 *    silently inserted. This applies to Gemini output too.
 *  - Every correction returns original + corrected + a word-level diff so the
 *    UI can show a preview. Nothing overwrites without accept.
 */
import type { GrammarVoiceMode } from '../core/types.ts';
import { err, ok, type Result } from '../core/result.ts';
import type { GeminiProvider, RequestContext } from '../gemini/provider.ts';

export type GrammarLanguage = 'bangla' | 'english' | 'auto';

export interface FactSpan {
  readonly kind: 'number' | 'date' | 'amount' | 'email' | 'url' | 'technical' | 'protected';
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

const BN_DIGITS = '\u09E6-\u09EF';
const NUMBER_RE = new RegExp(`[0-9${BN_DIGITS}]+`, 'g');
const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
const AMOUNT_RE = /(?:৳|₹|\$|€|£|BDT|Tk\.?|USD|EUR|টাকা)\s*[0-9\u09E6-\u09EF]+|[0-9\u09E6-\u09EF]+\s*(?:টাকা|TK|BDT|USD)/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_RE = /https?:\/\/[^\s]+/gi;
const TECHNICAL_RE = /\b[A-Z][A-Z0-9]{1,}\b/g; // API, GPS, HTTP, ABC123

/** Detect script from Unicode block — no network, no model. */
export function detectLanguage(text: string): Exclude<GrammarLanguage, 'auto'> {
  if (text.trim().length === 0) return 'english';
  const bangla = (text.match(/[\u0980-\u09FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return bangla > latin ? 'bangla' : 'english';
}

/** Collect facts in reading order. Overlaps are de-duplicated by position. */
export function extractFacts(text: string, protectedTerms: readonly string[] = []): readonly FactSpan[] {
  const found: FactSpan[] = [];
  const push = (kind: FactSpan['kind'], re: RegExp): void => {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      if (match.index === undefined) continue;
      found.push({ kind, value: match[0], start: match.index, end: match.index + match[0].length });
    }
  };
  push('url', URL_RE);
  push('email', EMAIL_RE);
  push('amount', AMOUNT_RE);
  push('date', DATE_RE);
  push('number', NUMBER_RE);
  push('technical', TECHNICAL_RE);
  for (const term of protectedTerms) {
    if (term.length === 0) continue;
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    push('protected', re);
  }
  return found
    .filter((span, index) => found.findIndex((other) => other.start === span.start && other.end === span.end) === index)
    .sort((a, b) => a.start - b.start);
}

/** Facts must be identical in value AND order — no drops, additions or moves. */
export function factsPreserved(
  original: string,
  corrected: string,
  protectedTerms: readonly string[] = [],
): boolean {
  const before = extractFacts(original, protectedTerms).map((f) => `${f.kind}:${f.value}`);
  const after = extractFacts(corrected, protectedTerms).map((f) => `${f.kind}:${f.value}`);
  return before.length === after.length && before.every((value, index) => value === after[index]);
}

export type DiffKind = 'equal' | 'removed' | 'added';

export interface DiffToken {
  readonly kind: DiffKind;
  readonly original: string;
  readonly corrected: string;
}

/** Word-level LCS diff — deterministic, no dependency. */
export function diffText(original: string, corrected: string): readonly DiffToken[] {
  const a = original.trim().split(/\s+/).filter(Boolean);
  const b = corrected.trim().split(/\s+/).filter(Boolean);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ kind: 'equal', original: a[i], corrected: b[j] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ kind: 'removed', original: a[i], corrected: '' });
      i += 1;
    } else {
      tokens.push({ kind: 'added', original: '', corrected: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    tokens.push({ kind: 'removed', original: a[i], corrected: '' });
    i += 1;
  }
  while (j < m) {
    tokens.push({ kind: 'added', original: '', corrected: b[j] });
    j += 1;
  }
  return tokens;
}

export interface GrammarResult {
  readonly original: string;
  readonly corrected: string;
  readonly diff: readonly DiffToken[];
  readonly mode: GrammarVoiceMode;
  readonly language: Exclude<GrammarLanguage, 'auto'>;
  readonly source: 'offline' | 'gemini';
  readonly factGuard: 'passed' | 'rejected';
  readonly changed: boolean;
}

function buildResult(
  original: string,
  candidate: string,
  mode: GrammarVoiceMode,
  language: Exclude<GrammarLanguage, 'auto'>,
  source: GrammarResult['source'],
  protectedTerms: readonly string[],
): GrammarResult {
  const guardPassed = factsPreserved(original, candidate, protectedTerms);
  const corrected = guardPassed ? candidate : original;
  const changed = corrected !== original;
  return {
    original,
    corrected,
    diff: Object.freeze(diffText(original, corrected)),
    mode,
    language,
    source,
    factGuard: guardPassed ? 'passed' : 'rejected',
    changed,
  };
}

// ---------- deterministic offline rules ----------

function formatWhitespace(text: string, language: Exclude<GrammarLanguage, 'auto'>): string {
  let out = text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,!?;:।,.!?])/g, '$1').trim();
  if (language === 'english') {
    out = out.replace(/([,.!?])(?=[A-Za-z])/g, '$1 ');
    out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, prefix: string, letter: string) => prefix + letter.toUpperCase());
  }
  return out;
}

const EN_CONFLATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\brecieve\b/gi, 'receive'],
  [/\bacheive\b/gi, 'achieve'],
  [/\bteh\b/gi, 'the'],
  [/\badress\b/gi, 'address'],
  [/\bdefinately\b/gi, 'definitely'],
  [/\bseperate\b/gi, 'separate'],
];

function correctEnglish(text: string, full: boolean): string {
  let out = text;
  if (full) {
    const past = /\b(yesterday|ago|last\s+\w+|in\s+20\d\d)\b/i.test(out);
    const verbs: Readonly<Record<string, string>> = {
      go: past ? 'went' : 'going', eat: past ? 'ate' : 'eating', play: past ? 'played' : 'playing',
      work: past ? 'worked' : 'working', study: past ? 'studied' : 'studying',
      come: past ? 'came' : 'coming', see: past ? 'saw' : 'seeing', take: past ? 'took' : 'taking',
      make: past ? 'made' : 'making', write: past ? 'wrote' : 'writing', read: past ? 'read' : 'reading',
    };
    out = out.replace(/\b(am|is|are|was|were)\s+(go|eat|play|work|study|come|see|take|make|write|read)\b/gi,
      (_m, _be: string, verb: string) => verbs[verb.toLowerCase()] ?? verb);
    out = out.replace(/\b(he|she|it)\s+go\b/gi, '$1 goes');
    out = out.replace(/\b(they|we|you|i)\s+goes\b/gi, '$1 go');
    out = out.replace(/\bI\s+has\b/g, 'I have');
    out = out.replace(/\b(he|she|it)\s+have\b/gi, '$1 has');
    out = out.replace(/\b(he|she|it)\s+don't\b/gi, "$1 doesn't");
    for (const [pattern, replacement] of EN_CONFLATIONS) out = out.replace(pattern, replacement);
  }
  return out;
}

const BN_PLACES: readonly string[] = ['বাজার', 'অফিস', 'স্কুল', 'কলেজ', 'হাসপাতাল', 'দোকান', 'গ্রাম', 'শহর'];

function correctBangla(text: string, full: boolean): string {
  let out = text;
  if (full) {
    out = out.replace(/কালকে/g, 'আগামীকাল');
    for (const place of BN_PLACES) {
      out = out.replace(new RegExp(`(${place})\\s+(যাব|যাবে|যাইবে|যাই|গেল|গেলেন|যাচ্ছি)`, 'g'),
        (_m, p: string, verb: string) => `${p}ে ${verb}`);
    }
    out = out.replace(/(আমি)([^।!?]*?)\s+যাইবে/g, '$1$2 যাব');
    out = out.replace(/(তুমি|আপনি|সে)([^।!?]*?)\s+যাইবে/g, '$1$2 যাবে');
  }
  return out;
}

function offlineCandidate(text: string, language: Exclude<GrammarLanguage, 'auto'>, mode: GrammarVoiceMode): string {
  if (mode === 'exact') return text;
  const full = mode === 'clean' || mode === 'professional';
  const corrected = language === 'bangla' ? correctBangla(text, full) : correctEnglish(text, full);
  return formatWhitespace(corrected, language);
}

/** Fully offline correction — works with the network disabled. */
export function correctOffline(
  text: string,
  language: GrammarLanguage,
  mode: GrammarVoiceMode,
  protectedTerms: readonly string[] = [],
): GrammarResult {
  const resolved = language === 'auto' ? detectLanguage(text) : language;
  return buildResult(text, offlineCandidate(text, resolved, mode), mode, resolved, 'offline', protectedTerms);
}

/**
 * Online correction via the consent-gated provider. The returned Gemini text
 * is NEVER trusted until the fact guard passes; exact mode makes zero calls.
 */
export async function correctWithGemini(
  provider: GeminiProvider,
  ctx: RequestContext,
  text: string,
  language: GrammarLanguage,
  mode: GrammarVoiceMode,
  protectedTerms: readonly string[] = [],
): Promise<Result<GrammarResult>> {
  const resolved = language === 'auto' ? detectLanguage(text) : language;
  if (mode === 'exact') {
    return ok(buildResult(text, text, mode, resolved, 'gemini', protectedTerms));
  }
  const response = await provider.correct({ ctx, text, language: resolved });
  if (!response.ok) return err(response.error);
  if (!factsPreserved(text, response.value, protectedTerms)) return err('fact_guard_rejected');
  return ok(buildResult(text, response.value, mode, resolved, 'gemini', protectedTerms));
}
