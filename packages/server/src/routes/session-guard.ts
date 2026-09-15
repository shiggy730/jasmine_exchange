import type { FastifyRequest } from 'fastify';
import type { SessionRepository } from '../repositories/SessionRepository.js';

/** Resolves the authenticated player id from an `Authorization: Bearer <token>` header, or null. */
export function requireSession(req: FastifyRequest, sessionRepo: SessionRepository): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  return sessionRepo.getPlayerId(token);
}
