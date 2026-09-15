import type Database from 'better-sqlite3';

function pacificDate(d: Date = new Date()): string {
  // Returns YYYY-MM-DD in America/Los_Angeles (handles DST automatically)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function yesterdayPacific(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return pacificDate(d);
}

export class DailyRepository {
  constructor(private readonly db: Database.Database) {}

  getPacificDate(): string {
    return pacificDate();
  }

  /** Returns the most recent daily close price for every plant: plantId → price */
  getAllLatestCloses(): Map<string, number> {
    const rows = this.db
      .prepare(
        `SELECT d.plant_id, d.close_price
         FROM daily_plant_prices d
         WHERE d.date = (
           SELECT MAX(d2.date) FROM daily_plant_prices d2 WHERE d2.plant_id = d.plant_id
         )`,
      )
      .all() as Array<{ plant_id: string; close_price: number }>;

    const map = new Map<string, number>();
    for (const row of rows) map.set(row.plant_id, row.close_price);
    return map;
  }

  /** Most recent snapshotted portfolio total for a player (null if none yet) */
  getLatestPortfolioValue(playerId: string): number | null {
    const row = this.db
      .prepare(
        `SELECT total_value FROM daily_portfolio_values
         WHERE player_id = ? ORDER BY date DESC LIMIT 1`,
      )
      .get(playerId) as { total_value: number } | undefined;
    return row?.total_value ?? null;
  }

  /** Wipe a player's snapshotted portfolio-value history (used on account reset). */
  clearPortfolioHistory(playerId: string): void {
    this.db.prepare('DELETE FROM daily_portfolio_values WHERE player_id = ?').run(playerId);
  }

  /** Snapshot plant close prices for a finished trading day (INSERT OR IGNORE) */
  snapshotPlantPrices(
    plants: Array<{ id: string; currentPrice: number }>,
    date: string,
  ): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO daily_plant_prices (plant_id, date, close_price) VALUES (?, ?, ?)',
    );
    this.db.transaction(() => {
      for (const p of plants) stmt.run(p.id, date, p.currentPrice);
    })();
    console.log(`Snapshotted ${plants.length} plant prices for ${date}`);
  }

  /** Snapshot portfolio values for a finished trading day (INSERT OR IGNORE) */
  snapshotPortfolioValues(
    snapshots: Array<{ playerId: string; totalValue: number }>,
    date: string,
  ): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO daily_portfolio_values (player_id, date, total_value) VALUES (?, ?, ?)',
    );
    this.db.transaction(() => {
      for (const s of snapshots) stmt.run(s.playerId, date, s.totalValue);
    })();
  }

  /**
   * On first boot: if a plant has no daily close history, seed yesterday as the baseline.
   * This bootstraps the PREV column so the TUI isn't empty on day 1.
   */
  bootstrapPlantClose(plantId: string, currentPrice: number): void {
    const exists = this.db
      .prepare('SELECT 1 FROM daily_plant_prices WHERE plant_id = ? LIMIT 1')
      .get(plantId);
    if (!exists) {
      this.db
        .prepare(
          'INSERT OR IGNORE INTO daily_plant_prices (plant_id, date, close_price) VALUES (?, ?, ?)',
        )
        .run(plantId, yesterdayPacific(), currentPrice);
    }
  }
}
