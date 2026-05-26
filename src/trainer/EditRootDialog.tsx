import { useEffect, useRef, useState } from 'react';
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
  side: 'w' | 'b';
  /** The currently-stored root PGN (null = standard start). Used to seed
   *  the board so the trainer doesn't have to retype the current prefix. */
  currentRootPgn: string | null;
  /** When true, saving will wipe existing nodes — we show a destructive
   *  confirm-style label and warning blurb. */
  hasNodes: boolean;
  onSave: (input: {
    root_fen: string;
    root_pgn: string | null;
  }) => Promise<void>;
}

function sansToPgn(sans: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(sans[i]);
  }
  return parts.join(' ');
}

/** Replay a stored root_pgn (one of our own normalised "1. e4 e5 2. Nf3"
 *  forms) back into a SAN array. Tolerant of move numbers and result tags
 *  the way the server-side parser is. */
function pgnToSans(pgn: string): string[] {
  const c = new Chess();
  try {
    c.loadPgn(pgn);
    return c.history();
  } catch {
    /* fall through to manual tokenising */
  }
  const tokens = pgn
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/[?!]+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const tok of tokens) {
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
    try {
      c.move(tok);
    } catch {
      return c.history();
    }
  }
  return c.history();
}

export function EditRootDialog({
  open,
  onClose,
  side,
  currentRootPgn,
  hasNodes,
  onSave,
}: Props) {
  const [sans, setSans] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Seed from the study's existing prefix every time the dialog opens.
  useEffect(() => {
    if (open) {
      setSans(currentRootPgn ? pgnToSans(currentRootPgn) : []);
      setErr(null);
    }
  }, [open, currentRootPgn]);

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

  const changed =
    sansToPgn(sans) !== (currentRootPgn ?? '') && !(sans.length === 0 && !currentRootPgn);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const hasPrefix = sans.length > 0;
      await onSave({
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
      title="Edit opening prefix"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="meta" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          Play the moves that should precede every line in this study. Leave
          empty to start from the standard position.
        </p>

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

        {hasNodes && changed && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--danger-soft)',
              border: '1px solid var(--danger-ring)',
              fontSize: 12.5,
              lineHeight: 1.5,
              color: 'var(--text)',
            }}
          >
            <strong>This will erase every move in the study.</strong> The
            existing tree was built on the old starting position and won't
            line up with the new one. Chapters and quiz progress on those
            moves are removed too.
          </div>
        )}

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
            variant={hasNodes ? 'danger' : 'primary'}
            type="button"
            disabled={busy || !changed}
            onClick={save}
          >
            {busy
              ? 'Saving…'
              : hasNodes
                ? 'Replace tree & save'
                : 'Save prefix'}
          </Btn>
        </div>
      </div>
    </Dialog>
  );
}

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
