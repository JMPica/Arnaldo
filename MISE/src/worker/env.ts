export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** 'access' (producción/staging) o 'dev' (solo loopback local). Sin valor → la app se niega a servir. */
  AUTH_MODE?: string;
  /** p.ej. https://miequipo.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag de la aplicación Access */
  ACCESS_AUD?: string;
  /** Lista separada por comas de emails autorizados (allowlist del propietario) */
  OWNER_EMAILS?: string;
  /** Solo AUTH_MODE=dev: identidad simulada para desarrollo en localhost */
  DEV_USER_EMAIL?: string;
  APP_ENV?: string;
  /** Solo AUTH_MODE=local: secreto HMAC (≥32 caracteres) generado por el lanzador en datos-locales/ */
  LOCAL_SECRET?: string;
  /** Solo AUTH_MODE=local: URLs de la red local (wifi) para los códigos QR, separadas por comas */
  LOCAL_LAN_URLS?: string;
  /** Límite de subida de documentos en bytes (por defecto 10 MB) */
  MAX_UPLOAD_BYTES?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  owner_id: string;
  role: 'owner' | 'collaborator';
}

export type AppEnv = { Bindings: Env; Variables: { user: AuthUser; deviceId?: string } };
