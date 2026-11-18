# Voice engine

Capture is provider-agnostic and consent-gated (`shared/speech/capture.ts`): mic permission, format negotiation, VAD, silence auto-stop, level/clipping monitoring, buffering, stop/cancel/retry and cleanup, with an 11-state machine.

Modes A–F (`shared/voice/voice-modes.ts`):
- A Bangla speech→Bangla text, B English→English, E Banglish→Bangla, F mixed→mixed — **transcription only**.
- C Bangla→English, D English→Bangla — transcribe first, then a second independent translate call; both use voice consent.
- Manual language override may set the source hint or force `auto` detection; it never changes the mode's translation target.

`executeVoiceMode` returns a `Result` with raw transcript, final inserted text, a `translated` flag and a step audit trail. A failed translation does not silently return the raw transcript.

Metrics (`shared/metrics/speech-metrics.ts`, `scripts/test-wer.ts`): Bangla-normalized WER/CER (NFC, punctuation stripping) and end-of-speech→final-text latency p50/p95. **No real corpus exists yet**, so the harness reports "no evaluated samples" — no WER/CER/latency is claimed.
