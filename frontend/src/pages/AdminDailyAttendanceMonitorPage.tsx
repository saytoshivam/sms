import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { hasSchoolLeadershipRole } from '../lib/roleGroups';
import type { MeProfile } from '../modules/dashboards/SuperAdminDashboard';
import { AdminDailyAttendanceDashboard, type AdminDailyBoardPayload } from '../components/attendance/AdminDailyAttendanceDashboard';
import '../components/attendance/adminDailyAttendanceDashboard.css';
import { WorkspaceHero } from '../components/workspace/WorkspaceKit';

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * School leadership: live daily homeroom submission compliance (DAILY mode only).
 * Linked from the School workspace Attendance tile when the school uses daily attendance.
 */
export function AdminDailyAttendanceMonitorPage() {
  const ymd = todayYmd();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeProfile>('/user/me')).data,
  });

  const mode = me.data?.schoolAttendanceMode ?? 'LECTURE_WISE';
  const leader = hasSchoolLeadershipRole(me.data?.roles ?? []);

  const dailyBoard = useQuery({
    queryKey: ['attendance-admin-daily-board', ymd],
    queryFn: async () =>
      (await api.get<AdminDailyBoardPayload>(`/api/attendance/admin/daily-board?date=${encodeURIComponent(ymd)}`)).data,
    enabled: me.isSuccess && leader && mode === 'DAILY',
  });

  if (me.isLoading) {
    return <div className="muted" style={{ padding: 24 }}>Loading…</div>;
  }

  if (!leader || mode !== 'DAILY') {
    return <Navigate to="/app/attendance" replace />;
  }

  return (
    <div className="workspace-page stack">
      <WorkspaceHero
        eyebrow="Attendance"
        title="Daily attendance monitor"
        subtitle={
          <>
            Track homeroom roll submission for today. Need to mark or override?{' '}
            <Link to={`/app/attendance?date=${encodeURIComponent(ymd)}`} style={{ fontWeight: 800 }}>
              Open Attendance Console →
            </Link>
          </>
        }
      />

      <div className="card stack" style={{ padding: 16 }}>
        <AdminDailyAttendanceDashboard
          variant="page"
          ymd={ymd}
          data={dailyBoard.data}
          isLoading={dailyBoard.isLoading}
          errorText={dailyBoard.error ? formatApiError(dailyBoard.error) : null}
        />
      </div>
    </div>
  );
}
