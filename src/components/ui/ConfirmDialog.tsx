import { useState } from 'react';
import { Dialog } from './Dialog';

interface Props {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, paints the confirm button in red — for destructive actions. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={title}>
      {body && <p className="text-sm text-zinc-400">{body}</p>}
      <div className="flex gap-2 justify-end mt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-zinc-400 px-3 py-1.5 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className={`px-3 py-1.5 rounded font-medium disabled:opacity-50 ${
            destructive
              ? 'bg-red-500 hover:bg-red-400 text-zinc-950'
              : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
          }`}
        >
          {busy ? '…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
