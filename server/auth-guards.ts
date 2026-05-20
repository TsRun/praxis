import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import '@fastify/cookie';
import { lookupUserBySession, type UserRecord, type Role } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserRecord;
  }
}

export function makeAuthHook(pool: Pool) {
  return async function attachUser(req: FastifyRequest) {
    // Bearer API key takes precedence over the session cookie so a
    // misconfigured browser cookie can't shadow an MCP/CI call. Keys
    // are sha256-hashed at rest; we look up by the hash.
    const authz = req.headers.authorization;
    if (authz && /^Bearer\s+praxis_[A-Za-z0-9_-]+$/.test(authz)) {
      const token = authz.slice(7);
      const hash = createHash('sha256').update(token).digest('hex');
      const u = await lookupUserByApiKey(pool, hash);
      if (u) {
        req.user = u;
        // Fire-and-forget — last_used_at is informational; don't block the
        // request on the UPDATE and don't surface errors.
        pool
          .query('UPDATE api_key SET last_used_at = NOW() WHERE key_hash = $1', [hash])
          .catch(() => {});
        return;
      }
    }
    const raw = req.cookies?.sid;
    if (!raw) return;
    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    const u = await lookupUserBySession(pool, unsigned.value);
    if (u) req.user = u;
  };
}

async function lookupUserByApiKey(pool: Pool, hash: string): Promise<UserRecord | null> {
  const { rows } = await pool.query<UserRecord>(
    `SELECT u.id, u.email, u.name, u.roles
       FROM api_key k
       JOIN app_user u ON u.id = k.user_id
      WHERE k.key_hash = $1`,
    [hash],
  );
  return rows[0] ?? null;
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
