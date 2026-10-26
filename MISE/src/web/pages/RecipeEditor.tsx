import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ALLERGENS, type Allergen } from '../../shared/allergens';
import { Decimal } from '../../shared/decimal';
import { toBase, type LineUnit } from '../../shared/units';
import { AllergenList, AllergenPicker, ErrorBox, Loading, NumField, PageHead, ReviewPill, SelectField, TextArea, TextField, fieldErrors, useConfirm, useErrorText, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { recipeSheetPdf } from '../pdf/docs';

interface Line { ref: string; quantity: string; unit: LineUnit; notes?: string }

const dims: Record<string, LineUnit[]> = { g: ['g', 'kg'], ml: ['ml', 'l'], ud: ['ud'] };

function safeDec(s: string) {
  try { const d = new Decimal(s.replace(',', '.')); return d.isFinite() ? d : null; } catch { return null; }
}

export default function RecipeEditor() {
  const { id } = useParams();
  const isNew = id === 'nueva';
  const nav = useNavigate();
  const { t, money, num, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const { ask, node } = useConfirm();
  const ings = useQuery({ queryKey: ['ingredients', 'active'], queryFn: () => api.get('/ingredients') });
  const recs = useQuery({ queryKey: ['recipes', 'active'], queryFn: () => api.get('/recipes') });
  const detail = useQuery({ queryKey: ['recipe', id], queryFn: () => api.get(`/recipes/${id}`), enabled: !isNew });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const [f, setF] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scale, setScale] = useState('');

  useEffect(() => {
    if (isNew && !f) {
      setF({ name: '', category: '', portions: '4', yield_quantity: '', yield_unit: '', preparation_minutes: '0', cooking_minutes: '0', description_es: '', description_ca: '', instructions_es: '', instructions_ca: '', techniques: '', conservation: '', notes: '', allergens_declared: [] as Allergen[] });
      setLines([{ ref: '', quantity: '', unit: 'g' }]);
    }
    if (!isNew && detail.data && !f) {
      const d = detail.data;
      setF({ ...d, yield_quantity: d.yield_quantity ?? '', yield_unit: d.yield_unit ?? '', preparation_minutes: String(d.preparation_minutes), cooking_minutes: String(d.cooking_minutes) });
      setLines(d.lines.map((l: any) => ({ ref: l.ingredient_id ? `i:${l.ingredient_id}` : `r:${l.subrecipe_id}`, quantity: l.quantity, unit: l.unit, notes: l.notes ?? '' })));
    }
  }, [isNew, detail.data, f]);

  const ingMap = useMemo(() => new Map(((ings.data ?? []) as any[]).map((i) => [i.id, i])), [ings.data]);
  const recMap = useMemo(() => new Map(((recs.data ?? []) as any[]).map((r) => [r.id, r])), [recs.data]);

  // Escandallo en vivo (mismo contrato que el servidor: cantidades netas × coste útil; subrecetas por rendimiento)
  const live = useMemo(() => {
    const out = lines.map((l) => {
      const q = safeDec(l.quantity);
      if (!l.ref || !q || q.lessThanOrEqualTo(0)) return { cost: null as Decimal | null, err: l.ref ? t('Cantidad no válida') : null };
      const [kind, rid] = l.ref.split(':');
      try {
        if (kind === 'i') {
          const ing = ingMap.get(rid!);
          if (!ing) return { cost: null, err: t('Ingrediente no disponible') };
          const qb = toBase(q, l.unit, ing.base_unit);
          if (!ing.current_price) return { cost: null, err: t('Sin precio') };
          return { cost: qb.times(new Decimal(ing.current_price.unit_cost)), err: null };
        }
        const sub = recMap.get(rid!);
        if (!sub || sub.lot_cost === null) return { cost: null, err: t('Subreceta sin coste') };
        const factor = l.unit === 'portion' ? q.div(new Decimal(sub.portions)) : sub.yield_unit ? toBase(q, l.unit, sub.yield_unit).div(new Decimal(sub.yield_quantity)) : null;
        if (!factor) return { cost: null, err: t('La subreceta no tiene rendimiento medido') };
        return { cost: factor.times(new Decimal(sub.lot_cost)), err: null };
      } catch { return { cost: null, err: t('Unidades incompatibles') }; }
    });
    const lot = out.reduce((a, x) => (x.cost ? a.plus(x.cost) : a), new Decimal(0));
    const portions = safeDec(f?.portions ?? '') ?? new Decimal(0);
    const derived = new Set<Allergen>();
    for (const l of lines) {
      const [kind, rid] = l.ref.split(':');
      const al: string[] = kind === 'i' ? ingMap.get(rid!)?.allergens ?? [] : recMap.get(rid!)?.allergens ?? [];
      al.forEach((a) => derived.add(a as Allergen));
    }
    return { out, lot, portion: portions.greaterThan(0) ? lot.div(portions) : null, derived: ALLERGENS.filter((a) => derived.has(a)), complete: out.every((x) => !x.err) };
  }, [lines, ingMap, recMap, f?.portions, t]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...f, preparation_minutes: Number(f.preparation_minutes || 0), cooking_minutes: Number(f.cooking_minutes || 0),
        yield_quantity: f.yield_quantity || null, yield_unit: f.yield_unit || null,
        lines: lines.filter((l) => l.ref).map((l) => ({ ingredient_id: l.ref.startsWith('i:') ? l.ref.slice(2) : null, subrecipe_id: l.ref.startsWith('r:') ? l.ref.slice(2) : null, quantity: l.quantity, unit: l.unit, notes: l.notes || null })),
      };
      for (const k of ['id', 'owner_id', 'lines_count', 'cost', 'error', 'allergen_review', 'used_in', 'allergens_declared_json', 'allergen_review_hash', 'allergens_reviewed_at', 'version', 'archived_at', 'created_at', 'updated_at']) delete payload[k];
      return isNew ? api.post('/recipes', payload) : api.put(`/recipes/${id}`, payload);
    },
    onSuccess: async (r) => { await qc.invalidateQueries(); toast(t('Receta guardada')); setErrors({}); setF(null); if (isNew) nav(`/recetas/${r.id}`, { replace: true }); },
    onError: (e) => { setErrors(fieldErrors(e)); toast(errText(e), 'error'); },
  });
  const review = useMutation({ mutationFn: () => api.post(`/recipes/${id}/allergen-review`), onSuccess: () => { qc.invalidateQueries(); toast(t('Alérgenos revisados y aprobados')); }, onError: (e) => toast(errText(e), 'error') });
  const dup = useMutation({ mutationFn: () => api.post(`/recipes/${id}/duplicate`), onSuccess: (r) => { qc.invalidateQueries(); setF(null); nav(`/recetas/${r.id}`); } });
  const archive = useMutation({ mutationFn: () => api.del(`/recipes/${id}`), onSuccess: () => { qc.invalidateQueries(); nav('/recetas'); } });

  if (detail.isError) return <ErrorBox error={detail.error} />;
  if (!f || !ings.data || !recs.data || (!isNew && !detail.data)) return <Loading />;
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const options: [string, string][] = [['', t('— Elegir ingrediente o subreceta —')],
    ...((ings.data as any[]).map((i) => [`i:${i.id}`, `${i.name} (${i.base_unit})`] as [string, string])),
    ...((recs.data as any[]).filter((r) => r.id !== id).map((r) => [`r:${r.id}`, `↳ ${t('Subreceta')}: ${r.name}`] as [string, string]))];
  const unitsFor = (ref: string): LineUnit[] => {
    if (!ref) return ['g', 'kg', 'ml', 'l', 'ud'];
    const [k, rid] = ref.split(':');
    if (k === 'i') return dims[ingMap.get(rid!)?.base_unit ?? 'g'] ?? ['g'];
    const sub = recMap.get(rid!);
    return ['portion', ...(sub?.yield_unit ? dims[sub.yield_unit]! : [])];
  };
  const unitName = (u: LineUnit) => (u === 'portion' ? t('ración') : u);
  const scaleF = safeDec(scale);
  const scaleFactor = scaleF && scaleF.greaterThan(0) && safeDec(f.portions)?.greaterThan(0) ? scaleF.div(safeDec(f.portions)!) : null;
  const serverState = detail.data?.allergen_review ?? 'pending';
  const dirty = !isNew && detail.data && JSON.stringify(lines.map((l) => [l.ref, l.quantity, l.unit])) !== JSON.stringify(detail.data.lines.map((l: any) => [l.ingredient_id ? `i:${l.ingredient_id}` : `r:${l.subrecipe_id}`, l.quantity, l.unit]));

  return (
    <>
      <PageHead back={{ to: '/recetas', label: t('Recetas') }} kicker={isNew ? t('Nueva receta') : t('Ficha técnica · escandallo')} title={f.name || t('Nueva receta')}
        sub={!isNew && <ReviewPill state={serverState} />}
        actions={<>
          {!isNew && <button className="btn light" onClick={() => recipeSheetPdf(detail.data, { lang, t, money, num, brand: settings.data?.brand_name ?? 'MISE', scaleTo: scaleFactor ? scale : null })}>{t('Ficha PDF')}</button>}
          {!isNew && <button className="btn light" onClick={() => dup.mutate()}>{t('Duplicar')}</button>}
          {!isNew && <button className="btn danger" onClick={async () => { if (await ask(t('¿Archivar receta? Los presupuestos guardados no cambian.'))) archive.mutate(); }}>{t('Archivar')}</button>}
          <button className="btn" disabled={save.isPending} onClick={() => save.mutate()}>{t('Guardar')}</button>
        </>} />
      <div className="split">
        <div className="stack">
          <section className="card panel">
            <div className="fields three">
              <TextField label={t('Nombre')} value={f.name} onChange={set('name')} required span2 error={errors.name} />
              <TextField label={t('Categoría')} value={f.category} onChange={set('category')} />
              <NumField label={t('Raciones del lote')} value={f.portions} onChange={set('portions')} required error={errors.portions} />
              <NumField label={t('Rendimiento medido')} value={f.yield_quantity} onChange={set('yield_quantity')} hint={t('Opcional; necesario para usarla como subreceta por peso o volumen.')} error={errors.yield_quantity} />
              <SelectField label={t('Unidad del rendimiento')} value={f.yield_unit} onChange={set('yield_unit')} options={[['', '—'], ['g', 'g'], ['ml', 'ml'], ['ud', 'ud']]} error={errors.yield_unit} />
              <NumField label={t('Preparación (min)')} value={f.preparation_minutes} onChange={set('preparation_minutes')} integer />
              <NumField label={t('Cocción (min)')} value={f.cooking_minutes} onChange={set('cooking_minutes')} integer />
            </div>
          </section>
          <section className="card panel">
            <div className="panel-head"><h3>{t('Escandallo')}</h3><span className="muted">{t('Cantidades netas para todo el lote')}</span></div>
            <div className="line-editor">
              {lines.map((l, idx) => {
                const units = unitsFor(l.ref);
                const r = live.out[idx];
                return (
                  <div className="line" key={idx}>
                    <select aria-label={t('Ingrediente o subreceta')} value={l.ref} onChange={(e) => { const ref = e.target.value; const us = unitsFor(ref); setLines(lines.map((x, i) => (i === idx ? { ...x, ref, unit: us.includes(x.unit) ? x.unit : us[0]! } : x))); }}>{options.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}</select>
                    <input aria-label={t('Cantidad')} inputMode="decimal" value={l.quantity} placeholder={t('Cantidad')} onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, quantity: e.target.value.replace(/[^\d.,]/g, '') } : x)))} />
                    <select aria-label={t('Unidad')} value={l.unit} onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, unit: e.target.value as LineUnit } : x)))}>{units.map((u) => <option key={u} value={u}>{unitName(u)}</option>)}</select>
                    <button type="button" className="x" aria-label={t('Quitar línea')} onClick={() => setLines(lines.filter((_, i) => i !== idx))}>×</button>
                    <div className="cost"><span className={r?.err ? 'neg' : 'muted'}>{r?.err ?? (scaleFactor && safeDec(l.quantity) ? `${t('Escalado')}: ${num(safeDec(l.quantity)!.times(scaleFactor).toFixed(), 2)} ${unitName(l.unit)}` : '')}</span><span className="num strong">{r?.cost ? money(r.cost.toFixed(), { decimals: 3 }) : '—'}</span></div>
                  </div>
                );
              })}
              <button type="button" className="btn light sm" onClick={() => setLines([...lines, { ref: '', quantity: '', unit: 'g' }])}>＋ {t('Añadir línea')}</button>
            </div>
          </section>
          <section className="card panel">
            <h3 style={{ marginBottom: 10 }}>{t('Descripción y elaboración')}</h3>
            <div className="fields">
              <TextArea label={t('Descripción comercial (ES)')} value={f.description_es} onChange={set('description_es')} span2={false} rows={3} />
              <TextArea label={t('Descripción comercial (CA)')} value={f.description_ca} onChange={set('description_ca')} span2={false} rows={3} />
              <TextArea label={t('Elaboración (ES)')} value={f.instructions_es} onChange={set('instructions_es')} rows={6} />
              <TextArea label={t('Elaboración (CA)')} value={f.instructions_ca} onChange={set('instructions_ca')} rows={4} />
              <TextField label={t('Técnicas')} value={f.techniques} onChange={set('techniques')} />
              <TextField label={t('Conservación')} value={f.conservation} onChange={set('conservation')} />
              <TextArea label={t('Notas internas')} value={f.notes} onChange={set('notes')} />
            </div>
          </section>
        </div>
        <div className="stack sticky">
          <section className="card panel">
            <h3>{t('Coste')}</h3>
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">{t('Coste del lote')}</span><span className="v">{money(live.lot.toFixed())}</span>
              <span className="k">{t('Raciones')}</span><span className="v">{num(f.portions)}</span>
              <span className="k total">{t('Coste por ración')}</span><span className="v total">{live.portion ? money(live.portion.toFixed()) : '—'}</span>
            </div>
            {!live.complete && <div className="notice warn" style={{ marginTop: 12 }}>{t('Hay líneas sin precio o con errores: el coste está incompleto.')}</div>}
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="scale">{t('Simular para N raciones (no modifica la receta)')}</label>
              <input id="scale" inputMode="decimal" value={scale} onChange={(e) => setScale(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={f.portions} />
              {scaleFactor && <span className="hint">{t('Factor ×{f} · coste del lote escalado {c}', { f: num(scaleFactor.toFixed(), 3), c: money(live.lot.times(scaleFactor).toFixed()) })}</span>}
            </div>
          </section>
          <section className="card panel">
            <div className="panel-head"><h3>{t('Alérgenos')}</h3>{!isNew && <ReviewPill state={serverState} />}</div>
            <p className="muted2">{t('Derivados de los ingredientes (•) y declarados manualmente. Revisión manual obligatoria.')}</p>
            <AllergenPicker value={f.allergens_declared} onChange={set('allergens_declared')} derived={live.derived} />
            <div style={{ marginTop: 10 }} className="muted2">{t('Resultado')}: <AllergenList list={ALLERGENS.filter((a) => live.derived.includes(a) || f.allergens_declared.includes(a))} /></div>
            {!isNew && serverState !== 'reviewed' && (
              <button className="btn sage block" style={{ marginTop: 12 }} disabled={!!dirty || review.isPending} onClick={async () => { if (await ask(t('Confirmo que he revisado manualmente los alérgenos de esta receta.'), false)) review.mutate(); }}>
                {dirty ? t('Guarda los cambios antes de revisar') : t('Marcar alérgenos como revisados')}
              </button>
            )}
          </section>
          {!isNew && detail.data.used_in.length > 0 && (
            <section className="card panel"><h3>{t('Se usa en')}</h3><ul className="list">{detail.data.used_in.map((u: any) => <li key={u.id} className="row">{u.name}</li>)}</ul></section>
          )}
        </div>
      </div>
      {node}
    </>
  );
}
