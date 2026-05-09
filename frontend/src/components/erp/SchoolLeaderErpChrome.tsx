import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ComponentType } from 'react';
import {
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Bell,
  GraduationCap,
  PanelLeftClose,
  PanelLeft,
  Search,
  Upload,
  Megaphone,
  MessageSquare,
  BarChart3,
  Settings2,
  Shield,
  Users,
  CalendarRange,
  ClipboardCheck,
  Cog,
} from 'lucide-react';
import { erpAttendancePath } from '../../lib/erpAttendancePath';
import { hasTeachingRole } from '../../lib/roleGroups';
import '../../styles/erpShell.css';

type Me = {
  email: string;
  schoolName?: string | null;
  schoolAttendanceMode?: 'DAILY' | 'LECTURE_WISE';
  roles: string[];
  linkedStaffDisplayName?: string | null;
  linkedStaffPhotoUrl?: string | null;
};

function initialsFrom(name: string | null | undefined, email: string) {
  const s = (name ?? '').trim();
  if (s) {
    const parts = s.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
    return (a + b).toUpperCase() || email.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const LS_KEY = 'erp.schoolLeader.sidebarCollapsed';

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;
  end?: boolean;
  prefix?: string;
};

type NavGroup = { id: string; label: string; items: NavItem[] };

function buildNavGroups(
  attendancePath: string,
  isTeacher: boolean,
): NavGroup[] {
  const g: NavGroup[] = [
    {
      id: 'ws',
      label: 'Workspace',
      items: [
        { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/app', label: 'Operations hub', icon: Cog, end: true },
      ],
    },
    {
      id: 'ops',
      label: 'Academics',
      items: [
        { to: attendancePath, label: 'Attendance', icon: ClipboardCheck, prefix: '/app/attendance' },
        { to: '/app/timetable', label: 'Timetable', icon: CalendarRange, prefix: '/app/timetable' },
        { to: '/app/students', label: 'Students', icon: Users, prefix: '/app/students' },
        { to: '/app/teachers', label: 'Teachers', icon: GraduationCap, prefix: '/app/teachers' },
        { to: '/app/academic', label: 'Academic structure', icon: Network, prefix: '/app/academic' },
        { to: '/app/fees', label: 'Fees', icon: IndianRupee, prefix: '/app/fees' },
      ],
    },
    {
      id: 'com',
      label: 'Communication',
      items: [
        { to: '/app/school/announcements/new', label: 'Circulars', icon: Megaphone },
        ...(isTeacher
          ? [{ to: '/app/teacher/announcements/new', label: 'Class announcements', icon: MessageSquare } as NavItem]
          : []),
      ],
    },
    {
      id: 'ins',
      label: 'Insights',
      items: [{ to: '/app/teacher/class-progress', label: 'Reports', icon: BarChart3, prefix: '/app/teacher/class-progress' }],
    },
    {
      id: 'sys',
      label: 'System',
      items: [
        { to: '/app/school/management', label: 'Settings', icon: Settings2, prefix: '/app/school/management' },
        { to: '/app/onboarding', label: 'Imports', icon: Upload, prefix: '/app/onboarding' },
        { to: '/app/user-access', label: 'Access', icon: Shield, prefix: '/app/user-access' },
      ],
    },
  ];
  return g;
}

function navActive(pathname: string, item: NavItem): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  const target = item.to.replace(/\/$/, '') || '/';
  if (item.end) return p === target;
  if (item.prefix) return pathname.startsWith(item.prefix);
  return p === target || pathname.startsWith(`${target}/`);
}

function shouldShowFeatureBack(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/app' || p === '/app/dashboard') return false;
  return p.startsWith('/app');
}

function ErpFeatureBackRow() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const visible = shouldShowFeatureBack(pathname);
  if (!visible) return null;
  return (
    <div className="shell-back-banner">
      <button type="button" className="shell-back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>
    </div>
  );
}

export function SchoolLeaderErpChrome({
  me,
  logout,
}: {
  me: Me;
  logout: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) === '1' : false,
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.erp-sl-user-wrap')) setUserMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const attendancePath = erpAttendancePath(me.roles, me.schoolAttendanceMode);
  const isTeacher = hasTeachingRole(me.roles);
  const groups = buildNavGroups(attendancePath, isTeacher);

  const displayName = me.linkedStaffDisplayName?.trim() || me.email;
  const photoUrl = me.linkedStaffPhotoUrl?.trim() || null;

  const onLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const schoolInitial = ((me.schoolName ?? '').trim().charAt(0) || 'S').toUpperCase();

  return (
    <div className="erp-sl-root">
      <div
        className={mobileOpen ? 'erp-sl-backdrop erp-sl-backdrop--open' : 'erp-sl-backdrop'}
        aria-hidden
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`erp-sl-sidebar erp-sl-sidebar--overlay ${collapsed ? 'erp-sl-sidebar--collapsed' : ''} ${mobileOpen ? 'erp-sl-sidebar--open' : ''}`}
      >
        <div className="erp-sl-brand">
          <div className="erp-sl-brand-mark" aria-hidden>
            {schoolInitial}
          </div>
          <div className="erp-sl-brand-text">
            <div className="erp-sl-brand-name">{me.schoolName?.trim() || 'School'}</div>
            <div className="erp-sl-brand-sub">Workspace</div>
          </div>
          <button
            type="button"
            className="erp-sl-collapse-btn"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="erp-sl-nav" aria-label="Workspace">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="erp-sl-section-label">{group.label}</div>
              {group.items.map((item) => {
                if (item.to === '#') {
                  return (
                    <div
                      key={item.label}
                      className="erp-sl-link"
                      style={{ opacity: 0.45, cursor: 'not-allowed' }}
                      title="Coming soon"
                    >
                      <item.icon size={17} strokeWidth={2} aria-hidden />
                      <span>{item.label}</span>
                    </div>
                  );
                }
                const Icon = item.icon;
                const active = navActive(pathname, item);
                return (
                  <NavLink
                    key={`${group.id}-${item.to}`}
                    to={item.to}
                    end={item.end ?? false}
                    className={() => `erp-sl-link ${active ? 'erp-sl-link--active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={17} strokeWidth={2} aria-hidden />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="erp-sl-footer">
          <button type="button" className="erp-sl-logout" onClick={onLogout} title="Log out">
            <LogOut size={14} style={{ verticalAlign: 'middle', marginRight: collapsed ? 0 : 6 }} aria-hidden />
            {!collapsed ? 'Log out' : ''}
          </button>
        </div>
      </aside>

      <div className="erp-sl-main">
        <header className="erp-sl-topbar">
          <button type="button" className="erp-sl-topbar__menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>

          <label className="erp-sl-search">
            <Search size={16} aria-hidden style={{ flexShrink: 0, opacity: 0.55 }} />
            <input readOnly placeholder="Search students, staff, classes, invoices…" title="Preview — directory search coming" />
          </label>

          <div className="erp-sl-toolbar">
            <span className="erp-sl-year" title="Configure academic years in school settings">
              AY 2026–27
            </span>
            <Link className="erp-sl-chip-btn" to={attendancePath}>
              + Attendance
            </Link>
            <Link className="erp-sl-chip-btn" to="/app/school/announcements/new">
              + Circular
            </Link>
            <Link className="erp-sl-chip-btn" to="/app/lectures">
              + Lecture
            </Link>
            <Link className="erp-sl-chip-btn" to="/app/fees">
              + Receipt
            </Link>
            <button type="button" className="erp-sl-icon-btn" aria-label="Notifications (preview)" title="No notifications yet">
              <Bell size={18} />
            </button>
            <div className="erp-sl-user-wrap" style={{ position: 'relative' }}>
              <button
                type="button"
                className="erp-sl-user"
                aria-expanded={userMenuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen((o) => !o);
                }}
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" width={30} height={30} style={{ borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <span className="erp-sl-user-avatar">{initialsFrom(displayName, me.email)}</span>
                )}
                <div className="erp-sl-user-meta">
                  <div className="erp-sl-user-name">{displayName}</div>
                  <div className="erp-sl-user-email">{me.email}</div>
                </div>
              </button>
              {userMenuOpen ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    minWidth: 180,
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid rgba(15,23,42,0.08)',
                    background: '#fff',
                    boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
                    zIndex: 60,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: 8,
                    }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/app/school-theme');
                    }}
                  >
                    Theme & branding
                  </button>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: 8,
                      color: '#b91c1c',
                    }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                  >
                    Log out
                  </button>
                  <div style={{ fontSize: 10, color: '#94a3b8', padding: '6px 10px 2px' }}>School switcher · coming soon</div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="erp-sl-outlet container--school-leader-app">
          <ErpFeatureBackRow />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
