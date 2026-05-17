import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * Persist the current line and ply pointer to localStorage so a refresh
 * picks up where you left off. URL stays clean — no FEN, no moves, no ply
 * parameter — which avoids the "reload nukes my history" issue we used to
 * have with FEN-in-URL.
 *
 * Trade-off: links are no longer self-describing snapshots. If we want
 * shareable URLs later, we can layer them in opt-in via a copy-link button.
 */
const STORAGE_KEY = 'openingtree:v1';

interface PersistShape {
  history: string[];
  currentPly: number;
}

export function useFenUrlSync(): void {
  const history = useGameStore((s) => s.history);
  const currentPly = useGameStore((s) => s.currentPly);
  const loadLine = useGameStore((s) => s.loadLine);
  const hydrated = useRef(false);

  // Hydrate once on mount
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistShape;
      if (Array.isArray(parsed.history) && parsed.history.length > 0) {
        loadLine(parsed.history, parsed.currentPly);
      }
    } catch {
      // ignore malformed storage
    }
  }, [loadLine]);

  // Persist on change (throttled trivially by React's batching)
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      if (history.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const payload: PersistShape = { history, currentPly };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
    } catch {
      // quota / private-mode failures are non-fatal
    }
  }, [history, currentPly]);
}
