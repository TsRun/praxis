# Praxis MCP server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that lets
an AI assistant (Claude Code, Claude Desktop, Copilot CLI, etc.) author
content in your Praxis account: create tactic sets and puzzles, create
opening / game studies, list students, and push assignments.

## Setup

1. **Mint an API key.** Sign in to Praxis → Settings → API keys → "New key".
   Copy the `praxis_…` token shown once. It identifies as you with all of
   your roles — keep it secret.

2. **Build the server.**

   ```sh
   cd mcp-server
   npm install
   npm run build
   ```

3. **Register the MCP with your client.** For Claude Code, add this to
   `~/.claude.json` (replace the absolute path + key):

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

   `PRAXIS_BASE_URL` defaults to `https://praxis.thiserro.com`. Point it at
   `http://localhost:5174` to test against a local dev server.

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
