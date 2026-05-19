import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { ALL_ROLES, type Role } from '../lib/api';

const ROLE_LABELS: Record<Role, { title: string; desc: string }> = {
  trainer: {
    title: 'Trainer',
    desc: 'I coach others. I want to invite students and build studies for them.',
  },
  student: {
    title: 'Student',
    desc: 'I learn from a coach. I want to receive studies and work through them.',
  },
  self: {
    title: 'Own trainer',
    desc: "I'm my own coach. I want to build studies for myself and study solo.",
  },
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
    <form onSubmit={submit} className="flex flex-col gap-4 w-[26rem]">
      <div className="flex gap-1 mb-1 text-sm bg-zinc-900/60 rounded-lg p-1 ring-1 ring-zinc-800">
        <button
          type="button"
          onClick={() => setMode('in')}
          className={`flex-1 py-1.5 rounded ${
            mode === 'in' ? 'bg-amber-500 text-zinc-950 font-medium' : 'text-zinc-400'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('up')}
          className={`flex-1 py-1.5 rounded ${
            mode === 'up' ? 'bg-amber-500 text-zinc-950 font-medium' : 'text-zinc-400'
          }`}
        >
          Create account
        </button>
      </div>

      {mode === 'up' && (
        <input
          className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
          placeholder="your nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
        />
      )}

      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        readOnly={!!inviteEmail && mode === 'up'}
      />
      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
        type="password"
        placeholder={mode === 'up' ? 'password (8+ chars)' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
      />

      {mode === 'up' && (
        <fieldset className="flex flex-col gap-2 panel p-3">
          <legend className="text-xs uppercase tracking-wider text-zinc-500 px-1">
            How will you use Praxis?
          </legend>
          <p className="text-xs text-zinc-500 -mt-1">Pick one or more. You can change this later.</p>
          {ALL_ROLES.map((r) => (
            <label
              key={r}
              className={`flex items-start gap-3 p-2 rounded cursor-pointer border ${
                roles.has(r) ? 'border-amber-400/40 bg-amber-400/[0.04]' : 'border-zinc-800'
              }`}
            >
              <input
                type="checkbox"
                checked={roles.has(r)}
                onChange={() => toggle(r)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-100">{ROLE_LABELS[r].title}</div>
                <div className="text-xs text-zinc-400">{ROLE_LABELS[r].desc}</div>
              </div>
            </label>
          ))}
        </fieldset>
      )}

      <button
        disabled={busy}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded px-3 py-1.5 font-medium disabled:opacity-50"
      >
        {busy
          ? mode === 'in'
            ? 'Signing in…'
            : 'Creating…'
          : mode === 'in'
            ? 'Sign in'
            : 'Create account'}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </form>
  );
}
