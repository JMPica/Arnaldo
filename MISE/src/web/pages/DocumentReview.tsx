import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { extractFromText, matchIngredient, normalizeUnit, type Extraction } from '../../shared/invoice';
import { ErrorBox, Loading, PageHead, SelectField, StatusPill, TextField, useConfirm, useErrorText, useToast } from '../components/ui';
import { api } from '../lib/api';
import { ocrImages, pdfText, pdfToImages } from '../lib/extract';
import { useI18n } from '../lib/i18n';

interface ReviewLine { include: boolean; description: string; ingredient_id: string; format_id: string; new_format_label: string; packs: string; pack_quantity_base: string; pack_price: string; level: string; score: number; arithmetic_ok: boolean }

const baseFactor: Record<string, [string, number]> = { kg: ['g', 1000], g: ['g', 1], l: ['ml', 1000], ml: ['ml', 1], cl: ['ml', 10], ud: ['ud', 1] };

export default function DocumentReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, money, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const { ask, node } = useConfirm();
  const doc = useQuery({ queryKey: ['document', id], queryFn: () => api.get(`/documents/${id}`) });
  const ings = useQuery({ queryKey: ['ingredients', 'active'], queryFn: () => api.get('/ingredients') });
  const formats = useQuery({ queryKey: ['formats'], queryFn: () => api.get('/purchase-formats') });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const [previews, setPreviews] = useState<string[]>([]);
  const [stage, setStage] = useState<{ label: string; value: number } | null>(null);
  const [header, setHeader] = useState({ supplier_id: '', doc_date: '', doc_reference: '' });
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [ext, setExt] = useState<Extraction | null>(null);
  const [receive, setReceive] = useState(true);
  const [allowDup, setAllowDup] = useState(false);
  const fileUrl = `/api/v1/documents/${id}/file`;

  // Previsualización: imágenes directamente; PDF renderizado localmente con pdf.js (funciona igual en iPhone)
  useEffect(() => {
    let urls: string[] = [];
    if (!doc.data) return;
    (async () => {
      if (doc.data.mime_type === 'application/pdf') {
        const buf = await (await fetch(fileUrl, { credentials: 'same-origin' })).arrayBuffer();
        const imgs = await pdfToImages(buf, 4);
        urls = imgs.map((b) => URL.createObjectURL(b));
        setPreviews(urls);
      } else setPreviews([fileUrl]);
    })().catch(() => setPreviews([]));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [doc.data?.id, doc.data?.mime_type, fileUrl]);

  const ingList = (ings.data ?? []) as any[];
  const fmtList = (formats.data ?? []) as any[];
  const toLine = (l: Extraction['lines'][number]): ReviewLine => {
    const m = matchIngredient(l.description, ingList, fmtList);
    const ing = ingList.find((i) => i.id === m.best?.ingredient_id);
    const unit = l.unit ? normalizeUnit(l.unit) : 'ud';
    const fmt = m.best?.format_id ? fmtList.find((f) => f.id === m.best!.format_id) : fmtList.find((f) => f.ingredient_id === ing?.id && (!header.supplier_id || f.supplier_id === header.supplier_id));
    let packQty = '1';
    const bf = baseFactor[unit];
    if (bf && ing && bf[0] === ing.base_unit && unit !== 'ud') packQty = String(bf[1]);
    else if (fmt) packQty = String(fmt.pack_quantity_base);
    return { include: m.level !== 'none', description: l.description, ingredient_id: m.level === 'none' ? '' : m.best?.ingredient_id ?? '', format_id: unit !== 'ud' && bf && ing && fmt && String(fmt.pack_quantity_base) !== packQty ? '' : fmt?.id ?? '', new_format_label: '', packs: l.quantity ?? '1', pack_quantity_base: packQty, pack_price: l.unit_price ?? '', level: m.level, score: m.best?.score ?? 0, arithmetic_ok: l.arithmetic_ok };
  };

  useEffect(() => {
    if (!doc.data?.extraction || ext || !ings.data || !formats.data) return;
    const saved = doc.data.extraction.data as Extraction & { review?: ReviewLine[] };
    setExt(saved);
    setHeader({ supplier_id: doc.data.supplier_id ?? saved.supplier_id_guess ?? '', doc_date: doc.data.doc_date ?? saved.date ?? '', doc_reference: doc.data.doc_reference ?? saved.reference ?? '' });
    setLines(saved.review ?? (saved.lines ?? []).map(toLine));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.data, ings.data, formats.data]);

  const extract = useMutation({
    mutationFn: async () => {
      const buf = await (await fetch(fileUrl, { credentials: 'same-origin' })).arrayBuffer();
      let text = '';
      let method: 'pdf_text' | 'ocr_local' = 'pdf_text';
      if (doc.data.mime_type === 'application/pdf') {
        setStage({ label: t('Leyendo texto del PDF'), value: 0.2 });
        text = (await pdfText(buf)).text;
        if (text.replace(/\s/g, '').length < 40) {
          method = 'ocr_local';
          text = await ocrImages(await pdfToImages(buf, 3), (s, v) => setStage({ label: s, value: v }));
        }
      } else {
        if (/heic|heif/.test(doc.data.mime_type) && !/Safari/.test(navigator.userAgent)) throw new Error('heic');
        method = 'ocr_local';
        text = await ocrImages([new Blob([buf], { type: doc.data.mime_type })], (s, v) => setStage({ label: s, value: v }));
      }
      const x = extractFromText(text, (suppliers.data ?? []) as any[]);
      const review = x.lines.map(toLine);
      await api.put(`/documents/${id}/extraction`, { method, supplier_id: x.supplier_id_guess, doc_date: x.date, doc_reference: x.reference, text_excerpt: text.slice(0, 15000), data: { ...x, review } });
      return { x, review };
    },
    onSuccess: ({ x, review }) => { setExt(x); setLines(review); setHeader({ supplier_id: x.supplier_id_guess ?? '', doc_date: x.date ?? new Date().toISOString().slice(0, 10), doc_reference: x.reference ?? '' }); setStage(null); qc.invalidateQueries({ queryKey: ['documents'] }); toast(t('Propuesta extraída: revísala antes de confirmar')); },
    onError: (e) => { setStage(null); toast((e as Error).message === 'heic' ? t('Este navegador no puede leer HEIC: usa Safari en iPhone o sube JPG.') : t('No se pudo extraer el texto. Puedes introducir las líneas a mano.'), 'error'); },
  });
  const confirm = useMutation({
    mutationFn: () => api.post(`/documents/${id}/confirm`, { supplier_id: header.supplier_id || null, doc_date: header.doc_date, doc_reference: header.doc_reference || null, receive_stock: receive, allow_duplicate_reference: allowDup,
      lines: lines.filter((l) => l.include).map((l) => ({ ingredient_id: l.ingredient_id, format_id: l.format_id || null, new_format_label: !l.format_id ? (l.new_format_label || `${l.pack_quantity_base} ${ingList.find((i) => i.id === l.ingredient_id)?.base_unit ?? ''}`) : null, description: l.description, packs: l.packs, pack_quantity_base: l.pack_quantity_base, pack_price: l.pack_price })) }),
    onSuccess: (r) => { qc.invalidateQueries(); toast(t('Compra creada y precios actualizados')); nav(`/compras/pedidos/${r.purchase_id}`); },
    onError: (e) => toast(errText(e), 'error'),
  });
  const reject = useMutation({ mutationFn: () => api.post(`/documents/${id}/reject`), onSuccess: () => { qc.invalidateQueries(); nav('/documentos'); } });
  const remove = useMutation({ mutationFn: () => api.del(`/documents/${id}`), onSuccess: () => { qc.invalidateQueries(); nav('/documentos'); } });

  const sum = useMemo(() => lines.filter((l) => l.include).reduce((a, l) => a + (Number(l.packs.replace(',', '.')) || 0) * (Number(l.pack_price.replace(',', '.')) || 0), 0), [lines]);
  if (doc.isError) return <ErrorBox error={doc.error} />;
  if (!doc.data || !ings.data || !formats.data || !suppliers.data) return <Loading />;
  const d = doc.data;
  const reviewed = d.review_status === 'reviewed' || d.review_status === 'rejected';
  const upd = (i: number, p: Partial<ReviewLine>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const valid = lines.some((l) => l.include) && lines.filter((l) => l.include).every((l) => l.ingredient_id && Number(l.packs.replace(',', '.')) > 0 && Number(l.pack_quantity_base.replace(',', '.')) > 0 && l.pack_price !== '') && /^\d{4}-\d{2}-\d{2}$/.test(header.doc_date);
  const totalDoc = ext?.totals.base ?? null;
  return (
    <>
      <PageHead back={{ to: '/documentos', label: t('Documentos') }} kicker={t('Revisión de documento')} title={d.filename_original} sub={<span className="actions"><StatusPill status={d.review_status} /><span className="muted">sha256 {String(d.sha256).slice(0, 12)}…</span></span>}
        actions={<>
          <a className="btn light" href={`${fileUrl}?download=1`}>{t('Descargar original')}</a>
          {!reviewed && <button className="btn danger" onClick={async () => { if (await ask(t('¿Descartar este documento?'))) reject.mutate(); }}>{t('Descartar')}</button>}
          {d.review_status !== 'reviewed' && <button className="btn danger" onClick={async () => { if (await ask(t('¿Eliminar el documento y su archivo?'))) remove.mutate(); }}>{t('Eliminar')}</button>}
        </>} />
      <div className="split">
        <section className="card panel sticky" aria-label={t('Vista previa')}>
          {previews.length ? previews.map((u, i) => <img key={u} src={u} alt={`${t('Página')} ${i + 1}`} className="preview-img" style={{ marginBottom: 8 }} />) : <Loading />}
        </section>
        <div className="stack">
          {d.review_status === 'reviewed' && <div className="notice">{t('Documento revisado el {d}.', { d: String(d.reviewed_at).slice(0, 10) })} <Link to={`/compras/pedidos/${d.purchase_id}`}>{t('Ver compra creada')}</Link></div>}
          {!reviewed && (
            <section className="card panel">
              <div className="panel-head"><h3>{t('1 · Extraer datos (local)')}</h3></div>
              <p className="muted2">{t('PDF con texto: lectura directa. Foto o escaneo: OCR en tu dispositivo (puede tardar unos segundos la primera vez).')}</p>
              <div className="actions"><button className="btn" disabled={extract.isPending} onClick={() => extract.mutate()}>{ext ? t('Volver a extraer') : t('Extraer datos')}</button>
                <button className="btn light" onClick={() => { setExt({ supplier_guess: null, supplier_id_guess: null, date: null, reference: null, tax_id: null, lines: [], totals: { base: null, vat: null, total: null }, warnings: [] }); setHeader({ ...header, doc_date: header.doc_date || new Date().toISOString().slice(0, 10) }); setLines([{ include: true, description: '', ingredient_id: '', format_id: '', new_format_label: '', packs: '1', pack_quantity_base: '1', pack_price: '', level: 'none', score: 0, arithmetic_ok: false }]); }}>{t('Introducir a mano')}</button></div>
              {stage && <div style={{ marginTop: 10 }} role="status"><div className="muted">{stage.label}</div><div className="progress"><span style={{ width: `${Math.round(stage.value * 100)}%` }} /></div></div>}
              {ext?.warnings.includes('no_lines_detected') && <div className="notice warn" style={{ marginTop: 10 }}>{t('No se detectaron líneas: añádelas a mano.')}</div>}
            </section>
          )}
          {ext && !reviewed && (
            <>
              <section className="card panel">
                <h3>{t('2 · Cabecera')}</h3>
                <div className="fields three" style={{ marginTop: 10 }}>
                  <SelectField label={t('Proveedor')} value={header.supplier_id} onChange={(v) => setHeader({ ...header, supplier_id: v })} options={[['', ext.supplier_guess ? `— ${t('Detectado')}: ${ext.supplier_guess.slice(0, 40)} —` : t('— Sin proveedor —')], ...(suppliers.data as any[]).map((s) => [s.id, s.name] as [string, string])]} />
                  <TextField label={t('Fecha')} type="date" value={header.doc_date} onChange={(v) => setHeader({ ...header, doc_date: v })} required />
                  <TextField label={t('Nº documento')} value={header.doc_reference} onChange={(v) => setHeader({ ...header, doc_reference: v })} />
                </div>
                {ext.totals.total && <p className="muted" style={{ marginTop: 8 }}>{t('Totales leídos')}: {t('base')} {ext.totals.base ?? '—'} · {t('IVA')} {ext.totals.vat ?? '—'} · {t('total')} {ext.totals.total}</p>}
              </section>
              <section className="card panel">
                <div className="panel-head"><h3>{t('3 · Líneas y correspondencias')}</h3><span className="muted">{t('Precios sin IVA por envase')}</span></div>
                {lines.map((l, i) => {
                  const ing = ingList.find((x) => x.id === l.ingredient_id);
                  const fmts = fmtList.filter((f) => f.ingredient_id === l.ingredient_id);
                  return (
                    <div key={i} style={{ background: l.include ? 'var(--sage-mist)' : '#f6f6f6', borderRadius: 12, padding: 10, marginBottom: 8, opacity: l.include ? 1 : 0.6 }}>
                      <div className="actions" style={{ justifyContent: 'space-between' }}>
                        <label className="check"><input type="checkbox" checked={l.include} onChange={(e) => upd(i, { include: e.target.checked })} /><span className="strong">{l.description || t('Línea {n}', { n: i + 1 })}</span></label>
                        <span className={`conf-${l.level}`} style={{ fontSize: 12.5, fontWeight: 650 }}>{({ high: t('Coincidencia alta'), medium: t('Coincidencia dudosa'), low: t('Coincidencia baja'), none: t('Sin coincidencia') } as Record<string, string>)[l.level]}{l.score ? ` · ${Math.round(l.score * 100)}%` : ''}{!l.arithmetic_ok && l.level !== 'none' ? ` · ${t('revisar importes')}` : ''}</span>
                      </div>
                      <div className="fields three">
                        <TextField label={t('Descripción')} value={l.description} onChange={(v) => upd(i, { description: v })} />
                        <SelectField label={t('Ingrediente del catálogo')} value={l.ingredient_id} onChange={(v) => upd(i, { ingredient_id: v, format_id: '' })} options={[['', t('— Elegir —')], ...ingList.map((x) => [x.id, x.name] as [string, string])]} />
                        <SelectField label={t('Formato')} value={l.format_id} onChange={(v) => { const f = fmts.find((x) => x.id === v); upd(i, { format_id: v, pack_quantity_base: f ? String(f.pack_quantity_base) : l.pack_quantity_base }); }} options={[['', t('＋ Crear formato nuevo')], ...fmts.map((f) => [f.id, `${f.label}${f.supplier_name ? ` · ${f.supplier_name}` : ''}`] as [string, string])]} />
                        {!l.format_id && <TextField label={t('Nombre del formato nuevo')} value={l.new_format_label} onChange={(v) => upd(i, { new_format_label: v })} placeholder={`${l.pack_quantity_base} ${ing?.base_unit ?? ''}`} />}
                        <TextField label={t('Envases / cantidad')} value={l.packs} onChange={(v) => upd(i, { packs: v })} />
                        <TextField label={t('Contenido por envase ({u})', { u: ing?.base_unit ?? '' })} value={l.pack_quantity_base} onChange={(v) => upd(i, { pack_quantity_base: v })} />
                        <TextField label={t('Precio por envase (€)')} value={l.pack_price} onChange={(v) => upd(i, { pack_price: v })} />
                      </div>
                      <div className="muted right">{t('Importe')}: {money((Number(l.packs.replace(',', '.')) || 0) * (Number(l.pack_price.replace(',', '.')) || 0))}</div>
                    </div>
                  );
                })}
                <button className="btn light sm" onClick={() => setLines([...lines, { include: true, description: '', ingredient_id: '', format_id: '', new_format_label: '', packs: '1', pack_quantity_base: '1', pack_price: '', level: 'none', score: 0, arithmetic_ok: false }])}>＋ {t('Línea')}</button>
              </section>
              <section className="card panel">
                <h3>{t('4 · Confirmar')}</h3>
                <div className="kv" style={{ marginTop: 8 }}><span className="k">{t('Suma de líneas incluidas')}</span><span className="v">{money(sum)}</span>{totalDoc && <><span className="k">{t('Base imponible leída')}</span><span className={`v ${Math.abs(Number(totalDoc) - sum) > 0.05 ? 'neg' : 'pos'}`}>{money(totalDoc)}</span></>}</div>
                {totalDoc && Math.abs(Number(totalDoc) - sum) > 0.05 && <div className="notice warn" style={{ marginTop: 8 }}>{t('La suma no cuadra con la base imponible del documento. Revisa líneas, descuentos o portes.')}</div>}
                <label className="check"><input type="checkbox" checked={receive} onChange={(e) => setReceive(e.target.checked)} />{t('La mercancía está recibida (sumar al stock)')}</label>
                <label className="check"><input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} />{t('Permitir aunque exista otra compra con la misma referencia')}</label>
                <button className="btn block" style={{ marginTop: 10 }} disabled={!valid || confirm.isPending} onClick={async () => { if (await ask(t('Se registrarán {n} precios con fecha {d} y se creará la compra. ¿Confirmas?', { n: lines.filter((l) => l.include).length, d: header.doc_date }), false)) confirm.mutate(); }}>{t('Confirmar y actualizar precios')}</button>
                {!valid && <p className="muted" style={{ marginTop: 6 }}>{t('Cada línea incluida necesita ingrediente, cantidad, contenido y precio; y el documento, fecha.')}</p>}
              </section>
            </>
          )}
        </div>
      </div>
      {node}
      <p className="footnote">{t('Original, extracción, revisor y fecha quedan guardados para trazabilidad. Duplicados detectados por huella del archivo y por proveedor + referencia.')} {num(d.size_bytes / 1024, 0)} KB</p>
    </>
  );
}
