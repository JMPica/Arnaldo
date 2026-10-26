import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead, SelectField, StatusPill, useErrorText, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { compressImage } from '../lib/extract';
import { useI18n } from '../lib/i18n';

export default function Documents() {
  const { t, date, num } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [type, setType] = useState('invoice');
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['documents'], queryFn: () => api.get('/documents') });
  const up = useMutation({
    mutationFn: async (file: File) => {
      const f = await compressImage(file);
      const fd = new FormData();
      fd.append('file', f, f.name);
      fd.append('source_type', type);
      return api.upload('/documents', fd);
    },
    onSuccess: (r) => { qc.invalidateQueries(); toast(t('Documento subido')); nav(`/documentos/${r.id}`); },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'duplicate_document' && (e.details as any)?.id) { toast(errText(e), 'error'); nav(`/documentos/${(e.details as any).id}`); return; }
      toast(errText(e), 'error');
    },
  });
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = ''; };
  const kinds: Record<string, string> = { invoice: t('Factura'), delivery_note: t('Albarán'), receipt: t('Ticket'), other: t('Otro') };
  return (
    <>
      <PageHead kicker={t('Automatización documental')} title={t('Facturas y albaranes')} sub={t('Sube un PDF o haz una foto. La lectura es local y gratuita; nada cambia hasta que lo confirmes.')} />
      <section className="card panel" style={{ marginBottom: 14 }}>
        <div className="fields">
          <SelectField label={t('Tipo de documento')} value={type} onChange={setType} options={Object.entries(kinds) as [string, string][]} />
          <div className="field"><span className="label">{t('Archivo')}</span>
            <div className="actions">
              <button className="btn" disabled={up.isPending} onClick={() => camRef.current?.click()}>📷 {t('Hacer foto')}</button>
              <button className="btn light" disabled={up.isPending} onClick={() => fileRef.current?.click()}>{t('Elegir PDF o imagen')}</button>
            </div>
            <span className="hint">{t('PDF, JPG, PNG, WEBP o HEIC · máx. 10 MB · privado')}</span>
          </div>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} data-testid="doc-camera" />
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" hidden onChange={onFile} data-testid="doc-file" />
        {up.isPending && <p className="muted" role="status">{t('Subiendo…')}</p>}
        <div className="notice info" style={{ marginTop: 12 }}>{t('IA externa desactivada: no se envía ningún documento a terceros. Activarla requiere tu autorización expresa de costes y tratamiento de datos.')}</div>
      </section>
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !q.data.length ? <div className="card"><Empty title={t('Sin documentos')} /></div> : (
        <div className="card"><ul className="list">{(q.data as any[]).map((d) => (
          <li key={d.id}><Link className="row-link" to={`/documentos/${d.id}`}><div><div className="title-sm">{d.filename_original}</div><div className="muted">{kinds[d.source_type]} · {date(d.created_at.slice(0, 10))} · {num(d.size_bytes / 1024, 0)} KB{d.supplier_name ? ` · ${d.supplier_name}` : ''}{d.doc_reference ? ` · ${d.doc_reference}` : ''}</div></div><StatusPill status={d.review_status} /></Link></li>))}</ul></div>
      )}
    </>
  );
}
