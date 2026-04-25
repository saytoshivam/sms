import { useEffect, useId, useRef, useState } from 'react';
import { parseYmd, ymdFromDate } from '../lib/dateKeeperUtils';

export { parseYmd, ymdFromDate } from '../lib/dateKeeperUtils';

export type DateKeeperProps = {
  value: string;
  onChange: (ymd: string) => void;
  /** Optional min date YYYY-MM-DD */
  min?: string;
  /** Pairs with a visible label via the same id (htmlFor). */
  id?: string;
  /** Optional class on the root wrapper (e.g. for layout). */
  className?: string;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function monthMatrix(view: Date): (Date | null)[][] {
  const y = view.getFullYear();
  const m = view.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

/**
 * Themed date field with a month grid popover (shared across the app).
 * Value format: `YYYY-MM-DD`.
 */
export function DateKeeper({ value, onChange, min, id: idProp, className }: DateKeeperProps) {
  const gen = useId();
  const id = idProp ?? gen;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseYmd(value) ?? new Date();
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    const sel = parseYmd(value);
    if (sel) setView(new Date(sel.getFullYear(), sel.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
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

  const minD = min ? parseYmd(min) : null;
  const matrix = monthMatrix(view);
  const label = selected.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  function pick(d: Date) {
    onChange(ymdFromDate(d));
    setOpen(false);
  }

  function isDisabled(d: Date): boolean {
    if (!minD) return false;
    return d < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
  }

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const rootClass = ['date-keeper', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="date-keeper__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="date-keeper__trigger-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </span>
        <span className="date-keeper__trigger-label">{label}</span>
      </button>
      {open ? (
        <div className="date-keeper__popover" role="dialog" aria-labelledby={id}>
          <div className="date-keeper__head">
            <button
              type="button"
              className="date-keeper__nav"
              aria-label="Previous month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <div className="date-keeper__month">
              {view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              className="date-keeper__nav"
              aria-label="Next month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="date-keeper__weekdays">
            {WEEKDAYS.map((w) => (
              <div key={w} className="date-keeper__wd">
                {w}
              </div>
            ))}
          </div>
          <div className="date-keeper__grid">
            {matrix.map((row, ri) => (
              <div key={ri} className="date-keeper__row">
                {row.map((cell, ci) => {
                  if (!cell) {
                    return <div key={ci} className="date-keeper__cell date-keeper__cell--empty" />;
                  }
                  const disabled = isDisabled(cell);
                  const isSel = sameDay(cell, selected);
                  return (
                    <button
                      key={ci}
                      type="button"
                      disabled={disabled}
                      className={
                        isSel ? 'date-keeper__day date-keeper__day--selected' : 'date-keeper__day'
                      }
                      onClick={() => !disabled && pick(cell)}
                    >
                      {cell.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="date-keeper__footer">
            <button
              type="button"
              className="date-keeper__today"
              onClick={() => {
                const t = new Date();
                pick(t);
                setView(new Date(t.getFullYear(), t.getMonth(), 1));
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
