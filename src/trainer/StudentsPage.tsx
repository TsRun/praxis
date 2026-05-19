import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trainer, type StudentRow } from '../lib/api';
import { InviteStudentDialog } from './InviteStudentDialog';
import { Card, Btn, Chip, Avatar, Segmented } from '../components/ui/atoms';
import { IconAssign, IconSearch, IconMore } from '../components/ui/Icons';

type Filter = 'all' | 'linked' | 'invited';

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function StudentsPage() {
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const nav = useNavigate();

  async function refresh() {
    setRows(await trainer.students());
  }
  useEffect(() => {
    refresh();
  }, []);

  const filtered = (rows ?? []).filter((s) =>
    s.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="page-wrap" style={{ paddingTop: 32, paddingBottom: 100 }}>
      {/* page head */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, paddingBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="t-h1">Students</h1>
          <div className="meta" style={{ marginTop: 6 }}>
            Send invites and track per-student progress. Linked students are
            signed in — invited ones receive an email when you assign a study.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="primary" onClick={() => setShowInvite(true)}>
            <IconAssign size={13} strokeWidth={2.4} />
            Invite student
          </Btn>
        </div>
      </div>

      {/* filter row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 22,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <IconSearch
            size={14}
            strokeWidth={2.4}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-faint)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            placeholder="Find by nickname…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'linked', label: 'Linked' },
            { value: 'invited', label: 'Invited' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <span className="meta">{filtered.length} students</span>
      </div>

      {/* roster */}
      {rows == null ? (
        <p className="meta">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="meta">No students yet. Invite your first one.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              onOpen={() => nav(`/trainer/students/${s.id}`)}
            />
          ))}
        </div>
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

function StudentCard({
  student: s,
  onOpen,
}: {
  student: StudentRow;
  onOpen: () => void;
}) {
  return (
    <Card
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'transform 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={s.name} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="mono"
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
            }}
          >
            {s.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            linked {relativeDate(s.linked_at)}
          </div>
          <div
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}
          >
            <Chip variant="success">● Linked</Chip>
          </div>
        </div>
        <button
          type="button"
          title="More"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'transparent',
            border: 0,
            color: 'var(--text-faint)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconMore size={14} strokeWidth={2.4} />
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            {s.assignment_count}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            assigned
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            —
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            avg progress
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          paddingTop: 12,
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <Btn variant="secondary" size="sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onOpen}>
          Open
        </Btn>
        <Btn
          variant="secondary"
          size="sm"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={onOpen}
        >
          + Assign
        </Btn>
      </div>
    </Card>
  );
}
