import type Database from 'better-sqlite3';
import type { Trade } from '@jasmine-exchange/shared';

interface TradeRow {
  id: string;
  plant_id: string;
  bid_order_id: string;
  ask_order_id: string;
  buyer_id: string;
  seller_id: string;
  price: number;
  seed_count: number;
  executed_at: number;
}

export class TradeRepository {
  constructor(private readonly db: Database.Database) {}

  insert(trade: Trade): void {
    this.db
      .prepare(`
        INSERT INTO trades
          (id, plant_id, bid_order_id, ask_order_id, buyer_id, seller_id, price, seed_count, executed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        trade.id,
        trade.plantId,
        trade.bidOrderId,
        trade.askOrderId,
        trade.buyerId,
        trade.sellerId,
        trade.price,
        trade.seedCount,
        trade.executedAt,
      );
  }

  findByPlant(plantId: string, limit: number, offset: number): Trade[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM trades
        WHERE plant_id = ?
        ORDER BY executed_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(plantId, limit, offset) as TradeRow[];
    return rows.map((r) => this.rowToTrade(r));
  }

  findRecent(limit: number, offset: number): Trade[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM trades
        ORDER BY executed_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(limit, offset) as TradeRow[];
    return rows.map((r) => this.rowToTrade(r));
  }

  /** Drop executed trades older than the retention window. */
  deleteOlderThan(cutoff: number): void {
    this.db.prepare('DELETE FROM trades WHERE executed_at < ?').run(cutoff);
  }

  /**
   * Trades where the player was either side. Deliberately no deleteAllForPlayer() —
   * a trade has a buyer AND a seller, so "this player's trades" aren't theirs alone
   * to discard; force-removing a player never touches this table.
   */
  countByPlayer(playerId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) c FROM trades WHERE buyer_id = ? OR seller_id = ?')
      .get(playerId, playerId) as { c: number };
    return row.c;
  }

  private rowToTrade(row: TradeRow): Trade {
    return {
      id: row.id,
      plantId: row.plant_id,
      bidOrderId: row.bid_order_id,
      askOrderId: row.ask_order_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      price: row.price,
      seedCount: row.seed_count,
      executedAt: row.executed_at,
    };
  }
}
