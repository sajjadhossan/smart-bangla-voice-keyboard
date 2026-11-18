# Step 16a report — core tests + CI YAML (runnable now)

Status: **PASS**. Shared core is fully testable on this device; all gates green.

## Implemented
- `package.json`:
  - `test` now runs `tests/unit/*.test.ts` **and** `tests/integration/*.test.ts`.
  - `test:coverage` enforces `--test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80`.
- `.github/workflows/core-tests.yml` — runs on `push`, `pull_request`, and
  `workflow_dispatch` on `ubuntu-latest` with Node 22; executes `npm test` then
  the coverage gate. No secrets or platform SDK required.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `npm test` | `ℹ tests 108` · `ℹ suites 0` · `ℹ pass 108` · `ℹ fail 0` · `ℹ duration_ms 2213.693437` |
| 2 | `npm run test:coverage` | `ℹ tests 108` · `ℹ pass 108` · `ℹ fail 0` · `ℹ all files 97.14% lines · 85.80% branches · 92.76% functions` |
| 3 | `actionlint .github/workflows/*.yml` | exit **0** (all workflows) |

Coverage is above 80% on all three axes, so the gate passes with margin. Lowest
per-file figures: `transport.ts` 63.46% lines (real `FetchTransport` is exercised
only via injected fakes in tests), `keyboard-state.ts` 51.52% branches — both
still above the aggregate gate and not blockers.

## actionlint provenance
`actionlint` was not preinstalled. It was downloaded from the official
`rhysd/actionlint` v1.7.7 release page (`linux_arm64`) into the session temp
directory and reported `1.7.7`. All four workflow files lint clean.

## Deviations / limitations
- The GitHub Actions run itself has not executed — the repository is local and
  not pushed. CI green here means lint + local reproduction of the same commands,
  not an observed GitHub run.
- Windows/macOS/Android jobs are `workflow_dispatch`-only (Step 16b).

## Next
Step 16b — guarded platform build jobs; Step 17 — docs + final report.
