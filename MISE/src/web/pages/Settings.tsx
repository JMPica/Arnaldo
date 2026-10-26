import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErrorBox, Loading, NumField, PageHead, SelectField, Tabs, TextArea, TextField, useErrorText, useToast } from '../components/ui';
import { api, download } from '../lib/api';
import { useI18n } from '../lib/i18n';

type Tab = 'general' | 'backup' | 'import' | 'security';

export default function Settings() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('general');
  return (
    <>
      <PageHead kicker={t('Tu entorno privado')} title={t('Ajustes y datos')} />
      <Tabs value={tab} onChange={setTab} tabs={[['general', t('General')], ['backup', t('Copias y exportación')], ['import', t('Importar MISE v1')], ['security', t('Seguridad y actividad')]]} />
      {tab === 'general' && <General />}
      {tab === 'backup' && <Backup />}
      {tab === 'import' && <LegacyImport />}
      {tab === 'security' && <Security />}
    </>
  );
}

function General() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (q.data && !f) setF({ ...q.data, proposal_validity_days: String(q.data.proposal_validity_days) }); }, [q.data, f]);
  const save = useMutation({
    mutationFn: () => api.patch('/settings', { locale: f.locale, brand_name: f.brand_name, brand_tagline: f.brand_tagline, contact_line: f.contact_line, default_vat_rate: f.default_vat_rate, vat_note: f.vat_note, default_target_margin_pct: f.default_target_margin_pct, chef_hourly_rate: f.chef_hourly_rate, price_alert_threshold_pct: f.price_alert_threshold_pct, proposal_validity_days: parseInt(f.proposal_validity_days, 10) || 15, proposal_terms: f.proposal_terms }),
    onSuccess: () => { qc.invalidateQueries(); toast(t('Ajustes guardados')); setF(null); },
    onError: (e) => toast(errText(e), 'error'),
  });
  if (!f) return <Loading />;
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  return (
    <section className="card panel">
      <div className="fields">
        <SelectField label={t('Idioma de la aplicación')} value={f.locale} onChange={set('locale')} options={[['es', 'Español'], ['ca', 'Català']]} />
        <TextField label={t('Nombre comercial')} value={f.brand_name} onChange={set('brand_name')} />
        <TextField label={t('Subtítulo de marca')} value={f.brand_tagline} onChange={set('brand_tagline')} />
        <TextField label={t('Línea de contacto en propuestas')} value={f.contact_line} onChange={set('contact_line')} placeholder={t('Teléfono · email · web')} />
        <NumField label={t('IVA por defecto en propuestas (%)')} value={f.default_vat_rate} onChange={set('default_vat_rate')} hint={t('Configurable por evento. Verifícalo con tu asesoría.')} />
        <NumField label={t('Margen objetivo por defecto (%)')} value={f.default_target_margin_pct} onChange={set('default_target_margin_pct')} />
        <NumField label={t('Tarifa de tus horas (€/h)')} value={f.chef_hourly_rate} onChange={set('chef_hourly_rate')} />
        <NumField label={t('Umbral de alerta de precio (%)')} value={f.price_alert_threshold_pct} onChange={set('price_alert_threshold_pct')} />
        <NumField label={t('Validez de las propuestas (días)')} value={f.proposal_validity_days} onChange={set('proposal_validity_days')} integer />
        <TextField label={t('Nota fiscal en propuestas')} value={f.vat_note} onChange={set('vat_note')} span2 />
        <TextArea label={t('Condiciones de la propuesta (visible para el cliente)')} value={f.proposal_terms} onChange={set('proposal_terms')} rows={4} />
      </div>
      <p className="footnote">{t('Moneda: EUR · Zona horaria: Europe/Madrid. MISE no emite facturas fiscales: las propuestas son presupuestos.')}</p>
      <button className="btn" style={{ marginTop: 12 }} disabled={save.isPending} onClick={() => save.mutate()}>{t('Guardar ajustes')}</button>
    </section>
  );
}

function Backup() {
  const { t, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const backups = useQuery({ queryKey: ['backups'], queryFn: () => api.get('/backups') });
  const [file, setFile] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const make = useMutation({ mutationFn: () => api.post('/backups'), onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups'] }); toast(t('Copia guardada en el servidor')); }, onError: (e) => toast(errText(e), 'error') });
  const pre = useMutation({ mutationFn: (b: any) => api.post('/restore/preview', b), onSuccess: setPreview, onError: (e) => toast(errText(e), 'error') });
  const restore = useMutation({ mutationFn: () => api.post('/restore/commit', { backup: file, confirm: confirmText }), onSuccess: (r) => { qc.invalidateQueries(); setFile(null); setPreview(null); setConfirmText(''); toast(r.mismatches.length ? t('Restaurado con diferencias: {d}', { d: r.mismatches.join(', ') }) : t('Restauración completada y verificada')); }, onError: (e) => toast(errText(e), 'error') });
  const csvs: [string, string][] = [['ingredients', t('Ingredientes y precios vigentes')], ['prices', t('Historial de precios')], ['recipes', t('Recetas y costes')], ['clients', t('Clientes')], ['events', t('Eventos y rentabilidad')], ['purchases', t('Compras')], ['stock', t('Movimientos de stock')]];
  return (
    <div className="grid two">
      <section className="card panel">
        <h3>{t('Copia de seguridad completa (JSON)')}</h3>
        <p className="muted2">{t('Todos tus datos, versionados y con suma de verificación. Guárdala fuera de la aplicación (cifrada si es posible).')}</p>
        <div className="actions"><button className="btn" onClick={() => download('/exports/backup.json', 'MISE_backup.json').catch((e) => toast(errText(e), 'error'))}>{t('Descargar copia')}</button>
          <button className="btn light" onClick={() => download('/exports/backup.json?files=1', 'MISE_backup.json').catch((e) => toast(errText(e), 'error'))}>{t('Con documentos adjuntos')}</button></div>
        <h3 style={{ marginTop: 18 }}>{t('Exportar CSV (Excel)')}</h3>
        <ul className="list">{csvs.map(([k, l]) => <li key={k} className="row"><span>{l}</span><button className="btn light sm" onClick={() => download(`/exports/csv/${k}`, `${k}.csv`).catch((e) => toast(errText(e), 'error'))}>CSV</button></li>)}</ul>
      </section>
      <section className="card panel">
        <h3>{t('Restaurar desde copia')}</h3>
        <p className="muted2">{t('Sustituye TODOS los datos actuales por los de la copia. Antes se guarda automáticamente una copia del estado actual en el servidor.')}</p>
        <input type="file" accept="application/json,.json" aria-label={t('Archivo de copia')} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const j = JSON.parse(await f.text()); setFile(j); pre.mutate(j); } catch { toast(t('El archivo no es un JSON válido'), 'error'); } }} />
        {preview && (
          <div style={{ marginTop: 12 }}>
            {preview.ok ? <div className="notice">{t('Copia válida · suma de verificación correcta')}{preview.files.missing_documents > 0 && ` · ${t('{n} documentos sin archivo (se indicarán como ausentes)', { n: preview.files.missing_documents })}`}</div> : <div className="notice danger">{t('Copia no válida')}: {preview.errors.join(', ')}</div>}
            <div className="table-wrap"><table><thead><tr><th>{t('Tabla')}</th><th className="num">{t('Actual')}</th><th className="num">{t('En la copia')}</th></tr></thead><tbody>{Object.keys(preview.counts).map((k) => <tr key={k}><td>{k}</td><td className="num">{num(preview.current_counts[k], 0)}</td><td className="num">{num(preview.counts[k], 0)}</td></tr>)}</tbody></table></div>
            {preview.ok && <><TextField label={t('Escribe RESTAURAR para confirmar')} value={confirmText} onChange={setConfirmText} /><button className="btn danger" style={{ marginTop: 10 }} disabled={confirmText !== 'RESTAURAR' || restore.isPending} onClick={() => restore.mutate()}>{t('Restaurar ahora')}</button></>}
          </div>
        )}
        <h3 style={{ marginTop: 18 }}>{t('Copias en el servidor')}</h3>
        <button className="btn light sm" onClick={() => make.mutate()} disabled={make.isPending}>{t('Crear copia ahora')}</button>
        {backups.data?.length ? <ul className="list">{(backups.data as any[]).map((b) => <li key={b.id} className="row"><span>{b.created_at.slice(0, 16).replace('T', ' ')} · {({ manual: t('manual'), pre_import: t('antes de importar'), pre_restore: t('antes de restaurar') } as Record<string, string>)[b.reason]} · {t('{n} registros', { n: b.record_count })}</span><button className="link-btn" onClick={() => download(`/backups/${b.id}/download`, 'backup.json')}>{t('Descargar')}</button></li>)}</ul> : <p className="muted">{t('Aún no hay copias en el servidor.')}</p>}
      </section>
    </div>
  );
}

function LegacyImport() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [text, setText] = useState('');
  const [acceptDemo, setAcceptDemo] = useState(false);
  const [merge, setMerge] = useState(false);
  const preview = useMutation({ mutationFn: (json: string) => api.post('/imports/legacy/preview', { json }), onError: (e) => toast(errText(e), 'error') });
  const commit = useMutation({ mutationFn: () => api.post('/imports/legacy/commit', { json: text, confirm: true, accept_demo: acceptDemo, allow_reimport: merge }), onSuccess: () => { qc.invalidateQueries(); toast(t('Importación completada')); }, onError: (e) => toast(errText(e), 'error') });
  const p = preview.data;
  const r = commit.data;
  const labels: Record<string, string> = { suppliers: t('Proveedores'), ingredients: t('Ingredientes'), purchase_formats: t('Formatos'), price_history: t('Precios'), recipes: t('Recetas'), recipe_lines: t('Líneas de receta'), menus: t('Menús'), menu_lines: t('Pases'), clients: t('Clientes'), events: t('Eventos'), event_costs: t('Costes de evento'), stock_movements: t('Stock inicial') };
  return (
    <section className="card panel">
      <h3>{t('Importar copia de MISE v1 (MISE_copia_AAAA-MM-DD.json)')}</h3>
      <p className="muted2">{t('Proceso seguro: vista previa sin cambios → copia de seguridad automática → importación en una sola transacción → conciliación de costes. Los datos existentes no se borran.')}</p>
      <input type="file" accept="application/json,.json" aria-label={t('Archivo v1')} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const txt = await f.text(); setText(txt); preview.mutate(txt); }} />
      {p && (
        <div style={{ marginTop: 12 }}>
          {!p.ok ? <div className="notice danger">{t('El archivo no se puede importar. No se ha cambiado nada.')}<ul>{p.errors.slice(0, 12).map((e: any, i: number) => <li key={i}>{e.path}: {e.message}</li>)}</ul></div> : <>
            <div className="notice">{t('Origen')}: {Object.entries(p.source_counts).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
            <div className="table-wrap"><table><thead><tr><th>{t('Se crearán')}</th><th className="num">{t('Registros')}</th></tr></thead><tbody>{Object.entries(p.to_create as Record<string, number>).map(([k, v]) => <tr key={k}><td>{labels[k] ?? k}</td><td className="num">{v}</td></tr>)}</tbody></table></div>
            {Object.values(p.reused ?? {}).some((v: any) => v > 0) && <div className="notice info">{t('Se reutilizarán entidades existentes con el mismo nombre (sin duplicar).')}</div>}
            {p.warnings.length > 0 && <div className="notice warn"><strong>{t('Avisos')}</strong><ul>{p.warnings.slice(0, 15).map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></div>}
            {p.demo && <label className="check"><input type="checkbox" checked={acceptDemo} onChange={(e) => setAcceptDemo(e.target.checked)} />{t('La copia está marcada como demo: entiendo que importaré datos de ejemplo.')}</label>}
            {p.already_imported && <label className="check"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} />{t('Esta copia ya se importó: confirmo fusionar (no se duplicarán entidades con el mismo nombre).')}</label>}
            <button className="btn" style={{ marginTop: 10 }} disabled={commit.isPending || (p.demo && !acceptDemo) || (!!p.already_imported && !merge)} onClick={() => commit.mutate()}>{t('Importar ahora')}</button>
          </>}
        </div>
      )}
      {r && (
        <div className="notice" style={{ marginTop: 12 }}>
          <strong>{t('Importación completada')}</strong> · {t('copia previa')}: {r.pre_import_backup.slice(0, 8)} · {t('{n} presupuestos congelados', { n: r.snapshots_created })}
          <ul>{r.reconciliation.map((x: any) => <li key={x.recipe}>{x.recipe}: v1 {x.legacy_portion_cost} → v2 {x.v2_portion_cost} {x.equal ? '✓' : `⚠ ${t('difiere (v1 limitaba la merma al 95 %)')}`}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function Security() {
  const { t } = useI18n();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get('/me') });
  const ai = useQuery({ queryKey: ['ai'], queryFn: () => api.get('/ai/status') });
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => api.get('/audit') });
  return (
    <div className="grid two">
      <section className="card panel">
        <h3>{t('Sesión')}</h3>
        {me.isError ? <ErrorBox error={me.error} /> : me.data && <div className="kv" style={{ marginTop: 10 }}>
          <span className="k">{t('Usuario')}</span><span className="v">{me.data.email}</span>
          <span className="k">{t('Rol')}</span><span className="v">{me.data.role === 'owner' ? t('Propietario') : t('Colaborador')}</span>
          <span className="k">{t('Autenticación')}</span><span className="v">{me.data.auth_mode === 'cloudflare_access' ? 'Cloudflare Access' : t('Desarrollo local')}</span>
          <span className="k">{t('Entorno')}</span><span className="v">{me.data.app_env}</span>
        </div>}
        <p className="footnote">{t('Para cerrar sesión o revocar accesos usa el panel de Cloudflare Zero Trust (o /cdn-cgi/access/logout).')}</p>
        <h3 style={{ marginTop: 16 }}>{t('IA externa')}</h3>
        <p className="muted2">{ai.data?.enabled ? '—' : t('Desactivada por diseño. Presupuesto mensual: 0 €. Requiere tu autorización expresa de costes y tratamiento de datos.')}</p>
      </section>
      <section className="card panel">
        <h3>{t('Actividad reciente (auditoría)')}</h3>
        {audit.data ? <ul className="list">{(audit.data as any[]).slice(0, 60).map((a, i) => <li key={i} className="row"><span>{a.action} · {a.entity_type}</span><span className="muted">{a.created_at.slice(0, 16).replace('T', ' ')}</span></li>)}</ul> : <Loading />}
      </section>
    </div>
  );
}
