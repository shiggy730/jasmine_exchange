import type { Migration } from './types.js';
import { hashPassword } from '../../domain/auth.js';

/**
 * Register migrations here, in ascending version order, oldest first.
 * `migrate()` in ../database.ts applies whatever isn't yet in `schema_migrations`,
 * each inside its own transaction, on every server boot — no separate command to run.
 *
 * Additive change (new/renamed column, backfill, data fixup) — plain SQL is enough:
 *
 *   { version: 1, name: 'add-player-avatar-color', up: (db) => {
 *       db.exec(`ALTER TABLE players ADD COLUMN avatar_color TEXT NOT NULL DEFAULT 'gray'`);
 *     } },
 *
 * Non-additive change (column type/constraint, dropping a column, PK change) — SQLite's
 * ALTER TABLE can't do these directly, so rebuild the table: create the new shape under a
 * temp name, copy+transform the data across, drop the old table, rename the new one into
 * place. All inside the same transaction so it's atomic.
 *
 *   { version: 2, name: 'orders-price-integer', up: (db) => {
 *       db.exec(`
 *         CREATE TABLE orders_new (
 *           id           TEXT PRIMARY KEY,
 *           player_id    TEXT NOT NULL REFERENCES players(id),
 *           plant_id     TEXT NOT NULL REFERENCES plants(id),
 *           type         TEXT NOT NULL CHECK(type IN ('bid','ask')),
 *           price        INTEGER NOT NULL,
 *           seed_count   INTEGER NOT NULL,
 *           filled_count INTEGER NOT NULL DEFAULT 0,
 *           status       TEXT NOT NULL DEFAULT 'open'
 *                        CHECK(status IN ('open','partially_filled','filled','cancelled')),
 *           created_at   INTEGER NOT NULL,
 *           updated_at   INTEGER NOT NULL
 *         );
 *         INSERT INTO orders_new SELECT id, player_id, plant_id, type, ROUND(price), seed_count,
 *           filled_count, status, created_at, updated_at FROM orders;
 *         DROP TABLE orders;
 *         ALTER TABLE orders_new RENAME TO orders;
 *         CREATE INDEX idx_orders_matching ON orders(plant_id, status, type, price, created_at);
 *       `);
 *     } },
 *
 * See the "Database & migrations" section in the root README.md for the operator workflow
 * (backup → deploy → restart) and more on when a migration is actually required.
 */
export const migrations: Migration[] = [
  {
    // version 1 was accidentally burned by a throwaway test migration during
    // development (see README's "Database & migrations" section) — never reuse it.
    version: 2,
    name: 'add-player-password-hash',
    up: (db) => {
      db.exec(`ALTER TABLE players ADD COLUMN password_hash TEXT`);
      db.prepare(`UPDATE players SET password_hash = ? WHERE is_bot = 0`).run(
        hashPassword('test1234'),
      );
    },
  },
];
