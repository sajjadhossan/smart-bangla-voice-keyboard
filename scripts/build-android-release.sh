#!/bin/sh
# Guarded release build. Refuses to run unless every signing secret is present
# in the environment. Never writes a keystore or password into the repository.
# POSIX sh so it runs both in Termux (/bin/sh) and on Linux CI runners.
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ANDROID_DIR="$ROOT_DIR/android"

missing=""
for name in ANDROID_KEYSTORE_FILE ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    missing="$missing $name"
  fi
done

if [ -n "$missing" ]; then
  echo "BLOCKED: release signing secrets are missing:$missing" >&2
  echo "Provide them as environment variables. Do NOT commit them." >&2
  exit 2
fi

if [ ! -f "$ANDROID_KEYSTORE_FILE" ]; then
  echo "BLOCKED: ANDROID_KEYSTORE_FILE does not exist: $ANDROID_KEYSTORE_FILE" >&2
  exit 3
fi

if [ -f "$HOME/android-env.sh" ]; then
  . "$HOME/android-env.sh"
fi

cd "$ANDROID_DIR"
gradle :app:assembleRelease --no-daemon --console=plain

APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK" ]; then
  echo "FAILED: expected release APK was not produced" >&2
  exit 4
fi

bash "$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs "$APK"
echo "RELEASE APK BUILT AND VERIFIED: $APK"
