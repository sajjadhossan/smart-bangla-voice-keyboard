import assert from "node:assert/strict";
import test from "node:test";
import {
  align,
  cer,
  normalizeText,
  percentile,
  summarize,
  wer,
  type VoiceSample,
} from "../../shared/metrics/speech-metrics.ts";

// Algorithm-level tests only. These strings verify the metric implementation;
// they are NOT product WER/CER results and are never reported as such.

test("normalizeText applies NFC and strips Bengali/Latin punctuation", () => {
  assert.equal(normalizeText("আমি, বাংলাদেশে   থাকি।"), "আমি বাংলাদেশে থাকি");
  assert.equal(normalizeText("Hello, world!"), "Hello world");
});

test("align counts substitutions, deletions and insertions", () => {
  const result = align(["a", "b", "c"], ["a", "x", "c", "d"]);
  assert.equal(result.distance, 2);
  assert.equal(result.substitutions, 1);
  assert.equal(result.insertions, 1);
  assert.equal(result.deletions, 0);
});

test("WER and CER are zero for an identical transcript", () => {
  const reference = "আমি বাংলাদেশে থাকি।";
  assert.equal(wer(reference, reference), 0);
  assert.equal(cer(reference, reference), 0);
});

test("WER is computed over normalized tokens", () => {
  // 3 reference words; 1 substitution => 1/3.
  assert.equal(wer("আমি বাংলাদেশে থাকি।", "আমি বাংলাদেশে ছিলাম।"), 1 / 3);
});

test("percentile picks nearest-rank values", () => {
  const values = [10, 20, 30, 40, 50];
  assert.equal(percentile(values, 0.5), 30);
  assert.equal(percentile(values, 0.95), 50);
  assert.equal(percentile([], 0.5), null);
});

test("summarize leaves metrics null when no real run data exists", () => {
  const samples: VoiceSample[] = [
    { id: "A-001", mode: "A", reference: "আমি বাংলাদেশে থাকি।", hypothesis: null, endOfSpeechToFinalMs: null },
  ];
  const report = summarize(samples);
  assert.equal(report.sampleCount, 1);
  assert.equal(report.evaluatedCount, 0);
  assert.equal(report.wer, null);
  assert.equal(report.cer, null);
  assert.equal(report.latencyP50Ms, null);
  assert.equal(report.latencyP95Ms, null);
});

test("summarize reports measured latency and scores only when supplied", () => {
  const samples: VoiceSample[] = [
    { id: "A-001", mode: "A", reference: "আমি বাংলাদেশে থাকি।", hypothesis: "আমি বাংলাদেশে থাকি।", endOfSpeechToFinalMs: 120 },
    { id: "A-002", mode: "A", reference: "I live in Bangladesh.", hypothesis: "I live in Bangladesh.", endOfSpeechToFinalMs: 240 },
  ];
  const report = summarize(samples);
  assert.equal(report.evaluatedCount, 2);
  assert.equal(report.wer, 0);
  assert.equal(report.cer, 0);
  assert.equal(report.latencyP50Ms, 120); // nearest-rank of [120, 240]
  assert.equal(report.latencyP95Ms, 240);
});
