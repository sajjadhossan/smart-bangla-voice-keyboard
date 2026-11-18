/**
 * WER/CER/latency harness. Reads a corpus manifest and prints real measurements.
 *
 * Usage:
 *   npm run test:wer -- --fixtures tests/fixtures/voice/v1
 *
 * Honesty rule: samples without a hypothesis or timing are counted but never
 * scored. When nothing has been evaluated the tool prints "NO EVALUATED SAMPLES"
 * and exits 0 — it does not invent numbers.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceSample } from "../shared/metrics/speech-metrics.ts";
import { summarize } from "../shared/metrics/speech-metrics.ts";

function fixtureDir(argv: readonly string[]): string {
  const index = argv.indexOf("--fixtures");
  return index >= 0 && argv[index + 1] ? argv[index + 1] : "tests/fixtures/voice/v1";
}

const dir = fixtureDir(process.argv.slice(2));
const manifestPath = join(dir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  version?: string;
  samples?: VoiceSample[];
};

if (!Array.isArray(manifest.samples)) {
  console.error(`Invalid manifest: ${manifestPath} — expected a "samples" array.`);
  process.exit(1);
}

const samples = manifest.samples;
const overall = summarize(samples);

console.log(`Voice corpus: ${manifestPath} (schema ${manifest.version ?? "unversioned"})`);
console.log(`Samples: ${overall.sampleCount} · scored: ${overall.evaluatedCount}`);

if (overall.evaluatedCount === 0) {
  console.log("NO EVALUATED SAMPLES — WER/CER/latency unavailable. Record real audio, run the engine, then fill in hypothesis/timing fields.");
  process.exit(0);
}

const pct = (value: number | null): string => (value === null ? "n/a" : `${(value * 100).toFixed(2)}%`);
const ms = (value: number | null): string => (value === null ? "n/a" : `${value.toFixed(1)} ms`);

const byMode = new Map<string, VoiceSample[]>();
for (const sample of samples) {
  const mode = byMode.get(sample.mode) ?? [];
  mode.push(sample);
  byMode.set(sample.mode, mode);
}

console.log("");
console.log("| Scope | n | WER | CER | p50 | p95 |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const [mode, group] of [...byMode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const m = summarize(group);
  console.log(`| ${mode} | ${m.evaluatedCount}/${m.sampleCount} | ${pct(m.wer)} | ${pct(m.cer)} | ${ms(m.latencyP50Ms)} | ${ms(m.latencyP95Ms)} |`);
}
console.log(`| overall | ${overall.evaluatedCount}/${overall.sampleCount} | ${pct(overall.wer)} | ${pct(overall.cer)} | ${ms(overall.latencyP50Ms)} | ${ms(overall.latencyP95Ms)} |`);
