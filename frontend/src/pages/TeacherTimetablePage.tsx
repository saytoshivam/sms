import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { hasSchoolLeadershipRole } from '../lib/roleGroups';
import { SelectKeeper } from '../components/SelectKeeper';

type MeLite = { roles: string[] };

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

function todayYmd(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return toYmd(d);
}

function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

export type TimetableOccurrence = {
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacherName: string;
  room: string | null;
  classGroupDisplayName: string;
  source: string;
};

export function formatDayHeading(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function slotTypeLabel(source: string): 'Weekly' | 'One-off' {
  return source === 'RECURRING' ? 'Weekly' : 'One-off';
}

function splitClassAndSection(display: string): { classLabel: string; sectionLabel: string } {
  const s = (display ?? '').trim();
  if (!s) return { classLabel: 'Class', sectionLabel: '' };
  // Prefer last '-' split so names like "Grade 10-A" or "10-A" work.
  const parts = s.split('-').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const sectionLabel = parts[parts.length - 1] ?? '';
    const classLabel = parts.slice(0, -1).join('-').trim();
    return { classLabel: classLabel || s, sectionLabel };
  }
  return { classLabel: s, sectionLabel: '' };
}

/** Shared table for one day’s rows (teacher timetable + dashboard “today”). */
export function TeacherDayScheduleTable({
  rows,
  compact,
  ariaLabel,
  groupByClassSection,
}: {
  rows: TimetableOccurrence[];
  compact?: boolean;
  ariaLabel?: string;
  groupByClassSection?: boolean;
}) {
  if (rows.length === 0) return null;

  if (groupByClassSection) {
    const byClass = new Map<string, Map<string, TimetableOccurrence[]>>();
    for (const o of rows) {
      const { classLabel, sectionLabel } = splitClassAndSection(o.classGroupDisplayName);
      const bySection = byClass.get(classLabel) ?? new Map<string, TimetableOccurrence[]>();
      const list = bySection.get(sectionLabel) ?? [];
      list.push(o);
      bySection.set(sectionLabel, list);
      byClass.set(classLabel, bySection);
    }

    const classKeys = Array.from(byClass.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return (
      <div className="stack" style={{ gap: 12 }}>
        {classKeys.map((classLabel) => {
          const sectionMap = byClass.get(classLabel) ?? new Map();
          const sectionKeys = Array.from(sectionMap.keys()).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
          );
          return (
            <section key={classLabel} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 900 }}>{classLabel}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {sectionKeys.reduce((n, k) => n + (sectionMap.get(k)?.length ?? 0), 0)} slot
                  {sectionKeys.reduce((n, k) => n + (sectionMap.get(k)?.length ?? 0), 0) === 1 ? '' : 's'}
                </div>
              </div>
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                {sectionKeys.map((sectionLabel) => {
                  const list = [...(sectionMap.get(sectionLabel) ?? [])].sort((a, b) =>
                    a.startTime.localeCompare(b.startTime),
                  );
                  return (
                    <div key={`${classLabel}-${sectionLabel || 'no-section'}`} className="stack" style={{ gap: 8 }}>
                      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>
                          {sectionLabel ? `Section ${sectionLabel}` : 'Section'}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {list.length} slot{list.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className={compact ? 'teacher-tt-table-wrap teacher-tt-table-wrap--compact' : 'teacher-tt-table-wrap'}>
                        <table className="data-table teacher-tt-table" aria-label={ariaLabel}>
                          <thead>
                            <tr>
                              <th scope="col">Time</th>
                              <th scope="col">Subject</th>
                              <th scope="col">Room</th>
                              <th scope="col">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((o, i) => (
                              <tr key={`${o.startTime}-${i}-${o.subject}-${o.source}-${o.room ?? ''}`}>
                                <td>
                                  {o.startTime.slice(0, 5)}–{o.endTime.slice(0, 5)}
                                </td>
                                <td className="teacher-tt-col-subject">{o.subject}</td>
                                <td>{o.room?.trim() ? o.room : '—'}</td>
                                <td className="teacher-tt-col-type">
                                  <span className={o.source === 'RECURRING' ? 'tag tag-rec' : 'tag tag-adhoc'}>
                                    {slotTypeLabel(o.source)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className={compact ? 'teacher-tt-table-wrap teacher-tt-table-wrap--compact' : 'teacher-tt-table-wrap'}>
      <table className="data-table teacher-tt-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Subject</th>
            <th scope="col">Class</th>
            <th scope="col">Room</th>
            <th scope="col">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o, i) => (
            <tr key={`${o.startTime}-${i}-${o.subject}-${o.source}-${o.room ?? ''}`}>
              <td>
                {o.startTime.slice(0, 5)}–{o.endTime.slice(0, 5)}
              </td>
              <td className="teacher-tt-col-subject">{o.subject}</td>
              <td>{o.classGroupDisplayName}</td>
              <td>{o.room?.trim() ? o.room : '—'}</td>
              <td className="teacher-tt-col-type">
                <span className={o.source === 'RECURRING' ? 'tag tag-rec' : 'tag tag-adhoc'}>{slotTypeLabel(o.source)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeacherTimetablePage() {
  const [from, setFrom] = useState(() => mondayThisWeek());
  const [to, setTo] = useState(() => addDaysYmd(mondayThisWeek(), 13));

  const me = useQuery({
    queryKey: ['me-lite'],
    queryFn: async () => (await api.get<MeLite>('/user/me')).data,
  });
  const leadershipView = hasSchoolLeadershipRole(me.data?.roles ?? []);

  const [teacherFilter, setTeacherFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  const cal = useQuery({
    queryKey: ['teacher-timetable', from, to],
    queryFn: async () =>
      (await api.get<TimetableOccurrence[]>(`/api/v1/teacher/timetable?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`))
        .data,
  });

  const filterOptions = useMemo(() => {
    const rows = cal.data ?? [];
    const teachers = new Set<string>();
    const subjects = new Set<string>();
    const classes = new Set<string>();
    const sections = new Set<string>();
    for (const r of rows) {
      if ((r.teacherName ?? '').trim()) teachers.add(r.teacherName.trim());
      if ((r.subject ?? '').trim()) subjects.add(r.subject.trim());
      const { classLabel, sectionLabel } = splitClassAndSection(r.classGroupDisplayName);
      if (classLabel.trim()) classes.add(classLabel.trim());
      if (sectionLabel.trim()) sections.add(sectionLabel.trim());
    }
    const toOpts = (set: Set<string>) =>
      Array.from(set)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((v) => ({ value: v, label: v }));
    return {
      teacherOptions: toOpts(teachers),
      subjectOptions: toOpts(subjects),
      classOptions: toOpts(classes),
      sectionOptions: toOpts(sections),
    };
  }, [cal.data]);

  const filteredRows = useMemo(() => {
    const rows = cal.data ?? [];
    if (!leadershipView) return rows;
    return rows.filter((r) => {
      if (teacherFilter && (r.teacherName ?? '').trim() !== teacherFilter) return false;
      if (subjectFilter && (r.subject ?? '').trim() !== subjectFilter) return false;
      const { classLabel, sectionLabel } = splitClassAndSection(r.classGroupDisplayName);
      if (classFilter && classLabel.trim() !== classFilter) return false;
      if (sectionFilter && sectionLabel.trim() !== sectionFilter) return false;
      return true;
    });
  }, [cal.data, leadershipView, teacherFilter, subjectFilter, classFilter, sectionFilter]);

  const byDate = useMemo(() => {
    const m = new Map<string, TimetableOccurrence[]>();
    for (const o of filteredRows) {
      const list = m.get(o.date) ?? [];
      list.push(o);
      m.set(o.date, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [filteredRows]);

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

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>{leadershipView ? 'School timetable' : 'My timetable'}</h2>
      <p className="muted" style={{ margin: 0 }}>
        Recurring weekly slots and dated one-off sessions in range.
        {leadershipView
          ? ' Grouped by class and section for quick scanning.'
          : ' When your account is linked to a staff profile, only your classes are shown.'}
      </p>

      <div className="teacher-tt-explainer">
        <strong>What “Type” means</strong>
        <ul>
          <li>
            <strong>Weekly</strong> — your normal class from the school’s <em>weekly timetable</em> (repeats on the same
            weekday and time).
          </li>
          <li>
            <strong>One-off</strong> — a session recorded as a <em>lecture on a specific date</em> (extra class,
            substitution, demo slot, or a dated plan). It can show alongside a weekly row for the same time if both exist
            in the system.
          </li>
        </ul>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="stack" style={{ gap: 6, minWidth: 160 }}>
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="stack" style={{ gap: 6, minWidth: 160 }}>
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              const t = todayYmd();
              setFrom(t);
              setTo(t);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              const m = mondayThisWeek();
              setFrom(m);
              setTo(addDaysYmd(m, 6));
            }}
          >
            Current week
          </button>
          <button type="button" className="btn secondary" onClick={() => setTo(addDaysYmd(from, 13))}>
            2 weeks
          </button>
        </div>
        </div>

        {leadershipView ? (
          <div className="row" style={{ alignItems: 'end' }}>
            <div className="stack" style={{ gap: 6, minWidth: 220, flex: '1 1 220px' }}>
              <label>Teacher</label>
              <SelectKeeper
                value={teacherFilter}
                onChange={setTeacherFilter}
                options={filterOptions.teacherOptions}
                emptyValueLabel="All teachers"
              />
            </div>
            <div className="stack" style={{ gap: 6, minWidth: 220, flex: '1 1 220px' }}>
              <label>Subject</label>
              <SelectKeeper
                value={subjectFilter}
                onChange={setSubjectFilter}
                options={filterOptions.subjectOptions}
                emptyValueLabel="All subjects"
              />
            </div>
            <div className="stack" style={{ gap: 6, minWidth: 220, flex: '1 1 220px' }}>
              <label>Class</label>
              <SelectKeeper
                value={classFilter}
                onChange={(v) => {
                  setClassFilter(v);
                  setSectionFilter('');
                }}
                options={filterOptions.classOptions}
                emptyValueLabel="All classes"
              />
            </div>
            <div className="stack" style={{ gap: 6, minWidth: 180, flex: '0 1 180px' }}>
              <label>Section</label>
              <SelectKeeper
                value={sectionFilter}
                onChange={setSectionFilter}
                options={filterOptions.sectionOptions}
                emptyValueLabel="All sections"
              />
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setTeacherFilter('');
                setSubjectFilter('');
                setClassFilter('');
                setSectionFilter('');
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <div className="stack">
        {cal.isLoading ? (
          <div>Loading…</div>
        ) : cal.error ? (
          <div style={{ color: '#b91c1c' }}>{String((cal.error as any)?.response?.data ?? cal.error)}</div>
        ) : (
          dates.map((d) => {
            const rows = byDate.get(d) ?? [];
            return (
              <article key={d} className="teacher-tt-day-card">
                <header className="teacher-tt-day-head">
                  <h3 className="teacher-tt-day-title">{formatDayHeading(d)}</h3>
                  <span className="teacher-tt-day-meta">
                    {d} · {rows.length} slot{rows.length === 1 ? '' : 's'}
                  </span>
                </header>
                {rows.length === 0 ? (
                  <div className="muted" style={{ fontSize: 14, padding: '12px 16px 16px' }}>
                    No classes
                  </div>
                ) : (
                  <TeacherDayScheduleTable rows={rows} ariaLabel={`Classes on ${d}`} groupByClassSection={leadershipView} />
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
