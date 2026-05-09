import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { StudentDayScheduleTable } from '../components/StudentDayScheduleTable';
import { DateKeeper } from '../components/DateKeeper';
import { formatDayHeading, type TimetableOccurrence } from './TeacherTimetablePage';

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayThisWeek(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return toYmd(d);
}

function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

type SubjAtt = {
  subjectCode: string;
  subjectName: string;
  presentOrLateDays: number;
  countedDays: number;
  attendancePercent: number;
  termName?: string;
  attendedSessions?: number;
  deliveredSessions?: number;
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type PublishedStudentCell = {
  dayOfWeek: string;
  timeSlotId: number;
  subject: string;
  teacherName: string;
  room: string;
  breakSlot: boolean;
  free: boolean;
};

type PublishedStudentWeekly = {
  versionNumber: number | null;
  publishedAt: string | null;
  dayOrder: string[];
  periods: { timeSlotId: number; slotOrder: number; startTime: string; endTime: string; breakSlot: boolean }[];
  cells: PublishedStudentCell[];
  todayCells: PublishedStudentCell[];
};

function studentDayShort(d: string): string {
  const m: Record<string, string> = {
    MONDAY: 'Mon',
    TUESDAY: 'Tue',
    WEDNESDAY: 'Wed',
    THURSDAY: 'Thu',
    FRIDAY: 'Fri',
    SATURDAY: 'Sat',
    SUNDAY: 'Sun',
  };
  return m[d] ?? d.slice(0, 3);
}

function StudentPublishedWeekGrid({ data }: { data: PublishedStudentWeekly }) {
  if (data.versionNumber == null && data.periods.length === 0) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        No published timetable yet. Ask your school office when it will be posted.
      </p>
    );
  }
  const cellKey = (day: string, slotId: number) => `${day}|${slotId}`;
  const cmap = new Map<string, PublishedStudentCell>();
  for (const c of data.cells) cmap.set(cellKey(c.dayOfWeek, c.timeSlotId), c);
  const days = data.dayOrder.length ? data.dayOrder : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="muted" style={{ fontSize: 13 }}>
        Published v{data.versionNumber ?? '?'}
        {data.publishedAt ? ` · ${new Date(data.publishedAt).toLocaleString()}` : ''}
      </div>
      <div className="teacher-tt-table-wrap" style={{ overflowX: 'auto' }}>
        <table className="data-table teacher-tt-table" style={{ minWidth: 520 }} aria-label="Class weekly timetable">
          <thead>
            <tr>
              <th scope="col">Period</th>
              {days.map((d) => (
                <th key={d} scope="col">
                  {studentDayShort(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.periods.map((p) => (
              <tr key={p.timeSlotId}>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>
                  P{p.slotOrder}
                  <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                    {String(p.startTime).slice(0, 5)}–{String(p.endTime).slice(0, 5)}
                  </div>
                  {p.breakSlot ? (
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309' }}>Break</div>
                  ) : null}
                </td>
                {days.map((d) => {
                  const c = cmap.get(cellKey(d, p.timeSlotId));
                  if (!c) return <td key={d}>—</td>;
                  if (c.breakSlot) {
                    return (
                      <td key={d} className="muted" style={{ fontSize: 12 }}>
                        Break
                      </td>
                    );
                  }
                  if (c.free) {
                    return (
                      <td key={d} className="muted" style={{ fontSize: 12 }}>
                        Free
                      </td>
                    );
                  }
                  return (
                    <td key={d} style={{ fontSize: 12, verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 900 }}>{c.subject}</div>
                      <div className="muted" style={{ fontWeight: 700 }}>
                        {c.teacherName}
                      </div>
                      <div className="muted">{c.room?.trim() ? c.room : '—'}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StudentSchedulePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const scheduleCardRef = useRef<HTMLDivElement>(null);
  const attendanceCardRef = useRef<HTMLDivElement>(null);

  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  const [from, setFrom] = useState(() => mondayThisWeek());
  const [to, setTo] = useState(() => addDaysYmd(mondayThisWeek(), 13));

  const todaySchedule = useQuery({
    queryKey: ['student-schedule-today'],
    queryFn: async () => (await api.get<TimetableOccurrence[]>('/api/v1/student/me/schedule/today')).data,
  });

  const schedule = useQuery({
    queryKey: ['student-schedule', from, to],
    queryFn: async () =>
      (await api.get<TimetableOccurrence[]>(`/api/v1/student/me/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`))
        .data,
  });

  const subjAtt = useQuery({
    queryKey: ['student-subject-attendance'],
    queryFn: async () => (await api.get<SubjAtt[]>('/api/v1/student/me/subject-attendance')).data,
  });

  const weeklyPublished = useQuery({
    queryKey: ['student-weekly-published'],
    queryFn: async () =>
      (await api.get<PublishedStudentWeekly>('/api/v1/student/me/timetable/weekly-published')).data,
  });

  const byDate = useMemo(() => {
    const m = new Map<string, TimetableOccurrence[]>();
    for (const o of schedule.data ?? []) {
      const list = m.get(o.date) ?? [];
      list.push(o);
      m.set(o.date, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [schedule.data]);

  const dates = useMemo(() => {
    const out: string[] = [];
    let cur = from;
    let guard = 0;
    while (cur <= to && guard++ < 400) {
      out.push(cur);
      cur = addDaysYmd(cur, 1);
    }
    return out;
  }, [from, to]);

  const attChartData = useMemo(
    () =>
      (subjAtt.data ?? []).map((r) => ({
        name: r.subjectName,
        pct: r.attendancePercent,
      })),
    [subjAtt.data],
  );

  const todayRowsSorted = useMemo(() => {
    const r = [...(todaySchedule.data ?? [])];
    r.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return r;
  }, [todaySchedule.data]);

  useEffect(() => {
    const raw = location.hash.replace(/^#/, '');
    if (raw === 'attendance') {
      setAttendanceOpen(true);
      setScheduleOpen(false);
      requestAnimationFrame(() =>
        attendanceCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    } else if (raw === 'schedule') {
      setScheduleOpen(true);
      setAttendanceOpen(false);
      requestAnimationFrame(() =>
        scheduleCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }, [location.hash]);

  const clearHashIfMatches = (fragment: string) => {
    if (location.hash === `#${fragment}`) {
      navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true });
    }
  };

  const toggleSchedule = () => {
    if (scheduleOpen) {
      setScheduleOpen(false);
      clearHashIfMatches('schedule');
    } else {
      setScheduleOpen(true);
      setAttendanceOpen(false);
      navigate({ pathname: location.pathname, search: location.search, hash: 'schedule' }, { replace: true });
    }
  };

  const toggleAttendance = () => {
    if (attendanceOpen) {
      setAttendanceOpen(false);
      clearHashIfMatches('attendance');
    } else {
      setAttendanceOpen(true);
      setScheduleOpen(false);
      navigate({ pathname: location.pathname, search: location.search, hash: 'attendance' }, { replace: true });
    }
  };

  const closeSchedule = () => {
    setScheduleOpen(false);
    clearHashIfMatches('schedule');
  };

  const closeAttendance = () => {
    setAttendanceOpen(false);
    clearHashIfMatches('attendance');
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Schedule</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn secondary" to="/app/student/marks">
            View marks
          </Link>
          <Link className="btn secondary" to="/app/students/me/performance">
            Performance charts
          </Link>
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Your class timetable comes from the school’s <strong>published</strong> schedule (read-only). Open attendance
        for a quick chart, or use the full term attendance page.
      </p>

      <div className="card stack" style={{ gap: 12, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Weekly class timetable</h3>
        {weeklyPublished.isLoading ? (
          <div className="muted">Loading…</div>
        ) : weeklyPublished.error ? (
          <div style={{ color: '#b91c1c', fontSize: 14 }}>
            {String((weeklyPublished.error as any)?.response?.data ?? weeklyPublished.error)}
          </div>
        ) : weeklyPublished.data ? (
          <StudentPublishedWeekGrid data={weeklyPublished.data} />
        ) : null}
      </div>

      <div className="card stack student-sched-today-card">
        <div className="student-sched-today-head">
          <h3>Today</h3>
          <span className="muted" style={{ fontSize: 13 }}>
            {todayYmd()}
          </span>
        </div>
        {todaySchedule.isLoading ? (
          <div className="muted">Loading…</div>
        ) : todaySchedule.error ? (
          <div style={{ color: '#b91c1c' }}>{String((todaySchedule.error as any)?.response?.data ?? todaySchedule.error)}</div>
        ) : todayRowsSorted.length === 0 ? (
          <div className="muted student-tt-empty" style={{ margin: 0 }}>
            No classes today.
          </div>
        ) : (
          <StudentDayScheduleTable rows={todayRowsSorted} compact ariaLabel="Today's classes" />
        )}
      </div>

      <div ref={scheduleCardRef} className="card stack" id="lecture-schedule">
        <button type="button" className="collapsible-trigger" aria-expanded={scheduleOpen} onClick={toggleSchedule}>
          <h3>Lecture schedule</h3>
          <span className="collapsible-hint">{scheduleOpen ? 'Close' : 'Open'}</span>
        </button>
        {!scheduleOpen ? (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Tap the heading above to choose dates and see your full range of classes.
          </p>
        ) : (
          <>
            <div className="collapsible-panel-actions">
              <button type="button" className="btn secondary" onClick={closeSchedule}>
                Close schedule
              </button>
            </div>
            <div className="student-sched-explainer">
              <strong>Weekly</strong> = your regular class from the school’s published timetable for your section.
            </div>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
              <div className="stack" style={{ gap: 6, minWidth: 200 }}>
                <label htmlFor="student-sched-from">From</label>
                <DateKeeper id="student-sched-from" value={from} onChange={(v) => setFrom(v)} />
              </div>
              <div className="stack" style={{ gap: 6, minWidth: 200 }}>
                <label htmlFor="student-sched-to">To</label>
                <DateKeeper id="student-sched-to" value={to} onChange={(v) => setTo(v)} />
              </div>
              <button type="button" className="btn secondary" onClick={() => setTo(addDaysYmd(from, 13))}>
                Two weeks from “From”
              </button>
            </div>
            {schedule.isLoading ? (
              <div>Loading schedule…</div>
            ) : schedule.error ? (
              <div style={{ color: '#b91c1c' }}>{String((schedule.error as any)?.response?.data ?? schedule.error)}</div>
            ) : (
              <div className="stack" style={{ gap: 14 }}>
                {dates.map((d) => {
                  const rows = byDate.get(d) ?? [];
                  return (
                    <article key={d} className="student-sched-day-card">
                      <header className="student-sched-day-head">
                        <h3 className="student-sched-day-title">{formatDayHeading(d)}</h3>
                        <span className="student-sched-day-meta">
                          {d} · {rows.length} class{rows.length === 1 ? '' : 'es'}
                        </span>
                      </header>
                      {rows.length === 0 ? (
                        <div className="muted" style={{ fontSize: 14, padding: '12px 16px 16px' }}>
                          No classes
                        </div>
                      ) : (
                        <StudentDayScheduleTable rows={rows} ariaLabel={`Classes on ${d}`} />
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div ref={attendanceCardRef} className="card stack" id="attendance-by-subject">
        <button type="button" className="collapsible-trigger" aria-expanded={attendanceOpen} onClick={toggleAttendance}>
          <h3>Attendance by subject</h3>
          <span className="collapsible-hint">{attendanceOpen ? 'Close' : 'Open'}</span>
        </button>
        {!attendanceOpen ? (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Quick attendance chart by subject (same year window as the full attendance page).
          </p>
        ) : (
          <>
            <div className="collapsible-panel-actions">
              <button type="button" className="btn secondary" onClick={closeAttendance}>
                Close attendance
              </button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
              <Link to="/app/student/attendance" className="btn secondary" style={{ display: 'inline-block' }}>
                Open subject-wise attendance (this term)
              </Link>
            </p>
            {subjAtt.isLoading ? (
              <div>Loading…</div>
            ) : subjAtt.error ? (
              <div style={{ color: '#b91c1c' }}>{String((subjAtt.error as any)?.response?.data ?? subjAtt.error)}</div>
            ) : (
              <>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attChartData} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={36} unit="%" />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Attendance']} />
                      <Bar dataKey="pct" fill="var(--color-primary)" radius={[6, 6, 0, 0]} name="Attendance %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Percentages use attended sessions over delivered lecture days for the current academic year.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
