#!/bin/bash
# Rasteriza todos los SVG de un directorio a PNG (mismo tamaño) con Chromium.
CH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
cd "$1"
for f in ${2:-*.svg}; do
  read w h < <(python3 -c "import re;s=open('$f').read(400);m=re.search(r'width=\"([0-9.]+)\" height=\"([0-9.]+)\"',s);print(int(float(m.group(1))),int(float(m.group(2))))")
  echo "<html><body style='margin:0'><img src='file://$PWD/$f' width=$w height=$h></body></html>" > /tmp/claude-0/shot.html
  $CH --headless --no-sandbox --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=$w,$((h+400)) --screenshot="$PWD/${f%.svg}.png" file:///tmp/claude-0/shot.html >/dev/null 2>&1
  python3 -c "from PIL import Image;im=Image.open('$PWD/${f%.svg}.png');im.crop((0,0,$w,$h)).save('$PWD/${f%.svg}.png')"
done
