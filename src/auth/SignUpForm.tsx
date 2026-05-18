import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

export function SignUpForm() {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signup(email, password, name);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 w-80">
      <h2 className="text-lg font-semibold tracking-tight">Become a trainer</h2>
      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
        placeholder="your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
        type="password"
        placeholder="password (8+ chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        disabled={busy}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded px-3 py-1.5 font-medium disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </form>
  );
}
