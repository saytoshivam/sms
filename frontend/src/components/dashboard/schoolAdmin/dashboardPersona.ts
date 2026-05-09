import type { MeProfile } from '../../../modules/dashboards/SuperAdminDashboard';

/**
 * Future role-based dashboard shells (principal vs ops vs finance).
 * Wire persona-specific sections in the shell; keep data hooks shared.
 */
export type SchoolDashboardPersona = 'default' | 'principal' | 'operations' | 'finance' | 'teacher';

export type SchoolAdminDashboardShellProps = {
  profile: MeProfile;
  /** Reserved for role-specific density / section ordering. */
  persona?: SchoolDashboardPersona;
};
