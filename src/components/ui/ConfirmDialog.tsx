import { useState } from 'react';
import { Dialog } from './Dialog';
import { Btn } from './atoms';

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
      {body && <p className="meta">{body}</p>}
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          marginTop: 4,
        }}
      >
        <Btn variant="ghost" type="button" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Btn>
        <Btn
          variant={destructive ? 'danger' : 'primary'}
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? '…' : confirmLabel}
        </Btn>
      </div>
    </Dialog>
  );
}
