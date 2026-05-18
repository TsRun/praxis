import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { newToken } from './auth.js';
import { sendInviteEmail } from './email.js';
import { requireTrainer } from './auth-guards.js';
import { parsePgn } from './pgn.js';

const INVITE_DAYS = 14;

export async function trainerRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  // ─── Students roster + invites ──────────────────────────────────────────────
  app.post<{ Body: { email: string; name: string } }>(
    '/api/trainer/invites',
    { preHandler: requireTrainer },
    async (req: FastifyRequest<{ Body: { email: string; name: string } }>, reply: FastifyReply) => {
      const trainerId = req.session!.user_id;
      const { email, name } = req.body ?? ({} as never);
      if (!email || !name) return reply.code(400).send({ error: 'missing fields' });
      const lower = email.toLowerCase();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query<{ id: number }>(
          `SELECT id FROM student WHERE trainer_id = $1 AND email = $2`,
          [trainerId, lower],
        );
        let studentId: number;
        if (existing.rowCount) {
          studentId = existing.rows[0].id;
        } else {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO student (trainer_id, email, name) VALUES ($1, $2, $3) RETURNING id`,
            [trainerId, lower, name],
          );
          studentId = ins.rows[0].id;
        }
        const token = newToken();
        await client.query(
          `INSERT INTO invite (token, student_id, expires_at)
             VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
          [token, studentId, INVITE_DAYS],
        );
        await client.query('COMMIT');
        const tr = await pool.query<{ name: string }>(`SELECT name FROM trainer WHERE id = $1`, [trainerId]);
        await sendInviteEmail({
          to: lower,
          trainerName: tr.rows[0].name,
          studentName: name,
          token,
        });
        return { ok: true, student_id: studentId };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  );

  app.get('/api/trainer/students', { preHandler: requireTrainer }, async (req) => {
    const trainerId = req.session!.user_id;
    const { rows } = await pool.query<{
      id: number;
      email: string;
      name: string;
      invited_at: string;
      joined_at: string | null;
      assignment_count: string;
    }>(
      `SELECT s.id, s.email, s.name, s.invited_at, s.joined_at,
              COALESCE((SELECT COUNT(*)::text FROM assignment a WHERE a.student_id = s.id), '0') AS assignment_count
         FROM student s
        WHERE s.trainer_id = $1
        ORDER BY s.joined_at DESC NULLS LAST, s.invited_at DESC`,
      [trainerId],
    );
    return rows.map((r) => ({ ...r, assignment_count: Number(r.assignment_count) }));
  });

  app.get<{ Params: { id: string } }>(
    '/api/trainer/students/:id',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const studentId = Number(req.params.id);
      const { rows: s } = await pool.query(
        `SELECT id, email, name, invited_at, joined_at FROM student
          WHERE id = $1 AND trainer_id = $2`,
        [studentId, trainerId],
      );
      if (!s[0]) return reply.code(404).send({ error: 'not found' });
      const { rows: assignments } = await pool.query(
        `SELECT a.id, a.study_kind, a.study_id, a.assigned_at, a.completed_at,
                CASE a.study_kind
                  WHEN 'opening' THEN (SELECT name FROM opening_study WHERE id = a.study_id)
                  WHEN 'game'    THEN (SELECT name FROM game_study WHERE id = a.study_id)
                END AS name
           FROM assignment a
          WHERE a.student_id = $1
          ORDER BY a.assigned_at DESC`,
        [studentId],
      );
      return { ...s[0], assignments };
    },
  );

  app.post<{ Params: { id: string }; Body: { study_kind: 'opening' | 'game'; study_id: number } }>(
    '/api/trainer/students/:id/assignments',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const studentId = Number(req.params.id);
      const { study_kind, study_id } = req.body ?? ({} as never);
      if (!study_kind || !study_id) return reply.code(400).send({ error: 'missing fields' });
      const own = await pool.query(`SELECT 1 FROM student WHERE id = $1 AND trainer_id = $2`, [studentId, trainerId]);
      if (!own.rowCount) return reply.code(404).send({ error: 'student not found' });
      const ownStudy = await pool.query(
        study_kind === 'opening'
          ? `SELECT 1 FROM opening_study WHERE id = $1 AND trainer_id = $2`
          : `SELECT 1 FROM game_study WHERE id = $1 AND trainer_id = $2`,
        [study_id, trainerId],
      );
      if (!ownStudy.rowCount) return reply.code(404).send({ error: 'study not found' });
      await pool.query(
        `INSERT INTO assignment (student_id, study_kind, study_id) VALUES ($1, $2, $3)
           ON CONFLICT (student_id, study_kind, study_id) DO NOTHING`,
        [studentId, study_kind, study_id],
      );
      return { ok: true };
    },
  );

  // ─── Opening studies ──────────────────────────────────────────────────────
  app.get('/api/trainer/studies/opening', { preHandler: requireTrainer }, async (req) => {
    const trainerId = req.session!.user_id;
    const { rows } = await pool.query<{
      id: number;
      name: string;
      root_fen: string;
      eco: string | null;
      side: 'w' | 'b';
      created_at: string;
      updated_at: string;
      annotation_count: string;
    }>(
      `SELECT os.id, os.name, os.root_fen, os.eco, os.side, os.created_at, os.updated_at,
              COALESCE((SELECT COUNT(*)::text FROM opening_annotation a WHERE a.study_id = os.id), '0') AS annotation_count
         FROM opening_study os
        WHERE os.trainer_id = $1
        ORDER BY os.updated_at DESC`,
      [trainerId],
    );
    return rows.map((r) => ({ ...r, annotation_count: Number(r.annotation_count) }));
  });

  app.post<{ Body: { name: string; root_fen: string; eco?: string; side: 'w' | 'b' } }>(
    '/api/trainer/studies/opening',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const { name, root_fen, eco, side } = req.body ?? ({} as never);
      if (!name || !root_fen || (side !== 'w' && side !== 'b'))
        return reply.code(400).send({ error: 'missing fields' });
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO opening_study (trainer_id, name, root_fen, eco, side)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [trainerId, name, root_fen, eco ?? null, side],
      );
      return { id: rows[0].id };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/trainer/studies/opening/:id',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const id = Number(req.params.id);
      const { rows } = await pool.query<{
        id: number;
        name: string;
        root_fen: string;
        eco: string | null;
        side: 'w' | 'b';
      }>(
        `SELECT id, name, root_fen, eco, side FROM opening_study WHERE id = $1 AND trainer_id = $2`,
        [id, trainerId],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'not found' });
      const ann = await pool.query<{ fen: string; comment_md: string }>(
        `SELECT fen, comment_md FROM opening_annotation WHERE study_id = $1`,
        [id],
      );
      return { ...rows[0], annotations: ann.rows };
    },
  );

  app.put<{ Params: { id: string }; Body: { annotations: { fen: string; comment_md: string }[] } }>(
    '/api/trainer/studies/opening/:id/annotations',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const id = Number(req.params.id);
      const owns = await pool.query<{ id: number }>(
        `SELECT id FROM opening_study WHERE id = $1 AND trainer_id = $2`,
        [id, trainerId],
      );
      if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
      const list = req.body?.annotations ?? [];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM opening_annotation WHERE study_id = $1`, [id]);
        for (const a of list) {
          if (!a.fen || !a.comment_md) continue;
          await client.query(
            `INSERT INTO opening_annotation (study_id, fen, comment_md) VALUES ($1, $2, $3)`,
            [id, a.fen, a.comment_md],
          );
        }
        await client.query(`UPDATE opening_study SET updated_at = NOW() WHERE id = $1`, [id]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      return { ok: true, count: list.length };
    },
  );

  // ─── Game studies ─────────────────────────────────────────────────────────
  app.get('/api/trainer/studies/game', { preHandler: requireTrainer }, async (req) => {
    const trainerId = req.session!.user_id;
    const { rows } = await pool.query(
      `SELECT gs.id, gs.name, gs.headers_json, gs.created_at, gs.updated_at,
              COALESCE((SELECT COUNT(*)::text FROM game_annotation a WHERE a.study_id = gs.id), '0') AS annotation_count
         FROM game_study gs WHERE gs.trainer_id = $1 ORDER BY gs.updated_at DESC`,
      [trainerId],
    );
    return rows.map((r) => ({ ...r, annotation_count: Number(r.annotation_count) }));
  });

  app.post<{ Body: { name: string; pgn: string } }>(
    '/api/trainer/studies/game',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const { name, pgn } = req.body ?? ({} as never);
      if (!name || !pgn) return reply.code(400).send({ error: 'missing fields' });
      const parsed = parsePgn(pgn);
      if (!parsed) return reply.code(400).send({ error: 'invalid PGN' });
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO game_study (trainer_id, name, pgn, headers_json)
           VALUES ($1, $2, $3, $4) RETURNING id`,
        [trainerId, name, pgn, parsed.headers],
      );
      return { id: rows[0].id };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/trainer/studies/game/:id',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const id = Number(req.params.id);
      const { rows } = await pool.query<{
        id: number;
        name: string;
        pgn: string;
        headers_json: Record<string, string>;
      }>(
        `SELECT id, name, pgn, headers_json FROM game_study WHERE id = $1 AND trainer_id = $2`,
        [id, trainerId],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'not found' });
      const ann = await pool.query<{ ply: number; comment_md: string | null; is_quiz: boolean }>(
        `SELECT ply, comment_md, is_quiz FROM game_annotation WHERE study_id = $1 ORDER BY ply`,
        [id],
      );
      return { ...rows[0], annotations: ann.rows };
    },
  );

  app.put<{
    Params: { id: string };
    Body: { annotations: { ply: number; comment_md: string | null; is_quiz: boolean }[] };
  }>(
    '/api/trainer/studies/game/:id/annotations',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.session!.user_id;
      const id = Number(req.params.id);
      const owns = await pool.query(`SELECT 1 FROM game_study WHERE id = $1 AND trainer_id = $2`, [id, trainerId]);
      if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
      const list = req.body?.annotations ?? [];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM game_annotation WHERE study_id = $1`, [id]);
        for (const a of list) {
          await client.query(
            `INSERT INTO game_annotation (study_id, ply, comment_md, is_quiz) VALUES ($1, $2, $3, $4)`,
            [id, a.ply, a.comment_md, a.is_quiz],
          );
        }
        await client.query(`UPDATE game_study SET updated_at = NOW() WHERE id = $1`, [id]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      return { ok: true, count: list.length };
    },
  );
}
