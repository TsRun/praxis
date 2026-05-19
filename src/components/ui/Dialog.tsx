import { useEffect, type ReactNode } from 'react';
import { Btn } from './atoms';
import { IconX } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional fixed width in px (defaults to 460). */
  width?: number;
}

/**
 * Backdrop-blurred modal. Click-outside or Esc closes.
 * The body is the caller's responsibility — pass form / buttons as children.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 460,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '92vw',
          padding: 22,
          background: 'var(--card-bg)',
          borderRadius: 16,
          boxShadow: 'var(--card-shadow), 0 30px 80px -20px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2 className="t-h2" style={{ margin: 0 }}>{title}</h2>
            <Btn variant="ghost" size="sm" onClick={onClose} type="button">
              <IconX size={14} strokeWidth={2.4} />
            </Btn>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
