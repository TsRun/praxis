import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { student, type AssignmentRow } from '../lib/api';

export function DashboardPage() {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  useEffect(() => {
    student.assignments().then(setRows);
  }, []);
  if (!rows) return <p className="text-zinc-500">Loading…</p>;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Your studies</h1>
      {rows.length === 0 && <p className="text-zinc-500">No studies assigned yet.</p>}
      {rows.map((a) => {
        const path =
          a.study_kind === 'opening'
            ? `/student/study/opening/${a.study_id}`
            : `/student/study/game/${a.study_id}`;
        return (
          <Link key={a.id} to={path} className="panel p-3 hover:bg-amber-400/[0.04]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-700/40">
                {a.study_kind}
              </span>
              <strong>{a.name}</strong>
              <span className="ml-auto text-xs text-zinc-500">{a.progress_pct}%</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
