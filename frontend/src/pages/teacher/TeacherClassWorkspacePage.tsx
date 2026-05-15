import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { formatJsonDate } from '../../lib/apiData';
import type { ClassGroupRef } from './types';
import type { StudentProgressRow } from '../ClassProgressPage';
import './teacherWorkspace.css';

const TABS = [
  ['overview', 'Overview'],
  ['students', 'Students'],
  ['attendance', 'Attendance'],
  ['homework', 'Homework'],
  ['marks', 'Marks'],
  ['notes', 'Notes'],
  ['announcements', 'Announcements'],
  ['files', 'Resources'],
] as const;

export function TeacherClassWorkspacePage() {
  const { classGroupId: idStr } = useParams();
  const [searchParams] = useSearchParams();
  const classGroupId = Number(idStr);

  const rawTab = searchParams.get('tab');
  const activeTab: (typeof TABS)[number][0] = TABS.some(([key]) => key === rawTab) ? (rawTab as typeof activeTab) : 'overview';

  const groups = useQuery({
    queryKey: ['teacher-my-class-groups'],
    queryFn: async () => (await api.get<ClassGroupRef[]>('/api/v1/teacher/my-class-groups')).data,
  });

  const progress = useQuery({
    queryKey: ['teacher-class-progress'],
    queryFn: async () => (await api.get<StudentProgressRow[]>('/api/v1/teacher/students/progress')).data,
  });

  const selected = useMemo(() => groups.data?.find((g) => g.id === classGroupId), [groups.data, classGroupId]);

  const cohort = useMemo(() => {
    if (!selected || !progress.data) return [];
    const name = selected.displayName.trim();
    return progress.data.filter((r) => r.classGroupName.trim() === name);
  }, [selected, progress.data]);

  const stats = useMemo(() => {
    if (cohort.length === 0) {
      return { n: 0, att: null as number | null, avg: null as number | null, marksZero: 0 };
    }
    const attSum = cohort.reduce((s, r) => s + r.attendancePercentSinceJoin, 0);
    const scoreSum = cohort.reduce((s, r) => s + r.averageScorePercentSinceJoin, 0);
    return {
      n: cohort.length,
      att: Math.round((attSum / cohort.length) * 10) / 10,
      avg: Math.round((scoreSum / cohort.length) * 10) / 10,
      marksZero: cohort.filter((r) => r.marksCountSinceJoin === 0).length,
    };
  }, [cohort]);

  if (!Number.isFinite(classGroupId) || classGroupId <= 0) {
    return <p className="muted">Invalid class.</p>;
  }

  const ymd = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const attHrefDaily = `/app/attendance?date=${encodeURIComponent(ymd)}&classGroupId=${classGroupId}`;
  if (groups.isSuccess && selected == null) {
    return (
      <div className="workspace-feature-page tws-page">
        <p style={{ color: '#b45309', fontWeight: 750 }}>
          You do not have access to this section from your published timetable mappings.
        </p>
        <Link to="/app/teacher/classes">← My classes</Link>
      </div>
    );
  }

  return (
    <div className="workspace-feature-page tws-page">
      <div className="tws-toolbar">
        <div>
          <Link to="/app/teacher/classes" className="muted" style={{ fontSize: 12, fontWeight: 650 }}>
            My classes
          </Link>
          <h2 style={{ marginTop: 4 }}>
            {selected?.displayName ?? '…'}{' '}
            {selected?.code ? <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>({selected.code})</span> : null}
          </h2>
        </div>
        <Link className="btn secondary" style={{ fontSize: 12 }} to="/app/students">
          Full directory
        </Link>
      </div>

      <nav className="tws-tabs" aria-label="Class workspace">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            to={`/app/teacher/classes/${classGroupId}${key === 'overview' ? '' : `?tab=${key}`}`}
            replace
            className="tws-tab"
            aria-current={activeTab === key ? 'page' : undefined}
            data-active={activeTab === key ? 'true' : 'false'}
          >
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <div className="tws-panel">
          {progress.isLoading || groups.isLoading ? <p className="muted">Loading…</p> : null}
          {progress.error ? <p style={{ color: '#b91c1c' }}>{formatApiError(progress.error)}</p> : null}
          <div className="tws-stat-grid">
            <div className="tws-stat">
              <div className="tws-stat__v">{stats.n}</div>
              <div className="tws-stat__k">Students tracked</div>
            </div>
            <div className="tws-stat">
              <div className="tws-stat__v">{stats.att != null ? `${stats.att}%` : '—'}</div>
              <div className="tws-stat__k">Avg attendance*</div>
            </div>
            <div className="tws-stat">
              <div className="tws-stat__v">{stats.avg != null ? `${stats.avg}%` : '—'}</div>
              <div className="tws-stat__k">Avg score*</div>
            </div>
          </div>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 11 }}>
            *Rolling since each student&apos;s enrolment ({cohort.length} row{cohort.length === 1 ? '' : 's'} in cohort).
          </p>
          {stats.marksZero > 0 ? (
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 650, color: '#9a3412' }}>
              {stats.marksZero} student{stats.marksZero === 1 ? '' : 's'} with no marks recorded yet.
            </p>
          ) : null}
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Link className="btn" to={`/app/teacher/classes/${classGroupId}?tab=students`}>
              View roster &amp; drill-down
            </Link>
            <Link className="btn secondary" to={attHrefDaily}>
              <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                <ClipboardCheck size={16} aria-hidden /> Attendance workspace
              </span>
            </Link>
          </div>
          <div className="tws-placeholder" style={{ marginTop: 14 }}>
            <div className="tws-placeholder__title">Roadmap hooks</div>
            <p>
              Lesson notes, cohort homework rollup, syllabus pacing, behaviour flags, and parent messages will dock into
              this workspace as modules go live — same tab shell.
            </p>
          </div>
          <p className="muted" style={{ fontSize: 10, marginTop: 12 }}>
            Lecture-wise shortcuts include period context once the attendance URL contract exposes slot selection for this UI.
          </p>
        </div>
      ) : null}

      {activeTab === 'students' ? (
        <div className="tws-panel">
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Instructional cohort from progress API (matching section name "{selected?.displayName}").
          </p>
          {progress.isLoading ? <p className="muted">Loading…</p> : null}
          {cohort.length === 0 && progress.isSuccess ? (
            <p className="muted">No enrolled students surfaced for analytics yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tws-mini-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission</th>
                    <th>Joined</th>
                    <th>Att%</th>
                    <th>Avg score</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cohort.map((r) => (
                    <tr key={r.studentId}>
                      <td>
                        <strong>{r.fullName}</strong>
                      </td>
                      <td>{r.admissionNo}</td>
                      <td>{formatJsonDate(r.joinedOn as unknown)}</td>
                      <td>{r.attendancePercentSinceJoin.toFixed(1)}</td>
                      <td>{r.averageScorePercentSinceJoin.toFixed(1)}</td>
                      <td>
                        <Link className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }} to={`/app/students/${r.studentId}/performance?sinceJoin=true`}>
                          Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'attendance' ? (
        <div className="tws-panel">
          <p style={{ marginTop: 0, fontWeight: 700 }}>Operational attendance entry</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Your school picks <strong>Daily</strong> (homeroom) or <strong>Lecture-wise</strong> marking. Opens the unified
            attendance surface with section context prefilled where supported.
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Link className="btn" to={attHrefDaily}>
              Open attendance ({ymd})
            </Link>
          </div>
          <div className="tws-placeholder" style={{ marginTop: 14 }}>
            <div className="tws-placeholder__title">Integrated history UI</div>
            <p>Historical heatmaps and class-level timelines will attach here behind the lecture/daily aggregates API.</p>
          </div>
        </div>
      ) : null}

      {(activeTab === 'homework' || activeTab === 'marks') && (
        <div className="tws-panel tws-placeholder">
          <div className="tws-placeholder__title">{activeTab === 'homework' ? 'Homework' : 'Marks & assessments'}</div>
          <p>
            Creation, scheduling, grading, and publish pipelines are slated next. Continue using Lectures (
            <Link to="/app/lectures">/app/lectures</Link>) and cohort marks via Class progress for now.
          </p>
          <Link className="btn secondary" style={{ marginTop: 8 }} to="/app/teacher/class-progress">
            Open class progress
          </Link>
        </div>
      )}

      {(activeTab === 'notes' || activeTab === 'announcements' || activeTab === 'files') && (
        <div className="tws-panel tws-placeholder">
          <div className="tws-placeholder__title">
            {activeTab === 'notes' ? 'Teaching notes' : activeTab === 'announcements' ? 'Announcements' : 'Learning resources'}
          </div>
          <p>
            {activeTab === 'announcements' ? (
              <>
                Compose class-scoped announcements at{' '}
                <Link to="/app/teacher/announcements/new">new announcement</Link>.
              </>
            ) : (
              'Document store, versioning, visibility rules — implementation queued with LMS phase.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
