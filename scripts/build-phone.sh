#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REFERENCE_TOOLS="$HOME/Documents/coding_file/server_monitor/data/toolchains"
if [[ -z "${ANDROID_HOME:-}" && -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi
if [[ -z "${ANDROID_HOME:-}" && -d "$REFERENCE_TOOLS/android-sdk" ]]; then
  export ANDROID_HOME="$REFERENCE_TOOLS/android-sdk"
fi
if [[ -z "${JAVA_HOME:-}" && -d "$REFERENCE_TOOLS/jdk/Contents/Home" ]]; then
  export JAVA_HOME="$REFERENCE_TOOLS/jdk/Contents/Home"
fi
: "${ANDROID_HOME:?请设置 ANDROID_HOME 为 Android SDK 目录}"
: "${JAVA_HOME:?请设置 JAVA_HOME 为 JDK 17 目录}"
export PATH="$JAVA_HOME/bin:$PATH"
cd "$PROJECT_ROOT/android"
./gradlew --no-daemon testDebugUnitTest assembleDebug assembleDebugAndroidTest
APK="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify "$APK"
mkdir -p "$PROJECT_ROOT/data/releases"
cp "$APK" "$PROJECT_ROOT/data/releases/CareerOS-Companion-0.1.1-debug.apk"
shasum -a 256 "$PROJECT_ROOT/data/releases/CareerOS-Companion-0.1.1-debug.apk"
