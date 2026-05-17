import { useGameStore } from '../../store/gameStore';

export function MoveList() {
  const history = useGameStore((s) => s.history);
  const goToPly = useGameStore((s) => s.goToPly);

  if (history.length === 0) {
    return <div className="text-xs text-neutral-400 font-mono">No moves played</div>;
  }

  return (
    <div className="text-sm font-mono leading-7 flex flex-wrap gap-x-1">
      {history.map((san, i) => {
        const moveNum = Math.floor(i / 2) + 1;
        const prefix = i % 2 === 0 ? `${moveNum}.` : '';
        return (
          <button
            key={i}
            onClick={() => goToPly(i + 1)}
            className="px-1 hover:bg-amber-100 rounded text-left"
          >
            {prefix}
            {san}
          </button>
        );
      })}
    </div>
  );
}
