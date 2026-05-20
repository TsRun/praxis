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
                  WHEN 'tactic'  THEN (SELECT name FROM tactic_set WHERE id = a.study_id)
                END AS name
           FROM assignment a
          WHERE a.assignee_id = $1
       )
       SELECT b.*,
         CASE b.study_kind
           WHEN 'opening' THEN (
             -- numerator: quizzable nodes the student has answered correctly at
             -- least once (correct_streak >= 1). denominator: all quizzable
             -- nodes — those where it's the student's side to move at parent_fen
             -- (study.side='w' ⇒ odd ply, 'b' ⇒ even ply, matching quiz/next).
             SELECT CASE WHEN total = 0 THEN '0'
                         ELSE (100.0 * done / total)::text
                    END
               FROM (
                 SELECT
                   (SELECT COUNT(*) FROM opening_node n
                      JOIN opening_study s ON s.id = n.study_id
                      WHERE n.study_id = b.study_id
                        AND ((s.side = 'w' AND n.ply % 2 = 1)
                          OR (s.side = 'b' AND n.ply % 2 = 0))
                   ) AS total,
                   (SELECT COUNT(*) FROM node_quiz_state q
                      JOIN opening_node n  ON n.id = q.node_id
                      JOIN opening_study s ON s.id = n.study_id
                      WHERE q.user_id = $1 AND n.study_id = b.study_id
                        AND q.correct_streak >= 1
                        AND ((s.side = 'w' AND n.ply % 2 = 1)
                          OR (s.side = 'b' AND n.ply % 2 = 0))
                   ) AS done
               ) x
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
           WHEN 'tactic' THEN (
             -- numerator: distinct puzzles answered correctly at least once;
             -- denominator: all puzzles in the set.
             SELECT CASE WHEN total = 0 THEN '0'
                         ELSE (100.0 * done / total)::text
                    END
               FROM (
                 SELECT
                   (SELECT COUNT(*) FROM tactic_puzzle p WHERE p.set_id = b.study_id) AS total,
                   (SELECT COUNT(DISTINCT a.puzzle_id) FROM tactic_attempt a
                      JOIN tactic_puzzle p ON p.id = a.puzzle_id
                      WHERE a.user_id = $1 AND a.correct = TRUE AND p.set_id = b.study_id
                   ) AS done
               ) x
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
        `SELECT 1 FROM opening_study os
          WHERE os.id = $1
            AND (os.owner_id = $2
                 OR EXISTS(SELECT 1 FROM assignment a
                            WHERE a.assignee_id = $2 AND a.study_kind = 'opening' AND a.study_id = $1))`,
        [id, uid],
      );
      if (!access.rowCount) return reply.code(404).send({ error: 'not assigned' });
      const { rows: s } = await pool.query(
        `SELECT id, name, root_fen, eco, side FROM opening_study WHERE id = $1`,
        [id],
      );
      if (!s[0]) return reply.code(404).send({ error: 'not found' });
      const nodes = await pool.query(
        `SELECT id, parent_id, parent_fen, san, uci, fen, ply, is_main
           FROM opening_node WHERE study_id = $1 ORDER BY ply, id`,
        [id],
      );
      const chapters = await pool.query(
        `SELECT c.node_id, c.title, c.body_md FROM opening_chapter c
           JOIN opening_node n ON n.id = c.node_id WHERE n.study_id = $1`,
        [id],
      );
      const states = await pool.query(
        `SELECT q.node_id, q.correct_streak, q.wrong_count, q.last_seen_at, q.next_due_at
           FROM node_quiz_state q
           JOIN opening_node n ON n.id = q.node_id
          WHERE n.study_id = $1 AND q.user_id = $2`,
        [id, uid],
      );
      return {
        ...s[0],
        nodes: nodes.rows,
        chapters: chapters.rows,
        quiz_state: states.rows,
      };
    },
  );

  /**
   * Pick the next quiz card for this student in this study.
   *
   * Rules:
   *   - Only quiz on nodes where it's the student's side to move at
   *     `parent_fen` — i.e., the trainer-prescribed move belongs to the
   *     student's repertoire (study.side).
   *   - Order by `next_due_at ASC NULLS FIRST` so new cards come up first
   *     and overdue cards are surfaced.
   *
   * Returns { node_id, parent_fen, ply, opponent_line: [sans needed to
   *   reach parent_fen from root, in order] } or null if nothing's due.
   */
  app.get<{ Params: { id: string } }>(
    '/api/student/studies/opening/:id/quiz/next',
    { preHandler: requireUser },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      // Access predicate: study owner OR has an assignment for it.
      const access = await pool.query(
        `SELECT 1 FROM opening_study os
          WHERE os.id = $1
            AND (os.owner_id = $2
                 OR EXISTS(SELECT 1 FROM assignment a
                            WHERE a.assignee_id = $2 AND a.study_kind = 'opening' AND a.study_id = $1))`,
        [id, uid],
      );
      if (!access.rowCount) return reply.code(404).send({ error: 'not assigned' });
      const { rows: s } = await pool.query<{ side: 'w' | 'b'; root_fen: string }>(
        `SELECT side, root_fen FROM opening_study WHERE id = $1`,
        [id],
      );
      if (!s[0]) return reply.code(404).send({ error: 'not found' });
      const side = s[0].side; // student plays this side

      const { rows } = await pool.query<{
        id: number;
        parent_id: number | null;
        parent_fen: string;
        san: string;
        ply: number;
        next_due_at: string | null;
      }>(
        `SELECT n.id, n.parent_id, n.parent_fen, n.san, n.ply, q.next_due_at
           FROM opening_node n
           LEFT JOIN node_quiz_state q
             ON q.node_id = n.id AND q.user_id = $2
          WHERE n.study_id = $1
            -- ply odd ⇒ white was about to move at parent_fen ⇒ white's move
            AND (
              ($3 = 'w' AND n.ply % 2 = 1)
              OR
              ($3 = 'b' AND n.ply % 2 = 0)
            )
          ORDER BY q.next_due_at ASC NULLS FIRST, n.ply ASC, n.id ASC
          LIMIT 1`,
        [id, uid, side],
      );
      if (!rows[0]) return { card: null };

      const card = rows[0];
      // Walk back to root collecting the SAN line that leads to parent_fen
      const line: string[] = [];
      let cursor: number | null = card.parent_id;
      while (cursor) {
        const { rows: p } = await pool.query<{ parent_id: number | null; san: string }>(
          `SELECT parent_id, san FROM opening_node WHERE id = $1`,
          [cursor],
        );
        if (!p[0]) break;
        line.unshift(p[0].san);
        cursor = p[0].parent_id;
      }
      return {
        card: {
          node_id: card.id,
          parent_fen: card.parent_fen,
          ply: card.ply,
          opponent_line: line,
          root_fen: s[0].root_fen,
        },
      };
    },
  );

  /**
   * Submit a quiz attempt. Implements a simple spaced-repetition schedule:
   *   - correct → correct_streak++, next_due_at = NOW + interval(streak)
   *   - wrong   → correct_streak = 0, wrong_count++, next_due_at = NOW + 1min
   *
   * Intervals (correct streak → delay): 0→1m, 1→10m, 2→1h, 3→1d, 4→3d,
   * 5→7d, 6→14d, ≥7→30d.
   */
  app.post<{
    Params: { id: string };
    Body: { node_id: number; attempted_san: string };
  }>('/api/student/studies/opening/:id/quiz/attempt', { preHandler: requireUser }, async (req, reply) => {
    const uid = req.user!.id;
    const id = Number(req.params.id);
    const { node_id, attempted_san } = req.body ?? ({} as never);
    if (!node_id || !attempted_san) return reply.code(400).send({ error: 'missing fields' });
    // Access predicate: owner OR assignment. Without this, any signed-in user
    // can submit attempts against arbitrary studies and read back expected_san
    // + the trainer's chapter body_md.
    const access = await pool.query(
      `SELECT 1 FROM opening_study os
        WHERE os.id = $1
          AND (os.owner_id = $2
               OR EXISTS(SELECT 1 FROM assignment a
                          WHERE a.assignee_id = $2 AND a.study_kind = 'opening' AND a.study_id = $1))`,
      [id, uid],
    );
    if (!access.rowCount) return reply.code(404).send({ error: 'not assigned' });
    const { rows: n } = await pool.query<{ san: string; study_id: number }>(
      `SELECT san, study_id FROM opening_node WHERE id = $1`,
      [node_id],
    );
    if (!n[0] || n[0].study_id !== id)
      return reply.code(404).send({ error: 'node not found' });
    const correct = n[0].san === attempted_san;

    // Spaced-repetition interval table (minutes)
    const minutesByStreak = [1, 10, 60, 1440, 4320, 10080, 20160, 43200];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: existing } = await client.query<{ correct_streak: number; wrong_count: number }>(
        `SELECT correct_streak, wrong_count FROM node_quiz_state WHERE user_id = $1 AND node_id = $2`,
        [uid, node_id],
      );
      const prevStreak = existing[0]?.correct_streak ?? 0;
      const prevWrong = existing[0]?.wrong_count ?? 0;
      const newStreak = correct ? prevStreak + 1 : 0;
      const newWrong = correct ? prevWrong : prevWrong + 1;
      const idx = correct ? Math.min(newStreak, minutesByStreak.length - 1) : 0;
      const minutes = minutesByStreak[idx];
      await client.query(
        `INSERT INTO node_quiz_state
           (user_id, node_id, correct_streak, wrong_count, last_seen_at, next_due_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW() + ($5 * INTERVAL '1 minute'))
         ON CONFLICT (user_id, node_id) DO UPDATE SET
           correct_streak = EXCLUDED.correct_streak,
           wrong_count    = EXCLUDED.wrong_count,
           last_seen_at   = EXCLUDED.last_seen_at,
           next_due_at    = EXCLUDED.next_due_at`,
        [uid, node_id, newStreak, newWrong, minutes],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const { rows: ch } = await pool.query<{ title: string | null; body_md: string }>(
      `SELECT title, body_md FROM opening_chapter WHERE node_id = $1`,
      [node_id],
    );
    return {
      correct,
      expected_san: n[0].san,
      chapter: ch[0] ?? null,
    };
  });

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

  // ─── Tactical sets ───────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/api/student/studies/tactic/:id',
    { preHandler: requireUser },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const access = await pool.query(
        `SELECT 1 FROM tactic_set ts
          WHERE ts.id = $1
            AND (ts.owner_id = $2
                 OR EXISTS(SELECT 1 FROM assignment a
                            WHERE a.assignee_id = $2 AND a.study_kind = 'tactic' AND a.study_id = $1))`,
        [id, uid],
      );
      if (!access.rowCount) return reply.code(404).send({ error: 'not assigned' });
      const { rows: s } = await pool.query<{ id: number; name: string }>(
        `SELECT id, name FROM tactic_set WHERE id = $1`,
        [id],
      );
      const { rows: puzzles } = await pool.query<{
        id: number;
        ord: number;
        fen: string;
        solution_san: string[];
        comment_md: string;
      }>(
        `SELECT id, ord, fen, solution_san, comment_md FROM tactic_puzzle
          WHERE set_id = $1 ORDER BY ord, id`,
        [id],
      );
      const { rows: solved } = await pool.query<{ puzzle_id: number }>(
        `SELECT DISTINCT puzzle_id FROM tactic_attempt
          WHERE user_id = $1 AND correct = TRUE AND puzzle_id = ANY($2)`,
        [uid, puzzles.map((p) => p.id)],
      );
      return {
        ...s[0],
        puzzles,
        solved_ids: solved.map((r) => r.puzzle_id),
      };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { puzzle_id: number; correct: boolean };
  }>(
    '/api/student/studies/tactic/:id/attempt',
    { preHandler: requireUser },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const { puzzle_id, correct } = req.body ?? ({} as never);
      if (!puzzle_id || typeof correct !== 'boolean')
        return reply.code(400).send({ error: 'missing fields' });
      // Verify the puzzle belongs to the set, and the student has access
      // (assignment or ownership).
      const access = await pool.query(
        `SELECT 1 FROM tactic_puzzle p
           JOIN tactic_set ts ON ts.id = p.set_id
          WHERE p.id = $1 AND ts.id = $2
            AND (ts.owner_id = $3
                 OR EXISTS(SELECT 1 FROM assignment a
                            WHERE a.assignee_id = $3 AND a.study_kind = 'tactic' AND a.study_id = ts.id))`,
        [puzzle_id, id, uid],
      );
      if (!access.rowCount) return reply.code(404).send({ error: 'not found' });
      await pool.query(
        `INSERT INTO tactic_attempt (user_id, puzzle_id, correct) VALUES ($1, $2, $3)`,
        [uid, puzzle_id, correct],
      );
      return { ok: true };
    },
  );
}
