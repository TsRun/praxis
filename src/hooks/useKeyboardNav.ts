import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useFilterStore } from '../store/filterStore';
import { fetchExplorer } from '../lib/lichess';

// Keyboard navigation:
//   ←        : stepBack
//   →        : stepForward if there's a known next ply, otherwise play the
//              most-played candidate at the current position (respecting any
//              active player/color filter). Lets you walk the mainline
//              indefinitely without clicking.
//   Home     : rewind to ply 0 (keeps the history list intact)
//   End      : jump to the last played ply
//
// Skips when an input/textarea/contenteditable holds focus.
export function useKeyboardNav(): void {
  useEffect(() => {
    let inFlight = false;

    async function autoAdvance() {
      if (inFlight) return;
      inFlight = true;
      try {
        const { fen, applyMove } = useGameStore.getState();
        const { player, color } = useFilterStore.getState();
        const result = await fetchExplorer({
          source: 'otb',
          fen,
          player_id: player?.fide_id ?? null,
          color,
        });
        const top = result.moves[0];
        if (top) applyMove(top.san);
      } catch {
        // network/error — ignore; user can still navigate by clicking
      } finally {
        inFlight = false;
      }
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      const { stepBack, stepForward, jumpToEnd, goToPly, currentPly, history } =
        useGameStore.getState();
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          stepBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentPly < history.length) {
            stepForward();
          } else {
            void autoAdvance();
          }
          break;
        case 'Home':
          e.preventDefault();
          goToPly(0);
          break;
        case 'End':
          e.preventDefault();
          jumpToEnd();
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
