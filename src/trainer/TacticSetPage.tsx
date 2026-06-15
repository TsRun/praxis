import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { trainerTactics, type TacticSetFull, type TacticPuzzle } from '../lib/api';
import { Card, Btn, Chip, MoveChip } from '../components/ui/atoms';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { BoardToolbar } from '../components/BoardToolbar';
import { EditableTitle } from '../components/ui/EditableTitle';
import { AssignStudyDialog } from './AssignStudyDialog';
import {
  IconBolt,
  IconPlus,
  IconTrash,
  IconAssign,
  IconArrowL,
} from '../components/ui/Icons';

export function TacticSetPage() {
  const { id } = useParams();
  const numId = Number(id);
  const nav = useNavigate();

  const [set, setSet] = useState<TacticSetFull | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TacticPuzzle | null>(null);
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    trainerTactics.get(numId).then((s) => {
      setSet(s);
    });
  }, [numId]);

  async function refresh() {
    setSet(await trainerTactics.get(numId));
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
        <div style={{ flex: 1, minWidth: 240 }}>
          <EditableTitle
            level="h1"
            value={set.name}
            onSave={async (next) => {
              await trainerTactics.rename(numId, next);
              setSet({ ...set, name: next });
            }}
          />
        </div>
        <Btn variant="ghost" size="sm" onClick={() => setConfirmDeleteSet(true)}>
          <IconTrash size={13} strokeWidth={2.4} />
          Delete set
        </Btn>
        <Btn variant="primary" onClick={() => setShowAssign(true)}>
          <IconAssign size={13} strokeWidth={2.4} />
          Assign to student
        </Btn>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h2 className="t-h2" style={{ margin: 0 }}>
          Puzzles{' '}
          <span className="meta" style={{ fontWeight: 400 }}>
            ({set.puzzles.length})
          </span>
        </h2>
        <Btn
          variant="primary"
          onClick={() => nav(`/trainer/studies/tactic/${numId}/puzzles/new`)}
        >
          <IconPlus size={13} strokeWidth={2.4} />
          Add puzzle
        </Btn>
      </div>

      {set.puzzles.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--inset-border)',
            borderRadius: 14,
            padding: '40px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--inset-bg)',
              color: 'var(--text-dim)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
            }}
          >
            <IconBolt size={22} strokeWidth={2.2} />
          </div>
          <div className="meta-strong" role="status" aria-live="polite">
            No puzzles yet
          </div>
          <div className="meta" style={{ maxWidth: 360 }}>
            Author your first puzzle — set the position on the board, then play
            the solution moves.
          </div>
          <div style={{ marginTop: 10 }}>
            <Btn
              variant="primary"
              onClick={() =>
                nav(`/trainer/studies/tactic/${numId}/puzzles/new`)
              }
            >
              <IconPlus size={13} strokeWidth={2.4} />
              Add puzzle
            </Btn>
          </div>
        </div>
      ) : (
        <div
          role="list"
          aria-label="Puzzles in this set"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {set.puzzles.map((p, i) => (
            <PuzzleRow
              key={p.id}
              puzzle={p}
              index={i}
              setId={numId}
              onDelete={() => setConfirmDelete(p)}
            />
          ))}
        </div>
      )}

      {err && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12 }}>{err}</div>
      )}

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

function PuzzleRow({
  puzzle,
  index,
  setId,
  onDelete,
}: {
  puzzle: TacticPuzzle;
  index: number;
  setId: number;
  onDelete: () => void;
}) {
  return (
    <Card
      role="listitem"
      style={{
        padding: 14,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Link
        to={`/trainer/studies/tactic/${setId}/puzzles/${puzzle.id}`}
        aria-label={`Edit puzzle ${index + 1}`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          flex: 1,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Chip variant="mono">#{index + 1}</Chip>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {puzzle.fen.split(' ').slice(0, 2).join(' ')}
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {puzzle.solution_san.map((san, j) => (
            <MoveChip key={j} san={san} ply={j + 1} mainline minor />
          ))}
        </div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <BoardToolbar
          fen={puzzle.fen}
          orientation={
            (puzzle.fen.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black'
          }
          style={{ flexDirection: 'row' }}
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete puzzle ${index + 1}`}
          title="Delete puzzle"
          style={{
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 6,
          }}
        >
          <IconTrash size={13} strokeWidth={2.4} />
        </button>
      </div>
    </Card>
  );
}
