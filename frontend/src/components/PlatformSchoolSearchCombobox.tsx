import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

export type PlatformSchoolCatalogRow = { schoolId: number; name: string; code: string };
type Row = PlatformSchoolCatalogRow;

/**
 * Platform operator: searchable tenant picker.
 * Uses existing platform schools API (SUPER_ADMIN only).
 */
export function usePlatformSchoolsCatalog() {
  return useQuery({
    queryKey: ['platform-schools'],
    queryFn: async () =>
      (await api.get<any[]>('/api/v1/platform/schools')).data.map((s) => ({
        schoolId: s.schoolId,
        name: s.name,
        code: s.code,
      })) as Row[],
    staleTime: 60_000,
  });
}

export type PlatformSchoolSearchComboboxProps = {
  id?: string;
  /** Selected school id as string, or "" for none. */
  value: string;
  onChange: (schoolId: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function PlatformSchoolSearchCombobox({
  id: idProp,
  value,
  onChange,
  disabled,
  placeholder = 'Search schools…',
}: PlatformSchoolSearchComboboxProps) {
  const gen = useId();
  const baseId = idProp ?? gen;
  const listId = `${baseId}-listbox`;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const catalog = usePlatformSchoolsCatalog();
  const list = catalog.data ?? [];

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const row = list.find((s) => String(s.schoolId) === value);
    return row ? `${row.name} (ID ${row.schoolId})` : '';
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
    const q = inputValue.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        String(s.schoolId).includes(q)
      );
    });
  }, [list, inputValue]);

  function commitOrRevert() {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      onChange('');
      setInputValue('');
      setOpen(false);
      return;
    }
    const exactId = list.find((s) => String(s.schoolId) === trimmed);
    const exactName = list.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    const exactCode = list.find((s) => s.code.toLowerCase() === trimmed.toLowerCase());
    const exact = exactId ?? exactName ?? exactCode;
    if (exact) {
      onChange(String(exact.schoolId));
      setInputValue(`${exact.name} (ID ${exact.schoolId})`);
    } else {
      setInputValue(selectedLabel);
    }
    setOpen(false);
  }

  function pick(row: Row) {
    onChange(String(row.schoolId));
    setInputValue(`${row.name} (ID ${row.schoolId})`);
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
          {catalog.isLoading ? (
            <li className="catalog-combobox__hint" role="status">
              Loading schools…
            </li>
          ) : catalog.isError ? (
            <li className="catalog-combobox__hint catalog-combobox__hint--error" role="status">
              Could not load schools.
            </li>
          ) : filtered.length === 0 ? (
            <li className="catalog-combobox__hint" role="status">
              No matching schools.
            </li>
          ) : (
            filtered.map((row) => (
              <li key={row.schoolId} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === String(row.schoolId)}
                  className={
                    value === String(row.schoolId)
                      ? 'select-keeper__option select-keeper__option--selected'
                      : 'select-keeper__option'
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    pick(row);
                  }}
                >
                  <span className="catalog-combobox__text">{row.name}</span>
                  <span className="catalog-combobox__meta">
                    ID {row.schoolId} · {row.code}
                  </span>
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

