import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireUser } from './auth-guards.js';

const querySchema = z.object({
  country: z.string().length(3).optional(), // FIDE 3-letter code; default FRA
  region: z.string().optional(),
  cadence: z.enum(['classic', 'rapid', 'blitz']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().optional(),
  sort: z.enum(['date', 'name', 'region']).default('date'),
});

export async function tournamentRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  app.get('/api/tournaments', { preHandler: requireUser }, async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const f = parsed.data;

    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, val: unknown) => {
      params.push(val);
      where.push(clause.replace('?', `$${params.length}`));
    };
    // Default to France for the phase-1 UI; an explicit country overrides.
    add('country = ?', (f.country ?? 'FRA').toUpperCase());
    if (f.region) add('region = ?', f.region);
    if (f.cadence) add('cadence = ?', f.cadence);
    if (f.from) add('start_date >= ?', f.from);
    if (f.to) add('start_date <= ?', f.to);
    if (f.q) add('name ILIKE ?', `%${f.q}%`);

    const orderBy =
      f.sort === 'name' ? 'name ASC'
      : f.sort === 'region' ? 'region ASC NULLS LAST, start_date ASC'
      : 'start_date ASC';

    const sql = `SELECT id, name, url, country, location, region, department, lat, lon,
                        start_date, end_date, players, cadence, time_control
                   FROM tournament
                  WHERE ${where.join(' AND ')}
                  ORDER BY ${orderBy}
                  LIMIT 2000`;
    const { rows } = await pool.query(sql, params);
    return rows;
  });

  app.get('/api/tournaments/regions', { preHandler: requireUser }, async (req) => {
    const country = (((req.query as { country?: string }).country ?? 'FRA')).toUpperCase();
    const { rows } = await pool.query<{ region: string }>(
      `SELECT DISTINCT region FROM tournament
        WHERE region IS NOT NULL AND country = $1
        ORDER BY region`,
      [country],
    );
    return rows.map((r) => r.region);
  });
}
