/**
 * Speech evaluation primitives: WER, CER and end-of-speech → final-text latency.
 *
 * These are pure functions. They never fabricate results: if no hypothesis and
 * no timing data are supplied, the report fields stay null.
 *
 * Bangla normalization: Unicode NFC, punctuation/diacritic-free word tokens,
 * whitespace collapsed. Latin text is lower-cased so WER/CER are comparable.
 */

const PUNCTUATION = /[\u0964\u0965.,!?;:'"()\[\]{}—–\-_/\\@#$%^&*+=|~`<>]/gu;

export function normalizeText(input: string): string {
  return input.normalize("NFC").replace(PUNCTUATION, " ").replace(/\s+/gu, " ").trim();
}

export function wordTokens(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length === 0 ? [] : normalized.toLowerCase().split(" ");
}

export function charTokens(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length === 0 ? [] : Array.from(normalized.toLowerCase());
}

export interface Alignment {
  substitutions: number;
  deletions: number;
  insertions: number;
  distance: number;
  referenceLength: number;
}

/** Levenshtein alignment over arbitrary tokens, with backtrace for S/D/I counts. */
export function align(reference: readonly string[], hypothesis: readonly string[]): Alignment {
  const n = reference.length;
  const m = hypothesis.length;
  const rows: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) rows[i][0] = i;
  for (let j = 0; j <= m; j += 1) rows[0][j] = j;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = reference[i - 1] === hypothesis[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && rows[i][j] === rows[i - 1][j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1)) {
      if (reference[i - 1] !== hypothesis[j - 1]) substitutions += 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && rows[i][j] === rows[i - 1][j] + 1) {
      deletions += 1;
      i -= 1;
    } else {
      insertions += 1;
      j -= 1;
    }
  }

  return {
    substitutions,
    deletions,
    insertions,
    distance: rows[n][m],
    referenceLength: n,
  };
}

/** Word error rate. Returns null when the reference has no words. */
export function wer(reference: string, hypothesis: string): number | null {
  const a = align(wordTokens(reference), wordTokens(hypothesis));
  return a.referenceLength === 0 ? null : (a.substitutions + a.deletions + a.insertions) / a.referenceLength;
}

/** Character error rate. Returns null when the reference has no characters. */
export function cer(reference: string, hypothesis: string): number | null {
  const a = align(charTokens(reference), charTokens(hypothesis));
  return a.referenceLength === 0 ? null : a.distance / a.referenceLength;
}

export function percentile(sortedValues: readonly number[], fraction: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.min(sortedValues.length - 1, Math.ceil(fraction * sortedValues.length) - 1);
  return sortedValues[Math.max(0, index)];
}

export interface VoiceSample {
  id: string;
  mode: string;
  reference: string;
  /** Real ASR output from a recorded run. Null until an actual run produces it. */
  hypothesis: string | null;
  /** Milliseconds from end-of-speech to final text, measured in a real run. */
  endOfSpeechToFinalMs: number | null;
  audioPath?: string;
}

export interface MetricSummary {
  sampleCount: number;
  evaluatedCount: number;
  wer: number | null;
  cer: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
}

export function summarize(samples: readonly VoiceSample[]): MetricSummary {
  const evaluated = samples.filter(
    (sample): sample is VoiceSample & { hypothesis: string } =>
      sample.hypothesis !== null && sample.hypothesis.length > 0,
  );
  const wers = evaluated.map((s) => wer(s.reference, s.hypothesis)).filter((v): v is number => v !== null);
  const cers = evaluated.map((s) => cer(s.reference, s.hypothesis)).filter((v): v is number => v !== null);
  const latencies = samples
    .map((s) => s.endOfSpeechToFinalMs)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);

  const mean = (values: readonly number[]): number | null =>
    values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    sampleCount: samples.length,
    evaluatedCount: evaluated.length,
    wer: mean(wers),
    cer: mean(cers),
    latencyP50Ms: percentile(latencies, 0.5),
    latencyP95Ms: percentile(latencies, 0.95),
  };
}
