import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trainer, type StudentRow } from '../lib/api';
import { InviteStudentDialog } from './InviteStudentDialog';

export function StudentsPage() {
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const nav = useNavigate();

  async function refresh() {
    setRows(await trainer.students());
  }
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="ml-auto bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium"
        >
          + Invite student
        </button>
      </div>
      {!rows && <p className="text-zinc-500">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="text-zinc-500">No students yet. Invite your first one.</p>
      )}
      {rows && rows.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-zinc-500">
            <tr className="text-left">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Linked</th>
              <th className="text-right">Assignments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                onClick={() => nav(`/trainer/students/${s.id}`)}
                className="border-t border-zinc-800/60 cursor-pointer hover:bg-amber-400/[0.04]"
              >
                <td className="py-2">{s.name}</td>
                <td className="text-zinc-400">{s.email}</td>
                <td className="text-zinc-400 text-xs">
                  {new Date(s.linked_at).toLocaleDateString()}
                </td>
                <td className="text-right tabular-nums">{s.assignment_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showInvite && (
        <InviteStudentDialog
          onClose={() => {
            setShowInvite(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
