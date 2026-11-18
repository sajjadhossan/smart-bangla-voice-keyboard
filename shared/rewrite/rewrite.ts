/**
 * Tone (15) + rewrite actions + accept/reject/undo with a confirmation gate.
 *
 * The session is an immutable reducer: proposing a rewrite NEVER changes the
 * visible text. accept() requires an explicit confirmation unless the caller
 * opts into auto-apply; undo() restores the EXACT previous string. Offline
 * routes (Format text, Make shorter) run deterministic rules and share the
 * Step 8 fact guard, so no route may silently drop names/numbers/dates.
 */
import type { ToneMode } from '../core/types.ts';
import { err, ok, type Result } from '../core/result.ts';
import { factsPreserved, type GrammarLanguage } from '../grammar/grammar.ts';
import type { GeminiProvider, RequestContext } from '../gemini/provider.ts';

export const TONE_MODES: readonly ToneMode[] = Object.freeze([
  'normal', 'professional', 'formal', 'friendly', 'casual', 'polite', 'business',
  'academic', 'creative', 'simple_english', 'simple_bangla', 'concise', 'detailed',
  'confident', 'empathetic',
]);

export const DEFAULT_TONE: ToneMode = 'normal';

export const TONE_INSTRUCTIONS: Readonly<Record<ToneMode, string>> = Object.freeze({
  normal: 'Keep the author’s voice and meaning unchanged.',
  professional: 'Use a clean, professional register.',
  formal: 'Use formal, precise language.',
  friendly: 'Use a warm, friendly voice.',
  casual: 'Use relaxed, everyday language.',
  polite: 'Use courteous, considerate phrasing.',
  business: 'Use concise business language.',
  academic: 'Use an academic, neutral register.',
  creative: 'Use vivid but accurate language.',
  simple_english: 'Use simple English words and short sentences.',
  simple_bangla: 'Use simple Bengali words and short sentences.',
  concise: 'Be brief; remove redundancy without losing facts.',
  detailed: 'Add useful detail without inventing facts.',
  confident: 'Use a confident, assertive voice.',
  empathetic: 'Use a kind, understanding voice.',
});

export type RewriteAction =
  | 'improve_writing'
  | 'fix_grammar'
  | 'fix_spelling'
  | 'rewrite_professionally'
  | 'make_friendly'
  | 'make_formal'
  | 'make_polite'
  | 'make_shorter'
  | 'make_longer'
  | 'simplify'
  | 'improve_clarity'
  | 'improve_vocabulary'
  | 'translate'
  | 'summarize'
  | 'expand'
  | 'format_text';

export type RewriteRoute = 'offline' | 'correct' | 'rewrite' | 'summarize' | 'translate';

export interface RewritePlan {
  readonly action: RewriteAction;
  readonly route: RewriteRoute;
  readonly tone: ToneMode;
  readonly instruction: string;
}

export const REWRITE_ACTIONS: readonly RewriteAction[] = Object.freeze([
  'improve_writing', 'fix_grammar', 'fix_spelling', 'rewrite_professionally',
  'make_friendly', 'make_formal', 'make_polite', 'make_shorter', 'make_longer',
  'simplify', 'improve_clarity', 'improve_vocabulary', 'translate', 'summarize',
  'expand', 'format_text',
]);

const PLANS: Readonly<Record<RewriteAction, RewritePlan>> = Object.freeze({
  improve_writing: { action: 'improve_writing', route: 'rewrite', tone: 'normal', instruction: 'Improve flow, clarity and correctness while preserving every fact.' },
  fix_grammar: { action: 'fix_grammar', route: 'correct', tone: 'normal', instruction: 'Fix grammar only.' },
  fix_spelling: { action: 'fix_spelling', route: 'correct', tone: 'normal', instruction: 'Fix spelling only.' },
  rewrite_professionally: { action: 'rewrite_professionally', route: 'rewrite', tone: 'professional', instruction: TONE_INSTRUCTIONS.professional },
  make_friendly: { action: 'make_friendly', route: 'rewrite', tone: 'friendly', instruction: TONE_INSTRUCTIONS.friendly },
  make_formal: { action: 'make_formal', route: 'rewrite', tone: 'formal', instruction: TONE_INSTRUCTIONS.formal },
  make_polite: { action: 'make_polite', route: 'rewrite', tone: 'polite', instruction: TONE_INSTRUCTIONS.polite },
  make_shorter: { action: 'make_shorter', route: 'offline', tone: 'concise', instruction: 'Remove filler words; keep every fact.' },
  make_longer: { action: 'make_longer', route: 'rewrite', tone: 'detailed', instruction: TONE_INSTRUCTIONS.detailed },
  simplify: { action: 'simplify', route: 'rewrite', tone: 'simple_english', instruction: 'Use simpler words and shorter sentences.' },
  improve_clarity: { action: 'improve_clarity', route: 'rewrite', tone: 'normal', instruction: 'Improve clarity without changing meaning.' },
  improve_vocabulary: { action: 'improve_vocabulary', route: 'rewrite', tone: 'normal', instruction: 'Improve word choice without changing facts.' },
  translate: { action: 'translate', route: 'translate', tone: 'normal', instruction: 'Translate to the requested language.' },
  summarize: { action: 'summarize', route: 'summarize', tone: 'normal', instruction: 'Summarize without changing facts.' },
  expand: { action: 'expand', route: 'rewrite', tone: 'detailed', instruction: 'Expand with relevant detail without inventing facts.' },
  format_text: { action: 'format_text', route: 'offline', tone: 'normal', instruction: 'Normalize whitespace and punctuation only.' },
});

export function planRewrite(action: RewriteAction, overrides?: Partial<RewritePlan>): RewritePlan {
  const base = PLANS[action];
  return overrides === undefined ? base : Object.freeze({ ...base, ...overrides });
}

/** Deterministic offline routes — no network, no AI. */
export function rewriteOfflineText(text: string, action: RewriteAction): string {
  let out = text;
  if (action === 'make_shorter') {
    out = out.replace(/\b(?:actually|basically|literally|really|just|you know|I mean|kind of|sort of)\b,?\s*/gi, '');
  }
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,!?;:।])/g, '$1')
    .replace(/([,.!?])(?=[A-Za-z])/g, '$1 ')
    .trim();
}

export type RewriteStatus = 'idle' | 'pending' | 'applied' | 'rejected';

export interface RewriteState {
  readonly original: string;
  readonly current: string;
  readonly pending: string | null;
  readonly history: readonly string[];
  readonly status: RewriteStatus;
}

export function initialRewriteState(text: string): RewriteState {
  return Object.freeze({ original: text, current: text, pending: null, history: Object.freeze([]), status: 'idle' });
}

/** Propose only — visible text is untouched until accept(). */
export function proposeRewrite(state: RewriteState, candidate: string): RewriteState {
  if (candidate === state.current) {
    return Object.freeze({ ...state, pending: null, status: 'idle' });
  }
  return Object.freeze({ ...state, pending: candidate, status: 'pending' });
}

export function acceptRewrite(state: RewriteState, confirm: boolean, autoApply: boolean): Result<RewriteState> {
  if (state.pending === null) return err('nothing_to_accept');
  if (!confirm && !autoApply) return err('confirmation_required');
  return ok(Object.freeze({
    original: state.original,
    current: state.pending,
    pending: null,
    history: Object.freeze([...state.history, state.current]),
    status: 'applied',
  }));
}

export function rejectRewrite(state: RewriteState): RewriteState {
  return Object.freeze({ ...state, pending: null, status: 'rejected' });
}

export function undoRewrite(state: RewriteState): Result<RewriteState> {
  if (state.history.length === 0) return err('nothing_to_undo');
  const previous = state.history[state.history.length - 1];
  return ok(Object.freeze({
    original: state.original,
    current: previous,
    pending: null,
    history: Object.freeze(state.history.slice(0, -1)),
    status: 'applied',
  }));
}

export interface ExecuteRewriteInput {
  readonly ctx: RequestContext;
  readonly action: RewriteAction;
  readonly text: string;
  readonly language: GrammarLanguage;
  readonly targetLanguage?: string;
  readonly protectedTerms?: readonly string[];
  readonly toneOverride?: ToneMode;
}

export interface RewriteOutcome {
  readonly state: RewriteState;
  readonly source: 'offline' | 'gemini';
  readonly plan: RewritePlan;
}

/**
 * Route the action, run the fact guard, and PROPOSE the result. The caller
 * must still call acceptRewrite() with confirmation before text is replaced.
 */
export async function executeRewrite(
  provider: GeminiProvider,
  session: RewriteState,
  input: ExecuteRewriteInput,
): Promise<Result<RewriteOutcome>> {
  const plan = planRewrite(input.action, input.toneOverride === undefined ? undefined : { tone: input.toneOverride });
  const protectedTerms = input.protectedTerms ?? [];
  let candidate: string;
  let source: RewriteOutcome['source'];

  if (plan.route === 'offline') {
    candidate = rewriteOfflineText(input.text, input.action);
    source = 'offline';
  } else {
    let response: Result<string>;
    if (plan.route === 'correct') {
      response = await provider.correct({ ctx: input.ctx, text: input.text, language: input.language });
    } else if (plan.route === 'rewrite') {
      response = await provider.rewrite({
        ctx: input.ctx, text: input.text, language: input.language,
        tone: plan.tone, instruction: plan.instruction,
      });
    } else if (plan.route === 'summarize') {
      response = await provider.summarize({ ctx: input.ctx, text: input.text, language: input.language });
    } else {
      if (input.targetLanguage === undefined) return err('target_language_required');
      response = await provider.translate({
        ctx: input.ctx, text: input.text,
        targetLanguage: input.targetLanguage, source: 'text',
      });
    }
    if (!response.ok) return err(response.error);
    candidate = response.value;
    source = 'gemini';
  }

  if (!factsPreserved(input.text, candidate, protectedTerms)) return err('fact_guard_rejected');
  return ok(Object.freeze({ state: proposeRewrite(session, candidate), source, plan }));
}
