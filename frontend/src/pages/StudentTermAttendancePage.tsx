import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export type StudentSubjectAttendanceRow = {
  subjectCode: string;
  subjectName: string;
  presentOrLateDays: number;
  countedDays: number;
  attendancePercent: number;
  termName?: string;
  courseTypeTag?: string;
  groupLabel?: string;
  facultyName?: string;
  facultySeating?: string;
  lastAttendedDate?: string | null;
  deliveredSessions?: number;
  attendedSessions?: number;
  dutyLeaveCount?: number;
  sectionCode?: string;
  rollNo?: string;
};

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function AttendanceRing({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const deg = Math.round((p / 100) * 360);
  return (
    <div
      className="sta-ring-outer"
      style={{
        background: `conic-gradient(#22c55e ${deg}deg, #e5e7eb 0deg)`,
      }}
    >
      <div className="sta-ring-inner">
        <span className="sta-ring-pct">{Math.round(p)}%</span>
      </div>
    </div>
  );
}

export function StudentTermAttendancePage() {
  const q = useQuery({
    queryKey: ['student-subject-attendance'],
    queryFn: async () => (await api.get<StudentSubjectAttendanceRow[]>('/api/v1/student/me/subject-attendance')).data,
  });

  const termLabel = q.data?.[0]?.termName;

  const aggregatePct = useMemo(() => {
    const rows = q.data ?? [];
    if (rows.length === 0) return 0;
    let att = 0;
    let del = 0;
    for (const r of rows) {
      att += r.attendedSessions ?? r.presentOrLateDays;
      del += r.deliveredSessions ?? r.countedDays;
    }
    return del > 0 ? Math.round((100 * att) / del) : 0;
  }, [q.data]);

  return (
    <div className="sta-page">
      <header className="sta-topbar">
        <Link to="/app" className="sta-topbar-back" aria-label="Back">
          ←
        </Link>
        <h1 className="sta-topbar-title">Attendance</h1>
        <span style={{ width: 28 }} aria-hidden />
      </header>

      <div className="sta-body">
        {termLabel ? <p className="sta-term-hint">Current term · {termLabel}</p> : null}

        {q.isLoading ? (
          <div className="muted">Loading…</div>
        ) : q.error ? (
          <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error)}</div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="sta-empty card">
            <p className="muted" style={{ margin: 0 }}>
              No subject attendance for this term yet. Your school records class attendance on days with scheduled
              lectures for each subject.
            </p>
            <Link to="/app/student/schedule" className="btn secondary" style={{ marginTop: 12 }}>
              Back to schedule
            </Link>
          </div>
        ) : (
          <>
            <div className="sta-aggregate">
              <span className="sta-aggregate-label">Aggregate attendance</span>
              <span className="sta-aggregate-badge">{aggregatePct}%</span>
            </div>

            <ul className="sta-list">
              {(q.data ?? []).map((r) => {
                const delivered = r.deliveredSessions ?? r.countedDays;
                const attended = r.attendedSessions ?? r.presentOrLateDays;
                const duty = r.dutyLeaveCount ?? 0;
                const tag = r.courseTypeTag ?? '(CR)';
                const group = r.groupLabel ?? '1';
                return (
                  <li key={r.subjectCode} className="sta-card">
                    <div className="sta-card-head">
                      <div className="sta-card-title-block">
                        <strong className="sta-card-title">
                          {r.subjectCode} — {r.subjectName.toUpperCase()}{' '}
                          <span className="sta-cr">{tag}</span>
                        </strong>
                      </div>
                      <span className="sta-group-pill">Group: {group}</span>
                    </div>
                    <div className="sta-card-mid">
                      <div className="sta-meta">
                        <div>
                          <span className="sta-meta-k">Faculty</span>: {r.facultyName ?? '—'}
                        </div>
                        <div>
                          <span className="sta-meta-k">Faculty seating</span>: {r.facultySeating ?? '—'}
                        </div>
                        <div>
                          <span className="sta-meta-k">Last attended</span>: {formatShortDate(r.lastAttendedDate)}
                        </div>
                        <div>
                          <span className="sta-meta-k">Attended / delivered</span>: {attended}/{delivered}
                        </div>
                        <div>
                          <span className="sta-meta-k">Duty leaves</span>: {duty}
                        </div>
                      </div>
                      <AttendanceRing pct={r.attendancePercent} />
                    </div>
                    <div className="sta-card-foot">
                      <span className="sta-foot-accent">Section: {r.sectionCode ?? '—'}</span>
                      <span className="sta-foot-accent">Roll no: {r.rollNo ?? '—'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
