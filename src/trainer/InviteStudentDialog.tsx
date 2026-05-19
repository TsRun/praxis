import { useState, type FormEvent } from 'react';
import { trainer } from '../lib/api';

export function InviteStudentDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await trainer.invite(email, name);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 grid place-items-center z-40"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="panel p-6 w-96 flex flex-col gap-3"
      >
        <h3 className="font-semibold tracking-tight">Invite a student</h3>
        <p className="text-xs text-zinc-500 -mt-1">
          Pick a nickname you'll see them by. We'll email them the invite link.
        </p>
        <input
          autoFocus
          className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
          placeholder="student nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
          placeholder="student email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-zinc-400 px-3 py-1.5">
            Cancel
          </button>
          <button
            disabled={busy}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        {err && <span className="text-xs text-red-400">{err}</span>}
      </form>
    </div>
  );
}
