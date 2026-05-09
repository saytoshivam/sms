import type { MeProfile } from './SuperAdminDashboard';
import { SchoolAdminCommandCenter } from '../../components/dashboard/SchoolAdminCommandCenter';
import { SchoolAdminWorkspaceHeader } from '../../components/dashboard/SchoolAdminWorkspaceHeader';
import { useSchoolAdminOperationalData } from '../../components/dashboard/schoolAdmin/useSchoolAdminOperationalData';
import '../../styles/erpDashboard.css';

export function SchoolAdminDashboard({ profile }: { profile: MeProfile }) {
  const op = useSchoolAdminOperationalData(profile);

  return (
    <div className="workspace-page stack school-admin-erp erp-dash-shell">
      <SchoolAdminWorkspaceHeader profile={profile} op={op} />

      <SchoolAdminCommandCenter profile={profile} op={op} />

      <p className="muted erp-dash-footer-meta" style={{ margin: 0 }}>
        Signed in as {profile.email}
      </p>
    </div>
  );
}
