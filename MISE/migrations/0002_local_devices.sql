-- MISE · migración 0002 · modo local: dispositivos emparejados (iPhone, otros ordenadores) y tokens de emparejamiento de un solo uso.
-- No contiene datos de negocio; solo se usa con AUTH_MODE=local. Inofensiva en Cloudflare.
CREATE TABLE paired_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE TABLE pairing_tokens_used (
  jti TEXT PRIMARY KEY,
  device_id TEXT,
  used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
