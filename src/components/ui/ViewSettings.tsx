import { useGameStore } from '../../store/gameStore';
import { Icon } from './Icon';

export function ViewSettings() {
  const minShare = useGameStore((s) => s.minShare);
  const maxDepth = useGameStore((s) => s.maxDepth);
  const setMinShare = useGameStore((s) => s.setMinShare);
  const setMaxDepth = useGameStore((s) => s.setMaxDepth);

  return (
    <div className="flex items-center gap-5 text-xs text-zinc-400">
      <Icon name="sliders" className="w-4 h-4 text-zinc-500" />
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap min-w-[78px]">
          prune <span className="font-mono text-zinc-200">&lt; {(minShare * 100).toFixed(1)}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="0.05"
          step="0.001"
          value={minShare}
          onChange={(e) => setMinShare(Number(e.target.value))}
          className="w-28"
          aria-label="Prune branches below this share of plays"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap">
          depth <span className="font-mono text-zinc-200">{maxDepth}</span>
        </span>
        <input
          type="range"
          min="2"
          max="30"
          step="1"
          value={maxDepth}
          onChange={(e) => setMaxDepth(Number(e.target.value))}
          className="w-28"
          aria-label="Maximum tree depth in plies"
        />
      </label>
    </div>
  );
}
