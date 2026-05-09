import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  Cog,
  FileText,
  FolderOpen,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LineChart,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Network,
  PanelLeft,
  PanelLeftClose,
  Presentation,
  Search,
  Settings,
  Settings2,
  Shield,
  Upload,
  Users,
  Wallet,
  Palmtree,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { erpAttendancePath } from '../../lib/erpAttendancePath';
import { hasTeachingRole } from '../../lib/roleGroups';
import { withWorkspaceReadOnly } from '../../lib/workspaceViewMode';
import '../../styles/erpShell.css';

export type ErpMe = {
  email: string;
  schoolName?: string | null;
  schoolAttendanceMode?: 'DAILY' | 'LECTURE_WISE';
  roles: string[];
  linkedStaffDisplayName?: string | null;
  linkedStaffPhotoUrl?: string | null;
  linkedStudentId?: number;
  linkedStudentDisplayName?: string | null;
  linkedStudentPhotoUrl?: string | null;
  linkedStudentAdmissionNo?: string | null;
  linkedStudentClassLabel?: string | null;
};

export type ErpChromePersona = 'leader' | 'teacher' | 'student';

const LS_KEYS: Record<ErpChromePersona, string> = {
  leader: 'erp.schoolLeader.sidebarCollapsed',
  teacher: 'erp.teacher.sidebarCollapsed',
  student: 'erp.student.sidebarCollapsed',
};

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;
  end?: boolean;
  prefix?: string;
};

type NavGroup = { id: string; label: string; items: NavItem[] };

function academicYearChipLabel(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 6) return `AY ${y}–${y + 1}`;
  return `AY ${y - 1}–${y}`;
}

function buildLeaderNavGroups(attendancePath: string, roles: string[]): NavGroup[] {
  const isTeacher = hasTeachingRole(roles);
  return [
    {
      id: 'ws',
      label: 'Workspace',
      items: [
        { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/app/operations-hub', label: 'Operations hub', icon: Cog, prefix: '/app/operations-hub' },
      ],
    },
    {
      id: 'ops',
      label: 'Academics',
      items: [
        { to: attendancePath, label: 'Attendance', icon: ClipboardCheck, prefix: '/app/attendance' },
        {
          to: withWorkspaceReadOnly('/app/timetable?scope=published'),
          label: 'Timetable',
          icon: CalendarRange,
          prefix: '/app/timetable',
        },
        {
          to: withWorkspaceReadOnly('/app/students'),
          label: 'Students',
          icon: Users,
          prefix: '/app/students',
        },
        { to: withWorkspaceReadOnly('/app/teachers'), label: 'Teachers', icon: GraduationCap, prefix: '/app/teachers' },
        { to: withWorkspaceReadOnly('/app/subjects'), label: 'Subjects', icon: BookOpen, prefix: '/app/subjects' },
        { to: withWorkspaceReadOnly('/app/academic'), label: 'Academic structure', icon: Network, prefix: '/app/academic' },
        { to: withWorkspaceReadOnly('/app/fees'), label: 'Fees', icon: IndianRupee, prefix: '/app/fees' },
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
      items: [
        {
          to: '/app/teacher/class-progress',
          label: 'Reports',
          icon: BarChart3,
          prefix: '/app/teacher/class-progress',
        },
      ],
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
}

function buildTeacherNavGroups(attendancePath: string): NavGroup[] {
  return [
    {
      id: 'ws',
      label: 'Workspace',
      items: [
        { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/app/operations-hub', label: 'School hub', icon: Cog, prefix: '/app/operations-hub' },
      ],
    },
    {
      id: 'ops',
      label: 'Academics',
      items: [
        { to: attendancePath, label: 'Attendance', icon: ClipboardCheck, prefix: '/app/attendance' },
        { to: '/app/teacher/timetable', label: 'My timetable', icon: CalendarRange, prefix: '/app/teacher/timetable' },
        { to: '/app/teacher/classes', label: 'My classes', icon: Users, prefix: '/app/teacher/classes' },
        { to: '/app/lectures', label: 'Lectures', icon: Presentation, prefix: '/app/lectures' },
        { to: withWorkspaceReadOnly('/app/students'), label: 'Students', icon: Users, prefix: '/app/students' },
      ],
    },
    {
      id: 'hw',
      label: 'Homework & marks',
      items: [
        { to: '/app/teacher/homework', label: 'Homework', icon: BookOpen, prefix: '/app/teacher/homework' },
        { to: '/app/teacher/assessments', label: 'Assessments', icon: FileText, prefix: '/app/teacher/assessments' },
        {
          to: '/app/teacher/class-progress',
          label: 'Class progress',
          icon: LineChart,
          prefix: '/app/teacher/class-progress',
        },
      ],
    },
    {
      id: 'com',
      label: 'Communication',
      items: [{ to: '/app/teacher/announcements/new', label: 'Class announcement', icon: MessageSquare }],
    },
    {
      id: 'run',
      label: 'Operations',
      items: [
        { to: '/app/teacher/leave', label: 'Leave', icon: Palmtree, prefix: '/app/teacher/leave' },
        { to: '/app/teacher/substitutions', label: 'Substitutions', icon: RefreshCw, prefix: '/app/teacher/substitutions' },
      ],
    },
    {
      id: 'me',
      label: 'Account',
      items: [
        { to: '/app/teacher/documents', label: 'Documents', icon: FolderOpen, prefix: '/app/teacher/documents' },
        { to: '/app/teacher/reports', label: 'Reports', icon: BarChart3, prefix: '/app/teacher/reports' },
        { to: '/app/teacher/notifications', label: 'Notifications', icon: Bell, prefix: '/app/teacher/notifications' },
        { to: '/app/teacher/settings', label: 'Settings', icon: Settings, prefix: '/app/teacher/settings' },
      ],
    },
  ];
}

function buildStudentNavGroups(): NavGroup[] {
  return [
    {
      id: 'ws',
      label: 'Workspace',
      items: [{ to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      id: 'sch',
      label: 'Schedule',
      items: [{ to: '/app/student/schedule', label: 'My schedule', icon: CalendarRange, prefix: '/app/student/schedule' }],
    },
    {
      id: 'gr',
      label: 'Grades & results',
      items: [
        { to: '/app/student/marks', label: 'View marks', icon: FileText, prefix: '/app/student/marks' },
        { to: '/app/student/results', label: 'Results & TGPA', icon: BarChart3, prefix: '/app/student/results' },
        {
          to: '/app/students/me/performance',
          label: 'Performance',
          icon: LineChart,
          prefix: '/app/students/me/performance',
        },
      ],
    },
    {
      id: 'rec',
      label: 'Records',
      items: [
        { to: '/app/student/attendance', label: 'Attendance', icon: ClipboardCheck, prefix: '/app/student/attendance' },
        { to: '/app/student/exams', label: 'Exams', icon: BookOpen, prefix: '/app/student/exams' },
      ],
    },
    {
      id: 'schl',
      label: 'School',
      items: [
        { to: '/app/student/announcements', label: 'Circulars', icon: Megaphone, prefix: '/app/student/announcements' },
        { to: '/app/student/fees', label: 'Fees', icon: Wallet, prefix: '/app/student/fees' },
      ],
    },
  ];
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

type QuickChip = { label: string; to: string };

function leaderQuickChips(attendancePath: string): QuickChip[] {
  return [
    { label: '+ Attendance', to: attendancePath },
    { label: '+ Circular', to: '/app/school/announcements/new' },
    { label: '+ Lecture', to: '/app/lectures' },
    { label: '+ Receipt', to: '/app/fees' },
  ];
}

function teacherQuickChips(attendancePath: string): QuickChip[] {
  return [
    { label: '+ Attendance', to: attendancePath },
    { label: '+ Post', to: '/app/teacher/announcements/new' },
    { label: '+ Classes', to: '/app/teacher/classes' },
    { label: '+ Timetable', to: '/app/teacher/timetable' },
  ];
}

function studentQuickChips(): QuickChip[] {
  return [
    { label: '+ Schedule', to: '/app/student/schedule' },
    { label: '+ Circulars', to: '/app/student/announcements' },
    { label: '+ Marks', to: '/app/student/marks' },
    { label: '+ Fees', to: '/app/student/fees' },
  ];
}

export function ErpWorkspaceChrome({
  me,
  logout,
  persona,
}: {
  me: ErpMe;
  logout: () => void;
  persona: ErpChromePersona;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const lsKey = LS_KEYS[persona];
  const [collapsed, setCollapsed] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(lsKey) === '1' : false,
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(lsKey, collapsed ? '1' : '0');
  }, [collapsed, lsKey]);

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
  const groups =
    persona === 'leader'
      ? buildLeaderNavGroups(attendancePath, me.roles)
      : persona === 'teacher'
        ? buildTeacherNavGroups(attendancePath)
        : buildStudentNavGroups();
  const chips =
    persona === 'leader'
      ? leaderQuickChips(attendancePath)
      : persona === 'teacher'
        ? teacherQuickChips(attendancePath)
        : studentQuickChips();

  const displayName =
    persona === 'student'
      ? me.linkedStudentDisplayName?.trim() || me.email
      : me.linkedStaffDisplayName?.trim() || me.email;
  const photoUrl =
    persona === 'student'
      ? me.linkedStudentPhotoUrl?.trim() || null
      : me.linkedStaffPhotoUrl?.trim() || null;

  const unreadAnnouncements = useQuery({
    queryKey: ['student-announcements-unread-count'],
    queryFn: async () => (await api.get<{ count: number }>('/api/v1/student/me/announcements/unread-count')).data,
    enabled: persona === 'student' && me.linkedStudentId != null,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const onLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const schoolInitial = ((me.schoolName ?? '').trim().charAt(0) || 'S').toUpperCase();

  const brandSub =
    persona === 'student'
      ? 'Student portal'
      : persona === 'teacher'
        ? 'Teacher workspace'
        : 'Workspace';

  const searchPlaceholder =
    persona === 'student'
      ? 'Search circulars, schedule, marks…'
      : persona === 'teacher'
        ? 'Search classes, students, timetable…'
        : 'Search students, staff, classes, invoices…';

  const showThemeInMenu = persona === 'leader' || persona === 'teacher';

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
            <div className="erp-sl-brand-sub">{brandSub}</div>
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
            <input readOnly placeholder={searchPlaceholder} title="Preview — directory search coming" />
          </label>

          <div className="erp-sl-toolbar">
            <span className="erp-sl-year" title="Academic year badge">
              {academicYearChipLabel()}
            </span>
            {chips.map((c) => (
              <Link key={c.to + c.label} className="erp-sl-chip-btn" to={c.to}>
                {c.label}
              </Link>
            ))}
            {persona === 'student' ? (
              <Link
                to="/app/student/announcements"
                className="erp-sl-icon-btn"
                aria-label="Announcements"
                title="Circulars"
                style={{ textDecoration: 'none', position: 'relative' }}
              >
                <Bell size={18} />
                {(unreadAnnouncements.data?.count ?? 0) > 0 ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 999,
                      background: 'var(--color-primary)',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {Math.min(99, unreadAnnouncements.data?.count ?? 0)}
                  </span>
                ) : null}
              </Link>
            ) : (
              <button type="button" className="erp-sl-icon-btn" aria-label="Notifications (preview)" title="No notifications yet">
                <Bell size={18} />
              </button>
            )}
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
                  {showThemeInMenu ? (
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
                  ) : null}
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
                  <div style={{ fontSize: 10, color: '#94a3b8', padding: '6px 10px 2px' }}>
                    {persona === 'student' ? 'Linked guardian accounts · coming soon' : 'School switcher · coming soon'}
                  </div>
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
