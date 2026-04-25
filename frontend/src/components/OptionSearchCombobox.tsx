import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

export type OptionRow = { value: string; label: string; meta?: string | null };

export type OptionSearchComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: OptionRow[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
};

export function OptionSearchCombobox({
  id: idProp,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  emptyLabel = 'Select…',
  disabled,
}: OptionSearchComboboxProps) {
  const gen = useId();
  const baseId = idProp ?? gen;
  const listId = `${baseId}-listbox`;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const selectedLabel = useMemo(() => options.find((o) => o.value === value)?.label ?? '', [options, value]);

  useEffect(() => {
    setInputValue(selectedLabel);
  }, [selectedLabel]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || String(o.meta ?? '').toLowerCase().includes(q));
  }, [options, inputValue]);

  function pick(row: OptionRow) {
    onChange(row.value);
    setInputValue(row.label);
    setOpen(false);
  }

  function commitOrRevert() {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      onChange('');
      setInputValue('');
      setOpen(false);
      return;
    }
    const exact = options.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
    if (exact) pick(exact);
    else setInputValue(selectedLabel);
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
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
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
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
    <div className="select-keeper catalog-combobox">
      <div className="catalog-combobox__field">
        <input
          ref={triggerRef}
          id={baseId}
          type="text"
          className="catalog-combobox__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => commitOrRevert(), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setInputValue(selectedLabel);
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = filtered[0];
              if (open && first) pick(first);
              else commitOrRevert();
            }
          }}
        />
        <span className="select-keeper__chev" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
      {open && !disabled && menuStyle && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              className="select-keeper__menu select-keeper__menu--portal"
              style={menuStyle}
              role="listbox"
              aria-labelledby={baseId}
            >
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ''}
                  className={value === '' ? 'select-keeper__option select-keeper__option--selected' : 'select-keeper__option'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange('');
                    setInputValue('');
                    setOpen(false);
                  }}
                >
                  {emptyLabel}
                </button>
              </li>
              {filtered.map((row) => (
                <li key={row.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === row.value}
                    className={value === row.value ? 'select-keeper__option select-keeper__option--selected' : 'select-keeper__option'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (blurTimer.current) clearTimeout(blurTimer.current);
                      pick(row);
                    }}
                  >
                    <span className="catalog-combobox__text">{row.label}</span>
                    {row.meta ? <span className="catalog-combobox__meta">{row.meta}</span> : null}
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

