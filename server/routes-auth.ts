import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { createSession, deleteSession, hashPassword, verifyPassword } from './auth.js';

const COOKIE_NAME = 'sid';

function setCookie(reply: FastifyReply, sid: string, expiresAt: Date) {
  reply.setCookie(COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function authRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  app.post<{ Body: { email: string; password: string; name: string } }>(
    '/api/auth/signup',
    async (req, reply) => {
      const { email, password, name } = req.body ?? ({} as never);
      if (!email || !password || !name) return reply.code(400).send({ error: 'missing fields' });
      const lower = email.toLowerCase();
      const exists = await pool.query('SELECT 1 FROM trainer WHERE email = $1', [lower]);
      if (exists.rowCount) return reply.code(409).send({ error: 'email already in use' });
      const hash = await hashPassword(password);
      const { rows } = await pool.query<{ id: number }>(
        'INSERT INTO trainer (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
        [lower, hash, name],
      );
      const trainerId = rows[0].id;
      const s = await createSession(pool, 'trainer', trainerId);
      setCookie(reply, s.id, s.expiresAt);
      return { id: trainerId, email: lower, name, kind: 'trainer' };
    },
  );

  app.post<{ Body: { email: string; password: string } }>('/api/auth/signin', async (req, reply) => {
    const { email, password } = req.body ?? ({} as never);
    if (!email || !password) return reply.code(400).send({ error: 'missing fields' });
    const lower = email.toLowerCase();

    const t = await pool.query<{ id: number; password_hash: string; name: string }>(
      'SELECT id, password_hash, name FROM trainer WHERE email = $1',
      [lower],
    );
    if (t.rowCount === 1 && (await verifyPassword(password, t.rows[0].password_hash))) {
      const s = await createSession(pool, 'trainer', t.rows[0].id);
      setCookie(reply, s.id, s.expiresAt);
      return { id: t.rows[0].id, email: lower, name: t.rows[0].name, kind: 'trainer' };
    }
    const u = await pool.query<{ id: number; password_hash: string | null; name: string }>(
      'SELECT id, password_hash, name FROM student WHERE email = $1 AND password_hash IS NOT NULL',
      [lower],
    );
    if (u.rowCount === 1 && (await verifyPassword(password, u.rows[0].password_hash!))) {
      const s = await createSession(pool, 'student', u.rows[0].id);
      setCookie(reply, s.id, s.expiresAt);
      return { id: u.rows[0].id, email: lower, name: u.rows[0].name, kind: 'student' };
    }
    return reply.code(401).send({ error: 'invalid credentials' });
  });

  app.post('/api/auth/signout', async (req, reply) => {
    const sid = req.cookies?.sid;
    await deleteSession(pool, sid);
    reply.clearCookie('sid', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'not signed in' });
    if (req.session.user_kind === 'trainer') {
      const { rows } = await pool.query<{ id: number; email: string; name: string }>(
        'SELECT id, email, name FROM trainer WHERE id = $1',
        [req.session.user_id],
      );
      return { ...rows[0], kind: 'trainer' };
    }
    const { rows } = await pool.query<{ id: number; email: string; name: string }>(
      'SELECT id, email, name FROM student WHERE id = $1',
      [req.session.user_id],
    );
    return { ...rows[0], kind: 'student' };
  });
}
