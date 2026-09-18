#!/bin/bash
# 產出 Chrome 線上應用程式商店用 ZIP：只含執行所需檔案，manifest 在壓縮根目錄。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(python3 -c "import json; print(json.load(open('manifest.json', encoding='utf-8'))['version'])")"
OUTPUT="BetterCSU-Portal-v${VERSION}.zip"

rm -f "$OUTPUT"
zip -X -q "$OUTPUT" \
  manifest.json \
  content.js \
  core.js \
  credits.js \
  features.js \
  pins.js

echo "Packaged: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
unzip -l "$OUTPUT"
