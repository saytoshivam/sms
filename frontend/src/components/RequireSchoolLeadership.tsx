import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { hasSchoolLeadershipRole, hasTeachingRole } from '../lib/roleGroups';

type MeLite = { roles: string[] };

/**
 * Timetable editing (workspace, grid, legacy rules) is restricted to school leadership.
 * Pure teachers are redirected to the read-only teacher timetable.
 */
export function RequireSchoolLeadership({ children }: { children: JSX.Element }) {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeLite>('/user/me')).data,
  });

  if (me.isLoading) {
    return <div className="muted" style={{ padding: 24 }}>Loading…</div>;
  }
  if (me.isError || !me.data) {
    return <Navigate to="/app" replace />;
  }

  const roles = me.data.roles ?? [];
  if (roles.includes('SUPER_ADMIN')) {
    return children;
  }
  if (hasSchoolLeadershipRole(roles)) {
    return children;
  }
  if (hasTeachingRole(roles)) {
    return <Navigate to="/app/teacher/timetable" replace />;
  }
  return <Navigate to="/app" replace />;
}
