import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { Btn } from '../components/ui/atoms';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; side: 'w' | 'b' }) => Promise<void>;
  // When true, the dialog frames itself as the first step of a Lichess
  // import — title + CTA tell the user the next screen will prompt for PGN.
  lichessHint?: boolean;
}

export function NewOpeningStudyDialog({ open, onClose, onCreate, lichessHint }: Props) {
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
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={lichessHint ? 'Import from Lichess' : 'New opening study'}
    >
      {lichessHint && (
        <p className="meta" style={{ marginBottom: 12 }}>
          Name the study and pick the student's side. The next screen will ask
          for the Lichess PGN.
        </p>
      )}
      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="overline">Study name</span>
          <input
            autoFocus
            className="input"
            placeholder="e.g. Caro-Kann Advance — White"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="overline">Which side does the student play?</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
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
        </div>

        {err && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            marginTop: 4,
          }}
        >
          <Btn variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy
              ? 'Creating…'
              : lichessHint
                ? 'Create + import PGN →'
                : 'Create study'}
          </Btn>
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
      style={{
        textAlign: 'left',
        padding: 14,
        borderRadius: 12,
        background: picked ? 'var(--accent-soft)' : 'var(--inset-bg)',
        border: `1px solid ${picked ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
        {title}
      </div>
      <div
        style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}
      >
        {hint}
      </div>
    </button>
  );
}
