import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
// Side-effect import: @fastify/cookie augments FastifyRequest with `cookies`.
import '@fastify/cookie';
import { lookupSession, type SessionRow } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionRow;
  }
}

export function makeAuthHook(pool: Pool) {
  return async function attachSession(req: FastifyRequest) {
    const id = req.cookies?.sid;
    const s = await lookupSession(pool, id);
    if (s) req.session = s;
  };
}

export async function requireTrainer(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session || req.session.user_kind !== 'trainer') {
    return reply.code(401).send({ error: 'trainer auth required' });
  }
}

export async function requireStudent(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session || req.session.user_kind !== 'student') {
    return reply.code(401).send({ error: 'student auth required' });
  }
}

export async function requireAnyUser(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session) {
    return reply.code(401).send({ error: 'auth required' });
  }
}
