import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounced callback that always calls the latest function instance.
 * The returned `flush` runs any pending invocation immediately;
 * `cancel` drops it.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): {
  call: (...args: Args) => void;
  flush: () => void;
  cancel: () => void;
} {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<Args | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      const args = pendingRef.current;
      pendingRef.current = null;
      fnRef.current(...args);
    }
  }, []);

  const call = useCallback(
    (...args: Args) => {
      pendingRef.current = args;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const a = pendingRef.current;
        pendingRef.current = null;
        if (a) fnRef.current(...a);
      }, delayMs);
    },
    [delayMs],
  );

  useEffect(() => () => cancel(), [cancel]);

  return { call, flush, cancel };
}
