import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { TradeRepository } from '../repositories/TradeRepository.js';

export function tradesRoutes(tradeRepo: TradeRepository): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // GET /trades?plantId=&limit=&offset=
    app.get(
      '/',
      {
        schema: {
          querystring: z.object({
            plantId: z.string().uuid().optional(),
            limit: z.coerce.number().int().positive().max(200).default(50),
            offset: z.coerce.number().int().min(0).default(0),
          }),
          response: { 200: z.any() },
        },
      },
      async (req) => {
        const { plantId, limit, offset } = req.query;
        if (plantId) return tradeRepo.findByPlant(plantId, limit, offset);
        return tradeRepo.findRecent(limit, offset);
      },
    );
  };
}
