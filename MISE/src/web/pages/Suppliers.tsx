import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead, Sheet, TextArea, TextField, fieldErrors, useConfirm, useErrorText, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

export function SupplierForm({ initial, onClose }: { initial?: any; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [f, setF] = useState({ name: initial?.name ?? '', contact_name: initial?.contact_name ?? '', email: initial?.email ?? '', phone: initial?.phone ?? '', website: initial?.website ?? '', tax_id: initial?.tax_id ?? '', notes: initial?.notes ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useMutation({ mutationFn: () => (initial ? api.patch(`/suppliers/${initial.id}`, f) : api.post('/suppliers', f)), onSuccess: () => { qc.invalidateQueries(); toast(t('Proveedor guardado')); onClose(); }, onError: (e) => { setErrors(fieldErrors(e)); toast(errText(e), 'error'); } });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  return (
    <Sheet title={initial ? t('Editar proveedor') : t('Nuevo proveedor')} onClose={onClose} footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={m.isPending} onClick={() => m.mutate()}>{t('Guardar')}</button></>}>
      <div className="fields">
        <TextField label={t('Nombre')} value={f.name} onChange={set('name')} required span2 error={errors.name} />
        <TextField label={t('Persona de contacto')} value={f.contact_name} onChange={set('contact_name')} />
        <TextField label={t('Teléfono')} type="tel" value={f.phone} onChange={set('phone')} />
        <TextField label={t('Email')} type="email" value={f.email} onChange={set('email')} error={errors.email} />
        <TextField label={t('Web')} type="url" value={f.website} onChange={set('website')} />
        <TextField label={t('NIF/CIF (para reconocer facturas)')} value={f.tax_id} onChange={set('tax_id')} />
        <TextArea label={t('Observaciones')} value={f.notes} onChange={set('notes')} />
      </div>
    </Sheet>
  );
}

export default function Suppliers() {
  const { t, num } = useI18n();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(params.get('id'));
  const { ask, node } = useConfirm();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const detail = useQuery({ queryKey: ['supplier', selected], queryFn: () => api.get(`/suppliers/${selected}`), enabled: !!selected });
  const archive = useMutation({ mutationFn: (id: string) => api.del(`/suppliers/${id}`), onSuccess: () => { qc.invalidateQueries(); setSelected(null); } });
  useEffect(() => { setSelected(params.get('id')); }, [params]);
  return (
    <>
      <PageHead kicker={t('Aprovisionamiento')} title={t('Proveedores')} sub={t('Contactos opcionales y formatos que te sirve cada uno.')} actions={<button className="btn" onClick={() => setEditing({})}>＋ {t('Nuevo proveedor')}</button>} />
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !q.data.length ? <div className="card"><Empty title={t('Sin proveedores')} action={<button className="btn" onClick={() => setEditing({})}>{t('Añadir proveedor')}</button>} /></div> : (
        <div className="cards">{(q.data as any[]).map((s) => (
          <article key={s.id} className="card item">
            <h3>{s.name}</h3>
            <div className="muted2">{[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || t('Sin datos de contacto')}</div>
            {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer nofollow">{s.website}</a>}
            {s.notes && <div className="muted">{s.notes}</div>}
            <div className="foot"><button className="link-btn" onClick={() => setSelected(s.id)}>{t('Formatos')}</button><span><button className="link-btn" onClick={() => setEditing(s)}>{t('Editar')}</button><button className="link-btn danger" onClick={async () => { if (await ask(t('¿Archivar proveedor?'))) archive.mutate(s.id); }}>{t('Archivar')}</button></span></div>
          </article>))}</div>
      )}
      {selected && detail.data && (
        <Sheet title={detail.data.name} sub={t('Formatos de compra de este proveedor')} onClose={() => setSelected(null)}>
          {detail.data.formats.length ? <ul className="list">{detail.data.formats.map((f: any) => <li key={f.id} className="row"><Link to={`/ingredientes/${f.ingredient_id}`}>{f.ingredient_name}</Link><span className="muted">{f.label} · {num(f.pack_quantity_base)} {f.base_unit}</span></li>)}</ul> : <p className="muted">{t('Sin formatos asociados.')}</p>}
        </Sheet>
      )}
      {editing && <SupplierForm initial={editing.id ? editing : undefined} onClose={() => setEditing(null)} />}
      {node}
    </>
  );
}
