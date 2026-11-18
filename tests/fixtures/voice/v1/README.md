# Voice corpus v1

This directory holds **real** recorded audio and reference transcripts for voice modes A–F.

## Adding a sample

1. Record audio on-device (or use a vendor sample with a redistributable license). Place it here.
2. Add an entry to `manifest.json`:

```json
{
  "id": "A-001",
  "mode": "A",
  "audioPath": "A-001.wav",
  "reference": "আমি বাংলাদেশে থাকি।",
  "hypothesis": null,
  "endOfSpeechToFinalMs": null
}
```

3. Run the real engine, then fill `hypothesis` with the exact returned text and
   `endOfSpeechToFinalMs` with the measured time from end-of-speech to final text.
4. Run `npm run test:wer -- --fixtures tests/fixtures/voice/v1`.

Until step 3 is done with real audio, `hypothesis` stays `null` and the harness
prints `NO EVALUATED SAMPLES` instead of a fabricated score.

## Modes

A Bangla→Bangla · B English→English · C Bangla→English · D English→Bangla ·
E Banglish→Bangla · F mixed→mixed.
