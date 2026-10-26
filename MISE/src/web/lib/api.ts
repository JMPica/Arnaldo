/** Cliente HTTP tipado. Cookies de Cloudflare Access same-origin; cabecera CSRF en mutaciones. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (method !== 'GET') headers['x-mise-csrf'] = '1';
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { method, headers, body: payload, credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, 'network_error');
  }
  if (res.status === 401 || res.status === 403) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? 'unauthorized');
  }
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? 'error', (data as { details?: unknown })?.details);
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>('GET', p),
  post: <T = any>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T = any>(p: string, b: unknown) => request<T>('PUT', p, b),
  patch: <T = any>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T = any>(p: string) => request<T>('DELETE', p),
  upload: <T = any>(p: string, f: FormData) => request<T>('POST', p, f),
};

/** Descarga autenticada de un fichero (CSV, JSON, ICS) */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(`/api/v1${path}`, { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status, 'download_failed');
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  saveBlob(blob, name);
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const newKey = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, '');
