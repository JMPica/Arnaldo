import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AllergenList, ErrorBox, Loading, NumField, PageHead, SelectField, Sheet, TextField, useConfirm, useErrorText, useToast } from '../components/ui';
import { api, newKey } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { IngredientForm, perVisibleUnit, unitLabel } from './Ingredients';

const today = () => new Date().toISOString().slice(0, 10);

export default function IngredientDetail() {
  const { id } = useParams();
  const { t, money, num, pct, date } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const { ask, node } = useConfirm();
  const q = useQuery({ queryKey: ['ingredient', id], queryFn: () => api.get(`/ingredients/${id}`) });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const [edit, setEdit] = useState(false);
  const [priceFor, setPriceFor] = useState<any>(null);
  const [newFormat, setNewFormat] = useState(false);
  const [move, setMove] = useState(false);
  const refresh = () => qc.invalidateQueries();
  const archive = useMutation({ mutationFn: () => api.del(`/ingredients/${id}`), onSuccess: () => { refresh(); toast(t('Ingrediente archivado')); } });
  const restore = useMutation({ mutationFn: () => api.post(`/ingredients/${id}/restore`), onSuccess: () => { refresh(); toast(t('Ingrediente restaurado')); } });
  const setPreferred = useMutation({ mutationFn: (fid: string) => api.patch(`/ingredients/${id}`, { preferred_format_id: fid }), onSuccess: refresh, onError: (e) => toast(errText(e), 'error') });
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Loading />;
  const i = q.data;
  const u = i.base_unit;
  const history = i.price_history as any[];
  return (
    <>
      <PageHead back={{ to: '/ingredientes', label: t('Ingredientes') }} kicker={i.category || t('Ingrediente')} title={i.name}
        sub={<>{t('Unidad base')}: {u} · {t('Merma')} {pct(i.waste_pct)} · <AllergenList list={i.allergens} /></>}
        actions={<>
          {i.archived_at ? <button className="btn light" onClick={() => restore.mutate()}>{t('Restaurar')}</button>
            : <button className="btn danger" onClick={async () => { if (await ask(t('¿Archivar este ingrediente? Las recetas y presupuestos históricos se conservan.'))) archive.mutate(); }}>{t('Archivar')}</button>}
          <button className="btn" onClick={() => setEdit(true)}>{t('Editar')}</button>
        </>} />
      {i.archived_at && <div className="notice warn">{t('Ingrediente archivado: no aparece en listados activos.')}</div>}
      <section className="metrics">
        <div className="metric card"><div className="lbl">{t('Precio vigente')}</div><div className="val">{i.current_price ? money(i.current_price.pack_price) : '—'}</div><div className="note">{i.current_price ? `${i.current_price.label} · ${date(i.current_price.effective_at)}` : t('Sin precio registrado')}</div></div>
        <div className="metric card"><div className="lbl">{t('Coste útil')}</div><div className="val">{i.current_price ? money(perVisibleUnit(i.current_price.unit_cost, u)) : '—'}</div><div className="note">{t('por {u} aprovechable', { u: unitLabel(u) })}</div></div>
        <div className="metric card"><div className="lbl">{t('Stock físico')}</div><div className="val">{num(i.stock_on_hand, 1)} {u}</div><div className="note">{t('Según libro de movimientos')}</div></div>
        <div className="metric card"><div className="lbl">{t('Usado en')}</div><div className="val">{i.used_in.length}</div><div className="note">{t('recetas')}</div></div>
      </section>
      <div className="grid two">
        <section className="card panel">
          <div className="panel-head"><h3>{t('Formatos de compra')}</h3><button className="btn light sm" onClick={() => setNewFormat(true)}>＋ {t('Formato')}</button></div>
          {i.formats.length ? <ul className="list">{i.formats.map((f: any) => {
            const last = history.find((p) => p.format_id === f.id);
            return (
              <li key={f.id} className="row">
                <div><div className="title-sm">{f.label} {i.preferred_format_id === f.id && <span className="pill ok">{t('Preferido')}</span>} {!f.is_active && <span className="pill draft">{t('Inactivo')}</span>}</div>
                  <div className="muted">{f.supplier_name || t('Sin proveedor')} · {num(f.pack_quantity_base, 3)} {u}{f.supplier_ref ? ` · ref. ${f.supplier_ref}` : ''}</div></div>
                <div className="right"><div className="num strong">{last ? money(last.pack_price) : '—'}</div>
                  <div className="actions" style={{ justifyContent: 'flex-end' }}>
                    {i.preferred_format_id !== f.id && <button className="link-btn" onClick={() => setPreferred.mutate(f.id)}>{t('Preferir')}</button>}
                    <button className="link-btn" onClick={() => setPriceFor(f)}>{t('Nuevo precio')}</button></div></div>
              </li>);
          })}</ul> : <p className="muted">{t('Añade un formato (p. ej. bolsa 2 kg) con su precio para poder calcular costes.')}</p>}
        </section>
        <section className="card panel">
          <div className="panel-head"><h3>{t('Historial de precios')}</h3></div>
          {history.length ? <div className="table-wrap"><table><thead><tr><th>{t('Fecha')}</th><th>{t('Formato')}</th><th className="num">{t('Precio')}</th><th className="num">€/{unitLabel(u)}</th><th>{t('Origen')}</th></tr></thead>
            <tbody>{history.map((p, idx) => {
              const prev = history.slice(idx + 1).find((x) => x.format_id === p.format_id);
              const ch = prev ? (Number(p.unit_price_base) / Number(prev.unit_price_base) - 1) * 100 : null;
              return <tr key={p.id}><td>{date(p.effective_at)}</td><td>{p.label}{prev && prev.pack_quantity_base !== p.pack_quantity_base && <span className="pill warn">{t('Formato cambiado')}</span>}</td>
                <td className="num">{money(p.pack_price)}</td><td className="num">{money(perVisibleUnit(p.unit_price_base, u))}{ch !== null && Math.abs(ch) >= 0.05 && <div className={ch > 0 ? 'neg' : 'pos'} style={{ fontSize: 12 }}>{ch > 0 ? '+' : ''}{pct(ch)}</div>}</td>
                <td><span className="pill draft">{({ manual: t('Manual'), purchase: t('Compra'), document: t('Documento'), import: t('Importación') } as Record<string, string>)[p.source_type]}</span>{p.note && <div className="muted">{p.note}</div>}</td></tr>;
            })}</tbody></table></div> : <p className="muted">{t('Sin historial.')}</p>}
          <p className="footnote">{t('El historial es inmutable: una corrección se registra como una entrada nueva.')}</p>
        </section>
      </div>
      <div className="grid two" style={{ marginTop: 14 }}>
        <section className="card panel">
          <div className="panel-head"><h3>{t('Movimientos de stock')}</h3><button className="btn light sm" onClick={() => setMove(true)}>{t('Ajustar stock')}</button></div>
          {i.movements.length ? <ul className="list">{i.movements.slice(0, 30).map((m: any) => (
            <li key={m.id} className="row"><div><div>{({ opening: t('Inicial'), receipt: t('Recepción'), consumption: t('Consumo'), waste: t('Merma'), adjustment: t('Ajuste'), reservation: t('Reserva'), reservation_release: t('Liberación') } as Record<string, string>)[m.kind]}</div><div className="muted">{date(m.occurred_at)} {m.notes ? `· ${m.notes}` : ''}</div></div>
              <span className="num strong">{['consumption', 'waste'].includes(m.kind) ? '−' : ''}{num(m.quantity_base, 2)} {u}</span></li>))}</ul> : <p className="muted">{t('Sin movimientos.')}</p>}
        </section>
        <section className="card panel">
          <div className="panel-head"><h3>{t('Usado en recetas')}</h3></div>
          {i.used_in.length ? <ul className="list">{i.used_in.map((r: any) => <li key={r.id} className="row"><Link to={`/recetas/${r.id}`}>{r.name}</Link></li>)}</ul> : <p className="muted">{t('No se usa en ninguna receta.')}</p>}
          {i.notes && <><h3 style={{ marginTop: 14 }}>{t('Notas')}</h3><p className="muted2" style={{ whiteSpace: 'pre-wrap' }}>{i.notes}</p></>}
        </section>
      </div>
      {edit && <IngredientForm initial={{ ...i, used_in_recipes: i.used_in.length }} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />}
      {priceFor && <PriceSheet format={priceFor} unit={u} onClose={() => setPriceFor(null)} />}
      {newFormat && <FormatSheet ingredientId={i.id} unit={u} suppliers={(suppliers.data ?? []) as any[]} onClose={() => setNewFormat(false)} />}
      {move && <MovementSheet ingredientId={i.id} unit={u} onClose={() => setMove(false)} />}
      {node}
    </>
  );
}

function PriceSheet({ format, unit, onClose }: { format: any; unit: string; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState(String(format.pack_quantity_base));
  const [eff, setEff] = useState(today());
  const [note, setNote] = useState('');
  const m = useMutation({ mutationFn: () => api.post(`/purchase-formats/${format.id}/prices`, { pack_price: price, pack_quantity_base: qty, effective_at: eff, note }), onSuccess: (r) => { qc.invalidateQueries(); toast(r.format_changed ? t('Precio registrado. Atención: el tamaño del envase ha cambiado.') : t('Precio registrado')); onClose(); }, onError: (e) => toast(errText(e), 'error') });
  return (
    <Sheet title={t('Nuevo precio · {f}', { f: format.label })} sub={t('No sobrescribe el historial: se añade una entrada con su fecha efectiva.')} onClose={onClose}
      footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={!price || m.isPending} onClick={() => m.mutate()}>{t('Guardar precio')}</button></>}>
      <div className="fields">
        <NumField label={t('Precio del envase sin IVA (€)')} value={price} onChange={setPrice} required />
        <NumField label={t('Cantidad del envase ({u})', { u: unit })} value={qty} onChange={setQty} />
        <TextField label={t('Fecha efectiva')} type="date" value={eff} onChange={setEff} />
        <TextField label={t('Nota')} value={note} onChange={setNote} />
      </div>
    </Sheet>
  );
}

function FormatSheet({ ingredientId, unit, suppliers, onClose }: { ingredientId: string; unit: string; suppliers: any[]; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [f, setF] = useState({ label: '', supplier_id: '', supplier_ref: '', pack_quantity_base: '', initial_price: '', effective_at: today(), whole_packs_only: true });
  const m = useMutation({ mutationFn: () => api.post('/purchase-formats', { ...f, ingredient_id: ingredientId, supplier_id: f.supplier_id || null, initial_price: f.initial_price || undefined }), onSuccess: () => { qc.invalidateQueries(); toast(t('Formato creado')); onClose(); }, onError: (e) => toast(errText(e), 'error') });
  return (
    <Sheet title={t('Nuevo formato de compra')} onClose={onClose}
      footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={!f.label || !f.pack_quantity_base || m.isPending} onClick={() => m.mutate()}>{t('Guardar')}</button></>}>
      <div className="fields">
        <TextField label={t('Nombre del formato')} value={f.label} onChange={(v) => setF({ ...f, label: v })} placeholder={t('Ej.: Caja 12 ud')} required />
        <SelectField label={t('Proveedor')} value={f.supplier_id} onChange={(v) => setF({ ...f, supplier_id: v })} options={[['', t('— Sin proveedor —')], ...suppliers.map((s) => [s.id, s.name] as [string, string])]} />
        <NumField label={t('Contenido ({u})', { u: unit })} value={f.pack_quantity_base} onChange={(v) => setF({ ...f, pack_quantity_base: v })} required />
        <NumField label={t('Precio sin IVA (€)')} value={f.initial_price} onChange={(v) => setF({ ...f, initial_price: v })} />
        <TextField label={t('Referencia del proveedor')} value={f.supplier_ref} onChange={(v) => setF({ ...f, supplier_ref: v })} />
        <TextField label={t('Fecha efectiva')} type="date" value={f.effective_at} onChange={(v) => setF({ ...f, effective_at: v })} />
        <label className="check span2"><input type="checkbox" checked={f.whole_packs_only} onChange={(e) => setF({ ...f, whole_packs_only: e.target.checked })} />{t('Solo se vende por envase completo')}</label>
      </div>
    </Sheet>
  );
}

function MovementSheet({ ingredientId, unit, onClose }: { ingredientId: string; unit: string; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [kind, setKind] = useState('adjustment');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [key] = useState(newKey());
  const m = useMutation({ mutationFn: () => api.post('/stock/movements', { ingredient_id: ingredientId, kind, quantity_base: qty, occurred_at: today(), notes, idempotency_key: key }), onSuccess: () => { qc.invalidateQueries(); toast(t('Movimiento registrado')); onClose(); }, onError: (e) => toast(errText(e), 'error') });
  return (
    <Sheet title={t('Movimiento de stock')} sub={t('El stock nunca se edita directamente: cada cambio queda registrado.')} onClose={onClose}
      footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={!qty || m.isPending} onClick={() => m.mutate()}>{t('Registrar')}</button></>}>
      <div className="fields">
        <SelectField label={t('Tipo')} value={kind} onChange={setKind} options={[['opening', t('Stock inicial')], ['adjustment', t('Ajuste de inventario (±)')], ['waste', t('Merma / desecho')]]} />
        <NumField label={t('Cantidad ({u})', { u: unit })} value={qty} onChange={setQty} hint={kind === 'adjustment' ? t('Usa negativo para restar (p. ej. -200).') : undefined} required />
        <TextField label={t('Nota')} value={notes} onChange={setNotes} span2 />
      </div>
    </Sheet>
  );
}
