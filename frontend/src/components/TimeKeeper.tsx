import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { themeUi } from '../theme/uiClasses';
import {
  formatTimeDisplay,
  from12Hour,
  minuteOptions,
  parseHHMM,
  to12Hour,
  toHHMM,
} from '../lib/timeKeeperUtils';

/** 1 → 12 (ascending); 12h clock values still map via from12Hour */
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export type TimeKeeperProps = {
  value: string;
  onChange: (hhmm: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  /** Minute increment (e.g. 5 for 00,05,…,55). Default 5. */
  minuteStep?: number;
};

/**
 * Themed time field with an orange popover (no native blue time picker).
 * Value / onChange use 24h `HH:mm`.
 */
export function TimeKeeper({
  value,
  onChange,
  id: idProp,
  disabled,
  className,
  minuteStep = 5,
}: TimeKeeperProps) {
  const gen = useId();
  const id = idProp ?? gen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const parsed = parseHHMM(value) ?? { h: 9, m: 0 };
  const { h12, isAM } = to12Hour(parsed.h);
  const minuteChoices = useMemo(() => {
    const base = minuteOptions(minuteStep);
    if (base.includes(parsed.m)) return base;
    return [...base, parsed.m].sort((a, b) => a - b);
  }, [minuteStep, parsed.m]);

  const updatePopoverPosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const margin = 10;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pop = popoverRef.current;

    // Estimate popover height for flip logic
    const estPopH = pop ? pop.getBoundingClientRect().height : 300;
    const spaceBelow = vh - r.bottom - gap - margin;
    const spaceAbove = r.top - gap - margin;
    const openUp = spaceBelow < estPopH && spaceAbove > spaceBelow;

    const top = openUp
      ? Math.max(margin, r.top - gap - estPopH)
      : r.bottom + gap;

    let left: number;
    if (pop) {
      const pw = pop.getBoundingClientRect().width;
      left = r.left + r.width / 2 - pw / 2;
      left = Math.max(margin, Math.min(left, vw - margin - pw));
    } else {
      left = r.left + r.width / 2;
    }

    // Max height to avoid overflow
    const maxH = openUp
      ? Math.min(spaceAbove, 360)
      : Math.min(spaceBelow, 360);

    setPopoverStyle({
      position: 'fixed',
      left,
      top,
      zIndex: 10060,
      maxHeight: maxH > 80 ? maxH : undefined,
      transform: pop ? undefined : 'translateX(-50%)',
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    function onReposition() {
      updatePopoverPosition();
    }
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePopoverPosition, minuteChoices.length, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
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

  function apply(h12Next: number, isAMNext: boolean, minNext: number) {
    onChange(from12Hour(h12Next, isAMNext, minNext));
  }

  const root = [themeUi.timeKeeper, className].filter(Boolean).join(' ');
  const label = formatTimeDisplay(value);

  const popover = open ? (
    <div
      ref={popoverRef}
      className="time-keeper__popover"
      style={popoverStyle}
      role="dialog"
      aria-labelledby={id}
    >
      <div className="time-keeper__columns">
        <div className="time-keeper__col" role="list">
          <div className="time-keeper__col-label time-keeper__col-label--hour">Hour</div>
          {HOURS_12.map((h) => (
            <button
              key={h}
              type="button"
              role="option"
              className={h === h12 ? 'time-keeper__opt time-keeper__opt--active' : 'time-keeper__opt'}
              onClick={() => apply(h, isAM, parsed.m)}
            >
              {h}
            </button>
          ))}
        </div>
        <div className="time-keeper__col" role="list">
          <div className="time-keeper__col-label">Min</div>
          {minuteChoices.map((mm) => (
            <button
              key={mm}
              type="button"
              role="option"
              className={mm === parsed.m ? 'time-keeper__opt time-keeper__opt--active' : 'time-keeper__opt'}
              onClick={() => apply(h12, isAM, mm)}
            >
              {String(mm).padStart(2, '0')}
            </button>
          ))}
        </div>
        <div className="time-keeper__col time-keeper__col--narrow" role="list">
          <div className="time-keeper__col-label"> </div>
          <button
            type="button"
            className={isAM ? 'time-keeper__opt time-keeper__opt--active' : 'time-keeper__opt'}
            onClick={() => apply(h12, true, parsed.m)}
          >
            AM
          </button>
          <button
            type="button"
            className={!isAM ? 'time-keeper__opt time-keeper__opt--active' : 'time-keeper__opt'}
            onClick={() => apply(h12, false, parsed.m)}
          >
            PM
          </button>
        </div>
      </div>
      <div className="time-keeper__footer">
        <span className="time-keeper__hint">24h: {toHHMM(parsed.h, parsed.m)}</span>
        <button type="button" className="time-keeper__done" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={root}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="time-keeper__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
        }}
      >
        <span className="time-keeper__trigger-label">{label}</span>
        <span className="time-keeper__clock" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

export {
  parseHHMM,
  toHHMM,
  formatTimeDisplay,
  from12Hour,
  to12Hour,
  minuteOptions,
} from '../lib/timeKeeperUtils';
