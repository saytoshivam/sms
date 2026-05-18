/**
 * TeacherWeeklyTimetableEmbed
 *
 * Self-contained timetable embed used inside:
 *   - Staff Profile → Timetable tab  (admin viewing a specific teacher)
 *   - Future: Teacher dashboard "My Timetable" block
 *
 * Features:
 *   - Fetches published weekly grid for a specific staffId
 *   - KPI summary cards (lectures/wk, free periods, classes, subjects)
 *   - Desktop: scrollable period × day grid  (reuses TeacherPublishedWeekGrid)
 *   - Mobile  : collapsible day-by-day cards
 *   - All empty / blocker states handled inline
 *   - Read-only — no editing actions
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  TeacherPublishedWeekGrid,
  type PublishedTeacherWeekly,
} from '../../pages/TeacherTimetablePage';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DAY_FULL: Record<string, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
};

// ─── KPI summary card ─────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, color, bg,
}: {
  icon: string; label: string; value: string | number;
  color: string; bg: string;
}) {
  return (
    <div style={{
      flex: '1 1 110px', padding: '12px 16px', borderRadius: 10, background: bg,
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ─── Mobile: collapsible day card ────────────────────────────────────────────

function DayCard({
  day,
  periods,
  cellsByDay,
}: {
  day: string;
  periods: PublishedTeacherWeekly['periods'];
  cellsByDay: Map<string, PublishedTeacherWeekly['cells'][0]>;
}) {
  // Count non-break, non-free cells for this day
  const teachingCount = periods.filter((p) => {
    const c = cellsByDay.get(`${day}|${p.timeSlotId}`);
    return c && !c.breakSlot && !c.free;
  }).length;

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid rgba(15,23,42,0.09)', overflow: 'hidden',
    }}>
      {/* Day header */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(37,99,235,0.05)',
        borderBottom: '1px solid rgba(15,23,42,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: '#1e3a8a' }}>
          {DAY_FULL[day] ?? day}
        </span>
        {teachingCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(37,99,235,0.1)', color: '#1e40af',
          }}>
            {teachingCount} lecture{teachingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Period rows */}
      {periods.map((p) => {
        const cell = cellsByDay.get(`${day}|${p.timeSlotId}`);
        const isBreak = p.breakSlot || cell?.breakSlot;
        const isFree = !isBreak && (!cell || cell.free);

        return (
          <div
            key={p.timeSlotId}
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '9px 14px',
              borderBottom: '1px solid rgba(15,23,42,0.04)',
              background: isBreak
                ? 'rgba(234,179,8,0.04)'
                : isFree
                  ? 'rgba(15,23,42,0.013)'
                  : '#fff',
            }}
          >
            {/* Period + time */}
            <div style={{ minWidth: 68, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.42)' }}>
                P{p.slotOrder}
              </div>
              <div style={{
                fontSize: 11, color: 'rgba(15,23,42,0.45)',
                fontWeight: 600, fontFamily: 'monospace',
              }}>
                {String(p.startTime).slice(0, 5)}–{String(p.endTime).slice(0, 5)}
              </div>
            </div>

            {/* Content */}
            {isBreak ? (
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, paddingTop: 2 }}>
                ☕ Break
              </div>
            ) : isFree ? (
              <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.32)', fontStyle: 'italic', paddingTop: 2 }}>
                Free
              </div>
            ) : (
              <div style={{ paddingTop: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'rgba(15,23,42,0.88)', lineHeight: 1.3 }}>
                  {cell!.subject}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.55)', fontWeight: 600 }}>
                  {cell!.classGroupDisplayName}
                </div>
                {cell!.room?.trim() && (
                  <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', marginTop: 1 }}>
                    {cell!.room}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Mobile day-cards view ───────────────────────────────────────────────────

function MobileDayCardsView({ data }: { data: PublishedTeacherWeekly }) {
  const days = data.dayOrder.length
    ? data.dayOrder
    : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

  // Build flat cell lookup: "DAY|timeSlotId" → cell
  const cellMap = useMemo(() => {
    const m = new Map<string, PublishedTeacherWeekly['cells'][0]>();
    for (const c of data.cells) m.set(`${c.dayOfWeek}|${c.timeSlotId}`, c);
    return m;
  }, [data.cells]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {days.map((day) => (
        <DayCard
          key={day}
          day={day}
          periods={data.periods}
          cellsByDay={cellMap}
        />
      ))}
    </div>
  );
}

// ─── Main embed component ─────────────────────────────────────────────────────

export interface TeacherWeeklyTimetableEmbedProps {
  staffId: number;
  timetableEligible: boolean;
  eligibilityReasons?: string[];
  /** Used in the "Open full timetable" button. Defaults to '/app/timetable/grid'. */
  fullTimetablePath?: string;
}

export function TeacherWeeklyTimetableEmbed({
  staffId,
  timetableEligible,
  eligibilityReasons,
  fullTimetablePath = '/app/timetable/grid',
}: TeacherWeeklyTimetableEmbedProps) {
  const navigate = useNavigate();

  // Responsive: use day cards on narrow screens
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Always fetch — even for non-eligible staff so we can show whatever
  // published assignments already exist (user requirement: show separately).
  const weeklyQ = useQuery({
    queryKey: ['staff-weekly-timetable', staffId],
    queryFn: async () =>
      (await api.get<PublishedTeacherWeekly>(`/api/staff/${staffId}/timetable/weekly`)).data,
    retry: 1,
    staleTime: 60_000,
  });

  const weekly = weeklyQ.data;

  // Whether any published timetable exists at all (may have no entries for *this* teacher)
  const hasPublished = weekly != null && (weekly.versionNumber != null || weekly.periods.length > 0);

  // Whether this teacher actually has any non-free, non-break cells
  const hasAssignedCells = weekly != null && weekly.cells.some((c) => !c.breakSlot && !c.free);

  // Derive stats from the cells
  const stats = useMemo(() => {
    if (!weekly || !hasPublished) return null;
    const teaching = weekly.cells.filter((c) => !c.breakSlot && !c.free);
    return {
      weeklyPeriods: weekly.weeklyTeachingPeriods,
      freePeriods: weekly.freePeriodsTotal,
      classCount: new Set(teaching.map((c) => c.classGroupDisplayName)).size,
      subjectCount: new Set(teaching.map((c) => c.subject)).size,
    };
  }, [weekly, hasPublished]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* ── (1) Not-eligible warning ─────────────────────────────────────────── */}
      {!timetableEligible && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(220,38,38,0.05)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 12,
        }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#b91c1c', marginBottom: (eligibilityReasons ?? []).length > 0 ? 8 : 0 }}>
            ⚠ This staff member is not timetable eligible
          </div>
          {(eligibilityReasons ?? []).length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(eligibilityReasons ?? []).map((r, i) => (
                <li key={i} style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, marginBottom: 4 }}>
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)' }}>
              Requires: ACTIVE status + TEACHER role + at least one teachable subject + max weekly load set.
            </div>
          )}
        </div>
      )}

      {/* ── (2) Loading ──────────────────────────────────────────────────────── */}
      {weeklyQ.isLoading && (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          color: 'rgba(15,23,42,0.4)', fontSize: 14,
          background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)',
        }}>
          Loading timetable…
        </div>
      )}

      {/* ── (3) Error ────────────────────────────────────────────────────────── */}
      {weeklyQ.isError && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(220,38,38,0.05)',
          border: '1px solid rgba(220,38,38,0.18)',
          borderRadius: 10, fontSize: 13, color: '#b91c1c', fontWeight: 600,
        }}>
          ⚠ Could not load timetable.{' '}
          {String(
            (weeklyQ.error as any)?.response?.data?.error
            ?? (weeklyQ.error as any)?.message
            ?? 'Unknown error',
          )}
        </div>
      )}

      {/* ── (4) Data loaded ──────────────────────────────────────────────────── */}
      {weekly && (
        <>
          {/* KPI summary cards — only when timetable has been published */}
          {stats && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <KpiCard
                icon="📅" label="Lectures / week" value={stats.weeklyPeriods}
                color="#1e40af" bg="rgba(37,99,235,0.07)"
              />
              <KpiCard
                icon="🟦" label="Free periods" value={stats.freePeriods}
                color="#0e7490" bg="rgba(8,145,178,0.07)"
              />
              <KpiCard
                icon="🏫" label="Classes taught" value={stats.classCount}
                color="#065f46" bg="rgba(5,150,105,0.07)"
              />
              <KpiCard
                icon="📖" label="Subjects taught" value={stats.subjectCount}
                color="#6d28d9" bg="rgba(124,58,237,0.07)"
              />
            </div>
          )}

          {/* ── State A: No published timetable at all ───────────────────────── */}
          {!hasPublished && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 10, padding: '48px 24px', textAlign: 'center',
              background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)',
            }}>
              <div style={{ fontSize: 40 }}>🗓</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'rgba(15,23,42,0.6)' }}>
                No published timetable is available for this staff member.
              </div>
              <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.42)', maxWidth: 400 }}>
                A timetable must be created and published by the school admin before
                periods appear here.
              </div>
              <button
                type="button"
                onClick={() => navigate(fullTimetablePath)}
                style={{
                  marginTop: 6, padding: '9px 22px', borderRadius: 9,
                  border: 'none', background: '#2563eb', color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                Open Operations Hub / Timetable →
              </button>
            </div>
          )}

          {/* ── State B: Published but no entries for this teacher ───────────── */}
          {hasPublished && !hasAssignedCells && (
            <div style={{
              padding: '14px 18px',
              background: 'rgba(234,179,8,0.05)',
              border: '1px solid rgba(234,179,8,0.2)',
              borderRadius: 10, fontSize: 13, color: '#92400e', fontWeight: 600,
            }}>
              ℹ No lectures are assigned to this staff member in the published timetable.
            </div>
          )}

          {/* ── State C: Published timetable with grid ───────────────────────── */}
          {hasPublished && (
            <>
              {/* Version strip + "Open full timetable" secondary action */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'rgba(15,23,42,0.82)' }}>
                    Published schedule — view only
                  </div>
                  {weekly.publishedAt && (
                    <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)', marginTop: 2 }}>
                      v{weekly.versionNumber} ·{' '}
                      {new Date(weekly.publishedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(fullTimetablePath)}
                  style={{
                    padding: '7px 16px', borderRadius: 8,
                    border: '1.5px solid rgba(37,99,235,0.3)',
                    background: 'rgba(37,99,235,0.05)',
                    color: '#1d4ed8', fontWeight: 700, fontSize: 12,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Open full timetable →
                </button>
              </div>

              {/* Desktop: scrollable period × day grid */}
              {!isMobile && (
                <TeacherPublishedWeekGrid
                  data={weekly}
                  hideStats
                  hideTodaySummary
                />
              )}

              {/* Mobile: per-day cards */}
              {isMobile && <MobileDayCardsView data={weekly} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

