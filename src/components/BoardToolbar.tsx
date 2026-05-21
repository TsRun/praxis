import { useState, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { copyBoardImage } from '../lib/board-image';
import { IconCopy, IconCheck, IconClipboard, IconAlert } from './ui/Icons';

/**
 * Compact board-side widget. Two small round icon buttons (paste FEN +
 * copy diagram) stacked in a vertical column. Designed to sit to the
 * RIGHT of the board, not overlapping it — wrap the board + this
 * widget in a horizontal flex container.
 *
 * Paste is only rendered when the caller plumbs `onPasteFen`; copy is
 * always available.
 */
export function BoardToolbar({
  fen,
  orientation = 'white',
  onPasteFen,
  style,
}: {
  fen: string;
  /** Side at the bottom of the rendered diagram. Affects copy output. */
  orientation?: 'white' | 'black';
  /** When provided, a paste button is rendered. Receives the trimmed FEN
   * from the clipboard, already validated against chess.js. */
  onPasteFen?: (fen: string) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0,
        ...style,
      }}
    >
      {onPasteFen && <PasteButton onPaste={onPasteFen} />}
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
        width: 32,
        height: 32,
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
