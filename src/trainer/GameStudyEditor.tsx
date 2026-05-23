import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/board/ChessBoard';
import {
  trainerGames,
  trainerStudies,
  type GameStudyFull,
  type GameAnnotation,
} from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { AssignStudyDialog } from './AssignStudyDialog';
import { Card, Btn, Chip } from '../components/ui/atoms';
import { EditableTitle } from '../components/ui/EditableTitle';
import { IconAssign } from '../components/ui/Icons';

export function GameStudyEditor() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<GameStudyFull | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const currentPly = useGameStore((s) => s.currentPly);
  const goToPly = useGameStore((s) => s.goToPly);
  const loadLine = useGameStore((s) => s.loadLine);

  useEffect(() => {
    trainerGames.get(numId).then((s) => {
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

  const annAtPly = useMemo(() => {
    if (!study) return null;
    return study.annotations.find((a) => a.ply === currentPly) ?? null;
  }, [study, currentPly]);

  function upsertAnnotation(patch: Partial<GameAnnotation>) {
    setStudy((prev) => {
      if (!prev) return prev;
      const others = prev.annotations.filter((a) => a.ply !== currentPly);
      const merged: GameAnnotation = {
        ply: currentPly,
        comment_md: patch.comment_md ?? annAtPly?.comment_md ?? null,
        is_quiz: patch.is_quiz ?? annAtPly?.is_quiz ?? false,
      };
      if (!merged.comment_md && !merged.is_quiz)
        return { ...prev, annotations: others };
      return { ...prev, annotations: [...others, merged] };
    });
  }

  async function save() {
    if (!study) return;
    setBusy(true);
    try {
      await trainerGames.saveAnnotations(study.id, study.annotations);
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setBusy(false);
    }
  }

  if (!study)
    return (
      <div style={{ padding: 28, color: 'var(--text-faint)' }}>Loading…</div>
    );

  return (
    <div
      className="page-wrap"
      style={{
        paddingTop: 24,
        paddingBottom: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240, flex: 1 }}>
          <EditableTitle
            level="h1"
            value={study.name}
            onSave={async (next) => {
              await trainerStudies.renameGame(study.id, next);
              setStudy((prev) => (prev ? { ...prev, name: next } : prev));
            }}
          />
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
            <span className="meta">·</span>
            <span className="meta">{study.headers_json?.Event ?? '—'}</span>
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <Btn variant="secondary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save annotations'}
          </Btn>
          {savedAt && (
            <span style={{ fontSize: 12, color: 'var(--success)' }}>
              saved {savedAt}
            </span>
          )}
          <Btn variant="primary" onClick={() => setShowAssign(true)}>
            <IconAssign size={13} strokeWidth={2.4} />
            Assign to student
          </Btn>
        </div>
      </div>

      <div className="three-pane">
        <ChessBoard />
        <Card style={{ padding: 16, overflow: 'auto', maxHeight: '80vh' }}>
          <h2 className="t-h3" style={{ margin: '0 0 10px' }}>
            Move list
          </h2>
          <PlyList study={study} currentPly={currentPly} onJump={goToPly} />
        </Card>
        <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
          <h3 className="t-h3" style={{ margin: 0 }}>
            Annotation at ply {currentPly || 0}
          </h3>
          {currentPly === 0 ? (
            <p className="meta">
              Move to a ply via the move list or → to annotate it.
            </p>
          ) : (
            <>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={annAtPly?.is_quiz ?? false}
                  onChange={(e) =>
                    upsertAnnotation({ is_quiz: e.target.checked })
                  }
                />
                Quiz here (student must find the played move)
              </label>
              <textarea
                rows={8}
                className="font-mono"
                placeholder="markdown comment for this move…"
                value={annAtPly?.comment_md ?? ''}
                onChange={(e) =>
                  upsertAnnotation({ comment_md: e.target.value || null })
                }
                style={{
                  background: 'var(--inset-bg)',
                  border: '1px solid var(--inset-border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12.5,
                  color: 'var(--text)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </>
          )}
        </Card>
      </div>

      <AssignStudyDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        studyKind="game"
        studyId={study.id}
        studyName={study.name}
      />
    </div>
  );
}

function PlyList({
  study,
  currentPly,
  onJump,
}: {
  study: GameStudyFull;
  currentPly: number;
  onJump: (p: number) => void;
}) {
  const c = new Chess();
  try {
    c.loadPgn(study.pgn);
  } catch {
    /* ignore */
  }
  const history = c.history();
  const noteByPly = new Map(study.annotations.map((a) => [a.ply, a] as const));
  const rows: JSX.Element[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const wPly = i + 1;
    const bPly = i + 2;
    const wA = noteByPly.get(wPly);
    const bA = noteByPly.get(bPly);
    rows.push(
      <div
        key={i}
        className="font-mono"
        style={{
          display: 'grid',
          gridTemplateColumns: '2.5rem 1fr 1fr',
          columnGap: 8,
          alignItems: 'baseline',
          fontSize: 13,
        }}
      >
        <span style={{ color: 'var(--text-faint)', textAlign: 'right' }}>
          {Math.floor(i / 2) + 1}.
        </span>
        <button
          type="button"
          onClick={() => onJump(wPly)}
          style={{
            textAlign: 'left',
            padding: '2px 6px',
            borderRadius: 6,
            background: currentPly === wPly ? 'var(--accent-soft)' : 'transparent',
            border: 0,
            color: currentPly === wPly ? 'var(--text)' : 'var(--text)',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {history[i]}
          {wA?.is_quiz && (
            <span style={{ marginLeft: 4, color: 'var(--accent)', fontSize: 10 }}>
              ●Q
            </span>
          )}
          {wA?.comment_md && (
            <span
              style={{ marginLeft: 4, color: 'var(--text-faint)', fontSize: 10 }}
            >
              ●
            </span>
          )}
        </button>
        {history[i + 1] && (
          <button
            type="button"
            onClick={() => onJump(bPly)}
            style={{
              textAlign: 'left',
              padding: '2px 6px',
              borderRadius: 6,
              background:
                currentPly === bPly ? 'var(--accent-soft)' : 'transparent',
              border: 0,
              color: 'var(--text)',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {history[i + 1]}
            {bA?.is_quiz && (
              <span
                style={{ marginLeft: 4, color: 'var(--accent)', fontSize: 10 }}
              >
                ●Q
              </span>
            )}
            {bA?.comment_md && (
              <span
                style={{
                  marginLeft: 4,
                  color: 'var(--text-faint)',
                  fontSize: 10,
                }}
              >
                ●
              </span>
            )}
          </button>
        )}
      </div>,
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows}
    </div>
  );
}
