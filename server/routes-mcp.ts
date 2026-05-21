import type { FastifyInstance } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

/**
 * Hosted MCP (Model Context Protocol) endpoint. Mounts the Praxis tool
 * surface at /api/mcp using the Streamable-HTTP transport, so an AI
 * assistant can drive the same trainer/student endpoints via:
 *   claude mcp add praxis --transport http \
 *     --url https://praxis.thiserro.com/api/mcp \
 *     --header "Authorization: Bearer praxis_…"
 *
 * The transport is run in stateless mode (sessionIdGenerator: undefined),
 * because every request is authenticated independently via the API-key
 * Bearer token — there's no useful session state for us to keep. The
 * caller's token is attached to the IncomingMessage as `req.auth` so the
 * SDK forwards it as `authInfo` to each tool handler, which uses it to
 * call our own HTTP routes via Fastify's in-process `inject()`. That
 * way every tool re-uses the existing route logic + auth hook + error
 * handler instead of duplicating SQL.
 */
export async function mcpRoutes(app: FastifyInstance) {
  // Streamable-HTTP uses one URL for POST/GET/DELETE; the transport
  // demuxes by method. Fastify wants the body parsed before we get here
  // (default JSON parser is fine for POST initialize/tools messages).
  app.all('/api/mcp', async (req, reply) => {
    const auth = req.headers.authorization ?? '';
    const m = /^Bearer\s+(praxis_[A-Za-z0-9_-]+)$/.exec(auth);
    if (!m) {
      return reply
        .code(401)
        .header('www-authenticate', 'Bearer realm="praxis-mcp"')
        .send({ error: 'bearer praxis_<key> required' });
    }
    // The Node wrapper of the SDK transport pulls authInfo off
    // `req.auth` — see streamableHttp.js handleRequest.
    (req.raw as unknown as { auth: unknown }).auth = {
      token: m[1],
      clientId: 'praxis-mcp',
      scopes: [],
    };
    // Build a fresh server + transport per request. Stateless mode is
    // supposed to share a single transport, but in practice the SDK's
    // internal request/stream maps don't get cleaned up between calls
    // and subsequent requests on a shared transport return empty SSE
    // streams. Per-request instances cost ~ms and side-step the issue.
    const server = buildMcpServer(app);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    // The transport writes the response itself; tell Fastify to step out
    // so it doesn't try to send a body afterwards.
    reply.hijack();
    try {
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } finally {
      await transport.close();
      await server.close();
    }
  });
}

function buildMcpServer(app: FastifyInstance): McpServer {
  const server = new McpServer({
    name: 'praxis-mcp',
    version: '0.2.0',
  });

  async function callApi<T>(
    bearer: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<T> {
    const res = await app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${bearer}` },
      payload: body as never,
    });
    if (res.statusCode >= 400) {
      let msg = `${method} ${url} → ${res.statusCode}`;
      try {
        const j = JSON.parse(res.body) as { error?: string };
        if (j.error) msg = `${j.error} (${method} ${url} → ${res.statusCode})`;
      } catch {
        /* non-JSON body */
      }
      throw new Error(msg);
    }
    return JSON.parse(res.body) as T;
  }

  function bearerFrom(extra: { authInfo?: { token?: string } }): string {
    const token = extra.authInfo?.token;
    if (!token) throw new Error('missing API key on MCP call');
    return token;
  }

  function ok(payload: unknown) {
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(payload, null, 2) },
      ],
    };
  }

  /* ── Tactic sets ─────────────────────────────────────────────────── */

  server.registerTool(
    'list_tactic_sets',
    {
      title: 'List my tactic sets',
      description:
        'Returns every tactical-puzzle set the authenticated user owns, with id, name, puzzle count, and timestamps.',
      inputSchema: {},
    },
    async (_args, extra) =>
      ok(await callApi(bearerFrom(extra), 'GET', '/api/trainer/studies/tactic')),
  );

  server.registerTool(
    'get_tactic_set',
    {
      title: 'Get a tactic set with all puzzles',
      description:
        'Returns the set metadata plus every puzzle (FEN, solution SAN line, comment).',
      inputSchema: { set_id: z.number().int().positive() },
    },
    async ({ set_id }, extra) =>
      ok(
        await callApi(
          bearerFrom(extra),
          'GET',
          `/api/trainer/studies/tactic/${set_id}`,
        ),
      ),
  );

  server.registerTool(
    'create_tactic_set',
    {
      title: 'Create a tactic set',
      description:
        'Creates an empty tactical-puzzle set. Use add_tactic_puzzle to populate it.',
      inputSchema: { name: z.string().min(1) },
    },
    async ({ name }, extra) =>
      ok(
        await callApi(bearerFrom(extra), 'POST', '/api/trainer/studies/tactic', {
          name,
        }),
      ),
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
    async ({ set_id, fen, solution_san, comment_md }, extra) =>
      ok(
        await callApi(
          bearerFrom(extra),
          'POST',
          `/api/trainer/studies/tactic/${set_id}/puzzles`,
          { fen, solution_san, comment_md },
        ),
      ),
  );

  server.registerTool(
    'delete_tactic_set',
    {
      title: 'Delete a tactic set',
      description:
        'Removes the set, all its puzzles, and any student attempts on them. Irreversible.',
      inputSchema: { set_id: z.number().int().positive() },
    },
    async ({ set_id }, extra) =>
      ok(
        await callApi(
          bearerFrom(extra),
          'DELETE',
          `/api/trainer/studies/tactic/${set_id}`,
        ),
      ),
  );

  /* ── Opening / game studies ──────────────────────────────────────── */

  server.registerTool(
    'list_opening_studies',
    {
      title: 'List opening studies',
      description: 'Returns every opening repertoire the authenticated user owns.',
      inputSchema: {},
    },
    async (_args, extra) =>
      ok(await callApi(bearerFrom(extra), 'GET', '/api/trainer/studies/opening')),
  );

  server.registerTool(
    'list_game_studies',
    {
      title: 'List game studies',
      description: 'Returns every annotated-game study the authenticated user owns.',
      inputSchema: {},
    },
    async (_args, extra) =>
      ok(await callApi(bearerFrom(extra), 'GET', '/api/trainer/studies/game')),
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
    async ({ name, side, root_fen, eco }, extra) =>
      ok(
        await callApi(
          bearerFrom(extra),
          'POST',
          '/api/trainer/studies/opening',
          {
            name,
            side,
            root_fen:
              root_fen ??
              'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            eco,
          },
        ),
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
    async ({ name, pgn }, extra) =>
      ok(
        await callApi(bearerFrom(extra), 'POST', '/api/trainer/studies/game', {
          name,
          pgn,
        }),
      ),
  );

  /* ── Students / assignments ──────────────────────────────────────── */

  server.registerTool(
    'list_students',
    {
      title: 'List linked students',
      description:
        'Returns the students linked to the authenticated trainer (requires the "trainer" role).',
      inputSchema: {},
    },
    async (_args, extra) =>
      ok(await callApi(bearerFrom(extra), 'GET', '/api/trainer/students')),
  );

  server.registerTool(
    'get_student',
    {
      title: 'Get a student’s detail + assignments',
      description:
        'Returns one student + their assignment list with per-assignment progress. Trainer role required.',
      inputSchema: { student_id: z.number().int().positive() },
    },
    async ({ student_id }, extra) =>
      ok(
        await callApi(
          bearerFrom(extra),
          'GET',
          `/api/trainer/students/${student_id}`,
        ),
      ),
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
    async ({ student_id, study_kind, study_id }, extra) =>
      ok(
        await callApi(
          bearerFrom(extra),
          'POST',
          `/api/trainer/students/${student_id}/assignments`,
          { study_kind, study_id },
        ),
      ),
  );

  /* ── Read-only inspection ────────────────────────────────────────── */

  server.registerTool(
    'my_assignments',
    {
      title: 'List my own assignments (student-facing)',
      description:
        'Returns the assignment list as the authenticated user sees it — including progress_pct for each. Mirrors the student dashboard. Works for any signed-in user.',
      inputSchema: {},
    },
    async (_args, extra) =>
      ok(await callApi(bearerFrom(extra), 'GET', '/api/student/assignments')),
  );

  return server;
}
