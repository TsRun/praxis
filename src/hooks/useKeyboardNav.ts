import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// Arrow Left → step back, Arrow Right → replay next mainline move (if known),
// Home → reset. Skips when focus is in an input/textarea.
export function useKeyboardNav(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      const { history, goToPly, reset } = useGameStore.getState();
      if (e.key === 'ArrowLeft') {
        if (history.length === 0) return;
        e.preventDefault();
        goToPly(history.length - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        reset();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
