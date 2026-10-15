#!/usr/bin/env bash
# Renders screenshots with a virtual display. Usage:
#   tools/capture.sh --level=0 --times=1,4,8      (a mission flown by the autopilot)
#   tools/capture.sh --menu --times=1              (main menu)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/output && touch tests/output/.gdignore  # keep renders out of the Godot import
GODOT="${GODOT:-godot}"
xvfb-run -a -s "-screen 0 1280x720x24" "$GODOT" --path . --rendering-driver opengl3 \
  --resolution 1280x720 --fixed-fps 60 res://tools/capture.tscn -- "$@"
