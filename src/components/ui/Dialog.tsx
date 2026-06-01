import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Btn } from './atoms';
import { IconX } from './Icons';

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Trap Tab/Shift+Tab inside the dialog so focus can't escape to elements
  // behind the modal. Restore focus to the previously focused element on close.
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    if (!root) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !root) return;
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      if (prevFocus && typeof prevFocus.focus === 'function') {
        prevFocus.focus();
      }
    };
  }, [open]);

  // Lock body scroll while open so the page behind doesn't move under the
  // modal. scrollbar-gutter on <html> keeps the scrollbar slot reserved so
  // the page doesn't shift sideways when overflow flips to hidden.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '92vw',
          // Keep the dialog within the viewport on short screens (e.g. mobile)
          // — otherwise it overflows beyond a centered backdrop and the
          // header/footer get clipped with no way to scroll to them.
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
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
            <Btn
              variant="ghost"
              size="sm"
              onClick={onClose}
              type="button"
              aria-label="Close"
              style={{ minWidth: 36, minHeight: 36, padding: 0, justifyContent: 'center' }}
            >
              <IconX size={14} strokeWidth={2.4} />
            </Btn>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
