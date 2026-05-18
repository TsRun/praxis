import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; pgn: string }) => Promise<void>;
}

export function NewGameStudyDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [pgn, setPgn] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Give the study a name.');
      return;
    }
    if (!pgn.trim()) {
      setErr('Paste a PGN.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onCreate({ name: name.trim(), pgn: pgn.trim() });
      setName('');
      setPgn('');
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title="New game study"
      width="w-[32rem]"
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Study name
          </span>
          <input
            autoFocus
            className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
            placeholder="e.g. Carlsen vs Caruana, WCC 2018, Game 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            PGN
          </span>
          <textarea
            rows={10}
            className="bg-zinc-950/60 border border-zinc-800 rounded px-2 py-1.5 font-mono text-xs"
            placeholder={
              '[Event "..."]\n[White "..."]\n[Black "..."]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 ...'
            }
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
          />
        </label>

        {err && <span className="text-xs text-red-400">{err}</span>}

        <div className="flex gap-2 justify-end mt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-zinc-400 px-3 py-1.5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim() || !pgn.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import game'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
