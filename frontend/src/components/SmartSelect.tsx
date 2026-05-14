import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent } from 'react';

/**
 * SmartSelect — a button-driven dropdown that matches our `select-keeper`
 * theme. Use it everywhere you'd otherwise write `<select>`.
 *
 * - For ≤8 options, it behaves like a native select (click to open, click to
 *   pick).
 * - For >8 options, it auto-enables a search input at the top of the menu.
 * - Supports an optional "clear" pseudo-row when `allowClear` is true.
 * - Renders the popover via a portal with viewport-aware positioning so it
 *   never gets clipped by overflow ancestors.
 *
 * The `value` is always a string. Numeric callers should convert at the
 * boundary (`String(id)` in / `Number(value)` out).
 */

export type SmartSelectOption = {
  value: string;
  label: string;
  /** Optional secondary text (e.g. role, code, meta). */
  meta?: string;
  /** When true, the option is rendered greyed-out and not clickable. */
  disabled?: boolean;
};

export type SmartSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SmartSelectOption[];
  /** Shown when the value is empty. Defaults to "Select…". */
  placeholder?: string;
  /** When true, shows a row that resets the value to ''. Defaults to false. */
  allowClear?: boolean;
  /** Label for the clear row when `allowClear` is true. */
  clearLabel?: string;
  /**
   * Force search on/off. When undefined, the input appears once options.length
   * is greater than the threshold (default 8).
   */
  searchable?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  /** Inline styles applied to the root element. */
  style?: CSSProperties;
  /** Inline styles applied to the trigger button. */
  triggerStyle?: CSSProperties;
};

const DEFAULT_SEARCH_THRESHOLD = 8;

export function SmartSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  allowClear = false,
  clearLabel = '— Clear —',
  searchable,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  searchPlaceholder = 'Search…',
  disabled,
  id: idProp,
  ariaLabel,
  style,
  triggerStyle,
}: SmartSelectProps) {
  const gen = useId();
  const baseId = idProp ?? gen;
  const listId = `${baseId}-listbox`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const showSearch = searchable ?? options.length > searchThreshold;

  const visibleOptions = useMemo(() => {
    if (!showSearch) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.meta ?? '').toLowerCase().includes(q),
    );
  }, [options, query, showSearch]);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  function close() {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }

  function pick(opt: SmartSelectOption | null) {
    if (opt && opt.disabled) return;
    onChange(opt ? opt.value : '');
    close();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  // ---- viewport-aware positioning ----
  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 4;
      const maxList = 320;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const spaceBelow = vh - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(maxList, Math.max(140, openUp ? spaceAbove : spaceBelow));
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
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && showSearch) {
      // Focus the search box once the popover is mounted.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, showSearch]);

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    }
  }

  function onMenuKey(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => {
        const start = i < 0 ? -1 : i;
        for (let step = 1; step <= visibleOptions.length; step += 1) {
          const next = (start + step) % visibleOptions.length;
          if (!visibleOptions[next]?.disabled) return next;
        }
        return start;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => {
        const start = i < 0 ? visibleOptions.length : i;
        for (let step = 1; step <= visibleOptions.length; step += 1) {
          const next = (start - step + visibleOptions.length) % visibleOptions.length;
          if (!visibleOptions[next]?.disabled) return next;
        }
        return start;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = visibleOptions[activeIndex];
      if (opt) pick(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(visibleOptions.findIndex((o) => !o.disabled));
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = [...visibleOptions].reverse().findIndex((o) => !o.disabled);
      if (last >= 0) setActiveIndex(visibleOptions.length - 1 - last);
    }
  }

  return (
    <div className="select-keeper catalog-combobox" style={style}>
      <div className="catalog-combobox__field">
        <button
          ref={triggerRef}
          id={baseId}
          type="button"
          className="catalog-combobox__input"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
          }}
          onKeyDown={onTriggerKey}
          style={{
            textAlign: 'left',
            color: selected ? undefined : '#94a3b8',
            fontWeight: selected ? 700 : 500,
            ...triggerStyle,
          }}
        >
          <span className="catalog-combobox__text">
            {selected ? selected.label : placeholder}
          </span>
          {selected?.meta ? (
            <span className="catalog-combobox__meta">{selected.meta}</span>
          ) : null}
        </button>
        <span className="select-keeper__chev" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      {open && !disabled && menuStyle && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="select-keeper__menu select-keeper__menu--portal"
              style={{
                ...menuStyle,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
              }}
              onKeyDown={onMenuKey}
            >
              {showSearch ? (
                <div style={{ padding: 8, borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                  <input
                    ref={searchRef}
                    type="text"
                    className="catalog-combobox__input"
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onMenuKey}
                    style={{ height: 30, padding: '4px 8px' }}
                  />
                </div>
              ) : null}
              <ul
                id={listId}
                className="select-keeper__menu-list"
                role="listbox"
                aria-labelledby={baseId}
                style={{
                  margin: 0,
                  padding: 4,
                  listStyle: 'none',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {allowClear ? (
                  <li role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === ''}
                      className={
                        value === ''
                          ? 'select-keeper__option select-keeper__option--selected'
                          : 'select-keeper__option'
                      }
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(null)}
                    >
                      <span className="catalog-combobox__text" style={{ fontStyle: 'italic', color: '#64748b' }}>
                        {clearLabel}
                      </span>
                    </button>
                  </li>
                ) : null}
                {visibleOptions.length === 0 ? (
                  <li role="presentation" className="muted" style={{ padding: '8px 10px', fontSize: 12 }}>
                    No matches
                  </li>
                ) : null}
                {visibleOptions.map((row, idx) => {
                  const isSelected = row.value === value;
                  const isActive = idx === activeIndex;
                  return (
                    <li key={row.value} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={row.disabled}
                        disabled={row.disabled}
                        className={
                          isSelected
                            ? 'select-keeper__option select-keeper__option--selected'
                            : 'select-keeper__option'
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => pick(row)}
                        style={{
                          background: isActive && !isSelected ? 'rgba(234,88,12,0.08)' : undefined,
                          opacity: row.disabled ? 0.5 : 1,
                          cursor: row.disabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span className="catalog-combobox__text">{row.label}</span>
                        {row.meta ? <span className="catalog-combobox__meta">{row.meta}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
