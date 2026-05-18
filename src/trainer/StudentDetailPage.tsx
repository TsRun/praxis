import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  trainerStudent,
  trainerStudies,
  trainerGames,
  type StudentDetail,
  type OpeningStudySummary,
  type GameStudySummary,
} from '../lib/api';

export function StudentDetailPage() {
  const { id } = useParams();
  const numId = Number(id);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [opens, setOpens] = useState<OpeningStudySummary[]>([]);
  const [games, setGames] = useState<GameStudySummary[]>([]);

  async function refresh() {
    setDetail(await trainerStudent.get(numId));
  }
  useEffect(() => {
    refresh();
  }, [numId]);
  useEffect(() => {
    trainerStudies.list().then(setOpens);
    trainerGames.list().then(setGames);
  }, []);

  async function assign(kind: 'opening' | 'game', studyId: number) {
    await trainerStudent.assign(numId, kind, studyId);
    refresh();
  }

  if (!detail) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{detail.name}</h1>
        <p className="text-zinc-400">{detail.email}</p>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Assigned</h2>
        {detail.assignments.length === 0 && <p className="text-zinc-500">No assignments.</p>}
        {detail.assignments.map((a) => (
          <div key={a.id} className="panel p-3 mb-2 flex items-center gap-3">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-700/40">
              {a.study_kind}
            </span>
            <strong>{a.name}</strong>
            <span className="ml-auto text-xs text-zinc-500">
              {a.completed_at
                ? `completed ${new Date(a.completed_at).toLocaleDateString()}`
                : 'in progress'}
            </span>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Assign new</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h3 className="text-sm text-zinc-300 mb-1">Opening studies</h3>
            {opens.map((s) => (
              <button
                key={s.id}
                onClick={() => assign('opening', s.id)}
                className="block w-full text-left panel p-2 mb-1 hover:bg-amber-400/[0.04]"
              >
                {s.name}
              </button>
            ))}
          </div>
          <div>
            <h3 className="text-sm text-zinc-300 mb-1">Game studies</h3>
            {games.map((s) => (
              <button
                key={s.id}
                onClick={() => assign('game', s.id)}
                className="block w-full text-left panel p-2 mb-1 hover:bg-amber-400/[0.04]"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
