"""Extrae cifras clave de los XLSX recalculados -> metrics.json (formato español)."""
import json, sys, os
from openpyxl import load_workbook
R = sys.argv[1]
def es(x, d=0):
    if isinstance(x, str): return x
    s = f"{x:,.{d}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")
def eur(x, d=0): return x if isinstance(x, str) else es(x, d) + " €"
def pct(x, d=1): return x if isinstance(x, str) else es(x * 100, d) + " %"
M = {}
wb = load_workbook(os.path.join(R, "03_BUSINESS_CASE/Financial Model 2027–2031.xlsx"), data_only=True)
sc = wb["Scenarios"]
keys = ["cons", "base", "opt", "stress"]
for row in sc.iter_rows(min_row=5, max_row=24):
    lab = row[0].value
    if not lab: continue
    for j, k in enumerate(keys):
        v = row[1 + j].value
        M[f"{k}|{lab}"] = v
def g(k, lab): return M[f"{k}|{lab}"]
out = {}
for k in keys:
    out[f"{k}_units_total"] = es(g(k, "Unidades vendidas 2027–2031"))
    out[f"{k}_units_2031"] = es(g(k, "Unidades vendidas 2031"))
    out[f"{k}_rev_total"] = eur(g(k, "Ingresos de la marca 2027–2031 (antes de IEE)"))
    for y in (2028, 2029, 2030, 2031):
        out[f"{k}_ebitda_{y}"] = eur(g(k, f"EBITDA {y}"))
    out[f"{k}_ebitda_cum"] = eur(g(k, "EBITDA acumulado 2027–2031"))
    out[f"{k}_ni_cum"] = eur(g(k, "Resultado neto acumulado"))
    out[f"{k}_fcf_cum"] = eur(g(k, "FCF acumulado 2027–2031"))
    out[f"{k}_need"] = eur(g(k, "Necesidad máxima de financiación (capital + deuda)"))
    out[f"{k}_need_raw"] = g(k, "Necesidad máxima de financiación (capital + deuda)")
    out[f"{k}_npv"] = eur(g(k, "VAN (tasa de 'Assumptions')"))
    v = g(k, "TIR del proyecto (con valor terminal)")
    out[f"{k}_irr"] = pct(v) if isinstance(v, (int, float)) else "no calculable (flujos sin cambio de signo positivo)"
    v = g(k, "Payback (año)")
    out[f"{k}_payback"] = str(int(v)) if isinstance(v, (int, float)) else "posterior a 2031"
    v = g(k, "Punto muerto EBITDA 2030 (unidades)")
    out[f"{k}_be"] = es(v) + " u/año" if isinstance(v, (int, float)) else "no alcanzable (contribución unitaria negativa)"
    out[f"{k}_contrib"] = eur(g(k, "Contribución unitaria 2030 (€/u)"), 2)
ue = wb["Unit Economics"]
for j, p in enumerate([12, 15, 18, 20, 25, 30, 35]):
    col = 2 + j
    out[f"ue{p}_contrib"] = eur(ue.cell(row=14, column=col).value, 2)
    v = ue.cell(row=17, column=col).value
    out[f"ue{p}_be"] = es(v) if isinstance(v, (int, float)) else "no viable"
    out[f"ue{p}_fobmax"] = es(ue.cell(row=18, column=col).value, 2) + " USD"
    out[f"ue{p}_net"] = eur(ue.cell(row=11, column=col).value, 2)
    out[f"ue{p}_iee"] = eur(ue.cell(row=7, column=col).value, 2)
out["ue_landed"] = eur(ue.cell(row=12, column=2).value, 2)
wc = wb["Working Capital"]
for row in wc.iter_rows():
    if row[0].value and str(row[0].value).startswith("Necesidad máxima de caja del ciclo"):
        out["wc_peak"] = eur(row[1].value)
    if row[0].value and str(row[0].value).startswith("Meses entre el primer pago"):
        out["wc_months"] = es(row[1].value)
it = wb["Import & Taxes"]
for row in it.iter_rows():
    lab = row[0].value
    if lab and "PAGO TOTAL EN FRONTERA" in lab: out["it_border"] = eur(row[2].value)
    if lab == "IVA (Hacienda)": out["split_vat"] = pct(row[3].value)
    if lab == "Impuesto especial (Hacienda)": out["split_iee"] = pct(row[3].value)
    if lab == "Margen expendedor": out["split_rm"] = pct(row[3].value)
    if lab == "Tarifa distribuidor": out["split_dist"] = pct(row[3].value)
    if lab == "Arancel (Hacienda UE)": out["split_duty"] = pct(row[3].value)
    if lab and lab.startswith("Fabricación, packaging"): out["split_cif"] = pct(row[3].value)
    if lab and lab.startswith("Contribución de la marca"): out["split_contrib"] = pct(row[3].value); out["split_contrib_eur"] = eur(row[2].value, 2)
pc = wb["Engine"]
# base landed 2028 (col I) row of landed_u
for row in pc.iter_rows(min_row=5):
    lab = row[0].value
    if lab == "Coste en destino (sin IEE ni IVA)": out["base_landed"] = eur(row[8].value, 2)
    if lab == "Fabricación FOB en €": out["base_fob_eur"] = eur(row[8].value, 2)
    if lab == "Packaging": out["base_pack"] = eur(row[8].value, 2)
    if lab == "Arancel": out["base_duty_u"] = eur(row[8].value, 2)
    if lab == "Impuesto especial por unidad": out["base_iee_u"] = eur(row[8].value, 2)
    if lab == "(-) Gastos fijos": out["base_opex_2028"] = eur(row[9].value); out["base_opex_2030"] = eur(row[11].value)
ir = wb["Investment Returns"]
wb2 = load_workbook(os.path.join(R, "06_PREMIUM_IMPORT/Premium Import Business Case.xlsx"), data_only=True)
b3 = wb2["B3 Importador no cubano"]
out["b3_contrib"] = eur(b3["B22"].value, 2); out["b3_contrib_pct"] = pct(b3["B23"].value)
out["b3_cash_mid"] = eur(b3["C29"].value); out["b3_profit_mid"] = eur(b3["C33"].value)
out["b3_be"] = es(b3["C39"].value); out["b3_roi_mid"] = pct(b3["C34"].value)
out["b3_cash_small"] = eur(b3["B29"].value); out["b3_profit_small"] = eur(b3["B33"].value)
out["b3_cash_large"] = eur(b3["D29"].value); out["b3_profit_large"] = eur(b3["D33"].value)
bh = wb2["Oferta Behike 56"]
out["bh_box"] = eur(bh["B5"].value); out["bh_ratio"] = pct(bh["B7"].value); out["bh_taxes"] = eur(bh["B9"].value); out["bh_lot"] = eur(bh["B11"].value)
wb3 = load_workbook(os.path.join(R, "05_SPAIN_IMPORT/Customs and Tax Model.xlsx"), data_only=True)
ct = wb3["Comparativa por origen"]
out["ct_cuba"] = eur(ct["E5"].value, 2); out["ct_dr"] = eur(ct["E6"].value, 2); out["ct_diff10k"] = eur(-ct["G6"].value)
out["ct_state_pct"] = pct(wb3["Calculadora DUA"]["B34"].value)
wb4 = load_workbook(os.path.join(R, "07_OPERATIONS/180-Day Execution Plan.xlsx"), data_only=True)
v = wb4["Vistas 30-60-90-180"]
out["plan_cost_30"] = eur(v["F5"].value); out["plan_cost_90"] = eur(v["F7"].value); out["plan_cost_180"] = eur(v["F8"].value)
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=0)[:6000])
