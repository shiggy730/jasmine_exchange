import type { FastifyPluginAsync } from 'fastify';
import type { MetricsCollector } from '../domain/MetricsCollector.js';

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// No zod/body/params/query here — plain JSON in, plain JSON out — so this plugin
// deliberately skips the validator/serializer-compiler boilerplate the other route
// files need for their zod schemas (those are set per-plugin-scope, not globally).
export function adminRoutes(metrics: MetricsCollector): FastifyPluginAsync {
  return async (fastify) => {
    // Read-only operational data, but still restricted to callers on this machine —
    // not real auth, just a sanity backstop appropriate for a zero-mutation endpoint.
    fastify.addHook('onRequest', async (req, reply) => {
      if (!LOOPBACK_IPS.has(req.ip)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    });

    // GET /admin/metrics — live per-route TPS + recent failed-call time series
    fastify.get('/metrics', async () => metrics.snapshot());
  };
}
