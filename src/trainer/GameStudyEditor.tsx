import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/board/ChessBoard';
import { trainerGames, type GameStudyFull, type GameAnnotation } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { AssignStudyDialog } from './AssignStudyDialog';

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
      if (!merged.comment_md && !merged.is_quiz) return { ...prev, annotations: others };
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

  if (!study) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="grid grid-cols-[auto_1fr_320px] gap-5">
      <div className="rounded-xl p-1 panel">
        <ChessBoard />
      </div>
      <div className="panel p-3 flex flex-col gap-2 overflow-auto">
        <h2 className="font-semibold">{study.name}</h2>
        <div className="text-xs text-zinc-500">
          {study.headers_json.White} vs {study.headers_json.Black} ·{' '}
          {study.headers_json.Event ?? '—'}
        </div>
        <PlyList study={study} currentPly={currentPly} onJump={goToPly} />
      </div>
      <aside className="panel p-3 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Annotation at ply {currentPly || 0}
        </div>
        {currentPly === 0 ? (
          <p className="text-xs text-zinc-500">
            Move to a ply via the move list or → to annotate it.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={annAtPly?.is_quiz ?? false}
                onChange={(e) => upsertAnnotation({ is_quiz: e.target.checked })}
              />
              Quiz here (student must find the played move)
            </label>
            <textarea
              rows={8}
              className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1.5 font-mono text-sm"
              placeholder="markdown comment for this move…"
              value={annAtPly?.comment_md ?? ''}
              onChange={(e) => upsertAnnotation({ comment_md: e.target.value || null })}
            />
          </>
        )}
        <button
          onClick={save}
          disabled={busy}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save all annotations'}
        </button>
        {savedAt && <span className="text-xs text-emerald-400">Saved at {savedAt}</span>}
        <button
          onClick={() => setShowAssign(true)}
          className="text-xs text-zinc-400 hover:text-amber-300 px-3 py-1.5 rounded ring-1 ring-zinc-800 hover:ring-amber-400/40"
        >
          Assign to student
        </button>
      </aside>
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
        className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-2 items-baseline font-mono text-sm"
      >
        <span className="text-zinc-500 text-right">{Math.floor(i / 2) + 1}.</span>
        <button
          onClick={() => onJump(wPly)}
          className={`text-left px-1.5 rounded ${
            currentPly === wPly
              ? 'bg-amber-400/15 text-amber-200'
              : 'text-zinc-200 hover:bg-amber-400/10'
          }`}
        >
          {history[i]}
          {wA?.is_quiz && <span className="ml-1 text-amber-400 text-[10px]">●Q</span>}
          {wA?.comment_md && <span className="ml-1 text-zinc-500 text-[10px]">●</span>}
        </button>
        {history[i + 1] && (
          <button
            onClick={() => onJump(bPly)}
            className={`text-left px-1.5 rounded ${
              currentPly === bPly
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-zinc-200 hover:bg-amber-400/10'
            }`}
          >
            {history[i + 1]}
            {bA?.is_quiz && <span className="ml-1 text-amber-400 text-[10px]">●Q</span>}
            {bA?.comment_md && <span className="ml-1 text-zinc-500 text-[10px]">●</span>}
          </button>
        )}
      </div>,
    );
  }
  return <div className="flex flex-col gap-0.5">{rows}</div>;
}
