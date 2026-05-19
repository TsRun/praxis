import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import {
  student,
  type OpeningStudyForStudent,
  type QuizCard,
} from '../lib/api';
import { pathToNode } from '../lib/opening-tree';
import { useOpeningTreeNav } from '../hooks/useOpeningTreeNav';
import {
  Card,
  Btn,
  Chip,
  MoveChip,
  Segmented,
  Kbd,
  ProgressBar,
  TurnDot,
} from '../components/ui/atoms';
import {
  IconBookOpen,
  IconTree,
  IconList,
  IconHelp,
  IconFlip,
  IconCheck,
  IconAlert,
  IconArrowL,
} from '../components/ui/Icons';

type Mode = 'drill' | 'tree' | 'chapters';

function plyLabel(ply: number) {
  return ply % 2 === 1 ? `${Math.ceil(ply / 2)}.` : `${Math.ceil(ply / 2)}…`;
}

function childrenOf<
  T extends { id: number; parent_id: number | null; is_main: boolean },
>(nodes: T[], parentId: number | null): T[] {
  return nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);
}

export function OpeningStudyViewer() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyForStudent | null>(null);
  const [mode, setMode] = useState<Mode>('drill');
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    student.opening(numId).then((s) => {
      setStudy(s);
      setFlip(s.side === 'b');
    });
  }, [numId]);

  if (!study)
    return (
      <div style={{ padding: 28, color: 'var(--text-faint)' }}>Loading…</div>
    );

  const dueCount = study.quiz_state.filter(
    (q) => new Date(q.next_due_at).getTime() <= Date.now(),
  ).length;
  const mastered = study.quiz_state.filter((q) => q.correct_streak >= 3).length;
  const totalChapters = study.chapters.length;
  // Cheap "seen" proxy: chapters where any quiz attempt logged.
  const seen = Math.min(
    totalChapters,
    study.quiz_state.filter((q) => q.last_seen_at).length,
  );
  const pct = totalChapters > 0 ? Math.round((seen / totalChapters) * 100) : 0;

  return (
    <div
      style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '24px 28px 80px',
      }}
    >
      {/* progress hero */}
      <Card
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '18px 22px',
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--accent-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <IconBookOpen size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'baseline',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>{study.name}</div>
            <div
              className="mono"
              style={{ fontSize: 13, color: 'var(--text-dim)' }}
            >
              {seen} / {totalChapters} chapters · {pct}%
            </div>
          </div>
          <ProgressBar pct={pct} className="" />
          <div
            style={{
              display: 'flex',
              gap: 14,
              marginTop: 6,
              color: 'var(--text-dim)',
              fontSize: 12,
            }}
          >
            <span>plays {study.side === 'w' ? 'white' : 'black'}</span>
            <span>· {dueCount} due now</span>
            <span>· {mastered} mastered</span>
          </div>
        </div>
        <Link
          to="/student/dashboard"
          style={{
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
            color: 'var(--text-dim)',
            fontSize: 13,
          }}
        >
          <IconArrowL size={14} /> Dashboard
        </Link>
      </Card>

      {/* mode tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          margin: '18px 0',
        }}
      >
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'drill',    label: <><IconHelp size={13} strokeWidth={2} />Drill</> },
            { value: 'tree',     label: <><IconTree size={13} strokeWidth={2} />Explore tree</> },
            { value: 'chapters', label: <><IconList size={13} strokeWidth={2} />Chapters</> },
          ]}
        />
        <div style={{ flex: 1 }} />
      </div>

      {mode === 'drill' && (
        <DrillView
          study={study}
          flip={flip}
          setFlip={setFlip}
          onAdvance={() => student.opening(numId).then(setStudy)}
          dueCount={dueCount}
          mastered={mastered}
        />
      )}
      {mode === 'tree' && (
        <TreeMode study={study} flip={flip} setFlip={setFlip} />
      )}
      {mode === 'chapters' && (
        <ChaptersView study={study} flip={flip} setFlip={setFlip} />
      )}
    </div>
  );
}

/* ─────────────────────────── Drill mode ────────────────────────── */

function DrillView({
  study,
  flip,
  setFlip,
  onAdvance,
  dueCount,
  mastered,
}: {
  study: OpeningStudyForStudent;
  flip: boolean;
  setFlip: (v: boolean) => void;
  onAdvance: () => void;
  dueCount: number;
  mastered: number;
}) {
  const [card, setCard] = useState<QuizCard | null | undefined>(undefined);
  const [feedback, setFeedback] = useState<
    | null
    | {
        correct: boolean;
        expected: string;
        chapter: { title: string | null; body_md: string } | null;
      }
  >(null);
  const [streak, setStreak] = useState(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  async function loadNext() {
    setFeedback(null);
    const res = await student.nextQuiz(study.id);
    setCard(res.card);
  }

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.id]);

  useEffect(() => {
    if (!card || !boardRef.current) return;
    const fen = `${card.parent_fen} 0 1`;
    const c = new Chess(fen);
    const turnColor: 'white' | 'black' = c.turn() === 'w' ? 'white' : 'black';
    const dests = new Map<Key, Key[]>();
    for (const m of c.moves({ verbose: true })) {
      const from = m.from as Key;
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from)!.push(m.to as Key);
    }
    cgRef.current = Chessground(boardRef.current, {
      fen,
      turnColor,
      orientation: flip ? 'black' : 'white',
      movable: {
        free: false,
        color: turnColor,
        dests,
        events: {
          after: async (from, to) => {
            if (!card) return;
            const cc = new Chess(fen);
            let m;
            try {
              m = cc.move({ from, to, promotion: 'q' });
            } catch {
              m = null;
            }
            if (!m) return;
            const res = await student.quizAttempt(study.id, card.node_id, m.san);
            setFeedback({
              correct: res.correct,
              expected: res.expected_san,
              chapter: res.chapter,
            });
            if (res.correct) setStreak((s) => s + 1);
            else setStreak(0);
            onAdvance();
          },
        },
      },
      draggable: { showGhost: true },
      animation: { duration: 150 },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.node_id]);

  useEffect(() => {
    cgRef.current?.set({ orientation: flip ? 'black' : 'white' });
  }, [flip]);

  if (card === undefined) {
    return <div className="meta">Loading…</div>;
  }
  if (card === null) {
    return (
      <Card style={{ padding: 32, textAlign: 'center' }}>
        <h2 className="t-h2" style={{ margin: '0 0 8px' }}>
          ✓ All caught up.
        </h2>
        <p className="meta">
          No cards are due right now. Come back later to keep your repertoire fresh.
        </p>
      </Card>
    );
  }

  const turn = study.side === 'w' ? 'w' : 'b';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '520px 1fr',
        gap: 24,
        alignItems: 'start',
      }}
    >
      {/* board col */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--inset-bg)',
            border: '1px solid var(--inset-border)',
          }}
        >
          <TurnDot side={turn === 'w' ? 'w' : 'b'} />
          <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>
            {turn === 'w' ? 'White' : 'Black'} to play · your prepared move
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            <Kbd>Drag</Kbd> a piece
          </span>
        </div>

        <div ref={boardRef} style={{ width: 520, height: 520 }} />

        <Card
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Line so far
          </span>
          <div
            className="mono"
            style={{
              fontSize: 14,
              letterSpacing: '-0.01em',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {card.opponent_line.length === 0 ? (
              <span style={{ color: 'var(--text-faint)' }}>
                root — your move
              </span>
            ) : (
              card.opponent_line.map((m, i) => {
                const last = i === card.opponent_line.length - 1;
                return (
                  <span key={i}>
                    {i > 0 && ' '}
                    {last ? (
                      <span
                        style={{
                          background: 'var(--accent-soft)',
                          color: 'var(--text)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {m}
                      </span>
                    ) : (
                      <span style={{ color: i % 2 === 0 ? 'var(--text-faint)' : undefined }}>
                        {m}
                      </span>
                    )}
                  </span>
                );
              })
            )}
            <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 4 }}>
              ?
            </span>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => setFlip(!flip)}>
            <IconFlip size={12} strokeWidth={2.4} /> Flip
          </Btn>
        </Card>
      </div>

      {/* right: stats + feedback + up-next */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
          }}
        >
          <StatBox
            label="Streak"
            value={streak}
            sub="answers in a row"
            accent
          />
          <StatBox label="Due now" value={dueCount} sub="cards waiting" />
          <StatBox label="Mastered" value={mastered} sub="positions" />
        </div>

        {feedback === null ? (
          <Card style={{ padding: '22px 24px' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.015em',
              }}
            >
              Find your prepared move.
            </div>
            <div
              style={{
                color: 'var(--text-dim)',
                marginTop: 4,
                fontSize: 14,
              }}
            >
              Drag a piece on the board to play. If you need help, reveal it.
            </div>
            <div
              style={{
                marginTop: 18,
                display: 'flex',
                gap: 10,
              }}
            >
              <Btn variant="ghost" onClick={() => {
                setFeedback({
                  correct: false,
                  expected: '—',
                  chapter: null,
                });
                setStreak(0);
              }}>
                <IconAlert size={12} strokeWidth={2.4} />
                I don't know
              </Btn>
              <Btn variant="ghost" onClick={loadNext}>
                Skip
              </Btn>
            </div>
          </Card>
        ) : feedback.correct ? (
          <Card
            style={{
              padding: '16px 18px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              background: 'var(--success-bg)',
              boxShadow: 'inset 0 0 0 1px rgba(52,211,153,0.30)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'rgba(52,211,153,0.18)',
                color: 'var(--success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconCheck size={20} strokeWidth={2.6} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                Correct —{' '}
                <span
                  className="mono"
                  style={{ color: 'var(--text)' }}
                >
                  {feedback.expected}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {feedback.chapter?.title ?? 'Nice — bringing this back later.'}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <Btn variant="primary" onClick={loadNext}>
                  Next position →
                </Btn>
              </div>
            </div>
          </Card>
        ) : (
          <Card
            style={{
              padding: '16px 18px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              background: 'var(--danger-bg)',
              boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.30)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'rgba(248,113,113,0.18)',
                color: 'var(--danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconAlert size={20} strokeWidth={2.6} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                Not the prepared move. The line plays{' '}
                <span className="mono" style={{ color: 'var(--text)' }}>
                  {feedback.expected}
                </span>
                .
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {feedback.chapter?.title ?? 'Coming back to this position sooner.'}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <Btn variant="primary" onClick={loadNext}>
                  Continue
                </Btn>
              </div>
            </div>
          </Card>
        )}

        {/* up next queue */}
        <Card style={{ padding: '18px 20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 14,
            }}
          >
            <h2 className="t-h2" style={{ margin: 0 }}>Up next</h2>
            <span className="meta">in this session</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {study.quiz_state.length === 0 ? (
              <div className="meta" style={{ padding: '4px 8px' }}>
                No queued cards. You've cleared this study for now.
              </div>
            ) : (
              study.quiz_state.slice(0, 4).map((q) => {
                const n = study.nodes.find((nn) => nn.id === q.node_id);
                if (!n) return null;
                const chap = study.chapters.find((c) => c.node_id === q.node_id);
                const due = new Date(q.next_due_at).getTime();
                const diff = due - Date.now();
                const badge =
                  diff < 60_000
                    ? 'due now'
                    : diff < 3600_000
                      ? `in ${Math.round(diff / 60000)} min`
                      : diff < 86_400_000
                        ? `in ${Math.round(diff / 3600000)} h`
                        : `${Math.round(diff / 86_400_000)} d`;
                const isActive = card?.node_id === q.node_id;
                return (
                  <div
                    key={q.node_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: isActive ? 'var(--accent-soft)' : 'transparent',
                      boxShadow: isActive
                        ? 'inset 0 0 0 1px var(--accent-ring)'
                        : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span className={n.is_main ? 'dot-mainline' : 'dot-chapter'} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
                          {chap?.title ?? `ply ${n.ply} · ${n.san}`}
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 12.5,
                            color: 'var(--text-dim)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {pathToNode(study.nodes, n.id)
                            .map((p) => p.san)
                            .join(' ')}
                        </div>
                      </div>
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: isActive ? 'var(--accent)' : 'var(--text-faint)',
                      }}
                    >
                      {badge}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: number | string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--inset-bg)',
        border: '1px solid var(--inset-border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {value}
        {accent && (
          <span style={{ fontSize: 11, color: 'var(--success)' }}> ▲</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
}

/* ─────────────────────────── Tree mode ────────────────────────── */

function TreeMode({
  study,
  flip,
  setFlip,
}: {
  study: OpeningStudyForStudent;
  flip: boolean;
  setFlip: (v: boolean) => void;
}) {
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  useOpeningTreeNav(study.nodes, currentNodeId, setCurrentNodeId);
  const currentNode = useMemo(
    () => study.nodes.find((n) => n.id === currentNodeId) ?? null,
    [study, currentNodeId],
  );
  const currentChapter = useMemo(
    () => study.chapters.find((c) => c.node_id === currentNodeId) ?? null,
    [study, currentNodeId],
  );
  const path = pathToNode(study.nodes, currentNodeId);
  const fen = currentNode?.fen ?? study.root_fen;
  const lastMove = currentNode?.uci ?? null;
  const candidates = childrenOf(study.nodes, currentNodeId);
  const chaptersSet = new Set(study.chapters.map((c) => c.node_id));
  const titleByNode = new Map(
    study.chapters.map((c) => [c.node_id, c.title] as const),
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '520px 1fr',
        gap: 24,
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="overline" style={{ flex: 1 }}>
            {currentNode
              ? `After ${plyLabel(currentNode.ply)} ${currentNode.san}`
              : 'Start position'}
          </span>
          <Btn variant="ghost" size="sm" onClick={() => setFlip(!flip)}>
            <IconFlip size={12} strokeWidth={2.4} /> Flip
          </Btn>
        </div>
        <FixedReadOnlyBoard fen={fen} lastMove={lastMove} flip={flip} />
        {currentChapter && (
          <Card
            style={{
              padding: '14px 16px',
              borderLeft: '3px solid var(--success)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span className="dot-chapter" />
            <div
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              {currentChapter.title ?? '(untitled)'}
            </div>
          </Card>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ padding: '16px 18px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <h2 className="t-h2" style={{ margin: 0 }}>Replies from this position</h2>
            <span className="meta">read-only</span>
          </div>
          {candidates.length === 0 ? (
            <div
              style={{
                padding: 18,
                borderRadius: 12,
                border: '1px dashed var(--inset-border)',
                color: 'var(--text-dim)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No more moves explored from this position.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map((c) => {
                const title = titleByNode.get(c.id) ?? null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCurrentNodeId(c.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: c.is_main ? 'var(--accent-soft)' : 'var(--chip-bg)',
                      border: `1px solid ${c.is_main ? 'var(--accent-ring)' : 'var(--chip-border)'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'inherit',
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        fontWeight: 600,
                        fontSize: 18,
                        letterSpacing: '-0.01em',
                        color: 'var(--text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {c.is_main && (
                        <span style={{ color: 'var(--accent)', fontSize: 14 }}>★</span>
                      )}
                      {c.san}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
                        {title ?? 'No chapter — continues main line'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {c.is_main ? 'your prepared move' : 'side variation'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card style={{ padding: '14px 16px' }}>
          <div
            style={{
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <h2 className="t-h2" style={{ margin: 0 }}>Path</h2>
            <span className="meta">click any chip to jump</span>
          </div>
          <div className="crumbs">
            <button
              type="button"
              onClick={() => setCurrentNodeId(null)}
              className={currentNodeId == null ? 'current' : ''}
            >
              start
            </button>
            {path.map((n) => (
              <span
                key={n.id}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <span className="sep">›</span>
                <button
                  type="button"
                  onClick={() => setCurrentNodeId(n.id)}
                  className={n.id === currentNodeId ? 'current' : ''}
                >
                  <span className="ply-num">{plyLabel(n.ply)}</span>
                  {n.san}
                </button>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {path.map((n) => (
              <MoveChip
                key={`mc-${n.id}`}
                san={n.san}
                minor
                mainline={n.is_main}
                hasChapter={chaptersSet.has(n.id)}
                selected={n.id === currentNodeId}
                onClick={() => setCurrentNodeId(n.id)}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function FixedReadOnlyBoard({
  fen,
  lastMove,
  flip,
}: {
  fen: string;
  lastMove: string | null;
  flip: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    cgRef.current = Chessground(ref.current, {
      fen,
      orientation: flip ? 'black' : 'white',
      viewOnly: true,
      coordinates: true,
      lastMove:
        lastMove && lastMove.length >= 4
          ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [Key, Key])
          : undefined,
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cgRef.current) return;
    cgRef.current.set({
      fen,
      orientation: flip ? 'black' : 'white',
      lastMove:
        lastMove && lastMove.length >= 4
          ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [Key, Key])
          : undefined,
    });
  }, [fen, lastMove, flip]);

  return <div ref={ref} style={{ width: 520, height: 520 }} />;
}

/* ─────────────────────────── Chapters view (student) ────────────────────────── */

function ChaptersView({
  study,
  flip,
  setFlip,
}: {
  study: OpeningStudyForStudent;
  flip: boolean;
  setFlip: (v: boolean) => void;
}) {
  const chapters = useMemo(() => {
    const byNode = new Map(
      study.chapters.map((c) => [c.node_id, c.title] as const),
    );
    return study.nodes
      .filter((n) => byNode.has(n.id))
      .map((n) => ({ node: n, title: byNode.get(n.id) ?? '' }))
      .sort((a, b) => a.node.ply - b.node.ply || a.node.id - b.node.id);
  }, [study]);

  const [sel, setSel] = useState<number | null>(chapters[0]?.node.id ?? null);
  const selChap = chapters.find((c) => c.node.id === sel);
  const node = selChap?.node ?? null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 520px',
        gap: 24,
        alignItems: 'start',
      }}
    >
      <Card style={{ padding: '14px 18px' }}>
        <h2 className="t-h2" style={{ margin: '4px 0 12px' }}>
          Chapters · {chapters.length}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {chapters.length === 0 ? (
            <div className="meta" style={{ padding: 12 }}>
              No chapters in this study yet.
            </div>
          ) : (
            chapters.map((c) => {
              const active = c.node.id === sel;
              return (
                <button
                  type="button"
                  key={c.node.id}
                  onClick={() => setSel(c.node.id)}
                  className="row-link"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr auto',
                    gap: 12,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    textAlign: 'left',
                  }}
                >
                  <span className="dot-chapter" />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14.5 }}>{c.title}</div>
                    <div
                      className="mono"
                      style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}
                    >
                      {pathToNode(study.nodes, c.node.id)
                        .map((n) => n.san)
                        .join(' ')}
                    </div>
                  </div>
                  <Chip variant="mono" style={{ height: 22 }}>
                    ply {c.node.ply}
                  </Chip>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          position: 'sticky',
          top: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="overline" style={{ flex: 1 }}>
            {selChap?.title ?? 'No chapter selected'}
          </span>
          <Btn variant="ghost" size="sm" onClick={() => setFlip(!flip)}>
            <IconFlip size={12} strokeWidth={2.4} /> Flip
          </Btn>
        </div>
        <FixedReadOnlyBoard
          fen={node?.fen ?? study.root_fen}
          lastMove={node?.uci ?? null}
          flip={flip}
        />
      </div>
    </div>
  );
}
