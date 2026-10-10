#!/bin/bash
# Genera todos los XLSX en un directorio temporal, los recalcula con LibreOffice (valores en caché)
# y los copia a PROYECTO_CIGARS_CUBA_2027. Uso: bash make_xlsx.sh
set -e
B=$(cd "$(dirname "$0")" && pwd)
R="$B/../PROYECTO_CIGARS_CUBA_2027"
T=$(mktemp -d)
mkdir -p "$T"/{00_EXECUTIVE,01_BRAND,03_BUSINESS_CASE,05_SPAIN_IMPORT,06_PREMIUM_IMPORT,07_OPERATIONS,09_RESEARCH}
cd "$B"
python3 build_model.py "$T/03_BUSINESS_CASE/Financial Model 2027–2031.xlsx" >/dev/null
python3 build_premium.py "$T/06_PREMIUM_IMPORT/Premium Import Business Case.xlsx" "$T/05_SPAIN_IMPORT/Customs and Tax Model.xlsx" >/dev/null
python3 build_misc.py "$T" >/dev/null
for f in $(cd "$T" && find . -name '*.xlsx' | sed 's|^\./||' | tr ' ' '\001'); do
  f=$(echo "$f" | tr '\001' ' ')
  d=$(dirname "$f")
  mkdir -p "$T/recalc/$d"
  soffice --headless --calc --convert-to xlsx --outdir "$T/recalc/$d" "$T/$f" >/dev/null 2>&1
  mkdir -p "$R/$d"
  cp "$T/recalc/$f" "$R/$f"
  python3 "$B/check_xlsx.py" "$R/$f" | grep -E "total errors|ERR" | sed "s|^|$f: |"
done
rm -rf "$T"
