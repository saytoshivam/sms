import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  studentId: number;
};

export function StudentRowActions({ studentId }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="sw-row-actions" ref={rootRef}>
      <Link className="btn secondary sw-row-btn" to={`/app/students/${studentId}`}>
        View
      </Link>
      <Link className="btn secondary sw-row-btn" to={`/app/students/${studentId}?edit=1`}>
        Edit
      </Link>
      <div className="sw-more-wrap">
        <button
          type="button"
          className="btn secondary sw-row-btn"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
        >
          More
        </button>
        {open ? (
          <ul className="sw-more-menu" role="menu">
            <li role="none">
              <Link role="menuitem" className="sw-more-item" to={`/app/students/${studentId}/performance`} onClick={() => setOpen(false)}>
                Performance charts
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
