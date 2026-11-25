#!/usr/bin/env bash
# Regenerates tests/fixtures/ and src/engine/samples/ from synthetic sources.
# Needs macOS (sips, ColorSync profiles), ffmpeg, exiftool and Playwright's Chromium.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/tests/fixtures"
SAMPLES="$ROOT/src/engine/samples"
PROFILES="/System/Library/ColorSync/Profiles"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT" "$SAMPLES"
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
strip() { exiftool -q -overwrite_original -all= "$@"; }

ff -f lavfi -i "testsrc2=s=2400x1600" -frames:v 1 -q:v 6 "$OUT/metadata.jpg"
strip "$OUT/metadata.jpg"
exiftool -q -overwrite_original \
  -GPSLatitude=32.0853 -GPSLatitudeRef=N \
  -GPSLongitude=34.7818 -GPSLongitudeRef=E \
  -Make=itsmor -Model="Fixture Camera" \
  -LensModel="Fixture Lens 24mm" \
  -DateTimeOriginal="2026:11:25 12:00:00" \
  -Software="itsmor fixtures" \
  "$OUT/metadata.jpg"

ff -f lavfi -i "color=c=gray:s=480x320,drawbox=x=0:y=0:w=120:h=80:color=red:t=fill" \
  -frames:v 1 -q:v 4 "$OUT/orientation-6.jpg"
strip "$OUT/orientation-6.jpg"
exiftool -q -overwrite_original -n -Orientation=6 "$OUT/orientation-6.jpg"

ff -f lavfi -i "color=c=black@0:s=320x240,format=rgba[bg];testsrc2=s=160x240,format=rgba[fg];[bg][fg]overlay=x=0:y=0" \
  -frames:v 1 "$OUT/alpha.png"

ff -f lavfi -i "testsrc2=s=320x240:r=5" -frames:v 3 "$OUT/animated.gif"

ff -f lavfi -i "testsrc2=s=160x120" -frames:v 1 -pix_fmt bgr24 "$OUT/plain.bmp"

ff -f lavfi -i "testsrc2=s=320x240" -frames:v 1 "$TMP/plain.png"
node "$ROOT/tools/webp.mjs" "$TMP/plain.png" "$OUT/metadata.webp"
exiftool -q -overwrite_original \
  -GPSLatitude=32.0853 -GPSLatitudeRef=N \
  -GPSLongitude=34.7818 -GPSLongitudeRef=E \
  -Make=itsmor -Model="Fixture Camera" \
  "$OUT/metadata.webp"

sips -s format heic "$TMP/plain.png" --out "$OUT/plain.heic" >/dev/null
cp "$OUT/plain.heic" "$OUT/mislabelled.jpg"

ff -f lavfi -i "gradients=s=384x288:c0=red:c1=lime:c2=blue:c3=yellow:nb_colors=4:speed=0:type=radial:seed=7" \
  -frames:v 1 "$TMP/saturated.png"
sips -s format jpeg -s formatOptions 95 "$TMP/saturated.png" --out "$TMP/saturated.jpg" >/dev/null
sips --embedProfile "$PROFILES/Display P3.icc" "$TMP/saturated.jpg" --out "$OUT/display-p3.jpg" >/dev/null
sips -m "$PROFILES/sRGB Profile.icc" -s format png "$OUT/display-p3.jpg" \
  --out "$OUT/display-p3.srgb.png" >/dev/null
strip "$OUT/display-p3.srgb.png"

perl -0777 -ne 'print substr($_, 0, index($_, "\xff\xda"))' \
  "$OUT/orientation-6.jpg" >"$OUT/corrupt.jpg"

ff -f lavfi -i "color=c=gray:s=16x16" -frames:v 1 "$TMP/sample.png"
sips -s format heic "$TMP/sample.png" --out "$SAMPLES/sample.heic" >/dev/null
sips -s format avif "$TMP/sample.png" --out "$SAMPLES/sample.avif" >/dev/null

ls -l "$OUT" "$SAMPLES"
