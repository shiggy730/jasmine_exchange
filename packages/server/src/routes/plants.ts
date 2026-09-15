import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import type { PlantRepository } from '../repositories/PlantRepository.js';
import type { DailyRepository } from '../repositories/DailyRepository.js';

export function plantsRoutes(plantRepo: PlantRepository, dailyRepo: DailyRepository): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // GET /plants
    app.get(
      '/',
      { schema: { response: { 200: z.object({ plants: z.array(z.any()) }) } } },
      async () => {
        const plants = plantRepo.getAll();
        const prevCloses = dailyRepo.getAllLatestCloses();
        return {
          plants: plants.map((p) => ({ ...p, prevDayClose: prevCloses.get(p.id) ?? null })),
        };
      },
    );

    // GET /plants/:id
    app.get(
      '/:id',
      {
        schema: {
          params: z.object({ id: z.string() }),
          response: { 200: z.any(), 404: z.object({ error: z.string() }) },
        },
      },
      async (req, reply) => {
        const plant = plantRepo.getById(req.params.id);
        if (!plant) return reply.code(404).send({ error: 'Plant not found' });
        const prevCloses = dailyRepo.getAllLatestCloses();
        return { ...plant, prevDayClose: prevCloses.get(plant.id) ?? null };
      },
    );
  };
}
