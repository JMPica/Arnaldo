import { Hono } from 'hono';
import { dec } from '../../shared/decimal';
import { DocumentConfirmSchema, DocumentExtractionSchema } from '../../shared/schemas';
import { getDb, nowIso, uuid } from '../db';
import type { AppEnv } from '../env';
import { ApiError, body } from '../http';
import { blobGet, blobPutStmts, sha256Hex } from '../services/backup';
import { createPurchase } from './purchasing';

export const documents = new Hono<AppEnv>();

type Mime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif';
const EXT: Record<Mime, string[]> = {
  'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/heic': ['heic'], 'image/heif': ['heif', 'heic'],
};

/** Detecta el tipo REAL por firma (magic bytes); el MIME declarado por el navegador no se considera fiable. */
export function sniffMime(b: Uint8Array): Mime | null {
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length >= 5 && ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a) return 'image/png';
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1', 'heif'].includes(brand)) return 'image/heif';
  }
  return null;
}

export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'documento';
  const clean = base.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').trim();
  return (clean || 'documento').slice(0, 120);
}

documents.post('/documents', async (c) => {
  const db = getDb(c);
  const max = Number(c.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > max + 64 * 1024) throw new ApiError(413, 'file_too_large', { max_bytes: max });
  if (!(c.req.header('content-type') ?? '').startsWith('multipart/form-data')) throw new ApiError(415, 'multipart_required');
  const form = await c.req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ApiError(422, 'file_required');
  const f = file as File;
  if (f.size <= 0) throw new ApiError(422, 'empty_file');
  if (f.size > max) throw new ApiError(413, 'file_too_large', { max_bytes: max });
  const bytes = new Uint8Array(await f.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) throw new ApiError(415, 'unsupported_file_type');
  const filename = safeFilename(f.name || 'documento');
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  if (!EXT[mime].includes(ext)) throw new ApiError(415, 'extension_mismatch', { detected: mime });
  const sourceType = String(form.get('source_type') ?? 'invoice');
  if (!['invoice', 'delivery_note', 'receipt', 'other'].includes(sourceType)) throw new ApiError(422, 'invalid_source_type');
  const sha = await sha256Hex(bytes);
  const dup = await db.first<{ id: string; created_at: string; review_status: string }>('SELECT id, created_at, review_status FROM documents WHERE owner_id = ? AND sha256 = ?', db.owner, sha);
  if (dup) throw new ApiError(409, 'duplicate_document', dup);
  const id = uuid();
  const key = `doc/${uuid()}`;
  await db.batch([
    ...blobPutStmts(db, key, bytes),
    db.prepare('INSERT INTO documents (id, owner_id, filename_original, blob_key, storage, sha256, mime_type, size_bytes, source_type) VALUES (?,?,?,?,?,?,?,?,?)', id, db.owner, filename, key, 'd1', sha, mime, bytes.length, sourceType),
    db.audit('upload', 'document', id, { mime, size: bytes.length }),
  ]);
  return c.json({ id, mime_type: mime, sha256: sha, size_bytes: bytes.length }, 201);
});

documents.get('/documents', async (c) => {
  const db = getDb(c);
  return c.json(await db.all(`SELECT d.id, d.filename_original, d.mime_type, d.size_bytes, d.source_type, d.review_status, d.doc_date, d.doc_reference, d.extraction_method, d.purchase_id, d.reviewed_at, d.created_at, s.name AS supplier_name
    FROM documents d LEFT JOIN suppliers s ON s.id = d.supplier_id WHERE d.owner_id = ? ORDER BY d.created_at DESC LIMIT 300`, db.owner));
});

documents.get('/documents/:id', async (c) => {
  const db = getDb(c);
  const d = await db.owned('documents', c.req.param('id'));
  return c.json({ ...d, blob_key: undefined, extraction: d.extraction_json ? JSON.parse(String(d.extraction_json)) : null, extraction_json: undefined });
});

/** Descarga/previsualización autenticada; nunca URL pública ni caché compartida. */
documents.get('/documents/:id/file', async (c) => {
  const db = getDb(c);
  const d = await db.owned('documents', c.req.param('id'));
  const bytes = await blobGet(db, String(d.blob_key));
  if (!bytes) throw new ApiError(404, 'file_missing');
  const name = encodeURIComponent(String(d.filename_original));
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      'content-type': String(d.mime_type),
      'content-disposition': `${c.req.query('download') === '1' ? 'attachment' : 'inline'}; filename*=UTF-8''${name}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
});

/** Guarda la PROPUESTA de extracción (texto PDF u OCR local hecho en el navegador). No toca precios ni stock. */
documents.put('/documents/:id/extraction', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const doc = await db.owned('documents', id);
  if (doc.review_status === 'reviewed') throw new ApiError(409, 'already_reviewed');
  const d = await body(c, DocumentExtractionSchema, 400_000);
  if (d.supplier_id) await db.owned('suppliers', d.supplier_id);
  const json = JSON.stringify({ data: d.data, text_excerpt: d.text_excerpt ?? null, saved_at: nowIso() });
  if (json.length > 380_000) throw new ApiError(413, 'extraction_too_large');
  await db.batch([
    db.prepare("UPDATE documents SET extraction_json = ?, extraction_method = ?, review_status = 'extracted', supplier_id = ?, doc_date = ?, doc_reference = ?, source_type = COALESCE(?, source_type) WHERE id = ? AND owner_id = ?",
      json, d.method, d.supplier_id ?? null, d.doc_date ?? null, d.doc_reference ?? null, d.source_type ?? null, id, db.owner),
    db.audit('extract', 'document', id, { method: d.method }),
  ]);
  return c.json({ ok: true });
});

/**
 * Confirmación humana: crea la compra vinculada, registra precios (origen documento) y, opcionalmente,
 * la recepción de stock. Evita duplicados por proveedor + referencia y por hash del fichero.
 */
documents.post('/documents/:id/confirm', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const doc = await db.owned('documents', id);
  if (doc.review_status === 'reviewed') throw new ApiError(409, 'already_reviewed', { purchase_id: doc.purchase_id });
  if (doc.review_status === 'rejected') throw new ApiError(409, 'document_rejected');
  const d = await body(c, DocumentConfirmSchema, 400_000);
  const stmts: D1PreparedStatement[] = [];
  // formatos nuevos propuestos en la revisión
  const fmtRows: Record<string, unknown>[] = [];
  const lines = d.lines.map((l) => {
    let formatId = l.format_id ?? null;
    if (!formatId && l.new_format_label) {
      formatId = uuid();
      fmtRows.push({ id: formatId, ingredient_id: l.ingredient_id, supplier_id: d.supplier_id ?? null, label: l.new_format_label, pack_quantity_base: l.pack_quantity_base, whole_packs_only: 1, is_active: 1 });
    }
    return { ingredient_id: l.ingredient_id, format_id: formatId, description: l.description ?? null, ordered_packs: l.packs, pack_quantity_base: l.pack_quantity_base, pack_price: l.pack_price };
  });
  const ingIds = new Set((await db.all<{ id: string }>('SELECT id FROM ingredients WHERE owner_id = ?', db.owner)).map((r) => r.id));
  for (const l of lines) if (!ingIds.has(l.ingredient_id)) throw new ApiError(404, 'not_found', { entity: 'ingredient' });
  stmts.push(...db.bulkInsert('purchase_formats', ['id', 'ingredient_id', 'supplier_id', 'label', 'pack_quantity_base', 'whole_packs_only', 'is_active'], fmtRows));
  // createPurchase valida formatos contra la BD; los nuevos aún no existen → se validan aquí y se omite su comprobación
  const newFormatIds = new Set(fmtRows.map((f) => String(f.id)));
  const existingLines = lines.map((l) => ({ ...l, format_id: l.format_id && newFormatIds.has(l.format_id) ? null : l.format_id }));
  const { pid, stmts: pStmts } = await createPurchase(db, {
    supplier_id: d.supplier_id ?? null, event_id: null, external_reference: d.doc_reference ?? null, purchase_date: d.doc_date, status: 'ordered', notes: `Documento ${String(doc.filename_original)}`,
    update_prices: true, lines: existingLines, allow_duplicate_reference: d.allow_duplicate_reference,
  } as never, { type: 'document', document_id: id });
  stmts.push(...pStmts);
  // precios y vínculo de formato para los formatos recién creados
  const newPriceRows = lines.filter((l) => l.format_id && newFormatIds.has(l.format_id)).map((l) => ({ id: uuid(), format_id: l.format_id, effective_at: d.doc_date, pack_price: l.pack_price, pack_quantity_base: l.pack_quantity_base, source_type: 'document', source_ref_id: pid, note: d.doc_reference ? `Ref. ${d.doc_reference}` : null }));
  stmts.push(...db.bulkInsert('price_history', ['id', 'format_id', 'effective_at', 'pack_price', 'pack_quantity_base', 'source_type', 'source_ref_id', 'note'], newPriceRows));
  if (newPriceRows.length) {
    stmts.push(db.prepare(`UPDATE purchase_lines SET format_id = (SELECT json_extract(value, '$.f') FROM json_each(?1) WHERE json_extract(value, '$.p') = purchase_lines.position)
      WHERE owner_id = ?2 AND purchase_id = ?3 AND position IN (SELECT json_extract(value, '$.p') FROM json_each(?1))`,
      JSON.stringify(lines.map((l, i) => ({ p: i + 1, f: l.format_id })).filter((x) => x.f && newFormatIds.has(x.f))), db.owner, pid));
  }
  if (d.receive_stock) {
    const movRows = lines.map((l, i) => ({ id: uuid(), ingredient_id: l.ingredient_id, kind: 'receipt', quantity_base: dec(l.ordered_packs).times(dec(l.pack_quantity_base)).toFixed(), idempotency_key: `doc:${id}:${i + 1}`, occurred_at: d.doc_date, notes: 'Recepción por documento' }));
    stmts.push(...db.bulkInsert('stock_movements', ['id', 'ingredient_id', 'kind', 'quantity_base', 'idempotency_key', 'occurred_at', 'notes'], movRows));
    stmts.push(db.prepare("UPDATE purchase_lines SET received_packs = ordered_packs WHERE purchase_id = ? AND owner_id = ?", pid, db.owner));
    stmts.push(db.prepare("UPDATE purchases SET status = 'received' WHERE id = ? AND owner_id = ?", pid, db.owner));
  }
  stmts.push(db.prepare("UPDATE documents SET review_status = 'reviewed', purchase_id = ?, supplier_id = ?, doc_date = ?, doc_reference = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? AND owner_id = ?",
    pid, d.supplier_id ?? null, d.doc_date, d.doc_reference ?? null, nowIso(), db.user.email, id, db.owner));
  stmts.push(db.audit('confirm', 'document', id, { purchase_id: pid, lines: lines.length, receive_stock: d.receive_stock }));
  await db.batch(stmts);
  return c.json({ purchase_id: pid, prices_recorded: lines.filter((l) => l.format_id).length, stock_received: d.receive_stock });
});

documents.post('/documents/:id/reject', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const doc = await db.owned('documents', id);
  if (doc.review_status === 'reviewed') throw new ApiError(409, 'already_reviewed');
  await db.batch([db.prepare("UPDATE documents SET review_status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ? AND owner_id = ?", nowIso(), db.user.email, id, db.owner), db.audit('reject', 'document', id)]);
  return c.json({ rejected: true });
});

documents.delete('/documents/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const doc = await db.owned('documents', id);
  if (doc.review_status === 'reviewed') throw new ApiError(409, 'linked_to_purchase');
  await db.batch([
    db.prepare('DELETE FROM blob_chunks WHERE blob_key = ? AND owner_id = ?', String(doc.blob_key), db.owner),
    db.prepare('DELETE FROM documents WHERE id = ? AND owner_id = ?', id, db.owner),
    db.audit('delete', 'document', id),
  ]);
  return c.json({ deleted: true });
});

/** Estado de la IA externa: desactivada por diseño (sin proveedor ni claves configuradas). */
documents.get('/ai/status', (c) => c.json({ enabled: false, provider: 'none', monthly_budget_eur: '0', reason: 'requires_owner_authorization' }));
