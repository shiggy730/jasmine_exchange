import type { PlantRepository } from '../repositories/PlantRepository.js';
import type { PlayerRepository } from '../repositories/PlayerRepository.js';
import type { OrderRepository } from '../repositories/OrderRepository.js';
import type { OrderMatcher } from './OrderMatcher.js';
import { BOT_SPREAD } from '../config.js';

const MM_GOLD = 10_000;
const MM_SEEDS = 500;
const NT_GOLD = 500_000;
const NT_SEEDS_EACH = 500;
const MM_QTY = 10;
const MM_INTERVAL_MS = 6_000;
const MM_STAGGER_MS = 750;

export class BotEngine {
  private timers: ReturnType<typeof setInterval>[] = [];
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private readonly plantRepo: PlantRepository,
    private readonly playerRepo: PlayerRepository,
    private readonly orderRepo: OrderRepository,
    private readonly matcher: OrderMatcher,
  ) {}

  start(): void {
    this.initBots();
    this.startMarketMakers();
    this.startNoiseTraders();
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    for (const t of this.timeouts) clearTimeout(t);
    this.timers = [];
    this.timeouts = [];
  }

  private initBots(): void {
    const plants = this.plantRepo.getAll();

    for (const plant of plants) {
      const botName = `MM_${plant.ticker}`;
      if (!this.playerRepo.findByName(botName)) {
        const bot = this.playerRepo.create(botName, MM_GOLD, null, 1);
        this.playerRepo.setPortfolio(bot.id, plant.id, MM_SEEDS);
        console.log(`Created market maker bot: ${botName}`);
      }
    }

    for (let i = 1; i <= 3; i++) {
      const botName = `NT_${i}`;
      let bot = this.playerRepo.findByName(botName);
      if (!bot) {
        bot = this.playerRepo.create(botName, NT_GOLD, null, 1);
        console.log(`Created noise trader bot: ${botName}`);
      } else if (bot.goldBalance < NT_GOLD * 0.1) {
        // Top up gold if depleted below 10% — keeps NTs active across server restarts
        this.playerRepo.updateGold(bot.id, NT_GOLD - bot.goldBalance);
        console.log(`Topped up NT bot gold: ${botName}`);
      }
      // Seed any plant this NT has 0 of — covers newly added plants and depleted holdings
      for (const plant of plants) {
        if (this.playerRepo.getSeedCount(bot.id, plant.id) === 0) {
          this.playerRepo.setPortfolio(bot.id, plant.id, NT_SEEDS_EACH);
        }
      }
    }
  }

  private startMarketMakers(): void {
    const plants = this.plantRepo.getAll();

    plants.forEach((plant, i) => {
      const timeout = setTimeout(() => {
        // This runs on a setInterval with no caller to catch a throw — an unhandled
        // exception here (e.g. transient "database is locked") would crash the whole
        // process, taking down real players' trading too. One bad tick should just
        // log and retry next interval, not bring down the server.
        const runMM = () => {
          try {
            const bot = this.playerRepo.findByName(`MM_${plant.ticker}`);
            if (!bot) return;

            const price = this.plantRepo.getCurrentPrice(plant.id);
            if (price === null) return;

            const spread = BOT_SPREAD[plant.ticker] ?? 0.02;
            // Floor bid, ceil ask — guarantees bid < ask even on low-priced plants
            const bidPrice = Math.max(1, Math.floor(price * (1 - spread)));
            const askPrice = Math.ceil(price * (1 + spread));
            const now = Date.now();

            // Cancel stale orders first, then place fresh ones
            this.orderRepo.cancelAllOpenByPlayerAndPlant(bot.id, plant.id, now);

            this.matcher.placeOrder({
              playerId: bot.id,
              plantId: plant.id,
              type: 'bid',
              price: bidPrice,
              seedCount: MM_QTY,
            });

            this.matcher.placeOrder({
              playerId: bot.id,
              plantId: plant.id,
              type: 'ask',
              price: askPrice,
              seedCount: MM_QTY,
            });

            console.log(`MM ${plant.ticker}: bid=${bidPrice}g ask=${askPrice}g`);
          } catch (err) {
            console.error(`MM ${plant.ticker} tick failed, will retry next interval:`, err);
          }
        };

        runMM();
        const interval = setInterval(runMM, MM_INTERVAL_MS);
        this.timers.push(interval);
      }, i * MM_STAGGER_MS);

      this.timeouts.push(timeout);
    });
  }

  private startNoiseTraders(): void {
    const plants = this.plantRepo.getAll();

    for (let i = 1; i <= 3; i++) {
      const botName = `NT_${i}`;
      const initialDelay = 4_000 + Math.floor(Math.random() * 4_000);

      const schedule = (botId: string) => {
        const delay = 5_000 + Math.floor(Math.random() * 5_000);
        const timeout = setTimeout(() => {
          try {
            const plant = plants[Math.floor(Math.random() * plants.length)]!;
            // Re-fetch plant to get live bestBid/bestAsk
            const current = this.plantRepo.getById(plant.id);
            if (current) {
              const side = Math.random() < 0.5 ? ('bid' as const) : ('ask' as const);
              let orderPrice: number;
              if (side === 'bid') {
                // Aggressive: lift the best ask. If no ask, bid above market.
                orderPrice = current.bestAsk ?? Math.max(1, current.currentPrice + Math.ceil(current.currentPrice * 0.02));
              } else {
                // Aggressive: hit the best bid. If no bid, ask below market.
                orderPrice = current.bestBid ?? Math.max(1, current.currentPrice - Math.ceil(current.currentPrice * 0.02));
              }
              const qty = Math.floor(Math.random() * 5) + 1;
              this.matcher.placeOrder({
                playerId: botId,
                plantId: plant.id,
                type: side,
                price: orderPrice,
                seedCount: qty,
              });
            }
          } catch (err) {
            // Same reasoning as the market-maker tick: never let a transient failure
            // here (e.g. lock contention) crash the whole server.
            console.error(`Noise trader ${botId} tick failed, will retry next tick:`, err);
          }
          schedule(botId);
        }, delay);
        this.timeouts.push(timeout);
      };

      const timeout = setTimeout(() => {
        const bot = this.playerRepo.findByName(botName);
        if (bot) schedule(bot.id);
      }, initialDelay);
      this.timeouts.push(timeout);
    }
  }
}
