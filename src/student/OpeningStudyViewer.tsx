import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChessBoard } from '../components/board/ChessBoard';
import { MoveList } from '../components/board/MoveList';
import { MoveSelection } from '../components/explorer/MoveSelection';
import { useGameStore } from '../store/gameStore';
import { student, type OpeningStudyForStudent } from '../lib/api';
import { epdFromFen } from '../lib/eco';
import { Markdown } from '../lib/markdown';

export function OpeningStudyViewer() {
  const { id } = useParams();
  const numId = Number(id);
  const [study, setStudy] = useState<OpeningStudyForStudent | null>(null);
  const [visitedSet, setVisitedSet] = useState<Set<string>>(new Set());
  const fen = useGameStore((s) => s.fen);
  const setFen = useGameStore((s) => s.setFen);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    student.opening(numId).then((s) => {
      setStudy(s);
      setFen(s.root_fen);
      setVisitedSet(new Set(s.visited));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numId]);

  useEffect(() => {
    if (!study) return;
    const epd = epdFromFen(fen);
    const ann = study.annotations.find((a) => a.fen === epd);
    if (!ann || seenRef.current.has(epd) || visitedSet.has(epd)) return;
    seenRef.current.add(epd);
    student.markVisited(numId, epd).then(() => {
      setVisitedSet((prev) => new Set(prev).add(epd));
    });
  }, [fen, study, numId, visitedSet]);

  if (!study) return <p className="text-zinc-500">Loading…</p>;
  const epd = epdFromFen(fen);
  const annotation = study.annotations.find((a) => a.fen === epd);

  return (
    <div className="grid grid-cols-[auto_1fr_360px] gap-5">
      <div className="rounded-xl p-1 panel">
        <ChessBoard />
      </div>
      <div className="panel p-3 flex flex-col gap-3 min-h-0">
        <h2 className="font-semibold">{study.name}</h2>
        <MoveList />
        <div className="border-t border-zinc-800 pt-2 mt-2 min-h-0 overflow-auto">
          <MoveSelection />
        </div>
      </div>
      <aside className="panel p-3 overflow-auto">
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
          {annotation ? "Trainer's note" : 'No note here'}
        </div>
        {annotation ? (
          <Markdown>{annotation.comment_md}</Markdown>
        ) : (
          <p className="text-zinc-500 text-sm">
            Keep exploring — notes appear at key positions.
          </p>
        )}
        <div className="text-xs text-zinc-500 mt-4">
          {visitedSet.size} / {study.annotations.length} notes seen
        </div>
      </aside>
    </div>
  );
}
