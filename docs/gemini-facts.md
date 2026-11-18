# Gemini API facts — verified from official docs (2026-11-18)

Sources (both fetched and read directly):
- https://ai.google.dev/gemini-api/docs/generate-content/transcribe
- https://ai.google.dev/gemini-api/docs/transcribe
- https://ai.google.dev/gemini-api/docs/models

Nothing in this file is guessed. All identifiers below appear verbatim in the official docs.

## Which transcription endpoint we use

Google documents **two** official unary transcription surfaces:

| Surface | Endpoint | Config field | Response text |
|---|---|---|---|
| **generateContent (our choice)** | `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent` | `generationConfig.audioTranscriptionConfig` | `candidates[0].content.parts[0].audioTranscription.text` |
| Interactions API (alternative) | `POST https://generativelanguage.googleapis.com/v1beta/interactions` | `generation_config.transcription_config` | `output_text` (or `steps[0].content[0].text`) |

We use **generateContent** because it matches the text endpoint shape already used for translate/correct/rewrite/summarize, keeping one client path. The Interactions API is a documented alternative for a future migration; we do not mix the two in one request.

## Audio / transcription (generateContent path)

| Fact | Verified value |
|---|---|
| Unary transcription model | `gemini-3.5-transcribe` |
| Streaming transcription model | `gemini-3.5-transcribe-live` (Live API) |
| REST endpoint | `.../v1beta/models/gemini-3.5-transcribe:generateContent` |
| API key header | `x-goog-api-key: $GEMINI_API_KEY` |
| API version | `v1beta` |
| Audio input part | `contents[0].parts[0].inlineData = { mimeType, data(base64) }` (inline base64 is supported) |
| File input part | `fileData = { fileUri, mimeType }` after Files API upload |
| Bengali locales | `bn-BD` (Bangladesh), `bn-IN` (India) |
| English locales | `en-US`, `en-GB`, `en-IN` |
| Auto language detection | omit `languageCodes` or pass `[]`; handles code-switching |
| Exact/verbatim mode | `mode: "VERBATIM"` (default) — preserves fillers, repetitions, false starts |
| Cleaned mode | `mode: "SMART"` — disfluency removal, punctuation, capitalization, voice editing |
| Config object | `generationConfig.audioTranscriptionConfig` |
| Config fields | `languageCodes`, `customVocabulary` (≤1000), `wordTimestamp` (bool), `diarization` (bool, ≤8 speakers), `mode` (`VERBATIM`/`SMART`), `sourceText` (≤64 KiB, SMART only) |
| Incompatibility | `SMART` cannot be combined with `wordTimestamp` or `diarization`; `customVocabulary` cannot be combined with either |
| Response text | `candidates[0].content.parts[0].audioTranscription.text` (or `response.text` with timestamps/diarization) |
| Limits | Unary ≤1 hour; ≤30 min with timestamps/diarization; inline base64 or Files API / signed URLs |
| Supported MIME | `audio/wav`, `audio/mp3`, `audio/aiff`, `audio/aac`, `audio/ogg`, `audio/flac`, `audio/mpeg`, `audio/m4a`, `audio/l16`, `audio/opus`, `audio/alaw`, `audio/mulaw`, `audio/webm` |

Verified REST request shape used by the provider:

```json
{
  "contents": [{
    "parts": [{ "inlineData": { "mimeType": "audio/wav", "data": "<base64>" } }]
  }],
  "generationConfig": {
    "audioTranscriptionConfig": {
      "mode": "VERBATIM",
      "languageCodes": ["bn-BD"]
    }
  }
}
```

## Text / reasoning (translation, grammar, tone, rewrite, summaries)

| Model ID | Status | Use |
|---|---|---|
| `gemini-3.6-flash` | Stable | default text model — balanced speed/quality |
| `gemini-3.5-flash-lite` | Stable | high-throughput, low-cost short requests |
| `gemini-4-hydrogen` | Current generation | optional upgrade for demanding tasks |

Text endpoint pattern: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`.
REST body: `{ "contents": [{ "parts": [{ "text": "..." }] }] }`.

**Deprecated — do not use:** `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite-preview` (shut down), `gemini-2.0-flash` (shut down).

## Product decisions derived from these facts

1. Voice modes A/B (exact transcription) use `gemini-3.5-transcribe` with `mode: "VERBATIM"` — no silent grammar cleanup. Enforced in `audioTranscriptionConfig`, not via a prompt.
2. Grammar modes smart/clean/professional map to `mode: "SMART"`.
3. Voice modes C/D (translation) transcribe first with VERBATIM, then translate with the text model in a **separate** request — exact mode never auto-translates.
4. Language hints: `bn-BD`, `bn-IN`, `en-US`, `en-GB` — all verified supported.
5. Model IDs are configuration, never hardcoded in UI (invariant #5).
6. Pricing/quotas were not needed for the client contract; verify at https://ai.google.dev/gemini-api/docs/pricing before enabling paid features in production.

## Live connection test

A real connection test must issue an actual HTTPS request with the configured key.
No "connected" state may be derived from a regex on the key or from local state.
The live probe (`GET /v1beta/models`, which sends no user content) requires both
an explicit user-confirmed flag and `config.allowLiveCheck === true`.
