import { useEffect, useState } from 'react';
import { IconSun, IconMoon } from './Icons';

const STORAGE_KEY = 'praxis-theme';
type Theme = 'dark' | 'light';

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage may be unavailable in private windows; ignore */
    }
  }, [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      style={{
        background: 'transparent',
        border: 0,
        color: 'var(--text-dim)',
        cursor: 'pointer',
        padding: 6,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
      }}
    >
      {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  );
}
