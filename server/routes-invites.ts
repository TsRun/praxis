import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { createSession, hashPassword } from './auth.js';

export async function inviteRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  app.get<{ Params: { token: string } }>('/api/invites/:token', async (req, reply) => {
    const { rows } = await pool.query<{
      token: string;
      expires_at: string;
      student_name: string;
      student_email: string;
      trainer_name: string;
    }>(
      `SELECT i.token, i.expires_at, s.name AS student_name, s.email AS student_email,
              t.name AS trainer_name
         FROM invite i
         JOIN student s ON s.id = i.student_id
         JOIN trainer t ON t.id = s.trainer_id
        WHERE i.token = $1 AND i.expires_at > NOW()`,
      [req.params.token],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'invite not found or expired' });
    return rows[0];
  });

  app.post<{ Params: { token: string }; Body: { password: string } }>(
    '/api/invites/:token/accept',
    async (req, reply) => {
      const { token } = req.params;
      const password = req.body?.password;
      if (!password || password.length < 8) return reply.code(400).send({ error: 'password too short' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query<{ student_id: number }>(
          `SELECT student_id FROM invite WHERE token = $1 AND expires_at > NOW() FOR UPDATE`,
          [token],
        );
        if (!rows[0]) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'invite invalid' });
        }
        const studentId = rows[0].student_id;
        const hash = await hashPassword(password);
        await client.query(
          `UPDATE student SET password_hash = $1, joined_at = NOW() WHERE id = $2`,
          [hash, studentId],
        );
        await client.query('DELETE FROM invite WHERE token = $1', [token]);
        await client.query('COMMIT');
        const s = await createSession(pool, 'student', studentId);
        reply.setCookie('sid', s.id, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          expires: s.expiresAt,
        });
        const { rows: u } = await pool.query<{ id: number; email: string; name: string }>(
          'SELECT id, email, name FROM student WHERE id = $1',
          [studentId],
        );
        return { ...u[0], kind: 'student' as const };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );
}
