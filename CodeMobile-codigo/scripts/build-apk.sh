#!/usr/bin/env bash
# Builds CodeMobile.apk from the web app without Gradle:
# aapt2 (resources) -> javac (activity) -> d8 (dex) -> zipalign -> apksigner.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# O toolchain pode estar no projeto ou um nível acima (é o layout do repo).
resolve_toolchain() {
  if [ -n "${TOOLCHAIN:-}" ]; then echo "$TOOLCHAIN"; return; fi
  for candidate in "$ROOT/.toolchain" "$ROOT/../.toolchain"; do
    if [ -d "$candidate/sdk" ]; then echo "$(cd "$candidate" && pwd)"; return; fi
  done
  echo "$ROOT/.toolchain"
}
TOOLCHAIN="$(resolve_toolchain)"
JAVA_HOME="${JAVA_HOME:-$TOOLCHAIN/jdk-17.0.13+11}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

SDK="${ANDROID_SDK_ROOT:-$TOOLCHAIN/sdk}"
BUILD_TOOLS_VERSION="${BUILD_TOOLS_VERSION:-$(ls "$SDK/build-tools" 2>/dev/null | sort -V | tail -1)}"
BUILD_TOOLS="$SDK/build-tools/${BUILD_TOOLS_VERSION:-34.0.0}"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
OUT="$ROOT/android/build"
MIN_SDK=26
TARGET_SDK=34

for tool in "$BUILD_TOOLS/aapt2" "$BUILD_TOOLS/d8" "$BUILD_TOOLS/zipalign" "$BUILD_TOOLS/apksigner" "$ANDROID_JAR"; do
  if [ ! -e "$tool" ]; then
    echo "Ferramenta ausente: $tool" >&2
    echo "Instale com: sdkmanager \"platforms;android-34\" \"build-tools;34.0.0\"" >&2
    exit 1
  fi
done

echo "==> 1/7 build da web app"
cd "$ROOT"
npm run build

echo "==> 2/7 copiando assets"
rm -rf "$ROOT/android/assets" "$OUT"
mkdir -p "$ROOT/android/assets/www" "$OUT/res" "$OUT/classes" "$OUT/dex" "$OUT/gen"
cp -r "$ROOT/dist/." "$ROOT/android/assets/www/"
mkdir -p "$ROOT/android/res/drawable"
cp "$ROOT/public/icons/icon-192.png" "$ROOT/android/res/drawable/icon.png"

echo "==> 3/7 compilando recursos"
"$BUILD_TOOLS/aapt2" compile --dir "$ROOT/android/res" -o "$OUT/res.zip"
"$BUILD_TOOLS/aapt2" link \
  -o "$OUT/app-unaligned.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --java "$OUT/gen" \
  -A "$ROOT/android/assets" \
  "$OUT/res.zip"

echo "==> 4/7 compilando Java"
javac -source 8 -target 8 -nowarn \
  -bootclasspath "$ANDROID_JAR" \
  -d "$OUT/classes" \
  $(find "$ROOT/android/java" "$OUT/gen" -name '*.java')

echo "==> 5/7 gerando classes.dex"
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api "$MIN_SDK" --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

python3 - "$OUT/app-unaligned.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_STORED) as archive:
    archive.write(dex, 'classes.dex')
print('classes.dex adicionado')
PY

echo "==> 6/7 alinhando"
"$BUILD_TOOLS/zipalign" -f -p 4 "$OUT/app-unaligned.apk" "$OUT/app-aligned.apk"
"$BUILD_TOOLS/zipalign" -c -v 4 "$OUT/app-aligned.apk" > /dev/null
echo "alinhamento ok"

echo "==> 7/7 assinando"
KEYSTORE="$ROOT/android/keystore.jks"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -storepass android -keypass android \
    -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Code Mobile, OU=Dev, O=CodeMobile, L=Sao Paulo, ST=SP, C=BR" > /dev/null 2>&1
  echo "keystore criada em android/keystore.jks"
fi

"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --ks-key-alias androiddebugkey \
  --out "$ROOT/CodeMobile.apk" \
  "$OUT/app-aligned.apk"

"$BUILD_TOOLS/apksigner" verify --print-certs "$ROOT/CodeMobile.apk" | head -4
"$BUILD_TOOLS/aapt2" dump badging "$ROOT/CodeMobile.apk" | head -4
echo "APK pronto: $ROOT/CodeMobile.apk ($(du -h "$ROOT/CodeMobile.apk" | cut -f1))"
