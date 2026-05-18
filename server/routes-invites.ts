import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { createSession } from './auth.js';
import { claimInviteForUser } from './routes-auth.js';

export async function inviteRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  app.get<{ Params: { token: string } }>('/api/invites/:token', async (req, reply) => {
    const { rows } = await pool.query<{
      token: string;
      expires_at: string;
      student_name: string;
      student_email: string;
      trainer_name: string;
      already_user: boolean;
    }>(
      `SELECT i.token, i.expires_at, i.student_name, i.student_email,
              t.name AS trainer_name,
              EXISTS(SELECT 1 FROM app_user WHERE email = i.student_email) AS already_user
         FROM invite i
         JOIN app_user t ON t.id = i.trainer_user_id
        WHERE i.token = $1 AND i.expires_at > NOW()`,
      [req.params.token],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'invite not found or expired' });
    return rows[0];
  });

  // For a signed-in user whose email matches the invite, accept by linking
  // (no new account, no password change). For everyone else, signup with the
  // X-Invite-Token header does the same thing.
  app.post<{ Params: { token: string } }>(
    '/api/invites/:token/link',
    async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: 'sign in first' });
      await claimInviteForUser(pool, req.params.token, req.user.id, req.user.email);
      return { ok: true };
    },
  );
}

export { createSession };
