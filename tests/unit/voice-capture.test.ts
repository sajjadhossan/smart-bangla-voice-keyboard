import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { grantConsent, NO_CONSENT } from '../../shared/core/consent.ts';
import { isOk } from '../../shared/core/result.ts';
import type { VoiceState } from '../../shared/core/types.ts';
import {
  classifyLevel,
  INITIAL_VAD_STATE,
  VoiceCaptureController,
  updateVad,
  type AudioCaptureDevice,
  type AudioFormat,
  type CaptureLevel,
  type VadConfig,
} from '../../shared/speech/capture.ts';
import { ALL_VOICE_STATES, nextVoiceState } from '../../shared/speech/voice-state.ts';

const VAD: VadConfig = Object.freeze({ threshold: 0.1, hangoverMs: 500, minSpeechMs: 200 });

class FakeDevice implements AudioCaptureDevice {
  format: AudioFormat = Object.freeze({
    mimeType: 'audio/wav', sampleRateHz: 16_000, channels: 1, encoding: 'pcm16',
  });
  permission = true;
  startCalls = 0;
  stopCalls = 0;
  cancelCalls = 0;
  cleanupCalls = 0;
  private readonly bytes = new Uint8Array([1, 2, 3]);

  async requestPermission(): Promise<boolean> {
    return this.permission;
  }
  async start(): Promise<void> {
    this.startCalls += 1;
  }
  async stop(): Promise<Uint8Array> {
    this.stopCalls += 1;
    return this.bytes;
  }
  async cancel(): Promise<void> {
    this.cancelCalls += 1;
  }
  async level(): Promise<CaptureLevel | null> {
    return null;
  }
  async cleanup(): Promise<void> {
    this.cleanupCalls += 1;
  }
}

function controller(): { device: FakeDevice; capture: VoiceCaptureController } {
  const device = new FakeDevice();
  return {
    device,
    capture: new VoiceCaptureController({ device, vad: VAD }),
  };
}

test('all 11 voice states are reachable through valid transitions', () => {
  const visited = new Set<VoiceState>();
  const path: Array<[VoiceState, Parameters<typeof nextVoiceState>[1], VoiceState]> = [
    ['IDLE', { type: 'START' }, 'LISTENING'],
    ['LISTENING', { type: 'CAPTURED' }, 'PROCESSING'],
    ['PROCESSING', { type: 'TRANSCRIBE' }, 'TRANSCRIBING'],
    ['TRANSCRIBING', { type: 'TRANSCRIBED' }, 'CORRECTING'],
    ['CORRECTING', { type: 'CORRECTED' }, 'TRANSLATING'],
    ['TRANSLATING', { type: 'TRANSLATED' }, 'RESULT_READY'],
    ['RESULT_READY', { type: 'INSERT' }, 'INSERTING'],
    ['INSERTING', { type: 'INSERTED' }, 'COMPLETED'],
    ['COMPLETED', { type: 'RESET' }, 'IDLE'],
    ['LISTENING', { type: 'ERROR' }, 'ERROR'],
    ['LISTENING', { type: 'CANCEL' }, 'CANCELLED'],
  ];
  for (const [from, event, expected] of path) {
    visited.add(from);
    visited.add(expected);
    assert.equal(nextVoiceState(from, event), expected, `${from} + ${event.type}`);
  }
  assert.equal(visited.size, 11);
  assert.deepEqual([...visited].sort(), [...ALL_VOICE_STATES].sort());
});

test('invalid transition is a no-op (state stays put)', () => {
  assert.equal(nextVoiceState('IDLE', { type: 'CAPTURED' }), 'IDLE');
  assert.equal(nextVoiceState('COMPLETED', { type: 'START' }), 'COMPLETED');
});

test('VAD detects speech start and end-of-speech after hangover', () => {
  const a = updateVad(INITIAL_VAD_STATE, 0, 0, VAD);
  assert.equal(a.event, 'none');

  const b = updateVad(a.state, 0.5, 100, VAD);
  assert.equal(b.event, 'speech_started');

  const c = updateVad(b.state, 0.5, 300, VAD);
  assert.equal(c.event, 'none');

  const d = updateVad(c.state, 0, 600, VAD);
  assert.equal(d.event, 'none'); // 600-300=300 < hangover 500

  const e = updateVad(d.state, 0, 800, VAD);
  assert.equal(e.event, 'end_of_speech'); // 800-300=500, duration 200 >= 200
});

test('VAD ignores too-short bursts and resets hangover on new speech', () => {
  const started = updateVad(INITIAL_VAD_STATE, 0.5, 100, VAD);
  const short = updateVad(started.state, 0, 700, VAD); // duration 0 < 200
  assert.equal(short.event, 'none');
  assert.equal(short.state.speaking, false);

  const again = updateVad(INITIAL_VAD_STATE, 0.5, 1000, VAD);
  const held = updateVad(again.state, 0, 1200, VAD);
  const renewed = updateVad(held.state, 0.5, 1400, VAD); // new speech resets lastSpeech
  assert.equal(renewed.state.lastSpeechAtMs, 1400);
  const end = updateVad(renewed.state, 0, 1900, VAD);
  assert.equal(end.event, 'end_of_speech');
});

test('level monitor distinguishes silence / ok / loud / clipping', () => {
  assert.equal(classifyLevel({ rms: 0, peak: 0, timestampMs: 0 }, 0.1), 'silence');
  assert.equal(classifyLevel({ rms: 0.05, peak: 0.2, timestampMs: 0 }, 0.1), 'ok');
  assert.equal(classifyLevel({ rms: 0.3, peak: 0.6, timestampMs: 0 }, 0.1), 'loud');
  assert.equal(classifyLevel({ rms: 0.8, peak: 0.995, timestampMs: 0 }, 0.1), 'clipping');
});

test('NO CONSENT ⇒ no permission request, no device start, stays IDLE', async () => {
  const { device, capture } = controller();
  const result = await capture.start(NO_CONSENT);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'consent_denied');
  assert.equal(device.startCalls, 0);
  assert.equal(capture.state, 'IDLE');
});

test('granted consent: start → LISTENING, stop → PROCESSING with real bytes', async () => {
  const { device, capture } = controller();
  const consent = grantConsent('voice', 1);
  const started = await capture.start(consent);
  assert.equal(isOk(started), true);
  assert.equal(capture.state, 'LISTENING');
  assert.equal(device.startCalls, 1);

  const e1 = await capture.onLevel({ rms: 0.5, peak: 0.6, timestampMs: 100 });
  assert.equal(e1, 'speech_started');
  const eMid = await capture.onLevel({ rms: 0.5, peak: 0.6, timestampMs: 300 });
  assert.equal(eMid, 'none'); // establish 200 ms of speech for minSpeechMs
  const e2 = await capture.onLevel({ rms: 0, peak: 0, timestampMs: 800 });
  assert.equal(e2, 'end_of_speech');

  const stopped = await capture.stop();
  assert.equal(isOk(stopped), true);
  if (isOk(stopped)) assert.deepEqual([...stopped.value], [1, 2, 3]);
  assert.equal(capture.state, 'PROCESSING');
  assert.equal(device.stopCalls, 1);
});

test('permission denial ⇒ ERROR; cancel ⇒ CANCELLED; reset ⇒ IDLE + cleanup', async () => {
  const a = controller();
  a.device.permission = false;
  const denied = await a.capture.start(grantConsent('voice', 1));
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, 'permission_denied');
  assert.equal(a.capture.state, 'ERROR');

  const b = controller();
  await b.capture.start(grantConsent('voice', 1));
  await b.capture.cancel();
  assert.equal(b.capture.state, 'CANCELLED');
  assert.equal(b.device.cancelCalls, 1);
  await b.capture.reset();
  assert.equal(b.capture.state, 'IDLE');
  assert.equal(b.device.cleanupCalls, 1);
});

test('capture module has no upload path (no Gemini/fetch import)', () => {
  const source = readFileSync(new URL('../../shared/speech/capture.ts', import.meta.url), 'utf8');
  assert.equal(/from\s+['"][^'"]*gemini|require\s*\([^)]*gemini|fetch\s*\(|https?:\/\//i.test(source), false);
});
