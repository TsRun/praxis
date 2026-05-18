import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; side: 'w' | 'b' }) => Promise<void>;
}

export function NewOpeningStudyDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [side, setSide] = useState<'w' | 'b'>('w');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Give the study a name.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onCreate({ name: name.trim(), side });
      setName('');
      setSide('w');
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title="New opening study">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Study name
          </span>
          <input
            autoFocus
            className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1.5"
            placeholder="e.g. Caro-Kann Advance — White"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs uppercase tracking-wider text-zinc-500">
            Which side does the student play?
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <SideOption
              picked={side === 'w'}
              onClick={() => setSide('w')}
              title="White"
              hint="You're preparing 1.e4 / 1.d4 / etc."
            />
            <SideOption
              picked={side === 'b'}
              onClick={() => setSide('b')}
              title="Black"
              hint="You're preparing replies to White's first move."
            />
          </div>
        </fieldset>

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
            disabled={busy || !name.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded font-medium disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create study'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function SideOption({
  picked,
  onClick,
  title,
  hint,
}: {
  picked: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded border transition-colors ${
        picked
          ? 'border-amber-400/40 bg-amber-400/[0.06]'
          : 'border-zinc-800 hover:bg-zinc-800/40'
      }`}
    >
      <div className="text-sm font-medium text-zinc-100">{title}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{hint}</div>
    </button>
  );
}
