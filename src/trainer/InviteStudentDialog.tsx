import { useState, type FormEvent } from 'react';
import { trainer, type LinkCandidate } from '../lib/api';

type Ambig = { kind: 'ambiguous'; candidates: LinkCandidate[] };

export function InviteStudentDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ambig, setAmbig] = useState<Ambig | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    setAmbig(null);
    try {
      await trainer.link(name.trim());
      onClose();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      // The api helper throws `${method} ${path} → 409` for non-2xx;
      // try to fetch raw to parse the candidates list.
      try {
        const res = await fetch('/api/trainer/invites', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (res.status === 409) {
          const body = (await res.json()) as { candidates: LinkCandidate[] };
          setAmbig({ kind: 'ambiguous', candidates: body.candidates });
        } else if (res.status === 404) {
          setErr(`No signed-in user has the nickname "${name.trim()}".`);
        } else if (!res.ok) {
          setErr(msg);
        }
      } catch {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function linkById(id: number) {
    setBusy(true);
    setErr(null);
    try {
      await trainer.linkById(id);
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
        <h3 className="font-semibold tracking-tight">Add a student</h3>
        <p className="text-xs text-zinc-500 -mt-1">
          The student must already be signed up on Praxis. Type their nickname —
          we'll link them and send a notification email.
        </p>
        <input
          autoFocus
          className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
          placeholder="student nickname"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setAmbig(null);
            setErr(null);
          }}
        />
        {ambig && (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-xs text-amber-300">
              Multiple users share that nickname — pick the right one:
            </p>
            {ambig.candidates.map((c) => (
              <button
                type="button"
                key={c.id}
                disabled={busy}
                onClick={() => linkById(c.id)}
                className="text-left px-2 py-1.5 rounded hover:bg-amber-400/10 ring-1 ring-zinc-800 hover:ring-amber-400/30"
              >
                {c.name} <span className="text-xs text-zinc-500">#{c.id}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-zinc-400 px-3 py-1.5">
            Cancel
          </button>
          <button
            disabled={busy || !name.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
          >
            {busy ? 'Linking…' : 'Add'}
          </button>
        </div>
        {err && <span className="text-xs text-red-400">{err}</span>}
      </form>
    </div>
  );
}
