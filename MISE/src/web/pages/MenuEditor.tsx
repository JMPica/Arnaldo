import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Decimal } from '../../shared/decimal';
import { AllergenList, ErrorBox, Loading, PageHead, ReviewPill, SelectField, TextArea, TextField, useConfirm, useErrorText, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface Dish { recipe_id: string; servings: string }
interface Course { name_es: string; name_ca: string; base: Dish | null; alts: (Dish & { variant: string })[] }

export default function MenuEditor() {
  const { id } = useParams();
  const isNew = id === 'nuevo';
  const nav = useNavigate();
  const { t, money, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const { ask, node } = useConfirm();
  const recs = useQuery({ queryKey: ['recipes', 'active'], queryFn: () => api.get('/recipes') });
  const detail = useQuery({ queryKey: ['menu', id], queryFn: () => api.get(`/menus/${id}`), enabled: !isNew });
  const [f, setF] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (isNew && !f) { setF({ name: '', kind: 'tasting', description_es: '', description_ca: '', notes: '' }); setCourses([{ name_es: '', name_ca: '', base: { recipe_id: '', servings: '1' }, alts: [] }]); }
    if (!isNew && detail.data && !f) {
      const d = detail.data;
      setF({ name: d.name, kind: d.kind, description_es: d.description_es ?? '', description_ca: d.description_ca ?? '', notes: d.notes ?? '' });
      const byPos = new Map<number, Course>();
      for (const l of d.lines) {
        const c = byPos.get(l.position) ?? { name_es: '', name_ca: '', base: null, alts: [] };
        if (!l.variant) { c.base = { recipe_id: l.recipe_id, servings: l.servings_per_guest }; c.name_es = l.course_name_es ?? c.name_es; c.name_ca = l.course_name_ca ?? c.name_ca; }
        else { c.alts.push({ variant: l.variant, recipe_id: l.recipe_id, servings: l.servings_per_guest }); if (!c.name_es) c.name_es = l.course_name_es ?? ''; }
        byPos.set(l.position, c);
      }
      setCourses([...byPos.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c));
    }
  }, [isNew, detail.data, f]);

  const recMap = useMemo(() => new Map(((recs.data ?? []) as any[]).map((r) => [r.id, r])), [recs.data]);
  const variants = useMemo(() => [...new Set(courses.flatMap((c) => c.alts.map((a) => a.variant.trim()).filter(Boolean)))], [courses]);
  const costFor = (variant: string) => courses.reduce((acc, c) => {
    const d = (variant && c.alts.find((a) => a.variant.trim() === variant)) || c.base;
    const r = d && recMap.get(d.recipe_id);
    if (!d || !r || r.portion_cost === null) return acc;
    try { return acc.plus(new Decimal(r.portion_cost).times(new Decimal(d.servings.replace(',', '.') || '0'))); } catch { return acc; }
  }, new Decimal(0));

  const save = useMutation({
    mutationFn: () => {
      const lines = courses.flatMap((c, i) => [
        ...(c.base?.recipe_id ? [{ position: i + 1, course_name_es: c.name_es || null, course_name_ca: c.name_ca || null, recipe_id: c.base.recipe_id, servings_per_guest: c.base.servings, variant: '' }] : []),
        ...c.alts.filter((a) => a.recipe_id && a.variant.trim()).map((a) => ({ position: i + 1, course_name_es: c.name_es || null, course_name_ca: c.name_ca || null, recipe_id: a.recipe_id, servings_per_guest: a.servings, variant: a.variant.trim() })),
      ]);
      const payload = { ...f, lines };
      return isNew ? api.post('/menus', payload) : api.put(`/menus/${id}`, payload);
    },
    onSuccess: (r) => { qc.invalidateQueries(); toast(t('Menú guardado')); if (isNew) nav(`/menus/${r.id}`, { replace: true }); else setF(null); },
    onError: (e) => toast(errText(e), 'error'),
  });
  const review = useMutation({ mutationFn: () => api.post(`/menus/${id}/allergen-review`), onSuccess: () => { qc.invalidateQueries(); toast(t('Menú revisado: listo para propuestas')); }, onError: (e) => toast(errText(e), 'error') });
  const dup = useMutation({ mutationFn: () => api.post(`/menus/${id}/duplicate`), onSuccess: (r) => { qc.invalidateQueries(); setF(null); nav(`/menus/${r.id}`); } });
  const archive = useMutation({ mutationFn: () => api.del(`/menus/${id}`), onSuccess: () => { qc.invalidateQueries(); nav('/menus'); } });

  if (detail.isError) return <ErrorBox error={detail.error} />;
  if (!f || !recs.data) return <Loading />;
  const recOptions: [string, string][] = [['', t('— Elegir receta —')], ...(recs.data as any[]).map((r) => [r.id, `${r.name} · ${money(r.portion_cost)}/${t('ración')}`] as [string, string])];
  const upd = (i: number, c: Partial<Course>) => setCourses(courses.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const move = (i: number, d: number) => { const n = [...courses]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x!); setCourses(n); };
  const d = detail.data;
  return (
    <>
      <PageHead back={{ to: '/menus', label: t('Menús') }} kicker={isNew ? t('Nuevo menú') : `${t('Menú')} · v${d.version}`} title={f.name || t('Nuevo menú')} sub={!isNew && <ReviewPill state={d.allergen_review} />}
        actions={<>
          {!isNew && <button className="btn light" onClick={() => dup.mutate()}>{t('Duplicar')}</button>}
          {!isNew && <button className="btn danger" onClick={async () => { if (await ask(t('¿Archivar menú?'))) archive.mutate(); }}>{t('Archivar')}</button>}
          <button className="btn" disabled={save.isPending} onClick={() => save.mutate()}>{t('Guardar')}</button>
        </>} />
      <div className="split">
        <div className="stack">
          <section className="card panel">
            <div className="fields">
              <TextField label={t('Nombre del menú')} value={f.name} onChange={(v) => setF({ ...f, name: v })} required span2 />
              <SelectField label={t('Tipo')} value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[['tasting', t('Menú degustación')], ['courses', t('Menú por pases')]]} />
              <TextArea label={t('Descripción para el cliente (ES)')} value={f.description_es} onChange={(v) => setF({ ...f, description_es: v })} rows={3} />
              <TextArea label={t('Descripción para el cliente (CA)')} value={f.description_ca} onChange={(v) => setF({ ...f, description_ca: v })} rows={3} />
            </div>
          </section>
          {courses.map((c, i) => (
            <section key={i} className="card panel">
              <div className="panel-head"><h3>{t('Pase {n}', { n: i + 1 })}</h3>
                <div className="actions">{i > 0 && <button className="btn light sm" aria-label={t('Subir')} onClick={() => move(i, -1)}>↑</button>}{i < courses.length - 1 && <button className="btn light sm" aria-label={t('Bajar')} onClick={() => move(i, 1)}>↓</button>}<button className="btn danger sm" onClick={() => setCourses(courses.filter((_, j) => j !== i))}>{t('Quitar')}</button></div></div>
              <div className="fields">
                <TextField label={t('Nombre del pase (ES)')} value={c.name_es} onChange={(v) => upd(i, { name_es: v })} placeholder={t('Ej.: Aperitivo')} />
                <TextField label={t('Nombre del pase (CA)')} value={c.name_ca} onChange={(v) => upd(i, { name_ca: v })} />
                <SelectField label={t('Plato base')} value={c.base?.recipe_id ?? ''} onChange={(v) => upd(i, { base: { recipe_id: v, servings: c.base?.servings ?? '1' } })} options={recOptions} />
                <TextField label={t('Raciones por comensal')} value={c.base?.servings ?? '1'} onChange={(v) => upd(i, { base: { recipe_id: c.base?.recipe_id ?? '', servings: v } })} hint={t('0,5 = media ración')} />
              </div>
              {c.alts.map((a, k) => (
                <div key={k} className="fields three" style={{ marginTop: 10, padding: 10, background: 'var(--sage-mist)', borderRadius: 12 }}>
                  <TextField label={t('Alternativa (variante)')} value={a.variant} onChange={(v) => upd(i, { alts: c.alts.map((x, j) => (j === k ? { ...x, variant: v } : x)) })} placeholder={t('vegetariano, sin gluten…')} />
                  <SelectField label={t('Receta alternativa')} value={a.recipe_id} onChange={(v) => upd(i, { alts: c.alts.map((x, j) => (j === k ? { ...x, recipe_id: v } : x)) })} options={recOptions} />
                  <div className="field"><label>{t('Raciones')}</label><div style={{ display: 'flex', gap: 6 }}><input inputMode="decimal" value={a.servings} onChange={(e) => upd(i, { alts: c.alts.map((x, j) => (j === k ? { ...x, servings: e.target.value } : x)) })} aria-label={t('Raciones')} /><button className="btn danger sm" aria-label={t('Quitar alternativa')} onClick={() => upd(i, { alts: c.alts.filter((_, j) => j !== k) })}>×</button></div></div>
                </div>
              ))}
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => upd(i, { alts: [...c.alts, { variant: variants[0] ?? '', recipe_id: '', servings: '1' }] })}>＋ {t('Alternativa dietética')}</button>
            </section>
          ))}
          <button className="btn light" onClick={() => setCourses([...courses, { name_es: '', name_ca: '', base: { recipe_id: '', servings: '1' }, alts: [] }])}>＋ {t('Añadir pase')}</button>
        </div>
        <div className="stack sticky">
          <section className="card panel">
            <h3>{t('Coste por comensal (interno)')}</h3>
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">{t('Menú base')}</span><span className="v">{money(costFor('').toFixed())}</span>
              {variants.map((v) => <Fragment key={v}><span className="k">{v}</span><span className="v">{money(costFor(v).toFixed())}</span></Fragment>)}
            </div>
            <p className="footnote">{t('Las alternativas solo se aplican a los comensales de ese grupo en el evento; nunca se cuentan dos veces.')}</p>
          </section>
          {!isNew && (
            <section className="card panel">
              <div className="panel-head"><h3>{t('Alérgenos del menú')}</h3><ReviewPill state={d.allergen_review} /></div>
              {Object.entries(d.allergens as Record<string, string[]>).map(([v, list]) => <div key={v} className="row"><span className="muted2">{v === 'base' ? t('Menú base') : v}</span><AllergenList list={list} /></div>)}
              {d.pending_recipe_reviews.length > 0 && <div className="notice warn" style={{ marginTop: 10 }}>{t('Recetas pendientes de revisión')}: {d.pending_recipe_reviews.map((r: any) => r.name).join(', ')}</div>}
              {d.allergen_review !== 'reviewed' && <button className="btn sage block" style={{ marginTop: 10 }} disabled={d.pending_recipe_reviews.length > 0 || review.isPending}
                onClick={async () => { if (await ask(t('Confirmo que he verificado manualmente los alérgenos de todos los platos del menú.'), false)) review.mutate(); }}>{t('Marcar menú como revisado')}</button>}
            </section>
          )}
          {!isNew && (
            <section className="card panel">
              <h3>{t('Vista para el cliente')}</h3>
              <p className="muted">{t('Sin costes ni escandallos.')}</p>
              <div style={{ fontFamily: 'var(--serif)', marginTop: 8 }}>
                {courses.map((c, i) => <div key={i} style={{ margin: '10px 0' }}><div className="kicker" style={{ marginBottom: 2 }}>{(lang === 'ca' ? c.name_ca : c.name_es) || t('Pase {n}', { n: i + 1 })}</div><div style={{ fontSize: 17 }}>{recMap.get(c.base?.recipe_id ?? '')?.name ?? '—'}</div>{c.alts.map((a, k) => <div key={k} className="muted">{a.variant}: {recMap.get(a.recipe_id)?.name}</div>)}</div>)}
              </div>
            </section>
          )}
        </div>
      </div>
      {node}
    </>
  );
}
