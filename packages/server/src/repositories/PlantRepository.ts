import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Plant, PricePoint } from '@jasmine-exchange/shared';
import { INITIAL_PLANTS } from '@jasmine-exchange/shared';
import { config } from '../config.js';

interface PlantRow {
  id: string;
  name: string;
  ticker: string;
  current_price: number;
  total_supply: number;
  best_bid: number | null;
  best_ask: number | null;
}

interface PriceHistoryRow {
  price: number;
  recorded_at: number;
}

export class PlantRepository {
  constructor(private readonly db: Database.Database) {}

  seedPlants(): void {
    const insertPlant = this.db.prepare(
      'INSERT OR IGNORE INTO plants (id, name, ticker, current_price, total_supply) VALUES (?, ?, ?, ?, ?)',
    );
    const insertHistory = this.db.prepare(
      'INSERT INTO price_history (plant_id, price, recorded_at) VALUES (?, ?, ?)',
    );
    const exists = this.db.prepare('SELECT id FROM plants WHERE ticker = ?');
    const now = Date.now();

    for (const seed of INITIAL_PLANTS) {
      const row = exists.get(seed.ticker) as { id: string } | undefined;
      if (!row) {
        const id = uuidv4();
        insertPlant.run(id, seed.name, seed.ticker, seed.currentPrice, seed.totalSupply);
        insertHistory.run(id, seed.currentPrice, now);
      }
    }
  }

  /** Admin-added plant — mirrors seedPlants()'s insert shape (row + an initial price_history point). */
  create(name: string, ticker: string, currentPrice: number, totalSupply: number): Plant {
    const id = uuidv4();
    const now = Date.now();
    this.db
      .prepare(
        'INSERT INTO plants (id, name, ticker, current_price, total_supply) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, name, ticker, currentPrice, totalSupply);
    this.db
      .prepare('INSERT INTO price_history (plant_id, price, recorded_at) VALUES (?, ?, ?)')
      .run(id, currentPrice, now);
    return {
      id,
      name,
      ticker,
      currentPrice,
      prevDayClose: null,
      totalSupply,
      bestBid: null,
      bestAsk: null,
      priceHistory: [{ price: currentPrice, timestamp: now }],
    };
  }

  getAll(): Plant[] {
    const rows = this.db.prepare(`
      SELECT
        p.id, p.name, p.ticker, p.current_price, p.total_supply,
        (SELECT MAX(o.price) FROM orders o
         WHERE o.plant_id = p.id AND o.type = 'bid' AND o.status IN ('open','partially_filled')) AS best_bid,
        (SELECT MIN(o.price) FROM orders o
         WHERE o.plant_id = p.id AND o.type = 'ask' AND o.status IN ('open','partially_filled')) AS best_ask
      FROM plants p
    `).all() as PlantRow[];

    return rows.map((r) => this.rowToPlant(r));
  }

  getById(id: string): Plant | null {
    const row = this.db.prepare(`
      SELECT
        p.id, p.name, p.ticker, p.current_price, p.total_supply,
        (SELECT MAX(o.price) FROM orders o
         WHERE o.plant_id = p.id AND o.type = 'bid' AND o.status IN ('open','partially_filled')) AS best_bid,
        (SELECT MIN(o.price) FROM orders o
         WHERE o.plant_id = p.id AND o.type = 'ask' AND o.status IN ('open','partially_filled')) AS best_ask
      FROM plants p
      WHERE p.id = ?
    `).get(id) as PlantRow | undefined;

    return row ? this.rowToPlant(row) : null;
  }

  getCurrentPrice(id: string): number | null {
    const row = this.db.prepare('SELECT current_price FROM plants WHERE id = ?').get(id) as
      | { current_price: number }
      | undefined;
    return row?.current_price ?? null;
  }

  updatePrice(plantId: string, price: number, now: number): void {
    this.db.prepare('UPDATE plants SET current_price = ? WHERE id = ?').run(price, plantId);
    this.db.prepare(
      'INSERT INTO price_history (plant_id, price, recorded_at) VALUES (?, ?, ?)',
    ).run(plantId, price, now);
  }

  /** Drop per-trade price ticks older than the retention window (daily close snapshots are separate and unbounded). */
  pruneHistoryOlderThan(cutoff: number): void {
    this.db.prepare('DELETE FROM price_history WHERE recorded_at < ?').run(cutoff);
  }

  private rowToPlant(row: PlantRow): Plant {
    const historyRows = this.db.prepare(`
      SELECT price, recorded_at FROM price_history
      WHERE plant_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `).all(row.id, config.priceHistoryCap) as PriceHistoryRow[];

    const priceHistory: PricePoint[] = historyRows
      .reverse()
      .map((h) => ({ price: h.price, timestamp: h.recorded_at }));

    return {
      id: row.id,
      name: row.name,
      ticker: row.ticker,
      currentPrice: row.current_price,
      prevDayClose: null, // enriched by route handler via DailyRepository
      totalSupply: row.total_supply,
      bestBid: row.best_bid,
      bestAsk: row.best_ask,
      priceHistory,
    };
  }
}
