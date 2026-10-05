#!/usr/bin/env bash
set -euo pipefail
# No Gradle required. Needs Android SDK platform 35/build-tools 35.0.0,
# Java 17 (JDK preferred, or JRE plus ECJ_JAR), Python 3, zip and keytool.
ROOT=$(cd "$(dirname "$0")" && pwd)
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$SDK" ]]; then echo 'Set ANDROID_SDK_ROOT to your Android SDK.' >&2; exit 1; fi
BT="$SDK/build-tools/35.0.0"
ANDROID_JAR="$SDK/platforms/android-35/android.jar"
BUILD="$ROOT/build/manual"
SRC="$ROOT/app/src/main"
mkdir -p "$BUILD/generated" "$BUILD/classes" "$BUILD/dex"
"$BT/aapt2" compile --dir "$SRC/res" -o "$BUILD/resources.zip"
"$BT/aapt2" link -I "$ANDROID_JAR" --manifest "$SRC/AndroidManifest.xml" --java "$BUILD/generated" -A "$SRC/assets" --min-sdk-version 26 --target-sdk-version 35 --version-code 1 --version-name 0.1-prototype -o "$BUILD/resources.apk" "$BUILD/resources.zip"
if [[ -n "${ECJ_JAR:-}" ]]; then
  java -jar "$ECJ_JAR" -8 -proc:none -classpath "$ANDROID_JAR" -d "$BUILD/classes" "$BUILD/generated/in/joseph/metrosn/R.java" "$SRC/java/in/joseph/metrosn/"*.java
else
  javac -source 8 -target 8 -classpath "$ANDROID_JAR" -d "$BUILD/classes" "$BUILD/generated/in/joseph/metrosn/R.java" "$SRC/java/in/joseph/metrosn/"*.java
fi
python3 - "$BUILD" <<'PY'
import sys, pathlib, zipfile
b=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(b/'classes.zip','w') as z:
    for p in (b/'classes').rglob('*.class'): z.write(p,p.relative_to(b/'classes'))
PY
"$BT/d8" --release --min-api 26 --lib "$ANDROID_JAR" --output "$BUILD/dex" "$BUILD/classes.zip"
python3 - "$BUILD" <<'PY'
import sys, pathlib, zipfile, shutil
b=pathlib.Path(sys.argv[1]); shutil.copyfile(b/'resources.apk', b/'unsigned.apk')
with zipfile.ZipFile(b/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:
    for p in (b/'dex').glob('*.dex'): z.write(p,p.name)
PY
"$BT/zipalign" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
KEYSTORE="${METRO_KEYSTORE:-$ROOT/build/prototype-signing.jks}"
if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias metroprototype -storepass android -keypass android -keyalg RSA -keysize 3072 -validity 3650 -dname 'CN=Metro to SN Personal Prototype' -noprompt
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias metroprototype --ks-pass pass:android --key-pass pass:android --out "$ROOT/build/Metro-to-SN-prototype.apk" "$BUILD/aligned.apk"
"$BT/apksigner" verify --verbose "$ROOT/build/Metro-to-SN-prototype.apk"
echo "APK: $ROOT/build/Metro-to-SN-prototype.apk"
