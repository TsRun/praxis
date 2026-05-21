import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import {
  sendStudentLinkedEmail,
  sendAssignmentEmail,
  sendInviteEmail,
} from './email.js';
import { requireTrainer, requireAuthor } from './auth-guards.js';
import {
  parsePgnWithVariations,
  type PgnNode,
  type PgnChapter,
} from './pgn-tree.js';
import { parsePgn } from './pgn.js';
import {
  fetchChessComGames,
  fetchLichessUserGames,
  reconstructBaseGames,
  filterPgnGames,
  type PostFilters,
  type TimeControlBucket,
} from './import-sources.js';
import { Chess } from 'chess.js';

/** Validate a solution line against a starting FEN; returns the cleaned SAN
 * array (re-serialized by chess.js so castling notation etc. is canonical),
 * or throws an Error if the FEN is bad or any move is illegal. chess.js
 * throws on illegal moves rather than returning null, so we re-wrap with a
 * stable error prefix the client can rely on. */
function validateSolution(fen: string, sans: string[]): string[] {
  let c: Chess;
  try {
    c = new Chess(fen);
  } catch (e) {
    throw new Error(`invalid FEN: ${(e as Error).message}`);
  }
  if (sans.length === 0) throw new Error('solution must have at least one move');
  const cleaned: string[] = [];
  for (const san of sans) {
    let m;
    try {
      m = c.move(san);
    } catch {
      m = null;
    }
    if (!m) throw new Error(`illegal move: ${san}`);
    cleaned.push(m.san);
  }
  return cleaned;
}


export async function trainerRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  // ─── Roster ──────────────────────────────────────────────────────────────
  // Link by nickname: the student must already be signed up. We look up
  // app_user rows by case-insensitive exact name match and link the trainer to
  // them. On ambiguous nickname we 409 without disclosing the candidate set
  // (knowing other users' ids/names was a bulk-enumeration vector). The
  // `user_id` form is rejected — trainers must use the nickname their student
  // actually picked.
  app.post<{ Body: { name?: string } }>(
    '/api/trainer/invites',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.user!.id;
      const name = (req.body?.name ?? '').trim();
      if (!name) return reply.code(400).send({ error: 'nickname required' });

      const r = await pool.query<{ id: number; name: string; email: string }>(
        `SELECT id, name, email FROM app_user
          WHERE LOWER(name) = LOWER($1) AND id <> $2
          ORDER BY id ASC LIMIT 2`,
        [name, trainerId],
      );
      if (r.rows.length === 0) {
        return reply.code(404).send({
          error: `no signed-in user with nickname "${name}"`,
        });
      }
      if (r.rows.length > 1) {
        return reply.code(409).send({
          error: `multiple users share that nickname — ask your student to set a unique one`,
        });
      }
      const candidate = r.rows[0];

      await pool.query(
        `INSERT INTO mentor (trainer_user_id, student_user_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
        [trainerId, candidate.id],
      );
      await pool.query(
        `UPDATE app_user SET roles = ARRAY(SELECT DISTINCT unnest(roles || ARRAY['student'])) WHERE id = $1`,
        [candidate.id],
      );

      const tr = await pool.query<{ name: string }>(
        'SELECT name FROM app_user WHERE id = $1',
        [trainerId],
      );
      try {
        await sendStudentLinkedEmail({
          to: candidate.email,
          trainerName: tr.rows[0]?.name ?? 'A trainer',
          studentName: candidate.name,
        });
      } catch (e) {
        console.warn('[invite/link] email failed:', (e as Error).message);
      }
      return {
        ok: true,
        mode: 'linked-existing',
        student_user_id: candidate.id,
      };
    },
  );

  // Invite by email. Creates an invite row + token, emails the magic link.
  // Used when no signed-in user matches the nickname.
  app.post<{ Body: { email?: string; name?: string } }>(
    '/api/trainer/invites/email',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.user!.id;
      const email = (req.body?.email ?? '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return reply.code(400).send({ error: 'valid email required' });
      }
      const suggested = (email.split('@')[0] ?? '')
        .replace(/[^a-zA-Z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);
      const studentName =
        (req.body?.name ?? '').trim() || suggested || 'student';

      // If a user with this email already exists, prefer linking directly
      // instead of issuing a magic link they won't need.
      const existing = await pool.query<{
        id: number;
        name: string;
        email: string;
      }>('SELECT id, name, email FROM app_user WHERE LOWER(email) = $1', [email]);
      if (existing.rows[0]) {
        const user = existing.rows[0];
        await pool.query(
          `INSERT INTO mentor (trainer_user_id, student_user_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
          [trainerId, user.id],
        );
        await pool.query(
          `UPDATE app_user SET roles = ARRAY(SELECT DISTINCT unnest(roles || ARRAY['student'])) WHERE id = $1`,
          [user.id],
        );
        const tr = await pool.query<{ name: string }>(
          'SELECT name FROM app_user WHERE id = $1',
          [trainerId],
        );
        try {
          await sendStudentLinkedEmail({
            to: user.email,
            trainerName: tr.rows[0]?.name ?? 'A trainer',
            studentName: user.name,
          });
        } catch (e) {
          console.warn('[invite/email] linked-email failed:', (e as Error).message);
        }
        return { ok: true, mode: 'linked-existing', student_user_id: user.id };
      }

      const token = randomBytes(24).toString('base64url');
      await pool.query(
        `INSERT INTO invite (token, trainer_user_id, student_email, student_name, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '14 days')`,
        [token, trainerId, email, studentName],
      );
      const tr = await pool.query<{ name: string }>(
        'SELECT name FROM app_user WHERE id = $1',
        [trainerId],
      );
      try {
        await sendInviteEmail({
          to: email,
          trainerName: tr.rows[0]?.name ?? 'A trainer',
          studentName,
          token,
        });
      } catch (e) {
        console.warn('[invite/email] send failed:', (e as Error).message);
      }
      return { ok: true, mode: 'invited', token };
    },
  );

  app.get('/api/trainer/students', { preHandler: requireTrainer }, async (req) => {
    const trainerId = req.user!.id;
    const { rows } = await pool.query<{
      id: number;
      email: string;
      name: string;
      linked_at: string;
      assignment_count: string;
    }>(
      `SELECT u.id, u.email, u.name, m.linked_at,
              COALESCE((SELECT COUNT(*)::text FROM assignment a WHERE a.assignee_id = u.id), '0') AS assignment_count
         FROM mentor m
         JOIN app_user u ON u.id = m.student_user_id
        WHERE m.trainer_user_id = $1
        ORDER BY m.linked_at DESC`,
      [trainerId],
    );
    return rows.map((r) => ({ ...r, assignment_count: Number(r.assignment_count) }));
  });

  app.get<{ Params: { id: string } }>(
    '/api/trainer/students/:id',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.user!.id;
      const studentId = Number(req.params.id);
      const own = await pool.query(
        `SELECT 1 FROM mentor WHERE trainer_user_id = $1 AND student_user_id = $2`,
        [trainerId, studentId],
      );
      if (!own.rowCount) return reply.code(404).send({ error: 'not your student' });
      const { rows: u } = await pool.query(
        `SELECT id, email, name FROM app_user WHERE id = $1`,
        [studentId],
      );
      if (!u[0]) return reply.code(404).send({ error: 'not found' });
      const { rows: assignments } = await pool.query(
        `SELECT a.id, a.study_kind, a.study_id, a.assigned_at, a.completed_at,
                CASE a.study_kind
                  WHEN 'opening' THEN (SELECT name FROM opening_study WHERE id = a.study_id)
                  WHEN 'game'    THEN (SELECT name FROM game_study   WHERE id = a.study_id)
                  WHEN 'tactic'  THEN (SELECT name FROM tactic_set   WHERE id = a.study_id)
                END AS name
           FROM assignment a
          WHERE a.assignee_id = $1
          ORDER BY a.assigned_at DESC`,
        [studentId],
      );
      return { ...u[0], assignments };
    },
  );

  app.post<{ Params: { id: string }; Body: { study_kind: 'opening' | 'game' | 'tactic'; study_id: number } }>(
    '/api/trainer/students/:id/assignments',
    { preHandler: requireTrainer },
    async (req, reply) => {
      const trainerId = req.user!.id;
      const studentId = Number(req.params.id);
      const { study_kind, study_id } = req.body ?? ({} as never);
      if (!study_kind || !study_id) return reply.code(400).send({ error: 'missing fields' });
      if (!['opening', 'game', 'tactic'].includes(study_kind))
        return reply.code(400).send({ error: 'invalid study_kind' });
      const own = await pool.query(
        `SELECT 1 FROM mentor WHERE trainer_user_id = $1 AND student_user_id = $2`,
        [trainerId, studentId],
      );
      if (!own.rowCount) return reply.code(404).send({ error: 'not your student' });
      const ownStudyQuery =
        study_kind === 'opening'
          ? `SELECT 1 FROM opening_study WHERE id = $1 AND owner_id = $2`
          : study_kind === 'game'
            ? `SELECT 1 FROM game_study   WHERE id = $1 AND owner_id = $2`
            : `SELECT 1 FROM tactic_set   WHERE id = $1 AND owner_id = $2`;
      const ownStudy = await pool.query(ownStudyQuery, [study_id, trainerId]);
      if (!ownStudy.rowCount) return reply.code(404).send({ error: 'study not found' });
      const ins = await pool.query<{ id: number }>(
        `INSERT INTO assignment (assignee_id, study_kind, study_id) VALUES ($1, $2, $3)
           ON CONFLICT (assignee_id, study_kind, study_id) DO NOTHING
         RETURNING id`,
        [studentId, study_kind, study_id],
      );
      if (ins.rowCount === 0) {
        // Already assigned — don't spam an email.
        return { ok: true, already_assigned: true };
      }

      // Fetch trainer/student names + study name + student email for the
      // notification. Best effort — log and continue if the send fails.
      try {
        const studyTable =
          study_kind === 'opening' ? 'opening_study os' :
          study_kind === 'game'    ? 'game_study gs' :
                                     'tactic_set ts';
        const studyAlias = studyTable.split(' ')[1];
        const meta = await pool.query<{
          student_name: string;
          student_email: string;
          trainer_name: string;
          study_name: string;
        }>(
          `SELECT s.name AS student_name,
                  s.email AS student_email,
                  t.name AS trainer_name,
                  ${studyAlias}.name AS study_name
             FROM app_user s,
                  app_user t,
                  ${studyTable}
            WHERE s.id = $1
              AND t.id = $2
              AND ${studyAlias}.id = $3`,
          [studentId, trainerId, study_id],
        );
        const row = meta.rows[0];
        if (row) {
          await sendAssignmentEmail({
            to: row.student_email,
            studentName: row.student_name,
            trainerName: row.trainer_name,
            studyName: row.study_name,
            studyKind: study_kind,
            studyId: study_id,
          });
        }
      } catch (e) {
        console.warn('[assign] notification email failed:', (e as Error).message);
      }
      return { ok: true };
    },
  );

  // ─── Opening studies (author = trainer or self-trainer) ──────────────────
  app.get(
    '/api/trainer/studies/opening',
    { preHandler: requireAuthor },
    async (req) => {
      const uid = req.user!.id;
      const { rows } = await pool.query(
        `SELECT os.id, os.name, os.root_fen, os.eco, os.side, os.created_at, os.updated_at,
                COALESCE((SELECT COUNT(*)::text
                            FROM opening_chapter c
                            JOIN opening_node n ON n.id = c.node_id
                           WHERE n.study_id = os.id), '0') AS annotation_count
           FROM opening_study os
          WHERE os.owner_id = $1
          ORDER BY os.updated_at DESC`,
        [uid],
      );
      return rows.map((r) => ({ ...r, annotation_count: Number(r.annotation_count) }));
    },
  );

  app.post<{ Body: { name: string; root_fen: string; eco?: string; side: 'w' | 'b' } }>(
    '/api/trainer/studies/opening',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const { name, root_fen, eco, side } = req.body ?? ({} as never);
      if (!name || !root_fen || (side !== 'w' && side !== 'b'))
        return reply.code(400).send({ error: 'missing fields' });
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO opening_study (owner_id, name, root_fen, eco, side)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [uid, name, root_fen, eco ?? null, side],
      );
      // If user has the 'self' role, auto-assign the study to themselves
      if (req.user!.roles.includes('self')) {
        await pool.query(
          `INSERT INTO assignment (assignee_id, study_kind, study_id) VALUES ($1, 'opening', $2)
             ON CONFLICT DO NOTHING`,
          [uid, rows[0].id],
        );
      }
      return { id: rows[0].id };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/trainer/studies/opening/:id',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const { rows } = await pool.query<{
        id: number;
        name: string;
        root_fen: string;
        eco: string | null;
        side: 'w' | 'b';
      }>(
        `SELECT id, name, root_fen, eco, side FROM opening_study WHERE id = $1 AND owner_id = $2`,
        [id, uid],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'not found' });
      const nodes = await pool.query(
        `SELECT id, parent_id, parent_fen, san, uci, fen, ply, is_main
           FROM opening_node WHERE study_id = $1 ORDER BY ply ASC, id ASC`,
        [id],
      );
      const chapters = await pool.query(
        `SELECT c.node_id, c.title, c.body_md
           FROM opening_chapter c
           JOIN opening_node n ON n.id = c.node_id
          WHERE n.study_id = $1`,
        [id],
      );
      return { ...rows[0], nodes: nodes.rows, chapters: chapters.rows };
    },
  );

  // Upsert a node by (study, parent, san). The trainer's "make a move on
  // the board" handler calls this — if the child already exists we just
  // return its id so navigation is idempotent.
  app.post<{
    Params: { id: string };
    Body: {
      parent_id: number | null;
      parent_fen: string;
      san: string;
      uci: string;
      fen: string;
      ply: number;
    };
  }>('/api/trainer/studies/opening/:id/nodes', { preHandler: requireAuthor }, async (req, reply) => {
    const uid = req.user!.id;
    const id = Number(req.params.id);
    const owns = await pool.query(`SELECT 1 FROM opening_study WHERE id = $1 AND owner_id = $2`, [id, uid]);
    if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
    const { parent_id, parent_fen, san, uci, fen, ply } = req.body ?? ({} as never);
    if (!san || !uci || !parent_fen || !fen || ply == null) {
      return reply.code(400).send({ error: 'missing fields' });
    }
    if (parent_id != null) {
      const p = await pool.query(
        `SELECT 1 FROM opening_node WHERE id = $1 AND study_id = $2`,
        [parent_id, id],
      );
      if (!p.rowCount) return reply.code(400).send({ error: 'parent_id not in this study' });
    }
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM opening_node
        WHERE study_id = $1
          AND parent_id IS NOT DISTINCT FROM $2
          AND san = $3`,
      [id, parent_id, san],
    );
    if (existing.rowCount) {
      return { id: existing.rows[0].id, created: false };
    }
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO opening_node (study_id, parent_id, parent_fen, san, uci, fen, ply)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [id, parent_id, parent_fen, san, uci, fen, ply],
    );
    await pool.query(`UPDATE opening_study SET updated_at = NOW() WHERE id = $1`, [id]);
    return { id: rows[0].id, created: true };
  });

  app.delete<{ Params: { id: string; nid: string } }>(
    '/api/trainer/studies/opening/:id/nodes/:nid',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const nid = Number(req.params.nid);
      const owns = await pool.query(`SELECT 1 FROM opening_study WHERE id = $1 AND owner_id = $2`, [id, uid]);
      if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
      // CASCADE deletes children + chapter + quiz_state via FK
      await pool.query(`DELETE FROM opening_node WHERE id = $1 AND study_id = $2`, [nid, id]);
      await pool.query(`UPDATE opening_study SET updated_at = NOW() WHERE id = $1`, [id]);
      return { ok: true };
    },
  );

  app.put<{
    Params: { id: string; nid: string };
    Body: { is_main?: boolean };
  }>('/api/trainer/studies/opening/:id/nodes/:nid', { preHandler: requireAuthor }, async (req, reply) => {
    const uid = req.user!.id;
    const id = Number(req.params.id);
    const nid = Number(req.params.nid);
    const owns = await pool.query(`SELECT 1 FROM opening_study WHERE id = $1 AND owner_id = $2`, [id, uid]);
    if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
    if (req.body?.is_main != null) {
      // Mark as main and clear is_main on its siblings (only one main
      // line per parent at a time).
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (req.body.is_main) {
          const { rows: ns } = await client.query<{ parent_id: number | null }>(
            `SELECT parent_id FROM opening_node WHERE id = $1 AND study_id = $2`,
            [nid, id],
          );
          if (ns[0]) {
            await client.query(
              `UPDATE opening_node SET is_main = false
                WHERE study_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
              [id, ns[0].parent_id],
            );
          }
        }
        await client.query(
          `UPDATE opening_node SET is_main = $1 WHERE id = $2 AND study_id = $3`,
          [req.body.is_main, nid, id],
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    return { ok: true };
  });

  // Upsert the chapter for a single node.
  app.put<{
    Params: { id: string; nid: string };
    Body: { title: string | null; body_md: string };
  }>('/api/trainer/studies/opening/:id/nodes/:nid/chapter', { preHandler: requireAuthor }, async (req, reply) => {
    const uid = req.user!.id;
    const id = Number(req.params.id);
    const nid = Number(req.params.nid);
    const owns = await pool.query(
      `SELECT 1 FROM opening_node n
        JOIN opening_study s ON s.id = n.study_id
       WHERE n.id = $1 AND s.id = $2 AND s.owner_id = $3`,
      [nid, id, uid],
    );
    if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
    const { title, body_md } = req.body ?? ({} as never);
    await pool.query(
      `INSERT INTO opening_chapter (node_id, title, body_md, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (node_id) DO UPDATE SET title = EXCLUDED.title,
                                            body_md = EXCLUDED.body_md,
                                            updated_at = NOW()`,
      [nid, title ?? null, body_md ?? ''],
    );
    return { ok: true };
  });

  // ─── Game studies (author = trainer or self-trainer) ─────────────────────
  app.get('/api/trainer/studies/game', { preHandler: requireAuthor }, async (req) => {
    const uid = req.user!.id;
    const { rows } = await pool.query(
      `SELECT gs.id, gs.name, gs.headers_json, gs.created_at, gs.updated_at,
              COALESCE((SELECT COUNT(*)::text FROM game_annotation a WHERE a.study_id = gs.id), '0') AS annotation_count
         FROM game_study gs WHERE gs.owner_id = $1 ORDER BY gs.updated_at DESC`,
      [uid],
    );
    return rows.map((r) => ({ ...r, annotation_count: Number(r.annotation_count) }));
  });

  app.post<{ Body: { name: string; pgn: string } }>(
    '/api/trainer/studies/game',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const { name, pgn } = req.body ?? ({} as never);
      if (!name || !pgn) return reply.code(400).send({ error: 'missing fields' });
      const parsed = parsePgn(pgn);
      if (!parsed) return reply.code(400).send({ error: 'invalid PGN' });
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO game_study (owner_id, name, pgn, headers_json)
           VALUES ($1, $2, $3, $4) RETURNING id`,
        [uid, name, pgn, parsed.headers],
      );
      if (req.user!.roles.includes('self')) {
        await pool.query(
          `INSERT INTO assignment (assignee_id, study_kind, study_id) VALUES ($1, 'game', $2)
             ON CONFLICT DO NOTHING`,
          [uid, rows[0].id],
        );
      }
      return { id: rows[0].id };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/trainer/studies/game/:id',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const { rows } = await pool.query<{
        id: number;
        name: string;
        pgn: string;
        headers_json: Record<string, string>;
      }>(
        `SELECT id, name, pgn, headers_json FROM game_study WHERE id = $1 AND owner_id = $2`,
        [id, uid],
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
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const owns = await pool.query(`SELECT 1 FROM game_study WHERE id = $1 AND owner_id = $2`, [id, uid]);
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

  // ── Lichess study import (paste-PGN) ──────────────────────────────────────

  app.post<{ Params: { id: string }; Body: { pgn?: string } }>(
    '/api/trainer/studies/opening/:id/import-preview',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const studyId = Number(req.params.id);
      const pgn = (req.body?.pgn ?? '').trim();
      if (!pgn) return reply.code(400).send({ error: 'pgn is required' });
      const { rows } = await pool.query<{ root_fen: string }>(
        `SELECT root_fen FROM opening_study WHERE id = $1 AND owner_id = $2`,
        [studyId, uid],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'not found' });
      const studyRoot = rows[0].root_fen?.split(' ').slice(0, 4).join(' ') ?? '';
      let chapters: PgnChapter[];
      try {
        chapters = parsePgnWithVariations(pgn);
      } catch (e) {
        return reply.code(400).send({ error: `parse failed: ${(e as Error).message}` });
      }
      return {
        chapters: chapters.map((c) => ({
          index: c.index,
          name: c.headers.Event ?? c.headers.Site ?? `Chapter ${c.index + 1}`,
          mainline_move_count: countMainline(c.root),
          root_fen: c.root_fen,
          matches_study_root: c.root_fen === studyRoot,
        })),
      };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { pgn?: string; chapter_indexes?: number[] };
  }>(
    '/api/trainer/studies/opening/:id/import',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const studyId = Number(req.params.id);
      const pgn = (req.body?.pgn ?? '').trim();
      const picks = new Set(req.body?.chapter_indexes ?? []);
      if (!pgn) return reply.code(400).send({ error: 'pgn is required' });
      if (picks.size === 0) return reply.code(400).send({ error: 'chapter_indexes empty' });

      const { rows } = await pool.query<{ root_fen: string }>(
        `SELECT root_fen FROM opening_study WHERE id = $1 AND owner_id = $2`,
        [studyId, uid],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'not found' });
      const studyRoot = rows[0].root_fen?.split(' ').slice(0, 4).join(' ') ?? '';

      const chapters = parsePgnWithVariations(pgn);
      let imported_chapters = 0;
      let imported_nodes = 0;
      let reused_nodes = 0;
      const skipped: { kind: string; name?: string; reason: string }[] = [];

      for (const ch of chapters) {
        if (!picks.has(ch.index)) continue;
        if (ch.root_fen !== studyRoot) {
          skipped.push({
            kind: 'fen-mismatch',
            name: ch.headers.Event ?? `Chapter ${ch.index + 1}`,
            reason: `starts from ${ch.root_fen}`,
          });
          continue;
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await importChapter(client, studyId, ch, skipped);
          imported_chapters++;
          imported_nodes += result.created;
          reused_nodes += result.reused;
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          skipped.push({
            kind: 'parse-error',
            name: ch.headers.Event ?? `Chapter ${ch.index + 1}`,
            reason: (e as Error).message,
          });
        } finally {
          client.release();
        }
      }

      await pool.query(`UPDATE opening_study SET updated_at = NOW() WHERE id = $1`, [studyId]);
      return { imported_chapters, imported_nodes, reused_nodes, skipped };
    },
  );

  // ─── Multi-source import: Chess.com, Lichess user games, OTB database ────
  // Each endpoint produces a PGN string and runs it through the same
  // preview parser as /import-preview so the client can show the chapter
  // picker and then POST back to the existing /import endpoint.

  async function previewChaptersForStudy(
    studyId: number,
    uid: number,
    pgn: string,
  ): Promise<
    | { ok: true; chapters: ReturnType<typeof previewShape>[]; root: string }
    | { notFound: true }
  > {
    const { rows } = await pool.query<{ root_fen: string }>(
      `SELECT root_fen FROM opening_study WHERE id = $1 AND owner_id = $2`,
      [studyId, uid],
    );
    if (!rows[0]) return { notFound: true };
    const studyRoot = rows[0].root_fen?.split(' ').slice(0, 4).join(' ') ?? '';
    const chapters = parsePgnWithVariations(pgn);
    return {
      ok: true,
      root: studyRoot,
      chapters: chapters.map((c) => previewShape(c, studyRoot)),
    };
  }

  function previewShape(c: PgnChapter, studyRoot: string) {
    return {
      index: c.index,
      name: c.headers.Event ?? c.headers.Site ?? `Chapter ${c.index + 1}`,
      mainline_move_count: countMainline(c.root),
      root_fen: c.root_fen,
      matches_study_root: c.root_fen === studyRoot,
    };
  }

  interface FetchFilterBody {
    color?: 'white' | 'black' | 'either';
    result?: string[];
    eco?: string;
    min_elo?: number;
    time_control?: TimeControlBucket[];
    position_fen?: string;
  }

  function bodyToPostFilters(b: FetchFilterBody | undefined, player?: string): PostFilters {
    if (!b) return { player };
    return {
      color: b.color,
      player,
      results: Array.isArray(b.result) ? b.result : undefined,
      eco: b.eco?.trim() || undefined,
      minElo: typeof b.min_elo === 'number' && b.min_elo > 0 ? b.min_elo : undefined,
      timeControls: Array.isArray(b.time_control) ? b.time_control : undefined,
      positionFen: b.position_fen?.trim() || undefined,
    };
  }

  app.post<{
    Params: { id: string };
    Body: { username?: string } & FetchFilterBody;
  }>(
    '/api/trainer/studies/opening/:id/fetch-chesscom',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const studyId = Number(req.params.id);
      const username = (req.body?.username ?? '').trim();
      if (!username) return reply.code(400).send({ error: 'username required' });
      let pgn: string;
      try {
        // Internal cap lives in import-sources.ts; trainers can't bump it.
        pgn = await fetchChessComGames(username);
      } catch (e) {
        return reply.code(502).send({ error: (e as Error).message });
      }
      pgn = filterPgnGames(pgn, bodyToPostFilters(req.body));
      const result = await previewChaptersForStudy(studyId, uid, pgn);
      if ('notFound' in result) return reply.code(404).send({ error: 'not found' });
      return { pgn, chapters: result.chapters };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { username?: string } & FetchFilterBody;
  }>(
    '/api/trainer/studies/opening/:id/fetch-lichess',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const studyId = Number(req.params.id);
      const username = (req.body?.username ?? '').trim();
      if (!username) return reply.code(400).send({ error: 'username required' });
      let pgn: string;
      try {
        // Internal cap lives in import-sources.ts; trainers can't bump it.
        pgn = await fetchLichessUserGames(username);
      } catch (e) {
        return reply.code(502).send({ error: (e as Error).message });
      }
      pgn = filterPgnGames(pgn, bodyToPostFilters(req.body));
      const result = await previewChaptersForStudy(studyId, uid, pgn);
      if ('notFound' in result) return reply.code(404).send({ error: 'not found' });
      return { pgn, chapters: result.chapters };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { game_ids?: number[] };
  }>(
    '/api/trainer/studies/opening/:id/fetch-base',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const studyId = Number(req.params.id);
      const ids = (req.body?.game_ids ?? []).filter(
        (n): n is number => Number.isInteger(n) && n > 0,
      );
      if (ids.length === 0) return reply.code(400).send({ error: 'game_ids empty' });
      if (ids.length > 200) return reply.code(400).send({ error: 'too many ids (max 200)' });
      let pgn: string;
      try {
        pgn = await reconstructBaseGames(pool, ids);
      } catch (e) {
        return reply.code(502).send({ error: (e as Error).message });
      }
      const result = await previewChaptersForStudy(studyId, uid, pgn);
      if ('notFound' in result) return reply.code(404).send({ error: 'not found' });
      return { pgn, chapters: result.chapters };
    },
  );

  app.get<{
    Querystring: {
      player?: string;
      color?: string;
      year_from?: string;
      year_to?: string;
      result?: string;
      eco?: string;
      min_elo?: string;
      position_fen?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    '/api/trainer/games',
    { preHandler: requireAuthor },
    async (req) => {
      const q = req.query;
      const player = (q.player ?? '').trim();
      const color = q.color === 'white' || q.color === 'black' ? q.color : null;
      const yearFrom = q.year_from ? Number(q.year_from) : null;
      const yearTo = q.year_to ? Number(q.year_to) : null;
      const minElo = q.min_elo ? Number(q.min_elo) : null;
      const positionFen = (q.position_fen ?? '').trim();
      const eco = (q.eco ?? '').trim();
      // result is sent as `1-0,0-1,1/2-1/2`. Internally the DB stores one of
      // '1' | '0' | 'd' | '=' so we normalize the client tokens here.
      const resultTokens = (q.result ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const dbResults: string[] = [];
      for (const t of resultTokens) {
        if (t === '1-0') dbResults.push('1');
        else if (t === '0-1') dbResults.push('0');
        else if (t === '1/2-1/2') dbResults.push('d');
      }
      const limit = Math.min(200, Math.max(1, Number(q.limit ?? 50) || 50));
      const offset = Math.max(0, Number(q.offset ?? 0) || 0);

      const conds: string[] = [];
      const vals: unknown[] = [];
      function bind(v: unknown) {
        vals.push(v);
        return `$${vals.length}`;
      }
      if (player) {
        if (color === 'white') conds.push(`white_name ILIKE '%' || ${bind(player)} || '%'`);
        else if (color === 'black') conds.push(`black_name ILIKE '%' || ${bind(player)} || '%'`);
        else {
          const p = bind(player);
          conds.push(`(white_name ILIKE '%' || ${p} || '%' OR black_name ILIKE '%' || ${p} || '%')`);
        }
      } else if (color) {
        // color only is a no-op without a player; ignore.
      }
      if (yearFrom != null && Number.isFinite(yearFrom)) {
        conds.push(`LEFT(event_date, 4) ~ '^[0-9]{4}$' AND LEFT(event_date, 4)::int >= ${bind(yearFrom)}`);
      }
      if (yearTo != null && Number.isFinite(yearTo)) {
        conds.push(`LEFT(event_date, 4) ~ '^[0-9]{4}$' AND LEFT(event_date, 4)::int <= ${bind(yearTo)}`);
      }
      if (dbResults.length > 0) {
        // result is CHAR(1) — we accept both 'd' and '=' to mean draw.
        const placeholders = dbResults.map((r) => bind(r)).join(',');
        const drawCond = dbResults.includes('d') ? ` OR result = '='` : '';
        conds.push(`(result IN (${placeholders})${drawCond})`);
      }
      if (minElo != null && Number.isFinite(minElo)) {
        const m = bind(minElo);
        conds.push(`GREATEST(COALESCE(white_elo, 0), COALESCE(black_elo, 0)) >= ${m}`);
      }
      // The `game` table has no ECO column; the import process normally puts
      // the opening name into `event` so ILIKE on event is the best we can
      // do without a migration. Documented behavior — search "Sicilian" etc.
      if (eco) {
        conds.push(`event ILIKE '%' || ${bind(eco)} || '%'`);
      }
      if (positionFen) {
        // parent_fen is stored normalized to the first 4 FEN fields, matching
        // the import pipeline's convention. EXISTS is fast thanks to
        // idx_game_move_parent (see schema.sql).
        const f = bind(positionFen);
        conds.push(
          `EXISTS (SELECT 1 FROM game_move gm WHERE gm.game_id = game.id AND gm.parent_fen = ${f})`,
        );
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      const totalRes = await pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM game ${where}`,
        vals,
      );
      const total = Number(totalRes.rows[0]?.c ?? '0');

      const listVals = [...vals, limit, offset];
      const { rows } = await pool.query(
        `SELECT id::text AS id, white_name, black_name, event, event_date, result,
                white_elo, black_elo
           FROM game ${where}
           ORDER BY event_date DESC NULLS LAST, id DESC
           LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
        listVals,
      );
      return {
        games: rows.map((r) => ({ ...r, id: Number(r.id) })),
        total,
      };
    },
  );

  // ─── Tactical sets (author = trainer or self-trainer) ────────────────────
  app.get('/api/trainer/studies/tactic', { preHandler: requireAuthor }, async (req) => {
    const uid = req.user!.id;
    const { rows } = await pool.query(
      `SELECT ts.id, ts.name, ts.created_at, ts.updated_at,
              COALESCE((SELECT COUNT(*)::text FROM tactic_puzzle p WHERE p.set_id = ts.id), '0') AS puzzle_count
         FROM tactic_set ts WHERE ts.owner_id = $1 ORDER BY ts.updated_at DESC`,
      [uid],
    );
    return rows.map((r) => ({ ...r, puzzle_count: Number(r.puzzle_count) }));
  });

  app.post<{ Body: { name: string } }>(
    '/api/trainer/studies/tactic',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const name = req.body?.name?.trim();
      if (!name) return reply.code(400).send({ error: 'name is required' });
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO tactic_set (owner_id, name) VALUES ($1, $2) RETURNING id`,
        [uid, name],
      );
      if (req.user!.roles.includes('self')) {
        await pool.query(
          `INSERT INTO assignment (assignee_id, study_kind, study_id) VALUES ($1, 'tactic', $2)
             ON CONFLICT DO NOTHING`,
          [uid, rows[0].id],
        );
      }
      return { id: rows[0].id };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/trainer/studies/tactic/:id',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const { rows: s } = await pool.query<{
        id: number;
        name: string;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT id, name, created_at, updated_at FROM tactic_set
          WHERE id = $1 AND owner_id = $2`,
        [id, uid],
      );
      if (!s[0]) return reply.code(404).send({ error: 'not found' });
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
      return { ...s[0], puzzles };
    },
  );

  app.put<{ Params: { id: string }; Body: { name: string } }>(
    '/api/trainer/studies/tactic/:id',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const name = req.body?.name?.trim();
      if (!name) return reply.code(400).send({ error: 'name is required' });
      const { rowCount } = await pool.query(
        `UPDATE tactic_set SET name = $1, updated_at = NOW()
          WHERE id = $2 AND owner_id = $3`,
        [name, id, uid],
      );
      if (!rowCount) return reply.code(404).send({ error: 'not found' });
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/trainer/studies/tactic/:id',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const id = Number(req.params.id);
      const { rowCount } = await pool.query(
        `DELETE FROM tactic_set WHERE id = $1 AND owner_id = $2`,
        [id, uid],
      );
      if (!rowCount) return reply.code(404).send({ error: 'not found' });
      return { ok: true };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { fen: string; solution_san: string[]; comment_md?: string };
  }>(
    '/api/trainer/studies/tactic/:id/puzzles',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const setId = Number(req.params.id);
      const { fen, solution_san, comment_md } = req.body ?? ({} as never);
      if (!fen || !Array.isArray(solution_san))
        return reply.code(400).send({ error: 'fen and solution_san are required' });
      const owns = await pool.query(
        `SELECT 1 FROM tactic_set WHERE id = $1 AND owner_id = $2`,
        [setId, uid],
      );
      if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
      let cleaned: string[];
      try {
        cleaned = validateSolution(fen, solution_san);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const next = await pool.query<{ ord: number }>(
        `SELECT COALESCE(MAX(ord), 0) + 1 AS ord FROM tactic_puzzle WHERE set_id = $1`,
        [setId],
      );
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO tactic_puzzle (set_id, ord, fen, solution_san, comment_md)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [setId, next.rows[0].ord, fen, cleaned, comment_md ?? ''],
      );
      await pool.query(`UPDATE tactic_set SET updated_at = NOW() WHERE id = $1`, [setId]);
      return { id: rows[0].id };
    },
  );

  app.put<{
    Params: { id: string; pid: string };
    Body: { fen: string; solution_san: string[]; comment_md?: string };
  }>(
    '/api/trainer/studies/tactic/:id/puzzles/:pid',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const setId = Number(req.params.id);
      const pid = Number(req.params.pid);
      const { fen, solution_san, comment_md } = req.body ?? ({} as never);
      if (!fen || !Array.isArray(solution_san))
        return reply.code(400).send({ error: 'fen and solution_san are required' });
      const owns = await pool.query(
        `SELECT 1 FROM tactic_set ts
           JOIN tactic_puzzle p ON p.set_id = ts.id
          WHERE ts.id = $1 AND ts.owner_id = $2 AND p.id = $3`,
        [setId, uid, pid],
      );
      if (!owns.rowCount) return reply.code(404).send({ error: 'not found' });
      let cleaned: string[];
      try {
        cleaned = validateSolution(fen, solution_san);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      await pool.query(
        `UPDATE tactic_puzzle SET fen = $1, solution_san = $2, comment_md = $3
          WHERE id = $4`,
        [fen, cleaned, comment_md ?? '', pid],
      );
      await pool.query(`UPDATE tactic_set SET updated_at = NOW() WHERE id = $1`, [setId]);
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string; pid: string } }>(
    '/api/trainer/studies/tactic/:id/puzzles/:pid',
    { preHandler: requireAuthor },
    async (req, reply) => {
      const uid = req.user!.id;
      const setId = Number(req.params.id);
      const pid = Number(req.params.pid);
      const { rowCount } = await pool.query(
        `DELETE FROM tactic_puzzle p
           USING tactic_set ts
          WHERE p.id = $1 AND p.set_id = ts.id
            AND ts.id = $2 AND ts.owner_id = $3`,
        [pid, setId, uid],
      );
      if (!rowCount) return reply.code(404).send({ error: 'not found' });
      await pool.query(`UPDATE tactic_set SET updated_at = NOW() WHERE id = $1`, [setId]);
      return { ok: true };
    },
  );
}

function countMainline(node: PgnNode | null): number {
  let n = 0;
  let cur: PgnNode | null = node;
  while (cur) { n++; cur = cur.children[0] ?? null; }
  return n;
}

async function importChapter(
  client: import('pg').PoolClient,
  studyId: number,
  ch: PgnChapter,
  skipped: { kind: string; name?: string; reason: string }[],
): Promise<{ created: number; reused: number }> {
  let created = 0;
  let reused = 0;
  let firstNewMainlineNodeId: number | null = null;

  async function visit(
    parentNodeId: number | null,
    parentFen: string,
    node: PgnNode,
    onMainlineSoFar: boolean,
  ): Promise<void> {
    const isMain = onMainlineSoFar && node.is_main;
    const { rows: existing } = await client.query<{ id: number; is_main: boolean }>(
      `SELECT id, is_main FROM opening_node
        WHERE study_id = $1
          AND parent_id IS NOT DISTINCT FROM $2
          AND san = $3`,
      [studyId, parentNodeId, node.san],
    );
    let nodeId: number;
    let wasCreated: boolean;
    if (existing.length > 0) {
      nodeId = existing[0].id;
      wasCreated = false;
      reused++;
      if (isMain && !existing[0].is_main) {
        await client.query(`UPDATE opening_node SET is_main = true WHERE id = $1`, [nodeId]);
      }
    } else {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO opening_node (study_id, parent_id, parent_fen, san, uci, fen, ply, is_main)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [studyId, parentNodeId, parentFen, node.san, node.uci, node.fen, node.ply, isMain],
      );
      nodeId = ins.rows[0].id;
      wasCreated = true;
      created++;
      if (isMain && firstNewMainlineNodeId === null) {
        firstNewMainlineNodeId = nodeId;
      }
    }
    void wasCreated;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      await visit(nodeId, node.fen, child, isMain && i === 0);
    }
  }

  if (ch.root) {
    await visit(null, ch.root_fen, ch.root, true);
  }

  if (firstNewMainlineNodeId !== null) {
    const title = ch.headers.Event ?? ch.headers.Site ?? null;
    if (title) {
      const exists = await client.query(
        `SELECT 1 FROM opening_chapter WHERE node_id = $1`,
        [firstNewMainlineNodeId],
      );
      if (exists.rowCount === 0) {
        await client.query(
          `INSERT INTO opening_chapter (node_id, title, body_md) VALUES ($1, $2, '')`,
          [firstNewMainlineNodeId, title],
        );
      }
    }
  }
  return { created, reused };
}
