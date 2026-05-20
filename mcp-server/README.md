# Praxis MCP

A [Model Context Protocol](https://modelcontextprotocol.io/) interface to
your Praxis account: create tactic sets and puzzles, create opening / game
studies, list students, and push assignments.

**Two ways to use it:**

- **Hosted (recommended)** — Praxis itself exposes the MCP at
  `https://praxis.thiserro.com/api/mcp` via Streamable-HTTP. No install, no
  build, updates with every deploy.
- **Standalone stdio** — the `mcp-server/` package in this repo runs the
  same tool surface locally as a subprocess for offline / dev work.

## 1. Hosted (recommended)

1. **Mint an API key.** Praxis → Settings → API keys → "New key". Copy the
   `praxis_…` token shown once.

2. **Add it to your assistant.**

   For Claude Code:

   ```sh
   claude mcp add --transport http praxis \
     https://praxis.thiserro.com/api/mcp \
     --header "Authorization: Bearer praxis_…"
   ```

   For other clients, point them at the same URL and pass the bearer header.

That's it. The next session has the Praxis tools available — try
`create_tactic_set`, `add_tactic_puzzle`, `list_students`, …

## 2. Standalone stdio

For offline use or a quick local sanity check.

1. Mint a key as above.

2. Build the standalone server:

   ```sh
   cd mcp-server
   npm install
   npm run build
   ```

3. Register it with your client. For Claude Code, add to `~/.claude.json`
   (replace the absolute path + key):

   ```json
   {
     "mcpServers": {
       "praxis": {
         "command": "node",
         "args": ["/absolute/path/to/praxis/mcp-server/dist/index.js"],
         "env": {
           "PRAXIS_API_KEY": "praxis_…",
           "PRAXIS_BASE_URL": "https://praxis.thiserro.com"
         }
       }
     }
   }
   ```

   Override `PRAXIS_BASE_URL` to test against `http://localhost:5174`.

## Tools

| Tool | What it does |
| --- | --- |
| `list_tactic_sets` | Every tactic set you own. |
| `get_tactic_set` | Set metadata + every puzzle (FEN, solution SAN, comment). |
| `create_tactic_set` | Empty set; populate with `add_tactic_puzzle`. |
| `add_tactic_puzzle` | Append one puzzle. The server validates the solution against the FEN and rejects illegal lines. |
| `delete_tactic_set` | Drop set + puzzles + attempts. Irreversible. |
| `list_opening_studies` / `list_game_studies` | Your opening repertoires / annotated games. |
| `create_opening_study` | Empty repertoire (`side: "w"|"b"`, optional `root_fen` / `eco`). |
| `create_game_study` | Annotated game seeded from PGN. |
| `list_students` / `get_student` | Linked roster + per-assignment progress (trainer role). |
| `assign_study` | Idempotently assign one of your studies to a linked student. |
| `my_assignments` | Your own student-facing assignment list with progress %. |

## Revoking access

Settings → API keys → trash icon on the relevant row. The next request that
client makes will get a 401.
