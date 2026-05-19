import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { defaultLandingForRoles } from './routing';
import { ALL_ROLES, type Role } from '../lib/api';
import { Card, Btn } from '../components/ui/atoms';
import { IconMortar, IconUser, IconClock } from '../components/ui/Icons';

const ROLE_LABELS: Record<Role, { title: string; sub: string; Icon: typeof IconMortar }> = {
  trainer: { title: 'Trainer', sub: 'I coach others',     Icon: IconMortar },
  student: { title: 'Student', sub: 'A coach assigns me', Icon: IconUser },
  self:    { title: 'Solo',    sub: 'My own materials',   Icon: IconClock },
};

/**
 * Shown after first sign-in for users who have no roles yet (currently:
 * brand-new accounts from the Google OAuth callback). Once they commit, the
 * AuthContext picks up the new roles and routing.ts decides where to land.
 */
export function RolePicker() {
  const { user, loading, setRoles } = useAuth();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<Set<Role>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-faint)' }}>Loading…</div>;
  }
  if (!user) return <Navigate to="/" replace />;
  // Already chose roles previously → no reason to be here.
  if (user.roles.length > 0) {
    return <Navigate to={defaultLandingForRoles(user.roles)} replace />;
  }

  function toggle(r: Role) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  async function commit() {
    if (picked.size === 0) {
      setErr('Pick at least one role.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await setRoles([...picked]);
      navigate(defaultLandingForRoles([...picked]), { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <Card style={{ padding: 32, maxWidth: 520, width: '100%' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          Welcome, {user.name}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: '0 0 22px', lineHeight: 1.5 }}>
          Pick how you plan to use Praxis. You can be a trainer for some
          students and a student for someone else — combinations are allowed,
          and you can change this later.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
          {ALL_ROLES.map((r) => {
            const on = picked.has(r);
            const { Icon, title, sub } = ROLE_LABELS[r];
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggle(r)}
                style={{
                  padding: '16px 10px',
                  borderRadius: 12,
                  background: on ? 'var(--accent-soft)' : 'var(--inset-bg)',
                  border: `1px solid ${on ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: on ? 'var(--text)' : 'var(--text-dim)',
                  transition: 'all 120ms ease',
                }}
              >
                <Icon size={24} strokeWidth={2} style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.35 }}>
                  {sub}
                </div>
              </button>
            );
          })}
        </div>

        <Btn
          variant="primary"
          size="lg"
          onClick={commit}
          disabled={busy || picked.size === 0}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {busy ? 'Saving…' : 'Continue →'}
        </Btn>

        {err && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12, textAlign: 'center' }}>
            {err}
          </div>
        )}
      </Card>
    </div>
  );
}
