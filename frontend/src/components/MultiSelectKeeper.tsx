import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { themeUi } from '../theme/uiClasses';

export type MultiSelectKeeperOption = { value: string; label: string };

export type MultiSelectKeeperProps = {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiSelectKeeperOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

export function MultiSelectKeeper({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  id: idProp,
  disabled,
  className,
}: MultiSelectKeeperProps) {
  const gen = useId();
  const id = idProp ?? gen;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(value.map((v) => String(v))), [value]);
  const selectedLabels = useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]));
    return value.map((v) => m.get(v) ?? v);
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const btn = triggerRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const gap = 6;
      const maxList = 420;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const spaceBelow = vh - rect.bottom - gap - 8;
      const maxHeight = Math.min(maxList, Math.max(180, spaceBelow));
      const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - rect.width - 8));
      setMenuStyle({
        position: 'fixed',
        left,
        top: rect.bottom + gap,
        width: rect.width,
        maxHeight,
        zIndex: 10000,
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

  const rootClass = [themeUi.selectKeeper, 'multi-select-keeper', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="select-keeper__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="select-keeper__value" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {selectedLabels.length ? (
            selectedLabels.map((l) => (
              <span
                key={l}
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(15,23,42,0.06)',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {l}
              </span>
            ))
          ) : (
            <span className="muted">{placeholder}</span>
          )}
        </span>
        <span className="select-keeper__chev" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && menuStyle && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="select-keeper__menu select-keeper__menu--portal"
              style={{ ...menuStyle, padding: 10, overflow: 'auto' }}
              role="dialog"
              aria-labelledby={id}
            >
              <div className="stack" style={{ gap: 8 }}>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roles…" />
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => onChange(options.map((o) => o.value))}
                  >
                    Select all
                  </button>
                  <button type="button" className="btn secondary" onClick={() => onChange([])}>
                    Clear
                  </button>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  {filtered.map((o) => {
                    const checked = selectedSet.has(o.value);
                    return (
                      <label
                        key={o.value}
                        className="row"
                        style={{
                          gap: 10,
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid rgba(15,23,42,0.10)',
                          background: checked ? 'rgba(249,115,22,0.10)' : 'rgba(255,255,255,0.85)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const on = e.target.checked;
                            const next = new Set(value);
                            if (on) next.add(o.value);
                            else next.delete(o.value);
                            onChange(Array.from(next));
                          }}
                        />
                        <span style={{ fontWeight: 900 }}>{o.label}</span>
                        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800 }}>
                          {o.value}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="button" className="btn" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

