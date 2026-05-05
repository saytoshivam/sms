import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import type { MeProfile } from './SuperAdminDashboard';
import { TeacherDayScheduleTable, type TimetableOccurrence } from '../../pages/TeacherTimetablePage';
import { WorkspaceHero, WorkspaceSection, WorkspaceTileLink } from '../../components/workspace/WorkspaceKit';

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TeacherDashboard({ profile }: { profile: MeProfile }) {
  const ymd = todayYmd();
  const todaySchedule = useQuery({
    queryKey: ['teacher-schedule-today', ymd],
    queryFn: async () =>
      (
        await api.get<TimetableOccurrence[]>(
          `/api/v1/teacher/timetable?from=${encodeURIComponent(ymd)}&to=${encodeURIComponent(ymd)}`,
        )
      ).data,
    enabled: profile.linkedStaffId != null,
  });

  const todayRows = useMemo(() => {
    const rows = [...(todaySchedule.data ?? [])];
    rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return rows;
  }, [todaySchedule.data]);

  return (
    <div className="workspace-page stack">
      <WorkspaceHero
        eyebrow="Teaching workspace"
        title="Your classes & schedule"
        tag="Teacher"
        subtitle={
          <>
            <strong>{profile.email}</strong> — take attendance, log lectures, and follow your{' '}
            <strong>published</strong> timetable (drafts stay in Operations Hub).
          </>
        }
      />

      <section className="student-tt-section" id="teacher-today-timetable" aria-label="Today’s teaching schedule">
        <div className="student-tt-head">
          <span className="student-tt-title">Today’s schedule</span>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="student-tt-tag" title={profile.schoolName?.trim() || undefined}>
              {profile.schoolName?.trim() || 'Your school'}
            </span>
            <Link to="/app/teacher/timetable" className="muted" style={{ fontSize: 13 }}>
              Full timetable →
            </Link>
          </div>
        </div>
        <div className="student-tt-body">
          {profile.linkedStaffId == null ? (
            <div className="muted student-tt-empty" style={{ fontSize: 14 }}>
              Today’s classes appear when your login is linked to a staff profile. Ask your school admin if this is
              missing.
            </div>
          ) : todaySchedule.isLoading ? (
            <div className="muted">Loading…</div>
          ) : todaySchedule.error ? (
            <div style={{ color: '#b91c1c', fontSize: 14 }}>{formatApiError(todaySchedule.error)}</div>
          ) : todayRows.length === 0 ? (
            <div className="muted student-tt-empty">No classes scheduled for today</div>
          ) : (
            <TeacherDayScheduleTable rows={todayRows} compact ariaLabel="Today’s teaching schedule" />
          )}
        </div>
      </section>

      <WorkspaceSection title="Teaching essentials" hint="Everything you need for day-to-day instruction.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/teacher/class-progress" icon="📊" label="Class progress" />
          <WorkspaceTileLink to="/app/teacher/timetable" icon="🗓" label="My timetable" />
          <WorkspaceTileLink to="/app/attendance" icon="✅" label="Attendance" />
          <WorkspaceTileLink to="/app/lectures" icon="📖" label="Lectures" />
          <WorkspaceTileLink to="/app/students" icon="👥" label="Students" />
        </div>
      </WorkspaceSection>

      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Tip: school leaders see the same tools plus fees and school-wide settings from their dashboard.
      </p>
    </div>
  );
}
