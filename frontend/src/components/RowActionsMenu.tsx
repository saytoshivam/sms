import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type RowAction = {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
  onSelect: () => void | Promise<void>;
};

type Props = {
  actions: RowAction[];
  ariaLabel?: string;
};

export function RowActionsMenu({ actions, ariaLabel = 'Row actions' }: Props) {
  const gen = useId();
  const id = `row-actions-${gen}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    const update = () => {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const width = 200;
      const gap = 6;
      const vh = window.innerHeight;
      const spaceBelow = vh - r.bottom - gap - 8;
      const openUp = spaceBelow < 160;
      setStyle({
        position: 'fixed',
        top: openUp ? Math.max(8, r.top - gap - 8) : r.bottom + gap,
        left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8),
        width,
        zIndex: 40000,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
      <button
        ref={triggerRef}
        type="button"
        className="btn secondary"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ padding: '6px 10px', minWidth: 0 }}
      >
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
          ⋮
        </span>
      </button>

      {open && style && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={menuRef}
              role="menu"
              aria-labelledby={id}
              style={{
                ...style,
                listStyle: 'none',
                margin: 0,
                padding: 6,
                borderRadius: 12,
                border: '1px solid rgba(15,23,42,0.14)',
                background: '#fff',
                boxShadow: '0 18px 40px rgba(15,23,42,0.18)',
              }}
            >
              {actions.map((a) => (
                <li key={a.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={a.disabled}
                    title={a.disabled && a.disabledReason ? a.disabledReason : undefined}
                    onClick={async () => {
                      if (a.disabled) return;
                      setOpen(false);
                      await a.onSelect();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 10px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'transparent',
                      cursor: a.disabled ? 'not-allowed' : 'pointer',
                      fontWeight: 800,
                      color: a.danger ? '#b91c1c' : '#0f172a',
                      opacity: a.disabled ? 0.55 : 1,
                    }}
                  >
                    {a.label}
                    {a.disabled && a.disabledReason ? (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 4 }}>{a.disabledReason}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

