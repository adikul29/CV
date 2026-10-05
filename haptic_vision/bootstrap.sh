#!/usr/bin/env bash
# Fills in the parts of a Flutter project that are generated rather than
# written: the Gradle wrapper, the launcher icons, .metadata, and the iOS
# runner. Run once after cloning. Requires the Flutter SDK on PATH.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v flutter >/dev/null 2>&1; then
  echo "flutter not found on PATH. Install the Flutter SDK first." >&2
  exit 1
fi

rm -rf _scaffold
flutter create \
  --org com.example \
  --project-name haptic_vision \
  --platforms=android,ios \
  _scaffold >/dev/null

# Generated files this repo does not track, copied in without touching
# anything hand-written.
cp -r _scaffold/android/gradle android/
cp _scaffold/android/gradlew android/
cp _scaffold/android/gradlew.bat android/
cp -r _scaffold/android/app/src/main/res/mipmap-* android/app/src/main/res/
cp _scaffold/.metadata .
cp -r _scaffold/ios .
rm -rf _scaffold

chmod +x android/gradlew

# Add a key placeholder without touching sdk.dir / flutter.sdk, which the
# Flutter tool writes into this file itself on the first build.
if ! grep -qs '^visionApiKey=' android/local.properties; then
  echo 'visionApiKey=YOUR_API_KEY_HERE' >> android/local.properties
  echo "Added a visionApiKey placeholder to android/local.properties."
fi

flutter pub get

cat <<'MSG'

Done. Next:
  1. Put your key in android/local.properties as visionApiKey=...
  2. flutter run            (Android device or emulator)

iOS is scaffolded so the project builds, but the floating button and screen
capture are Android-only — see the README.
MSG
