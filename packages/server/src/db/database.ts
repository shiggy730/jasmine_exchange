import Database from 'better-sqlite3';
import { config } from '../config.js';
import { migrations } from './migrations/index.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(config.dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    // WAL allows concurrent readers but only one writer at a time. Without this, a
    // writer that finds the db locked (e.g. another writer mid-transaction, or a
    // second process like the admin TUI) throws "database is locked" immediately
    // instead of waiting — this is what crashed the server via an unhandled bot error.
    _db.pragma('busy_timeout = 5000');
    migrate(_db);
  }
  return _db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS plants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  ticker        TEXT NOT NULL UNIQUE,
  current_price REAL NOT NULL,
  total_supply  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  gold_balance REAL NOT NULL DEFAULT 500,
  is_bot       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);

CREATE TABLE IF NOT EXISTS portfolio (
  player_id  TEXT NOT NULL REFERENCES players(id),
  plant_id   TEXT NOT NULL REFERENCES plants(id),
  seed_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, plant_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players(id),
  plant_id     TEXT NOT NULL REFERENCES plants(id),
  type         TEXT NOT NULL CHECK(type IN ('bid','ask')),
  price        REAL NOT NULL,
  seed_count   INTEGER NOT NULL,
  filled_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK(status IN ('open','partially_filled','filled','cancelled')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_matching ON orders(plant_id, status, type, price, created_at);

CREATE TABLE IF NOT EXISTS trades (
  id           TEXT PRIMARY KEY,
  plant_id     TEXT NOT NULL REFERENCES plants(id),
  bid_order_id TEXT NOT NULL REFERENCES orders(id),
  ask_order_id TEXT NOT NULL REFERENCES orders(id),
  buyer_id     TEXT NOT NULL REFERENCES players(id),
  seller_id    TEXT NOT NULL REFERENCES players(id),
  price        REAL NOT NULL,
  seed_count   INTEGER NOT NULL,
  executed_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trades_plant ON trades(plant_id, executed_at DESC);
-- Retention pruning (DayRoller) filters by executed_at alone, across all plants — the
-- index above is plant_id-first and useless for that, forcing a full table scan that
-- holds the write lock for the whole scan. This makes it an index range scan instead.
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at);

CREATE TABLE IF NOT EXISTS price_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plant_id    TEXT NOT NULL REFERENCES plants(id),
  price       REAL NOT NULL,
  recorded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_history_plant ON price_history(plant_id, recorded_at DESC);
-- Same reasoning as idx_trades_executed_at above, for pruneHistoryOlderThan()'s
-- WHERE recorded_at < cutoff (no plant_id filter).
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);

CREATE TABLE IF NOT EXISTS daily_plant_prices (
  plant_id    TEXT NOT NULL REFERENCES plants(id),
  date        TEXT NOT NULL,
  close_price INTEGER NOT NULL,
  PRIMARY KEY (plant_id, date)
);

CREATE TABLE IF NOT EXISTS daily_portfolio_values (
  player_id   TEXT NOT NULL REFERENCES players(id),
  date        TEXT NOT NULL,
  total_value INTEGER NOT NULL,
  PRIMARY KEY (player_id, date)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
`;

/**
 * Base SCHEMA above only ever CREATEs — it's a no-op against tables that already exist,
 * so it can't evolve their shape. Actual schema changes to existing tables belong in
 * ./migrations (see that file's header), tracked here via schema_migrations so each one
 * runs exactly once, in order, on whatever boot first sees it.
 */
function migrate(db: Database.Database): void {
  db.exec(SCHEMA);

  const seen = new Set<number>();
  for (const m of migrations) {
    if (seen.has(m.version)) {
      throw new Error(`Duplicate migration version ${m.version} ('${m.name}')`);
    }
    seen.add(m.version);
  }

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );
  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const m of pending) {
    console.log(`Applying migration ${m.version}: ${m.name}`);
    db.transaction(() => {
      m.up(db);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      ).run(m.version, m.name, Date.now());
    })();
  }

  console.log(`DB migrated (${pending.length} migration${pending.length === 1 ? '' : 's'} applied)`);
}
