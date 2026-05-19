import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import '@fastify/cookie';
import { lookupUserBySession, type UserRecord, type Role } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserRecord;
  }
}

export function makeAuthHook(pool: Pool) {
  return async function attachUser(req: FastifyRequest) {
    const raw = req.cookies?.sid;
    if (!raw) return;
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    const u = await lookupUserBySession(pool, unsigned.value);
    if (u) req.user = u;
  };
}

function hasRole(req: FastifyRequest, role: Role): boolean {
  return !!req.user && req.user.roles.includes(role);
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) return reply.code(401).send({ error: 'auth required' });
}

/** Trainer-only routes (roster management, sending invites). */
export async function requireTrainer(req: FastifyRequest, reply: FastifyReply) {
  if (!hasRole(req, 'trainer')) {
    return reply.code(403).send({ error: 'trainer role required' });
  }
}

/** Any user that can author studies — trainers OR self-trainers. */
export async function requireAuthor(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user || (!hasRole(req, 'trainer') && !hasRole(req, 'self'))) {
    return reply.code(403).send({ error: 'trainer or self role required' });
  }
}
