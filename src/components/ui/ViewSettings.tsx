import { useGameStore } from '../../store/gameStore';

export function ViewSettings() {
  const minShare = useGameStore((s) => s.minShare);
  const maxDepth = useGameStore((s) => s.maxDepth);
  const setMinShare = useGameStore((s) => s.setMinShare);
  const setMaxDepth = useGameStore((s) => s.setMaxDepth);

  return (
    <div className="flex items-center gap-6 text-xs text-neutral-700">
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap">
          Prune &lt; {(minShare * 100).toFixed(1)}%
        </span>
        <input
          type="range"
          min="0"
          max="0.05"
          step="0.001"
          value={minShare}
          onChange={(e) => setMinShare(Number(e.target.value))}
          className="w-28"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap">Depth: {maxDepth}</span>
        <input
          type="range"
          min="2"
          max="30"
          step="1"
          value={maxDepth}
          onChange={(e) => setMaxDepth(Number(e.target.value))}
          className="w-28"
        />
      </label>
    </div>
  );
}
