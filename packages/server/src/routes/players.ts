import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import Database from 'better-sqlite3';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { Player } from '@jasmine-exchange/shared';
import type { PlayerRepository } from '../repositories/PlayerRepository.js';
import type { DailyRepository } from '../repositories/DailyRepository.js';
import type { OrderRepository } from '../repositories/OrderRepository.js';
import type { SessionRepository } from '../repositories/SessionRepository.js';
import { hashPassword, verifyPassword } from '../domain/auth.js';
import { requireSession } from './session-guard.js';
import { config } from '../config.js';

const authBodySchema = z.object({
  name: z.string().min(1).max(30),
  password: z.string().min(4).max(100),
});

const changePasswordBodySchema = z.object({
  name: z.string().min(1).max(30),
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(4).max(100),
});

export function playersRoutes(
  playerRepo: PlayerRepository,
  dailyRepo: DailyRepository,
  orderRepo: OrderRepository,
  sessionRepo: SessionRepository,
): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    const app = fastify.withTypeProvider<ZodTypeProvider>();

    function enrich(player: Player) {
      return { ...player, prevDayPortfolioValue: dailyRepo.getLatestPortfolioValue(player.id) };
    }

    // POST /players/signup — create a new account, name must be unused
    app.post(
      '/signup',
      {
        schema: {
          body: authBodySchema,
          response: {
            200: z.any(),
            409: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const { name, password } = req.body;
        if (playerRepo.findByName(name)) {
          return reply.code(409).send({ error: 'Name already taken' });
        }

        const passwordHash = hashPassword(password);
        let player;
        try {
          player = playerRepo.create(name, config.startingGold, passwordHash);
        } catch (err) {
          if (err instanceof Database.SqliteError && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return reply.code(409).send({ error: 'Name already taken' });
          }
          throw err;
        }

        const token = sessionRepo.create(player.id);
        return { player: enrich(player), token };
      },
    );

    // POST /players/login — verify credentials, issue a session token
    app.post(
      '/login',
      {
        schema: {
          body: authBodySchema,
          response: {
            200: z.any(),
            401: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const { name, password } = req.body;
        const auth = playerRepo.findAuthByName(name);
        if (!auth || !verifyPassword(password, auth.passwordHash)) {
          return reply.code(401).send({ error: 'Invalid name or password' });
        }

        const player = playerRepo.findById(auth.id)!;
        const token = sessionRepo.create(auth.id);
        return { player: enrich(player), token };
      },
    );

    // POST /players/change-password — verify current credentials, set a new password,
    // invalidate existing sessions, and issue a fresh one (logs the caller straight in).
    app.post(
      '/change-password',
      {
        schema: {
          body: changePasswordBodySchema,
          response: {
            200: z.any(),
            401: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const { name, currentPassword, newPassword } = req.body;
        const auth = playerRepo.findAuthByName(name);
        if (!auth || !verifyPassword(currentPassword, auth.passwordHash)) {
          return reply.code(401).send({ error: 'Invalid name or password' });
        }

        playerRepo.setPasswordHash(auth.id, hashPassword(newPassword));
        sessionRepo.deleteAllForPlayer(auth.id);

        const player = playerRepo.findById(auth.id)!;
        const token = sessionRepo.create(auth.id);
        return { player: enrich(player), token };
      },
    );

    // GET /players/:id
    app.get(
      '/:id',
      {
        schema: {
          params: z.object({ id: z.string() }),
          response: {
            200: z.any(),
            401: z.object({ error: z.string() }),
            403: z.object({ error: z.string() }),
            404: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const authedId = requireSession(req, sessionRepo);
        if (!authedId) return reply.code(401).send({ error: 'Unauthorized' });
        if (authedId !== req.params.id) return reply.code(403).send({ error: 'Forbidden' });

        const player = playerRepo.findById(req.params.id);
        if (!player) return reply.code(404).send({ error: 'Player not found' });
        return enrich(player);
      },
    );

    // POST /players/:id/reset — wipe portfolio, cancel open orders, restore starting gold
    app.post(
      '/:id/reset',
      {
        schema: {
          params: z.object({ id: z.string() }),
          response: {
            200: z.any(),
            401: z.object({ error: z.string() }),
            403: z.object({ error: z.string() }),
            404: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const authedId = requireSession(req, sessionRepo);
        if (!authedId) return reply.code(401).send({ error: 'Unauthorized' });
        if (authedId !== req.params.id) return reply.code(403).send({ error: 'Forbidden' });

        const player = playerRepo.findById(req.params.id);
        if (!player) return reply.code(404).send({ error: 'Player not found' });

        orderRepo.cancelAllOpenByPlayer(player.id, Date.now());
        playerRepo.reset(player.id, config.startingGold);
        dailyRepo.clearPortfolioHistory(player.id);

        const updated = playerRepo.findById(player.id)!;
        return enrich(updated);
      },
    );
  };
}
