# Toolchain — verified on this device (2026-11-18)

All commands below were executed; results are real, not assumed.

| Component | Version | Status |
|---|---|---|
| Dart SDK | 3.14.1 (android_arm64) | installed via `pkg install dart` |
| Android cmdline-tools | 12.0 | `$HOME/android-sdk/cmdline-tools/latest` |
| Android platform-tools | 37.0.1 | installed |
| Android platform | 35 | installed |
| Android build-tools | 35.0.0 | installed |
| JDK | 21.0.13 | available |
| Gradle | 9.9.1 | system install |
| Android Gradle Plugin | 8.7.3 | resolved from Google Maven |
| Kotlin Android plugin | 2.0.21 | resolved from Maven Central |
| Flutter SDK | — | **not installed**: no official Linux arm64 build; community FlutterArch uses Flutter 3.3.10 + 2021 engine patch and deletes `bin/cache` (Dart SDK). Not needed — IME is native Kotlin. |

## Critical arm64 fix

Google's `build-tools/35.0.0/aapt2` is x86-64 and cannot run on this arm64 host.
Termux ships an arm64 `aapt2`. Every Android build MUST set:

```properties
android.aapt2FromMavenOverride=/data/user/0/com.termux/files/usr/bin/aapt2
```

Also required for Kotlin/Java consistency on JDK 21:

```groovy
kotlinOptions { jvmTarget = '17' }
compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
}
```

## Environment

```sh
. "$HOME/android-env.sh"     # sets ANDROID_HOME, ANDROID_SDK_ROOT, PATH
```

## Smoke-test proof

A minimal native Android app with one Kotlin class was built from scratch:

```
gradle assembleDebug --no-daemon --console=plain
BUILD SUCCESSFUL in 58s   (33 tasks)
app/build/outputs/apk/debug/app-debug.apk  — 794K
apksigner verify --print-certs …  → V2 signed, SHA-256 digest present
```

Therefore Step 11/12 APK builds are **no longer blocked by a missing SDK**.
Windows TSF and macOS InputMethodKit remain **UNVERIFIED** (wrong OS).
