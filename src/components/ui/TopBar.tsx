import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { UserMenu } from '../../auth/UserMenu';

interface NavLink {
  to: string;
  label: ReactNode;
  match?: (pathname: string) => boolean;
}

interface TopBarProps {
  links?: NavLink[];
  right?: ReactNode;
}

export function TopBar({ links = [], right }: TopBarProps) {
  const { user } = useAuth();
  const loc = useLocation();
  const canCoach = user
    ? user.roles.includes('trainer') || user.roles.includes('self')
    : false;
  const canStudent = user?.roles.includes('student') ?? false;
  const showSwitch = canCoach && canStudent;
  const inCoach = loc.pathname.startsWith('/trainer');

  return (
    <div className="topbar">
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          height: 56,
          padding: '0 28px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        <Link to="/" className="wordmark" style={{ display: 'inline-flex' }}>
          <span>Pra</span>
          <span className="accent">xis</span>
        </Link>

        {showSwitch && (
          <div className="segmented accent">
            <Link to="/trainer" className={inCoach ? 'active' : ''}>
              Coach
            </Link>
            <Link to="/student" className={!inCoach ? 'active' : ''}>
              Student
            </Link>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {links.map((l) => {
            const active = l.match
              ? l.match(loc.pathname)
              : loc.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                style={{
                  height: 32,
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 8,
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  background: active ? 'var(--inset-bg)' : 'transparent',
                  fontSize: 13.5,
                  fontWeight: 500,
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {right}
          {user && <UserMenu />}
        </div>
      </nav>
    </div>
  );
}
