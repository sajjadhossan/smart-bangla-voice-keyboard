# Contributing

Thanks for helping improve **Smart Bangla Voice Keyboard / স্মার্ট বাংলা ভয়েস কীবোর্ড**.

## Ground rules
1. Offline typing must never depend on Gemini or the network.
2. Never commit API keys, `.env`, keystores, or signing material.
3. Never fabricate test results, build artifacts, or model support claims.
4. Keep shared business logic platform-neutral; platform code stays in `android/`, `windows/`, `macos/`.
5. All public data must be immutable — return new objects, never mutate inputs.

## Development
```bash
npm test
```
Tests run directly on Node 22.6+ with native TypeScript stripping; no compiler install required.

## Commit style
`<type>: <description>` — e.g. `feat: add Bangla QWERTY layout`.

## Reporting issues
Include platform, OS version, keyboard state (language/layout), and whether online features were involved. Do not paste API keys or personal text.
