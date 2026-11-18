# Gemini API integration

The only network boundary is `shared/gemini/provider.ts`. UI never binds to a model ID or key.

- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`, header `x-goog-api-key`.
- Models (verified in official docs, recorded in `docs/gemini-facts.md`): audio/transcription `gemini-3.5-transcribe`; text/reasoning `gemini-3.6-flash`.
- Transcription uses `generationConfig.audioTranscriptionConfig` with mode `VERBATIM` (exact) or `SMART` (other grammar modes) and optional verified `languageCodes`.
- Translation is a **separate** provider call, never folded into transcription. Modes A/B/E/F never translate.
- API-key lifecycle: save/replace, masked show, remove, offline shape check, and a real connection probe (GET `/models`) that requires an explicit user-confirmed flag plus `allowLiveCheck`.
- 8 connection states derived only from real results: `not_configured`, `connecting`, `connected`, `invalid_api_key`, `quota_exceeded`, `network_error`, `service_unavailable`, `authentication_failed`.
- Timeout, bounded retry with backoff, and rate-limit (429) handling are implemented; no key/audio/text is logged.

No live API key was available here, so no real request was made — tests use an injected fake transport. Config lives in `shared/gemini/config.ts`.
