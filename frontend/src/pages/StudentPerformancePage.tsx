import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { SCHOOL_LEADERSHIP_ROLES, TEACHING_ROLES } from '../lib/roleGroups';

export type PerformanceDashboard = {
  student: {
    studentId: number;
    admissionNo: string;
    fullName: string;
    classGroupName: string;
  };
  /** `period`: ISO year-month string (yyyy-MM). */
  attendanceTrend: { period: string; presentPercent: number; presentDays: number; totalDays: number }[];
  subjectPerformance: {
    subjectCode: string;
    subjectName: string;
    averagePercent: number;
    /** `assessedOn`: ISO calendar date string (yyyy-MM-dd). */
    trend: { assessedOn: string; scorePercent: number }[];
  }[];
  overallAttendancePercent: number;
};

function usePerformanceDashboard(url: string, enabled = true) {
  return useQuery({
    queryKey: ['student-performance', url],
    queryFn: async () => (await api.get<PerformanceDashboard>(url)).data,
    enabled,
  });
}

function PerformanceBody({
  q,
  backLink,
}: {
  q: ReturnType<typeof usePerformanceDashboard>;
  backLink: { to: string; label: string };
}) {
  if (q.isLoading) {
    return <div className="muted">Loading performance…</div>;
  }
  if (q.isError || !q.data) {
    const ax = q.error as { response?: { data?: { message?: string } } };
    const msg = ax?.response?.data?.message ?? String((q.error as Error)?.message ?? 'Could not load performance.');
    return (
      <div className="card stack">
        <div style={{ color: '#b91c1c' }}>{msg}</div>
        <Link className="btn secondary" to={backLink.to}>
          {backLink.label}
        </Link>
      </div>
    );
  }

  const d = q.data;
  const attendanceChart = d.attendanceTrend.map((p) => ({
    period: p.period,
    'Attendance %': p.presentPercent,
    days: `${p.presentDays}/${p.totalDays} days`,
  }));

  const subjectBars = d.subjectPerformance.map((s) => ({
    name: s.subjectName,
    avg: s.averagePercent,
    code: s.subjectCode,
  }));

  return (
    <div className="stack perf-page">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Link className="muted" to={backLink.to} style={{ fontSize: 14 }}>
          ← {backLink.label}
        </Link>
      </div>

      <div className="perf-top">
        <div className="card perf-hero perf-top__hero">
          <div className="perf-hero-inner">
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Student
              </div>
              <h2 style={{ margin: '4px 0 0', fontSize: 22 }}>{d.student.fullName}</h2>
              <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
                {d.student.classGroupName} · {d.student.admissionNo}
              </div>
            </div>
            <div className="perf-stat">
              <div className="muted" style={{ fontSize: 12 }}>
                Overall attendance
              </div>
              <div className="perf-stat-value">{d.overallAttendancePercent.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div className="card chart-card perf-top__chart">
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Attendance by month</h3>
          <div className="chart-wrap chart-wrap--top">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" width={36} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Attendance']} />
                <Legend />
                <Line type="monotone" dataKey="Attendance %" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card perf-top__chart">
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Average score by subject</h3>
          <div className="chart-wrap chart-wrap--top">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectBars} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={56} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" width={36} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Average']} />
                <Bar dataKey="avg" fill="var(--color-accent)" radius={[6, 6, 0, 0]} name="Avg %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="stack">
        <h3 style={{ margin: 0, fontSize: 16 }}>Score trend per subject</h3>
        <div className="perf-grid">
          {d.subjectPerformance.map((sub) => {
            const data = sub.trend.map((t) => ({
              date: t.assessedOn,
              '%': t.scorePercent,
            }));
            return (
              <div key={sub.subjectCode} className="card chart-card">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 14 }}>{sub.subjectName}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Avg {sub.averagePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="chart-wrap chart-wrap--short">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={32} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Score']} />
                      <Line type="monotone" dataKey="%" stroke="#0d9488" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StudentMyPerformancePage() {
  const [sp, setSp] = useSearchParams();
  const sinceJoin = sp.get('sinceJoin') === 'true';
  const url = `/api/v1/students/me/performance${sinceJoin ? '?sinceJoin=true' : ''}`;
  const q = usePerformanceDashboard(url);
  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>My performance</h2>
      <label className="row since-join-toggle" style={{ gap: 10, cursor: 'pointer', width: 'fit-content' }}>
        <input
          type="checkbox"
          checked={sinceJoin}
          onChange={(e) => {
            const next = new URLSearchParams(sp);
            if (e.target.checked) next.set('sinceJoin', 'true');
            else next.delete('sinceJoin');
            setSp(next, { replace: true });
          }}
        />
        <span>Since I joined (enrollment date)</span>
      </label>
      <PerformanceBody q={q} backLink={{ to: '/app', label: 'Back to dashboard' }} />
    </div>
  );
}

export function StudentPerformancePage() {
  const { studentId } = useParams();
  const [sp, setSp] = useSearchParams();
  const id = studentId ? Number(studentId) : NaN;
  const valid = Number.isFinite(id) && id > 0;
  const sinceJoin = sp.get('sinceJoin') === 'true';
  const url = `/api/v1/students/${id}/performance${sinceJoin ? '?sinceJoin=true' : ''}`;
  const q = usePerformanceDashboard(url, valid);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ roles: string[] }>('/user/me')).data,
  });
  const showSinceJoin =
    (me.data?.roles ?? []).some((r) =>
      ([...SCHOOL_LEADERSHIP_ROLES, ...TEACHING_ROLES] as string[]).includes(r),
    ) && valid;

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>Student performance</h2>
      {!valid ? (
        <div className="muted">Invalid student id.</div>
      ) : (
        <>
          {showSinceJoin ? (
            <label className="row since-join-toggle" style={{ gap: 10, cursor: 'pointer', width: 'fit-content' }}>
              <input
                type="checkbox"
                checked={sinceJoin}
                onChange={(e) => {
                  const next = new URLSearchParams(sp);
                  if (e.target.checked) next.set('sinceJoin', 'true');
                  else next.delete('sinceJoin');
                  setSp(next, { replace: true });
                }}
              />
              <span>Since student joined (enrollment date)</span>
            </label>
          ) : null}
          <PerformanceBody q={q} backLink={{ to: '/app/students', label: 'Back to students' }} />
        </>
      )}
    </div>
  );
}
