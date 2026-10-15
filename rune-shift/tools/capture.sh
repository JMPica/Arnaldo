#!/usr/bin/env bash
# Screenshots of the real game under a virtual display. Example:
#   tools/capture.sh --times=2,8,20 --seed=7 --form=orb --element=fire --catalyst=rupture
#   tools/capture.sh --menu --times=1
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/output && touch tests/output/.gdignore
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --script res://tools/check_scripts.gd | grep -q " 0 failed" || { echo "scripts do not compile"; exit 1; }
xvfb-run -a -s "-screen 0 450x800x24" "$GODOT" --path . --rendering-driver opengl3 \
  --resolution 405x720 --fixed-fps 60 res://tools/capture.tscn -- "$@"
