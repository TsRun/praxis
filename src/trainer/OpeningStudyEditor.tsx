import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChessBoard } from '../components/board/ChessBoard';
import { MoveList } from '../components/board/MoveList';
import { MoveSelection } from '../components/explorer/MoveSelection';
import { useGameStore } from '../store/gameStore';
import { trainerStudies, type OpeningStudyFull } from '../lib/api';
import { epdFromFen } from '../lib/eco';

export function OpeningStudyEditor() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyFull | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fen = useGameStore((s) => s.fen);
  const setFen = useGameStore((s) => s.setFen);

  useEffect(() => {
    trainerStudies.get(numId).then((s) => {
      setStudy(s);
      setFen(s.root_fen);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numId]);

  if (!study) return <p className="text-zinc-500">Loading…</p>;

  const epd = epdFromFen(fen);
  const annotation = study.annotations.find((a) => a.fen === epd);

  function updateComment(text: string) {
    setStudy((prev) => {
      if (!prev) return prev;
      const next = prev.annotations.filter((a) => a.fen !== epd);
      if (text.trim()) next.push({ fen: epd, comment_md: text });
      return { ...prev, annotations: next };
    });
  }

  async function save() {
    if (!study) return;
    setBusy(true);
    try {
      await trainerStudies.saveAnnotations(study.id, study.annotations);
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[auto_1fr_320px] gap-5">
      <div className="rounded-xl p-1 panel">
        <ChessBoard />
      </div>
      <div className="panel p-3 flex flex-col gap-3 min-h-0">
        <h2 className="font-semibold">{study.name}</h2>
        <div className="text-xs text-zinc-500">
          Walk the board; drop notes at key positions.
        </div>
        <MoveList />
        <div className="border-t border-zinc-800 pt-2 mt-2 min-h-0 overflow-auto">
          <MoveSelection />
        </div>
      </div>
      <aside className="panel p-3 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Annotation at this position
        </div>
        <textarea
          rows={10}
          className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1.5 font-mono text-sm"
          placeholder="markdown comment for this position…"
          value={annotation?.comment_md ?? ''}
          onChange={(e) => updateComment(e.target.value)}
        />
        <button
          onClick={save}
          disabled={busy}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save all annotations'}
        </button>
        {savedAt && <span className="text-xs text-emerald-400">Saved at {savedAt}</span>}
        <div className="text-xs text-zinc-500 mt-2">
          {study.annotations.length} note(s) total · supports **bold**, *italic*,
          [link](url), - list.
        </div>
      </aside>
    </div>
  );
}
