import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/board/ChessBoard';
import { MoveList } from '../components/board/MoveList';
import { useGameStore } from '../store/gameStore';
import { student, type GameStudyForStudent } from '../lib/api';
import { Card, Btn, Chip } from '../components/ui/atoms';
import { IconCheck, IconAlert } from '../components/ui/Icons';

type QuizState =
  | { ply: number; phase: 'asking' }
  | {
      ply: number;
      phase: 'revealed';
      correct: boolean;
      expected: string;
      comment: string | null;
    }
  | null;

export function GameStudyViewer() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<GameStudyForStudent | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>(null);

  const currentPly = useGameStore((s) => s.currentPly);
  const goToPly = useGameStore((s) => s.goToPly);
  const loadLine = useGameStore((s) => s.loadLine);

  useEffect(() => {
    student.game(numId).then((s) => {
      setStudy(s);
      const c = new Chess();
      try {
        c.loadPgn(s.pgn);
      } catch {
        /* ignore */
      }
      loadLine(c.history(), 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numId]);

  useEffect(() => {
    if (!study) return;
    const a = study.annotations.find((x) => x.ply === currentPly);
    const already = study.attempts.find((x) => x.ply === currentPly);
    if (a?.is_quiz && !already) {
      goToPly(currentPly - 1);
      setQuizState({ ply: currentPly, phase: 'asking' });
    }
  }, [currentPly, study, goToPly]);

  async function submitGuess(attemptedSan: string) {
    if (!study || !quizState || quizState.phase !== 'asking') return;
    const res = await student.attempt(study.id, quizState.ply, attemptedSan);
    setQuizState({
      ply: quizState.ply,
      phase: 'revealed',
      correct: res.correct,
      expected: res.expected_san ?? '?',
      comment: res.comment_md,
    });
    setStudy((prev) =>
      prev
        ? {
            ...prev,
            attempts: [
              ...prev.attempts.filter((a) => a.ply !== quizState.ply),
              {
                ply: quizState.ply,
                attempted_san: attemptedSan,
                correct: res.correct,
              },
            ],
          }
        : prev,
    );
  }

  if (!study)
    return (
      <div style={{ padding: 28, color: 'var(--text-faint)' }}>Loading…</div>
    );
  const noteByPly = new Map(
    study.annotations.map((a) => [a.ply, a] as const),
  );

  return (
    <div
      style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '24px 28px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div>
        <h1 className="t-h1" style={{ margin: 0 }}>{study.name}</h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 8,
          }}
        >
          <Chip variant="mono">PGN</Chip>
          <Chip>{study.headers_json?.White ?? '—'}</Chip>
          <span className="meta">vs</span>
          <Chip>{study.headers_json?.Black ?? '—'}</Chip>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 360px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div style={{ position: 'relative' }}>
          <ChessBoard />
          {quizState?.phase === 'asking' && (
            <QuizPrompt onGuess={submitGuess} />
          )}
        </div>
        <Card style={{ padding: 16, overflow: 'auto', maxHeight: '80vh' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <h2 className="overline">Move list</h2>
            <label
              style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={showComments}
                onChange={(e) => setShowComments(e.target.checked)}
              />
              comments
            </label>
          </div>
          <MoveList />
          {showComments && noteByPly.get(currentPly)?.comment_md && (
            <Card
              style={{
                marginTop: 12,
                padding: 12,
                background: 'var(--inset-bg)',
                border: '1px solid var(--inset-border)',
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {noteByPly.get(currentPly)!.comment_md!}
              </div>
            </Card>
          )}
        </Card>
        <Card
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div className="overline">Progress</div>
          <div style={{ fontSize: 14 }}>
            <strong className="mono">
              {study.attempts.filter((a) => a.correct).length}
            </strong>{' '}
            /{' '}
            <span className="mono">
              {study.annotations.filter((a) => a.is_quiz).length}
            </span>{' '}
            quizzes correct
          </div>
          {quizState?.phase === 'revealed' && (
            <Card
              style={{
                padding: 14,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                background: quizState.correct
                  ? 'var(--success-bg)'
                  : 'var(--danger-bg)',
                boxShadow: `inset 0 0 0 1px ${
                  quizState.correct
                    ? 'rgba(52,211,153,0.30)'
                    : 'rgba(248,113,113,0.30)'
                }`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: quizState.correct
                    ? 'rgba(52,211,153,0.18)'
                    : 'rgba(248,113,113,0.18)',
                  color: quizState.correct
                    ? 'var(--success)'
                    : 'var(--danger)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {quizState.correct ? (
                  <IconCheck size={16} strokeWidth={2.6} />
                ) : (
                  <IconAlert size={16} strokeWidth={2.6} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {quizState.correct
                    ? 'Correct'
                    : `Played: ${quizState.expected}`}
                </div>
                {quizState.comment && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-dim)',
                      whiteSpace: 'pre-wrap',
                      marginTop: 4,
                    }}
                  >
                    {quizState.comment}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      goToPly(quizState.ply);
                      setQuizState(null);
                    }}
                  >
                    Continue →
                  </Btn>
                </div>
              </div>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
}

function QuizPrompt({ onGuess }: { onGuess: (san: string) => void }) {
  const [guess, setGuess] = useState('');
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        borderRadius: 10,
      }}
    >
      <Card
        style={{
          padding: 18,
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div className="t-h3">What would you play?</div>
        <input
          className="input font-mono"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="enter SAN (e.g. Nf3)"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && guess.trim()) onGuess(guess.trim());
          }}
        />
        <Btn
          variant="primary"
          disabled={!guess.trim()}
          onClick={() => onGuess(guess.trim())}
        >
          Submit
        </Btn>
      </Card>
    </div>
  );
}
