import Fastify from 'fastify';
import cors from '@fastify/cors';
import { makePool, ensureSchema, epdFromFen } from './db.js';

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

const pool = makePool();
await ensureSchema(pool);

interface ExplorerQuery {
  fen?: string;
  white_id?: string;
  black_id?: string;
  player_id?: string;
  color?: 'white' | 'black' | 'any';
}

app.get('/api/health', async () => {
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM game');
  const { rows: prows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM player WHERE origin = 'fide'",
  );
  return { ok: true, games: Number(rows[0]?.count ?? 0), fide_players: Number(prows[0]?.count ?? 0) };
});

app.get<{ Querystring: { q?: string; limit?: string } }>(
  '/api/players',
  async (req, reply) => {
    const q = (req.query.q ?? '').trim();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '10', 10) || 10));
    if (q.length < 2) return { players: [] };
    // Combine prefix match + trigram similarity; prefer entries that have games.
    const { rows } = await pool.query<{
      fide_id: number;
      name: string;
      country: string | null;
      title: string | null;
      rating: number | null;
      games: string;
    }>(
      `WITH base AS (
         SELECT p.fide_id, p.name, p.country, p.title, p.rating,
                similarity(p.name, $1) AS sim
           FROM player p
          WHERE p.name ILIKE $2 OR p.name % $1
       ),
       counted AS (
         SELECT b.*,
                COALESCE(
                  (SELECT COUNT(*) FROM game g
                     WHERE g.white_fide_id = b.fide_id OR g.black_fide_id = b.fide_id),
                  0)::text AS games
           FROM base b
       )
       SELECT * FROM counted
        ORDER BY games::bigint DESC, sim DESC, name ASC
        LIMIT $3`,
      [q, `${q}%`, limit],
    );
    return {
      players: rows.map((r) => ({
        fide_id: r.fide_id,
        name: r.name,
        country: r.country,
        title: r.title,
        rating: r.rating,
        games: Number(r.games),
      })),
    };
  },
);

app.get<{ Querystring: ExplorerQuery }>('/api/explorer', async (req, reply) => {
  const fen = req.query.fen;
  if (!fen) return reply.code(400).send({ error: 'missing fen' });
  const epd = epdFromFen(fen);

  const playerId = req.query.player_id ? parseInt(req.query.player_id, 10) : null;
  const whiteId = req.query.white_id ? parseInt(req.query.white_id, 10) : null;
  const blackId = req.query.black_id ? parseInt(req.query.black_id, 10) : null;
  const color = req.query.color ?? 'any';

  const noFilter = playerId == null && whiteId == null && blackId == null;

  // Fast path: precomputed (parent_fen, san) aggregates. A whole-DB explorer
  // query becomes a single indexed lookup — ms-class even at 10M+ games.
  if (noFilter) {
    let rows: Array<{
      san: string;
      uci: string;
      child_fen: string;
      games: string;
      white_wins: string;
      draws: string;
      black_wins: string;
      rating_sum: string;
      rating_n: string;
    }> = [];
    try {
      const r = await pool.query(
        `SELECT san, uci, child_fen, games, white_wins, draws, black_wins, rating_sum, rating_n
           FROM move_stats
          WHERE parent_fen = $1
          ORDER BY games DESC`,
        [epd],
      );
      rows = r.rows as typeof rows;
    } catch {
      // move_stats not built yet — fall through to live aggregation.
      rows = [];
    }

    if (rows.length > 0) {
      const totals = rows.reduce(
        (acc, r) => ({
          games: acc.games + Number(r.games),
          white: acc.white + Number(r.white_wins),
          draws: acc.draws + Number(r.draws),
          black: acc.black + Number(r.black_wins),
        }),
        { games: 0, white: 0, draws: 0, black: 0 },
      );
      return {
        fen,
        epd,
        ...totals,
        moves: rows.map((r) => {
          const ratingN = Number(r.rating_n);
          const ratingSum = Number(r.rating_sum);
          return {
            san: r.san,
            uci: r.uci,
            child_fen: r.child_fen,
            games: Number(r.games),
            white: Number(r.white_wins),
            draws: Number(r.draws),
            black: Number(r.black_wins),
            avg_elo: ratingN > 0 ? Math.round(ratingSum / ratingN) : null,
          };
        }),
      };
    }
  }

  // Filtered path (or no precomputed stats yet) — live aggregation.
  const where: string[] = ['gm.parent_fen = $1'];
  const params: unknown[] = [epd];
  let p = 2;

  if (whiteId != null) {
    where.push(`g.white_fide_id = $${p++}`);
    params.push(whiteId);
  }
  if (blackId != null) {
    where.push(`g.black_fide_id = $${p++}`);
    params.push(blackId);
  }
  if (playerId != null) {
    if (color === 'white') {
      where.push(`g.white_fide_id = $${p++}`);
      params.push(playerId);
    } else if (color === 'black') {
      where.push(`g.black_fide_id = $${p++}`);
      params.push(playerId);
    } else {
      where.push(`(g.white_fide_id = $${p} OR g.black_fide_id = $${p})`);
      params.push(playerId);
      p++;
    }
  }

  const sql = `
    SELECT gm.san, gm.uci, gm.child_fen,
           COUNT(*)::text                                        AS games,
           SUM((g.result = 'W')::int)::text                      AS white_wins,
           SUM((g.result = 'D')::int)::text                      AS draws,
           SUM((g.result = 'B')::int)::text                      AS black_wins,
           AVG(NULLIF(
             CASE WHEN gm.ply % 2 = 1 THEN g.white_elo ELSE g.black_elo END
           , 0))::int                                            AS avg_elo
      FROM game_move gm
      JOIN game g ON g.id = gm.game_id
     WHERE ${where.join(' AND ')}
     GROUP BY gm.san, gm.uci, gm.child_fen
     ORDER BY COUNT(*) DESC`;

  const { rows } = await pool.query<{
    san: string;
    uci: string;
    child_fen: string;
    games: string;
    white_wins: string;
    draws: string;
    black_wins: string;
    avg_elo: number | null;
  }>(sql, params);

  const totals = rows.reduce(
    (acc, r) => ({
      games: acc.games + Number(r.games),
      white: acc.white + Number(r.white_wins),
      draws: acc.draws + Number(r.draws),
      black: acc.black + Number(r.black_wins),
    }),
    { games: 0, white: 0, draws: 0, black: 0 },
  );

  return {
    fen,
    epd,
    ...totals,
    moves: rows.map((r) => ({
      san: r.san,
      uci: r.uci,
      child_fen: r.child_fen,
      games: Number(r.games),
      white: Number(r.white_wins),
      draws: Number(r.draws),
      black: Number(r.black_wins),
      avg_elo: r.avg_elo,
    })),
  };
});

const port = Number(process.env.PORT ?? 5174);
await app.listen({ port, host: '127.0.0.1' });
console.log(`openings backend on http://127.0.0.1:${port}`);
