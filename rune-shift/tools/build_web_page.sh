#!/usr/bin/env bash
# Builds the web version as a self-hostable page in build/play/:
#   rune-shift.html + index.js + audio worklets + engine.wasm.gz.txt + game.pck.txt
# The engine is gzip+base64 encoded so every file is a plain served type and the
# biggest one stays under ~14 MB; tools/web/rune-shift.html unpacks it in the browser.
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
mkdir -p build/web build/play
"$GODOT" --headless --path . --export-release "Web" build/web/index.html
cp build/web/index.js build/web/index.audio.worklet.js build/web/index.audio.position.worklet.js build/play/
base64 -w 0 build/web/index.pck > build/play/game.pck.txt
gzip -9 -c build/web/index.wasm | base64 -w 0 > build/play/engine.wasm.gz.txt
cp tools/web/rune-shift.html build/play/rune-shift.html
sed -i "s/\"index.pck\": [0-9]*/\"index.pck\": $(stat -c %s build/web/index.pck)/; \
s/\"index.wasm\": [0-9]*/\"index.wasm\": $(stat -c %s build/web/index.wasm)/; \
s/const ENGINE_TEXT_BYTES = [0-9]*/const ENGINE_TEXT_BYTES = $(stat -c %s build/play/engine.wasm.gz.txt)/" build/play/rune-shift.html
cmp build/web/index.wasm <(base64 -d build/play/engine.wasm.gz.txt | gunzip) && echo "build/play ready"
