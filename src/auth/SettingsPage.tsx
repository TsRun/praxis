import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ALL_ROLES, type Role } from '../lib/api';
import { Card, Btn, Chip } from '../components/ui/atoms';
import { TopBar } from '../components/ui/TopBar';
import { IconArrowL, IconMortar, IconUser, IconClock, IconCheck } from '../components/ui/Icons';

const ROLE_LABELS: Record<Role, { title: string; sub: string; Icon: typeof IconMortar }> = {
  trainer: { title: 'Trainer', sub: 'I coach others',     Icon: IconMortar },
  student: { title: 'Student', sub: 'A coach assigns me', Icon: IconUser },
  self:    { title: 'Solo',    sub: 'My own materials',   Icon: IconClock },
};

export function SettingsPage() {
  const { user, loading, updateProfile, updatePassword, setRoles } = useAuth();
  if (loading) {
    return <div style={{ padding: 28, color: 'var(--text-faint)' }}>Loading…</div>;
  }
  if (!user) return <Navigate to="/" replace />;

  const backHref =
    user.roles.includes('trainer') || user.roles.includes('self')
      ? '/trainer/studies'
      : '/student/dashboard';

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar />
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          marginInline: 'auto',
          paddingTop: 32,
          paddingBottom: 100,
          paddingLeft: 'clamp(16px, 4vw, 28px)',
          paddingRight: 'clamp(16px, 4vw, 28px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 className="t-h1">Settings</h1>
            <div className="meta" style={{ marginTop: 6 }}>
              Manage your nickname, email, password, and roles.
            </div>
          </div>
          <Link
            to={backHref}
            style={{
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
              color: 'var(--text-dim)',
              fontSize: 13,
            }}
          >
            <IconArrowL size={14} /> Back
          </Link>
        </div>

        <ProfileCard
          initialName={user.name}
          initialEmail={user.email}
          onSave={updateProfile}
        />

        <RolesCard initial={user.roles} onSave={setRoles} />

        <PasswordCard onSave={updatePassword} />
      </div>
    </div>
  );
}

/* ─────────────────────────── Profile card ───────────────────────────── */

function ProfileCard({
  initialName,
  initialEmail,
  onSave,
}: {
  initialName: string;
  initialEmail: string;
  onSave: (patch: { name?: string; email?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = name !== initialName || email !== initialEmail;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const patch: { name?: string; email?: string } = {};
      if (name !== initialName) patch.name = name.trim();
      if (email !== initialEmail) patch.email = email.trim();
      await onSave(patch);
      setSavedAt(Date.now());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ padding: 22 }}>
      <h2 className="t-h2" style={{ margin: '0 0 4px' }}>Profile</h2>
      <div className="meta" style={{ marginBottom: 18 }}>
        Your nickname is how trainers find you and how students see you.
        Email is where invites and assignment notifications go.
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nickname">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
        <FormFooter
          dirty={dirty}
          busy={busy}
          savedAt={savedAt}
          onReset={() => {
            setName(initialName);
            setEmail(initialEmail);
            setErr(null);
          }}
        />
      </form>
    </Card>
  );
}

/* ─────────────────────────── Roles card ───────────────────────────── */

function RolesCard({
  initial,
  onSave,
}: {
  initial: Role[];
  onSave: (roles: Role[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<Set<Role>>(new Set(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    picked.size !== initial.length ||
    initial.some((r) => !picked.has(r));

  function toggle(r: Role) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (picked.size === 0) {
      setErr('Pick at least one role.');
      return;
    }
    setBusy(true);
    try {
      await onSave([...picked]);
      setSavedAt(Date.now());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ padding: 22 }}>
      <h2 className="t-h2" style={{ margin: '0 0 4px' }}>Roles</h2>
      <div className="meta" style={{ marginBottom: 18 }}>
        Pick what you do on Praxis. You can be a trainer for some students
        and a student for someone else — all in the same account.
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid-3" style={{ gap: 8 }}>
          {ALL_ROLES.map((r) => {
            const on = picked.has(r);
            const { Icon, title, sub } = ROLE_LABELS[r];
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggle(r)}
                style={{
                  padding: '14px 10px',
                  borderRadius: 12,
                  background: on ? 'var(--accent-soft)' : 'var(--inset-bg)',
                  border: `1px solid ${on ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
                  cursor: 'pointer',
                  textAlign: 'center',
                  color: on ? 'var(--text)' : 'var(--text-dim)',
                  transition: 'all 120ms ease',
                }}
              >
                <Icon size={22} strokeWidth={2} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.35 }}>
                  {sub}
                </div>
              </button>
            );
          })}
        </div>
        {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
        <FormFooter
          dirty={dirty}
          busy={busy}
          savedAt={savedAt}
          onReset={() => {
            setPicked(new Set(initial));
            setErr(null);
          }}
        />
      </form>
    </Card>
  );
}

/* ─────────────────────────── Password card ───────────────────────────── */

function PasswordCard({
  onSave,
}: {
  onSave: (current: string, next: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next.length < 8) {
      setErr('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await onSave(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setSavedAt(Date.now());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ padding: 22 }}>
      <h2 className="t-h2" style={{ margin: '0 0 4px' }}>Password</h2>
      <div className="meta" style={{ marginBottom: 18 }}>
        Choose something at least 8 characters long. You'll need your
        current password to change it.
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Current password">
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            marginTop: 4,
          }}
        >
          {savedAt && Date.now() - savedAt < 4000 && (
            <Chip variant="success">
              <IconCheck size={12} strokeWidth={2.6} />
              Password changed
            </Chip>
          )}
          <Btn
            variant="primary"
            type="submit"
            disabled={busy || !current || !next || !confirm}
          >
            {busy ? 'Saving…' : 'Change password'}
          </Btn>
        </div>
      </form>
    </Card>
  );
}

/* ─────────────────────────── Field / FormFooter ───────────────────── */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function FormFooter({
  dirty,
  busy,
  savedAt,
  onReset,
}: {
  dirty: boolean;
  busy: boolean;
  savedAt: number | null;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
        marginTop: 4,
      }}
    >
      {savedAt && Date.now() - savedAt < 4000 && (
        <Chip variant="success">
          <IconCheck size={12} strokeWidth={2.6} />
          Saved
        </Chip>
      )}
      {dirty && (
        <Btn variant="ghost" type="button" onClick={onReset} disabled={busy}>
          Reset
        </Btn>
      )}
      <Btn variant="primary" type="submit" disabled={busy || !dirty}>
        {busy ? 'Saving…' : 'Save changes'}
      </Btn>
    </div>
  );
}
