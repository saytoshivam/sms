/**
 * Maps a pathname to its logical parent route.
 * Used by the global back button so it always navigates to a deterministic
 * parent rather than relying on browser history.
 */
export function parentRouteOf(pathname: string): string {
  const p = pathname.replace(/\/$/, '');

  // ── Bulk import pages → parent module ──────────────────────────────────────
  if (p.endsWith('/bulk-import')) return p.replace('/bulk-import', '');

  // ── Student add wizard ─────────────────────────────────────────────────────
  if (p === '/app/students/add') return '/app/students';

  // ── Dynamic sub-pages ──────────────────────────────────────────────────────
  // /app/students/me/performance → student owns this → dashboard
  if (p === '/app/students/me/performance') return '/app/dashboard';

  // /app/students/:id/performance → student profile
  const studPerfMatch = p.match(/^(\/app\/students\/[^/]+)\/performance$/);
  if (studPerfMatch) return studPerfMatch[1];

  // /app/students/:id → students list
  if (/^\/app\/students\/[^/]+$/.test(p)) return '/app/students';

  // /app/teachers/:staffId → teachers list
  if (/^\/app\/teachers\/[^/]+$/.test(p)) return '/app/teachers';

  // /app/admin/schools/:id → schools directory
  if (/^\/app\/admin\/schools\/[^/]+$/.test(p)) return '/app/admin/schools';

  // /app/teacher/classes/:id → teacher's classes list
  if (/^\/app\/teacher\/classes\/[^/]+$/.test(p)) return '/app/teacher/classes';

  // /app/student/results/:termSlug → results list
  if (/^\/app\/student\/results\/[^/]+$/.test(p)) return '/app/student/results';

  // /app/student/announcements/:id → announcements list
  if (/^\/app\/student\/announcements\/[^/]+$/.test(p)) return '/app/student/announcements';

  // ── Timetable sub-pages ────────────────────────────────────────────────────
  if (p === '/app/timetable/rules' || p === '/app/timetable/grid') return '/app/timetable';

  // ── Attendance sub-page ────────────────────────────────────────────────────
  if (p === '/app/attendance/daily-monitor') return '/app/attendance';

  // ── School sub-pages ───────────────────────────────────────────────────────
  if (p === '/app/school/document-requirements') return '/app/school/management';

  // ── Operations Hub modules (school admin facing) ───────────────────────────
  const opsHubModules = [
    '/app/classes-sections',
    '/app/subjects',
    '/app/teachers',
    '/app/rooms',
    '/app/time',
    '/app/timetable',
    '/app/students',
    '/app/attendance',
    '/app/academic',
    '/app/user-access',
    '/app/school/management',
    '/app/school/announcements/new',
    '/app/teacher/announcements/new',
    '/app/fees',
    '/app/lectures',
  ];
  if (opsHubModules.includes(p)) return '/app/operations-hub';

  // ── Student portal feature pages → dashboard ──────────────────────────────
  if (p.startsWith('/app/student/') || p.startsWith('/app/teacher/')) return '/app/dashboard';

  // ── Admin pages → platform home ───────────────────────────────────────────
  if (p.startsWith('/app/admin/')) return '/app';
  if (p === '/app/school-theme') return '/app';

  // ── Default fallback ───────────────────────────────────────────────────────
  return '/app/dashboard';
}

