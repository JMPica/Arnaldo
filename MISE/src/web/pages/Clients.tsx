import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead, SelectField, Sheet, StatusPill, TextArea, TextField, fieldErrors, useConfirm, useErrorText, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

export function ClientForm({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved?: (c: any) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [f, setF] = useState({ display_name: initial?.display_name ?? '', email: initial?.email ?? '', phone: initial?.phone ?? '', address_private: initial?.address_private ?? '', dietary_preferences: initial?.dietary_preferences ?? '', notes_private: initial?.notes_private ?? '', legal_basis: initial?.legal_basis ?? 'precontractual' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const m = useMutation({ mutationFn: () => (initial?.id ? api.patch(`/clients/${initial.id}`, f) : api.post('/clients', f)), onSuccess: (c) => { qc.invalidateQueries(); toast(t('Cliente guardado')); onSaved?.(c); onClose(); }, onError: (e) => { setErrors(fieldErrors(e)); toast(errText(e), 'error'); } });
  return (
    <Sheet title={initial?.id ? t('Editar cliente') : t('Nuevo cliente')} sub={t('Datos mínimos necesarios. Información privada.')} onClose={onClose}
      footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={m.isPending} onClick={() => m.mutate()}>{t('Guardar')}</button></>}>
      <div className="fields">
        <TextField label={t('Nombre del cliente')} value={f.display_name} onChange={set('display_name')} required span2 error={errors.display_name} />
        <TextField label={t('Teléfono')} type="tel" value={f.phone} onChange={set('phone')} />
        <TextField label={t('Email')} type="email" value={f.email} onChange={set('email')} error={errors.email} />
        <TextField label={t('Dirección (privada)')} value={f.address_private} onChange={set('address_private')} span2 />
        <TextArea label={t('Preferencias dietéticas')} value={f.dietary_preferences} onChange={set('dietary_preferences')} rows={2} />
        <SelectField label={t('Base del tratamiento de datos')} value={f.legal_basis} onChange={set('legal_basis')} span2 options={[['precontractual', t('Medidas precontractuales (presupuesto)')], ['contract', t('Ejecución de contrato')], ['consent', t('Consentimiento')], ['legitimate_interest', t('Interés legítimo')]]} />
        <TextArea label={t('Notas privadas')} value={f.notes_private} onChange={set('notes_private')} rows={2} />
      </div>
      <p className="footnote">{t('Evita notas médicas innecesarias: registra solo restricciones alimentarias relevantes para el servicio.')}</p>
    </Sheet>
  );
}

export default function Clients() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const { ask, node } = useConfirm();
  const q = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const detail = useQuery({ queryKey: ['client', id], queryFn: () => api.get(`/clients/${id}`), enabled: !!id });
  const archive = useMutation({ mutationFn: ({ cid, anon }: { cid: string; anon: boolean }) => api.del(`/clients/${cid}${anon ? '?anonymize=1' : ''}`), onSuccess: () => { qc.invalidateQueries(); nav('/clientes'); } });
  const list = ((q.data ?? []) as any[]).filter((c) => !filter || `${c.display_name} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <PageHead kicker={t('Gestión de clientes')} title={t('Clientes')} actions={<button className="btn" onClick={() => setEditing({})}>＋ {t('Nuevo cliente')}</button>} />
      <div className="toolbar"><input className="search" type="search" placeholder={t('Buscar cliente…')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Buscar')} /></div>
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !list.length ? <div className="card"><Empty title={t('Sin clientes')} action={<button className="btn" onClick={() => setEditing({})}>{t('Añadir cliente')}</button>} /></div> : (
        <div className="card"><ul className="list">{list.map((c) => (
          <li key={c.id}><Link className="row-link" to={`/clientes/${c.id}`}><div><div className="title-sm">{c.display_name}</div><div className="muted">{[c.phone, c.email].filter(Boolean).join(' · ') || t('Sin contacto')}</div></div>
            <div className="right muted">{t('{n} eventos', { n: c.events_count })}{c.last_event_date ? <div>{date(c.last_event_date)}</div> : null}</div></Link></li>))}</ul></div>
      )}
      {id && detail.data && (
        <Sheet title={detail.data.display_name} onClose={() => nav('/clientes')}
          footer={<>
            <button className="btn danger" onClick={async () => { if (await ask(t('¿Archivar y anonimizar este cliente? Se borran sus datos personales; se conservan los importes de sus eventos.'))) archive.mutate({ cid: detail.data.id, anon: true }); }}>{t('Anonimizar')}</button>
            <button className="btn light" onClick={() => setEditing(detail.data)}>{t('Editar')}</button>
            <Link className="btn" to={`/eventos/nuevo?client=${detail.data.id}`}>＋ {t('Evento')}</Link>
          </>}>
          <div className="kv">
            <span className="k">{t('Teléfono')}</span><span className="v">{detail.data.phone || '—'}</span>
            <span className="k">{t('Email')}</span><span className="v">{detail.data.email || '—'}</span>
            <span className="k">{t('Dirección')}</span><span className="v">{detail.data.address_private || '—'}</span>
            <span className="k">{t('Preferencias')}</span><span className="v">{detail.data.dietary_preferences || '—'}</span>
          </div>
          {detail.data.notes_private && <p className="muted2" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{detail.data.notes_private}</p>}
          <h3 style={{ marginTop: 16 }}>{t('Eventos')}</h3>
          <ul className="list">{detail.data.events.map((e: any) => <li key={e.id}><Link className="row-link" style={{ padding: '10px 0' }} to={`/eventos/${e.id}`}><span>{e.title} · {date(e.event_date)}</span><StatusPill status={e.status} /></Link></li>)}</ul>
        </Sheet>
      )}
      {editing && <ClientForm initial={editing.id ? editing : undefined} onClose={() => setEditing(null)} />}
      {node}
    </>
  );
}
