import { beforeAll, describe, expect, it, vi } from 'vitest';
import { call, installAccessMock, seedBasic, TEAM } from './helpers';

beforeAll(installAccessMock);

const pdfBytes = (marker: string) => new TextEncoder().encode(`%PDF-1.4\n% ${marker}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`);
const form = (bytes: Uint8Array, name: string, type = 'application/pdf') => { const f = new FormData(); f.append('file', new File([bytes as Uint8Array<ArrayBuffer>], name, { type })); f.append('source_type', 'invoice'); return f; };

describe('Documentos (P1): subida segura, extracción sin efectos, revisión humana, duplicados', () => {
  it('DOC-01 subir PDF/imagen; acceso solo autenticado; tipos falsificados rechazados', async () => {
    const up = await call('/api/v1/documents', { method: 'POST', raw: form(pdfBytes('doc01'), 'factura.pdf') });
    expect(up.status).toBe(201);
    expect(up.data.mime_type).toBe('application/pdf');
    expect((await call(`/api/v1/documents/${up.data.id}/file`, { token: null })).status).toBe(401);
    const f = await call(`/api/v1/documents/${up.data.id}/file`);
    expect(f.status).toBe(200);
    expect(f.headers.get('cache-control')).toContain('no-store');
    expect(f.headers.get('x-content-type-options')).toBe('nosniff');
    // ejecutable renombrado a .pdf
    expect((await call('/api/v1/documents', { method: 'POST', raw: form(new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]), 'factura.pdf') })).data.error).toBe('unsupported_file_type');
    // HTML con extensión de imagen
    expect((await call('/api/v1/documents', { method: 'POST', raw: form(new TextEncoder().encode('<html><script>alert(1)</script>'), 'foto.jpg', 'image/jpeg') })).status).toBe(415);
    // PNG real con extensión .pdf
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect((await call('/api/v1/documents', { method: 'POST', raw: form(png, 'x.pdf') })).data.error).toBe('extension_mismatch');
    expect((await call('/api/v1/documents', { method: 'POST', raw: form(png, 'foto.png', 'image/png') })).status).toBe(201);
    // JPEG mínimo
    expect((await call('/api/v1/documents', { method: 'POST', raw: form(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), 'ticket.JPG', 'image/jpeg') })).status).toBe(201);
    // tamaño excesivo (límite de test 2 MB)
    const big = new Uint8Array(2_100_000); big.set(new TextEncoder().encode('%PDF-1.4'));
    expect((await call('/api/v1/documents', { method: 'POST', raw: form(big, 'grande.pdf') })).status).toBe(413);
    // nombre con ruta y caracteres de control normalizado
    const odd = await call('/api/v1/documents', { method: 'POST', raw: form(pdfBytes('odd'), '../../etc/pa\u0007sswd.pdf') });
    expect((await call(`/api/v1/documents/${odd.data.id}`)).data.filename_original).toBe('passwd.pdf');
    // el blob_key interno no se expone
    expect((await call(`/api/v1/documents/${odd.data.id}`)).data.blob_key).toBeUndefined();
  });

  it('DOC-02/03: la extracción no cambia precios; confirmación humana sí; duplicados detectados', async () => {
    const s = await seedBasic();
    const up = await call('/api/v1/documents', { method: 'POST', raw: form(pdfBytes('doc02'), 'fra-77.pdf') });
    // duplicado por hash
    const dup = await call('/api/v1/documents', { method: 'POST', raw: form(pdfBytes('doc02'), 'otra.pdf') });
    expect(dup.status).toBe(409);
    expect(dup.data.error).toBe('duplicate_document');
    const priceBefore = (await call(`/api/v1/ingredients/${s.cal.id}`)).data.current_price.pack_price;
    const ex = await call(`/api/v1/documents/${up.data.id}/extraction`, { method: 'PUT', body: { method: 'pdf_text', supplier_id: s.sup.id, doc_date: '2026-10-20', doc_reference: 'FV-77', data: { lines: [{ description: 'Calabaza', quantity: '2', unit_price: '9.99' }] } } });
    expect(ex.status).toBe(200);
    expect((await call(`/api/v1/ingredients/${s.cal.id}`)).data.current_price.pack_price).toBe(priceBefore);
    const doc = (await call(`/api/v1/documents/${up.data.id}`)).data;
    expect(doc.review_status).toBe('extracted');
    // confirmación humana con formato existente + uno nuevo y recepción de stock
    const conf = await call(`/api/v1/documents/${up.data.id}/confirm`, { body: { supplier_id: s.sup.id, doc_date: '2026-10-20', doc_reference: 'FV-77', receive_stock: true, lines: [
      { ingredient_id: s.cal.id, format_id: s.f1.id, packs: '2', pack_quantity_base: '1000', pack_price: '3.10', description: 'Calabaza' },
      { ingredient_id: s.nata.id, new_format_label: 'Garrafa 5 L', packs: '1', pack_quantity_base: '5000', pack_price: '18.50', description: 'Nata garrafa' },
    ] } });
    expect(conf.status, JSON.stringify(conf.data)).toBe(200);
    const cal = (await call(`/api/v1/ingredients/${s.cal.id}`)).data;
    expect(cal.current_price.pack_price).toBe('3.1');
    expect(cal.price_history[0].source_type).toBe('document');
    const nata = (await call(`/api/v1/ingredients/${s.nata.id}`)).data;
    expect(nata.formats.some((f: any) => f.label === 'Garrafa 5 L')).toBe(true);
    expect(nata.price_history.some((p: any) => p.pack_price === '18.5' && p.source_type === 'document')).toBe(true);
    const stock = (await call('/api/v1/stock')).data;
    expect(stock.find((r: any) => r.ingredient_id === s.cal.id).on_hand).toBe('2000');
    expect(stock.find((r: any) => r.ingredient_id === s.nata.id).on_hand).toBe('5000');
    const pur = (await call(`/api/v1/purchases/${conf.data.purchase_id}`)).data;
    expect(pur.document_id).toBe(up.data.id);
    expect(pur.status).toBe('received');
    expect(pur.lines.every((l: any) => l.format_id)).toBe(true);
    // re-confirmar el mismo documento → bloqueado (no duplica stock)
    expect((await call(`/api/v1/documents/${up.data.id}/confirm`, { body: { supplier_id: s.sup.id, doc_date: '2026-10-20', doc_reference: 'FV-77', receive_stock: true, lines: [{ ingredient_id: s.cal.id, format_id: s.f1.id, packs: '2', pack_quantity_base: '1000', pack_price: '3.10' }] } })).data.error).toBe('already_reviewed');
    // otro fichero (escaneo distinto) de la misma factura: misma referencia + proveedor → duplicado
    const up2 = await call('/api/v1/documents', { method: 'POST', raw: form(pdfBytes('doc02-scan'), 'fra-77-foto.pdf') });
    const c2 = await call(`/api/v1/documents/${up2.data.id}/confirm`, { body: { supplier_id: s.sup.id, doc_date: '2026-10-20', doc_reference: 'FV-77', receive_stock: true, lines: [{ ingredient_id: s.cal.id, format_id: s.f1.id, packs: '2', pack_quantity_base: '1000', pack_price: '3.10' }] } });
    expect(c2.status).toBe(409);
    expect(c2.data.error).toBe('duplicate_reference');
    expect((await call('/api/v1/stock')).data.find((r: any) => r.ingredient_id === s.cal.id).on_hand).toBe('2000');
    // rechazo y borrado de documentos no revisados
    expect((await call(`/api/v1/documents/${up2.data.id}/reject`, { method: 'POST' })).data.rejected).toBe(true);
    expect((await call(`/api/v1/documents/${up.data.id}`, { method: 'DELETE' })).status).toBe(409);
  });

  it('DOC-04 IA desactivada por defecto y sin llamadas externas facturables', async () => {
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    spy.mockClear();
    const s = await seedBasic();
    const up = await call('/api/v1/documents', { method: 'POST', raw: form(pdfBytes('doc04'), 'f.pdf') });
    await call(`/api/v1/documents/${up.data.id}/extraction`, { method: 'PUT', body: { method: 'ocr_local', data: { lines: [] } } });
    await call(`/api/v1/documents/${up.data.id}/confirm`, { body: { doc_date: '2026-10-21', lines: [{ ingredient_id: s.cal.id, format_id: s.f1.id, packs: '1', pack_quantity_base: '1000', pack_price: '2.5' }] } });
    const ai = await call('/api/v1/ai/status');
    expect(ai.data).toMatchObject({ enabled: false, provider: 'none', monthly_budget_eur: '0' });
    const external = spy.mock.calls.map((c) => String(c[0] instanceof Request ? c[0].url : c[0])).filter((u) => !u.startsWith(TEAM));
    expect(external).toEqual([]);
  });
});
