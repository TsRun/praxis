import { useState } from 'react';
import { copyBoardImage } from '../lib/board-image';
import { Btn } from './ui/atoms';
import { IconCopy, IconCheck } from './ui/Icons';

/**
 * Small "Copy diagram" button. Renders the FEN to a PNG and writes it
 * to the clipboard. Shows a brief "Copied" pulse on success and a
 * single-line error chip if the clipboard call fails (Firefox before
 * 127 doesn't expose ClipboardItem; some browsers gate it behind a
 * user-activation check that we satisfy by being triggered from a
 * click).
 */
export function CopyDiagramButton({
  fen,
  orientation = 'white',
  size = 'sm',
  variant = 'ghost',
  label = 'Copy diagram',
}: {
  fen: string;
  orientation?: 'white' | 'black';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  label?: string;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setState('busy');
    setErr(null);
    try {
      await copyBoardImage(fen, { orientation });
      setState('done');
      window.setTimeout(() => setState('idle'), 1500);
    } catch (e) {
      setErr((e as Error).message);
      setState('error');
      window.setTimeout(() => setState('idle'), 2500);
    }
  }

  return (
    <Btn
      variant={variant}
      size={size}
      onClick={go}
      disabled={state === 'busy'}
      title={err ?? (label || 'Copy diagram')}
      aria-label={label || 'Copy diagram'}
    >
      {state === 'done' ? (
        <IconCheck size={13} strokeWidth={2.4} />
      ) : (
        <IconCopy size={13} strokeWidth={2.4} />
      )}
      {state === 'done' ? 'Copied' : state === 'error' ? 'Failed' : label}
    </Btn>
  );
}
