import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

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
          // Rewind to the start of the game without dropping the move list,
          // so End / → can replay forward.
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
