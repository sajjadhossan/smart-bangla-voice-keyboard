# Installation — Smart Bangla Voice Keyboard

## Android (buildable here)
```bash
. "$HOME/android-env.sh"
cd android && gradle assembleDebug --no-daemon --console=plain
bash "$HOME/android-sdk/build-tools/35.0.0/apksigner" verify \
  app/build/outputs/apk/debug/app-debug.apk
```
Install the APK on a device/emulator, then enable it under Settings → Languages & input → On-screen keyboard. Manual scenarios: `docs/android-device-matrix.md` (**UNVERIFIED** here).

Release APK: `scripts/build-android-release.sh` with `ANDROID_KEYSTORE_*` env secrets; keystore never committed.

## Windows 10/11 (source only · UNVERIFIED here)
On a Windows 2022 host with VS + Windows SDK:
```powershell
cmake -S windows -B windows/build -A x64
cmake --build windows/build --config Release
regsvr32 /n /i:user windows\build\Release\SmartBanglaIme.dll
```
Then add it under Settings → Time & language → Keyboard. Or run the guarded `workflow_dispatch` job in `.github/workflows/windows-build.yml`.

## macOS 12+ (source only · UNVERIFIED here)
On a macOS host with Xcode:
```sh
brew install xcodegen
xcodegen generate -s macos/project.yml -p macos
xcodebuild -project macos/SmartBanglaVoiceKeyboard.xcodeproj \
  -scheme SmartBanglaVoiceKeyboard -configuration Release CODE_SIGNING_ALLOWED=NO
```
Copy the `.bundle` to `~/Library/Input Methods/` and enable it in System Settings → Keyboard → Input Sources. Or run `.github/workflows/macos-build.yml`.

No Windows/macOS binary was built or run on this Linux/Termux device.
