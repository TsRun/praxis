import { useState, type FormEvent } from 'react';
import { invites, type InviteInfo } from '../lib/api';

export function InviteAcceptForm({ info }: { info: InviteInfo }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await invites.accept(info.token, password);
      // Reload so AuthProvider re-fetches /me with the new session cookie
      window.location.assign('/student');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 w-96">
      <h2 className="text-lg font-semibold tracking-tight">
        <span className="text-amber-400">{info.trainer_name}</span> invited you to ChessCoach
      </h2>
      <p className="text-sm text-zinc-400">
        Hi <strong className="text-zinc-200">{info.student_name}</strong> ({info.student_email}).
        Set a password to claim your account.
      </p>
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
        {busy ? 'Joining…' : 'Join'}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </form>
  );
}
