import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

type SubjectRow = { id: number; code: string; name: string };
type SubjectPage = { content: SubjectRow[]; totalElements: number };

export type SubjectSearchComboboxProps = {
  id?: string;
  value: string;
  onChange: (subjectName: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Searchable subject picker; options load from {@code GET /api/subjects}.
 * The parent stores the subject <strong>name</strong> (what the lecture API expects).
 */
export function SubjectSearchCombobox({
  id: idProp,
  value,
  onChange,
  disabled,
  placeholder = 'Search subjects…',
}: SubjectSearchComboboxProps) {
  const gen = useId();
  const baseId = idProp ?? gen;
  const listId = `${baseId}-listbox`;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const subjects = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () =>
      (await api.get<SubjectPage>('/api/subjects?size=500&sort=name,asc')).data,
    staleTime: 60_000,
  });

  const list = subjects.data?.content ?? [];

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [list, inputValue]);

  function commitOrRevert() {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      onChange('');
      setInputValue('');
      setOpen(false);
      return;
    }
    const exact = list.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      onChange(exact.name);
      setInputValue(exact.name);
    } else {
      setInputValue(value);
    }
    setOpen(false);
  }

  function pick(row: SubjectRow) {
    onChange(row.name);
    setInputValue(row.name);
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
              setInputValue(value);
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
              {subjects.isLoading ? (
                <li className="catalog-combobox__hint" role="status">
                  Loading subjects…
                </li>
              ) : subjects.isError ? (
                <li className="catalog-combobox__hint catalog-combobox__hint--error" role="status">
                  Could not load subjects.
                </li>
              ) : filtered.length === 0 ? (
                <li className="catalog-combobox__hint" role="status">
                  {list.length === 0
                    ? 'No subjects in your catalog yet. Add subjects under school settings or ask an admin.'
                    : 'No matching subjects. Try another search.'}
                </li>
              ) : (
                filtered.map((row) => (
                  <li key={row.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === row.name}
                      className={
                        value === row.name
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
