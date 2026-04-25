import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { hasSchoolLeadershipRole, hasTeachingRole } from '../lib/roleGroups';
import type { MeProfile } from '../modules/dashboards/SuperAdminDashboard';
import { SuperAdminDashboard } from '../modules/dashboards/SuperAdminDashboard';
import { SchoolAdminDashboard } from '../modules/dashboards/SchoolAdminDashboard';
import { TeacherDashboard } from '../modules/dashboards/TeacherDashboard';
import { ParentDashboard } from '../modules/dashboards/ParentDashboard';
import { StudentDashboard } from '../modules/dashboards/StudentDashboard';

function pickDashboard(profile: MeProfile) {
  const roles = profile.roles;
  if (roles.includes('SUPER_ADMIN')) return <SuperAdminDashboard profile={profile} />;
  if (hasSchoolLeadershipRole(roles)) return <SchoolAdminDashboard profile={profile} />;
  if (hasTeachingRole(roles)) return <TeacherDashboard profile={profile} />;
  if (roles.includes('PARENT')) return <ParentDashboard profile={profile} />;
  if (roles.includes('STUDENT')) return <StudentDashboard profile={profile} />;
  return (
    <div className="workspace-page stack">
      <div className="workspace-hero">
        <p className="workspace-hero__eyebrow">Dashboard</p>
        <h1 className="workspace-hero__title">Welcome</h1>
        <p className="workspace-hero__subtitle">
          No specific workspace matched your roles ({roles.join(', ') || 'none'}). Use the navigation menu to open a
          module.
        </p>
      </div>
      <div className="workspace-panel">
        <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
          If you expected a student or teacher home screen, ask your administrator to assign the correct roles to your
          account.
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeProfile>('/user/me')).data,
  });

  if (me.isLoading) {
    return <div className="muted">Loading profile…</div>;
  }
  if (me.isError || !me.data) {
    return <div className="muted">Could not load your profile.</div>;
  }

  return pickDashboard(me.data);
}
