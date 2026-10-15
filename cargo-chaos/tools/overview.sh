#!/usr/bin/env bash
# Renders level overviews (full level + bot trajectories). Usage: tools/overview.sh 0 [1 2 ...]
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/output && touch tests/output/.gdignore  # keep renders out of the Godot import
GODOT="${GODOT:-godot}"
for lvl in "${@:-0}"; do
  xvfb-run -a -s "-screen 0 1280x720x24" "$GODOT" --path . --rendering-driver opengl3 \
    --resolution 1280x720 --fixed-fps 60 res://tools/overview.tscn -- --level="$lvl" 2>&1 \
    | grep -E "RESULT|saved|SCRIPT ERROR|dmg" || true
done
