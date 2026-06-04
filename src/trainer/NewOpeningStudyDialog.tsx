import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { Dialog } from '../components/ui/Dialog';
import { Btn } from '../components/ui/atoms';
import { IconArrowL, IconFlip } from '../components/ui/Icons';

const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    side: 'w' | 'b';
    root_fen: string;
    root_pgn: string | null;
  }) => Promise<void>;
  // When true, the dialog frames itself as the first step of a Lichess
  // import — title + CTA tell the user the next screen will prompt for PGN.
  lichessHint?: boolean;
}

/** Render "1. e4 e5 2. Nf3" from a SAN list. */
function sansToPgn(sans: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(sans[i]);
  }
  return parts.join(' ');
}

export function NewOpeningStudyDialog({
  open,
  onClose,
  onCreate,
  lichessHint,
}: Props) {
  const [name, setName] = useState('');
  const [side, setSide] = useState<'w' | 'b'>('w');
  const [sans, setSans] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sideGroupLabelId = useId();
  const sideRadioName = useId();

  // Reset all dialog state when it (re)opens.
  useEffect(() => {
    if (open) {
      setName('');
      setSide('w');
      setSans([]);
      setErr(null);
    }
  }, [open]);

  const currentChess = (() => {
    const c = new Chess();
    for (const san of sans) {
      try {
        c.move(san);
      } catch {
        /* unreachable — sans only ever contains moves chess.js produced */
      }
    }
    return c;
  })();
  const currentFen = currentChess.fen();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Give the study a name.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const hasPrefix = sans.length > 0;
      await onCreate({
        name: name.trim(),
        side,
        root_fen: hasPrefix ? currentFen : STANDARD_START_FEN,
        root_pgn: hasPrefix ? sansToPgn(sans) : null,
      });
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
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Study name</span>
          <input
            autoFocus
            className="input"
            placeholder="e.g. Caro-Kann Advance — White"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span id={sideGroupLabelId}>
            Which side does the student play?
          </span>
          <div
            role="radiogroup"
            aria-labelledby={sideGroupLabelId}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 8,
            }}
          >
            <SideOption
              name={sideRadioName}
              value="w"
              picked={side === 'w'}
              onSelect={() => setSide('w')}
              title="White"
              hint="You're preparing 1.e4 / 1.d4 / etc."
            />
            <SideOption
              name={sideRadioName}
              value="b"
              picked={side === 'b'}
              onSelect={() => setSide('b')}
              title="Black"
              hint="You're preparing replies to White's first move."
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderTop: '1px solid var(--hairline)',
            paddingTop: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 500 }}>Starting position</span>
            <span className="meta" style={{ fontSize: 12 }}>
              Optional · play moves on the board to anchor the tree.
            </span>
          </div>
          <PrefixBoard
            fen={currentFen}
            flip={side === 'b'}
            onPlay={(san) => setSans((prev) => [...prev, san])}
          />
          <PrefixMoveList
            sans={sans}
            onUndo={() => setSans((prev) => prev.slice(0, -1))}
            onReset={() => setSans([])}
          />
        </div>

        {err && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</span>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            // Pin the action buttons to the bottom of the (scrollable)
            // dialog so they stay reachable on short viewports — the
            // optional starting-position board can otherwise push them
            // below the scroll fold.
            position: 'sticky',
            bottom: 0,
            marginInline: -22,
            paddingInline: 22,
            paddingBlock: 10,
            background: 'var(--card-bg)',
            borderTop: '1px solid var(--hairline)',
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
  name,
  value,
  picked,
  onSelect,
  title,
  hint,
}: {
  name: string;
  value: string;
  picked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className="role-pick"
      style={{
        position: 'relative',
        display: 'block',
        textAlign: 'left',
        padding: 14,
        borderRadius: 12,
        background: picked ? 'var(--accent-soft)' : 'var(--inset-bg)',
        border: `1px solid ${picked ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
        color: 'inherit',
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={picked}
        onChange={onSelect}
        aria-label={`${title} — ${hint}`}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
        {hint}
      </div>
    </label>
  );
}

/** Small board for setting the opening prefix — mirrors the editor's board
 * (chessground + chess.js dest map) but only emits SAN moves; the move list
 * lives in dialog state. The board is reconfigured on every fen prop change
 * but the chessground instance itself only mounts once. */
function PrefixBoard({
  fen,
  flip,
  onPlay,
}: {
  fen: string;
  flip: boolean;
  onPlay: (san: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);
  const fenRef = useRef(fen);
  fenRef.current = fen;
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  function toDestsMap(c: Chess): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    for (const m of c.moves({ verbose: true })) {
      const from = m.from as Key;
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from)!.push(m.to as Key);
    }
    return dests;
  }

  function onBoardMove(from: Key, to: Key) {
    const c = new Chess(fenRef.current);
    let mv: ReturnType<typeof c.move> | null = null;
    try {
      mv = c.move({ from, to, promotion: 'q' });
    } catch {
      mv = null;
    }
    if (mv) onPlayRef.current(mv.san);
  }

  useEffect(() => {
    if (!boardRef.current) return;
    const c = new Chess(fen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    cgRef.current = Chessground(boardRef.current, {
      fen,
      turnColor,
      orientation: flip ? 'black' : 'white',
      movable: {
        free: false,
        color: turnColor,
        dests: toDestsMap(c),
        events: { after: onBoardMove },
      },
      draggable: { showGhost: true },
      animation: { duration: 120 },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cgRef.current?.set({ orientation: flip ? 'black' : 'white' });
  }, [flip]);

  useEffect(() => {
    if (!cgRef.current) return;
    const c = new Chess(fen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    cgRef.current.set({
      fen,
      turnColor,
      movable: {
        color: turnColor,
        dests: toDestsMap(c),
        events: { after: onBoardMove },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  return (
    <div
      ref={boardRef}
      style={{
        width: '100%',
        maxWidth: 320,
        aspectRatio: '1 / 1',
        alignSelf: 'center',
      }}
    />
  );
}

function PrefixMoveList({
  sans,
  onUndo,
  onReset,
}: {
  sans: string[];
  onUndo: () => void;
  onReset: () => void;
}) {
  const empty = sans.length === 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        minHeight: 32,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'var(--inset-bg)',
        border: '1px solid var(--inset-border)',
      }}
    >
      {empty ? (
        <span className="meta" style={{ fontSize: 12 }}>
          Standard start — drag a piece to set a prefix.
        </span>
      ) : (
        <>
          <code
            className="mono"
            style={{
              fontSize: 12,
              color: 'var(--text)',
              background: 'transparent',
              padding: 0,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sansToPgn(sans)}
          </code>
          <Btn variant="ghost" size="sm" type="button" onClick={onUndo}>
            <IconArrowL size={12} strokeWidth={2.4} />
            Undo
          </Btn>
          <Btn variant="ghost" size="sm" type="button" onClick={onReset}>
            <IconFlip size={12} strokeWidth={2.4} />
            Reset
          </Btn>
        </>
      )}
    </div>
  );
}
