#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.PRAXIS_BASE_URL ?? 'https://praxis.thiserro.com').replace(/\/+$/, '');
const API_KEY = process.env.PRAXIS_API_KEY;

if (!API_KEY) {
  console.error('PRAXIS_API_KEY is required. Mint one at <praxis>/settings.');
  process.exit(1);
}

async function call<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${API_KEY}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${method} ${path} → ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = `${j.error} (${method} ${path} → ${res.status})`;
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

function ok(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}

const server = new McpServer({
  name: 'praxis-mcp',
  version: '0.1.0',
});

/* ─────────────────────────── Tactic sets ───────────────────────────── */

server.registerTool(
  'list_tactic_sets',
  {
    title: 'List my tactic sets',
    description:
      'Returns every tactical-puzzle set the authenticated user owns, with id, name, puzzle count, and timestamps.',
    inputSchema: {},
  },
  async () => ok(await call('GET', '/api/trainer/studies/tactic')),
);

server.registerTool(
  'get_tactic_set',
  {
    title: 'Get a tactic set with all puzzles',
    description: 'Returns the set metadata plus every puzzle (FEN, solution SAN line, comment).',
    inputSchema: { set_id: z.number().int().positive() },
  },
  async ({ set_id }) => ok(await call('GET', `/api/trainer/studies/tactic/${set_id}`)),
);

server.registerTool(
  'create_tactic_set',
  {
    title: 'Create a tactic set',
    description: 'Creates an empty tactical-puzzle set. Use add_tactic_puzzle to populate it.',
    inputSchema: { name: z.string().min(1) },
  },
  async ({ name }) => ok(await call('POST', '/api/trainer/studies/tactic', { name })),
);

server.registerTool(
  'add_tactic_puzzle',
  {
    title: 'Add a puzzle to a tactic set',
    description:
      'Appends one puzzle. The solution is a list of SAN moves played from the FEN, alternating sides. The server validates legality against the position and rejects illegal lines with a 400.',
    inputSchema: {
      set_id: z.number().int().positive(),
      fen: z.string().min(1),
      solution_san: z.array(z.string()).min(1),
      comment_md: z.string().optional(),
    },
  },
  async ({ set_id, fen, solution_san, comment_md }) =>
    ok(
      await call('POST', `/api/trainer/studies/tactic/${set_id}/puzzles`, {
        fen,
        solution_san,
        comment_md,
      }),
    ),
);

server.registerTool(
  'delete_tactic_set',
  {
    title: 'Delete a tactic set',
    description: 'Removes the set, all its puzzles, and any student attempts on them. Irreversible.',
    inputSchema: { set_id: z.number().int().positive() },
  },
  async ({ set_id }) => ok(await call('DELETE', `/api/trainer/studies/tactic/${set_id}`)),
);

/* ─────────────────────────── Opening / game studies ────────────────── */

server.registerTool(
  'list_opening_studies',
  {
    title: 'List opening studies',
    description: 'Returns every opening repertoire the authenticated user owns.',
    inputSchema: {},
  },
  async () => ok(await call('GET', '/api/trainer/studies/opening')),
);

server.registerTool(
  'list_game_studies',
  {
    title: 'List game studies',
    description: 'Returns every annotated-game study the authenticated user owns.',
    inputSchema: {},
  },
  async () => ok(await call('GET', '/api/trainer/studies/game')),
);

server.registerTool(
  'create_opening_study',
  {
    title: 'Create an opening study',
    description:
      'Creates an opening repertoire study. side is "w" (training as White) or "b" (as Black). root_fen defaults to the standard starting position.',
    inputSchema: {
      name: z.string().min(1),
      side: z.enum(['w', 'b']),
      root_fen: z.string().optional(),
      eco: z.string().optional(),
    },
  },
  async ({ name, side, root_fen, eco }) =>
    ok(
      await call('POST', '/api/trainer/studies/opening', {
        name,
        side,
        root_fen: root_fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        eco,
      }),
    ),
);

server.registerTool(
  'create_game_study',
  {
    title: 'Create a game study from PGN',
    description:
      'Creates an annotated-game study seeded from a single PGN. The server parses the PGN and stores headers + mainline ply.',
    inputSchema: { name: z.string().min(1), pgn: z.string().min(1) },
  },
  async ({ name, pgn }) =>
    ok(await call('POST', '/api/trainer/studies/game', { name, pgn })),
);

/* ─────────────────────────── Students / assignments ────────────────── */

server.registerTool(
  'list_students',
  {
    title: 'List linked students',
    description:
      'Returns the students linked to the authenticated trainer (requires the "trainer" role).',
    inputSchema: {},
  },
  async () => ok(await call('GET', '/api/trainer/students')),
);

server.registerTool(
  'get_student',
  {
    title: 'Get a student’s detail + assignments',
    description:
      'Returns one student + their assignment list with per-assignment progress. Trainer role required.',
    inputSchema: { student_id: z.number().int().positive() },
  },
  async ({ student_id }) =>
    ok(await call('GET', `/api/trainer/students/${student_id}`)),
);

server.registerTool(
  'assign_study',
  {
    title: 'Assign a study to a student',
    description:
      'Assigns one of your studies (opening | game | tactic) to a linked student. Idempotent — returns {already_assigned:true} if the pairing already exists.',
    inputSchema: {
      student_id: z.number().int().positive(),
      study_kind: z.enum(['opening', 'game', 'tactic']),
      study_id: z.number().int().positive(),
    },
  },
  async ({ student_id, study_kind, study_id }) =>
    ok(
      await call('POST', `/api/trainer/students/${student_id}/assignments`, {
        study_kind,
        study_id,
      }),
    ),
);

/* ─────────────────────────── Read-only inspection ──────────────────── */

server.registerTool(
  'my_assignments',
  {
    title: 'List my own assignments (student-facing)',
    description:
      'Returns the assignment list as the authenticated user sees it — including progress_pct for each. Mirrors the student dashboard. Works for any signed-in user.',
    inputSchema: {},
  },
  async () => ok(await call('GET', '/api/student/assignments')),
);

await server.connect(new StdioServerTransport());
