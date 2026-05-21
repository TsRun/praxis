import { useState, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { copyBoardImage } from '../lib/board-image';
import { IconCopy, IconCheck, IconFlip, IconClipboard, IconAlert } from './ui/Icons';

/**
 * Compact floating board widget. Three small circular icon buttons at the
 * top-right of a board container: paste a FEN from the clipboard, flip
 * the board orientation, copy the diagram as a PNG. Each button is
 * optional — only the ones the caller plumbs a handler for are rendered.
 *
 * Sits inside a `position: relative` parent (the board wrapper) at
 * top-right so it overlays the board without taking a row in the layout.
 */
export function BoardToolbar({
  fen,
  orientation = 'white',
  onFlip,
  onPasteFen,
  style,
}: {
  fen: string;
  /** Side at the bottom of the rendered diagram. Affects copy output. */
  orientation?: 'white' | 'black';
  /** When provided, a flip button is rendered. Caller toggles its own state. */
  onFlip?: () => void;
  /** When provided, a paste button is rendered. Receives the trimmed FEN
   * from the clipboard, already validated against chess.js. */
  onPasteFen?: (fen: string) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 3,
        display: 'inline-flex',
        gap: 6,
        ...style,
      }}
      // Keep clicks from leaking through to the chessground board behind us.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {onPasteFen && <PasteButton onPaste={onPasteFen} />}
      {onFlip && <RoundBtn title="Flip board" onClick={onFlip} icon={<IconFlip size={13} strokeWidth={2.4} />} />}
      <CopyButton fen={fen} orientation={orientation} />
    </div>
  );
}

function CopyButton({ fen, orientation }: { fen: string; orientation: 'white' | 'black' }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function go() {
    setState('busy');
    try {
      await copyBoardImage(fen, { orientation });
      setState('done');
      window.setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2000);
    }
  }
  const icon =
    state === 'done' ? <IconCheck size={13} strokeWidth={2.4} /> :
    state === 'error' ? <IconAlert size={13} strokeWidth={2.4} /> :
    <IconCopy size={13} strokeWidth={2.4} />;
  return (
    <RoundBtn
      title={
        state === 'done' ? 'Copied!' :
        state === 'error' ? 'Copy failed' :
        'Copy diagram as image'
      }
      onClick={go}
      disabled={state === 'busy'}
      icon={icon}
      tone={state === 'done' ? 'success' : state === 'error' ? 'danger' : undefined}
    />
  );
}

function PasteButton({ onPaste }: { onPaste: (fen: string) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function go() {
    setState('busy');
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      // Validate; chess.js throws on bad FEN.
      // eslint-disable-next-line no-new
      new Chess(trimmed);
      onPaste(trimmed);
      setState('done');
      window.setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2000);
    }
  }
  const icon =
    state === 'done' ? <IconCheck size={13} strokeWidth={2.4} /> :
    state === 'error' ? <IconAlert size={13} strokeWidth={2.4} /> :
    <IconClipboard size={13} strokeWidth={2.4} />;
  return (
    <RoundBtn
      title={
        state === 'done' ? 'Pasted' :
        state === 'error' ? 'Clipboard had no valid FEN' :
        'Paste FEN from clipboard'
      }
      onClick={go}
      disabled={state === 'busy'}
      icon={icon}
      tone={state === 'done' ? 'success' : state === 'error' ? 'danger' : undefined}
    />
  );
}

function RoundBtn({
  title,
  onClick,
  disabled,
  icon,
  tone,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  tone?: 'success' | 'danger';
}) {
  const border =
    tone === 'success' ? 'var(--accent-ring)' :
    tone === 'danger' ? 'var(--danger)' :
    'var(--inset-border)';
  const color =
    tone === 'success' ? 'var(--accent)' :
    tone === 'danger' ? 'var(--danger)' :
    'var(--text)';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: 'var(--card-bg)',
        border: `1px solid ${border}`,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}
