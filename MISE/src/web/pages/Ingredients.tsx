import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Allergen } from '../../shared/allergens';
import { AllergenPicker, Empty, ErrorBox, Loading, NumField, PageHead, Seg, SelectField, Sheet, TextField, TextArea, fieldErrors, useErrorText, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

export function unitLabel(u: string) {
  return u === 'g' ? 'kg' : u === 'ml' ? 'L' : 'ud';
}
export function perVisibleUnit(unitCost: string | number, u: string) {
  return Number(unitCost) * (u === 'ud' ? 1 : 1000);
}

export function IngredientForm({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const [f, setF] = useState({
    name: initial?.name ?? '', category: initial?.category ?? '', base_unit: initial?.base_unit ?? 'g', waste_pct: initial?.waste_pct ?? '0',
    allergens: (initial?.allergens ?? []) as Allergen[], notes: initial?.notes ?? '', preferred_supplier_id: initial?.preferred_supplier_id ?? '',
    pack_label: '', pack_qty: '', pack_price: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: any) => setF((x) => ({ ...x, [k]: v }));
  const m = useMutation({
    mutationFn: async () => {
      const payload = { name: f.name, category: f.category, base_unit: f.base_unit, waste_pct: f.waste_pct || '0', allergens: f.allergens, notes: f.notes, preferred_supplier_id: f.preferred_supplier_id || null };
      const r = initial ? await api.patch(`/ingredients/${initial.id}`, payload) : await api.post('/ingredients', payload);
      if (!initial && f.pack_qty && f.pack_price) {
        await api.post('/purchase-formats', { ingredient_id: r.id, supplier_id: f.preferred_supplier_id || null, label: f.pack_label || `${f.pack_qty} ${f.base_unit}`, pack_quantity_base: f.pack_qty, initial_price: f.pack_price });
      }
      return r;
    },
    onSuccess: (r) => { qc.invalidateQueries(); toast(t('Ingrediente guardado')); onSaved(r.id); },
    onError: (e) => { setErrors(fieldErrors(e)); toast(errText(e), 'error'); },
  });
  return (
    <Sheet title={initial ? t('Editar ingrediente') : t('Nuevo ingrediente')} sub={t('Precios siempre sin IVA. La merma se aplica una sola vez.')} onClose={onClose}
      footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={m.isPending} onClick={() => m.mutate()}>{t('Guardar')}</button></>}>
      <div className="fields">
        <TextField label={t('Nombre')} value={f.name} onChange={set('name')} required span2 error={errors.name} maxLength={160} />
        <TextField label={t('Categoría')} value={f.category} onChange={set('category')} />
        <SelectField label={t('Unidad base')} value={f.base_unit} onChange={set('base_unit')} options={[['g', t('Gramos (g)')], ['ml', t('Mililitros (ml)')], ['ud', t('Unidades (ud)')]]} hint={initial?.used_in_recipes ? t('No se puede cambiar si ya está en uso.') : undefined} />
        <NumField label={t('Merma / limpieza (%)')} value={f.waste_pct} onChange={set('waste_pct')} error={errors.waste_pct} hint={t('0 a 99,99. Ej.: 20 si de 1 kg aprovechas 800 g.')} />
        <SelectField label={t('Proveedor preferido')} value={f.preferred_supplier_id} onChange={set('preferred_supplier_id')} options={[['', t('— Sin proveedor —')], ...((suppliers.data ?? []) as any[]).map((s) => [s.id, s.name] as [string, string])]} />
        {!initial && <>
          <TextField label={t('Formato de compra (opcional)')} value={f.pack_label} onChange={set('pack_label')} placeholder={t('Ej.: Bolsa 2 kg')} />
          <NumField label={t('Cantidad del envase ({u})', { u: f.base_unit })} value={f.pack_qty} onChange={set('pack_qty')} placeholder="1000" />
          <NumField label={t('Precio del envase sin IVA (€)')} value={f.pack_price} onChange={set('pack_price')} placeholder="0,00" />
        </>}
        <div className="field span2"><span className="label">{t('Alérgenos (etiquetado manual)')}</span><AllergenPicker value={f.allergens} onChange={set('allergens')} /><span className="hint">{t('MISE no deduce alérgenos por el nombre: márcalos tú.')}</span></div>
        <TextArea label={t('Notas')} value={f.notes} onChange={set('notes')} />
      </div>
    </Sheet>
  );
}

export default function Ingredients() {
  const { t, money, num, pct } = useI18n();
  const nav = useNavigate();
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [creating, setCreating] = useState(false);
  const [csv, setCsv] = useState(false);
  const q = useQuery({ queryKey: ['ingredients', view], queryFn: () => api.get(`/ingredients${view === 'archived' ? '?archived=1' : ''}`) });
  const list = useMemo(() => ((q.data ?? []) as any[]).filter((i) => !filter || `${i.name} ${i.category ?? ''} ${i.supplier_name ?? ''}`.toLowerCase().includes(filter.toLowerCase())), [q.data, filter]);
  return (
    <>
      <PageHead kicker={t('Catálogo de materias primas')} title={t('Ingredientes')} sub={t('Cada cambio de precio queda en el historial; los escandallos usan el precio vigente.')}
        actions={<><button className="btn light" onClick={() => setCsv(true)}>{t('Importar CSV')}</button><button className="btn" onClick={() => setCreating(true)}>＋ {t('Nuevo ingrediente')}</button></>} />
      <div className="toolbar">
        <input className="search" type="search" placeholder={t('Buscar ingrediente, categoría o proveedor…')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Buscar')} />
        <Seg value={view} onChange={setView} label={t('Estado')} options={[['active', t('Activos')], ['archived', t('Archivados')]]} />
      </div>
      {q.isError ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !q.data ? <Loading /> : !list.length ? (
        <div className="card"><Empty title={t('Sin ingredientes')} desc={t('Añade productos con su formato y precio de compra.')} action={<button className="btn" onClick={() => setCreating(true)}>{t('Añadir ingrediente')}</button>} /></div>
      ) : (
        <div className="card">
          <div className="table-wrap hide-mobile"><table>
            <thead><tr><th>{t('Producto')}</th><th>{t('Formato vigente')}</th><th className="num">{t('Precio envase')}</th><th className="num">{t('Merma')}</th><th className="num">{t('Coste útil')}</th><th className="num">{t('Stock')}</th></tr></thead>
            <tbody>{list.map((i) => (
              <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/ingredientes/${i.id}`)}>
                <td><Link to={`/ingredientes/${i.id}`} className="title-sm" style={{ color: 'inherit' }}>{i.name}</Link><div className="muted">{i.category || t('Sin categoría')} · {i.supplier_name || t('Sin proveedor')}</div></td>
                <td>{i.current_price ? i.current_price.label : <span className="pill warn">{t('Sin precio')}</span>}</td>
                <td className="num">{i.current_price ? money(i.current_price.pack_price) : '—'}</td>
                <td className="num">{pct(i.waste_pct)}</td>
                <td className="num strong">{i.current_price ? `${money(perVisibleUnit(i.current_price.unit_cost, i.base_unit), { decimals: 2 })} / ${unitLabel(i.base_unit)}` : '—'}</td>
                <td className="num">{num(i.stock_on_hand, 1)} {i.base_unit}</td>
              </tr>))}</tbody>
          </table></div>
          <ul className="list only-mobile">{list.map((i) => (
            <li key={i.id}><Link className="row-link" to={`/ingredientes/${i.id}`}>
              <div><div className="title-sm">{i.name}</div><div className="muted">{i.current_price ? `${i.current_price.label} · ${money(i.current_price.pack_price)}` : t('Sin precio')} · {t('merma')} {pct(i.waste_pct)}</div></div>
              <div className="right num strong">{i.current_price ? `${money(perVisibleUnit(i.current_price.unit_cost, i.base_unit))}/${unitLabel(i.base_unit)}` : '—'}</div>
            </Link></li>))}</ul>
        </div>
      )}
      <p className="footnote">{t('Coste útil = precio del envase / (cantidad × (1 − merma)). Las recetas usan cantidades netas; la merma solo se suma al calcular la compra.')}</p>
      {creating && <IngredientForm onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); nav(`/ingredientes/${id}`); }} />}
      {csv && <CsvImport onClose={() => setCsv(false)} />}
    </>
  );
}

function CsvImport({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const errText = useErrorText();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const preview = useMutation({ mutationFn: () => api.post('/ingredients/import-csv', { csv: text }), onError: (e) => toast(errText(e), 'error') });
  const commit = useMutation({ mutationFn: () => api.post('/ingredients/import-csv', { csv: text, commit: true }), onSuccess: (r) => { qc.invalidateQueries(); toast(t('{n} ingredientes importados', { n: r.imported })); onClose(); }, onError: (e) => toast(errText(e), 'error') });
  return (
    <Sheet title={t('Importar ingredientes desde CSV')} onClose={onClose} wide
      footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn light" disabled={!text} onClick={() => preview.mutate()}>{t('Vista previa')}</button><button className="btn" disabled={!preview.data || preview.data.count === 0 || commit.isPending} onClick={() => commit.mutate()}>{t('Importar {n}', { n: preview.data?.count ?? 0 })}</button></>}>
      <p className="muted2">{t('Columnas (separador ; o ,): nombre;categoria;unidad;merma;alergenos;proveedor;formato;cantidad_envase;precio_envase;fecha')}</p>
      <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} aria-label={t('Archivo CSV')} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 13 }} aria-label={t('Contenido CSV')} />
      {preview.data && (
        <div style={{ marginTop: 12 }}>
          {preview.data.errors.length > 0 && <div className="notice warn">{preview.data.errors.slice(0, 20).map((e: any) => <div key={e.row}>{t('Fila')} {e.row}: {e.message}</div>)}</div>}
          <div className="table-wrap"><table><thead><tr><th>{t('Nombre')}</th><th>{t('Unidad')}</th><th>{t('Merma')}</th><th>{t('Formato')}</th><th className="num">{t('Precio')}</th></tr></thead>
            <tbody>{preview.data.preview.map((r: any) => <tr key={r.name}><td>{r.name}</td><td>{r.base_unit}</td><td>{r.waste_pct}</td><td>{r.label}</td><td className="num">{r.price}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </Sheet>
  );
}
