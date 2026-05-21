import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import {
  student,
  type TacticPuzzle,
  type TacticSetForStudent,
} from '../lib/api';
import { Card, Btn, Chip, MoveChip } from '../components/ui/atoms';
import { BoardToolbar } from '../components/BoardToolbar';
import {
  IconBolt,
  IconCheck,
  IconX,
  IconArrowL,
  IconArrowR,
} from '../components/ui/Icons';

type Status =
  | { kind: 'solving'; expectedIndex: number }
  | { kind: 'wrong'; revealed: true }
  | { kind: 'solved' };

const OPPONENT_REPLY_DELAY_MS = 450;

export function TacticSetViewer() {
  const { id } = useParams();
  const numId = Number(id);
  const nav = useNavigate();

  const [set, setSet] = useState<TacticSetForStudent | null>(null);
  const [solvedIds, setSolvedIds] = useState<Set<number>>(new Set());
  const [index, setIndex] = useState(0);
  const [playedSans, setPlayedSans] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'solving', expectedIndex: 0 });

  useEffect(() => {
    student.tactic(numId).then((s) => {
      setSet(s);
      setSolvedIds(new Set(s.solved_ids));
    });
  }, [numId]);

  const puzzle: TacticPuzzle | null = set?.puzzles[index] ?? null;
  const completed = set != null && index >= set.puzzles.length;

  // When the puzzle changes, reset board + status.
  useEffect(() => {
    if (!puzzle) return;
    setPlayedSans([]);
    setStatus({ kind: 'solving', expectedIndex: 0 });
  }, [puzzle?.id]);

  function attemptMove(san: string) {
    if (!puzzle || status.kind !== 'solving') return;
    const expected = puzzle.solution_san[status.expectedIndex];
    if (san !== expected) {
      // Wrong — log and reveal solution.
      setStatus({ kind: 'wrong', revealed: true });
      student
        .tacticAttempt(numId, puzzle.id, false)
        .catch(() => {/* best effort */});
      return;
    }
    const nextSans = [...playedSans, san];
    const nextIndex = status.expectedIndex + 1;
    setPlayedSans(nextSans);
    if (nextIndex >= puzzle.solution_san.length) {
      // Student's last move was the final solution ply.
      setStatus({ kind: 'solved' });
      setSolvedIds((prev) => new Set(prev).add(puzzle.id));
      student
        .tacticAttempt(numId, puzzle.id, true)
        .catch(() => {/* best effort */});
      return;
    }
    setStatus({ kind: 'solving', expectedIndex: nextIndex });
  }

  // After a correct student ply, auto-play the opponent reply (if any).
  useEffect(() => {
    if (!puzzle || status.kind !== 'solving') return;
    if (status.expectedIndex === 0) return; // initial position
    if (status.expectedIndex >= puzzle.solution_san.length) return;
    // Whose turn is it now? Opponent if expectedIndex is odd, else student.
    // We model that by: solver always plays even-indexed moves (0, 2, 4 …);
    // opponent plays odd-indexed (1, 3 …). So if the next index is odd, the
    // opponent's reply is queued.
    if (status.expectedIndex % 2 !== 1) return;
    const opponentSan = puzzle.solution_san[status.expectedIndex];
    const t = setTimeout(() => {
      setPlayedSans((prev) => [...prev, opponentSan]);
      setStatus((s) =>
        s.kind === 'solving'
          ? { kind: 'solving', expectedIndex: s.expectedIndex + 1 }
          : s,
      );
    }, OPPONENT_REPLY_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, puzzle]);

  function next() {
    if (!set) return;
    setIndex((i) => Math.min(i + 1, set.puzzles.length));
  }
  function prev() {
    setIndex((i) => Math.max(i - 1, 0));
  }
  function skip() {
    if (!puzzle || status.kind !== 'solving') return;
    student
      .tacticAttempt(numId, puzzle.id, false)
      .catch(() => {/* best effort */});
    setStatus({ kind: 'wrong', revealed: true });
  }

  if (!set) {
    return (
      <div className="page-wrap" style={{ paddingTop: 32 }}>
        <div className="meta">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page-wrap" style={{ paddingTop: 32, paddingBottom: 100 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <Btn variant="ghost" size="sm" onClick={() => nav('/student/dashboard')}>
          <IconArrowL size={13} strokeWidth={2.4} />
          Dashboard
        </Btn>
        <Chip variant="strong">
          <IconBolt size={11} strokeWidth={2.4} />
          Tactical set
        </Chip>
        <h1 className="t-h1" style={{ flex: 1, minWidth: 240, margin: 0 }}>
          {set.name}
        </h1>
        <Chip variant="mono">
          {Math.min(index + 1, set.puzzles.length)} / {set.puzzles.length}
        </Chip>
        <Chip variant={solvedIds.size === set.puzzles.length ? 'success' : 'default'}>
          {solvedIds.size} solved
        </Chip>
      </div>

      {completed ? (
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <h2 className="t-h2">End of set</h2>
          <p className="meta">
            You answered {solvedIds.size} of {set.puzzles.length} puzzles
            correctly. Come back tomorrow to drill the ones you missed.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              marginTop: 14,
            }}
          >
            <Btn variant="ghost" onClick={prev}>
              <IconArrowL size={13} strokeWidth={2.4} />
              Back to last puzzle
            </Btn>
            <Btn variant="primary" onClick={() => nav('/student/dashboard')}>
              Done
            </Btn>
          </div>
        </Card>
      ) : (
        <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
          {/* LEFT — board */}
          <div>
            <PuzzleBoard
              key={puzzle!.id}
              startFen={puzzle!.fen}
              playedSans={playedSans}
              disabled={status.kind !== 'solving'}
              onMove={attemptMove}
            />
          </div>

          {/* RIGHT — control panel */}
          <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 className="t-h2" style={{ margin: 0 }}>
                Puzzle {index + 1}
              </h2>
              <span className="meta">
                {sideToMove(puzzle!.fen)} to move
              </span>
            </div>

            {status.kind === 'solving' && (
              <>
                <p className="meta">
                  Find the {puzzle!.solution_san.length === 1 ? 'best move' : 'winning line'}.
                  Drag a piece on the board to play.
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--inset-bg)',
                    border: '1px solid var(--inset-border)',
                    minHeight: 38,
                  }}
                >
                  {playedSans.length === 0 && (
                    <span className="meta" style={{ fontSize: 12 }}>
                      —
                    </span>
                  )}
                  {playedSans.map((san, i) => (
                    <MoveChip key={i} san={san} ply={i + 1} mainline minor />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={skip}>
                    Skip — show solution
                  </Btn>
                </div>
              </>
            )}

            {status.kind === 'wrong' && (
              <>
                <Chip variant="danger">
                  <IconX size={11} strokeWidth={2.4} />
                  Not quite — here's the solution
                </Chip>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--inset-bg)',
                    border: '1px solid var(--inset-border)',
                  }}
                >
                  {puzzle!.solution_san.map((san, i) => (
                    <MoveChip key={i} san={san} ply={i + 1} mainline minor />
                  ))}
                </div>
                {puzzle!.comment_md && (
                  <p style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    {puzzle!.comment_md}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Btn variant="primary" onClick={next}>
                    Next puzzle
                    <IconArrowR size={13} strokeWidth={2.4} />
                  </Btn>
                </div>
              </>
            )}

            {status.kind === 'solved' && (
              <>
                <Chip variant="success">
                  <IconCheck size={11} strokeWidth={2.4} />
                  Solved
                </Chip>
                {puzzle!.comment_md && (
                  <p style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    {puzzle!.comment_md}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Btn variant="primary" onClick={next}>
                    Next puzzle
                    <IconArrowR size={13} strokeWidth={2.4} />
                  </Btn>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
              <Btn variant="ghost" size="sm" onClick={prev} disabled={index === 0}>
                <IconArrowL size={13} strokeWidth={2.4} />
                Previous
              </Btn>
              <Btn variant="ghost" size="sm" onClick={next}>
                Next
                <IconArrowR size={13} strokeWidth={2.4} />
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function sideToMove(fen: string): 'White' | 'Black' {
  return (fen.split(' ')[1] ?? 'w') === 'w' ? 'White' : 'Black';
}

function PuzzleBoard({
  startFen,
  playedSans,
  disabled,
  onMove,
}: {
  startFen: string;
  playedSans: string[];
  disabled: boolean;
  onMove: (san: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  const currentFen = useMemo(() => {
    try {
      const c = new Chess(startFen);
      for (const san of playedSans) c.move(san);
      return c.fen();
    } catch {
      return startFen;
    }
  }, [startFen, playedSans]);

  const orientation: 'white' | 'black' =
    (startFen.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black';

  function destsFrom(fen: string): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    try {
      const c = new Chess(fen);
      for (const m of c.moves({ verbose: true })) {
        const from = m.from as Key;
        if (!dests.has(from)) dests.set(from, []);
        dests.get(from)!.push(m.to as Key);
      }
    } catch {
      /* bad FEN */
    }
    return dests;
  }

  function handleAfter(from: Key, to: Key) {
    try {
      const c = new Chess(currentFen);
      const m = c.move({ from, to, promotion: 'q' });
      if (m) onMove(m.san);
    } catch {
      /* illegal; ignored */
    }
  }

  useEffect(() => {
    if (!ref.current) return;
    const turnColor =
      (currentFen.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black';
    cgRef.current = Chessground(ref.current, {
      fen: currentFen,
      turnColor,
      orientation,
      movable: {
        free: false,
        color: disabled ? undefined : turnColor,
        dests: disabled ? new Map() : destsFrom(currentFen),
        events: { after: handleAfter },
      },
      draggable: { showGhost: true },
      animation: { duration: 200 },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cgRef.current) return;
    const turnColor =
      (currentFen.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black';
    cgRef.current.set({
      fen: currentFen,
      turnColor,
      orientation,
      movable: {
        color: disabled ? undefined : turnColor,
        dests: disabled ? new Map() : destsFrom(currentFen),
        events: { after: handleAfter },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFen, disabled]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div ref={ref} style={{ width: '100%', maxWidth: 520, aspectRatio: '1 / 1' }} />
      <BoardToolbar fen={currentFen} orientation={orientation} />
    </div>
  );
}
