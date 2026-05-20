import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { defaultLandingForRoles } from './routing';
import { ALL_ROLES, type CurrentUser, type Role } from '../lib/api';
import { Card, Btn } from '../components/ui/atoms';
import { IconMortar, IconUser, IconClock } from '../components/ui/Icons';

const ROLE_LABELS: Record<Role, { title: string; sub: string; Icon: typeof IconMortar }> = {
  trainer: { title: 'Trainer', sub: 'I coach others',     Icon: IconMortar },
  student: { title: 'Student', sub: 'A coach assigns me', Icon: IconUser },
  self:    { title: 'Solo',    sub: 'My own materials',   Icon: IconClock },
};

/**
 * Onboarding page for first-time accounts with empty roles[] — currently
 * brand-new Google OAuth sign-ins. The OAuth callback gives us a sane default
 * nickname (Google profile name or email prefix), but trainers find students
 * by nickname, so we let the user edit it before committing. We save the
 * profile change first so a nickname conflict surfaces before the roles
 * commit — picking roles with a dup name would land them on a dashboard with
 * a no-op trainer-link link.
 */
export function RolePicker() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-faint)' }}>Loading…</div>;
  }
  if (!user) return <Navigate to="/" replace />;
  // Already chose roles previously → no reason to be here.
  if (user.roles.length > 0) {
    return <Navigate to={defaultLandingForRoles(user.roles)} replace />;
  }
  // The inner form takes the loaded user as a prop so its useState defaults
  // can safely initialise from user.name (initialising from useAuth() inside
  // the same component sees null on the first render).
  return <OnboardingForm user={user} />;
}

function OnboardingForm({ user }: { user: CurrentUser }) {
  const { setRoles, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [picked, setPicked] = useState<Set<Role>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(r: Role) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  async function commit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr('Pick a nickname.');
      return;
    }
    if (picked.size === 0) {
      setErr('Pick at least one role.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (trimmed !== user.name) {
        await updateProfile({ name: trimmed });
      }
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
        padding: 'clamp(16px, 5vw, 32px)',
      }}
    >
      <Card style={{ padding: 'clamp(20px, 5vw, 32px)', maxWidth: 520, width: '100%' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          Welcome to Praxis
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: '0 0 22px', lineHeight: 1.5 }}>
          Pick a nickname and how you plan to use Praxis. Trainers find students
          by nickname, so make it something you don't mind sharing. You can be a
          trainer for some students and a student for someone else — and you
          can change all of this later.
        </p>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Nickname</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. magnusfan_42"
            autoFocus
          />
        </label>

        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
          Your roles
        </div>
        <div className="grid-3" style={{ gap: 10, marginBottom: 22 }}>
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
          disabled={busy || picked.size === 0 || !name.trim()}
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
