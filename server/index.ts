import Fastify from 'fastify';
import cors from '@fastify/cors';
import { makePool, ensureSchema, epdFromFen, type MoveRow } from './db.js';

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

const pool = makePool();
await ensureSchema(pool);

app.get('/api/health', async () => {
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM game');
  return { ok: true, games: Number(rows[0]?.count ?? 0) };
});

app.get<{ Querystring: { fen?: string } }>('/api/explorer', async (req, reply) => {
  const fen = req.query.fen;
  if (!fen) return reply.code(400).send({ error: 'missing fen' });
  const epd = epdFromFen(fen);
  const { rows } = await pool.query<MoveRow>(
    `SELECT san, uci, child_fen, games, white_wins, draws, black_wins, rating_sum, rating_n
       FROM move
      WHERE parent_fen = $1
      ORDER BY games DESC`,
    [epd],
  );
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
    games: totals.games,
    white: totals.white,
    draws: totals.draws,
    black: totals.black,
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
});

const port = Number(process.env.PORT ?? 5174);
await app.listen({ port, host: '127.0.0.1' });
console.log(`openings backend on http://127.0.0.1:${port}`);
