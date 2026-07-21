#!/usr/bin/env bash
set -euo pipefail

APP_NAME="OverKnight"
BUNDLE_ID="com.onuniverse.overknight"
TEAM_ID="689EBRXYRX"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/build/ios"
KEYCHAIN_PATH="$BUILD_DIR/overknight-signing.keychain-db"
KEYCHAIN_PASSWORD="$(uuidgen)"
ASC_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_API_KEY_ID}.p8"
P12_PATH="$BUILD_DIR/ios_distribution.p12"
PROFILE_PATH="$BUILD_DIR/profile.mobileprovision"
PROFILE_PLIST="$BUILD_DIR/profile.plist"
EXPORT_OPTIONS="$BUILD_DIR/ExportOptions.plist"
ARCHIVE_PATH="$BUILD_DIR/${APP_NAME}.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

decode_base64() {
  local value="$1"
  local output="$2"
  if ! printf '%s' "$value" | base64 --decode > "$output" 2>/dev/null; then
    printf '%s' "$value" | base64 -D > "$output"
  fi
}

require_env ASC_API_KEY_ID
require_env ASC_API_KEY_ISSUER_ID
require_env ASC_API_KEY_BASE64
require_env IOS_DIST_P12_BASE64
require_env IOS_DIST_P12_PASSWORD
require_env IOS_PROVISIONING_PROFILE_BASE64

rm -rf "$BUILD_DIR" "$ROOT/ios"
mkdir -p "$BUILD_DIR" "$HOME/.appstoreconnect/private_keys" "$HOME/Library/MobileDevice/Provisioning Profiles"

decode_base64 "$ASC_API_KEY_BASE64" "$ASC_KEY_PATH"
decode_base64 "$IOS_DIST_P12_BASE64" "$P12_PATH"
decode_base64 "$IOS_PROVISIONING_PROFILE_BASE64" "$PROFILE_PATH"
chmod 600 "$ASC_KEY_PATH" "$P12_PATH" "$PROFILE_PATH"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$P12_PATH" -k "$KEYCHAIN_PATH" -P "$IOS_DIST_P12_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security list-keychains -d user -s "$KEYCHAIN_PATH" $(security list-keychains -d user | sed 's/[ "]//g')

security cms -D -i "$PROFILE_PATH" > "$PROFILE_PLIST"
PROFILE_UUID="$(/usr/libexec/PlistBuddy -c 'Print UUID' "$PROFILE_PLIST")"
PROFILE_NAME="$(/usr/libexec/PlistBuddy -c 'Print Name' "$PROFILE_PLIST")"
cp "$PROFILE_PATH" "$HOME/Library/MobileDevice/Provisioning Profiles/${PROFILE_UUID}.mobileprovision"

cd "$ROOT"
npx expo prebuild --platform ios --clean

cd "$ROOT/ios"
pod install

cat > "$EXPORT_OPTIONS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${BUNDLE_ID}</key>
    <string>${PROFILE_NAME}</string>
  </dict>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
</dict>
</plist>
PLIST

xcodebuild \
  -workspace "$ROOT/ios/${APP_NAME}.xcworkspace" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" \
  clean archive

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS"

IPA_PATH="$(find "$EXPORT_PATH" -name '*.ipa' -print -quit)"
if [[ -z "$IPA_PATH" ]]; then
  echo "No IPA was exported." >&2
  exit 1
fi

xcrun altool \
  --upload-app \
  --type ios \
  --file "$IPA_PATH" \
  --apiKey "$ASC_API_KEY_ID" \
  --apiIssuer "$ASC_API_KEY_ISSUER_ID"
