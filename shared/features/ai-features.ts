/**
 * AI special features A–Q. Every id has an executable path: offline rules,
 * a real consent-gated Gemini capability, or an explicit platform command.
 * Nothing here is a decorative stub; platform-only work is marked as such
 * instead of pretending the OS clipboard was touched.
 *
 * Note: Appendix F says "A–Q" but names only 16 features. Q (Sentence
 * Improvement) is taken from brief §03's online feature "sentence improvement"
 * so the full A–Q range is covered without inventing a product capability.
 */
import type { Suggestion } from '../core/types.ts';
import { err, ok, type Result } from '../core/result.ts';
import { detectLanguage, diffText, factsPreserved, type DiffToken, type GrammarLanguage } from '../grammar/grammar.ts';
import type { GeminiProvider, RequestContext } from '../gemini/provider.ts';
import { rewriteOfflineText } from '../rewrite/rewrite.ts';
import { spellingSuggestions, WORD_DICTIONARY } from '../transliteration/dictionary.ts';

export type FeatureId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q';

export type FeatureRoute = 'offline' | 'gemini' | 'platform';

export interface FeatureDescriptor {
  readonly id: FeatureId;
  readonly name: string;
  readonly route: FeatureRoute;
  readonly status: 'implemented' | 'platform_required';
}

export const FEATURE_REGISTRY: readonly FeatureDescriptor[] = Object.freeze([
  { id: 'A', name: 'Summarizer', route: 'gemini', status: 'implemented' },
  { id: 'B', name: 'Expander', route: 'gemini', status: 'implemented' },
  { id: 'C', name: 'Reply Assistant', route: 'gemini', status: 'implemented' },
  { id: 'D', name: 'Vocabulary', route: 'gemini', status: 'implemented' },
  { id: 'E', name: 'Language Detector', route: 'offline', status: 'implemented' },
  { id: 'F', name: 'Formatter', route: 'offline', status: 'implemented' },
  { id: 'G', name: 'Templates', route: 'offline', status: 'implemented' },
  { id: 'H', name: 'Context Suggestions', route: 'gemini', status: 'implemented' },
  { id: 'I', name: 'Next Word', route: 'offline', status: 'implemented' },
  { id: 'J', name: 'Smart Spelling', route: 'offline', status: 'implemented' },
  { id: 'K', name: 'Custom Dictionary / Corrections', route: 'offline', status: 'implemented' },
  { id: 'L', name: 'Clipboard', route: 'platform', status: 'platform_required' },
  { id: 'M', name: 'Voice History', route: 'offline', status: 'implemented' },
  { id: 'N', name: 'Translation History', route: 'offline', status: 'implemented' },
  { id: 'O', name: 'Undo / Redo', route: 'offline', status: 'implemented' },
  { id: 'P', name: 'Original vs Corrected', route: 'offline', status: 'implemented' },
  { id: 'Q', name: 'Sentence Improvement', route: 'gemini', status: 'implemented' },
]);

export interface HistoryEntry {
  readonly kind: 'voice' | 'translation' | 'text';
  readonly text: string;
  readonly atMs: number;
}

export interface FeatureHistoryState {
  readonly entries: readonly HistoryEntry[];
  readonly cursor: number;
}

export function emptyHistory(): FeatureHistoryState {
  return Object.freeze({ entries: Object.freeze([]), cursor: -1 });
}

export function historyAppend(state: FeatureHistoryState, entry: HistoryEntry): FeatureHistoryState {
  const kept = state.entries.slice(0, state.cursor + 1);
  const entries = Object.freeze([...kept, entry]);
  return Object.freeze({ entries, cursor: entries.length - 1 });
}

export function historyUndo(state: FeatureHistoryState): FeatureHistoryState {
  return state.cursor <= 0 ? state : Object.freeze({ ...state, cursor: state.cursor - 1 });
}

export function historyRedo(state: FeatureHistoryState): FeatureHistoryState {
  return state.cursor >= state.entries.length - 1 ? state : Object.freeze({ ...state, cursor: state.cursor + 1 });
}

export interface ClipboardCommand {
  readonly kind: 'copy' | 'cut';
  readonly text: string;
}

export interface FeatureInput {
  readonly provider: GeminiProvider;
  readonly ctx: RequestContext;
  readonly text: string;
  readonly language: GrammarLanguage;
  readonly targetLanguage?: string;
  readonly surroundingText?: string;
  readonly prefix?: string;
  readonly templateId?: string;
  readonly templateVars?: Readonly<Record<string, string>>;
  readonly customDictionary?: Readonly<Record<string, string>>;
  readonly history?: FeatureHistoryState;
  readonly historyEntry?: HistoryEntry;
  readonly redo?: boolean;
  readonly original?: string;
  readonly protectedTerms?: readonly string[];
}

export interface FeatureOutput {
  readonly id: FeatureId;
  readonly output: string;
  readonly source: FeatureRoute;
  readonly suggestions?: readonly Suggestion[];
  readonly diff?: readonly DiffToken[];
  readonly clipboard?: ClipboardCommand;
  readonly history?: FeatureHistoryState;
}

export const TEMPLATES: Readonly<Record<string, string>> = Object.freeze({
  greeting: 'আসসালামু আলাইকুম, {name}। আপনি কেমন আছেন?',
  email_open: 'Dear {name},\n\nI am writing to follow up on {topic}.',
  meeting: 'আজ আমার একটি গুরুত্বপূর্ণ মিটিং আছে।',
});

export function expandTemplate(id: string, vars: Readonly<Record<string, string>> = {}): string {
  const template = TEMPLATES[id];
  if (template === undefined) return '';
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => vars[key] ?? `{${key}}`);
}

/** Offline next-word candidates from Step 4's dictionary — no duplication. */
export function nextWordSuggestions(prefix: string, limit = 3): readonly Suggestion[] {
  const p = prefix.toLowerCase();
  if (p.length === 0) return Object.freeze([]);
  const found: Suggestion[] = [];
  for (const [key, bangla] of Object.entries(WORD_DICTIONARY)) {
    if (key.startsWith(p)) found.push({ text: bangla, source: 'dictionary', score: 1 - Math.abs(key.length - p.length) / 20 });
  }
  return Object.freeze(
    found.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text)).slice(0, limit).map((s) => Object.freeze(s)),
  );
}

function offlineFeature(id: FeatureId, input: FeatureInput): Result<FeatureOutput> {
  switch (id) {
    case 'E':
      return ok({ id, output: detectLanguage(input.text), source: 'offline' });
    case 'F':
      return ok({ id, output: rewriteOfflineText(input.text, 'format_text'), source: 'offline' });
    case 'G': {
      const out = expandTemplate(input.templateId ?? '', input.templateVars ?? {});
      return out.length === 0 ? err('unknown_template') : ok({ id, output: out, source: 'offline' });
    }
    case 'I': {
      const suggestions = nextWordSuggestions(input.prefix ?? '');
      return ok({ id, output: suggestions[0]?.text ?? '', source: 'offline', suggestions });
    }
    case 'J': {
      const token = input.text.trim().split(/\s+/).pop() ?? '';
      const suggestions = spellingSuggestions(token, 3);
      return ok({ id, output: suggestions[0]?.text ?? token, source: 'offline', suggestions });
    }
    case 'K': {
      const dict = input.customDictionary ?? {};
      const out = input.text.split(/(\s+)/).map((token) => dict[token] ?? dict[token.toLowerCase()] ?? token).join('');
      return ok({ id, output: out, source: 'offline' });
    }
    case 'M':
    case 'N':
    case 'O': {
      const history = input.history ?? emptyHistory();
      if (id === 'M' || id === 'N') {
        if (input.historyEntry === undefined) return err('history_entry_required');
        const next = historyAppend(history, input.historyEntry);
        return ok({ id, output: next.entries[next.cursor]?.text ?? '', source: 'offline', history: next });
      }
      const next = input.redo === true ? historyRedo(history) : historyUndo(history);
      return ok({ id, output: next.entries[next.cursor]?.text ?? '', source: 'offline', history: next });
    }
    case 'P': {
      if (input.original === undefined) return err('original_required');
      return ok({
        id, output: input.text, source: 'offline',
        diff: Object.freeze(diffText(input.original, input.text)),
      });
    }
    case 'L':
      return ok({
        id, output: input.text, source: 'platform',
        clipboard: Object.freeze({ kind: 'copy', text: input.text }),
      });
    default:
      return err('unsupported_offline_feature');
  }
}

/** Gemini-backed features. Every call goes through the consent-gated provider. */
async function geminiFeature(id: FeatureId, input: FeatureInput): Promise<Result<FeatureOutput>> {
  const shared = input.ctx;
  let response: Result<string>;
  switch (id) {
    case 'A':
      response = await input.provider.summarize({ ctx: shared, text: input.text, language: input.language });
      break;
    case 'B':
      response = await input.provider.rewrite({
        ctx: shared, text: input.text, language: input.language,
        tone: 'detailed', instruction: 'Expand with relevant detail without inventing facts.',
      });
      break;
    case 'C':
      response = await input.provider.rewrite({
        ctx: shared, text: input.text, language: input.language,
        tone: 'friendly', instruction: 'Write a brief, appropriate reply to the given message.',
      });
      break;
    case 'D':
      response = await input.provider.rewrite({
        ctx: shared, text: input.text, language: input.language,
        tone: 'normal', instruction: 'Suggest clearer, stronger vocabulary without changing facts.',
      });
      break;
    case 'H':
      response = await input.provider.rewrite({
        ctx: shared, text: input.text, language: input.language,
        tone: 'normal', instruction: `Suggest a natural continuation given the preceding text: ${input.surroundingText ?? ''}`,
      });
      break;
    case 'Q':
      response = await input.provider.rewrite({
        ctx: shared, text: input.text, language: input.language,
        tone: 'normal', instruction: 'Improve this sentence: fix grammar, tighten wording, preserve every fact.',
      });
      break;
    default:
      return err('unsupported_gemini_feature');
  }
  if (!response.ok) return err(response.error);
  if (!factsPreserved(input.text, response.value, input.protectedTerms ?? [])) return err('fact_guard_rejected');
  return ok({ id, output: response.value, source: 'gemini' });
}

export async function executeFeature(id: FeatureId, input: FeatureInput): Promise<Result<FeatureOutput>> {
  const descriptor = FEATURE_REGISTRY.find((f) => f.id === id);
  if (descriptor === undefined) return err('unknown_feature');
  if (descriptor.route === 'offline' || descriptor.route === 'platform') return offlineFeature(id, input);
  return geminiFeature(id, input);
}

/** Machine-readable status matrix for the final report. */
export function featureStatusMatrix(): readonly FeatureDescriptor[] {
  return FEATURE_REGISTRY;
}
