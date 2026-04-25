import { createPortal } from 'react-dom';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  details?: string[];
  children?: ReactNode;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  details,
  children,
  danger,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDisabled,
  onConfirm,
  onClose,
}: Props) {
  const gen = useId();
  const titleId = `confirm-title-${gen}`;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cardRef.current?.querySelector<HTMLButtonElement>('button[data-primary]')?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="sms-modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={onClose}>
      <div
        className="sms-modal-card"
        ref={cardRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sms-modal-head">
          <div id={titleId} className="sms-modal-title">
            {title}
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {description ? <div className="sms-modal-desc">{description}</div> : null}

        {details && details.length ? (
          <ul className="sms-modal-details">
            {details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}

        {children ? <div className="stack" style={{ gap: 10 }}>{children}</div> : null}

        <div className="sms-modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn danger' : 'btn'}
            data-primary
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

