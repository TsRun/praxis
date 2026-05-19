import { useEffect, useState } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { trainer, trainerStudent, type StudentRow } from '../lib/api';
import { Btn, Avatar } from '../components/ui/atoms';
import { IconCheck } from '../components/ui/Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  studyKind: 'opening' | 'game';
  studyId: number;
  studyName: string;
}

export function AssignStudyDialog({
  open,
  onClose,
  studyKind,
  studyId,
  studyName,
}: Props) {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setErr(null);
    setDone(null);
    setQ('');
    trainer
      .students()
      .then(setStudents)
      .catch((e) => setErr((e as Error).message));
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

  const filtered = (students ?? []).filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={done ? 'Assigned' : `Assign ${studyName}`}
      width={460}
    >
      {done ? (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--success-bg)',
              boxShadow: 'inset 0 0 0 1px rgba(52,211,153,0.30)',
              fontSize: 13.5,
              color: 'var(--text)',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'rgba(52,211,153,0.18)',
                color: 'var(--success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconCheck size={16} strokeWidth={2.6} />
            </div>
            <div>
              Assigned <strong>{studyName}</strong> to <strong>{done}</strong>.
              They'll get an email with the link.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="primary" onClick={onClose}>
              Done
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div className="meta" style={{ marginTop: -8 }}>
            Pick a student by nickname. An email will be sent with the link.
          </div>
          <input
            className="input"
            placeholder="search students…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {!students && <div className="meta">Loading roster…</div>}
          {students && filtered.length === 0 && (
            <div className="meta">No students match that search.</div>
          )}
          {filtered.length > 0 && (
            <div
              style={{
                maxHeight: '40vh',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              className="scroll-thin"
            >
              {filtered.map((s) => {
                const on = picked === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPicked(s.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'inherit',
                    }}
                  >
                    <Avatar name={s.name} />
                    <div>
                      <div className="mono" style={{ fontSize: 14 }}>{s.name}</div>
                      <div
                        className="meta"
                        style={{ fontSize: 11.5, marginTop: 1 }}
                      >
                        {s.assignment_count} assigned
                      </div>
                    </div>
                    {on && (
                      <span
                        style={{
                          color: 'var(--accent)',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        ✓ picked
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {err && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>
          )}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              marginTop: 4,
            }}
          >
            <Btn variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={submit}
              disabled={busy || picked == null}
            >
              {busy ? 'Sending…' : 'Assign'}
            </Btn>
          </div>
        </>
      )}
    </Dialog>
  );
}
