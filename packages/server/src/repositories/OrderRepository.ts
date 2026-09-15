import type Database from 'better-sqlite3';
import type { Order, OrderStatus } from '@jasmine-exchange/shared';

interface OrderRow {
  id: string;
  player_id: string;
  plant_id: string;
  type: 'bid' | 'ask';
  price: number;
  seed_count: number;
  filled_count: number;
  status: OrderStatus;
  created_at: number;
  updated_at: number;
}

export class OrderRepository {
  constructor(private readonly db: Database.Database) {}

  insert(order: Order): void {
    this.db
      .prepare(`
        INSERT INTO orders
          (id, player_id, plant_id, type, price, seed_count, filled_count, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        order.id,
        order.playerId,
        order.plantId,
        order.type,
        order.price,
        order.seedCount,
        order.filledCount,
        order.status,
        order.createdAt,
        order.updatedAt,
      );
  }

  findById(id: string): Order | null {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
      | OrderRow
      | undefined;
    return row ? this.rowToOrder(row) : null;
  }

  /** Open asks at price ≤ maxPrice — price-time priority (cheap first, then earliest). */
  findMatchingAsks(plantId: string, maxPrice: number): Order[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM orders
        WHERE plant_id = ? AND type = 'ask' AND status IN ('open','partially_filled') AND price <= ?
        ORDER BY price ASC, created_at ASC
      `)
      .all(plantId, maxPrice) as OrderRow[];
    return rows.map((r) => this.rowToOrder(r));
  }

  /** Open bids at price ≥ minPrice — price-time priority (expensive first, then earliest). */
  findMatchingBids(plantId: string, minPrice: number): Order[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM orders
        WHERE plant_id = ? AND type = 'bid' AND status IN ('open','partially_filled') AND price >= ?
        ORDER BY price DESC, created_at ASC
      `)
      .all(plantId, minPrice) as OrderRow[];
    return rows.map((r) => this.rowToOrder(r));
  }

  updateOrder(orderId: string, filledCount: number, status: OrderStatus, updatedAt: number): void {
    this.db
      .prepare('UPDATE orders SET filled_count = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(filledCount, status, updatedAt, orderId);
  }

  cancelOrder(orderId: string, updatedAt: number): void {
    this.db
      .prepare(`
        UPDATE orders SET status = 'cancelled', updated_at = ?
        WHERE id = ? AND status IN ('open','partially_filled')
      `)
      .run(updatedAt, orderId);
  }

  findOpenByPlayer(playerId: string): Order[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM orders
        WHERE player_id = ? AND status IN ('open','partially_filled')
        ORDER BY created_at DESC
      `)
      .all(playerId) as OrderRow[];
    return rows.map((r) => this.rowToOrder(r));
  }

  cancelAllOpenByPlayerAndPlant(playerId: string, plantId: string, updatedAt: number): void {
    this.db
      .prepare(`
        UPDATE orders SET status = 'cancelled', updated_at = ?
        WHERE player_id = ? AND plant_id = ? AND status IN ('open','partially_filled')
      `)
      .run(updatedAt, playerId, plantId);
  }

  cancelAllOpenByPlayer(playerId: string, updatedAt: number): void {
    this.db
      .prepare(`
        UPDATE orders SET status = 'cancelled', updated_at = ?
        WHERE player_id = ? AND status IN ('open','partially_filled')
      `)
      .run(updatedAt, playerId);
  }

  /** All orders (any status) for a player — used to size up a force-remove, not just open ones. */
  countByPlayer(playerId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) c FROM orders WHERE player_id = ?').get(playerId) as { c: number };
    return row.c;
  }

  /**
   * Hard delete every order row for a player, any status. Safe to force — an order
   * has exactly one owner, unlike a trade (which has a buyer AND a seller), so this
   * can never remove data that belongs to someone else.
   */
  deleteAllForPlayer(playerId: string): void {
    this.db.prepare('DELETE FROM orders WHERE player_id = ?').run(playerId);
  }

  private rowToOrder(row: OrderRow): Order {
    return {
      id: row.id,
      playerId: row.player_id,
      plantId: row.plant_id,
      type: row.type,
      price: row.price,
      seedCount: row.seed_count,
      filledCount: row.filled_count,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
