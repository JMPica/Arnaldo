import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ALLERGENS, ALLERGEN_LABELS, type Allergen } from '../../shared/allergens';
import { ApiError } from '../lib/api';
import { useI18n } from '../lib/i18n';

// ───────────── Mensajes de error comprensibles ─────────────
export function useErrorText() {
  const { t } = useI18n();
  return (e: unknown): string => {
    if (!(e instanceof ApiError)) return t('Error inesperado. Inténtalo de nuevo.');
    const m: Record<string, string> = {
      network_error: t('Sin conexión con el servidor. Revisa la red y vuelve a intentarlo.'),
      unauthenticated: t('Sesión no válida o caducada. Recarga la página para volver a iniciar sesión.'),
      invalid_token: t('Sesión no válida o caducada. Recarga la página para volver a iniciar sesión.'),
      forbidden: t('Tu cuenta no está autorizada para usar MISE.'),
      validation_error: t('Revisa los campos marcados.'),
      not_found: t('No se ha encontrado el elemento.'),
      archived: t('El elemento está archivado.'),
      recipe_cycle: t('Esa subreceta crearía un ciclo (una receta no puede contenerse a sí misma).'),
      incompatible_units: t('Unidades incompatibles: no se convierte entre peso y volumen.'),
      subrecipe_without_yield: t('La subreceta no tiene rendimiento medido: usa raciones o indica su rendimiento.'),
      negative_stock: t('Stock insuficiente: el movimiento dejaría existencias negativas.'),
      duplicate_reference: t('Ya existe una compra con esa referencia y proveedor.'),
      duplicate_document: t('Este documento ya se había subido.'),
      menu_allergens_not_reviewed: t('Revisa y aprueba los alérgenos del menú antes de generar la propuesta.'),
      recipes_pending_allergen_review: t('Hay recetas del menú con alérgenos pendientes de revisión.'),
      subrecipes_not_reviewed: t('Revisa primero los alérgenos de las subrecetas.'),
      confirm_requirements: t('Faltan datos para confirmar el evento.'),
      actual_costs_required: t('Registra los costes reales antes de cerrar el evento.'),
      groups_exceed_guests: t('Los grupos dietéticos superan el total de comensales.'),
      event_closed: t('El evento está cerrado y no se puede modificar.'),
      invalid_transition: t('Esa acción no está disponible en el estado actual.'),
      menu_required: t('Asigna un menú al evento.'),
      food_estimated_from_menu: t('El coste previsto de comida se calcula desde el menú.'),
      unsupported_file_type: t('Tipo de archivo no admitido. Usa PDF, JPG, PNG, WEBP o HEIC.'),
      extension_mismatch: t('La extensión no coincide con el contenido del archivo.'),
      file_too_large: t('El archivo supera el tamaño máximo (10 MB).'),
      payload_too_large: t('El contenido es demasiado grande.'),
      over_receipt: t('No puedes recibir más envases de los pedidos.'),
      already_imported: t('Esta copia ya se importó. Confirma la fusión para continuar.'),
      already_reviewed: t('Este documento ya fue revisado.'),
      base_unit_locked: t('No se puede cambiar la unidad base de un ingrediente en uso.'),
      explicit_confirmation_required: t('Se requiere confirmación explícita.'),
      csrf_header_required: t('Petición bloqueada por seguridad. Recarga la página.'),
      auth_not_configured: t('El acceso privado no está configurado en el servidor.'),
      internal_error: t('Error del servidor. Inténtalo de nuevo.'),
      invalid_decimal: t('Número no válido.'),
    };
    return m[e.code] ?? `${t('Error')}: ${e.code}`;
  };
}

export function fieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiError && e.code === 'validation_error' && Array.isArray(e.details)) {
    return Object.fromEntries((e.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
  }
  return {};
}

// ───────────── Toasts ─────────────
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'error') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'error' } | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ msg, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ───────────── Hoja/diálogo modal ─────────────
export function Sheet({ title, sub, onClose, children, footer, wide }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>
          <button className="icon-btn" style={{ color: 'var(--ink-2)' }} onClick={onClose} aria-label={t('Cerrar')}>×</button>
        </div>
        {children}
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmación para operaciones destructivas. */
export function useConfirm() {
  const [state, setState] = useState<{ msg: string; resolve: (v: boolean) => void; danger?: boolean } | null>(null);
  const { t } = useI18n();
  const ask = (msg: string, danger = true) => new Promise<boolean>((resolve) => setState({ msg, resolve, danger }));
  const node = state ? (
    <Sheet title={t('Confirmar')} onClose={() => { state.resolve(false); setState(null); }}
      footer={<>
        <button className="btn light" onClick={() => { state.resolve(false); setState(null); }}>{t('Cancelar')}</button>
        <button className={`btn ${state.danger ? 'danger' : ''}`} onClick={() => { state.resolve(true); setState(null); }}>{t('Confirmar')}</button>
      </>}>
      <p>{state.msg}</p>
    </Sheet>
  ) : null;
  return { ask, node };
}

// ───────────── Campos ─────────────
export function Field({ label, error, hint, children, span2, htmlFor }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; span2?: boolean; htmlFor?: string }) {
  return (
    <div className={`field ${span2 ? 'span2' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}

type InputProps = { label: string; value: string | number | null | undefined; onChange: (v: string) => void; error?: string; hint?: ReactNode; span2?: boolean; required?: boolean; placeholder?: string; type?: string; maxLength?: number; name?: string };
export function TextField({ label, value, onChange, error, hint, span2, required, placeholder, type = 'text', maxLength, name }: InputProps) {
  const id = useId();
  return (
    <Field label={label + (required ? ' *' : '')} error={error} hint={hint} span2={span2} htmlFor={id}>
      <input id={id} name={name} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error} />
    </Field>
  );
}
/** Numérico con teclado decimal en iPhone; admite coma decimal. */
export function NumField({ label, value, onChange, error, hint, span2, required, placeholder, integer, name }: InputProps & { integer?: boolean }) {
  const id = useId();
  return (
    <Field label={label + (required ? ' *' : '')} error={error} hint={hint} span2={span2} htmlFor={id}>
      <input id={id} name={name} type="text" inputMode={integer ? 'numeric' : 'decimal'} pattern={integer ? '[0-9]*' : undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ''))} required={required} placeholder={placeholder} aria-invalid={!!error} autoComplete="off" />
    </Field>
  );
}
export function SelectField({ label, value, onChange, options, error, hint, span2, required, name }: { label: string; value: string | null | undefined; onChange: (v: string) => void; options: [string, string][]; error?: string; hint?: ReactNode; span2?: boolean; required?: boolean; name?: string }) {
  const id = useId();
  return (
    <Field label={label + (required ? ' *' : '')} error={error} hint={hint} span2={span2} htmlFor={id}>
      <select id={id} name={name} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
}
export function TextArea({ label, value, onChange, error, span2 = true, rows, name }: { label: string; value: string | null | undefined; onChange: (v: string) => void; error?: string; span2?: boolean; rows?: number; name?: string }) {
  const id = useId();
  return (
    <Field label={label} error={error} span2={span2} htmlFor={id}>
      <textarea id={id} name={name} value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows} />
    </Field>
  );
}

// ───────────── Presentación ─────────────
export function PageHead({ kicker, title, sub, actions, back }: { kicker?: string; title: string; sub?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <>
      {back && <Link className="back no-print" to={back.to}>← {back.label}</Link>}
      <div className="page-head">
        <div>{kicker && <div className="kicker">{kicker}</div>}<h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
        {actions && <div className="actions no-print">{actions}</div>}
      </div>
    </>
  );
}

export function Empty({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return <div className="empty"><div className="big">✦</div><strong>{title}</strong>{desc && <div className="muted2">{desc}</div>}{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}

export function Loading() {
  const { t } = useI18n();
  return <div aria-busy="true" aria-label={t('Cargando')}><div className="skeleton" /><div className="skeleton" style={{ width: '70%' }} /><div className="skeleton" style={{ width: '85%' }} /></div>;
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const text = useErrorText();
  const { t } = useI18n();
  return <div className="notice danger" role="alert">{text(error)} {retry && <button className="link-btn" onClick={retry}>{t('Reintentar')}</button>}</div>;
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const labels: Record<string, string> = { draft: t('Borrador'), quoted: t('Presupuestado'), confirmed: t('Confirmado'), completed: t('Realizado'), cancelled: t('Cancelado'),
    ordered: t('Pedido'), partial: t('Parcial'), received: t('Recibido'), pending: t('Pendiente'), extracted: t('Extraído'), reviewed: t('Revisado'), rejected: t('Rechazado') };
  const cls: Record<string, string> = { ordered: 'quoted', partial: 'warn', received: 'ok', pending: 'draft', extracted: 'quoted', reviewed: 'ok', rejected: 'danger' };
  return <span className={`pill ${cls[status] ?? status}`}>{labels[status] ?? status}</span>;
}

export function ReviewPill({ state }: { state: string }) {
  const { t } = useI18n();
  if (state === 'reviewed') return <span className="pill ok">✓ {t('Alérgenos revisados')}</span>;
  if (state === 'stale') return <span className="pill warn">{t('Revisión de alérgenos obsoleta')}</span>;
  if (state === 'no_menu') return <span className="pill draft">{t('Sin menú')}</span>;
  return <span className="pill warn">{t('Alérgenos pendientes de revisión')}</span>;
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return <div className="seg" role="group" aria-label={label}>{options.map(([v, l]) => <button key={v} type="button" className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: [T, string][] }) {
  return <div className="tabs" role="tablist">{tabs.map(([v, l]) => <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export function AllergenPicker({ value, onChange, readOnly, derived = [] }: { value: Allergen[]; onChange?: (v: Allergen[]) => void; readOnly?: boolean; derived?: Allergen[] }) {
  const { lang } = useI18n();
  return (
    <div className="allergens">
      {ALLERGENS.map((a) => {
        const on = value.includes(a) || derived.includes(a);
        const locked = readOnly || derived.includes(a);
        return (
          <button key={a} type="button" className={`allergen ${on ? 'on' : ''}`} aria-pressed={on} disabled={locked && readOnly}
            onClick={() => { if (locked || !onChange) return; onChange(on ? value.filter((x) => x !== a) : [...value, a]); }}>
            {ALLERGEN_LABELS[lang][a]}{derived.includes(a) ? ' •' : ''}
          </button>
        );
      })}
    </div>
  );
}

export function AllergenList({ list }: { list: string[] }) {
  const { lang, t } = useI18n();
  if (!list.length) return <span className="muted">{t('Sin alérgenos declarados')}</span>;
  return <span>{list.map((a) => ALLERGEN_LABELS[lang][a as Allergen] ?? a).join(', ')}</span>;
}
