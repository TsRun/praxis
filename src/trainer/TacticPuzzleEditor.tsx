import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { trainerTactics, type TacticPuzzle } from '../lib/api';
import { Card, Btn, Chip, MoveChip } from '../components/ui/atoms';
import { BoardToolbar } from '../components/BoardToolbar';
import { PositionSetupBoard } from '../components/board/PositionSetupBoard';
import { IconArrowL, IconCheck } from '../components/ui/Icons';

const START_FEN = new Chess().fen();

export function TacticPuzzleEditor() {
  const { id, pid } = useParams();
  const numId = Number(id);
  const isNew = pid === 'new';
  const nav = useNavigate();

  const [fen, setFen] = useState<string>(START_FEN);
  const [solutionSan, setSolutionSan] = useState<string[]>([]);
  const [commentMd, setCommentMd] = useState('');
  const [loaded, setLoaded] = useState<boolean>(isNew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [setName, setSetName] = useState<string>('');

  useEffect(() => {
    // Always fetch the set so we can show its name in the breadcrumb.
    trainerTactics.get(numId).then((s) => {
      setSetName(s.name);
      if (!isNew) {
        // Postgres BIGINT comes back as a JSON string, so coerce both sides
        // to strings before matching — `x.id === Number(pid)` silently
        // misses every row.
        const p = s.puzzles.find((x: TacticPuzzle) => String(x.id) === pid);
        if (p) {
          setFen(p.fen);
          setSolutionSan(p.solution_san);
          setCommentMd(p.comment_md);
        }
        setLoaded(true);
      }
    });
  }, [numId, pid, isNew]);

  async function save() {
    if (solutionSan.length === 0) {
      setErr('Play at least one solution move on the lower board.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (isNew) {
        await trainerTactics.addPuzzle(numId, {
          fen,
          solution_san: solutionSan,
          comment_md: commentMd || undefined,
        });
      } else {
        await trainerTactics.updatePuzzle(numId, Number(pid), {
          fen,
          solution_san: solutionSan,
          comment_md: commentMd || undefined,
        });
      }
      nav(`/trainer/studies/tactic/${numId}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
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
          gap: 10,
          alignItems: 'center',
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => nav(`/trainer/studies/tactic/${numId}`)}
        >
          <IconArrowL size={13} strokeWidth={2.4} />
          {setName || 'Set'}
        </Btn>
        <h1 className="t-h1" style={{ margin: 0 }}>
          {isNew ? 'New puzzle' : 'Edit puzzle'}
        </h1>
      </div>

      <div className="grid-2" style={{ gap: 28, alignItems: 'start' }}>
        <PositionEditor
          fen={fen}
          onChange={(nextFen) => {
            // Re-setting the position resets any previously recorded solution
            // moves — they were authored against the old FEN.
            setFen(nextFen);
            setSolutionSan([]);
          }}
        />

        <SolutionEditor
          fen={fen}
          solutionSan={solutionSan}
          onAppend={(san) => setSolutionSan((prev) => [...prev, san])}
          onUndo={() => setSolutionSan((prev) => prev.slice(0, -1))}
          onReset={() => setSolutionSan([])}
        />
      </div>

      <Card style={{ padding: 18, marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Comment (shown after the student solves)</span>
          <textarea
            className="input"
            rows={3}
            placeholder="Optional: explain the idea, what to look for, why this works…"
            value={commentMd}
            onChange={(e) => setCommentMd(e.target.value)}
            style={{ height: 'auto', padding: '8px 12px' }}
          />
        </label>

        {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn
            variant="ghost"
            onClick={() => nav(`/trainer/studies/tactic/${numId}`)}
            disabled={busy}
          >
            Cancel
          </Btn>
          <Btn
            variant="primary"
            onClick={save}
            disabled={busy || solutionSan.length === 0}
          >
            {busy ? 'Saving…' : isNew ? 'Save puzzle' : 'Save changes'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* Thin wrapper around the shared PositionSetupBoard that adds the FEN-input
 * fallback for trainers who already have a position string and inline
 * validation against chess.js. */
function PositionEditor({
  fen,
  onChange,
}: {
  fen: string;
  onChange: (fen: string) => void;
}) {
  const [fenInput, setFenInput] = useState(fen);
  const [fenError, setFenError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  // Bump this to force PositionSetupBoard to re-seed from a pasted FEN.
  const [seedKey, setSeedKey] = useState(0);
  const [seedFen, setSeedFen] = useState(fen);

  function handleChange(next: string) {
    setFenInput(next);
    try {
      // eslint-disable-next-line no-new
      new Chess(next);
      setValidation(null);
    } catch (e) {
      setValidation((e as Error).message || 'illegal position');
    }
    onChange(next);
  }

  function applyFenInput() {
    try {
      const c = new Chess(fenInput.trim());
      setSeedFen(c.fen());
      setSeedKey((k) => k + 1);
      setFenError(null);
    } catch (e) {
      setFenError((e as Error).message || 'invalid FEN');
    }
  }

  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="t-h2" style={{ margin: 0 }}>Position</h2>

      <PositionSetupBoard
        key={seedKey}
        fen={seedFen}
        onChange={handleChange}
      />

      {validation && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>
          {validation} — fix this before authoring the solution.
        </div>
      )}

      <details>
        <summary
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          FEN (advanced — paste to import a position)
        </summary>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            className="input mono"
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            onBlur={applyFenInput}
            style={{ fontSize: 12 }}
          />
          <Btn variant="ghost" size="sm" onClick={applyFenInput}>Apply</Btn>
        </div>
        {fenError && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{fenError}</span>
        )}
      </details>
    </Card>
  );
}

/* ─── Solution editor ──────────────────────────────────────────────────────
 * Once the position is set, this board enforces legal moves and records the
 * SAN the trainer plays. The board's orientation matches the side that moves
 * first (the puzzle is built from the solver's POV).
 */
function SolutionEditor({
  fen,
  solutionSan,
  onAppend,
  onUndo,
  onReset,
}: {
  fen: string;
  solutionSan: string[];
  onAppend: (san: string) => void;
  onUndo: () => void;
  onReset: () => void;
}) {
  // The position AFTER applying every recorded solution move — what the next
  // SAN would be played on. If the FEN is illegal we render an empty pane;
  // the trainer can't author moves until the position is valid.
  const liveChess = useMemo(() => {
    try {
      const c = new Chess(fen);
      for (const san of solutionSan) c.move(san);
      return c;
    } catch {
      return null;
    }
  }, [fen, solutionSan]);

  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="t-h2" style={{ margin: 0 }}>Solution</h2>

      {liveChess ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <SolutionBoard
            startFen={fen}
            playedSans={solutionSan}
            onMove={onAppend}
          />
          <BoardToolbar
            fen={liveChess.fen()}
            orientation={(fen.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black'}
          />
        </div>
      ) : (
        <div
          style={{
            padding: 18,
            background: 'var(--inset-bg)',
            border: '1px dashed var(--inset-border)',
            borderRadius: 10,
            color: 'var(--text-dim)',
            fontSize: 13,
          }}
        >
          Build a legal position first — both kings on the board, the side to
          move not already in check from the opponent, etc.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Moves played
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={solutionSan.length === 0}
          >
            Undo
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={solutionSan.length === 0}
          >
            Reset
          </Btn>
        </div>
      </div>

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
        {solutionSan.length === 0 ? (
          <span className="meta" style={{ fontSize: 12 }}>
            Drag a piece on the board to record the first move.
          </span>
        ) : (
          solutionSan.map((san, i) => (
            <MoveChip key={i} san={san} ply={i + 1} mainline minor />
          ))
        )}
      </div>

      {liveChess?.isCheckmate() && (
        <Chip variant="success">
          <IconCheck size={11} strokeWidth={2.4} />
          Line ends in checkmate
        </Chip>
      )}
    </Card>
  );
}

function SolutionBoard({
  startFen,
  playedSans,
  onMove,
}: {
  startFen: string;
  playedSans: string[];
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

  function destsFrom(fen: string): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    try {
      const c = new Chess(fen);
      for (const m of c.moves({ verbose: true })) {
        const from = m.from as Key;
        if (!dests.has(from)) dests.set(from, []);
        dests.get(from)!.push(m.to as Key);
      }
    } catch { /* bad FEN */ }
    return dests;
  }

  function turnFromFen(fen: string): 'white' | 'black' {
    return (fen.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black';
  }

  function handleAfter(from: Key, to: Key) {
    try {
      const c = new Chess(currentFen);
      const m = c.move({ from, to, promotion: 'q' });
      if (m) onMove(m.san);
    } catch {
      /* illegal — chessground will animate back via the re-set effect */
    }
  }

  useEffect(() => {
    if (!ref.current) return;
    const turnColor = turnFromFen(currentFen);
    cgRef.current = Chessground(ref.current, {
      fen: currentFen,
      turnColor,
      orientation: turnFromFen(startFen),
      movable: {
        free: false,
        color: turnColor,
        dests: destsFrom(currentFen),
        events: { after: handleAfter },
      },
      draggable: { showGhost: true },
      animation: { duration: 150 },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cgRef.current) return;
    const turnColor = turnFromFen(currentFen);
    cgRef.current.set({
      fen: currentFen,
      turnColor,
      orientation: turnFromFen(startFen),
      movable: {
        color: turnColor,
        dests: destsFrom(currentFen),
        events: { after: handleAfter },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFen, startFen]);

  return (
    <div ref={ref} style={{ width: '100%', maxWidth: 460, aspectRatio: '1 / 1' }} />
  );
}
