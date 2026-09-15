import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { OrderMatcher } from '../domain/OrderMatcher.js';
import type { OrderRepository } from '../repositories/OrderRepository.js';
import type { SessionRepository } from '../repositories/SessionRepository.js';
import { requireSession } from './session-guard.js';

export function ordersRoutes(
  matcher: OrderMatcher,
  orderRepo: OrderRepository,
  sessionRepo: SessionRepository,
): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // GET /orders — the caller's own open orders
    app.get(
      '/',
      {
        schema: {
          response: {
            200: z.any(),
            401: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const authedId = requireSession(req, sessionRepo);
        if (!authedId) return reply.code(401).send({ error: 'Unauthorized' });
        return orderRepo.findOpenByPlayer(authedId);
      },
    );

    // POST /orders — place a limit order
    app.post(
      '/',
      {
        schema: {
          body: z.object({
            playerId: z.string().uuid(),
            plantId: z.string().uuid(),
            type: z.enum(['bid', 'ask']),
            price: z.number().int().positive(),
            seedCount: z.number().int().positive(),
          }),
          response: {
            200: z.any(),
            401: z.object({ error: z.string() }),
            403: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const authedId = requireSession(req, sessionRepo);
        if (!authedId) return reply.code(401).send({ error: 'Unauthorized' });
        if (authedId !== req.body.playerId) return reply.code(403).send({ error: 'Forbidden' });
        return matcher.placeOrder(req.body);
      },
    );

    // DELETE /orders/:id — cancel an open order
    app.delete(
      '/:id',
      {
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: {
            200: z.object({ success: z.boolean() }),
            400: z.object({ error: z.string() }),
            401: z.object({ error: z.string() }),
            403: z.object({ error: z.string() }),
            404: z.object({ error: z.string() }),
          },
        },
      },
      async (req, reply) => {
        const authedId = requireSession(req, sessionRepo);
        if (!authedId) return reply.code(401).send({ error: 'Unauthorized' });

        const order = orderRepo.findById(req.params.id);
        if (!order) return reply.code(404).send({ error: 'Order not found' });
        if (order.playerId !== authedId) return reply.code(403).send({ error: 'Forbidden' });
        if (order.status !== 'open' && order.status !== 'partially_filled') {
          return reply.code(400).send({ error: 'Order cannot be cancelled' });
        }
        orderRepo.cancelOrder(req.params.id, Date.now());
        return { success: true };
      },
    );
  };
}
