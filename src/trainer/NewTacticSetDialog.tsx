import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { Btn } from '../components/ui/atoms';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string }) => Promise<void>;
}

export function NewTacticSetDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Give the set a name.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onCreate({ name: name.trim() });
      setName('');
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
      title="New tactical set"
    >
      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Set name</span>
          <input
            autoFocus
            className="input"
            placeholder="e.g. Pins and skewers — easy"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <p className="meta" style={{ marginTop: -4 }}>
          You'll author the puzzles by hand on the next screen — paste a FEN
          and play the solution moves on the board.
        </p>

        {err && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <Btn variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create set'}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
