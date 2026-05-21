import type { Pool } from 'pg';
import { Chess } from 'chess.js';

const UA = 'Praxis/1.0 (https://praxis.tsrun.dev)';

export type TimeControlBucket = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface PostFilters {
  color?: 'white' | 'black' | 'either';
  player?: string;
  results?: string[]; // '1-0' | '0-1' | '1/2-1/2'
  eco?: string;
  minElo?: number;
  timeControls?: TimeControlBucket[];
  positionFen?: string; // normalized to first 4 FEN fields
}

/** Pull headers + movetext apart so we can decide whether to keep a game
 * without re-emitting it through the full PGN parser. Returns the raw game
 * string segmented from a multi-game PGN. */
function splitPgnGames(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const games: string[][] = [];
  let cur: string[] = [];
  let prevBlank = true;
  for (const line of lines) {
    if (line.startsWith('[Event ') && prevBlank && cur.length > 0) {
      games.push(cur);
      cur = [];
    }
    cur.push(line);
    prevBlank = line.trim() === '';
  }
  if (cur.length > 0) games.push(cur);
  return games
    .map((g) => g.join('\n').trim())
    .filter((g) => g.length > 0);
}

function readHeaders(game: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of game.split('\n')) {
    const m = line.match(/^\[(\w+)\s+"((?:\\.|[^"\\])*)"\]\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return out;
}

/** Map a PGN [TimeControl] header to one of the four buckets. Returns null
 * when the header is missing or unparseable; the caller treats null as
 * "passes" so unknown formats don't get dropped. */
export function classifyTimeControl(tc: string | undefined): TimeControlBucket | null {
  if (!tc) return null;
  if (tc === '-') return null;
  // Lichess correspondence-style: "1/86400" (1 move per N seconds)
  if (tc.includes('/')) return 'classical';
  // chess.com / lichess format: "300" or "300+5"
  const [baseStr, incStr] = tc.split('+');
  const base = Number(baseStr);
  const inc = Number(incStr ?? '0');
  if (!Number.isFinite(base) || base <= 0) return null;
  const estimate = base + 40 * (Number.isFinite(inc) ? inc : 0);
  if (estimate < 180) return 'bullet';
  if (estimate < 600) return 'blitz';
  if (estimate < 1800) return 'rapid';
  return 'classical';
}

function movetext(game: string): string {
  const lines = game.split('\n');
  const firstBlank = lines.findIndex((l) => l.trim() === '');
  if (firstBlank < 0) return '';
  return lines.slice(firstBlank + 1).join('\n').trim();
}

/** Strip movetext to just the SAN tokens (drop comments, NAGs, variations,
 * move numbers, and the trailing result). Sufficient to replay the mainline
 * with chess.js for position-filter passthrough checks. */
function mainlineSans(game: string): string[] {
  let text = movetext(game);
  // Drop {comments} and ;line-comments
  text = text.replace(/\{[^}]*\}/g, ' ');
  text = text.replace(/;[^\n]*/g, ' ');
  // Drop (variations) — flat strip is OK because chess.com / lichess
  // PGNs are almost always mainline-only, but be safe.
  // Repeat until no parentheses remain (handle nesting).
  for (let i = 0; i < 8 && text.includes('('); i++) {
    text = text.replace(/\([^()]*\)/g, ' ');
  }
  // Drop NAGs ($1 $19 etc.)
  text = text.replace(/\$\d+/g, ' ');
  // Drop move numbers like "1." "12..."
  text = text.replace(/\b\d+\.+\s*/g, ' ');
  const tokens = text.split(/\s+/).filter(Boolean);
  // Last token is usually the result — drop it.
  const last = tokens[tokens.length - 1];
  if (last === '1-0' || last === '0-1' || last === '1/2-1/2' || last === '*') {
    tokens.pop();
  }
  return tokens;
}

function gameMatchesPosition(game: string, positionFen: string): boolean {
  const sans = mainlineSans(game);
  const c = new Chess();
  if (normFen(c.fen()) === positionFen) return true;
  for (const san of sans) {
    let moved;
    try { moved = c.move(san); } catch { moved = null; }
    if (!moved) return false;
    if (normFen(c.fen()) === positionFen) return true;
  }
  return false;
}

function normFen(fen: string): string {
  return fen.split(/\s+/).slice(0, 4).join(' ');
}

/** Drop games from `pgn` that don't satisfy every active filter. Filters
 * with no values are skipped; games missing a header needed by an active
 * filter are kept (treat unknown as "passes" — chess.com / lichess PGNs
 * sometimes omit ECO or TimeControl). */
export function filterPgnGames(pgn: string, filters: PostFilters): string {
  const active =
    (filters.color && filters.color !== 'either') ||
    !!filters.player ||
    (filters.results && filters.results.length > 0) ||
    !!filters.eco ||
    (filters.minElo != null && filters.minElo > 0) ||
    (filters.timeControls && filters.timeControls.length > 0) ||
    !!filters.positionFen;
  if (!active) return pgn;

  const games = splitPgnGames(pgn);
  const keep: string[] = [];
  for (const game of games) {
    const h = readHeaders(game);

    if (filters.color === 'white' || filters.color === 'black') {
      const want = filters.color === 'white' ? 'White' : 'Black';
      const name = h[want];
      const needle = (filters.player ?? '').toLowerCase();
      if (needle && name && !name.toLowerCase().includes(needle)) continue;
    } else if (filters.player) {
      const needle = filters.player.toLowerCase();
      const w = (h.White ?? '').toLowerCase();
      const b = (h.Black ?? '').toLowerCase();
      if (!w.includes(needle) && !b.includes(needle)) continue;
    }

    if (filters.results && filters.results.length > 0) {
      const r = h.Result;
      if (r && !filters.results.includes(r)) continue;
    }

    if (filters.eco) {
      const eco = (h.ECO ?? '').toLowerCase();
      const opening = (h.Opening ?? '').toLowerCase();
      const needle = filters.eco.toLowerCase();
      const ok = (eco && eco.includes(needle)) || (opening && opening.includes(needle));
      // Don't drop the game when both headers are missing — unknown passes.
      if ((eco || opening) && !ok) continue;
    }

    if (filters.minElo != null && filters.minElo > 0) {
      const w = Number(h.WhiteElo ?? '');
      const b = Number(h.BlackElo ?? '');
      const best = Math.max(Number.isFinite(w) ? w : 0, Number.isFinite(b) ? b : 0);
      if (best > 0 && best < filters.minElo) continue;
    }

    if (filters.timeControls && filters.timeControls.length > 0) {
      const bucket = classifyTimeControl(h.TimeControl);
      if (bucket != null && !filters.timeControls.includes(bucket)) continue;
    }

    if (filters.positionFen) {
      if (!gameMatchesPosition(game, normFen(filters.positionFen))) continue;
    }

    keep.push(game);
  }
  return keep.join('\n\n');
}

/** Fetch the last `max` games from Chess.com for `username`, concatenated as PGN.
 * Chess.com has no "last N games" endpoint; we walk the monthly archives
 * newest-first via the documented `archives` index and stop once we've gathered
 * enough games. */
export async function fetchChessComGames(
  username: string,
  max: number = 30,
): Promise<string> {
  const user = encodeURIComponent(username.trim());
  if (!user) throw new Error('username required');

  const archivesUrl = `https://api.chess.com/pub/player/${user}/games/archives`;
  const archivesRes = await fetch(archivesUrl, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (archivesRes.status === 404) {
    throw new Error(`Chess.com user '${username}' not found`);
  }
  if (!archivesRes.ok) {
    throw new Error(`Chess.com archives fetch failed (${archivesRes.status})`);
  }
  const { archives } = (await archivesRes.json()) as { archives?: string[] };
  if (!archives || archives.length === 0) return '';

  const pgnChunks: string[] = [];
  let gameCount = 0;
  // The /pgn suffix on a monthly archive returns concatenated PGN games for
  // that month, blank-line separated.
  for (let i = archives.length - 1; i >= 0 && gameCount < max; i--) {
    const archiveUrl = `${archives[i]}/pgn`;
    const res = await fetch(archiveUrl, {
      headers: { 'User-Agent': UA, Accept: 'application/x-chess-pgn' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) continue;
    const body = (await res.text()).trim();
    if (!body) continue;
    const games = splitPgnByEvent(body);
    for (const g of games) {
      if (gameCount >= max) break;
      pgnChunks.push(g);
      gameCount++;
    }
  }
  return pgnChunks.join('\n\n');
}

/** Fetch the last `max` games from Lichess for `username`. The response IS the
 * PGN body — we ask for x-chess-pgn explicitly so we don't get ndjson. */
export async function fetchLichessUserGames(
  username: string,
  max: number = 30,
): Promise<string> {
  const user = encodeURIComponent(username.trim());
  if (!user) throw new Error('username required');
  const url =
    `https://lichess.org/api/games/user/${user}` +
    `?max=${max}&moves=true&tags=true&clocks=false&evals=false&opening=true`;
  const res = await fetch(url, {
    headers: { Accept: 'application/x-chess-pgn', 'User-Agent': UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) {
    throw new Error(`Lichess user '${username}' not found`);
  }
  if (!res.ok) {
    throw new Error(`Lichess fetch failed (${res.status})`);
  }
  return await res.text();
}

interface DbGameRow {
  id: string;
  white_name: string | null;
  black_name: string | null;
  event: string | null;
  event_date: string | null;
  result: string;
  white_elo: number | null;
  black_elo: number | null;
  ply: number;
  san: string;
}

/** Reconstruct PGN games from rows in the `game` + `game_move` tables. The
 * moves table only stores SAN per ply, which is enough to round-trip into a
 * playable PGN as long as we emit a "1. e4 e5 …" style movetext. */
export async function reconstructBaseGames(
  pool: Pool,
  gameIds: number[],
): Promise<string> {
  if (gameIds.length === 0) return '';
  const { rows } = await pool.query<DbGameRow>(
    `SELECT game.id::text AS id,
            game.white_name, game.black_name,
            game.event, game.event_date, game.result,
            game.white_elo, game.black_elo,
            game_move.ply, game_move.san
       FROM game
       JOIN game_move ON game_move.game_id = game.id
      WHERE game.id = ANY($1::bigint[])
      ORDER BY game.id, game_move.ply`,
    [gameIds],
  );
  if (rows.length === 0) return '';

  const byGame = new Map<string, DbGameRow[]>();
  for (const r of rows) {
    const arr = byGame.get(r.id) ?? [];
    arr.push(r);
    byGame.set(r.id, arr);
  }
  const out: string[] = [];
  for (const [, moves] of byGame) {
    out.push(buildPgnForGame(moves));
  }
  return out.join('\n\n');
}

function buildPgnForGame(moves: DbGameRow[]): string {
  const first = moves[0];
  const resultToken = pgnResultToken(first.result);
  const headers = [
    `[Event "${pgnEscape(first.event ?? 'OTB')}"]`,
    `[Site "${pgnEscape('?')}"]`,
    `[Date "${pgnEscape(first.event_date ?? '????.??.??')}"]`,
    `[White "${pgnEscape(first.white_name ?? '?')}"]`,
    `[Black "${pgnEscape(first.black_name ?? '?')}"]`,
    `[Result "${resultToken}"]`,
  ];
  if (first.white_elo != null) {
    headers.push(`[WhiteElo "${first.white_elo}"]`);
  }
  if (first.black_elo != null) {
    headers.push(`[BlackElo "${first.black_elo}"]`);
  }
  const movetextParts: string[] = [];
  for (const m of moves) {
    if (m.ply % 2 === 1) {
      movetextParts.push(`${Math.ceil(m.ply / 2)}.${m.san}`);
    } else {
      movetextParts.push(m.san);
    }
  }
  movetextParts.push(resultToken);
  return `${headers.join('\n')}\n\n${movetextParts.join(' ')}`;
}

function pgnEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function pgnResultToken(r: string): string {
  if (r === '1') return '1-0';
  if (r === '0') return '0-1';
  if (r === 'd' || r === 'D' || r === '=') return '1/2-1/2';
  if (r === '1-0' || r === '0-1' || r === '1/2-1/2') return r;
  return '*';
}

/** Split a chess.com archive-as-PGN response into individual game PGNs by
 * looking for blank-line followed by `[Event ` (PGN spec separator). */
function splitPgnByEvent(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const games: string[][] = [];
  let cur: string[] = [];
  let prevBlank = true;
  for (const line of lines) {
    if (line.startsWith('[Event ') && prevBlank && cur.length > 0) {
      games.push(cur);
      cur = [];
    }
    cur.push(line);
    prevBlank = line.trim() === '';
  }
  if (cur.length > 0) games.push(cur);
  return games
    .map((g) => g.join('\n').trim())
    .filter((g) => g.length > 0);
}
