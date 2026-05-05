import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { themeUi } from '../theme/uiClasses';

export type SelectKeeperOption = { value: string; label: string };

export type SelectKeeperProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectKeeperOption[];
  /** When set, adds an option with value "" shown first (e.g. "Select…"). */
  emptyValueLabel?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Filter options by label while open; selected value stays listed and pinned to top (below placeholder). */
  searchable?: boolean;
};

function pinSelectedFirst(options: SelectKeeperOption[], selectedValue: string): SelectKeeperOption[] {
  if (!selectedValue) return options;
  const ix = options.findIndex((o) => o.value === selectedValue);
  if (ix <= 0) return options;
  const sel = options[ix]!;
  return [sel, ...options.filter((_, i) => i !== ix)];
}

/** Dropdown with orange hover states (use instead of a native select when theme control matters). */
export function SelectKeeper({
  value,
  onChange,
  options,
  emptyValueLabel,
  id: idProp,
  disabled,
  className,
  searchable = false,
}: SelectKeeperProps) {
  const gen = useId();
  const id = idProp ?? gen;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement | HTMLUListElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const rows = useMemo(() => {
    const base: SelectKeeperOption[] = emptyValueLabel
      ? [{ value: '', label: emptyValueLabel }, ...options]
      : options.slice();

    if (!searchable) return base;

    const hasEmpty = Boolean(emptyValueLabel);
    const emptyRow = hasEmpty ? base[0] : null;
    const restOpts = hasEmpty ? base.slice(1) : base;

    const q = searchQuery.trim().toLowerCase();
    let filtered =
      q.length > 0 ? restOpts.filter((o) => o.label.toLowerCase().includes(q)) : restOpts.slice();

    if (q.length > 0 && value) {
      const selected = restOpts.find((o) => o.value === value);
      if (selected && !filtered.some((o) => o.value === value)) {
        filtered = [selected, ...filtered];
      }
    }

    const pinned = pinSelectedFirst(filtered, value);

    return emptyRow ? [emptyRow, ...pinned] : pinned;
  }, [emptyValueLabel, options, searchable, searchQuery, value]);

  const current = rows.find((r) => r.value === value);
  const buttonLabel = current?.label ?? (emptyValueLabel ?? 'Select…');

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
      const maxList = 320;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const spaceBelow = vh - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(maxList, Math.max(120, openUp ? spaceAbove : spaceBelow));
      const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - rect.width - 8));
      setMenuStyle({
        position: 'fixed',
        left,
        top: openUp ? Math.max(8, rect.top - gap - maxHeight) : rect.bottom + gap,
        width: rect.width,
        maxHeight,
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
    if (!open) setSearchQuery('');
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return;
    const idr = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(idr);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
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

  const rootClass = [themeUi.selectKeeper, className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="select-keeper__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="select-keeper__value">{buttonLabel}</span>
        <span className="select-keeper__chev" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && menuStyle && typeof document !== 'undefined'
        ? createPortal(
            searchable ? (
              <div
                ref={panelRef}
                className="select-keeper__panel select-keeper__menu--portal"
                style={{
                  ...menuStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                <input
                  ref={searchRef}
                  type="search"
                  className="select-keeper__search"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Filter options"
                />
                <ul
                  className="select-keeper__menu select-keeper__menu--in-panel"
                  role="listbox"
                  aria-labelledby={id}
                >
                  {rows.map((opt, idx) => (
                    <li key={`${id}-opt-${idx}-${opt.value}-${opt.label.slice(0, 24)}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={opt.value === value}
                        className={
                          opt.value === value
                            ? 'select-keeper__option select-keeper__option--selected'
                            : 'select-keeper__option'
                        }
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul
                ref={panelRef}
                className="select-keeper__menu select-keeper__menu--portal"
                style={menuStyle}
                role="listbox"
                aria-labelledby={id}
              >
                {rows.map((opt, idx) => (
                  <li key={`${id}-opt-${idx}-${opt.value}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={opt.value === value}
                      className={
                        opt.value === value
                          ? 'select-keeper__option select-keeper__option--selected'
                          : 'select-keeper__option'
                      }
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            ),
            document.body,
          )
        : null}
    </div>
  );
}
