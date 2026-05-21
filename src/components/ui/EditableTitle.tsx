import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

export interface EditableTitleProps {
  value: string;
  onSave: (next: string) => Promise<void>;
  level?: 'h1' | 'h2';
  placeholder?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** Validate before saving; return error message or null. */
  validate?: (next: string) => string | null;
  /** Start in edit mode and focus the input on mount. */
  autoEdit?: boolean;
}

/**
 * Returns true when the viewport is at or below the typography-shrink breakpoint
 * defined in `src/index.css` (max-width: 768px). Reactive to resize.
 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (ev: MediaQueryListEvent) => setNarrow(ev.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return narrow;
}

/**
 * Per-level inline styles that exactly mirror `.t-h1` / `.t-h2` in index.css,
 * including the narrow-viewport shrink (22px / 17px at <=768px).
 */
function headingStyle(level: 'h1' | 'h2', narrow: boolean): CSSProperties {
  if (level === 'h1') {
    return {
      fontSize: narrow ? 22 : 28,
      lineHeight: 1.15,
      fontWeight: 600,
      letterSpacing: '-0.02em',
    };
  }
  return {
    fontSize: narrow ? 17 : 19,
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: '-0.01em',
  };
}

export function EditableTitle({
  value,
  onSave,
  level = 'h1',
  placeholder = 'Untitled',
  title = 'Click to rename',
  className,
  style,
  validate,
  autoEdit = false,
}: EditableTitleProps) {
  const [editing, setEditing] = useState(autoEdit);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const savingRef = useRef(false);
  const narrow = useIsNarrow();

  // Keep draft in sync with parent value when not editing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEditing = useCallback(() => {
    setDraft(value);
    setError(null);
    setEditing(true);
  }, [value]);

  const cancel = useCallback(() => {
    setDraft(value);
    setError(null);
    setEditing(false);
  }, [value]);

  const commit = useCallback(async () => {
    if (savingRef.current) return;
    const next = draft.trim();
    if (next === value) {
      cancel();
      return;
    }
    if (validate) {
      const v = validate(next);
      if (v) {
        setError(v);
        return;
      }
    }
    if (!next) {
      setError('Name is required');
      return;
    }
    savingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message || 'Could not save');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }, [draft, value, validate, onSave, cancel]);

  // Auto-focus & select-all when entering edit mode.
  useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      el.select();
    }
  }, [editing]);

  const baseHeading = headingStyle(level, narrow);

  if (!editing) {
    const Tag = (level === 'h1' ? 'h1' : 'h2') as 'h1' | 'h2';
    const empty = !value || !value.trim();
    return (
      <Tag
        className={`t-${level}${className ? ` ${className}` : ''}`}
        style={{
          margin: 0,
          cursor: 'pointer',
          color: empty ? 'var(--text-faint)' : undefined,
          ...style,
        }}
        onClick={startEditing}
        title={title}
      >
        {empty ? placeholder : value}
      </Tag>
    );
  }

  const inputStyle: CSSProperties = {
    ...baseHeading,
    display: 'block',
    width: '100%',
    height: 'auto',
    margin: 0,
    padding: '2px 8px',
    background: 'var(--inset-bg)',
    border: `1px solid ${focused ? 'var(--accent)' : 'var(--inset-border)'}`,
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'inherit',
    outline: 'none',
    boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
    opacity: busy ? 0.7 : 1,
    transition: 'border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
    ...style,
  };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  return (
    <div className={className} style={{ width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          void commit();
        }}
        style={inputStyle}
        aria-invalid={error ? true : undefined}
      />
      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: 'var(--danger)',
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
