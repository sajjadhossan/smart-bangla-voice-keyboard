# ADR-002: Gemini provider abstraction

- **Status:** Accepted
- **Context:** Exact Gemini model IDs, audio formats and streaming support must be verified before coding, and will change over time. UI must not bind to a model ID.
- **Decision:** All AI calls go through `GeminiProvider` with explicit capability methods (transcribe, translate, correct, rewrite, summarize). Model IDs live in configuration, validated via a real connectivity request.
- **Consequences:**
  - ✅ Model upgrades require config/provider changes only.
  - ✅ Connection state comes from actual HTTP results, never a simulated success.
  - ⚠️ Provider implementations must be written per platform or bridged from the shared core.
