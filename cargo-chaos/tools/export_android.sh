#!/usr/bin/env bash
# Builds a signed test APK: build/android/CargoChaos.apk
#
# Requirements (once):
#   - Godot 4.7.2 export templates in ~/.local/share/godot/export_templates/4.7.2.stable/
#   - Android SDK build-tools with apksigner, set in Godot's editor settings
#     (export/android/android_sdk_path). On Ubuntu without the full SDK:
#       apt-get install apksigner zipalign
#       mkdir -p $SDK/build-tools/34.0.0 && ln -s /usr/bin/apksigner /usr/bin/zipalign $SDK/build-tools/34.0.0/
#   - A JDK (export/android/java_sdk_path)
#   - A keystore. NEVER commit it. Create one with:
#       keytool -genkeypair -keystore my.keystore -alias cargochaos -keyalg RSA -keysize 2048 -validity 10000
#
# Usage: KEYSTORE=path/to/my.keystore KEY_ALIAS=cargochaos KEY_PASS=secret tools/export_android.sh
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
: "${KEYSTORE:?set KEYSTORE}" "${KEY_ALIAS:?set KEY_ALIAS}" "${KEY_PASS:?set KEY_PASS}"
mkdir -p build/android
GODOT_ANDROID_KEYSTORE_RELEASE_PATH="$KEYSTORE" \
GODOT_ANDROID_KEYSTORE_RELEASE_USER="$KEY_ALIAS" \
GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="$KEY_PASS" \
  "$GODOT" --headless --path . --export-release "Android" build/android/CargoChaos.apk
apksigner verify build/android/CargoChaos.apk && echo "APK OK: build/android/CargoChaos.apk"
