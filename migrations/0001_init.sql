-- Esquema de APEX (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bars (
  tf TEXT NOT NULL,
  ts INTEGER NOT NULL,
  open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL, volume REAL NOT NULL,
  PRIMARY KEY (tf, ts)
);

-- Órdenes: el id es el identificador de cliente determinista → impide duplicados.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,          -- entry | exit
  side TEXT NOT NULL,          -- long | short (de la posición)
  qty REAL NOT NULL,
  price REAL NOT NULL,
  fee REAL NOT NULL,
  status TEXT NOT NULL,        -- filled | rejected | cancelled
  reason TEXT NOT NULL,
  mode TEXT NOT NULL,          -- paper | live
  exchange_order_id TEXT
);
CREATE INDEX IF NOT EXISTS orders_ts ON orders(ts);

CREATE TABLE IF NOT EXISTS trades (
  trade_id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  side TEXT NOT NULL,
  qty REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  entry_ts INTEGER NOT NULL,
  exit_ts INTEGER NOT NULL,
  gross REAL NOT NULL,
  fees REAL NOT NULL,
  funding REAL NOT NULL,
  net REAL NOT NULL,
  r_multiple REAL NOT NULL,
  return_on_equity REAL NOT NULL,
  entry_reason TEXT NOT NULL,
  exit_reason TEXT NOT NULL,
  mode TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trades_exit ON trades(exit_ts);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  strategy_id TEXT NOT NULL,
  action TEXT NOT NULL,
  acted INTEGER NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  features TEXT
);
CREATE INDEX IF NOT EXISTS decisions_ts ON decisions(ts);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL,         -- info | warn | error | audit
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);

CREATE TABLE IF NOT EXISTS equity (
  ts INTEGER PRIMARY KEY,      -- hora
  equity REAL NOT NULL,
  cash REAL NOT NULL,
  price REAL NOT NULL,
  position TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  month TEXT PRIMARY KEY,      -- AAAA-MM
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  params TEXT NOT NULL,
  status TEXT NOT NULL,        -- candidate | approved | rejected | active | retired
  oos_sharpe REAL,
  metrics TEXT,
  gates TEXT,
  created_at INTEGER NOT NULL,
  activated_at INTEGER,
  retired_at INTEGER
);

CREATE TABLE IF NOT EXISTS learning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,          -- research | promotion | drift | note
  summary TEXT NOT NULL,
  data TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,         -- SHA-256 del token
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  ua TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts(ip, ts);
