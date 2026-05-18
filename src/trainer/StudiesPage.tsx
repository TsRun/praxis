import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  trainerStudies,
  trainerGames,
  type OpeningStudySummary,
  type GameStudySummary,
} from '../lib/api';

export function StudiesPage() {
  const [opens, setOpens] = useState<OpeningStudySummary[] | null>(null);
  const [games, setGames] = useState<GameStudySummary[] | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    trainerStudies.list().then(setOpens);
  }, []);
  useEffect(() => {
    trainerGames.list().then(setGames);
  }, []);

  async function newOpening() {
    const name = window.prompt('Study name?');
    if (!name) return;
    const sideAns = window.prompt("Which side ('w' or 'b')?", 'w');
    const side: 'w' | 'b' = sideAns === 'b' ? 'b' : 'w';
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const { id } = await trainerStudies.create({ name, root_fen: startFen, side });
    nav(`/trainer/studies/opening/${id}`);
  }

  async function newGame() {
    const name = window.prompt('Study name?');
    if (!name) return;
    const pgn = window.prompt('Paste PGN:');
    if (!pgn) return;
    try {
      const { id } = await trainerGames.create(name, pgn);
      nav(`/trainer/studies/game/${id}`);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Studies</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={newOpening}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium"
          >
            + Opening
          </button>
          <button
            onClick={newGame}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium"
          >
            + Game
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Opening studies</h2>
        {!opens && <p className="text-zinc-500">Loading…</p>}
        {opens && opens.length === 0 && <p className="text-zinc-500">No opening studies yet.</p>}
        {opens &&
          opens.map((r) => (
            <Link
              key={r.id}
              to={`/trainer/studies/opening/${r.id}`}
              className="block panel p-3 hover:bg-amber-400/[0.04] mb-2"
            >
              <div className="flex items-center gap-3">
                <strong>{r.name}</strong>
                {r.eco && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300">
                    {r.eco}
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-500">
                  {r.annotation_count} notes · plays {r.side === 'w' ? 'white' : 'black'}
                </span>
              </div>
            </Link>
          ))}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Game studies</h2>
        {!games && <p className="text-zinc-500">Loading…</p>}
        {games && games.length === 0 && <p className="text-zinc-500">No game studies yet.</p>}
        {games &&
          games.map((r) => (
            <Link
              key={r.id}
              to={`/trainer/studies/game/${r.id}`}
              className="block panel p-3 hover:bg-amber-400/[0.04] mb-2"
            >
              <div className="flex items-center gap-3">
                <strong>{r.name}</strong>
                <span className="text-xs text-zinc-500">
                  {r.headers_json.White} vs {r.headers_json.Black}
                </span>
                <span className="ml-auto text-xs text-zinc-500">
                  {r.annotation_count} notes
                </span>
              </div>
            </Link>
          ))}
      </section>
    </div>
  );
}
