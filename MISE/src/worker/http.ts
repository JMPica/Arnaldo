import type { Context } from 'hono';
import type { z } from 'zod';
import { DomainError } from '../shared/decimal';

export class ApiError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500, public code: string, public details?: unknown) {
    super(code);
  }
}

export const notFound = () => new ApiError(404, 'not_found');

export async function readJson(c: Context, maxBytes = 1_000_000): Promise<unknown> {
  const ct = c.req.header('content-type') ?? '';
  if (!ct.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'json_required');
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > maxBytes) throw new ApiError(413, 'payload_too_large');
  const text = await c.req.text();
  if (text.length > maxBytes) throw new ApiError(413, 'payload_too_large');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'malformed_json');
  }
}

export async function body<S extends z.ZodType>(c: Context, schema: S, maxBytes?: number): Promise<z.output<S>> {
  const raw = await readJson(c, maxBytes);
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new ApiError(422, 'validation_error', r.error.issues.slice(0, 30).map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return r.data;
}

export function errorResponse(err: unknown): Response {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (err instanceof ApiError) return new Response(JSON.stringify({ error: err.code, details: err.details ?? null }), { status: err.status, headers });
  if (err instanceof DomainError) return new Response(JSON.stringify({ error: err.code, message: err.message, details: err.details ?? null }), { status: 422, headers });
  const msg = err instanceof Error ? err.message : String(err);
  if (/owner_mismatch/.test(msg)) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers });
  if (/immutable_/.test(msg)) return new Response(JSON.stringify({ error: 'immutable' }), { status: 409, headers });
  if (/UNIQUE constraint failed/.test(msg)) return new Response(JSON.stringify({ error: 'duplicate' }), { status: 409, headers });
  if (/FOREIGN KEY constraint failed/.test(msg)) return new Response(JSON.stringify({ error: 'invalid_reference' }), { status: 422, headers });
  // No se filtran detalles internos ni datos personales en la respuesta; el log no incluye cuerpos de petición.
  console.error('unhandled_error', err instanceof Error ? err.name + ': ' + err.message.slice(0, 300) : 'unknown');
  return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers });
}
