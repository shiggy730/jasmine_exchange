import type { FastifyInstance } from 'fastify';
import { plantsRoutes } from './plants.js';
import { playersRoutes } from './players.js';
import { ordersRoutes } from './orders.js';
import { tradesRoutes } from './trades.js';
import { adminRoutes } from './admin.js';
import type { PlantRepository } from '../repositories/PlantRepository.js';
import type { PlayerRepository } from '../repositories/PlayerRepository.js';
import type { OrderRepository } from '../repositories/OrderRepository.js';
import type { TradeRepository } from '../repositories/TradeRepository.js';
import type { OrderMatcher } from '../domain/OrderMatcher.js';
import type { DailyRepository } from '../repositories/DailyRepository.js';
import type { SessionRepository } from '../repositories/SessionRepository.js';
import type { MetricsCollector } from '../domain/MetricsCollector.js';

export async function registerRoutes(
  app: FastifyInstance,
  plantRepo: PlantRepository,
  playerRepo: PlayerRepository,
  orderRepo: OrderRepository,
  tradeRepo: TradeRepository,
  matcher: OrderMatcher,
  dailyRepo: DailyRepository,
  sessionRepo: SessionRepository,
  metrics: MetricsCollector,
): Promise<void> {
  await app.register(plantsRoutes(plantRepo, dailyRepo), { prefix: '/plants' });
  await app.register(playersRoutes(playerRepo, dailyRepo, orderRepo, sessionRepo), {
    prefix: '/players',
  });
  await app.register(ordersRoutes(matcher, orderRepo, sessionRepo), { prefix: '/orders' });
  await app.register(tradesRoutes(tradeRepo), { prefix: '/trades' });
  await app.register(adminRoutes(metrics), { prefix: '/admin' });
}
