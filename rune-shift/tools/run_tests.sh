#!/usr/bin/env bash
# Compiles every script, then runs all tests headless. Options: --filter=x --suite=unit|integration
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/output && touch tests/output/.gdignore
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --import >/dev/null 2>&1
echo "== Script compilation =="
"$GODOT" --headless --path . --script res://tools/check_scripts.gd 2>&1 | grep -E "checked|FAILED|SCRIPT ERROR"
if ! "$GODOT" --headless --path . --script res://tools/check_scripts.gd 2>/dev/null | grep -q " 0 failed"; then
  echo "Compilation failed: not running tests (a broken script would hang the runner)."; exit 1
fi
echo "== Tests =="
"$GODOT" --headless --path . --fixed-fps 60 res://tests/test_runner.tscn -- "$@" 2>&1 \
  | grep -vE "^\s*$|ALSA|audio_driver|All audio drivers|dummy driver|servers/audio"
exit ${PIPESTATUS[0]}
