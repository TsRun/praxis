import { useEffect, useState } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { trainer, trainerStudent, type StudentRow } from '../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  studyKind: 'opening' | 'game';
  studyId: number;
  studyName: string;
}

export function AssignStudyDialog({ open, onClose, studyKind, studyId, studyName }: Props) {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setErr(null);
    setDone(null);
    trainer.students().then(setStudents).catch((e) => setErr((e as Error).message));
  }, [open]);

  async function submit() {
    if (picked == null) return;
    setBusy(true);
    setErr(null);
    try {
      await trainerStudent.assign(picked, studyKind, studyId);
      const s = students?.find((x) => x.id === picked);
      setDone(s?.name ?? 'student');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title="Assign to student" width="w-[28rem]">
      {done ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">
            ✓ Assigned <strong>{studyName}</strong> to <strong>{done}</strong>. They'll get
            an email with the link.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500">
            Pick a student by nickname. An email will be sent with the link.
          </p>
          {!students && <p className="text-sm text-zinc-500">Loading roster…</p>}
          {students && students.length === 0 && (
            <p className="text-sm text-zinc-500">
              No students yet. Invite one from the Students page first.
            </p>
          )}
          {students && students.length > 0 && (
            <div className="max-h-[40vh] overflow-auto flex flex-col gap-0.5">
              {students.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded cursor-pointer ${
                    picked === s.id ? 'bg-amber-400/15 text-amber-100' : 'hover:bg-zinc-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="student"
                    checked={picked === s.id}
                    onChange={() => setPicked(s.id)}
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-zinc-500">{s.assignment_count} assigned</span>
                </label>
              ))}
            </div>
          )}
          {err && <span className="text-xs text-red-400">{err}</span>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={busy}
              className="text-zinc-400 px-3 py-1.5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || picked == null}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Assign + email'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
