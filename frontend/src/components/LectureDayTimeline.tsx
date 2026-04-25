import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { themeUi } from '../theme/uiClasses';

export type TimelineBusyBlock = {
  id: number;
  startTime: string;
  endTime: string;
  subject: string;
  /** Teacher name from the lecture row; shown in tooltips. */
  teacherName?: string | null;
};

/** Minutes from midnight; default school day window for the bar. */
export const LECTURE_TIMELINE_DAY_START_MIN = 7 * 60;
export const LECTURE_TIMELINE_DAY_END_MIN = 21 * 60;

function parseTimeToMinutes(t: string): number {
  const p = t.trim().split(':');
  const h = Number(p[0]);
  const m = Number(p[1] ?? 0);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function clip(
  startMin: number,
  endMin: number,
  winStart: number,
  winEnd: number,
): { leftPct: number; widthPct: number } | null {
  const s = Math.max(startMin, winStart);
  const e = Math.min(endMin, winEnd);
  if (e <= s) return null;
  const total = winEnd - winStart;
  return {
    leftPct: ((s - winStart) / total) * 100,
    widthPct: ((e - s) / total) * 100,
  };
}

function intervalsOverlapMin(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Fixed tooltip position so it stays inside the viewport (avoids overflow clipping from the timeline strip). */
function tipPortalStyle(clientX: number, clientY: number): CSSProperties {
  const margin = 10;
  const estW = 220;
  const estH = 88;
  let left = clientX;
  let top = clientY - estH - 12;
  if (left + estW / 2 > window.innerWidth - margin) {
    left = window.innerWidth - margin - estW / 2;
  }
  if (left - estW / 2 < margin) {
    left = margin + estW / 2;
  }
  if (top < margin) {
    top = clientY + 18;
  }
  if (top + estH > window.innerHeight - margin) {
    top = window.innerHeight - margin - estH;
  }
  return {
    position: 'fixed',
    left,
    top,
    transform: 'translateX(-50%)',
    zIndex: 10050,
  };
}

export function draftOverlapsBusy(
  draftStart: string,
  draftEnd: string,
  busy: TimelineBusyBlock[],
): TimelineBusyBlock | undefined {
  const ds = parseTimeToMinutes(draftStart);
  const de = parseTimeToMinutes(draftEnd);
  if (!(ds < de)) return undefined;
  for (const b of busy) {
    const bs = parseTimeToMinutes(b.startTime);
    const be = parseTimeToMinutes(b.endTime);
    if (intervalsOverlapMin(ds, de, bs, be)) return b;
  }
  return undefined;
}

type Props = {
  busy: TimelineBusyBlock[];
  draftStart: string;
  draftEnd: string;
  dayStartMin?: number;
  dayEndMin?: number;
};

/** Horizontal day strip using `themeUi.timeline` / `.theme-timeline` styles. */
export function LectureDayTimeline({
  busy,
  draftStart,
  draftEnd,
  dayStartMin = LECTURE_TIMELINE_DAY_START_MIN,
  dayEndMin = LECTURE_TIMELINE_DAY_END_MIN,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    subject: string;
    teacher: string;
    time: string;
    clientX: number;
    clientY: number;
  } | null>(null);

  const win = dayEndMin - dayStartMin;
  const hourLabels = useMemo(() => {
    const out: { min: number; label: string }[] = [];
    for (let m = Math.ceil(dayStartMin / 60) * 60; m <= dayEndMin; m += 60) {
      const h = Math.floor(m / 60);
      out.push({ min: m, label: `${h}:00` });
    }
    return out;
  }, [dayStartMin, dayEndMin]);

  const busyLayouts = useMemo(() => {
    return busy
      .map((b) => {
        const s = parseTimeToMinutes(b.startTime);
        const e = parseTimeToMinutes(b.endTime);
        const g = clip(s, e, dayStartMin, dayEndMin);
        if (!g) return null;
        return { ...b, ...g };
      })
      .filter(Boolean) as (TimelineBusyBlock & { leftPct: number; widthPct: number })[];
  }, [busy, dayStartMin, dayEndMin]);

  const draftLayout = useMemo(() => {
    const s = parseTimeToMinutes(draftStart);
    const e = parseTimeToMinutes(draftEnd);
    if (!(s < e)) return null;
    return clip(s, e, dayStartMin, dayEndMin);
  }, [draftStart, draftEnd, dayStartMin, dayEndMin]);

  const draftOverlap = useMemo(
    () => (draftStart && draftEnd ? draftOverlapsBusy(draftStart, draftEnd, busy) : undefined),
    [draftStart, draftEnd, busy],
  );

  function showTip(
    e: React.MouseEvent,
    b: TimelineBusyBlock & { leftPct: number; widthPct: number },
  ) {
    const teacher = (b.teacherName ?? '').trim() || 'Not assigned';
    setTip({
      subject: b.subject,
      teacher,
      time: `${b.startTime.slice(0, 5)}–${b.endTime.slice(0, 5)}`,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }

  function moveTip(e: React.MouseEvent) {
    setTip((prev) =>
      prev
        ? {
            ...prev,
            clientX: e.clientX,
            clientY: e.clientY,
          }
        : null,
    );
  }

  function hideTip() {
    setTip(null);
  }

  useEffect(() => {
    if (!tip) return;
    function onScroll() {
      setTip(null);
    }
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [tip]);

  const t = themeUi.timeline;

  return (
    <div className={t}>
      <div className={`${t}__meta row`} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Free · Scheduled · Draft — hover a busy block for details
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {Math.floor(dayStartMin / 60)}:00 – {Math.floor(dayEndMin / 60)}:00
        </span>
      </div>
      <div className={`${t}__track-wrap`} ref={wrapRef}>
        {tip
          ? createPortal(
              <div
                className={`${t}__tip ${t}__tip--portal`}
                style={tipPortalStyle(tip.clientX, tip.clientY)}
                role="tooltip"
              >
                <div className={`${t}__tip-subject`}>{tip.subject}</div>
                <div className={`${t}__tip-teacher`}>
                  <span className={`${t}__tip-k`}>Teacher</span> {tip.teacher}
                </div>
                <div className={`${t}__tip-time`}>{tip.time}</div>
              </div>,
              document.body,
            )
          : null}
        <div className={`${t}__track`}>
          {busyLayouts.map((b) => (
            <div
              key={b.id}
              className={`${t}__busy`}
              style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
              onMouseEnter={(e) => showTip(e, b)}
              onMouseMove={moveTip}
              onMouseLeave={hideTip}
            />
          ))}
          {draftLayout ? (
            <div
              className={
                draftOverlap ? `${t}__draft ${t}__draft--bad` : `${t}__draft`
              }
              style={{ left: `${draftLayout.leftPct}%`, width: `${draftLayout.widthPct}%` }}
              title={draftOverlap ? 'Overlaps an existing lecture' : 'Your new slot'}
            />
          ) : null}
        </div>
      </div>
      <div className={`${t}__ticks`}>
        {hourLabels.map((x) => (
          <span
            key={x.min}
            className={`${t}__tick`}
            style={{ left: `${((x.min - dayStartMin) / win) * 100}%` }}
          >
            {x.label}
          </span>
        ))}
      </div>
    </div>
  );
}
