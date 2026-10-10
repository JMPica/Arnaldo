# -*- coding: utf-8 -*-
"""06_PREMIUM_IMPORT/Premium Import Business Case.xlsx y 05_SPAIN_IMPORT/Customs and Tax Model.xlsx"""
import sys
from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L
from xstyle import *

out_pi, out_ct = sys.argv[1], sys.argv[2]

# =====================================================================  PREMIUM IMPORT
wb = Workbook()
D = wb.active
D.title = "Dashboard"
SU = wb.create_sheet("Supuestos")
BH = wb.create_sheet("Oferta Behike 56")
B1 = wb.create_sheet("B1 Habanos directo")
B3 = wb.create_sheet("B3 Importador no cubano")
B2 = wb.create_sheet("B2 Expendeduría")
CO = wb.create_sheet("Comparativa")
FU = wb.create_sheet("Fuentes")

# ---- Supuestos
title(SU, "Supuestos — Proyecto B (importación y distribución premium)", "Valores azules editables. Fecha de corte 10/10/2026.")
legend(SU, 3, 2)
gen = [
    ("vat", "IVA", 0.21, PCT, "VERIFICADO", "Ley 37/1992"),
    ("iee", "IEE cigarros (ad valorem sobre PVP)", 0.158, PCT, "VERIFICADO", "S14"),
    ("iee_min", "IEE mínimo (€/1.000 u)", 47, NUM2, "VERIFICADO", "S14"),
    ("rm", "Margen expendedor", 0.09, PCT, "PROBABLE", "S15"),
    ("duty_mfn", "Arancel 2402 10 00 sin preferencia (p.ej. Cuba)", 0.26, PCT, "PROBABLE", "S32"),
    ("duty_pref", "Arancel con preferencia (R. Dominicana EPA / Centroamérica AA) con prueba de origen", 0.0, PCT, "PROBABLE", "S33; confirmar TARIC"),
    ("fx", "USD por EUR", 1.15, NUM2, "HIPÓTESIS", ""),
    ("marks", "Marcas fiscales + identificador único (€/u)", 0.03, EUR2, "HIPÓTESIS", "S27, S28"),
    ("customs_fee", "Despacho por envío (€)", 450, EUR, "HIPÓTESIS", ""),
    ("eu_ceg", "Notificación EU-CEG + ficha por nueva referencia (€)", 600, EUR, "HIPÓTESIS", "S29; cotizar consultor"),
    ("fixed", "Gastos fijos anuales del importador-distribuidor (€)", 18000, EUR, "HIPÓTESIS", "Gestoría, seguros, almacén, comercial, software"),
    ("capital_cost", "Coste de oportunidad del capital inmovilizado (anual)", 0.08, PCT, "HIPÓTESIS", ""),
    ("behike_pvp", "Cohiba Behike BHK 56 — PVP expendeduría por unidad (mar-2026)", 262.5, EUR2, "PROBABLE", "S19 (coherente con S20)"),
    ("behike_offer", "Oferta recibida por el promotor — precio por caja de 10", 50, EUR2, "HIPÓTESIS", "No verificada; comunicada verbalmente"),
    ("contraband", "Umbral penal del contrabando de labores de tabaco (€)", 15000, EUR, "PROBABLE", "N01"),
]
G = {}
header(SU, 5, ["Parámetro", "Valor", "Estado", "Fuente"])
for n, (k, lab, v, fmt, st, src) in enumerate(gen):
    r = 6 + n
    put(SU, f"A{r}", lab)
    put(SU, f"B{r}", v, "input", fmt)
    put(SU, f"C{r}", st)
    put(SU, f"D{r}", src, "note")
    G[k] = f"Supuestos!$B${r}"
widths(SU, {"A": 70, "B": 14, "C": 13, "D": 40})

# ---- Oferta Behike
title(BH, "Análisis de la oferta 'Cohiba Behike 56 a ~50 € la caja de 10'",
      "No se calcula beneficio: sin procedencia, autenticidad, disponibilidad legal y derecho de distribución acreditados, el 'margen' no existe.")
put(BH, "A4", "Cajas que se ofrecerían (supuesto para dimensionar el riesgo)")
put(BH, "B4", 20, "input", NUM)
rows = [
    ("PVP oficial en expendeduría por caja de 10", f"={G['behike_pvp']}*10", EUR),
    ("Precio ofertado por caja", f"={G['behike_offer']}", EUR),
    ("Precio ofertado / PVP oficial", "=B6/B5", PCT),
    ("Descuento implícito", "=1-B7", PCT),
    ("IVA + IEE contenidos en el PVP oficial de una caja", f"=B5*{G['vat']}/(1+{G['vat']})+B5*{G['iee']}", EUR),
    ("¿El precio ofertado cubre siquiera los impuestos españoles de la caja?", '=IF(B6>=B9,"Sí","NO: el precio no cubre ni el 6% del IVA+IEE que soporta la caja")', None),
    ("Valor oficial de la mercancía del lote", "=B4*B5", EUR),
    ("¿Supera el umbral penal de contrabando de tabaco?", f'=IF(B11>={G["contraband"]},"SÍ: exposición penal (LO 12/1995)","No: infracción administrativa")', None),
    ("Formato comercial legítimo conocido", "Caja de 10 unidades con sello de garantía holográfico, código único y estampado 'Hecho en Cuba' (S20, S36)", None),
    ("Cajas de 25 o sin sello / sin código verificable", "Indicador típico de falsificación (S20)", None),
]
for n, (lab, f, fmt) in enumerate(rows):
    r = 5 + n
    put(BH, f"A{r}", lab)
    k = "flag" if ("¿" in lab) else ("out" if n in (2, 3) else "calc")
    put(BH, f"B{r}", f, k, fmt)
r = 17
section(BH, r, "Hipótesis explicativas de un precio del ~2% del PVP (de más a menos probable)", 4)
hyp = [("Falsificación (relleno de tabaco no Habanos, anillas y cajas copiadas)", "Muy alta", "Delito contra la propiedad industrial (art. 274 CP); decomiso"),
       ("Producto auténtico desviado o sustraído de la cadena estatal cubana", "Alta", "Receptación/contrabando; decomiso; sin derecho de venta"),
       ("Producto auténtico de 'segunda' / rechazos de fábrica sin sello", "Media", "Exportación ilegal desde Cuba (Res. 98/2022, S09); no comercializable en España"),
       ("Error de comunicación (precio por unidad de otra referencia, o divisa)", "Baja", "Verificar por escrito antes de cualquier conversación adicional"),
       ("Oferta legítima de un exportador autorizado", "Prácticamente nula", "Habanos no vende a 2% del PVP; los Behike tienen asignación limitada")]
table(BH, r + 1, ["Hipótesis", "Probabilidad cualitativa", "Consecuencia"], hyp, [70, 22, 70])
put(BH, "A26", "DECISIÓN: NO-GO absoluto. No negociar, no pagar señal, no recibir muestras, no transportar en equipaje. Ver 'Authenticity & Provenance Protocol.pdf'.", "flag")
BH.merge_cells("A26:C26")
widths(BH, {"A": 70, "B": 40, "C": 60})

# ---- B1 Habanos directo
title(B1, "B1 — Importación directa de Habanos (Cohiba, Trinidad, Montecristo, Partagás...)", "Evaluación de acceso. No se modeliza margen porque la vía no es legalmente accesible para un tercero.")
b1 = [
    ("¿Puede una SL española comprar directamente a Habanos S.A.?", "No, salvo ser nombrada distribuidor exclusivo por Habanos para un territorio.", "PROBABLE", "S01, S02, S21"),
    ("Distribuidor exclusivo en España (salvo Canarias)", "Tabacalera S.L.U.", "VERIFICADO", "S21"),
    ("Situación del distribuidor exclusivo (2026)", "Cuentas bloqueadas por sanciones UE a su accionista indirecto Chen Zhi (30/07/2026); pagos con autorización del Tesoro.", "VERIFICADO", "S21, S23"),
    ("¿Importación paralela de Habanos genuinos comprados en Cuba u otro país no-EEE?", "Infringe la marca: el agotamiento en la UE es regional (EEE). Requiere consentimiento del titular.", "PROBABLE", "N02"),
    ("¿Compra a otro distribuidor de la UE (comercio intracomunitario)?", "Agotamiento en el EEE permite reventa de producto puesto legítimamente en el mercado del EEE, pero en España la venta al por menor es monopolio de expendedurías y el mayorista necesita habilitación CMT, marcas fiscales españolas y precio publicado en BOE.", "PROBABLE", "N02, S17, S18, S27"),
    ("¿Ediciones regionales propias?", "Sólo las solicita el distribuidor exclusivo; mínimo 25.000 unidades por referencia.", "PROBABLE", "S02"),
    ("¿Subastas o reventa de colección en España?", "La venta al consumidor fuera de expendedurías no está permitida; las subastas internacionales operan fuera de España.", "PROBABLE", "S16, S26"),
    ("CONCLUSIÓN", "NO-GO para importación directa. Vía legal residual: operar como expendeduría (B2) o como distribuidor intracomunitario habilitado de stock legítimo del EEE (muy limitada y dependiente de que existan márgenes).", "PROBABLE", ""),
]
table(B1, 4, ["Pregunta", "Respuesta", "Estado", "Fuente"], b1, [56, 90, 13, 18])

# ---- B3 Importador no cubano
title(B3, "B3 — Importador-distribuidor habilitado de puros premium no cubanos (R. Dominicana, Nicaragua, Honduras)",
      "Requiere acuerdo de distribución exclusiva con un fabricante que hoy no tenga distribución en España. Lotes por referencia.")
inp = [("Origen preferente (1 = con preferencia arancelaria, 0 = sin preferencia)", 1, "0"),
       ("PVP por unidad (€)", 15.0, EUR2),
       ("Precio de compra FOB por unidad (USD), caja incluida", 3.8, NUM2),
       ("Flete + seguro + manipulación por unidad (€)", 0.35, EUR2),
       ("Tarifa distribuidor logístico (Logista u otro) % PVP", 0.05, PCT),
       ("Merma + muestras (% sobre ventas)", 0.05, PCT),
       ("Referencias nuevas por año (notificación EU-CEG)", 4, NUM)]
for n, (lab, v, fmt) in enumerate(inp):
    put(B3, f"A{5+n}", lab)
    put(B3, f"B{5+n}", v, "input", fmt)
section(B3, 13, "Economía unitaria", 6)
ue = [("IVA incluido", f"=B6*{G['vat']}/(1+{G['vat']})", EUR2),
      ("IEE", f"=MAX({G['iee']}*B6,{G['iee_min']}/1000)", EUR2),
      ("Margen expendedor", f"=B6*{G['rm']}", EUR2),
      ("Tarifa distribuidor logístico", "=B6*B9", EUR2),
      ("Ingreso del importador antes de IEE", "=B6-B14-B16-B17", EUR2),
      ("Coste CIF por unidad", f"=B7/{G['fx']}+B8", EUR2),
      ("Arancel", f"=B19*IF(B5=1,{G['duty_pref']},{G['duty_mfn']})", EUR2),
      ("Coste en destino (CIF + arancel + marcas)", f"=B19+B20+{G['marks']}", EUR2),
      ("Contribución por unidad (tras IEE, coste y merma)", "=B18-(1+B10)*(B15+B21)", EUR2),
      ("Contribución / PVP", "=B22/B6", PCT)]
for n, (lab, f, fmt) in enumerate(ue):
    put(B3, f"A{14+n}", lab)
    put(B3, f"B{14+n}", f, "out" if "Contribución" in lab else "calc", fmt)
section(B3, 25, "Operaciones por tamaño de lote", 8)
header(B3, 26, ["Concepto", "Lote pequeño", "Lote mediano", "Lote grande"])
lots = [("Unidades del lote", [2000, 6000, 15000], NUM, "input"),
        ("Meses para vender el lote (rotación)", [6, 9, 12], NUM, "input")]
for n, (lab, vals, fmt, k) in enumerate(lots):
    put(B3, f"A{27+n}", lab)
    for j, v in enumerate(vals):
        put(B3, f"{L(2+j)}{27+n}", v, k, fmt)
calc = [("Caja inmovilizada al importar (coste en destino + IEE + IVA importación)", "={c}27*($B$21+$B$15)*(1+{vat})+{cf}", EUR),
        ("Contribución del lote", "={c}27*$B$22", EUR),
        ("(-) Despacho y notificaciones atribuibles al lote", "={cf}+{ceg}", EUR),
        ("(-) Coste del capital inmovilizado (medio, durante la rotación)", "={c}29/2*{cc}*{c}28/12", EUR),
        ("Beneficio por operación (antes de gastos fijos)", "={c}30-{c}31-{c}32", EUR),
        ("Rentabilidad por operación sobre caja inmovilizada", "=IFERROR({c}33/{c}29,0)", PCT),
        ("Operaciones al año (12 / rotación)", "=12/{c}28", NUM2),
        ("Beneficio anual antes de fijos (una referencia)", "={c}33*{c}35", EUR),
        ("Gastos fijos anuales del importador", "={fixed}", EUR),
        ("Referencias necesarias para cubrir fijos", "=IFERROR({c}37/{c}36,\"n/a\")", NUM2),
        ("Unidades/año para punto muerto", "=IFERROR(({c}37+{cf}*{c}35)/$B$22,\"n/a\")", NUM),
        ("Beneficio por caja de 20 unidades", "=$B$22*20", EUR2)]
for n, (lab, f, fmt) in enumerate(calc):
    r = 29 + n
    put(B3, f"A{r}", lab)
    for j in range(3):
        c = L(2 + j)
        put(B3, f"{c}{r}", f.format(c=c, vat=G["vat"], cf=G["customs_fee"], ceg=G["eu_ceg"], cc=G["capital_cost"], fixed=G["fixed"]),
            "out" if ("Beneficio" in lab or "Rentabilidad" in lab or "punto muerto" in lab) else "calc", fmt)
put(B3, "A41", "Escenario NO-GO de esta vía: si ningún fabricante concede exclusiva para España o si el distribuidor logístico exige >8% del PVP, la contribución cae por debajo de 2 €/u (ver 'Comparativa').", "note")
widths(B3, {"A": 72, "B": 16, "C": 16, "D": 16})

# ---- B2 Expendeduría
title(B2, "B2 — Explotar una expendeduría especializada (canal minorista legal de Habanos)",
      "Referencia económica. La titularidad es personal (persona física) y exige gestión directa: incompatible a priori con el traslado del promotor a Andorra.")
b2 = [("Ventas anuales de puros premium (PVP con impuestos, €)", 400000, EUR, "input"),
      ("Margen legal del expendedor sobre PVP", f"={G['rm']}", PCT, "calc"),
      ("Margen bruto de puros (€)", "=B4*B5", EUR, "out"),
      ("Otras labores y productos (margen bruto, €)", 30000, EUR, "input"),
      ("Gastos de explotación (personal, local, humidor, seguros) €", 70000, EUR, "input"),
      ("Resultado antes de impuestos (€)", "=B6+B7-B8", EUR, "out"),
      ("Inversión: adquisición/traspaso de la concesión + local + humidor (€)", 250000, EUR, "input"),
      ("Rentabilidad sobre inversión", "=IFERROR(B9/B10,0)", PCT, "out")]
for n, (lab, f, fmt, k) in enumerate(b2):
    put(B2, f"A{4+n}", lab)
    put(B2, f"B{4+n}", f, k, fmt)
put(B2, "A13", "Estado: HIPÓTESIS en todos los importes salvo el margen. El precio de una transmisión de expendeduría y los requisitos personales deben confirmarse con el CMT (RD 1199/1999).", "note")
put(B2, "A14", "Aprovisionamiento de Habanos depende del distribuidor exclusivo (Tabacalera), hoy afectado por sanciones (S21).", "flag")
widths(B2, {"A": 72, "B": 16})

# ---- Comparativa
title(CO, "Comparativa de vías del Proyecto B", "")
comp = [("B1 Importación directa de Habanos", "No accesible", "—", "—", "Exclusiva de Habanos/Tabacalera; importación paralela = infracción de marca", "NO-GO"),
        ("B1' Distribución intracomunitaria de Habanos del EEE", "Muy limitada", "Alto", "Bajo", "Requiere habilitación, marcas fiscales españolas y precio BOE; margen comprimido por precios oficiales", "NO-GO salvo oportunidad documentada"),
        ("B2 Expendeduría especializada", "Legal (titular persona física)", "200–300 k€ (HIPÓTESIS)", "Bajo-medio", "Incompatible con residencia en Andorra; aprovisionamiento afectado por sanciones a Tabacalera", "NO prioritaria"),
        ("B3 Importador de marcas no cubanas", "Legal con habilitación CMT", "30–75 k€", "Medio", "Requiere exclusiva de fabricante y aceptación del distribuidor logístico", "GO condicionado a validación"),
        ("Oferta Behike 56 a 50 €/caja", "Ilegal / no acreditada", "—", "—", "Falsificación o desvío casi seguros", "NO-GO absoluto")]
table(CO, 4, ["Vía", "Acceso legal", "Capital", "Margen potencial", "Barrera principal", "Decisión"], comp, [40, 26, 22, 16, 70, 30])
put(CO, "A11", "Contribución unitaria B3 con los supuestos actuales (€/u)")
put(CO, "B11", "='B3 Importador no cubano'!B22", "out", EUR2)
put(CO, "A12", "Unidades/año punto muerto B3 (lote mediano)")
put(CO, "B12", "='B3 Importador no cubano'!C39", "out", NUM)

# ---- Dashboard
title(D, "Proyecto B — Importación premium · Dashboard", "Decisiones por vía y cifras clave (fórmulas).")
kp = [("Oferta Behike: precio ofertado / PVP oficial", "='Oferta Behike 56'!B7", PCT),
      ("Oferta Behike: valor oficial del lote supuesto", "='Oferta Behike 56'!B11", EUR),
      ("B3: contribución por unidad", "='B3 Importador no cubano'!B22", EUR2),
      ("B3: contribución / PVP", "='B3 Importador no cubano'!B23", PCT),
      ("B3: caja inmovilizada lote mediano", "='B3 Importador no cubano'!C29", EUR),
      ("B3: beneficio por operación lote mediano", "='B3 Importador no cubano'!C33", EUR),
      ("B3: unidades/año para punto muerto", "='B3 Importador no cubano'!C39", NUM),
      ("B2: rentabilidad sobre inversión (referencia)", "='B2 Expendeduría'!B11", PCT)]
header(D, 4, ["Indicador", "Valor"])
for n, (lab, f, fmt) in enumerate(kp):
    put(D, f"A{5+n}", lab)
    put(D, f"B{5+n}", f, "out", fmt)
put(D, "A14", "Decisión Proyecto B: NO-GO a Habanos directo y a la oferta Behike; GO condicionado sólo para B3 tras validar exclusiva de fabricante y 10 cartas de interés de expendedurías especialistas.", "flag")
D.merge_cells("A14:D14")
widths(D, {"A": 60, "B": 20})

# ---- Fuentes
from sources import SOURCES
ids = {"S01", "S02", "S09", "S14", "S15", "S16", "S17", "S18", "S19", "S20", "S21", "S23", "S26", "S27", "S28", "S29", "S32", "S33", "S36", "S38", "N01", "N02"}
table(FU, 3, ["ID", "Fuente", "Dato", "Estado", "URL"], [(s[0], s[1], s[4], s[5], s[2]) for s in SOURCES if s[0] in ids], [6, 50, 70, 22, 60])
title(FU, "Fuentes (consulta 10/10/2026)")
wb.calculation.fullCalcOnLoad = True
wb.save(out_pi)

# =====================================================================  CUSTOMS & TAX MODEL
wb = Workbook()
C = wb.active
C.title = "Calculadora DUA"
title(C, "Modelo aduanero y fiscal de importación de cigarros (España, península y Baleares)",
      "Calculadora por envío y comparativa por origen. Valores azules editables. Canarias, Ceuta y Melilla tienen régimen distinto (no modelizado).")
legend(C, 3, 2)
inputs = [("Unidades del envío", 3000, NUM), ("Precio FOB por unidad (USD)", 6.0, NUM2), ("USD por EUR", 1.15, NUM2),
          ("Packaging por unidad si no está en FOB (€)", 1.81, EUR2), ("Flete internacional del envío (€)", 1500, EUR),
          ("Seguro (% sobre FOB+flete)", 0.005, PCT), ("PVP por unidad en expendeduría (€)", 24, EUR2),
          ("Tipo arancelario aplicable", 0.26, PCT), ("IEE ad valorem", 0.158, PCT), ("IEE mínimo €/1.000 u", 47, NUM2),
          ("IVA", 0.21, PCT), ("Despacho, agente, inspección (€)", 450, EUR), ("Marcas fiscales + UI (€/u)", 0.03, EUR2),
          ("IEE al importar (1) o en depósito fiscal (0)", 1, "0")]
for n, (lab, v, fmt) in enumerate(inputs):
    put(C, f"A{6+n}", lab)
    put(C, f"B{6+n}", v, "input", fmt)
calc = [("Valor FOB del envío (€)", "=B6*B7/B8+B6*B9"),
        ("Valor en aduana (CIF) (€)", "=(B20+B10)*(1+B11)"),
        ("Derecho arancelario (€)", "=B21*B13"),
        ("IEE devengado (€)", "=B6*MAX(B14*B12,B15/1000)"),
        ("IEE pagado en frontera (€)", "=B23*B19"),
        ("Base imponible IVA importación (€)", "=B21+B22+B24"),
        ("IVA importación (€) — recuperable", "=B25*B16"),
        ("Marcas fiscales + UI (€)", "=B6*B18"),
        ("Despacho (€)", "=B17"),
        ("TOTAL A DESEMBOLSAR EN FRONTERA (€)", "=B22+B24+B26+B27+B28"),
        ("Coste definitivo del envío sin IEE ni IVA (€)", "=B21+B22+B27+B28"),
        ("Coste definitivo por unidad (€)", "=B30/B6"),
        ("IEE por unidad (€)", "=B23/B6"),
        ("Impuestos del Estado por unidad sobre PVP: IVA + IEE + arancel (€)", "=B12*B16/(1+B16)+B32+B22/B6"),
        ("% del PVP que se lleva el Estado", "=B33/B12")]
for n, (lab, f) in enumerate(calc):
    r = 20 + n
    put(C, f"A{r}", lab)
    put(C, f"B{r}", f, "out" if "TOTAL" in lab or "%" in lab or "por unidad" in lab else "calc", PCT if "%" in lab else EUR2 if "unidad" in lab else EUR)
widths(C, {"A": 66, "B": 18})

O = wb.create_sheet("Comparativa por origen")
title(O, "Comparativa del coste por unidad según origen (mismo FOB y PVP de la calculadora)",
      "El origen afecta al arancel. El IEE y el IVA no dependen del origen. Preferencias sujetas a prueba de origen válida (REX/EUR.1) y confirmación TARIC.")
header(O, 4, ["Origen", "Régimen", "Arancel", "Estado", "Coste definitivo/u (€)", "Diferencia vs. Cuba (€/u)", "Diferencia por 10.000 u (€)"])
orig = [("Cuba", "Sin preferencia (tipo convencional)", 0.26, "PROBABLE"),
        ("República Dominicana", "EPA UE-CARIFORUM", 0.0, "PROBABLE"),
        ("Nicaragua / Honduras", "Acuerdo de Asociación UE-Centroamérica", 0.0, "PROBABLE"),
        ("Otros terceros países sin acuerdo", "Tipo convencional", 0.26, "PROBABLE")]
for n, (o, reg, d, st) in enumerate(orig):
    r = 5 + n
    put(O, f"A{r}", o)
    put(O, f"B{r}", reg)
    put(O, f"C{r}", d, "input", PCT)
    put(O, f"D{r}", st)
    put(O, f"E{r}", f"=('Calculadora DUA'!$B$21*(1+C{r})+'Calculadora DUA'!$B$27+'Calculadora DUA'!$B$28)/'Calculadora DUA'!$B$6", "out", EUR2)
    put(O, f"F{r}", f"=E{r}-$E$5", "calc", EUR2)
    put(O, f"G{r}", f"=F{r}*10000", "calc", EUR)
widths(O, {"A": 34, "B": 40, "C": 10, "D": 12, "E": 20, "F": 22, "G": 22})

R = wb.create_sheet("Obligaciones por operador")
title(R, "Obligaciones fiscales y regulatorias por figura (España)", "Diferenciar titular de marca, importador, distribuidor mayorista y expendedor.")
obl = [("Titular de marca / fabricante (aunque fabrique un tercero)", "Habilitación como fabricante ante el CMT (S17); notificación EU-CEG de ingredientes por marca y tipo (S29); solicitud de publicación de PVP en BOE (S18); etiquetado y advertencias conformes RD 579/2017 (S30); trazabilidad: registro de operador e identificadores únicos (S28)."),
       ("Importador", "EORI; DUA de importación; pago de arancel e IVA de importación; IEE al importar o depósito fiscal / destinatario registrado; marcas fiscales (Orden HAC/66/2024, S27); trazabilidad (S28); conservar prueba de origen."),
       ("Distribuidor mayorista", "Habilitación como distribuidor ante el CMT (S17); información mensual de ventas a expendedurías y anual; condiciones generales de distribución comunicadas; neutralidad y no discriminación entre expendedurías."),
       ("Expendedor (detallista)", "Concesión administrativa; venta al PVP publicado; margen legal (S15); prohibiciones de publicidad y promoción."),
       ("Todos", "Prohibición de publicidad, promoción y patrocinio de productos del tabaco (Ley 28/2005); prohibición de venta a distancia transfronteriza al consumidor (art. 18 Directiva 2014/40/UE, transpuesto); protección de datos de clientes profesionales.")]
table(R, 4, ["Figura", "Obligaciones principales (con fuente)"], obl, [46, 120])
wb.calculation.fullCalcOnLoad = True
wb.save(out_ct)
print("ok")
