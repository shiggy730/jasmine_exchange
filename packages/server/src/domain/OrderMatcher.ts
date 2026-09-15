import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { PlaceOrderRequest, Order, OrderResult, OrderStatus, Trade } from '@jasmine-exchange/shared';
import type { PlantRepository } from '../repositories/PlantRepository.js';
import type { PlayerRepository } from '../repositories/PlayerRepository.js';
import type { OrderRepository } from '../repositories/OrderRepository.js';
import type { TradeRepository } from '../repositories/TradeRepository.js';

export class OrderMatcher {
  constructor(
    private readonly db: Database.Database,
    private readonly plantRepo: PlantRepository,
    private readonly playerRepo: PlayerRepository,
    private readonly orderRepo: OrderRepository,
    private readonly tradeRepo: TradeRepository,
  ) {}

  placeOrder(req: PlaceOrderRequest): OrderResult {
    const fn = this.db.transaction((): OrderResult => {
      const { playerId, plantId, type, price, seedCount } = req;

      if (seedCount <= 0) return { status: 'rejected', reason: 'seedCount must be positive' };
      if (price <= 0) return { status: 'rejected', reason: 'price must be positive' };

      const player = this.playerRepo.findById(playerId);
      if (!player) return { status: 'rejected', reason: 'Player not found' };

      const plant = this.plantRepo.getById(plantId);
      if (!plant) return { status: 'rejected', reason: 'Plant not found' };

      if (type === 'bid') {
        const maxCost = price * seedCount;
        if (player.goldBalance < maxCost) {
          return {
            status: 'rejected',
            reason: `Insufficient gold: need ${maxCost.toFixed(4)}g, have ${player.goldBalance.toFixed(4)}g`,
          };
        }
      } else {
        const held = this.playerRepo.getSeedCount(playerId, plantId);
        if (held < seedCount) {
          return {
            status: 'rejected',
            reason: `Insufficient seeds: need ${seedCount}, have ${held}`,
          };
        }
      }

      const now = Date.now();
      const order: Order = {
        id: uuidv4(),
        playerId,
        plantId,
        type,
        price,
        seedCount,
        filledCount: 0,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };
      this.orderRepo.insert(order);

      const counterparts =
        type === 'bid'
          ? this.orderRepo.findMatchingAsks(plantId, price)
          : this.orderRepo.findMatchingBids(plantId, price);

      const trades: Trade[] = [];
      let remaining = seedCount;

      for (const counterpart of counterparts) {
        if (remaining <= 0) break;

        const counterRemaining = counterpart.seedCount - counterpart.filledCount;
        const tradeQty = Math.min(remaining, counterRemaining);
        const tradePrice = counterpart.price; // execute at resting order's price

        const buyerId = type === 'bid' ? playerId : counterpart.playerId;
        const sellerId = type === 'ask' ? playerId : counterpart.playerId;

        const trade: Trade = {
          id: uuidv4(),
          plantId,
          bidOrderId: type === 'bid' ? order.id : counterpart.id,
          askOrderId: type === 'ask' ? order.id : counterpart.id,
          buyerId,
          sellerId,
          price: tradePrice,
          seedCount: tradeQty,
          executedAt: now,
        };
        this.tradeRepo.insert(trade);
        trades.push(trade);

        // Update counterpart order status
        const newCounterFilled = counterpart.filledCount + tradeQty;
        const counterStatus: OrderStatus =
          newCounterFilled >= counterpart.seedCount ? 'filled' : 'partially_filled';
        this.orderRepo.updateOrder(counterpart.id, newCounterFilled, counterStatus, now);

        // Transfer gold and seeds (integer price × integer qty = exact integer)
        const goldDelta = tradePrice * tradeQty;
        this.playerRepo.updateGold(buyerId, -goldDelta);
        this.playerRepo.updateGold(sellerId, goldDelta);
        this.playerRepo.updatePortfolio(buyerId, plantId, tradeQty);
        this.playerRepo.updatePortfolio(sellerId, plantId, -tradeQty);

        // Record new last traded price
        this.plantRepo.updatePrice(plantId, tradePrice, now);

        remaining -= tradeQty;
      }

      // Update our order's filled state
      const filledCount = seedCount - remaining;
      if (filledCount > 0) {
        const myStatus: OrderStatus = filledCount >= seedCount ? 'filled' : 'partially_filled';
        this.orderRepo.updateOrder(order.id, filledCount, myStatus, now);
        order.filledCount = filledCount;
        order.status = myStatus;
        order.updatedAt = now;
      }

      const updatedPlayer = this.playerRepo.findById(playerId)!;

      const resultStatus =
        filledCount === 0 ? 'placed' : filledCount >= seedCount ? 'filled' : 'partially_filled';

      return { status: resultStatus, order, trades, updatedPlayer };
    });

    return fn();
  }
}
