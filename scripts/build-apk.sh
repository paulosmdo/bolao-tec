#!/usr/bin/env bash
# Gera o APK Android: export estático do Next -> Capacitor sync -> Gradle.
# A rota /api/lotofacil é server-side e não existe no APK (o app nativo chama
# a API direto via CapacitorHttp), então ela sai de cena durante o export.
set -euo pipefail
cd "$(dirname "$0")/.."

API_DIR="src/app/api"
API_HOLD=".api-hold"

restore_api() {
  if [ -d "$API_HOLD" ]; then
    rm -rf "$API_DIR"
    mv "$API_HOLD" "$API_DIR"
  fi
}
trap restore_api EXIT

mv "$API_DIR" "$API_HOLD"

echo "==> Export estático (BUILD_TARGET=mobile)"
rm -rf out .next
BUILD_TARGET=mobile npx next build

restore_api
trap - EXIT

echo "==> Capacitor sync"
npx cap sync android

echo "==> Gradle assembleDebug"
cd android
./gradlew assembleDebug

echo
echo "APK gerado em: android/app/build/outputs/apk/debug/app-debug.apk"
