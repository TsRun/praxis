import type { Pool } from 'pg';

const UA = 'Praxis/1.0 (https://praxis.tsrun.dev)';

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
