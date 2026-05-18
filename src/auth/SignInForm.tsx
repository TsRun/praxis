import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

export function SignInForm() {
  const { signin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signin(email, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 w-80">
      <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        disabled={busy}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded px-3 py-1.5 font-medium disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </form>
  );
}
