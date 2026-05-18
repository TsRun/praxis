import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional fixed width; defaults to 26rem. */
  width?: string;
}

/**
 * Backdrop-blurred modal. Click-outside or Esc closes.
 * The body is the caller's responsibility — pass form / buttons as children.
 */
export function Dialog({ open, onClose, title, children, width = 'w-[26rem]' }: Props) {
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
    <div
      className="fixed inset-0 bg-black/60 grid place-items-center z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`panel p-5 ${width} flex flex-col gap-3`}
      >
        {title && <h3 className="font-semibold tracking-tight">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
