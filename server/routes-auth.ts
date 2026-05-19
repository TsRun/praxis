import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { createSession, deleteSession, hashPassword, normalizeRoles, verifyPassword } from './auth.js';

const COOKIE_NAME = 'sid';

function setCookie(reply: FastifyReply, sid: string, expiresAt: Date) {
  reply.setCookie(COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function authRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  app.post<{ Body: { email: string; password: string; name: string; roles?: string[] } }>(
    '/api/auth/signup',
    async (req, reply) => {
      const { email, password, name } = req.body ?? ({} as never);
      const roles = normalizeRoles(req.body?.roles);
      if (!email || !password || !name)
        return reply.code(400).send({ error: 'missing fields' });
      if (password.length < 8) return reply.code(400).send({ error: 'password too short' });
      if (roles.length === 0)
        return reply.code(400).send({ error: 'pick at least one role' });
      const lower = email.toLowerCase().trim();
      const exists = await pool.query('SELECT 1 FROM app_user WHERE email = $1', [lower]);
      if (exists.rowCount) return reply.code(409).send({ error: 'email already in use' });
      const hash = await hashPassword(password);
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO app_user (email, password_hash, name, roles)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [lower, hash, name, roles],
      );
      const userId = rows[0].id;

      // If invited via a token previously, accept it now (claims the mentor link)
      const tokenHeader = req.headers['x-invite-token'];
      if (typeof tokenHeader === 'string' && tokenHeader.length > 0) {
        await claimInviteForUser(pool, tokenHeader, userId, lower);
      }

      const s = await createSession(pool, userId);
      setCookie(reply, s.id, s.expiresAt);
      return { id: userId, email: lower, name, roles };
    },
  );

  app.post<{ Body: { email: string; password: string } }>(
    '/api/auth/signin',
    async (req, reply) => {
      const { email, password } = req.body ?? ({} as never);
      if (!email || !password) return reply.code(400).send({ error: 'missing fields' });
      const lower = email.toLowerCase().trim();
      const { rows } = await pool.query<{
        id: number;
        password_hash: string;
        name: string;
        roles: string[];
      }>('SELECT id, password_hash, name, roles FROM app_user WHERE email = $1', [lower]);
      if (rows.length !== 1 || !(await verifyPassword(password, rows[0].password_hash))) {
        return reply.code(401).send({ error: 'invalid credentials' });
      }
      const s = await createSession(pool, rows[0].id);
      setCookie(reply, s.id, s.expiresAt);
      return { id: rows[0].id, email: lower, name: rows[0].name, roles: rows[0].roles };
    },
  );

  app.post('/api/auth/signout', async (req, reply) => {
    await deleteSession(pool, req.cookies?.sid);
    reply.clearCookie('sid', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'not signed in' });
    return req.user;
  });

  app.put<{ Body: { roles?: string[] } }>('/api/auth/roles', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'not signed in' });
    const roles = normalizeRoles(req.body?.roles);
    if (roles.length === 0) return reply.code(400).send({ error: 'pick at least one role' });
    await pool.query(`UPDATE app_user SET roles = $1 WHERE id = $2`, [roles, req.user.id]);
    return { ...req.user, roles };
  });
}

/**
 * Look up an invite token. If valid, link the new user to the inviting trainer
 * as a student and consume the invite. Called from signup when the client
 * supplies the X-Invite-Token header (set by InvitePage on its way to signup).
 */
async function claimInviteForUser(
  pool: Pool,
  token: string,
  userId: number,
  userEmail: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ trainer_user_id: number; student_email: string }>(
      `SELECT trainer_user_id, student_email FROM invite
        WHERE token = $1 AND expires_at > NOW() FOR UPDATE`,
      [token],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return;
    }
    if (rows[0].student_email.toLowerCase() !== userEmail) {
      await client.query('ROLLBACK');
      return; // token email mismatch — silently ignore
    }
    await client.query(
      `INSERT INTO mentor (trainer_user_id, student_user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [rows[0].trainer_user_id, userId],
    );
    // Ensure the user has the 'student' role on claim
    await client.query(
      `UPDATE app_user
          SET roles = ARRAY(SELECT DISTINCT unnest(roles || ARRAY['student']))
        WHERE id = $1`,
      [userId],
    );
    await client.query(`DELETE FROM invite WHERE token = $1`, [token]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { claimInviteForUser };
