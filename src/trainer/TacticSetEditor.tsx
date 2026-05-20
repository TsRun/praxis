import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import {
  trainerTactics,
  type TacticSetFull,
  type TacticPuzzle,
} from '../lib/api';
import { Card, Btn, Chip, MoveChip } from '../components/ui/atoms';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AssignStudyDialog } from './AssignStudyDialog';
import {
  IconBolt,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAssign,
  IconArrowL,
} from '../components/ui/Icons';

const START_FEN = new Chess().fen();

interface DraftPuzzle {
  /** id when editing an existing puzzle, null when adding new. */
  id: number | null;
  fen: string;
  solution_san: string[];
  comment_md: string;
}

const emptyDraft: DraftPuzzle = {
  id: null,
  fen: START_FEN,
  solution_san: [],
  comment_md: '',
};

export function TacticSetEditor() {
  const { id } = useParams();
  const numId = Number(id);
  const nav = useNavigate();

  const [set, setSet] = useState<TacticSetFull | null>(null);
  const [draft, setDraft] = useState<DraftPuzzle | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TacticPuzzle | null>(null);
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    trainerTactics.get(numId).then((s) => {
      setSet(s);
      setNameDraft(s.name);
    });
  }, [numId]);

  async function refresh() {
    const s = await trainerTactics.get(numId);
    setSet(s);
  }

  async function savePuzzle() {
    if (!draft) return;
    if (draft.solution_san.length === 0) {
      setErr('Add at least one solution move.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (draft.id == null) {
        await trainerTactics.addPuzzle(numId, {
          fen: draft.fen,
          solution_san: draft.solution_san,
          comment_md: draft.comment_md || undefined,
        });
      } else {
        await trainerTactics.updatePuzzle(numId, draft.id, {
          fen: draft.fen,
          solution_san: draft.solution_san,
          comment_md: draft.comment_md || undefined,
        });
      }
      setDraft(null);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePuzzle(p: TacticPuzzle) {
    setBusy(true);
    try {
      await trainerTactics.deletePuzzle(numId, p.id);
      setConfirmDelete(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteSet() {
    setBusy(true);
    try {
      await trainerTactics.delete(numId);
      nav('/trainer/studies');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const next = nameDraft.trim();
    if (!set || !next || next === set.name) {
      setEditingName(false);
      setNameDraft(set?.name ?? '');
      return;
    }
    setBusy(true);
    try {
      await trainerTactics.rename(numId, next);
      setSet({ ...set, name: next });
      setEditingName(false);
    } catch (e) {
      setErr((e as Error).message);
      setNameDraft(set.name);
    } finally {
      setBusy(false);
    }
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
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <Btn variant="ghost" size="sm" onClick={() => nav('/trainer/studies')}>
          <IconArrowL size={13} strokeWidth={2.4} />
          Studies
        </Btn>
        <Chip variant="strong">
          <IconBolt size={11} strokeWidth={2.4} />
          Tactical set
        </Chip>
        {editingName ? (
          <form onSubmit={saveName} style={{ flex: 1, minWidth: 240 }}>
            <input
              className="input"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
            />
          </form>
        ) : (
          <h1
            className="t-h1"
            style={{ flex: 1, minWidth: 240, margin: 0, cursor: 'pointer' }}
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {set.name}
          </h1>
        )}
        <Btn variant="ghost" size="sm" onClick={() => setConfirmDeleteSet(true)}>
          <IconTrash size={13} strokeWidth={2.4} />
          Delete set
        </Btn>
        <Btn variant="primary" onClick={() => setShowAssign(true)}>
          <IconAssign size={13} strokeWidth={2.4} />
          Assign to student
        </Btn>
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
        {/* LEFT — puzzle list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 className="t-h2" style={{ margin: 0 }}>
              Puzzles{' '}
              <span className="meta" style={{ fontWeight: 400 }}>
                ({set.puzzles.length})
              </span>
            </h2>
            <Btn variant="secondary" size="sm" onClick={() => setDraft({ ...emptyDraft })}>
              <IconPlus size={13} strokeWidth={2.4} />
              Add puzzle
            </Btn>
          </div>
          {set.puzzles.length === 0 && (
            <Card style={{ padding: 18 }}>
              <div className="meta">
                No puzzles yet. Click "Add puzzle" to author one — paste a FEN,
                play the solution on the board.
              </div>
            </Card>
          )}
          {set.puzzles.map((p, i) => (
            <Card
              key={p.id}
              style={{
                padding: 14,
                cursor: 'pointer',
                outline:
                  draft?.id === p.id
                    ? '2px solid var(--accent-ring)'
                    : '1px solid var(--inset-border)',
              }}
              onClick={() =>
                setDraft({
                  id: p.id,
                  fen: p.fen,
                  solution_san: p.solution_san,
                  comment_md: p.comment_md,
                })
              }
            >
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip variant="mono">#{i + 1}</Chip>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {p.fen.split(' ').slice(0, 2).join(' ')}…
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(p);
                  }}
                  title="Delete puzzle"
                  style={{
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    color: 'var(--text-dim)',
                  }}
                >
                  <IconTrash size={13} strokeWidth={2.4} />
                </button>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.solution_san.map((san, j) => (
                  <MoveChip key={j} san={san} ply={j + 1} mainline minor />
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* RIGHT — editor pane */}
        <div>
          {draft ? (
            <PuzzleEditorPane
              key={draft.id ?? 'new'}
              draft={draft}
              setDraft={setDraft}
              onCancel={() => {
                setDraft(null);
                setErr(null);
              }}
              onSave={savePuzzle}
              busy={busy}
              err={err}
            />
          ) : (
            <Card style={{ padding: 28, textAlign: 'center' }}>
              <div className="meta">
                Pick a puzzle on the left to edit it, or click{' '}
                <strong>Add puzzle</strong> to author a new one.
              </div>
            </Card>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          open
          title="Delete puzzle?"
          body={`This removes puzzle #${
            (set.puzzles.findIndex((p) => p.id === confirmDelete.id) ?? 0) + 1
          } and all student attempts on it.`}
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => deletePuzzle(confirmDelete)}
        />
      )}
      {confirmDeleteSet && (
        <ConfirmDialog
          open
          title="Delete this tactical set?"
          body="This removes the set, all its puzzles, and all student attempts. Cannot be undone."
          confirmLabel="Delete set"
          destructive
          onClose={() => setConfirmDeleteSet(false)}
          onConfirm={deleteSet}
        />
      )}
      {showAssign && (
        <AssignStudyDialog
          open
          onClose={() => setShowAssign(false)}
          studyKind="tactic"
          studyId={set.id}
          studyName={set.name}
        />
      )}
    </div>
  );
}

function PuzzleEditorPane({
  draft,
  setDraft,
  onCancel,
  onSave,
  busy,
  err,
}: {
  draft: DraftPuzzle;
  setDraft: (d: DraftPuzzle) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  err: string | null;
}) {
  const [fenInput, setFenInput] = useState(draft.fen);
  const [fenError, setFenError] = useState<string | null>(null);

  // The board reflects the position AFTER applying every move in
  // draft.solution_san. The next move's color is the one we want the
  // trainer to play on the board.
  const liveChess = useMemo(() => {
    try {
      const c = new Chess(draft.fen);
      for (const san of draft.solution_san) c.move(san);
      return c;
    } catch {
      return null;
    }
  }, [draft.fen, draft.solution_san]);

  function applyFen(next: string) {
    const trimmed = next.trim();
    try {
      // throw on bad FEN
      // eslint-disable-next-line no-new
      new Chess(trimmed);
      setFenError(null);
      setDraft({ ...draft, fen: trimmed, solution_san: [] });
    } catch (e) {
      setFenError((e as Error).message || 'invalid FEN');
    }
  }

  function onBoardMove(san: string) {
    setDraft({ ...draft, solution_san: [...draft.solution_san, san] });
  }

  function popMove() {
    setDraft({ ...draft, solution_san: draft.solution_san.slice(0, -1) });
  }

  function resetMoves() {
    setDraft({ ...draft, solution_san: [] });
  }

  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="t-h2" style={{ margin: 0 }}>
          {draft.id == null ? 'New puzzle' : `Edit puzzle`}
        </h3>
        <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span >FEN</span>
        <input
          className="input mono"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          onBlur={() => applyFen(fenInput)}
          style={{ fontSize: 12 }}
        />
        {fenError && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{fenError}</span>
        )}
        <span className="meta" style={{ fontSize: 11.5 }}>
          Paste a FEN, then play the solution moves on the board below. The
          side to move at the FEN plays first.
        </span>
      </label>

      <PuzzleAuthorBoard
        startFen={draft.fen}
        playedSans={draft.solution_san}
        onMove={onBoardMove}
      />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span >Solution</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={popMove} disabled={busy || draft.solution_san.length === 0}>
            Undo
          </Btn>
          <Btn variant="ghost" size="sm" onClick={resetMoves} disabled={busy || draft.solution_san.length === 0}>
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
        {draft.solution_san.length === 0 && (
          <span className="meta" style={{ fontSize: 12 }}>
            Drag a piece on the board to record the first move.
          </span>
        )}
        {draft.solution_san.map((san, i) => (
          <MoveChip key={i} san={san} ply={i + 1} mainline minor />
        ))}
      </div>

      {liveChess?.isCheckmate() && (
        <Chip variant="success">
          <IconCheck size={11} strokeWidth={2.4} />
          Line ends in checkmate
        </Chip>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span >Comment (shown after the student solves)</span>
        <textarea
          className="input"
          rows={3}
          placeholder="Optional: explain the idea, why this works, what to look for…"
          value={draft.comment_md}
          onChange={(e) => setDraft({ ...draft, comment_md: e.target.value })}
        />
      </label>

      {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn
          variant="primary"
          onClick={onSave}
          disabled={busy || draft.solution_san.length === 0 || fenError != null}
        >
          {busy ? 'Saving…' : draft.id == null ? 'Save puzzle' : 'Save changes'}
        </Btn>
      </div>
    </Card>
  );
}

function PuzzleAuthorBoard({
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
    } catch {
      /* bad FEN */
    }
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
      /* illegal move; chessground will animate back via the re-set effect */
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
