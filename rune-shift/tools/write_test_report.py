#!/usr/bin/env python3
"""Turns tests/output/results.json into the results table of docs/TEST_REPORT.md
(between the AUTO markers). Run after tools/run_tests.sh."""
import json, os, re, datetime
root = os.path.join(os.path.dirname(__file__), "..")
res = json.load(open(os.path.join(root, "tests/output/results.json")))
lines = [f"Ejecución: {datetime.date.today().isoformat()} · Godot {res['godot']} · "
         f"**{res['passed']} OK, {res['failed']} fallos** · {res['seconds']:.1f} s", "",
         "| Suite | Prueba | Resultado | Métricas |", "|---|---|---|---|"]
for r in res["results"]:
    notes = "<br>".join(r.get("notes", [])) or ""
    status = "✅" if r["ok"] else "❌ " + "; ".join(r.get("errors", []))
    lines.append(f"| {r['suite']} | `{r['test']}` | {status} | {notes} |")
path = os.path.join(root, "docs/TEST_REPORT.md")
doc = open(path).read()
doc = re.sub(r"<!-- AUTO:START -->.*<!-- AUTO:END -->",
             "<!-- AUTO:START -->\n" + "\n".join(lines) + "\n<!-- AUTO:END -->", doc, flags=re.S)
open(path, "w").write(doc)
print("TEST_REPORT.md updated:", res["passed"], "passed,", res["failed"], "failed")
