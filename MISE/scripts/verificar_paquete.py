#!/usr/bin/env python3
"""Validate the MISE Claude Code handoff without dependencies or network calls.
Does NOT claim the final app is implemented. Run: python3 scripts/verificar_paquete.py
"""
from pathlib import Path
from decimal import Decimal, getcontext, ROUND_CEILING
import hashlib, json, sqlite3, sys, zipfile
getcontext().prec = 46
ROOT = Path(__file__).resolve().parents[1]
D = Decimal
REQUIRED = [
    '00_EMPIEZA_AQUI.md', '01_MENSAJE_PARA_CLAUDE_CODE.md', 'CLAUDE.md',
    'docs/PRODUCTO.md', 'docs/ARQUITECTURA.md', 'docs/MODELO_DATOS.md',
    'docs/REGLAS_CALCULO.md','docs/SEGURIDAD.md','docs/UX.md',
    'docs/PLAN_EJECUCION.md','docs/PRUEBAS_ACEPTACION.md',
    'docs/DESPLIEGUE.md','docs/PUNTOS_MANUALES.md',
    'docs/PROGRESO.md', 'docs/AUDITORIA_LEGACY.md',
    'reference/001_esquema.sql','fixtures/calculos.json',
    'fixtures/legacy_backup_v1_ficticio.json',
    'legacy/index.html','legacy/LEEME_ORIGINAL.txt','legacy/MISE_original_v1.zip'
]

def check(cond, message):
    if not cond: raise AssertionError(message)
    print('OK  ', message)

def run():
    check(all((ROOT/f).is_file() for f in REQUIRED), 'Archivos obligatorios completos')
    orig = ROOT/'legacy'/'MISE_original_v1.zip'
    with zipfile.ZipFile(orig) as z:
        check('index.html' in z.namelist() and 'LEEME.txt' in z.namelist(), 'ZIP original sin cambios estructurales')
        check(z.read('index.html') == (ROOT/'legacy'/'index.html').read_bytes(), 'Código legado preservado byte a byte')
        check(z.read('LEEME.txt') == (ROOT/'legacy'/'LEEME_ORIGINAL.txt').read_bytes(), 'LEEME legado preservado')
    html = (ROOT/'legacy'/'index.html').read_text('utf-8')
    check('localStorage.getItem' in html and 'localStorage.setItem' in html, 'Auditoría identifica almacenamiento local legado')
    check('function eventStats(' in html and 'function menuIngredientQty(' in html, 'Cálculos principales preservados para análisis')
    f = json.loads((ROOT/'fixtures'/'calculos.json').read_text('utf-8'))
    check(f['metadata']['version']==1 and len(f['cases'])>=12, 'Fixtures de cálculo completos')
    for c in f['cases']:
        i={k:D(v) for k,v in c['inputs'].items()}
        k=c['id']
        if k=='ingredient_merma_20' or k=='ingredient_zero_waste':
            result=i['pack_price']/(i['pack_qty']*(1-i['waste_pct']/100))
        elif k=='recipe_lot_example': result=i['qty1']*i['unit_price1']+i['qty2']*i['unit_price2']
        elif k=='recipe_serving_example': result=i['lot_cost']/i['servings']
        elif k=='menu_guest_example': result=i['recipe_serving_cost']*i['servings_per_guest']
        elif k=='event_food_example': result=i['cost_per_guest']*i['guest_count']
        elif k=='event_profit_example': result=i['revenue']-i['food']-i['staff']-i['travel']
        elif k=='event_margin_example': result=i['profit']/i['revenue']*100
        elif k=='target_revenue_40pct': result=i['total_cost']/(1-i['margin_pct']/100)
        elif k=='subrecipe_200g': result=i['subrecipe_cost']*i['used_qty']/i['yield_qty']
        elif k=='shopping_consolidation':
            net=i['event_1_net']+i['event_2_net']
            need=max(D(0),net/(1-i['waste_pct']/100)-i['stock_gross'])
            result=(need/i['pack_qty']).to_integral_value(rounding=ROUND_CEILING)
        elif k=='shopping_pack_cost': result=i['pack_count']*i['pack_price']
        elif k=='zero_revenue_margin': result=None if i['revenue']==0 else i['profit']/i['revenue']*100
        else: raise AssertionError('Fixture desconocido '+k)
        if c['expected'] is None: check(result is None, 'Fixture '+k)
        else:
            error=abs(result-D(c['expected']))
            check(error <= D('1e-20') if c.get('compare') else error==0, 'Fixture '+k)
    legacy=json.loads((ROOT/'fixtures'/'legacy_backup_v1_ficticio.json').read_text('utf-8'))
    check(legacy['version']==1 and all(isinstance(legacy[k],list) for k in ['ingredients','recipes','menus','events','purchases']), 'Fixture migración v1 legible')
    ids={x['id'] for x in legacy['ingredients']}
    check(all(l['ingredientId'] in ids for r in legacy['recipes'] for l in r['lines']), 'Integridad de ingredientes en fixture legado')
    # Parse entire SQL and enforce referential constraints in a fresh in-memory SQLite.
    db=sqlite3.connect(':memory:')
    db.executescript((ROOT/'reference'/'001_esquema.sql').read_text('utf-8'))
    names={t[0] for t in db.execute('SELECT name FROM sqlite_master WHERE type="table"')}
    check(len(names)>=18 and 'event_snapshots' in names and 'stock_movements' in names, 'Esquema referencia SQL válido')
    check(db.execute('PRAGMA foreign_keys').fetchone()[0]==1, 'Claves foráneas activadas')
    db.close()
    required_docs=['docs/PRODUCTO.md','docs/REGLAS_CALCULO.md','docs/SEGURIDAD.md']
    check(all((ROOT/n).stat().st_size>2000 for n in required_docs), 'Especificaciones sustantivas presentes')
    print('\nVALIDACIÓN DEL PAQUETE: OK — solo insumos; producción NO desplegada ni implementada aún.')
    return 0

if __name__ == '__main__':
    try: sys.exit(run())
    except Exception as e:
        print('ERROR:',type(e).__name__,str(e),file=sys.stderr)
        sys.exit(1)
