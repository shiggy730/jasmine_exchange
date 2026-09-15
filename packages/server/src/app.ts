import Fastify from 'fastify';
import { registerCors } from './plugins/cors.js';
import { registerRoutes } from './routes/index.js';
import { getDb } from './db/database.js';
import { PlantRepository } from './repositories/PlantRepository.js';
import { PlayerRepository } from './repositories/PlayerRepository.js';
import { OrderRepository } from './repositories/OrderRepository.js';
import { TradeRepository } from './repositories/TradeRepository.js';
import { SessionRepository } from './repositories/SessionRepository.js';
import { OrderMatcher } from './domain/OrderMatcher.js';
import { BotEngine } from './domain/BotEngine.js';
import { DayRoller } from './domain/DayRoller.js';
import { DailyRepository } from './repositories/DailyRepository.js';
import { MetricsCollector } from './domain/MetricsCollector.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    },
  });

  const db = getDb();
  const plantRepo = new PlantRepository(db);
  const playerRepo = new PlayerRepository(db);
  const orderRepo = new OrderRepository(db);
  const tradeRepo = new TradeRepository(db);
  const dailyRepo = new DailyRepository(db);
  const sessionRepo = new SessionRepository(db);
  const metrics = new MetricsCollector();
  const matcher = new OrderMatcher(db, plantRepo, playerRepo, orderRepo, tradeRepo);
  const bots = new BotEngine(plantRepo, playerRepo, orderRepo, matcher);
  const dayRoller = new DayRoller(dailyRepo, plantRepo, playerRepo, tradeRepo);

  // Seed initial plant data (idempotent), then bootstrap prev-day close prices
  plantRepo.seedPlants();
  for (const plant of plantRepo.getAll()) {
    dailyRepo.bootstrapPlantClose(plant.id, plant.currentPrice);
  }

  await registerCors(app);
  await registerRoutes(
    app,
    plantRepo,
    playerRepo,
    orderRepo,
    tradeRepo,
    matcher,
    dailyRepo,
    sessionRepo,
    metrics,
  );

  app.addHook('onResponse', (request, reply, done) => {
    const method = Array.isArray(request.routeOptions.method)
      ? request.routeOptions.method[0]
      : request.routeOptions.method;
    metrics.record(method ?? request.method, request.routeOptions.url ?? '(unmatched)', reply.statusCode);
    done();
  });

  app.addHook('onReady', async () => {
    bots.start();
    dayRoller.start();
  });

  app.addHook('onClose', async () => {
    bots.stop();
    dayRoller.stop();
  });

  return app;
}
