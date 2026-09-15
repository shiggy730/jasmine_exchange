import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { PlayerRepository } from '@jasmine-exchange/server/repositories/PlayerRepository';
import { PlantRepository } from '@jasmine-exchange/server/repositories/PlantRepository';
import { SessionRepository } from '@jasmine-exchange/server/repositories/SessionRepository';
import { DailyRepository } from '@jasmine-exchange/server/repositories/DailyRepository';
import { OrderRepository } from '@jasmine-exchange/server/repositories/OrderRepository';
import { TradeRepository } from '@jasmine-exchange/server/repositories/TradeRepository';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'server', 'jasmine.db');

export const db: Database.Database = new Database(process.env['DB_PATH'] ?? DEFAULT_DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// This tool never runs migrations — that's the server's job. If the schema is
// missing something expected, fail loudly rather than silently operating on a
// stale/partial schema.
function assertColumn(table: string, column: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    throw new Error(
      `${table}.${column} not found — has the server been started at least once against this DB file?`,
    );
  }
}
assertColumn('players', 'password_hash');

export const playerRepo = new PlayerRepository(db);
export const plantRepo = new PlantRepository(db);
export const sessionRepo = new SessionRepository(db);
export const dailyRepo = new DailyRepository(db);
export const orderRepo = new OrderRepository(db);
export const tradeRepo = new TradeRepository(db);
