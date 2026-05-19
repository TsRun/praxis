import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { ALL_ROLES, type Role } from '../lib/api';
import { Btn } from '../components/ui/atoms';
import { IconMortar, IconUser, IconClock } from '../components/ui/Icons';

const ROLE_LABELS: Record<Role, { title: string; sub: string; Icon: typeof IconMortar }> = {
  trainer: { title: 'Trainer',     sub: 'I coach others',     Icon: IconMortar },
  student: { title: 'Student',     sub: 'A coach assigns me', Icon: IconUser },
  self:    { title: 'Solo',        sub: 'My own materials',   Icon: IconClock },
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  'oauth-cancelled': 'Google sign-in was cancelled.',
  'oauth-state':     'Your sign-in link expired. Please try again.',
  'oauth-failed':    'We could not finish signing you in with Google. Please try again.',
  'google-unverified': "Your Google email is not verified yet. Verify it on Google's side, then try again.",
};

interface Props {
  inviteToken?: string;
  inviteEmail?: string;
  inviteName?: string;
}

export function SignInUpForm({ inviteToken, inviteEmail, inviteName }: Props) {
  const { signin, signup } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>(inviteToken ? 'up' : 'in');
  const [email, setEmail] = useState(inviteEmail ?? '');
  const [name, setName] = useState(inviteName ?? '');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<Set<Role>>(
    new Set(inviteToken ? ['student'] : ['trainer']),
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Surface ?error=<code> from the OAuth callback redirect, then strip the
  // query string so a refresh doesn't show it again.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (!code) return;
    setErr(OAUTH_ERROR_MESSAGES[code] ?? 'Sign-in failed. Please try again.');
    params.delete('error');
    const qs = params.toString();
    window.history.replaceState(
      {}, '',
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
    );
  }, []);

  const googleStartHref = inviteToken
    ? `/api/auth/oauth/google/start?invite=${encodeURIComponent(inviteToken)}`
    : '/api/auth/oauth/google/start';

  function toggle(r: Role) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'in') {
        await signin(email, password);
      } else {
        if (roles.size === 0) {
          setErr('Pick at least one role.');
          setBusy(false);
          return;
        }
        await signup(email, password, name, [...roles], inviteToken);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          gap: 4,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          borderRadius: 10,
          padding: 4,
          marginBottom: 22,
        }}
      >
        <button
          type="button"
          onClick={() => setMode('in')}
          style={{
            flex: 1,
            background: mode === 'in' ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: 0,
            padding: 8,
            borderRadius: 7,
            color: mode === 'in' ? 'var(--text)' : 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 13.5,
            fontWeight: 500,
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('up')}
          style={{
            flex: 1,
            background: mode === 'up' ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: 0,
            padding: 8,
            borderRadius: 7,
            color: mode === 'up' ? 'var(--text)' : 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 13.5,
            fontWeight: 500,
          }}
        >
          Create account
        </button>
      </div>

      <a
        href={googleStartHref}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          height: 42,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          borderRadius: 10,
          color: 'var(--text)',
          fontSize: 13.5,
          fontWeight: 500,
          textDecoration: 'none',
          marginBottom: 14,
        }}
      >
        <GoogleG />
        Continue with Google
      </a>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: 'var(--text-faint)',
          fontSize: 11.5,
          margin: '0 0 14px',
        }}
      >
        <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
        or
        <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}
        >
          Email
        </label>
        <input
          className="input"
          placeholder="you@studio.club"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          readOnly={!!inviteEmail && mode === 'up'}
        />
      </div>

      {mode === 'up' && (
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            Nickname{' '}
            <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
              (how students find you)
            </span>
          </label>
          <input
            className="input"
            placeholder="e.g. tactical_torre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </div>
      )}

      <div style={{ marginBottom: mode === 'up' ? 18 : 16 }}>
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}
        >
          Password
        </label>
        <input
          className="input"
          type="password"
          placeholder={mode === 'up' ? 'at least 8 characters' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
        />
      </div>

      {mode === 'up' && (
        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            I am a
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {ALL_ROLES.map((r) => {
              const on = roles.has(r);
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
        </div>
      )}

      <Btn
        type="submit"
        variant="primary"
        size="lg"
        disabled={busy}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {busy
          ? mode === 'in'
            ? 'Signing in…'
            : 'Creating…'
          : mode === 'in'
            ? 'Sign in →'
            : 'Create account →'}
      </Btn>

      {err && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 10, textAlign: 'center' }}>
          {err}
        </div>
      )}

      <div
        className="meta"
        style={{ textAlign: 'center', marginTop: 14, fontSize: 12 }}
      >
        By creating an account you accept our{' '}
        <a className="link" href="#">terms</a> and{' '}
        <a className="link" href="#">privacy</a>.
      </div>
    </form>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.4 39.6 16.1 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.2 35.8 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}
