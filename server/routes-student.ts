import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { requireUser } from './auth-guards.js';
import { moveAtPly } from './pgn.js';

// Routes scoped to "my own data" — assignments, study viewing, quiz attempts.
// Any signed-in user can hit these; access checks happen per-row using the
// `assignment` and `mentor` tables (you can read a study you authored, a study
// assigned to you, or a study authored by a trainer who linked you).
export async function studentRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  app.get('/api/student/assignments', { preHandler: requireUser }, async (req) => {
    const uid = req.user!.id;
    const { rows } = await pool.query<{
      id: number;
      study_kind: 'opening' | 'game';
      study_id: number;
      name: string;
      assigned_at: string;
      completed_at: string | null;
      progress_pct: string | null;
    }>(
      `WITH base AS (
         SELECT a.id, a.study_kind, a.study_id, a.assigned_at, a.completed_at,
                CASE a.study_kind
                  WHEN 'opening' THEN (SELECT name FROM opening_study WHERE id = a.study_id)
                  WHEN 'game'    THEN (SELECT name FROM game_study WHERE id = a.study_id)
                END AS name
           FROM assignment a
          WHERE a.assignee_id = $1
       )
       SELECT b.*,
         CASE b.study_kind
           WHEN 'opening' THEN (
             SELECT CASE WHEN (SELECT COUNT(*) FROM opening_annotation WHERE study_id = b.study_id) = 0
                         THEN '0'
                         ELSE (100.0 * (SELECT COUNT(*) FROM opening_visit
                                          WHERE user_id = $1 AND study_id = b.study_id)
                               /
                               (SELECT COUNT(*) FROM opening_annotation WHERE study_id = b.study_id))::text
                    END
           )
           WHEN 'game' THEN (
             SELECT CASE WHEN (SELECT COUNT(*) FROM game_annotation WHERE study_id = b.study_id AND is_quiz) = 0
                         THEN '0'
                         ELSE (100.0 * (SELECT COUNT(*) FROM quiz_attempt
                                          WHERE user_id = $1 AND game_study_id = b.study_id)
                               /
                               (SELECT COUNT(*) FROM game_annotation WHERE study_id = b.study_id AND is_quiz))::text
                    END
           )
         END AS progress_pct
         FROM base b
         ORDER BY b.assigned_at DESC`,
      [uid],
    );
    return rows.map((r) => ({
      ...r,
      progress_pct: r.progress_pct == null ? 0 : Math.round(Number(r.progress_pct)),
    }));
  });

  app.get<{ Params: { id: string } }>(
    '/api/student/studies/opening/:id',
    { preHandler: requireUser },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const access = await pool.query(
        `SELECT 1
           FROM opening_study os
          WHERE os.id = $1
            AND (os.owner_id = $2
                 OR EXISTS(SELECT 1 FROM assignment a
                            WHERE a.assignee_id = $2 AND a.study_kind = 'opening' AND a.study_id = $1))`,
        [id, uid],
      );
      if (!access.rowCount) return reply.code(404).send({ error: 'not assigned' });
      const { rows: s } = await pool.query<{
        id: number;
        name: string;
        root_fen: string;
        eco: string | null;
        side: 'w' | 'b';
      }>(`SELECT id, name, root_fen, eco, side FROM opening_study WHERE id = $1`, [id]);
      if (!s[0]) return reply.code(404).send({ error: 'not found' });
      const ann = await pool.query<{ fen: string; comment_md: string }>(
        `SELECT fen, comment_md FROM opening_annotation WHERE study_id = $1`,
        [id],
      );
      const visited = await pool.query<{ fen: string }>(
        `SELECT fen FROM opening_visit WHERE user_id = $1 AND study_id = $2`,
        [uid, id],
      );
      return { ...s[0], annotations: ann.rows, visited: visited.rows.map((v) => v.fen) };
    },
  );

  app.post<{ Params: { id: string }; Body: { fen: string } }>(
    '/api/student/studies/opening/:id/visited',
    { preHandler: requireUser },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const { fen } = req.body ?? ({} as never);
      if (!fen) return reply.code(400).send({ error: 'missing fen' });
      await pool.query(
        `INSERT INTO opening_visit (user_id, study_id, fen) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
        [uid, id, fen],
      );
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/student/studies/game/:id',
    { preHandler: requireUser },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const access = await pool.query(
        `SELECT 1
           FROM game_study gs
          WHERE gs.id = $1
            AND (gs.owner_id = $2
                 OR EXISTS(SELECT 1 FROM assignment a
                            WHERE a.assignee_id = $2 AND a.study_kind = 'game' AND a.study_id = $1))`,
        [id, uid],
      );
      if (!access.rowCount) return reply.code(404).send({ error: 'not assigned' });
      const { rows: s } = await pool.query<{
        id: number;
        name: string;
        pgn: string;
        headers_json: Record<string, string>;
      }>(`SELECT id, name, pgn, headers_json FROM game_study WHERE id = $1`, [id]);
      if (!s[0]) return reply.code(404).send({ error: 'not found' });
      const ann = await pool.query<{ ply: number; comment_md: string | null; is_quiz: boolean }>(
        `SELECT ply, comment_md, is_quiz FROM game_annotation WHERE study_id = $1 ORDER BY ply`,
        [id],
      );
      const attempts = await pool.query<{ ply: number; attempted_san: string; correct: boolean }>(
        `SELECT ply, attempted_san, correct FROM quiz_attempt
          WHERE user_id = $1 AND game_study_id = $2 ORDER BY ply`,
        [uid, id],
      );
      return { ...s[0], annotations: ann.rows, attempts: attempts.rows };
    },
  );

  app.post<{ Params: { id: string }; Body: { ply: number; attempted_san: string } }>(
    '/api/student/studies/game/:id/attempt',
    { preHandler: requireUser },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const { ply, attempted_san } = req.body ?? ({} as never);
      if (!ply || !attempted_san) return reply.code(400).send({ error: 'missing fields' });
      const access = await pool.query(
        `SELECT 1 FROM game_study gs
          WHERE gs.id = $1 AND (gs.owner_id = $2
                                OR EXISTS(SELECT 1 FROM assignment a
                                           WHERE a.assignee_id = $2 AND a.study_kind = 'game' AND a.study_id = $1))`,
        [id, uid],
      );
      if (!access.rowCount) return reply.code(404).send({ error: 'not assigned' });
      const { rows: g } = await pool.query<{ pgn: string }>(
        `SELECT pgn FROM game_study WHERE id = $1`,
        [id],
      );
      const expected = g[0] ? moveAtPly(g[0].pgn, ply) : null;
      const correct = expected != null && expected === attempted_san;
      await pool.query(
        `INSERT INTO quiz_attempt (user_id, game_study_id, ply, attempted_san, correct)
           VALUES ($1, $2, $3, $4, $5)`,
        [uid, id, ply, attempted_san, correct],
      );
      const { rows: a } = await pool.query<{ comment_md: string | null }>(
        `SELECT comment_md FROM game_annotation WHERE study_id = $1 AND ply = $2`,
        [id, ply],
      );
      return { correct, expected_san: expected, comment_md: a[0]?.comment_md ?? null };
    },
  );
}
