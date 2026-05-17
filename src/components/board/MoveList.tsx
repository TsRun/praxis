import { useGameStore } from '../../store/gameStore';
import { Icon } from '../ui/Icon';

export function MoveList() {
  const history = useGameStore((s) => s.history);
  const goToPly = useGameStore((s) => s.goToPly);
  const reset = useGameStore((s) => s.reset);

  return (
    <div className="flex items-start gap-3">
      <button
        onClick={reset}
        title="Reset to start position"
        className="shrink-0 mt-0.5 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
      >
        <Icon name="reset" className="w-3.5 h-3.5" />
        reset
      </button>
      {history.length === 0 ? (
        <div className="text-xs text-zinc-500 mt-1">
          Make a move on the board or click a row in the table below.
        </div>
      ) : (
        <ol className="font-mono text-sm leading-6 flex flex-wrap gap-x-1 gap-y-0">
          {history.map((san, i) => {
            const moveNum = Math.floor(i / 2) + 1;
            const prefix = i % 2 === 0 ? `${moveNum}.` : '';
            const isLast = i === history.length - 1;
            return (
              <button
                key={i}
                onClick={() => goToPly(i + 1)}
                className={`px-1.5 rounded hover:bg-amber-400/10 hover:text-amber-300 transition-colors text-left ${
                  isLast ? 'text-amber-300 bg-amber-400/10' : 'text-zinc-300'
                }`}
              >
                {prefix}
                {san}
              </button>
            );
          })}
        </ol>
      )}
    </div>
  );
}
