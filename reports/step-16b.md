# Step 16b report — guarded platform build jobs

Status: **UNVERIFIED ON THIS DEVICE** (by design). Jobs exist and lint clean;
none was executed here because there is no Windows/macOS host and the Android
runner path belongs to GitHub Actions. No build artifact or CI result is
fabricated.

## Workflows (all `workflow_dispatch`-only, correct runners)
| File | Runner | Purpose | Local status |
|---|---|---|---|
| `.github/workflows/android-build.yml` | `ubuntu-latest` | JDK 17 + SDK 35 + `gradle assembleDebug` + `apksigner verify` + artifact upload | UNVERIFIED (CI-only) |
| `.github/workflows/windows-build.yml` | `windows-2022` | CMake + MSVC build of TSF DLL + artifact check | UNVERIFIED (no Windows host) |
| `.github/workflows/macos-build.yml` | `macos-14` | XcodeGen + `xcodebuild` of IMK bundle + check | UNVERIFIED (no macOS host) |

Android release signing is deliberately absent from CI — it requires
`ANDROID_KEYSTORE_*` secrets and a user-supplied keystore; the local
`scripts/build-android-release.sh` remains the fail-closed gate.

## Verify commands & exact output
| # | Command | Result |
|---|---|---|
| 1 | `actionlint .github/workflows/*.yml` | exit **0** (all four workflows, including platform jobs) |
| 2 | GitHub Actions run result | **NOT AVAILABLE** — repo not pushed; no run observed |

## Evidence boundary
The only Windows/macOS "build" evidence that could exist is a real GitHub
Actions run. Until that run is triggered and observed, both platforms stay
**UNVERIFIED**. The local, real Android debug APK from Step 12
(`android/app/build/outputs/apk/debug/app-debug.apk`, verified with `apksigner`)
is separate from this CI job and remains the only actual binary built here.

## Next
Step 17 — documentation, status matrix, final report (depends on 16a only).
