import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { student, type AssignmentRow } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import {
  Card,
  Btn,
  Chip,
  Avatar,
  Segmented,
  ProgressBar,
  Kbd,
} from '../components/ui/atoms';
import { FenBoard } from '../components/board/FenBoard';
import {
  IconCheck,
  IconLamp,
  IconClock,
} from '../components/ui/Icons';

type ActiveFilter = 'active' | 'completed';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function greet() {
  const h = new Date().getHours();
  if (h < 6) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function DashboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [filter, setFilter] = useState<ActiveFilter>('active');

  useEffect(() => {
    student.assignments().then(setRows);
  }, []);

  if (!rows)
    return (
      <div style={{ padding: 28, color: 'var(--text-faint)' }}>Loading…</div>
    );

  const active = rows.filter((a) => a.completed_at == null);
  const done = rows.filter((a) => a.completed_at != null);
  const visible = filter === 'active' ? active : done;
  const top = active[0];

  return (
    <div className="page-wrap" style={{ paddingTop: 32, paddingBottom: 100 }}>
      {/* greeting */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 24,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1 }}>
          <h1 className="t-h1" style={{ margin: '0 0 6px' }}>
            {greet()},{' '}
            <span style={{ color: 'var(--accent)' }}>{user?.name ?? '—'}</span>
          </h1>
          <div className="meta">
            {active.length} active{' '}
            {active.length === 1 ? 'assignment' : 'assignments'}. A short
            focused session beats a long distracted one.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <MiniStat value={active.length} label="active" accent />
          <MiniStat value={done.length} label="completed" />
        </div>
      </div>

      <div
        className="grid-2"
        style={{
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* today's drill hero */}
          {top ? (
            <Card
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-40% -10% auto auto',
                  width: 320,
                  height: 320,
                  background:
                    'radial-gradient(circle, var(--accent-soft), transparent 70%)',
                  pointerEvents: 'none',
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent-ring)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <span className="dot-mainline" />
                  Today's drill
                </span>
                <span className="meta" style={{ marginLeft: 'auto' }}>
                  recommended · ~5 minutes
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                    margin: '4px 0 6px',
                  }}
                >
                  {top.name}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--inset-bg)',
                    border: '1px solid var(--inset-border)',
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text-dim)',
                    width: 'fit-content',
                  }}
                >
                  <Chip variant="mono" style={{ height: 20, padding: '0 6px' }}>
                    {top.study_kind === 'opening'
                      ? 'OPENING'
                      : top.study_kind === 'game'
                        ? 'GAME'
                        : 'TACTIC'}
                  </Chip>
                  assigned {relativeDate(top.assigned_at)}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 22,
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                <div style={{ width: 'min(220px, 100%)', aspectRatio: '1 / 1', flexShrink: 0 }}>
                  <FenBoard
                    fen={START_FEN}
                    size={220}
                    coordinates={false}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    flex: '1 1 260px',
                    minWidth: 0,
                  }}
                >
                  <div className="meta" style={{ fontSize: 14, lineHeight: 1.55 }}>
                    Pick up where you left off. The schedule will revisit the
                    positions you've seen before.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link
                      to={
                        `/student/study/${top.study_kind}/${top.study_id}`
                      }
                    >
                      <Btn variant="primary" size="lg">
                        Start drill →
                      </Btn>
                    </Link>
                    <Link
                      to={
                        `/student/study/${top.study_kind}/${top.study_id}`
                      }
                    >
                      <Btn variant="secondary" size="lg">Explore tree</Btn>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card style={{ padding: 32, textAlign: 'center' }}>
              <h2 className="t-h2" style={{ margin: 0 }}>No active assignments</h2>
              <p className="meta" style={{ marginTop: 8 }}>
                When a coach assigns a study, it'll show up here.
              </p>
            </Card>
          )}

          {/* all assignments */}
          <Card style={{ padding: '16px 18px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                rowGap: 10,
                columnGap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'baseline',
                  whiteSpace: 'nowrap',
                }}
              >
                <h2 className="t-h2" style={{ margin: 0 }}>
                  All assignments
                </h2>
                <span
                  className="mono"
                  style={{ color: 'var(--text-faint)', fontSize: 13 }}
                >
                  {rows.length}
                </span>
              </div>
              <Segmented<ActiveFilter>
                value={filter}
                onChange={setFilter}
                ariaLabel="Filter assignments by state"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visible.length === 0 ? (
                <div className="meta" style={{ padding: 12 }}>
                  No {filter === 'active' ? 'active' : 'completed'} assignments.
                </div>
              ) : (
                visible.map((a) => (
                  <AssignmentRowCard key={a.id} a={a} />
                ))
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card
            style={{
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Avatar name="—" size="lg" />
            <div style={{ flex: 1 }}>
              <div className="meta-strong" style={{ fontSize: 14 }}>
                Your trainer
              </div>
              <div className="meta" style={{ fontSize: 12 }}>
                {active.length} {active.length === 1 ? 'study' : 'studies'}{' '}
                assigned to you
              </div>
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 14,
              }}
            >
              <h2 className="t-h2" style={{ margin: 0 }}>Today</h2>
              <span className="meta">
                {Math.round(
                  rows.reduce((s, a) => s + a.progress_pct, 0) /
                    Math.max(1, rows.length),
                )}
                % average
              </span>
            </div>
            <ProgressBar
              pct={
                rows.reduce((s, a) => s + a.progress_pct, 0) /
                Math.max(1, rows.length)
              }
              height={6}
              ariaLabel="Today's average progress across assignments"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Chip variant="success">{done.length} done</Chip>
              <Chip>{active.length} active</Chip>
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <h2 className="t-h2" style={{ margin: '0 0 12px' }}>
              Activity
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rows.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '16px 1fr',
                    gap: 14,
                    alignItems: 'flex-start',
                    padding: '4px 0',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      marginTop: 7,
                      background: a.completed_at
                        ? 'var(--success)'
                        : 'var(--accent)',
                      boxShadow: a.completed_at
                        ? 'none'
                        : '0 0 8px var(--accent-glow)',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 13 }}>
                      {a.completed_at ? 'Completed' : 'Assigned'}{' '}
                      <strong>{a.name}</strong>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-faint)',
                        marginTop: 2,
                      }}
                    >
                      {relativeDate(a.completed_at ?? a.assigned_at)}
                    </div>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="meta">No activity yet.</div>
              )}
            </div>
          </Card>

          <Card
            style={{
              padding: 16,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconLamp size={16} strokeWidth={2.2} />
            </div>
            <div>
              <div className="meta-strong" style={{ fontSize: 13.5 }}>
                Tip · use the keyboard
              </div>
              <div className="meta" style={{ fontSize: 12.5, marginTop: 2 }}>
                In any drill, press <Kbd>↵</Kbd> to submit, <Kbd>Esc</Kbd> to skip,{' '}
                <Kbd>?</Kbd> for the full cheatsheet.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  value,
  label,
  accent = false,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={`${value} ${label}`}
      style={{
        padding: '12px 16px',
        background: 'var(--inset-bg)',
        border: '1px solid var(--inset-border)',
        borderRadius: 12,
        minWidth: 110,
      }}
    >
      <div
        className="mono"
        aria-hidden="true"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {value}
      </div>
      <div
        aria-hidden="true"
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function AssignmentRowCard({ a }: { a: AssignmentRow }) {
  const path = `/student/study/${a.study_kind}/${a.study_id}`;
  const isDone = a.completed_at != null;
  return (
    <Link to={path} className="assignment-row-link">
      <div className="assignment-row">
        <FenBoard fen={START_FEN} size={56} coordinates={false} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              marginBottom: 4,
            }}
          >
            {a.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              display: 'flex',
              gap: 8,
            }}
          >
            <span
              className="mono"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontSize: 10.5,
                color: 'var(--text-faint)',
              }}
            >
              {a.study_kind}
            </span>
            <span>· assigned {relativeDate(a.assigned_at)}</span>
            {isDone && <span>· completed {relativeDate(a.completed_at!)}</span>}
          </div>
        </div>
        <div className="hide-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
            }}
          >
            <span style={{ color: 'var(--text-dim)' }}>
              {a.progress_pct}% complete
            </span>
          </div>
          <ProgressBar
            pct={a.progress_pct}
            ariaLabel={`${a.name} progress`}
          />
        </div>
        {isDone ? (
          <span
            className="assignment-row-status"
            style={{
              color: 'var(--success)',
              fontSize: 12,
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <IconCheck size={14} strokeWidth={2.6} /> done
          </span>
        ) : a.progress_pct > 0 ? (
          <span
            className="assignment-row-status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-ring)',
            }}
          >
            in progress
          </span>
        ) : (
          <span className="chip assignment-row-status" style={{ color: 'var(--text-faint)' }}>
            <IconClock size={12} /> not started
          </span>
        )}
      </div>
    </Link>
  );
}
