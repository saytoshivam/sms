import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ToastViewport } from '../components/ToastViewport';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { hasSchoolLeadershipRole, hasTeachingRole } from '../lib/roleGroups';
import { FeatureArea } from '../lib/featureAreas';
import { DrawerNavSection, DrawerNavSoon } from '../components/DrawerNavSection';
import { SchoolLeaderErpChrome } from '../components/erp/SchoolLeaderErpChrome';
import { ErpWorkspaceChrome } from '../components/erp/ErpWorkspaceChrome';

type MePayload = {
  email: string;
  username: string;
  roles: string[];
  schoolId?: number;
  schoolCode?: string;
  schoolName?: string;
  schoolAttendanceMode?: 'DAILY' | 'LECTURE_WISE';
  linkedStudentId?: number;
  linkedStaffId?: number;
  linkedStudentPhotoUrl?: string | null;
  linkedStudentDisplayName?: string | null;
  linkedStudentAdmissionNo?: string | null;
  linkedStudentClassLabel?: string | null;
  linkedStaffPhotoUrl?: string | null;
  linkedStaffDisplayName?: string | null;
  linkedStaffEmployeeNo?: string | null;
};

function initialsFrom(displayName: string | null | undefined, email: string) {
  const s = (displayName ?? '').trim();
  if (s) {
    const parts = s.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
    return (a + b).toUpperCase() || email.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/** True on /app/* feature routes; hidden on operations hub (/app) and school dashboard (/app/dashboard). */
function shouldShowFeatureBack(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/app' || p === '/app/dashboard') return false;
  return p.startsWith('/app');
}

function FeatureBackRow({ visible }: { visible: boolean }) {
  const navigate = useNavigate();
  if (!visible) return null;
  return (
    <div className="shell-back-banner">
      <button type="button" className="shell-back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>
    </div>
  );
}

export function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shellMenuOpen, setShellMenuOpen] = useState(false);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MePayload>('/user/me')).data,
  });

  const platformOperatorUnread = useQuery({
    queryKey: ['platform-operator-notifications-unread'],
    queryFn: async () =>
      (await api.get<{ count: number }>('/api/v1/platform/operator-notifications/unread-count')).data,
    enabled: me.isSuccess && (me.data?.roles ?? []).includes('SUPER_ADMIN'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    setShellMenuOpen(false);
  }, [location.pathname]);

  const closeMenu = () => setShellMenuOpen(false);

  const roles = me.data?.roles ?? [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isTeacher = hasTeachingRole(roles);
  const isStudent = roles.includes('STUDENT');
  const linkedStudentId = me.data?.linkedStudentId;

  const showStudentPortalNav = isStudent && linkedStudentId != null;

  const superAdminShell =
    me.isSuccess && me.data != null && !showStudentPortalNav && me.data.roles.includes('SUPER_ADMIN');

  const schoolLeaderShell =
    me.isSuccess &&
    me.data != null &&
    !showStudentPortalNav &&
    !isSuperAdmin &&
    hasSchoolLeadershipRole(me.data.roles);

  /** Pure teaching staff (not school leadership): same sidebar shell as admin, different links. */
  const teacherOnlyShell =
    me.isSuccess &&
    me.data != null &&
    !showStudentPortalNav &&
    !superAdminShell &&
    !schoolLeaderShell &&
    hasTeachingRole(me.data.roles);

  const parentOnlyShell =
    me.isSuccess &&
    me.data != null &&
    !showStudentPortalNav &&
    !superAdminShell &&
    !schoolLeaderShell &&
    !hasTeachingRole(me.data.roles) &&
    roles.includes('PARENT');

  const fallbackStaffShell =
    me.isSuccess &&
    me.data != null &&
    !showStudentPortalNav &&
    !superAdminShell &&
    !schoolLeaderShell &&
    !teacherOnlyShell &&
    !parentOnlyShell;

  const platformProfile = useMemo(() => {
    if (!me.data) return null;
    const d = me.data;
    const displayName = d.linkedStaffDisplayName?.trim() || d.username?.trim() || d.email;
    const photoUrl = d.linkedStaffPhotoUrl?.trim() || null;
    return {
      displayName,
      photoUrl,
      subtitle: 'Super admin',
      detail: d.email,
    };
  }, [me.data]);

  const parentProfile = useMemo(() => {
    if (!me.data) return null;
    return {
      displayName: me.data.email,
      photoUrl: null as string | null,
      subtitle: 'Parent',
      detail: me.data.schoolName?.trim() || null,
    };
  }, [me.data]);

  const genericStaffProfile = useMemo(() => {
    if (!me.data) return null;
    const d = me.data;
    const displayName = d.linkedStaffDisplayName?.trim() || d.username?.trim() || d.email;
    const photoUrl = d.linkedStaffPhotoUrl?.trim() || null;
    const subtitle = roles.filter((r) => !['STUDENT', 'PARENT'].includes(r)).join(' · ') || 'Staff';
    return { displayName, photoUrl, subtitle, detail: d.schoolName?.trim() || null };
  }, [me.data, roles]);

  const showFeatureBack = shouldShowFeatureBack(location.pathname);

  return (
    <>
      {superAdminShell && me.data && platformProfile ? (
        <>
          {shellMenuOpen ? (
            <button
              type="button"
              className="student-menu-backdrop"
              aria-label="Close menu"
              onClick={closeMenu}
            />
          ) : null}
          <aside
            className={
              shellMenuOpen ? 'student-menu-drawer student-menu-drawer--open' : 'student-menu-drawer'
            }
          >
            <div className="student-drawer-inner">
              <div className="student-drawer-profile">
                <div className="student-drawer-avatar-wrap">
                  {platformProfile.photoUrl ? (
                    <img src={platformProfile.photoUrl} alt="" className="student-drawer-avatar" />
                  ) : (
                    <div className="student-drawer-avatar student-drawer-avatar--placeholder" aria-hidden>
                      {initialsFrom(platformProfile.displayName, me.data.email)}
                    </div>
                  )}
                </div>
                <div className="student-drawer-name">{platformProfile.displayName}</div>
                <div className="student-drawer-meta">{platformProfile.subtitle}</div>
                <div className="student-drawer-program">{platformProfile.detail}</div>
              </div>
              <nav className="student-drawer-nav">
                <Link className="student-drawer-link" to="/app" onClick={closeMenu}>
                  Dashboard
                </Link>
                <DrawerNavSection title={FeatureArea.USER_ACCESS}>
                  <Link className="student-drawer-link" to="/app/admin/register-school" onClick={closeMenu}>
                    Onboard school
                  </Link>
                  <Link className="student-drawer-link" to="/app/admin/schools" onClick={closeMenu}>
                    Schools directory
                  </Link>
                </DrawerNavSection>
                <DrawerNavSection title={FeatureArea.FEES_FINANCE}>
                  <Link className="student-drawer-link" to="/app/admin/integrations" onClick={closeMenu}>
                    Payment integrations
                  </Link>
                </DrawerNavSection>
                <DrawerNavSection title={FeatureArea.COMMUNICATION}>
                  <Link className="student-drawer-link" to="/app/admin/announcements" onClick={closeMenu}>
                    Platform announcements
                  </Link>
                </DrawerNavSection>
                <DrawerNavSection title={FeatureArea.REPORTS_ANALYTICS}>
                  <Link className="student-drawer-link" to="/app/admin/notifications" onClick={closeMenu}>
                    Operator notifications
                  </Link>
                  <Link className="student-drawer-link" to="/app/admin/audit" onClick={closeMenu}>
                    Audit log
                  </Link>
                </DrawerNavSection>
                <DrawerNavSection title={FeatureArea.SYSTEM_CONFIG}>
                  <Link className="student-drawer-link" to="/app/admin/plans-features" onClick={closeMenu}>
                    Plans & entitlements
                  </Link>
                  <Link className="student-drawer-link" to="/app/admin/feature-catalog" onClick={closeMenu}>
                    Global feature catalog
                  </Link>
                  <Link className="student-drawer-link" to="/app/admin/flags" onClick={closeMenu}>
                    Runtime flags
                  </Link>
                  <Link className="student-drawer-link" to="/app/school-theme" onClick={closeMenu}>
                    School theme (preview)
                  </Link>
                </DrawerNavSection>
              </nav>
              <div className="student-drawer-footer">
                <button
                  type="button"
                  className="student-drawer-logout"
                  onClick={() => {
                    closeMenu();
                    logout();
                    navigate('/login');
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </aside>
          <div className="container container--platform-app">
            <header className="student-m-header">
              <button
                type="button"
                className="student-m-hamburger"
                aria-label="Open menu"
                onClick={() => setShellMenuOpen(true)}
              >
                ☰
              </button>
              <span className="student-m-header-title">MyHaimi platform</span>
              <Link
                to="/app/admin/notifications"
                className="student-m-bell"
                aria-label="Operator notifications"
                title="Operator notifications"
              >
                <span aria-hidden>🔔</span>
                {platformOperatorUnread.data != null && platformOperatorUnread.data.count > 0 ? (
                  <span className="student-m-bell-badge">
                    {platformOperatorUnread.data.count > 99 ? '99+' : platformOperatorUnread.data.count}
                  </span>
                ) : null}
              </Link>
            </header>
            <FeatureBackRow visible={showFeatureBack} />
            <Outlet />
          </div>
        </>
      ) : schoolLeaderShell && me.data ? (
        <SchoolLeaderErpChrome me={me.data} logout={logout} />
      ) : showStudentPortalNav && me.data ? (
        <ErpWorkspaceChrome me={me.data} logout={logout} persona="student" />
      ) : teacherOnlyShell && me.data ? (
        <ErpWorkspaceChrome me={me.data} logout={logout} persona="teacher" />
      ) : parentOnlyShell && me.data && parentProfile ? (
        <>
          {shellMenuOpen ? (
            <button
              type="button"
              className="student-menu-backdrop"
              aria-label="Close menu"
              onClick={closeMenu}
            />
          ) : null}
          <aside
            className={
              shellMenuOpen ? 'student-menu-drawer student-menu-drawer--open' : 'student-menu-drawer'
            }
          >
            <div className="student-drawer-inner">
              <div className="student-drawer-profile">
                <div className="student-drawer-avatar-wrap">
                  <div className="student-drawer-avatar student-drawer-avatar--placeholder" aria-hidden>
                    {initialsFrom(parentProfile.displayName, me.data.email)}
                  </div>
                </div>
                <div className="student-drawer-name">{parentProfile.displayName}</div>
                <div className="student-drawer-meta">{parentProfile.subtitle}</div>
                {parentProfile.detail ? <div className="student-drawer-program">{parentProfile.detail}</div> : null}
              </div>
              <nav className="student-drawer-nav">
                <Link className="student-drawer-link" to="/app" onClick={closeMenu}>
                  Dashboard
                </Link>
                <DrawerNavSection title={FeatureArea.USER_ACCESS}>
                  <DrawerNavSoon text="Attendance, fees, and messaging for your children will appear when your school enables the parent experience." />
                </DrawerNavSection>
              </nav>
              <div className="student-drawer-footer">
                <button
                  type="button"
                  className="student-drawer-logout"
                  onClick={() => {
                    closeMenu();
                    logout();
                    navigate('/login');
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </aside>
          <div className="container container--school-leader-app">
            <header className="student-m-header">
              <button
                type="button"
                className="student-m-hamburger"
                aria-label="Open menu"
                onClick={() => setShellMenuOpen(true)}
              >
                ☰
              </button>
              <span className="student-m-header-title">{me.data.schoolName?.trim() || 'SMS'}</span>
              <span className="student-m-header-spacer" aria-hidden />
            </header>
            <FeatureBackRow visible={showFeatureBack} />
            <Outlet />
          </div>
        </>
      ) : fallbackStaffShell && me.data && genericStaffProfile ? (
        <>
          {shellMenuOpen ? (
            <button
              type="button"
              className="student-menu-backdrop"
              aria-label="Close menu"
              onClick={closeMenu}
            />
          ) : null}
          <aside
            className={
              shellMenuOpen ? 'student-menu-drawer student-menu-drawer--open' : 'student-menu-drawer'
            }
          >
            <div className="student-drawer-inner">
              <div className="student-drawer-profile">
                <div className="student-drawer-avatar-wrap">
                  {genericStaffProfile.photoUrl ? (
                    <img src={genericStaffProfile.photoUrl} alt="" className="student-drawer-avatar" />
                  ) : (
                    <div className="student-drawer-avatar student-drawer-avatar--placeholder" aria-hidden>
                      {initialsFrom(genericStaffProfile.displayName, me.data.email)}
                    </div>
                  )}
                </div>
                <div className="student-drawer-name">{genericStaffProfile.displayName}</div>
                <div className="student-drawer-meta">{genericStaffProfile.subtitle}</div>
                {genericStaffProfile.detail ? (
                  <div className="student-drawer-program">{genericStaffProfile.detail}</div>
                ) : null}
              </div>
              <nav className="student-drawer-nav">
                <Link className="student-drawer-link" to="/app" onClick={closeMenu}>
                  Dashboard
                </Link>
                {roles.includes('ACCOUNTANT') ? (
                  <DrawerNavSection title={FeatureArea.FEES_FINANCE}>
                    <Link className="student-drawer-link" to="/app/fees" onClick={closeMenu}>
                      Fees & invoices
                    </Link>
                  </DrawerNavSection>
                ) : null}
                {roles.some((r) => ['RECEPTIONIST', 'TRANSPORT_MANAGER', 'IT_SUPPORT'].includes(r)) ? (
                  <DrawerNavSection title={FeatureArea.USER_ACCESS}>
                    <DrawerNavSoon text="Additional shortcuts for your role will appear as modules are enabled." />
                  </DrawerNavSection>
                ) : null}
              </nav>
              <div className="student-drawer-footer">
                <button
                  type="button"
                  className="student-drawer-logout"
                  onClick={() => {
                    closeMenu();
                    logout();
                    navigate('/login');
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </aside>
          <div className="container container--school-leader-app">
            <header className="student-m-header">
              <button
                type="button"
                className="student-m-hamburger"
                aria-label="Open menu"
                onClick={() => setShellMenuOpen(true)}
              >
                ☰
              </button>
              <span className="student-m-header-title">{me.data.schoolName?.trim() || 'SMS'}</span>
              <span className="student-m-header-spacer" aria-hidden />
            </header>
            <FeatureBackRow visible={showFeatureBack} />
            <Outlet />
          </div>
        </>
      ) : (
        <div className="container">
          <Outlet />
        </div>
      )}

      <ToastViewport />
    </>
  );
}
