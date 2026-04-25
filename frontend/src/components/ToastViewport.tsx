import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast, useToastStore } from '../lib/toast';

function icon(kind: 'success' | 'error' | 'info') {
  if (kind === 'success') return '✓';
  if (kind === 'error') return '!';
  return 'i';
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        dismiss(t.id);
      }, t.timeoutMs),
    );
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [toasts, dismiss]);

  if (typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div className="app-toast-viewport" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`app-toast app-toast--${t.kind}`}
          role={t.kind === 'error' ? 'alert' : 'status'}
          aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
        >
          <div className="app-toast__icon" aria-hidden>
            {icon(t.kind)}
          </div>
          <div className="app-toast__body">
            <div className="app-toast__title">{t.title}</div>
            {t.message ? <div className="app-toast__msg">{t.message}</div> : null}
          </div>
          <button
            type="button"
            className="app-toast__dismiss"
            onClick={() => toast.dismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

