import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// Keyboard navigation for the study board:
//   ←        : stepBack
//   →        : stepForward (no-op past the end of the recorded line)
//   Home     : rewind to ply 0 (keeps the history list intact)
//   End      : jump to the last played ply
//
// Skips when an input/textarea/contenteditable holds focus.
export function useKeyboardNav(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      const { stepBack, stepForward, jumpToEnd, goToPly } = useGameStore.getState();
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          stepBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
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
