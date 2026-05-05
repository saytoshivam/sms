import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { useAuth } from '../../lib/auth';
import type { MeProfile } from './SuperAdminDashboard';
import { StudentDayScheduleTable } from '../../components/StudentDayScheduleTable';
import type { TimetableOccurrence } from '../../pages/TeacherTimetablePage';
import type { StudentMarkRow } from '../../components/StudentMarksBoard';
import {
  STUDENT_FIXED_TILE_IDS,
  STUDENT_TILE_CATALOG,
  loadStudentTileOrder,
  saveStudentTileOrder,
  type StudentTileId,
} from '../../lib/studentTiles';

type SubjAtt = {
  subjectCode: string;
  subjectName: string;
  presentOrLateDays: number;
  countedDays: number;
  attendancePercent: number;
  attendedSessions?: number;
  deliveredSessions?: number;
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

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function StudentDashboard({ profile }: { profile: MeProfile }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tileOrder, setTileOrder] = useState<StudentTileId[]>(() => loadStudentTileOrder());

  useEffect(() => {
    saveStudentTileOrder(tileOrder);
  }, [tileOrder]);

  const todaySchedule = useQuery({
    queryKey: ['student-schedule-today'],
    queryFn: async () => (await api.get<TimetableOccurrence[]>('/api/v1/student/me/schedule/today')).data,
    enabled: profile.linkedStudentId != null,
  });

  const marks = useQuery({
    queryKey: ['student-marks'],
    queryFn: async () => (await api.get<StudentMarkRow[]>('/api/v1/student/me/marks')).data,
    enabled: profile.linkedStudentId != null,
  });

  const subjAtt = useQuery({
    queryKey: ['student-subject-attendance'],
    queryFn: async () => (await api.get<SubjAtt[]>('/api/v1/student/me/subject-attendance')).data,
    enabled: profile.linkedStudentId != null,
  });

  const unreadAnnouncements = useQuery({
    queryKey: ['student-announcements-unread-count'],
    queryFn: async () => (await api.get<{ count: number }>('/api/v1/student/me/announcements/unread-count')).data,
    enabled: profile.linkedStudentId != null,
    refetchOnWindowFocus: true,
  });

  const attendanceSummary = useMemo(() => {
    const rows = subjAtt.data ?? [];
    if (rows.length === 0) return { avg: 0 };
    let att = 0;
    let del = 0;
    for (const r of rows) {
      att += r.attendedSessions ?? r.presentOrLateDays;
      del += r.deliveredSessions ?? r.countedDays;
    }
    return { avg: del > 0 ? (100 * att) / del : 0 };
  }, [subjAtt.data]);

  const marksAvg = useMemo(() => {
    const rows = marks.data ?? [];
    if (rows.length === 0) return null;
    let sum = 0;
    for (const m of rows) sum += m.scorePercent;
    return (sum / rows.length).toFixed(2);
  }, [marks.data]);

  const todayRowsSorted = useMemo(() => {
    const rows = [...(todaySchedule.data ?? [])];
    rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return rows;
  }, [todaySchedule.data]);

  const removeTile = (id: StudentTileId) => {
    setTileOrder((o) => o.filter((x) => x !== id));
  };

  const addTile = (id: StudentTileId) => {
    setTileOrder((o) => (o.includes(id) ? o : [...o, id]));
    setPickerOpen(false);
  };

  const hiddenTiles = useMemo(
    () => STUDENT_TILE_CATALOG.filter((t) => t.removable && !tileOrder.includes(t.id)),
    [tileOrder],
  );

  const tileBadge = (id: StudentTileId): string | null => {
    if (id === 'announcements') {
      const n = unreadAnnouncements.data?.count ?? 0;
      return n > 0 ? String(Math.min(99, n)) : null;
    }
    if (id === 'attendance') return `${Math.round(attendanceSummary.avg)}%`;
    if (id === 'marks' && marksAvg) return marksAvg;
    return null;
  };

  if (profile.linkedStudentId == null) {
    return (
      <div className="student-mobile-page">
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            This account is not linked to a student record yet. Ask your school admin to link your login to your admission
            profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-mobile-page">
      {menuOpen ? (
        <button
          type="button"
          className="student-menu-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside className={menuOpen ? 'student-menu-drawer student-menu-drawer--open' : 'student-menu-drawer'}>
        <div className="student-drawer-inner">
          <div className="student-drawer-profile">
            <div className="student-drawer-avatar-wrap">
              {profile.linkedStudentPhotoUrl ? (
                <img src={profile.linkedStudentPhotoUrl} alt="" className="student-drawer-avatar" />
              ) : (
                <div className="student-drawer-avatar student-drawer-avatar--placeholder" aria-hidden>
                  {initialsFrom(profile.linkedStudentDisplayName, profile.email)}
                </div>
              )}
            </div>
            <div className="student-drawer-name">{profile.linkedStudentDisplayName ?? profile.email}</div>
            <div className="student-drawer-meta">{profile.linkedStudentAdmissionNo ?? '—'}</div>
            {profile.linkedStudentClassLabel ? (
              <div className="student-drawer-program">{profile.linkedStudentClassLabel}</div>
            ) : null}
          </div>
          <nav className="student-drawer-nav">
            <Link className="student-drawer-link" to="/app/student/announcements" onClick={() => setMenuOpen(false)}>
              Announcements
            </Link>
            <Link className="student-drawer-link" to="/app/student/schedule" onClick={() => setMenuOpen(false)}>
              Schedule
            </Link>
            <Link className="student-drawer-link" to="/app/student/marks" onClick={() => setMenuOpen(false)}>
              View marks
            </Link>
            <Link className="student-drawer-link" to="/app/student/results" onClick={() => setMenuOpen(false)}>
              Results & TGPA
            </Link>
            <Link className="student-drawer-link" to="/app/student/exams" onClick={() => setMenuOpen(false)}>
              Exams available
            </Link>
            <Link className="student-drawer-link" to="/app/student/attendance" onClick={() => setMenuOpen(false)}>
              Attendance (this term)
            </Link>
            <Link className="student-drawer-link" to="/app/students/me/performance" onClick={() => setMenuOpen(false)}>
              Performance charts
            </Link>
            <Link className="student-drawer-link" to="/app/student/fees" onClick={() => setMenuOpen(false)}>
              Fee statement
            </Link>
          </nav>
          <div className="student-drawer-footer">
            <button
              type="button"
              className="student-drawer-logout"
              onClick={() => {
                setMenuOpen(false);
                logout();
                navigate('/login');
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <header className="student-m-header">
        <button type="button" className="student-m-hamburger" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          ☰
        </button>
        <span className="student-m-header-title">Dashboard</span>
        <Link to="/app/student/announcements" className="student-m-bell" aria-label="Unread announcements">
          🔔
          {(unreadAnnouncements.data?.count ?? 0) > 0 ? (
            <span className="student-m-bell-badge">{Math.min(99, unreadAnnouncements.data?.count ?? 0)}</span>
          ) : null}
        </Link>
      </header>

      <section className="student-tt-section" id="student-today-timetable">
        <div className="student-tt-head">
          <span className="student-tt-title">Today’s classes</span>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="student-tt-tag" title={profile.schoolName?.trim() || undefined}>
              {profile.schoolName?.trim() || 'Your school'}
            </span>
            <Link to="/app/student/schedule" className="muted" style={{ fontSize: 13 }}>
              Full schedule →
            </Link>
          </div>
        </div>
        <div className="student-tt-body">
          {todaySchedule.isLoading ? (
            <div className="muted">Loading…</div>
          ) : todaySchedule.error ? (
            <div style={{ color: '#b91c1c', fontSize: 14 }}>{formatApiError(todaySchedule.error)}</div>
          ) : todayRowsSorted.length === 0 ? (
            <div className="muted student-tt-empty">No timetable for today</div>
          ) : (
            <StudentDayScheduleTable
              rows={todayRowsSorted}
              compact
              embedInCard
              ariaLabel="Today’s timetable"
            />
          )}
        </div>
      </section>

      <div className="student-fee-alert" role="status">
        Last date to clear the next term fee — May 31st, 2026. (Demo reminder; your school can post real deadlines in
        announcements.)
      </div>

      <section className="student-fixed-tiles-section" aria-label="Essential shortcuts">
        <div className="student-tile-grid">
          {STUDENT_FIXED_TILE_IDS.map((tid) => {
            const def = STUDENT_TILE_CATALOG.find((t) => t.id === tid);
            if (!def) return null;
            const badge = tileBadge(tid);
            return (
              <div key={tid} className="student-tile-wrap student-tile-wrap--fixed">
                {badge != null ? <span className="student-tile-badge student-tile-badge--solo">{badge}</span> : null}
                <Link to={def.path} className="student-tile">
                  <span className="student-tile-icon">{def.icon}</span>
                  <span className="student-tile-label">{def.label}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="student-tiles-section">
        <div className="student-tiles-head">
          <h2 style={{ margin: 0, fontSize: 16 }}>Your shortcuts</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Tap + to add tiles. Use ✕ on a tile to hide it (you can add it back anytime).
          </p>
        </div>
        <div className="student-tile-grid">
          {tileOrder.map((tid) => {
            const def = STUDENT_TILE_CATALOG.find((t) => t.id === tid);
            if (!def) return null;
            const badge = tileBadge(tid);
            return (
              <div key={tid} className="student-tile-wrap">
                {def.removable ? (
                  <button type="button" className="student-tile-remove" aria-label={`Remove ${def.label}`} onClick={() => removeTile(tid)}>
                    ✕
                  </button>
                ) : null}
                {badge != null ? <span className="student-tile-badge">{badge}</span> : null}
                <Link to={def.path} className="student-tile">
                  <span className="student-tile-icon">{def.icon}</span>
                  <span className="student-tile-label">{def.label}</span>
                </Link>
              </div>
            );
          })}
          <button type="button" className="student-tile student-tile--add" onClick={() => setPickerOpen(true)}>
            <span className="student-tile-icon">＋</span>
            <span className="student-tile-label">Add tile</span>
          </button>
        </div>
      </section>

      {pickerOpen ? (
        <div className="student-picker-overlay" role="dialog" aria-modal>
          <div className="student-picker-card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Add a tile</strong>
              <button type="button" className="btn secondary" onClick={() => setPickerOpen(false)}>
                Close
              </button>
            </div>
            {hiddenTiles.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                All tiles are already on your dashboard.
              </p>
            ) : (
              <ul className="student-picker-list">
                {hiddenTiles.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="student-picker-item" onClick={() => addTile(t.id)}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Today: {todayYmd()} · Signed in as {profile.email}
      </p>
    </div>
  );
}
