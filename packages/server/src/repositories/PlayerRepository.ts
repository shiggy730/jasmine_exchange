import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Player } from '@jasmine-exchange/shared';

interface PlayerRow {
  id: string;
  name: string;
  gold_balance: number;
  is_bot: number;
  password_hash: string | null;
}

interface PortfolioRow {
  plant_id: string;
  seed_count: number;
}

export class PlayerRepository {
  constructor(private readonly db: Database.Database) {}

  create(name: string, goldBalance: number, passwordHash: string | null, isBot = 0): Player {
    const id = uuidv4();
    this.db
      .prepare(
        'INSERT INTO players (id, name, gold_balance, password_hash, is_bot) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, name, goldBalance, passwordHash, isBot);
    return { id, name, goldBalance, portfolio: {}, prevDayPortfolioValue: null };
  }

  findById(id: string): Player | null {
    const row = this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as
      | PlayerRow
      | undefined;
    return row ? this.rowToPlayer(row) : null;
  }

  findByName(name: string): Player | null {
    const row = this.db.prepare('SELECT * FROM players WHERE name = ?').get(name) as
      | PlayerRow
      | undefined;
    return row ? this.rowToPlayer(row) : null;
  }

  /** Raw id + password hash for auth purposes — never routed through rowToPlayer/Player. */
  findAuthByName(name: string): { id: string; passwordHash: string | null } | null {
    const row = this.db
      .prepare('SELECT id, password_hash FROM players WHERE name = ?')
      .get(name) as { id: string; password_hash: string | null } | undefined;
    return row ? { id: row.id, passwordHash: row.password_hash } : null;
  }

  /** Apply a gold delta (positive = credit, negative = debit). */
  updateGold(playerId: string, delta: number): void {
    this.db
      .prepare('UPDATE players SET gold_balance = gold_balance + ? WHERE id = ?')
      .run(delta, playerId);
  }

  /** Reset a player to a fresh starting state: gold balance set, portfolio wiped. */
  reset(playerId: string, startingGold: number): void {
    this.db.transaction(() => {
      this.db.prepare('UPDATE players SET gold_balance = ? WHERE id = ?').run(startingGold, playerId);
      this.db.prepare('DELETE FROM portfolio WHERE player_id = ?').run(playerId);
    })();
  }

  getSeedCount(playerId: string, plantId: string): number {
    const row = this.db
      .prepare('SELECT seed_count FROM portfolio WHERE player_id = ? AND plant_id = ?')
      .get(playerId, plantId) as { seed_count: number } | undefined;
    return row?.seed_count ?? 0;
  }

  /** Apply a seed delta (positive = add, negative = deduct). */
  updatePortfolio(playerId: string, plantId: string, delta: number): void {
    this.db
      .prepare(`
        INSERT INTO portfolio (player_id, plant_id, seed_count) VALUES (?, ?, ?)
        ON CONFLICT(player_id, plant_id) DO UPDATE SET seed_count = seed_count + ?
      `)
      .run(playerId, plantId, delta, delta);
  }

  /** Set an absolute seed count (used for bot initialisation). */
  setPortfolio(playerId: string, plantId: string, seedCount: number): void {
    this.db
      .prepare(`
        INSERT INTO portfolio (player_id, plant_id, seed_count) VALUES (?, ?, ?)
        ON CONFLICT(player_id, plant_id) DO UPDATE SET seed_count = ?
      `)
      .run(playerId, plantId, seedCount, seedCount);
  }

  getAllNonBot(): Player[] {
    const rows = this.db
      .prepare('SELECT * FROM players WHERE is_bot = 0')
      .all() as PlayerRow[];
    return rows.map((r) => this.rowToPlayer(r));
  }

  /** Every player, bots included — for admin browsing. */
  getAll(): Player[] {
    const rows = this.db.prepare('SELECT * FROM players').all() as PlayerRow[];
    return rows.map((r) => this.rowToPlayer(r));
  }

  /** Admin password reset — bypasses login, sets the hash directly. */
  setPasswordHash(playerId: string, passwordHash: string): void {
    this.db.prepare('UPDATE players SET password_hash = ? WHERE id = ?').run(passwordHash, playerId);
  }

  /** Wipe portfolio holdings without touching gold — used before a hard delete. */
  clearPortfolio(playerId: string): void {
    this.db.prepare('DELETE FROM portfolio WHERE player_id = ?').run(playerId);
  }

  /**
   * Hard delete. Throws (SqliteError, SQLITE_CONSTRAINT_* code) if the player has any
   * orders/trades on record — by design, there's no cascade here. Callers should clear
   * sessions/portfolio first (pure current-state, safe to wipe) and let this throw for
   * anyone with real trade history rather than silently destroying it.
   */
  delete(playerId: string): void {
    this.db.prepare('DELETE FROM players WHERE id = ?').run(playerId);
  }

  private rowToPlayer(row: PlayerRow): Player {
    const portfolioRows = this.db
      .prepare('SELECT plant_id, seed_count FROM portfolio WHERE player_id = ? AND seed_count > 0')
      .all(row.id) as PortfolioRow[];

    const portfolio: Record<string, number> = {};
    for (const p of portfolioRows) {
      portfolio[p.plant_id] = p.seed_count;
    }

    return {
      id: row.id,
      name: row.name,
      goldBalance: row.gold_balance,
      portfolio,
      prevDayPortfolioValue: null, // enriched by route handler via DailyRepository
    };
  }
}
