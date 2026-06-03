import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  trainerStudent,
  trainerStudies,
  trainerGames,
  trainerTactics,
  type StudentDetail,
  type OpeningStudySummary,
  type GameStudySummary,
  type TacticSetSummary,
} from '../lib/api';
import { Card, Btn, Chip, Avatar } from '../components/ui/atoms';
import { IconCheck, IconClock } from '../components/ui/Icons';

export function StudentDetailPage() {
  const { id } = useParams();
  const numId = Number(id);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opens, setOpens] = useState<OpeningStudySummary[]>([]);
  const [games, setGames] = useState<GameStudySummary[]>([]);
  const [tactics, setTactics] = useState<TacticSetSummary[]>([]);

  async function refresh() {
    try {
      setLoadError(null);
      setDetail(await trainerStudent.get(numId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load student');
    }
  }
  useEffect(() => {
    refresh();
  }, [numId]);
  useEffect(() => {
    trainerStudies.list().then(setOpens);
    trainerGames.list().then(setGames);
    trainerTactics.list().then(setTactics);
  }, []);

  async function assign(kind: 'opening' | 'game' | 'tactic', studyId: number) {
    await trainerStudent.assign(numId, kind, studyId);
    refresh();
  }

  if (loadError)
    return (
      <div
        className="page-wrap"
        style={{ paddingTop: 32, paddingBottom: 100 }}
        role="alert"
      >
        <Card
          style={{
            padding: '24px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <h1 className="t-h2" style={{ margin: 0 }}>Couldn’t load this student</h1>
          <div className="meta">{loadError}</div>
          <Link to="/trainer/students" style={{ marginTop: 6 }}>
            <Btn variant="secondary">← Back to students</Btn>
          </Link>
        </Card>
      </div>
    );

  if (!detail)
    return (
      <div
        style={{ padding: 28, color: 'var(--text-faint)' }}
        role="status"
        aria-live="polite"
      >
        Loading…
      </div>
    );

  const assignedIds = new Set(
    detail.assignments.map((a) => `${a.study_kind}:${a.study_id}`),
  );

  return (
    <div
      className="page-wrap"
      style={{
        paddingTop: 32,
        paddingBottom: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <Card
        style={{
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <Avatar name={detail.name} size="xl" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="t-h1" style={{ margin: 0 }}>{detail.name}</h1>
          <div className="meta" style={{ marginTop: 6 }}>{detail.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Chip variant="success">● Linked</Chip>
          <Chip mono>{detail.assignments.length} assigned</Chip>
        </div>
      </Card>

      <section>
        <h2 className="t-h2" style={{ margin: '0 0 12px' }}>
          Assigned studies
        </h2>
        {detail.assignments.length === 0 ? (
          <div className="meta">No assignments yet.</div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {detail.assignments.map((a) => (
              <Card
                key={a.id}
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <Chip variant="mono">{a.study_kind.toUpperCase()}</Chip>
                <strong style={{ fontSize: 14, minWidth: 0, flex: '1 1 auto' }}>{a.name}</strong>
                <span style={{ marginLeft: 'auto' }} className="meta hide-mobile">
                  {a.completed_at ? (
                    <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <IconCheck size={14} strokeWidth={2.6} />
                      completed {new Date(a.completed_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <IconClock size={14} />
                      in progress
                    </span>
                  )}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="t-h2" style={{ margin: '0 0 12px' }}>
          Assign new
        </h2>
        <div className="grid-2" style={{ alignItems: 'start', gap: 16 }}>
          <Card style={{ padding: 14 }}>
            <h3 className="t-h3" style={{ margin: '0 0 10px' }}>Opening studies</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {opens.length === 0 && (
                <div className="meta" style={{ padding: 10 }}>
                  No opening studies.
                </div>
              )}
              {opens.map((s) => {
                const already = assignedIds.has(`opening:${s.id}`);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--inset-bg)',
                      border: '1px solid var(--inset-border)',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 13.5 }}>{s.name}</span>
                    <Btn
                      variant={already ? 'ghost' : 'secondary'}
                      size="sm"
                      disabled={already}
                      onClick={() => assign('opening', s.id)}
                    >
                      {already ? 'Assigned' : '+ Assign'}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card style={{ padding: 14 }}>
            <h3 className="t-h3" style={{ margin: '0 0 10px' }}>Game studies</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {games.length === 0 && (
                <div className="meta" style={{ padding: 10 }}>
                  No game studies.
                </div>
              )}
              {games.map((s) => {
                const already = assignedIds.has(`game:${s.id}`);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--inset-bg)',
                      border: '1px solid var(--inset-border)',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 13.5 }}>{s.name}</span>
                    <Btn
                      variant={already ? 'ghost' : 'secondary'}
                      size="sm"
                      disabled={already}
                      onClick={() => assign('game', s.id)}
                    >
                      {already ? 'Assigned' : '+ Assign'}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card style={{ padding: 14 }}>
            <h3 className="t-h3" style={{ margin: '0 0 10px' }}>Tactical sets</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tactics.length === 0 && (
                <div className="meta" style={{ padding: 10 }}>
                  No tactical sets.
                </div>
              )}
              {tactics.map((s) => {
                const already = assignedIds.has(`tactic:${s.id}`);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--inset-bg)',
                      border: '1px solid var(--inset-border)',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 13.5 }}>{s.name}</span>
                    <Btn
                      variant={already ? 'ghost' : 'secondary'}
                      size="sm"
                      disabled={already}
                      onClick={() => assign('tactic', s.id)}
                    >
                      {already ? 'Assigned' : '+ Assign'}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
