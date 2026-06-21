import { useState, type FormEvent } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { Btn } from '../components/ui/atoms';

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
      width={520}
    >
      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <label
          htmlFor="game-study-name"
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <span>
            Study name{' '}
            <span aria-hidden="true" style={{ color: 'var(--danger)' }}>
              *
            </span>
          </span>
          <input
            id="game-study-name"
            autoFocus
            className="input"
            placeholder="e.g. Carlsen vs Caruana, WCC 2018, Game 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-required="true"
            aria-invalid={err && !name.trim() ? true : undefined}
          />
        </label>
        <label
          htmlFor="game-study-pgn"
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <span>
            PGN{' '}
            <span aria-hidden="true" style={{ color: 'var(--danger)' }}>
              *
            </span>
          </span>
          <textarea
            id="game-study-pgn"
            rows={10}
            className="textarea font-mono"
            placeholder={
              '[Event "..."]\n[White "..."]\n[Black "..."]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 ...'
            }
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            style={{ fontSize: 12.5, resize: 'vertical' }}
            required
            aria-required="true"
            aria-invalid={err && !pgn.trim() ? true : undefined}
            aria-describedby={
              err ? 'game-study-pgn-help game-study-error' : 'game-study-pgn-help'
            }
          />
        </label>
        <p id="game-study-pgn-help" className="meta" style={{ marginTop: -8 }}>
          Paste a PGN to import the moves of a single game — copy it from
          chess.com, Lichess, or any other source.
        </p>

        {err && (
          <span
            id="game-study-error"
            role="alert"
            style={{ fontSize: 12, color: 'var(--danger)' }}
          >
            {err}
          </span>
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
            disabled={busy || !name.trim() || !pgn.trim()}
          >
            {busy ? 'Importing…' : 'Import game'}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
