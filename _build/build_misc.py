# -*- coding: utf-8 -*-
"""XLSX auxiliares: Decision Matrix, Naming, Technical Spec, 180-Day Plan, Risk Register,
Supplier & Distributor Research, Source Register, Evidence & Assumptions Log."""
import sys, os
from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule, ColorScaleRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L
from xstyle import *
from sources import SOURCES

ROOT = sys.argv[1]
P = lambda *a: os.path.join(ROOT, *a)


def scored_matrix(ws, start, options, criteria, scores, note=None):
    """criteria: [(name, weight)], scores: {option: [..]} ; fórmula SUMPRODUCT."""
    header(ws, start, ["Criterio", "Peso"] + options)
    for i, (c, w) in enumerate(criteria):
        r = start + 1 + i
        put(ws, f"A{r}", c)
        put(ws, f"B{r}", w, "input", PCT)
        for j, o in enumerate(options):
            put(ws, f"{L(3+j)}{r}", scores[o][i], "input", "0")
    r_end = start + len(criteria)
    rt = r_end + 1
    put(ws, f"A{rt}", "Suma de pesos (debe ser 100%)")
    put(ws, f"B{rt}", f"=SUM(B{start+1}:B{r_end})", "out", PCT)
    put(ws, f"A{rt+1}", "PUNTUACIÓN PONDERADA (1–5)")
    for j in range(len(options)):
        c = L(3 + j)
        put(ws, f"{c}{rt+1}", f"=SUMPRODUCT($B${start+1}:$B${r_end},{c}{start+1}:{c}{r_end})", "out", "0.00")
    put(ws, f"A{rt+2}", "Ranking")
    for j in range(len(options)):
        c = L(3 + j)
        put(ws, f"{c}{rt+2}", f"=RANK({c}{rt+1},$C${rt+1}:${L(2+len(options))}${rt+1})", "out", "0")
    ws.conditional_formatting.add(f"C{start+1}:{L(2+len(options))}{r_end}",
                                  ColorScaleRule(start_type="num", start_value=1, start_color="F8D7DA", mid_type="num", mid_value=3, mid_color="FFF3CD", end_type="num", end_value=5, end_color="D4EDDA"))
    if note:
        put(ws, f"A{rt+4}", note, "note")
    return rt + 2


# ================================================================ DECISION MATRIX
wb = Workbook()
ws = wb.active
ws.title = "Estrategias"
title(ws, "Matriz de decisión — Estrategias (Proyecto C)", "Puntuación 1–5 (5 = mejor para el inversor). Pesos y puntuaciones editables. Evaluación del equipo a 10/10/2026.")
opts = ["E1 Sólo marca propia (Cuba)", "E2 Sólo importación (no cubana)", "E3 Importación primero, marca después", "E4 Ambos en paralelo"]
crit = [("Capital necesario (5 = bajo)", 0.15), ("Barreras legales (5 = bajas)", 0.20), ("Tiempo hasta primer ingreso (5 = corto)", 0.10),
        ("Capacidad de control", 0.10), ("Dependencia de terceros (5 = baja)", 0.10), ("Complejidad operativa (5 = baja)", 0.05),
        ("Potencial de margen", 0.10), ("Necesidad de financiación externa (5 = baja)", 0.05), ("Riesgos principales (5 = bajos)", 0.05),
        ("Potencial de creación de valor", 0.05), ("Reversibilidad de la inversión", 0.05)]
sc = {opts[0]: [1, 1, 1, 2, 1, 2, 2, 1, 1, 4, 1], opts[1]: [4, 4, 4, 3, 3, 3, 3, 4, 4, 2, 4],
      opts[2]: [4, 4, 4, 3, 3, 3, 3, 3, 4, 4, 4], opts[3]: [1, 1, 3, 2, 1, 1, 3, 1, 1, 4, 2]}
end = scored_matrix(ws, 4, opts, crit, sc, "E2 y E3 empatan en el corto plazo; E3 se recomienda porque conserva la opción de marca propia (valor) sin comprometer capital hasta superar la Fase 0.")
r = end + 4
section(ws, r, "Justificación cualitativa", 6)
just = [("E1", "Bloqueo jurídico no resuelto (Habanos/Tabacuba); modelo financiero negativo en escenario Base; necesidad de financiación 130–210 k€; primer ingreso no antes de 2028."),
        ("E2", "Vía legal clara (habilitación CMT) para marcas no cubanas; Habanos no accesible. Capital 30–75 k€. Depende de obtener exclusivas de fabricantes."),
        ("E3", "Construye habilitaciones, relación con distribuidor y expendedurías, y caja; la marca propia se activa sólo si se cumplen las condiciones Go de la Fase 0."),
        ("E4", "Duplica costes fijos y atención directiva con un capital de 15–100 k€; concentra riesgo cubano y de circulante a la vez.")]
table(ws, r + 1, ["Estrategia", "Motivo"], just, [44, 12, 22, 22, 22, 22])
ws.column_dimensions["A"].width = 46
for c in "CDEF":
    ws.column_dimensions[c].width = 24

ws = wb.create_sheet("Posicionamiento")
title(ws, "Matriz ponderada de posicionamiento de marca", "A Luxury Heritage · B Contemporary Cuban Luxury · C Ultra-Limited Artisan")
opts_p = ["A Luxury Heritage", "B Contemporary Cuban Luxury", "C Ultra-Limited Artisan"]
crit_p = [("Diferenciación", 0.20), ("Coherencia con la realidad productiva", 0.15), ("Viabilidad reguladora", 0.15),
          ("Potencial comercial entre profesionales", 0.15), ("Coste de desarrollo (5 = bajo)", 0.05), ("Potencial de precio", 0.15),
          ("Escalabilidad", 0.10), ("Riesgo de dependencia del fabricante (5 = bajo)", 0.05)]
sc_p = {opts_p[0]: [2, 2, 2, 3, 3, 3, 3, 2], opts_p[1]: [4, 4, 4, 4, 3, 4, 4, 3], opts_p[2]: [4, 3, 4, 3, 2, 5, 1, 2]}
scored_matrix(ws, 4, opts_p, crit_p, sc_p, "Seleccionado: B, incorporando de C la numeración por pliegos (lotes) — el modelo financiero exige PVP ≥ 24 €.")
ws.column_dimensions["A"].width = 50
for c in "CDE":
    ws.column_dimensions[c].width = 26

ws = wb.create_sheet("Estructura societaria")
title(ws, "Comparativa de estructuras societarias", "Considera el traslado real del promotor a Andorra en 2027. No se propone ninguna estructura por menor tributación aparente.")
opts_s = ["1 SL española titular + contratante", "2 SL española + importador/mayorista subcontratado", "3 SL con todas las habilitaciones propias", "4 Sociedad andorrana titular + SL operativa", "5 Licencia de marca a tercero habilitado"]
crit_s = [("Coste de cumplimiento (5 = bajo)", 0.20), ("Riesgo fiscal: dirección efectiva, EP, vinculadas (5 = bajo)", 0.25), ("Complejidad (5 = baja)", 0.15),
          ("Control del negocio y de la marca", 0.15), ("Adecuación al traslado a Andorra", 0.10), ("Escalabilidad y venta futura", 0.15)]
sc_s = {opts_s[0]: [4, 4, 4, 4, 3, 4], opts_s[1]: [4, 4, 4, 4, 4, 4], opts_s[2]: [2, 4, 2, 5, 2, 4], opts_s[3]: [2, 1, 1, 4, 4, 3], opts_s[4]: [5, 4, 4, 2, 4, 2]}
scored_matrix(ws, 4, opts_s, crit_s, sc_s, "Recomendado: 2 (SL española titular de la marca con habilitación como fabricante; logística, depósito fiscal y distribución subcontratados a operador habilitado). La opción 4 sólo con sustancia real en Andorra y precios de transferencia documentados.")
ws.column_dimensions["A"].width = 58
for c in "CDEFG":
    ws.column_dimensions[c].width = 22

ws = wb.create_sheet("Decisiones pendientes")
title(ws, "Matriz de decisiones pendientes del promotor", "Cada decisión indica qué información falta y quién debe facilitarla.")
dec = [
    ("D01", "Autorizar la Fase 0 (due diligence jurídica Cuba)", "Sí / No", "Sí: coste acotado (≈6–10 k€) frente a un riesgo de pérdida total", "Presupuesto y elección de abogados", "Promotor", "Semana 1", "—"),
    ("D02", "Identidad completa de la empresa cubana que menciona el torcedor", "—", "Obtener razón social, NIT, objeto social y licencias", "Datos del torcedor y documentos de la empresa", "Torcedor → promotor", "Semana 2", "D01"),
    ("D03", "Aceptar o rechazar que Habanos/Cubatabaco sea titular o cotitular de la marca", "Aceptar / Rechazar / Licencia con recompra", "Rechazar titularidad; valorar licencia sólo si la marca vuelve al promotor", "Respuesta escrita de la contraparte cubana", "Promotor + abogado", "Fin Fase 0", "D02"),
    ("D04", "Rechazo formal de la oferta de Behike 56 a 50 €/caja", "—", "Rechazar por escrito y no mantener contacto comercial", "—", "Promotor", "Inmediato", "—"),
    ("D05", "Estructura societaria", "Opciones 1–5", "Opción 2 (SL española + operador habilitado)", "Asesoría fiscal España-Andorra sobre residencia y dirección efectiva", "Promotor + asesor fiscal", "Antes de constituir", "D01"),
    ("D06", "Momento y forma del traslado a Andorra", "—", "Planificar con asesor; no condicionar la estructura a ahorro fiscal", "Fecha prevista, actividad en Andorra, patrimonio", "Promotor", "T1 2027", "—"),
    ("D07", "Lanzar en paralelo la vía B3 (importación no cubana)", "Sí / No / Más tarde", "Sí, sólo validación comercial sin capital (cartas de interés)", "Lista de fabricantes sin distribución en España", "Promotor", "Mes 2", "—"),
    ("D08", "Nombre de marca definitivo", "ARNALDO / FOLIO / LUMBRE", "ARNALDO (decidido por el promotor 10/10/2026), condicionado a consentimiento de Arnaldo e informe de registrabilidad", "Búsqueda EUIPO/OEPM/OCPI por agente", "Promotor + agente de marcas", "Mes 2", "D01"),
    ("D09", "Presupuesto máximo comprometido antes de la primera importación", "15–100 k€", "≤ 20 k€ hasta cumplir condiciones Go", "Resultado Fase 0 + cotización FOB", "Promotor", "Fin Fase 0", "D01–D03"),
    ("D11", "Contraprestación de Arnaldo por nombre y colaboración", "A royalty 2% / B equity 10% con vesting / C mixta", "B o C: equity con vesting alinea incentivos sin consumir caja", "Dictamen cubano sobre cobro legal; autorización del empleador", "Promotor + abogados", "Fase 0", "D02, D10"),
    ("D10", "Papel y retribución legal del torcedor", "Consultor vía entidad / empleado / socio", "Sólo a través de la entidad autorizada y con permiso de su empleador", "Normativa laboral cubana y autorización del empleador", "Abogado cubano", "Fase 0", "D02"),
    ("D12", "Propuesta a inversores: importe, tramos e instrumento", "Sin inversores hasta el Go / tramos condicionados a C1–C8 / socio estratégico", "Tramos: Fase 0 con capital propio; capital externo sólo tras el Go y por hitos", "Resultado de la Fase 0; aportación del promotor; perfil de inversor buscado", "Promotor", "Antes de presentar a inversores", "D01, D09"),
    ("D13", "Origen alternativo de ARNALDO (R. Dominicana / Nicaragua) si la vía cubana no se abre", "Sí / No / Sólo como plan B", "Plan B documentado: mejora el coste ≈2 €/u (arancel 0%), pero cambia el posicionamiento y el papel de Arnaldo", "Cotizaciones de fabricantes no cubanos; encaje legal de Arnaldo", "Promotor", "Comité Go/No-Go", "D01, D10"),
]
table(ws, 4, ["ID", "Decisión", "Opciones", "Recomendación", "Información que falta", "Quién", "Plazo", "Depende de"], dec, [6, 44, 26, 48, 44, 22, 14, 12])

ws = wb.create_sheet("Condiciones Go-NoGo")
title(ws, "Condiciones verificables para avanzar (CONDITIONAL GO)", "Marcar 1 cuando exista la evidencia documental indicada. El estado global se calcula.")
conds = [
    ("C1", "Documento oficial cubano que identifique la entidad autorizada a fabricar y exportar cigarros para una marca de titularidad extranjera", "Certificación / licencia / carta de Habanos S.A. o del organismo competente"),
    ("C2", "Confirmación escrita de que la marca puede ser 100% propiedad de la sociedad del promotor en Cuba y en la UE", "Cláusula aceptada en term sheet + búsqueda OCPI"),
    ("C3", "Cotización FOB firme por vitola y volumen, compatible con FOB ≤ 5 USD a PVP 24 € (o PVP superior validado)", "Oferta firmada con validez ≥ 90 días"),
    ("C4", "Vía de pago verificada con banco español (y cubano) para el importe del primer pedido y dictamen de sanciones UE/EE. UU. sobre la contraparte y el flujo de pagos", "Carta/correo del banco + dictamen de abogado de sanciones"),
    ("C5", "Distribuidor mayorista habilitado dispuesto a distribuir la marca (condiciones y tarifa)", "Carta de intención"),
    ("C6", "≥ 10 expendedurías especialistas con interés por escrito", "Cartas de interés B2B"),
    ("C7", "Informe de registrabilidad de la marca en clase 34 (UE y Cuba) sin oposiciones previsibles", "Informe de agente de marcas"),
    ("C8", "Capital disponible ≥ necesidad máxima del escenario Conservador + 25%", "Model 'Scenarios'"),
]
header(ws, 4, ["ID", "Condición", "Evidencia exigida", "Cumplida (1/0)"])
for n, (i, c, e) in enumerate(conds):
    r = 5 + n
    put(ws, f"A{r}", i)
    put(ws, f"B{r}", c)
    put(ws, f"C{r}", e)
    put(ws, f"D{r}", 0, "input", "0")
    for cc in "BC":
        ws[f"{cc}{r}"].alignment = WRAP
put(ws, "B14", "Condiciones cumplidas")
put(ws, "D14", "=SUM(D5:D12)", "out", "0")
put(ws, "B15", "DECISIÓN AUTOMÁTICA")
put(ws, "D15", '=IF(D14=8,"GO a primer pedido piloto",IF(AND(D5=1,D6=1),"CONDITIONAL GO: continuar Fases 1–3","NO-GO a compromiso de capital: sólo Fase 0"))', "flag")
widths(ws, {"A": 6, "B": 80, "C": 50, "D": 40})
wb.save(P("00_EXECUTIVE", "Decision Matrix.xlsx"))

# ================================================================ NAMING
wb = Workbook()
ws = wb.active
ws.title = "Naming"
title(ws, "Naming & Trademark Research — búsqueda PRELIMINAR (no es informe de registrabilidad)",
      "Colisiones: búsqueda web 10/10/2026 en fuentes del sector. EUIPO/OEPM/OCPI no consultados directamente (acceso bloqueado en el entorno): PENDIENTE por agente de marcas.")
crit = [("Singularidad", 0.15), ("Memorabilidad", 0.15), ("Pronunciación internacional", 0.10), ("Adecuación premium", 0.15),
        ("Riesgo fonético/cultural (5 = bajo)", 0.10), ("Colisión tabaco (5 = ninguna hallada)", 0.20), ("Compatibilidad DO/publicidad (5 = sin problemas)", 0.15)]
names = [
    ("ARNALDO", "Nombre del torcedor que participa en el proyecto: autenticidad real, firma como logotipo; requiere consentimiento escrito y licencia de nombre/imagen.", [3, 5, 5, 5, 4, 4, 5], "Ninguna marca de puros hallada; posible asociación con Arnaldo Vichot (ex maestro ligador de Partagás, †2026); marca de tabaco similar ARLONDO (Gryson)", "SELECCIONADO por el promotor — condicionado"),
    ("FOLIO", "Latín folium = hoja; en español 'hoja' es a la vez hoja de tabaco y página. Formatos bibliográficos (folio, cuarto, octavo) dan nombres de vitola.", [4, 5, 5, 5, 5, 4, 5], "Ninguna hallada en web (S—búsqueda 'Folio cigar')", "FINALISTA — reserva 1"),
    ("LUMBRE", "Fuego, luz; palabra española poco usada en marcas de tabaco.", [4, 4, 3, 4, 4, 4, 5], "Ninguna hallada", "FINALISTA — reserva 2"),
    ("VELADA", "Reunión nocturna; ritual de sobremesa.", [3, 4, 4, 4, 4, 4, 4], "Ninguna hallada", "Finalista descartado"),
    ("VERSO", "Verso / reverso de la página.", [3, 4, 5, 3, 4, 4, 5], "Ninguna hallada", "Descartado: menos distintivo"),
    ("COLOFÓN", "Nota final de un libro impreso; idea de 'firma' del lote.", [5, 3, 2, 4, 3, 3, 5], "No buscado", "Usado como nombre del documento interior"),
    ("CÁLAMO", "Caña de escritura; literario.", [4, 3, 2, 4, 3, 3, 5], "No buscado", "Descartado: pronunciación"),
    ("ALBEDO", "Reflectividad; ceniza blanca.", [4, 3, 4, 3, 4, 4, 4], "Ninguna hallada", "Descartado: frío, técnico"),
    ("ORIGO", "Origen (latín).", [3, 3, 4, 3, 4, 4, 2], "Ninguna hallada", "Descartado: alegación de origen sensible ante DO"),
    ("MATIZ", "Matiz aromático.", [3, 3, 2, 3, 3, 4, 5], "Ninguna hallada", "Descartado: 'z' difícil, genérico"),
    ("ARCANA", "Secretos; misterio.", [3, 4, 4, 3, 2, 4, 4], "Ninguna hallada", "Descartado: connotación esotérica"),
    ("SILENTE", "Silencioso; lujo discreto.", [3, 3, 3, 4, 4, 4, 5], "No buscado", "Descartado"),
    ("ALQUIMIA", "Transformación de la hoja.", [2, 3, 3, 3, 4, 4, 4], "Ninguna hallada", "Descartado: sobreexplotado en lujo"),
    ("AURELIA", "Dorada.", [2, 3, 4, 4, 4, 2, 5], "'Aurelius' (Tributary Cigars) — similar (S—búsqueda)", "Descartado: proximidad"),
    ("TERCIO", "Fardo de hojas en yagua.", [2, 3, 3, 3, 4, 2, 4], "Término de proceso usado por Macanudo 'Tercio-Aged'", "Descartado: descriptivo"),
    ("CUJE", "Vara de secado en casas de tabaco.", [3, 3, 2, 3, 3, 1, 4], "'El Cuje' en directorio de marcas", "Descartado: colisión"),
    ("YAGUA", "Hoja de palma real que envuelve tercios.", [3, 3, 3, 3, 4, 1, 4], "Marca de J.C. Newman (S39)", "EXCLUIDO: colisión directa"),
    ("EL LECTOR", "Tradición del lector de tabaquería (1865).", [2, 4, 3, 4, 4, 1, 4], "Vitola 'El Lector' de La Galera (S40)", "EXCLUIDO: colisión"),
    ("ESCOGIDA", "Selección de hojas.", [2, 3, 3, 3, 4, 1, 4], "Hoyo de Monterrey Escogidos; La Aurora Escogidos (S41)", "EXCLUIDO: colisión y descriptivo"),
    ("CAPOTE", "Hoja capote (capa intermedia).", [1, 3, 3, 2, 3, 2, 3], "Término genérico del sector", "EXCLUIDO: genérico"),
    ("TAPADO", "Cultivo bajo tela.", [1, 3, 3, 2, 3, 2, 3], "Término genérico del sector", "EXCLUIDO: genérico"),
    ("CASA HABANA / VUELTA ABAJO…", "Evocación geográfica.", [1, 4, 4, 3, 2, 1, 1], "'Cuba', 'La Habana' y derivados protegidos como IG para puros (OLG Múnich, S13)", "PROHIBIDO"),
]
header(ws, 4, ["Nombre", "Concepto / razón"] + [c for c, _ in crit] + ["Puntuación ponderada", "Colisiones halladas", "Estado"])
for i, (_, w) in enumerate(crit):
    put(ws, f"{L(3+i)}3", w, "input", PCT)
put(ws, "B3", "Pesos →")
for n, (nm, concept, s, coll, st) in enumerate(names):
    r = 5 + n
    put(ws, f"A{r}", nm, "out" if ("FINALISTA" in st or "SELECCIONADO" in st) else "calc")
    put(ws, f"B{r}", concept)
    ws[f"B{r}"].alignment = WRAP
    for i, v in enumerate(s):
        put(ws, f"{L(3+i)}{r}", v, "input", "0")
    put(ws, f"J{r}", f"=SUMPRODUCT($C$3:$I$3,C{r}:I{r})", "out", "0.00")
    put(ws, f"K{r}", coll)
    put(ws, f"L{r}", st, "flag" if st.startswith(("EXCLUIDO", "PROHIBIDO")) else ("out" if ("FINALISTA" in st or "SELECCIONADO" in st) else "calc"))
    ws[f"K{r}"].alignment = WRAP
widths(ws, {"A": 26, "B": 60, "C": 11, "D": 11, "E": 11, "F": 11, "G": 11, "H": 11, "I": 11, "J": 12, "K": 50, "L": 30})
ws.freeze_panes = "B5"

ws = wb.create_sheet("Registro y dominios")
title(ws, "Plan de verificación de registrabilidad y dominios (informativo)", "Los dominios NO se usarán como canal de venta de tabaco (prohibido). Sólo información corporativa B2B.")
plan = [("ARNALDO", "EUIPO (clase 34, 35)", "Idéntica y similar (ARNALDO, ARNALDO + apellido, ARLONDO, ARNAUD…) + firma como marca figurativa", "PENDIENTE", "Agente de marcas"),
        ("ARNALDO", "OEPM / OCPI / WIPO", "Nacional, Cuba (vía agente) e internacional; consentimiento de Arnaldo adjunto", "PENDIENTE", "Agente de marcas"),
        ("FOLIO", "EUIPO (clase 34, 35)", "Búsqueda idéntica y similar (FOLIO, FOLIUM, PHOLIO) + TMview", "PENDIENTE", "Agente de marcas"),
        ("FOLIO", "OEPM (clase 34)", "Búsqueda nacional + nombres comerciales", "PENDIENTE", "Agente de marcas"),
        ("FOLIO", "OCPI Cuba (clase 34)", "Vía Agente Oficial cubano (S42)", "PENDIENTE / BLOQUEADO hasta Fase 0", "Abogado cubano"),
        ("FOLIO", "WIPO Global Brand Database", "Marcas internacionales (Madrid) con efecto en UE", "PENDIENTE", "Agente de marcas"),
        ("FOLIO", "Dominios .com / .es / .eu", "Variantes con sufijo (p.ej. 'folio-cigars', 'foliotabacos'): sólo informativo", "PENDIENTE (no comprobado)", "Promotor"),
        ("LUMBRE", "EUIPO/OEPM/OCPI", "Igual que FOLIO", "PENDIENTE", "Agente"),
        ("VELADA", "EUIPO/OEPM/OCPI", "Igual que FOLIO; 'Velada' es palabra común: revisar distintividad", "PENDIENTE", "Agente")]
table(ws, 4, ["Nombre", "Registro", "Búsqueda", "Estado", "Responsable"], plan, [14, 30, 70, 30, 22])
put(ws, "A14", "Advertencia: una búsqueda web sin resultados NO acredita disponibilidad. Antes de producir anillas o cajas, encargar informe de registrabilidad y presentar solicitud EUIPO (tasa base 850 € 1 clase — N05).", "flag")
ws.merge_cells("A14:E14")
wb.save(P("01_BRAND", "Naming & Trademark Research.xlsx"))

# ================================================================ TECHNICAL SPEC TEMPLATE
wb = Workbook()
ws = wb.active
ws.title = "Ficha técnica vitola"
title(ws, "ARNALDO — Ficha técnica editable de vitola (a completar con el torcedor y la fábrica)",
      "No contiene recetas ni ligas inventadas. Campos 'Valor' en azul = a rellenar. Rangos marcados 'orientativo' deben validarse con la fábrica.")
spec = [
    ("Identificación", "Nombre de vitola comercial", "ARNALDO Nº 1 (inicial)", "Marca"),
    ("Identificación", "Vitola de galera (denominación de fábrica)", "Robusto (a confirmar por la fábrica)", "Fábrica"),
    ("Identificación", "Código interno", "FOL-OCT-01", "Marca"),
    ("Dimensiones", "Longitud (mm) y tolerancia", "124 mm ±2 mm (orientativo para Robusto)", "Fábrica"),
    ("Dimensiones", "Cepo / ring gauge (1/64\") y tolerancia", "50 ±1 (orientativo)", "Fábrica"),
    ("Dimensiones", "Peso objetivo por unidad (g) y tolerancia", "", "Fábrica"),
    ("Construcción", "Tipo de construcción (totalmente a mano, tripa larga)", "", "Torcedor / fábrica"),
    ("Construcción", "Método de bonchado (p.ej. entubado, libro)", "", "Torcedor"),
    ("Construcción", "Perilla / cabeza (p.ej. triple capa)", "", "Torcedor"),
    ("Hoja", "Capa: origen, finca/zona (si se permite declarar), corte, color", "", "Fábrica (dato)"),
    ("Hoja", "Capote: origen y tipo", "", "Fábrica (dato)"),
    ("Hoja", "Tripa: proporción ligero / seco / volado (%)", "", "Mezclador / fábrica"),
    ("Hoja", "Añada / tiempo de añejamiento de la hoja (meses)", "", "Fábrica"),
    ("Hoja", "Disponibilidad garantizada para N lotes (sí/no, cantidad)", "", "Fábrica — BLOQUEADO"),
    ("Calidad", "Resistencia al tiro (método e instrumento; rango aceptado)", "Definir con fábrica (medidor de tiro)", "Control de calidad"),
    ("Calidad", "Combustión: uniformidad, tiempo de fumada (min), ceniza (cm)", "", "Cata técnica"),
    ("Calidad", "Humedad del puro terminado (%)", "Definir con fábrica", "Control de calidad"),
    ("Calidad", "Defectos críticos (rotura de capa, tiro bloqueado, plaga)", "0 aceptados", "Control de calidad"),
    ("Calidad", "Defectos mayores / menores: AQL (ISO 2859-1, nivel II)", "Mayor 1,0 · Menor 2,5 (propuesta)", "Control de calidad"),
    ("Conservación", "Condiciones de almacén: temperatura / humedad relativa", "16–18 °C / 65–70 % HR (orientativo de industria)", "Logística"),
    ("Conservación", "Tratamiento antiplagas (Lasioderma) previo a expedición", "Congelación controlada: protocolo a acordar", "Fábrica"),
    ("Conservación", "Reposo/estabilización tras torcido y antes de embalar (días)", "", "Fábrica"),
    ("Embalaje", "Unidades por caja / tipo de caja / anilla / pie de anilla", "10 u · cedro · anilla ARNALDO (firma) + pie 'Pliego Nº'", "Marca"),
    ("Embalaje", "Colofón numerado incluido", "Sí", "Marca"),
    ("Trazabilidad", "Nº de pliego (lote) y fecha de torcido", "", "Fábrica"),
    ("Trazabilidad", "Identificador del torcedor (si el contrato lo permite)", "", "Fábrica / abogado"),
    ("Regulatorio", "Ingredientes y aditivos (para EU-CEG)", "Lista completa obligatoria", "Fábrica → importador"),
]
header(ws, 4, ["Bloque", "Campo", "Valor / especificación", "Responsable del dato", "Verificado por", "Fecha"])
for n, row in enumerate(spec):
    r = 5 + n
    for j, v in enumerate(row):
        c = ws.cell(row=r, column=1 + j, value=v)
        c.border = B_ALL
        c.alignment = WRAP
        if j == 2:
            c.font, c.fill = F_INPUT, FILL_INPUT
    for j in (4, 5):
        c = ws.cell(row=r, column=1 + j)
        c.font, c.fill, c.border = F_INPUT, FILL_INPUT, B_ALL
widths(ws, {"A": 14, "B": 56, "C": 46, "D": 24, "E": 18, "F": 12})
ws.freeze_panes = "A5"

ws = wb.create_sheet("Arquitectura vitolas")
title(ws, "Arquitectura preliminar de producto", "Una vitola de lanzamiento; extensiones sólo tras validar consistencia y venta.")
arch = [("Nº 1", "Robusto", "≈124 × 50 (orientativo)", "Lanzamiento 2028", "Formato más versátil del segmento; tiempo de fumada medio; menor consumo de capa que Churchill", "Media"),
        ("Nº 2", "Toro / Gordito", "≈150–156 × 50–52 (a definir)", "Extensión 2029 (si C1–C8)", "Más capa por unidad; mayor riesgo de tiro irregular en cepos grandes", "Media-alta"),
        ("Nº 3", "Churchill (Julieta No. 2)", "≈178 × 47 (orientativo)", "Edición limitada 2030", "Exige capa larga sin defectos; rendimiento de capa menor; torcedores de categoría superior", "Alta")]
table(ws, 4, ["Nombre ARNALDO", "Vitola de referencia", "Dimensiones mm × cepo", "Calendario", "Diferencias de fabricación", "Complejidad"], arch, [14, 24, 26, 24, 70, 14])

ws = wb.create_sheet("Plan QC por pliego")
title(ws, "Plan de control de calidad por pliego (lote)", "Muestreo según ISO 2859-1; criterios propuestos para negociar en el contrato.")
qc = [("Origen", "Dimensiones (longitud, cepo)", "Calibre y regla", "Muestra AQL nivel II", "Tolerancias de ficha", "Mayor"),
      ("Origen", "Peso", "Balanza 0,1 g", "Muestra AQL", "± tolerancia de ficha", "Menor"),
      ("Origen", "Tiro", "Medidor de tiro", "Muestra AQL", "Rango de ficha", "Mayor"),
      ("Origen", "Aspecto de capa (color, venas, roturas)", "Visual, luz normalizada", "100% en escogida", "Sin roturas; color homogéneo por caja", "Crítico/Mayor"),
      ("Origen", "Plaga (Lasioderma)", "Inspección + certificado de tratamiento", "Cada pliego", "0 indicios", "Crítico"),
      ("Origen", "Cata técnica ciega (3 catadores)", "Ficha de cata", "5 u por pliego", "≥ puntuación mínima acordada", "Mayor"),
      ("Destino", "Humedad / estado tras transporte", "Higrómetro / inspección", "Muestra", "Sin moho ni secado", "Crítico"),
      ("Destino", "Etiquetado legal y marcas fiscales", "Checklist", "100% cajas", "Conforme RD 579/2017 y Orden HAC/66/2024", "Crítico"),
      ("Destino", "Correspondencia colofón ↔ pliego ↔ factura", "Checklist", "100% cajas", "Sin discrepancias", "Crítico")]
table(ws, 4, ["Punto", "Atributo", "Método", "Frecuencia", "Criterio de aceptación", "Clase de defecto"], qc, [10, 38, 30, 22, 44, 16])
put(ws, "A15", "Tasa de rechazo admisible por pliego (propuesta contractual: reposición a cargo del fabricante si supera el umbral)")
put(ws, "F15", 0.03, "input", PCT)

ws = wb.create_sheet("Registro de pliego")
title(ws, "Registro de pliego (lote) — plantilla", "Una fila por pliego.")
header(ws, 4, ["Nº pliego", "Vitola", "Fecha torcido", "Unidades torcidas", "Unidades rechazadas", "% rechazo", "Unidades expedidas", "Cajas (nº inicial–final)", "Tratamiento plaga (fecha)", "Cata (puntos)", "Factura / DUA", "Observaciones"])
for r in range(5, 25):
    for j in range(12):
        c = ws.cell(row=r, column=1 + j)
        c.border = B_ALL
        if j not in (5,):
            c.font, c.fill = F_INPUT, FILL_INPUT
    put(ws, f"F{r}", f'=IF(D{r}>0,E{r}/D{r},"")', "calc", PCT)
for j in range(12):
    ws.column_dimensions[L(1 + j)].width = 15

ws = wb.create_sheet("Ficha de cata")
title(ws, "Ficha de cata técnica (uso profesional interno)", "Escala 1–10 por atributo; sin finalidad promocional.")
attrs = ["Apariencia en frío", "Tiro", "Combustión", "Ceniza", "Primer tercio", "Segundo tercio", "Último tercio", "Complejidad", "Equilibrio", "Persistencia", "Consistencia entre unidades"]
header(ws, 4, ["Atributo", "Catador 1", "Catador 2", "Catador 3", "Media"])
for n, a in enumerate(attrs):
    r = 5 + n
    put(ws, f"A{r}", a)
    for c in "BCD":
        put(ws, f"{c}{r}", None, "input", "0")
    put(ws, f"E{r}", f'=IF(COUNT(B{r}:D{r})>0,AVERAGE(B{r}:D{r}),"")', "calc", "0.0")
put(ws, f"A{6+len(attrs)}", "Puntuación media del pliego")
put(ws, f"E{6+len(attrs)}", f'=IF(COUNT(E5:E{4+len(attrs)})>0,AVERAGE(E5:E{4+len(attrs)}),"")', "out", "0.0")
widths(ws, {"A": 34, "B": 12, "C": 12, "D": 12, "E": 12})

ws = wb.create_sheet("Roles técnicos")
title(ws, "Torcedor ≠ mezclador: funciones necesarias", "")
roles = [("Torcedor", "Construcción: bonchado, aplicación de capa, perilla, consistencia dimensional y de tiro.", "Contacto del promotor"),
         ("Mezclador / maestro ligador", "Diseño de la liga (proporciones de ligero, seco, volado), selección de añadas, consistencia entre cosechas.", "A identificar en la fábrica"),
         ("Escogedor de capas", "Clasificación por color y calidad; homogeneidad de caja.", "Fábrica"),
         ("Control de calidad", "Muestreo, medición de tiro, catas, liberación de lotes.", "Fábrica + inspección independiente"),
         ("Responsable de almacén de hoja", "Disponibilidad y fermentación de hoja; garantiza suministro de la misma liga.", "Fábrica / Tabacuba — BLOQUEADO"),
         ("Responsable regulatorio UE", "Ingredientes EU-CEG, etiquetado, trazabilidad, marcas fiscales.", "SL española / consultor")]
table(ws, 4, ["Función", "Responsabilidad", "Quién"], roles, [30, 90, 36])
wb.save(P("01_BRAND", "Technical Specification Template.xlsx"))

# ================================================================ 180-DAY PLAN
wb = Workbook()
ws = wb.active
ws.title = "Plan 180 días"
title(ws, "Plan de ejecución de 180 días (26 semanas) — Proyecto A con vía B3 en validación",
      "Semana 1 = semana de aprobación de la Fase 0 por el promotor. 'Bloqueada' = depende de tercero o de un Go previo. Costes = HIPÓTESIS.")
cols = ["ID", "Fase", "Tarea", "Responsable", "Depende de", "Inicio (sem)", "Duración (sem)", "Fin (sem)", "Coste est. (€)", "Riesgo", "KPI / evidencia de finalización", "Criterio Go/No-Go", "Estado"]
tasks = [
    ("0.1", "F0 Viabilidad Cuba", "Contratar abogado cubano autorizado (bufete habilitado para extranjeros) y abogado español de comercio exterior", "Promotor", "D01", 1, 2, 1500, "Medio", "Cartas de encargo firmadas", "—", "Ejecutable ahora"),
    ("0.2", "F0 Viabilidad Cuba", "Obtener del torcedor la identidad completa de la empresa fabricante/exportadora (Cuestionario torcedor)", "Promotor", "—", 1, 2, 0, "Alto", "Razón social, NIT, objeto social, contacto oficial", "Sin identidad verificable → NO-GO", "Ejecutable ahora"),
    ("0.3", "F0 Viabilidad Cuba", "Enviar 'Solicitud de confirmación de capacidad legal de exportación' a la empresa y, en su caso, a Habanos S.A.", "Abogado cubano", "0.1, 0.2", 3, 4, 0, "Alto", "Respuesta escrita", "Negativa o silencio > 8 semanas → NO-GO A", "Bloqueada"),
    ("0.4", "F0 Viabilidad Cuba", "Due diligence documental de la fábrica (Cuestionario DD) y verificación en Gaceta Oficial de licencias", "Abogado cubano", "0.3", 5, 5, 3500, "Alto", "Informe jurídico Cuba", "Condiciones C1 y C2", "Bloqueada"),
    ("0.5", "F0 Viabilidad Cuba", "Consulta a MINCEX sobre si un operador privado o cooperativa puede exportar tabaco torcido tras DL 133/2026 y Res. MINCEX 2026", "Abogado cubano", "0.1", 3, 6, 1000, "Alto", "Respuesta / dictamen", "Confirma o descarta vías alternativas", "Bloqueada"),
    ("0.6", "F0 Viabilidad Cuba", "Dictamen sobre propiedad de la marca y uso de 'Hecho en Cuba' / DO Habanos", "Abogado cubano + agente marcas", "0.4", 8, 3, 1500, "Alto", "Dictamen escrito", "Condición C2", "Bloqueada"),
    ("0.9", "F0 Viabilidad Cuba", "Arnaldo: consentimiento escrito al uso de su nombre/firma, autorización de su empleador, firmas escaneadas y retrato opcional", "Promotor + abogado cubano", "0.2", 1, 3, 0, "Alto", "Consentimiento firmado + materiales", "Sin consentimiento → usar reserva FOLIO", "Ejecutable ahora"),
    ("2.6", "F2 Marca y producto", "Brief creativo a 3 estudios de packaging premium y selección", "Promotor", "0.9", 2, 4, 0, "Medio", "3 presupuestos", "Encargo ≤ 15 k€", "Ejecutable ahora"),
    ("0.7", "F0 Viabilidad Cuba", "Rechazo formal de la oferta Behike 56 (plantilla en 08_COMMUNICATIONS)", "Promotor", "—", 1, 1, 0, "Alto", "Correo enviado/archivado", "—", "Ejecutable ahora (requiere aprobación)"),
    ("0.8", "F0 Viabilidad Cuba", "Comité de decisión Fase 0", "Promotor", "0.3–0.6", 11, 1, 0, "—", "Acta con decisión", "Go si C1+C2; si no, activar plan alternativo", "Bloqueada"),
    ("1.1", "F1 España y estructura", "Dictamen fiscal España–Andorra (residencia, dirección efectiva, retribución)", "Asesor fiscal", "D06", 2, 4, 1500, "Medio", "Dictamen", "Estructura elegida", "Ejecutable ahora"),
    ("1.2", "F1 España y estructura", "Verificar con CMT requisitos de habilitación como fabricante/titular de marca y como importador", "Asesor regulatorio", "—", 2, 3, 500, "Bajo", "Correo/consulta del CMT", "—", "Ejecutable ahora"),
    ("1.3", "F1 España y estructura", "Confirmar TARIC 2402 10 00 (arancel, medidas Cuba) y EORI", "Agente de aduanas", "—", 2, 2, 0, "Bajo", "Extracto TARIC", "—", "Ejecutable ahora"),
    ("1.4", "F1 España y estructura", "Verificar margen expendedor vigente (texto consolidado Ley 13/1998) y precio BOE", "Asesor regulatorio", "—", 2, 1, 0, "Bajo", "Extracto BOE", "—", "Ejecutable ahora"),
    ("1.5", "F1 España y estructura", "Consulta bancaria: viabilidad de pagos a Cuba (transferencia / carta de crédito)", "Promotor", "—", 3, 3, 0, "Alto", "Respuesta del banco", "Condición C4", "Ejecutable ahora"),
    ("1.6", "F1 España y estructura", "Constituir SL (sólo tras Go Fase 0)", "Gestoría", "0.8, 1.1", 12, 3, 900, "Bajo", "Escritura + NIF", "—", "Bloqueada"),
    ("2.1", "F2 Marca y producto", "Encargar informe de registrabilidad ARNALDO (+ apellido y firma) y reservas FOLIO / LUMBRE (EUIPO, OEPM, OCPI)", "Agente de marcas", "D08", 3, 4, 900, "Medio", "Informe", "Condición C7", "Ejecutable ahora"),
    ("2.2", "F2 Marca y producto", "Solicitud de marca UE clase 34 (y 35 si procede)", "Agente de marcas", "2.1", 8, 1, 1100, "Medio", "Nº de solicitud", "—", "Ejecutable tras 2.1"),
    ("2.3", "F2 Marca y producto", "Ficha técnica con torcedor y fábrica (plantilla 01_BRAND)", "Torcedor + fábrica", "0.4", 9, 4, 0, "Medio", "Ficha completa firmada", "Datos completos", "Bloqueada"),
    ("2.4", "F2 Marca y producto", "Prototipos (3 ligas × 20 u) y cata ciega", "Fábrica", "2.3", 13, 6, 1500, "Alto", "Fichas de cata", "Puntuación ≥ umbral", "Bloqueada"),
    ("2.5", "F2 Marca y producto", "Diseño profesional (Ruta A v2 con la firma real) y artes finales de anilla, caja y colofón con advertencias sanitarias; encargo de 4.000–15.000 €, se presupuesta el mínimo", "Diseñador", "0.8, 2.1, 2.6", 12, 6, 4000, "Medio", "Artes aprobadas por asesor regulatorio", "Conformidad RD 579/2017", "Bloqueada (tras el Go de la Fase 0)"),
    ("3.1", "F3 Propuestas y contratación", "Solicitud de cotización FOB formal", "Promotor", "0.8", 12, 3, 0, "Alto", "Oferta firmada", "Condición C3", "Bloqueada"),
    ("3.2", "F3 Propuestas y contratación", "Negociar term sheet no vinculante", "Abogados", "3.1", 15, 4, 2000, "Alto", "Term sheet firmado", "Cláusulas PI aceptadas", "Bloqueada"),
    ("3.3", "F3 Propuestas y contratación", "Contrato de fabricación y suministro", "Abogados", "3.2", 19, 4, 2500, "Alto", "Contrato firmado", "—", "Bloqueada"),
    ("4.1", "F4 Regulatorio y logística", "Habilitación como fabricante/titular ante CMT", "Asesor regulatorio", "1.6", 15, 3, 300, "Bajo", "Resolución CMT", "—", "Bloqueada"),
    ("4.2", "F4 Regulatorio y logística", "Notificación EU-CEG de ingredientes (antes de comercializar)", "Asesor regulatorio", "2.3, 4.1", 18, 4, 1500, "Medio", "Acuse EU-CEG", "—", "Bloqueada"),
    ("4.3", "F4 Regulatorio y logística", "Alta en trazabilidad (códigos operador/instalación) y marcas fiscales", "Asesor regulatorio", "4.1", 18, 4, 300, "Medio", "Códigos asignados", "—", "Bloqueada"),
    ("4.4", "F4 Regulatorio y logística", "Contrato con transitario y agente de aduanas; seguro de mercancía", "Promotor", "3.3", 20, 3, 0, "Medio", "Ofertas firmadas", "—", "Bloqueada"),
    ("4.5", "F4 Regulatorio y logística", "Solicitud de publicación del PVP en BOE", "Asesor regulatorio", "4.1", 22, 3, 0, "Bajo", "Resolución en BOE", "Sin PVP publicado no hay venta", "Bloqueada"),
    ("5.1", "F5 Comercial B2B", "Lista de 40 expendedurías especialistas y entrevistas profesionales", "Promotor", "—", 4, 8, 600, "Medio", "40 contactos, 15 entrevistas", "—", "Ejecutable ahora"),
    ("5.2", "F5 Comercial B2B", "Cartas de interés de ≥10 expendedurías", "Promotor", "5.1, 2.4", 18, 6, 0, "Medio", "≥10 cartas", "Condición C6", "Bloqueada"),
    ("5.3", "F5 Comercial B2B", "Acuerdo con distribuidor mayorista habilitado", "Promotor", "4.1", 16, 6, 0, "Alto", "Carta de intención / contrato", "Condición C5", "Bloqueada"),
    ("5.4", "F5 Comercial B2B", "Vía B3: identificar 10 fabricantes no cubanos sin distribución en España y pedir condiciones", "Promotor", "D07", 4, 8, 0, "Medio", "10 respuestas", "≥2 exclusivas posibles", "Ejecutable ahora"),
    ("6.1", "F6 Primera operación", "Pedido piloto (≤1.000–3.000 u) sólo con C1–C8 cumplidas", "Promotor", "Todas", 24, 2, 0, "Alto", "Pedido y anticipo", "8/8 condiciones", "Bloqueada"),
    ("6.2", "F6 Primera operación", "Importación, control en destino, primeras ventas (fuera del horizonte de 180 días)", "Operador logístico", "6.1", 26, 1, 0, "Alto", "DUA + PVP en BOE", "—", "Bloqueada"),
]
header(ws, 4, cols + [f"S{w}" for w in range(1, 27)])
for n, t in enumerate(tasks):
    r = 5 + n
    (tid, ph, task, resp, dep, st, du, cost, risk, kpi, gng, status) = t
    vals = [tid, ph, task, resp, dep, st, du, None, cost, risk, kpi, gng, status]
    for j, v in enumerate(vals):
        c = ws.cell(row=r, column=1 + j, value=v)
        c.border = B_ALL
        c.alignment = WRAP
        if j in (5, 6, 8):
            c.font, c.fill = F_INPUT, FILL_INPUT
    put(ws, f"H{r}", f"=F{r}+G{r}-1", "calc", "0")
    put(ws, f"I{r}", cost, "input", EUR)
    for w in range(26):
        c = ws.cell(row=r, column=14 + w, value=f'=IF(AND({w+1}>=$F{r},{w+1}<=$H{r}),1,"")')
        c.font = Font(color="FFFFFF", size=8)
    if status.startswith("Bloq"):
        ws[f"M{r}"].font, ws[f"M{r}"].fill = F_FLAG, FILL_FLAG
    else:
        ws[f"M{r}"].font, ws[f"M{r}"].fill = F_OUT, FILL_OUT
last = 4 + len(tasks)
ws.conditional_formatting.add(f"N5:AM{last}", CellIsRule(operator="equal", formula=["1"], fill=PatternFill("solid", fgColor=TOBACCO)))
put(ws, f"H{last+2}", "Coste total estimado")
put(ws, f"I{last+2}", f"=SUM(I5:I{last})", "out", EUR)
widths(ws, {"A": 5, "B": 20, "C": 58, "D": 18, "E": 12, "F": 8, "G": 8, "H": 7, "I": 11, "J": 9, "K": 34, "L": 30, "M": 18})
for w in range(26):
    ws.column_dimensions[L(14 + w)].width = 3.2
ws.freeze_panes = "D5"

ws2 = wb.create_sheet("Vistas 30-60-90-180")
title(ws2, "Resumen por horizonte (calculado desde el plan)", "")
header(ws2, 4, ["Horizonte", "Semana fin", "Tareas que terminan", "de ellas ejecutables ahora", "Bloqueadas", "Coste acumulado (€)"])
for n, (h, w) in enumerate([("30 días", 4), ("60 días", 9), ("90 días", 13), ("180 días", 26)]):
    r = 5 + n
    put(ws2, f"A{r}", h)
    put(ws2, f"B{r}", w, "input", "0")
    put(ws2, f"C{r}", f"=COUNTIF('Plan 180 días'!$H$5:$H${last},\"<=\"&B{r})", "calc", "0")
    put(ws2, f"D{r}", f"=COUNTIFS('Plan 180 días'!$H$5:$H${last},\"<=\"&B{r},'Plan 180 días'!$M$5:$M${last},\"Ejecutable*\")", "calc", "0")
    put(ws2, f"E{r}", f"=COUNTIFS('Plan 180 días'!$H$5:$H${last},\"<=\"&B{r},'Plan 180 días'!$M$5:$M${last},\"Bloq*\")", "calc", "0")
    put(ws2, f"F{r}", f"=SUMIF('Plan 180 días'!$H$5:$H${last},\"<=\"&B{r},'Plan 180 días'!$I$5:$I${last})", "out", EUR)
r = 11
section(ws2, r, "Qué se hace en cada horizonte", 6)
hz = [("0–30 días", "Contratar abogados (0.1), identidad de la fábrica (0.2), rechazo Behike (0.7), dictamen fiscal arrancado (1.1), consultas CMT/TARIC/BOE (1.2–1.4), banco (1.5), informe de marcas (2.1), mapa de expendedurías y fabricantes B3 (5.1, 5.4)."),
      ("31–60 días", "Respuesta de capacidad legal (0.3), consulta MINCEX (0.5), DD documental en curso (0.4), solicitud EUIPO si informe favorable (2.2)."),
      ("61–90 días", "Dictamen de marca y DO (0.6), comité Fase 0 (0.8). Si NO-GO: activar vía B3 o marca en origen alternativo. Si GO: SL, cotización FOB, ficha técnica."),
      ("91–180 días", "Prototipos y catas, term sheet y contrato, habilitaciones CMT, EU-CEG, trazabilidad, PVP en BOE, cartas de interés y distribuidor. Pedido piloto sólo con 8/8 condiciones.")]
table(ws2, r + 1, ["Horizonte", "Contenido"], hz, [16, 120])
wb.save(P("07_OPERATIONS", "180-Day Execution Plan.xlsx"))

# ================================================================ RISK REGISTER
wb = Workbook()
ws = wb.active
ws.title = "Registro de riesgos"
title(ws, "Registro de riesgos — Proyectos A, B y C", "Probabilidad e impacto 1–5 (HIPÓTESIS del equipo). Puntuación = P × I. ≥15 crítico · 8–14 alto · ≤7 medio/bajo.")
risks = [
    ("R01", "Jurídico Cuba", "A", "No existe vía legal para fabricar y exportar una marca de titularidad extranjera", "Monopolio de exportación de Habanos S.A.; monopsonio de hoja de Tabacuba", 4, 5, "Promotor + abogado cubano", "Fase 0 antes de cualquier pago; confirmación escrita", "Negativa o silencio"),
    ("R02", "Jurídico Cuba", "A", "La contraparte exige titularidad/cotitularidad de la marca o derechos sobre el diseño", "Práctica de registro de marcas por Cubatabaco", 4, 5, "Abogado", "Cláusula de titularidad no negociable; licencia con recompra como máximo", "Borrador de contrato"),
    ("R03", "Jurídico Cuba", "A", "La empresa mencionada por el torcedor no está autorizada para exportar tabaco torcido", "Información de segunda mano", 3, 5, "Abogado cubano", "Verificar licencia y objeto social en documentos oficiales", "DD documental"),
    ("R04", "Laboral/IP Cuba", "A", "Conflicto con el empleador del torcedor por uso de recursos estatales o know-how", "Torcedor empleado por entidad estatal", 3, 4, "Abogado cubano", "Toda colaboración vía entidad autorizada y con permiso escrito", "Cuestionario torcedor"),
    ("R05", "Jurídico Cuba", "A", "Uso de 'Hecho en Cuba', 'Habano' o símbolos de la DO no autorizado", "Protección de IG/DO (S13)", 3, 4, "Agente de marcas", "Dictamen previo; no usar 'Habano' ni sellos de Habanos", "Revisión de artes"),
    ("R06", "Financiero", "A", "Coste FOB superior al umbral de viabilidad (≈5 USD a PVP 24 €)", "Sin cotización", 4, 4, "Promotor", "FOB máximo como condición C3", "Cotización"),
    ("R07", "Financiero", "A", "Necesidad de financiación > capital disponible (130–210 k€ en escenarios no optimistas)", "Pérdidas operativas + circulante (IEE anticipado, stock)", 4, 4, "Promotor", "No lanzar sin C8; lote piloto pequeño; depósito fiscal", "Model 'Scenarios'"),
    ("R08", "Pagos", "A/B", "Imposibilidad o retraso de pagos bancarios a Cuba", "Pocos corresponsales; restricciones (S35)", 4, 4, "Promotor", "Validar banco y carta de crédito antes del pedido", "Respuesta bancaria"),
    ("R09", "Sanciones", "A/B", "Exposición a sanciones EE.UU. (OFAC) por bancos/USD o socios estadounidenses", "Embargo; Reglamento de bloqueo (N06)", 2, 4, "Abogado", "No usar USD ni bancos con nexo EE.UU.; ningún socio US person", "Dictamen"),
    ("R10", "Sanciones", "B", "Cadena de distribución de Habanos afectada por sanciones UE (Tabacalera)", "Sanción UE a Chen Zhi (S21)", 4, 3, "Promotor", "No depender de Habanos para Proyecto B", "Prensa / DOUE"),
    ("R11", "Regulatorio UE/ES", "A/B", "Retraso en EU-CEG, habilitación CMT, trazabilidad o publicación de PVP", "Procedimientos secuenciales", 3, 3, "Asesor regulatorio", "Plan con holguras; no fijar fecha de venta antes de BOE", "Plan 180 días"),
    ("R12", "Regulatorio UE/ES", "A/B", "Subida de fiscalidad del tabaco (revisión Directiva, efectos 2028+)", "Propuesta 2025 (S31)", 3, 2, "Promotor", "Sensibilidad de PVP; posicionamiento premium menos afectado por mínimos", "DOUE"),
    ("R13", "Regulatorio UE/ES", "A/B", "Incumplimiento de publicidad/promoción (Ley 28/2005)", "Marketing al consumidor", 2, 4, "Promotor", "Comunicación exclusivamente B2B profesional", "Revisión de materiales"),
    ("R14", "Comercial", "A", "Expendedurías no aceptan una marca nueva cubana no-Habanos a ≥24 €", "Competencia de Habanos con reputación", 4, 4, "Promotor", "Cartas de interés (C6) antes de producir", "Entrevistas"),
    ("R15", "Comercial", "A/B", "Distribuidor habilitado rechaza la marca o exige tarifa elevada", "Poder de negociación del canal (Porter)", 3, 4, "Promotor", "Tabla volumen×tarifa; alternativas de distribuidor", "Carta de intención"),
    ("R16", "Operativo", "A", "Calidad inconsistente entre pliegos", "Variabilidad de hoja y torcedores", 3, 4, "Control de calidad", "Ficha técnica, AQL, catas, derecho de rechazo", "Registro de pliego"),
    ("R17", "Operativo", "A", "Disponibilidad de hoja de la misma liga no garantizada", "Cosecha por debajo de objetivo (S47); Tabacuba asigna hoja", 3, 4, "Fábrica", "Cláusula de reserva de hoja", "Contrato"),
    ("R18", "Operativo", "A/B", "Plaga, moho o daño en tránsito", "Clima, transporte", 2, 4, "Logística", "Tratamiento previo, embalaje, seguro", "Inspección en destino"),
    ("R19", "Operativo", "A", "Retrasos de producción/transporte (10+ meses)", "Energía, logística cubana", 4, 3, "Promotor", "Hitos de pago ligados a entrega; stock de seguridad", "Seguimiento"),
    ("R20", "Fraude", "B", "Oferta de Behike u otros Habanos a precio anómalo (falsificación/desvío)", "Precio ≈2% del PVP", 5, 5, "Promotor", "NO-GO absoluto; protocolo de procedencia", "—"),
    ("R21", "Penal/aduanero", "B", "Contrabando por importar sin DUA o en equipaje con fines comerciales", "Umbral penal 15.000 € tabaco (N01)", 2, 5, "Promotor", "Sólo importaciones declaradas y habilitadas", "—"),
    ("R29", "Marca / persona", "A", "Arnaldo retira su colaboración, fallece o entra en conflicto: la marca lleva su nombre", "Marca de nombre propio", 2, 5, "Abogado", "Licencia de nombre/firma irrevocable y transferible; cláusulas leaver y fallecimiento; derecho de recompra", "Cambio de actitud / situación laboral"),
    ("R30", "Marca / persona", "A", "El empleador de Arnaldo o una entidad cubana reclama la marca o su nombre (precedentes Davidoff y Vegas Robaina)", "Fabricación dentro del sistema estatal", 3, 5, "Abogado cubano", "Registro previo UE y Cuba a nombre de la SL; autorización escrita del empleador; cláusula de titularidad en contrato de fabricación", "Borrador de contrato"),
    ("R31", "Marca", "A", "Asociación con Arnaldo Vichot (ex maestro ligador de Partagás) o confusión con ARLONDO", "Nombre de pila común", 2, 3, "Agente de marcas", "Registrar con apellido y firma; no sugerir vínculo", "Informe de registrabilidad"),
    ("R22", "Marca", "A", "Oposición o colisión de la marca ARNALDO en clase 34", "Búsqueda preliminar no oficial", 2, 4, "Agente de marcas", "Informe de registrabilidad; reservas LUMBRE/VELADA", "Informe"),
    ("R23", "Fiscal", "C", "Recalificación de estructura andorrana (dirección efectiva, EP, vinculadas)", "Traslado del promotor", 3, 4, "Asesor fiscal", "Sustancia real; precios de transferencia; preferir SL española", "Dictamen"),
    ("R24", "Fiscal", "C", "Residencia fiscal del promotor en transición 2027 (doble residencia)", "Cambio de domicilio a mitad de año", 3, 3, "Asesor fiscal", "Certificado de residencia; CDI España–Andorra (S34)", "Certificado"),
    ("R25", "Divisa", "A", "Apreciación del USD frente al EUR", "Precio en USD", 3, 3, "Promotor", "Precio en EUR si es posible; cobertura", "Contrato"),
    ("R26", "Reputacional", "A/B", "Asociación con contraparte sancionada o con prácticas irregulares", "Ecosistema Habanos afectado por sanciones", 2, 4, "Promotor", "Screening de sanciones UE/ONU/OFAC de toda contraparte", "Informe de screening"),
    ("R27", "Dependencia", "A", "Dependencia total de un único fabricante estatal", "Estructura del sector", 4, 4, "Promotor", "Marca transferible; diseño y ficha técnica propiedad de la SL", "Contrato"),
    ("R28", "Salida", "C", "Dificultad de vender la marca (comprador limitado por origen Cuba y embargo de EE.UU.)", "Mercado de compradores reducido", 3, 3, "Promotor", "Construir valor en UE/Asia; documentación de marca impecable", "—"),
]
header(ws, 4, ["ID", "Categoría", "Proyecto", "Riesgo", "Causa", "Prob. (1-5)", "Impacto (1-5)", "Puntuación", "Nivel", "Responsable", "Mitigación", "Indicador de alerta"])
for n, rk in enumerate(risks):
    r = 5 + n
    vals = list(rk[:5]) + [rk[5], rk[6], None, None] + list(rk[7:])
    for j, v in enumerate(vals):
        c = ws.cell(row=r, column=1 + j, value=v)
        c.border = B_ALL
        c.alignment = WRAP
        if j in (5, 6):
            c.font, c.fill = F_INPUT, FILL_INPUT
    put(ws, f"H{r}", f"=F{r}*G{r}", "out", "0")
    put(ws, f"I{r}", f'=IF(H{r}>=15,"Crítico",IF(H{r}>=8,"Alto","Medio/bajo"))', "calc")
last = 4 + len(risks)
ws.conditional_formatting.add(f"I5:I{last}", CellIsRule(operator="equal", formula=['"Crítico"'], fill=FILL_FLAG))
ws.conditional_formatting.add(f"H5:H{last}", ColorScaleRule(start_type="num", start_value=1, start_color="D4EDDA", mid_type="num", mid_value=10, mid_color="FFF3CD", end_type="num", end_value=25, end_color="F8D7DA"))
widths(ws, {"A": 5, "B": 16, "C": 8, "D": 50, "E": 38, "F": 8, "G": 8, "H": 10, "I": 11, "J": 20, "K": 50, "L": 22})
ws.freeze_panes = "E5"
put(ws, f"D{last+2}", "Riesgos críticos")
put(ws, f"H{last+2}", f'=COUNTIF(I5:I{last},"Crítico")', "out", "0")

ws = wb.create_sheet("Matriz regulatoria")
title(ws, "Matriz de riesgos regulatorios por jurisdicción", "Estado según convención del proyecto.")
reg = [
    ("Cuba", "Exportación de puros premium canalizada por Habanos S.A.", "Determina quién puede exportar la marca", "PROBABLE (S01, S05)", "Confirmación escrita (Fase 0)"),
    ("Cuba", "Tabacuba: comprador exclusivo de hoja; dirige la actividad", "Acceso a hoja sólo vía sistema estatal", "PROBABLE (S05, S46)", "DD fábrica"),
    ("Cuba", "DL 133/2026: mipymes pueden importar/exportar con autorización MINCEX", "Posible vía privada, pero producción de tabaco históricamente prohibida a mipymes (S44)", "VERIFICADO (norma) / BLOQUEADO (aplicación al tabaco)", "Consulta MINCEX"),
    ("Cuba", "Res. 98/2022 MINAG: exportación de tabaco torcido", "Fuera de canales autorizados = exportación ilegal", "PROBABLE (S09)", "Obtener texto en Gaceta"),
    ("Cuba", "DL 203/1999 de marcas; registro OCPI vía agente oficial", "Necesario registrar ARNALDO (a nombre de la SL) en Cuba", "PROBABLE (S42)", "Agente oficial"),
    ("Cuba", "DL 128/2026 (Ley 118 inversión extranjera)", "Empresa mixta = inversión desproporcionada para 15–100 k€", "VERIFICADO (S07)", "—"),
    ("UE", "Directiva 2014/40/UE (TPD): ingredientes, advertencias, trazabilidad, venta a distancia", "Obligaciones de titular/importador", "PROBABLE (N03)", "Asesor regulatorio"),
    ("UE", "Reg. Ejec. 2018/574 trazabilidad (cigarros desde 20/05/2024)", "Identificadores únicos y elementos de seguridad", "VERIFICADO (S28)", "Alta en sistema"),
    ("UE", "Arancel 2402 10 00 (26% convencional)", "Coste ≈2 €/u en origen Cuba", "PROBABLE (S32)", "TARIC"),
    ("UE", "Agotamiento regional de marca (Reg. 2017/1001)", "Importación paralela de Habanos desde fuera del EEE prohibida sin consentimiento", "PROBABLE (N02)", "—"),
    ("UE", "Sanciones UE a Chen Zhi (30/07/2026)", "Afecta distribuidor exclusivo de Habanos", "VERIFICADO (S21)", "Screening"),
    ("UE", "Revisión Directiva fiscalidad tabaco (efectos 2028)", "Mínimos más altos (cigarros)", "PROBABLE (S31)", "Seguimiento"),
    ("España", "Ley 13/1998 y RD 1199/1999: habilitaciones, monopolio minorista", "Canal obligatorio vía expendedurías", "VERIFICADO (S16, S17, S26)", "Habilitación"),
    ("España", "IEE cigarros 15,8% PVP, mín. 47 €/1.000", "≈15,8% del PVP", "VERIFICADO (S14)", "—"),
    ("España", "Margen expendedor cigarros 9%", "≈9% del PVP", "PROBABLE (S15)", "Texto consolidado"),
    ("España", "Marcas fiscales en cigarros (Orden HAC/66/2024)", "Coste y logística de precintas", "VERIFICADO (S27)", "Solicitud"),
    ("España", "RD 579/2017 etiquetado y advertencias", "Diseño de caja condicionado", "VERIFICADO (S30) / % exactos PENDIENTES", "Revisión artes"),
    ("España", "Ley 28/2005 publicidad del tabaco", "Sin marketing al consumidor", "PROBABLE", "Revisión materiales"),
    ("España", "LO 12/1995 contrabando", "Exposición penal ≥15.000 €", "PROBABLE (N01)", "—"),
    ("EE.UU.", "CACR / OFAC (embargo a Cuba)", "Bancos, USD, personas estadounidenses", "PROBABLE (N06)", "Dictamen"),
    ("Andorra", "Impuesto sobre Sociedades 10%; CDI con España (2015)", "Estructuras sólo con sustancia", "HIPÓTESIS (N07) / VERIFICADO (S34)", "Asesor andorrano"),
]
table(ws, 4, ["Jurisdicción", "Norma / hecho", "Impacto en el proyecto", "Estado (fuente)", "Acción"], reg, [12, 60, 60, 30, 24])
wb.save(P("07_OPERATIONS", "Risk Register.xlsx"))

# ================================================================ SUPPLIER & DISTRIBUTOR RESEARCH
wb = Workbook()
ws = wb.active
ws.title = "Operadores"
title(ws, "Operadores, organismos y contactos públicos — investigación a 10/10/2026",
      "No se inventan contactos. 'Web' sólo cuando la existencia de la entidad está verificada; los contactos directos se obtendrán por canales oficiales. Ninguna entidad ha confirmado aceptar el proyecto.")
ops = [
    ("Habanos S.A.", "Cuba", "Comercialización y exportación mundial de puros premium cubanos", "habanos.com", "Fuente S01, S36", "Formulario/contacto corporativo de la web", "Confirmar si fabrica/exporta marcas de terceros y condiciones", "¿Existe programa de fabricación para marca de titularidad extranjera? ¿Condiciones de titularidad?", "Puede ser la única vía; conflicto de interés con marcas propias", "Existencia VERIFICADA; contacto PENDIENTE"),
    ("Grupo Empresarial de Tabaco de Cuba (Tabacuba)", "Cuba", "Dirige la actividad tabacalera; comprador de hoja; abastece a Habanos", "No verificada", "S05, S46", "Vía MINAG o abogado cubano", "Autorización de fábrica y asignación de hoja", "¿Qué fábrica podría producir? ¿Asignación de hoja para marca externa?", "Monopsonio de hoja", "Existencia VERIFICADA (secundaria); web PENDIENTE"),
    ("Corporación Habanos / Cubatabaco", "Cuba", "Titular de marcas cubanas (p.ej. Cohiba)", "No verificada", "S13", "Vía abogado", "Política de titularidad de marcas fabricadas en Cuba", "¿Exige registro a su nombre?", "Riesgo de pérdida de la marca", "Existencia VERIFICADA (secundaria)"),
    ("MINCEX — Ministerio del Comercio Exterior y la Inversión Extranjera", "Cuba", "Autorización de comercio exterior (DL 133/2026); inversión extranjera", "mincex.gob.cu (portal VUCE vuceregulaciones.mincex.gob.cu)", "S03, S04", "Portal de trámites VUCE", "Dictamen sobre exportación de tabaco por operadores no estatales", "¿El tabaco torcido está en la lista de productos no comerciables directamente?", "Respuesta lenta; discrecionalidad", "Existencia VERIFICADA"),
    ("Gaceta Oficial de la República de Cuba", "Cuba", "Publicación de normas", "gacetaoficial.gob.cu", "S03", "Web", "Textos oficiales (DL 133/2026, Res. 98/2022)", "—", "—", "VERIFICADA"),
    ("OCPI — Oficina Cubana de la Propiedad Industrial", "Cuba", "Registro de marcas", "No verificada en esta sesión", "S42", "Vía Agente Oficial", "Registro ARNALDO clase 34 en Cuba", "Búsqueda de anterioridades; plazos y tasas", "Requiere agente", "Existencia PROBABLE"),
    ("Bufetes cubanos habilitados para clientes extranjeros (p.ej. Bufete Internacional; Consultoría Jurídica Internacional)", "Cuba", "Representación legal y de propiedad industrial de extranjeros", "No verificada", "S42 (secundaria)", "Por recomendación de la Embajada/Oficina Comercial", "Due diligence y dictámenes", "Honorarios, experiencia en tabaco, conflictos", "Independencia frente a entidades estatales", "PROBABLE — verificar"),
    ("Oficina Económica y Comercial de España en La Habana (ICEX)", "España/Cuba", "Apoyo a empresas españolas; información de mercado", "icex.es (red de Oficinas)", "Conocimiento general", "Canal oficial ICEX", "Contactos verificados de abogados, transitarios y operadores", "¿Experiencia de empresas españolas con fabricación tabacalera por encargo?", "—", "Existencia PROBABLE; contacto PENDIENTE"),
    ("Comisionado para el Mercado de Tabacos (CMT)", "España", "Habilitaciones, precios BOE, estadísticas", "hacienda.gob.es (Áreas temáticas › CMTabacos)", "S17, S18, S25", "Sede electrónica / correo institucional de la web", "Habilitación fabricante/titular e importador; publicación de PVP", "Requisitos documentales; plazos; marcas fiscales", "—", "VERIFICADA"),
    ("AEAT — Aduanas e Impuestos Especiales", "España", "DUA, EORI, IEE, depósitos fiscales", "sede.agenciatributaria.gob.es", "S14", "Sede electrónica", "EORI; régimen de IEE; destinatario registrado/depósito", "¿Depósito fiscal propio o de tercero?", "—", "VERIFICADA"),
    ("Ministerio de Sanidad — EU-CEG", "España/UE", "Notificación de ingredientes; etiquetado", "sanidad.gob.es", "S29", "Web", "Alta en EU-CEG; plazos", "Plazo previo a comercialización; tasas", "—", "VERIFICADA"),
    ("FNMT-Real Casa de la Moneda", "España", "Elementos de autenticación de marcas fiscales", "fnmt.es", "S27", "Web", "Precintas y costes", "Coste por unidad; plazos", "—", "Existencia VERIFICADA; papel de emisor UI PENDIENTE"),
    ("EUIPO / OEPM", "UE / España", "Registro de marcas", "euipo.europa.eu / oepm.es", "N05", "Online", "Registro ARNALDO", "—", "—", "VERIFICADA"),
    ("Compañía de Distribución Integral Logista", "España", "Distribución mayorista de labores de tabaco a expendedurías", "logista.com", "S26 (secundaria de prensa)", "Área comercial de la web", "Distribución y depósito fiscal", "Tarifa, mínimos, requisitos de alta de una marca nueva", "Poder de negociación", "Existencia VERIFICADA; condiciones PENDIENTES"),
    ("Tabacalera S.L.U.", "España", "Distribuidor exclusivo de Habanos (salvo Canarias)", "No verificada", "S21, S23", "—", "Ninguna (Proyecto B no accesible)", "—", "Sujeta a sanciones UE indirectas (2026)", "VERIFICADA (secundaria) — NO CONTACTAR comercialmente sin screening"),
    ("Listado de distribuidores habilitados del CMT", "España", "Alternativas a Logista", "hacienda.gob.es (CMT)", "S17", "Consulta CMT", "Identificar 3 distribuidores para marcas premium", "—", "—", "PENDIENTE"),
    ("Agentes de aduanas / transitarios con experiencia en tabaco y Cuba", "España", "Despacho, transporte, seguro", "—", "—", "Vía ICEX / Consejo General de Agentes de Aduanas", "Cotización de flete aéreo/marítimo y despacho", "Experiencia en IEE y marcas fiscales", "—", "PENDIENTE (no se nombran empresas sin verificar)"),
    ("Bancos con relación de corresponsalía con Cuba (BBVA, Banco Sabadell, CaixaBank citados en prensa)", "España", "Pagos y cartas de crédito", "Webs corporativas", "S35 (secundaria)", "Gestor de empresa", "Confirmar si aceptan pagos de importación desde Cuba", "Carta de crédito; KYC; plazos", "Políticas de cumplimiento restrictivas", "PROBABLE — confirmar con cada banco"),
    ("Procigar (asociación de fabricantes dominicanos de cigarros premium)", "R. Dominicana", "Fabricantes que exportan legalmente a la UE (vía B3)", "No verificada", "Conocimiento general", "Web/ferias del sector", "Fabricantes sin distribución en España", "¿Exclusiva para España? ¿Volúmenes mínimos?", "—", "PROBABLE"),
    ("Govern d'Andorra — Tributs i Fronteres", "Andorra", "Fiscalidad y régimen aduanero del tabaco en Andorra", "govern.ad", "N07", "Web", "Residencia del promotor; sociedad andorrana", "Requisitos de sustancia; régimen del tabaco", "—", "Existencia PROBABLE"),
]
table(ws, 4, ["Entidad", "País", "Función", "Web oficial", "Evidencia", "Contacto profesional público", "Necesidad que resuelve", "Preguntas", "Riesgos / limitaciones", "Estado de verificación"], ops,
      [40, 12, 40, 34, 18, 30, 36, 46, 32, 30])
wb.save(P("07_OPERATIONS", "Supplier & Distributor Research.xlsx"))

# ================================================================ SOURCE REGISTER
wb = Workbook()
ws = wb.active
ws.title = "Fuentes"
title(ws, "Registro de fuentes — consulta 10/10/2026", "Acceso mediante motor de búsqueda; descarga directa de páginas bloqueada por la política de red del entorno. 'N' = norma citada por conocimiento del equipo, no releída hoy.")
table(ws, 4, ["ID", "Título", "URL", "Tipo", "Dato utilizado", "Estado", "Fecha consulta"], [(s[0], s[1], s[2], s[3], s[4], s[5], "10/10/2026") for s in SOURCES],
      [6, 50, 50, 20, 70, 24, 12])
wb.save(P("09_RESEARCH", "Source Register.xlsx"))

# ================================================================ EVIDENCE & ASSUMPTIONS LOG
wb = Workbook()
ws = wb.active
ws.title = "Evidencias y supuestos"
title(ws, "Registro de evidencias y supuestos", "Cada afirmación material del dossier con su clasificación, fuente e impacto.")
ev = [
    ("E01", "Habanos S.A. es el canal exclusivo de comercialización y exportación de puros premium cubanos", "VERIFICADO", "S01, S05", "Crítico", "Confirmar si existe excepción para marcas de terceros"),
    ("E02", "Tabacuba mantiene el monopolio de compra de hoja tras las reformas de 2026", "PROBABLE", "S05", "Alto", "Abogado cubano"),
    ("E03", "DL 133/2026 permite a mipymes exportar con autorización MINCEX", "VERIFICADO", "S03, S04", "Medio", "Lista de productos excluidos"),
    ("E04", "La producción de tabaco estaba prohibida a mipymes", "PROBABLE", "S44", "Alto", "Verificar vigencia tras 2026"),
    ("E05", "Existen precedentes de marcas extranjeras fabricadas en Cuba (Davidoff 1968/69–1990/91; Dunhill 1984–1991), terminados en disputa sobre titularidad/calidad", "PROBABLE", "S10, S11", "Alto", "—"),
    ("E06", "No consta servicio actual de Habanos de marca privada para terceros (sólo Private Selection para ganadores de subastas)", "PROBABLE", "S12", "Crítico", "Preguntar a Habanos"),
    ("E07", "'Cuba', 'La Habana' y derivados están protegidos como IG para puros (Alemania)", "VERIFICADO", "S13", "Alto", "—"),
    ("E08", "IEE cigarros 15,8% PVP, mínimo 47 €/1.000 u", "VERIFICADO", "S14", "Alto", "—"),
    ("E09", "Margen expendedor cigarros 9%", "PROBABLE", "S15", "Medio", "Texto consolidado"),
    ("E10", "Arancel UE 2402 10 00 = 26% (origen Cuba)", "PROBABLE", "S32", "Alto", "TARIC"),
    ("E11", "Marcas fiscales obligatorias en cigarros desde 20/05/2024", "VERIFICADO", "S27", "Medio", "—"),
    ("E12", "Trazabilidad UE para cigarros desde 20/05/2024", "VERIFICADO", "S28", "Medio", "—"),
    ("E13", "Habilitación CMT resuelta en ≤15 días hábiles", "VERIFICADO", "S17", "Bajo", "—"),
    ("E14", "Tabacalera, distribuidor exclusivo de Habanos en España, con cuentas bloqueadas por sanciones UE (2026)", "VERIFICADO", "S21", "Alto (Proyecto B)", "Seguimiento"),
    ("E15", "BHK 56 en expendeduría: 262,50 €/u; caja de 10: 2.625 €", "PROBABLE", "S19, S20", "Alto", "BOE vigente"),
    ("E16", "Behike auténtico sólo en cajas de 10", "VERIFICADO", "S20", "Alto", "—"),
    ("E17", "Habanos facturó 827 M USD en 2024; España 2º mercado", "VERIFICADO", "S24", "Medio", "Cifras 2025"),
    ("E18", "Venta de cigarros (todas las gamas) en España ene-oct 2025: 460,8 M u (+6,65%)", "VERIFICADO", "S25", "Bajo", "Separar premium"),
    ("E19", "Precio FOB de fabricación por unidad", "BLOQUEADO", "—", "Crítico", "Cotización"),
    ("E20", "Volúmenes de demanda por escenario", "HIPÓTESIS", "—", "Crítico", "Entrevistas y cartas de interés"),
    ("E21", "Tarifa del distribuidor mayorista 4,5–6% PVP", "HIPÓTESIS", "—", "Alto", "Oferta de distribuidor"),
    ("E22", "Coste de packaging 18 €/caja de 10", "HIPÓTESIS", "—", "Medio", "Cotización"),
    ("E23", "Preferencia arancelaria 0% para R. Dominicana y Centroamérica", "PROBABLE", "S33", "Alto (B3)", "TARIC"),
    ("E24", "Impuesto de Sociedades Andorra 10%", "HIPÓTESIS", "N07", "Bajo", "Asesor andorrano"),
    ("E26", "No se halló marca de puros «Arnaldo» en búsqueda web preliminar", "PROBABLE", "S49", "Alto", "Informe de registrabilidad"),
    ("E27", "Vegas Robaina (nombre de veguero) es marca de Habanos S.A. desde 1997", "VERIFICADO", "S50", "Alto", "—"),
    ("E28", "Arnaldo consiente el uso de su nombre y su empleador lo autoriza", "BLOQUEADO", "—", "Crítico", "Reunión R1 + abogado cubano"),
    ("E25", "Oferta Behike 56 a 50 €/caja", "HIPÓTESIS (no verificada; tratada como señal de alerta)", "Promotor", "Crítico", "No verificar comprando"),
]
header(ws, 4, ["ID", "Afirmación", "Clasificación", "Fuente", "Impacto en decisión", "Próximo paso de verificación"])
for n, e in enumerate(ev):
    r = 5 + n
    for j, v in enumerate(e):
        c = ws.cell(row=r, column=1 + j, value=v)
        c.border = B_ALL
        c.alignment = WRAP
        if j == 2:
            c.font, c.fill = (F_FLAG, FILL_FLAG) if v.startswith("BLOQ") else ((F_OUT, FILL_OUT) if v.startswith("VERIF") else (F_INPUT, FILL_INPUT))
widths(ws, {"A": 5, "B": 80, "C": 22, "D": 14, "E": 18, "F": 30})
put(ws, f"B{6+len(ev)}", "Recuento por clasificación")
for n, k in enumerate(["VERIFICADO", "PROBABLE", "HIPÓTESIS*", "BLOQUEADO"]):
    put(ws, f"B{7+len(ev)+n}", k.replace("*", ""))
    put(ws, f"C{7+len(ev)+n}", f'=COUNTIF(C5:C{4+len(ev)},"{k}")', "out", "0")
wb.save(P("09_RESEARCH", "Evidence & Assumptions Log.xlsx"))
print("misc ok")
