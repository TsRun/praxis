import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Icon } from '../ui/Icon';

interface PlyButtonProps {
  san: string | undefined;
  ply: number;            // 1-indexed position in history (i.e., currentPly value that selects this)
  isCurrent: boolean;
  isFuture: boolean;
  onClick: () => void;
}

function PlyButton({ san, ply, isCurrent, isFuture, onClick }: PlyButtonProps) {
  if (!san) return <span className="text-zinc-700">·</span>;
  return (
    <button
      onClick={onClick}
      data-ply={ply}
      className={
        'px-1.5 py-0.5 rounded text-left font-mono transition-colors ' +
        (isCurrent
          ? 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/40'
          : isFuture
            ? 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
            : 'text-zinc-200 hover:bg-amber-400/10 hover:text-amber-300')
      }
    >
      {san}
    </button>
  );
}

export function MoveList() {
  const history = useGameStore((s) => s.history);
  const currentPly = useGameStore((s) => s.currentPly);
  const goToPly = useGameStore((s) => s.goToPly);
  const reset = useGameStore((s) => s.reset);
  const stepBack = useGameStore((s) => s.stepBack);
  const stepForward = useGameStore((s) => s.stepForward);
  const jumpToEnd = useGameStore((s) => s.jumpToEnd);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Keep the active ply in view as it changes
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(
      `[data-ply="${currentPly}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentPly]);

  const pairs: Array<{ white?: string; black?: string }> = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ white: history[i], black: history[i + 1] });
  }

  const canBack = currentPly > 0;
  const canFwd = currentPly < history.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <Icon name="rewind" className="w-3 h-3" />
          moves
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={reset}
            disabled={!canBack}
            title="Reset (Home)"
            aria-label="Reset to start"
            className="p-1 rounded hover:bg-zinc-800/60 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400"
          >
            <Icon name="reset" className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={stepBack}
            disabled={!canBack}
            title="Back (←)"
            aria-label="Previous move"
            className="p-1 rounded hover:bg-zinc-800/60 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400"
          >
            <Icon name="arrow-left" className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={stepForward}
            disabled={!canFwd}
            title="Forward (→)"
            aria-label="Next move"
            className="p-1 rounded hover:bg-zinc-800/60 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400"
          >
            <Icon name="arrow-right" className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={jumpToEnd}
            disabled={!canFwd}
            title="Jump to end (End)"
            aria-label="Jump to end"
            className="p-1 rounded hover:bg-zinc-800/60 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400"
          >
            <span aria-hidden="true" className="font-mono text-[10px]">▸▸</span>
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-auto scroll-thin pr-1 text-sm"
      >
        {history.length === 0 ? (
          <div className="text-xs text-zinc-500 leading-relaxed px-1">
            No moves played yet. Pick one from the candidate list, drag a piece
            on the board, or paste a PGN.
          </div>
        ) : (
          <div className="grid grid-cols-[2.4rem_1fr_1fr] gap-y-0.5 gap-x-1 items-center">
            {pairs.map((pair, i) => {
              const moveNum = i + 1;
              const whitePly = i * 2 + 1;
              const blackPly = i * 2 + 2;
              return (
                <div key={i} className="contents">
                  <button
                    onClick={() => goToPly((moveNum - 1) * 2)}
                    className="text-[11px] text-right pr-1 font-mono text-zinc-500 hover:text-amber-300"
                    title={`Position before move ${moveNum}`}
                  >
                    {moveNum}.
                  </button>
                  <PlyButton
                    san={pair.white}
                    ply={whitePly}
                    isCurrent={currentPly === whitePly}
                    isFuture={currentPly < whitePly}
                    onClick={() => goToPly(whitePly)}
                  />
                  <PlyButton
                    san={pair.black}
                    ply={blackPly}
                    isCurrent={currentPly === blackPly}
                    isFuture={currentPly < blackPly}
                    onClick={() => goToPly(blackPly)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
