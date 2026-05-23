import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  ALL_ROLES,
  apiKeys,
  type ApiKeyRow,
  type Role,
} from '../lib/api';
import { Card, Btn, Chip } from '../components/ui/atoms';
import { TopBar } from '../components/ui/TopBar';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import {
  IconArrowL,
  IconMortar,
  IconUser,
  IconClock,
  IconCheck,
  IconPlus,
  IconTrash,
} from '../components/ui/Icons';

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

        <ApiKeysCard />
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

/* ─────────────────────────── API keys card ────────────────────────── */

function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  // The freshly-minted key is rendered once and copyable; null otherwise.
  const [mintedKey, setMintedKey] = useState<{ name: string; key: string } | null>(null);

  async function refresh() {
    setKeys(await apiKeys.list());
  }
  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h2 className="t-h2" style={{ margin: 0 }}>API keys</h2>
          <div className="meta" style={{ marginTop: 4, fontSize: 12 }}>
            Programmatic access for the MCP server, scripts, or CI. Each key
            authenticates as you with all of your roles.
          </div>
        </div>
        <Btn variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
          <IconPlus size={13} strokeWidth={2.4} />
          New key
        </Btn>
      </div>

      {keys == null ? (
        <div className="meta" style={{ fontSize: 13 }}>Loading…</div>
      ) : keys.length === 0 ? (
        <div className="meta" style={{ fontSize: 13 }}>
          No keys yet. Mint one to plug into the Praxis MCP server.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {keys.map((k) => (
            <div
              key={k.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '10px 12px',
                background: 'var(--inset-bg)',
                border: '1px solid var(--inset-border)',
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{k.name}</div>
                <div
                  className="mono meta"
                  style={{ fontSize: 11, marginTop: 2 }}
                  title={k.key_prefix}
                >
                  {k.key_prefix}…
                </div>
              </div>
              <div className="meta" style={{ fontSize: 11, textAlign: 'right' }}>
                <div>created {fmtDate(k.created_at)}</div>
                <div>
                  {k.last_used_at
                    ? `last used ${fmtDate(k.last_used_at)}`
                    : 'never used'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevoking(k)}
                title="Revoke key"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  padding: 6,
                }}
              >
                <IconTrash size={13} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <NewKeyDialog
          onClose={() => setShowCreate(false)}
          onCreated={async (mint) => {
            setShowCreate(false);
            setMintedKey({ name: mint.name, key: mint.key });
            await refresh();
          }}
        />
      )}

      {mintedKey && (
        <MintedKeyDialog
          name={mintedKey.name}
          token={mintedKey.key}
          onClose={() => setMintedKey(null)}
        />
      )}

      {revoking && (
        <ConfirmDialog
          open
          title={`Revoke "${revoking.name}"?`}
          body="Any client using this key will start getting 401s on its next call. Cannot be undone."
          confirmLabel="Revoke"
          destructive
          onClose={() => setRevoking(null)}
          onConfirm={async () => {
            await apiKeys.revoke(revoking.id);
            setRevoking(null);
            await refresh();
          }}
        />
      )}
    </Card>
  );
}

function NewKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (mint: { name: string; key: string }) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const mint = await apiKeys.create(name.trim());
      onCreated({ name: mint.name, key: mint.key });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={busy ? () => {} : onClose} title="New API key">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Label">
          <input
            className="input"
            placeholder="e.g. Claude Code MCP"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {err && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Minting…' : 'Mint key'}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}

function MintedKeyDialog({
  name,
  token,
  onClose,
}: {
  name: string;
  token: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onClose={onClose} title={`Key minted: ${name}`}>
      <p className="meta" style={{ marginTop: 0 }}>
        Copy the key now — Praxis won't show it again. Treat it like a
        password.
      </p>
      <div
        className="mono"
        style={{
          fontSize: 12,
          padding: 12,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          borderRadius: 8,
          wordBreak: 'break-all',
          color: 'var(--text)',
        }}
      >
        {token}
      </div>
      <p className="meta" style={{ marginTop: 12, fontSize: 12 }}>
        To plug this into Claude Code, run:
      </p>
      <div
        className="mono"
        style={{
          fontSize: 11,
          padding: 10,
          marginTop: 6,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          borderRadius: 8,
          wordBreak: 'break-all',
          color: 'var(--text-dim)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {`claude mcp add --transport http praxis ${window.location.origin}/api/mcp --header "Authorization: Bearer ${token}"`}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
        <Btn
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Btn>
        <Btn variant="primary" onClick={onClose}>Done</Btn>
      </div>
    </Dialog>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const ms = now - d.getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return d.toLocaleDateString();
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
