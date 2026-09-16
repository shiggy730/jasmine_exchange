import type { DailyRepository } from '../repositories/DailyRepository.js';
import type { PlantRepository } from '../repositories/PlantRepository.js';
import type { PlayerRepository } from '../repositories/PlayerRepository.js';
import type { TradeRepository } from '../repositories/TradeRepository.js';
import { config } from '../config.js';

export class DayRoller {
  private lastDate: string;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly dailyRepo: DailyRepository,
    private readonly plantRepo: PlantRepository,
    private readonly playerRepo: PlayerRepository,
    private readonly tradeRepo: TradeRepository,
  ) {
    this.lastDate = dailyRepo.getPacificDate();
  }

  start(): void {
    // Catch up on retention immediately (e.g. after downtime), then daily thereafter.
    // A failure here shouldn't block server startup — log and let the next check retry.
    try {
      this.pruneOldRecords();
    } catch (err) {
      console.error('Initial retention prune failed, will retry on next daily check:', err);
    }
    // Check every 60 s — plenty of resolution for a midnight rollover
    this.timer = setInterval(() => this.check(), 60_000);
    console.log(`DayRoller started — trading day: ${this.lastDate} PT`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private check(): void {
    // Runs on a setInterval with nothing to catch a throw — same reasoning as
    // BotEngine's timers: a transient failure here must not crash the whole server.
    try {
      const today = this.dailyRepo.getPacificDate();
      if (today !== this.lastDate) {
        console.log(`Trading day ended: ${this.lastDate} → ${today}`);
        this.snapshot(this.lastDate);
        this.pruneOldRecords();
        this.lastDate = today;
      }
    } catch (err) {
      console.error('DayRoller check failed, will retry next minute:', err);
    }
  }

  private snapshot(date: string): void {
    const plants = this.plantRepo.getAll();
    this.dailyRepo.snapshotPlantPrices(
      plants.map((p) => ({ id: p.id, currentPrice: p.currentPrice })),
      date,
    );

    const players = this.playerRepo.getAllNonBot();
    const snapshots = players.map((player) => {
      const seedValue = Object.entries(player.portfolio).reduce((sum, [plantId, count]) => {
        const plant = plants.find((p) => p.id === plantId);
        return sum + (plant?.currentPrice ?? 0) * count;
      }, 0);
      return { playerId: player.id, totalValue: Math.round(player.goldBalance + seedValue) };
    });
    if (snapshots.length > 0) {
      this.dailyRepo.snapshotPortfolioValues(snapshots, date);
    }
  }

  /** Drop trades and per-trade price history past the retention window. Daily snapshots are kept forever. */
  private pruneOldRecords(): void {
    const cutoff = Date.now() - config.dataRetentionMs;
    this.tradeRepo.deleteOlderThan(cutoff);
    this.plantRepo.pruneHistoryOlderThan(cutoff);
  }
}
