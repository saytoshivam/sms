import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

export type ClassGroupRow = { id: number; code: string; displayName: string };
type ClassGroupPage = { content: ClassGroupRow[]; totalElements: number };

export function useClassGroupsCatalog() {
  return useQuery({
    queryKey: ['class-groups-catalog'],
    queryFn: async () =>
      (await api.get<ClassGroupPage>('/api/class-groups?size=500&sort=displayName,asc')).data,
    staleTime: 60_000,
  });
}

export type ClassGroupSearchComboboxProps = {
  id?: string;
  /** Selected class group id as string, or "" for none. */
  value: string;
  onChange: (classGroupId: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Searchable class picker; options load from {@code GET /api/class-groups}.
 */
export function ClassGroupSearchCombobox({
  id: idProp,
  value,
  onChange,
  disabled,
  placeholder = 'Search classes…',
}: ClassGroupSearchComboboxProps) {
  const gen = useId();
  const baseId = idProp ?? gen;
  const listId = `${baseId}-listbox`;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [userTypedSinceOpen, setUserTypedSinceOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const catalog = useClassGroupsCatalog();
  const list = catalog.data?.content ?? [];

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const row = list.find((cg) => String(cg.id) === value);
    return row ? row.displayName : '';
  }, [value, list]);

  useEffect(() => {
    setInputValue(selectedLabel);
  }, [selectedLabel]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

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
      const maxHeight = Math.min(maxList, Math.max(120, spaceBelow));
      const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - rect.width - 8));
      setMenuStyle({
        position: 'fixed',
        left,
        top: rect.bottom + gap,
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

  const filtered = useMemo(() => {
    if (open && !userTypedSinceOpen) return list;
    const q = inputValue.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (cg) =>
        cg.displayName.toLowerCase().includes(q) || cg.code.toLowerCase().includes(q),
    );
  }, [list, inputValue, open, userTypedSinceOpen]);

  function commitOrRevert() {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      onChange('');
      setInputValue('');
      setOpen(false);
      return;
    }
    const byName = list.find((cg) => cg.displayName.toLowerCase() === trimmed.toLowerCase());
    const byCode = list.find((cg) => cg.code.toLowerCase() === trimmed.toLowerCase());
    const exact = byName ?? byCode;
    if (exact) {
      onChange(String(exact.id));
      setInputValue(exact.displayName);
    } else {
      setInputValue(selectedLabel);
    }
    setOpen(false);
  }

  function pick(row: ClassGroupRow) {
    onChange(String(row.id));
    setInputValue(row.displayName);
    setOpen(false);
  }

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
            setUserTypedSinceOpen(true);
            setOpen(true);
          }}
          onFocus={() => {
            setUserTypedSinceOpen(false);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => commitOrRevert(), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setInputValue(selectedLabel);
              setUserTypedSinceOpen(false);
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
              {catalog.isLoading ? (
                <li className="catalog-combobox__hint" role="status">
                  Loading classes…
                </li>
              ) : catalog.isError ? (
                <li className="catalog-combobox__hint catalog-combobox__hint--error" role="status">
                  Could not load classes.
                </li>
              ) : filtered.length === 0 ? (
                <li className="catalog-combobox__hint" role="status">
                  {list.length === 0
                    ? 'No sections yet. Add them from Operations Hub → Classes & sections.'
                    : 'No matching classes. Try another search.'}
                </li>
              ) : (
                filtered.map((row) => (
                  <li key={row.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === String(row.id)}
                      className={
                        value === String(row.id)
                          ? 'select-keeper__option select-keeper__option--selected'
                          : 'select-keeper__option'
                      }
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                        pick(row);
                      }}
                    >
                      <span className="catalog-combobox__text">{row.displayName}</span>
                      <span className="catalog-combobox__meta">{row.code}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
