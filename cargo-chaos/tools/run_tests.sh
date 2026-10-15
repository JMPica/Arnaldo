#!/usr/bin/env bash
# Runs every automated check headless. Usage: tools/run_tests.sh [--filter=x] [--suite=unit]
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/output && touch tests/output/.gdignore  # keep renders out of the Godot import
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --import >/dev/null 2>&1
echo "== Script compilation =="
"$GODOT" --headless --path . --script res://tools/check_scripts.gd 2>&1 | grep -E "checked|FAILED|SCRIPT ERROR"
status=${PIPESTATUS[0]}
echo "== Tests =="
"$GODOT" --headless --path . --fixed-fps 60 res://tests/test_runner.tscn -- "$@" 2>&1 \
  | grep -vE "^\s*$|ALSA|audio_driver_alsa|All audio drivers|dummy driver|servers/audio"
test_status=${PIPESTATUS[0]}
echo "== Scene flow smoke test =="
"$GODOT" --headless --path . --fixed-fps 60 --script res://tools/flow_smoke.gd 2>&1 | grep -E "^\s+(ok|FAIL)|flow smoke"
flow_status=${PIPESTATUS[0]}
exit $(( status || test_status || flow_status ))
