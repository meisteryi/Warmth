#!/bin/bash
set -e

SIM_ID="3758ADDB-2B92-4281-8E41-76B2EE11DE86"
echo "📦 1. Syncing Capacitor iOS..."
npx cap sync ios

echo "🔨 2. Building native App..."
xcodebuild -project ios/App/App.xcodeproj -scheme App -destination "id=$SIM_ID" -configuration Debug -derivedDataPath ios/build build

echo "📲 3. Installing App to Simulator..."
xcrun simctl install "$SIM_ID" ios/build/Build/Products/Debug-iphonesimulator/App.app

echo "🚀 4. Launching Warmth App on Simulator..."
xcrun simctl launch "$SIM_ID" com.warmth.app

echo "✅ App launched successfully on iOS Simulator!"
