import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import type { MeProfile } from './SuperAdminDashboard';
import { hasSchoolLeadershipRole } from '../../lib/roleGroups';
import type { TimetableOccurrence } from '../../pages/TeacherTimetablePage';
import type { StudentProgressRow } from '../../pages/ClassProgressPage';
import './teacherDashboard.css';

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t: string): number {
  const s = t.slice(0, 5);
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function formatTimeShort(t: string): string {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function academicYearLabel(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 6) return `${y}–${String(y + 1).slice(-2)}`;
  return `${y - 1}–${String(y).slice(-2)}`;
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type TeacherAttendanceContext = {
  mode: 'DAILY' | 'LECTURE_WISE';
  dailySections: Array<{
    classGroupId: number;
    displayName: string;
    pendingAttendance: boolean;
    sessionId: number | null;
    locked: boolean;
  }>;
  lectureSlots: Array<{
    classGroupId: number;
    classGroupDisplayName: string;
    lectureRowId: number;
    subject: string;
    startTime: string;
    endTime: string;
    markingWindowOpenNow: boolean;
    canOperateThisSlot: boolean;
    sessionId: number | null;
    locked: boolean;
  }>;
};

type FeedItem = { kind: 'free'; start: string; end: string } | { kind: 'class'; row: TimetableOccurrence };

function buildFeed(rows: TimetableOccurrence[]): FeedItem[] {
  const sorted = [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const out: FeedItem[] = [];
  const gapMin = 12;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = timeToMinutes(sorted[i].startTime) - timeToMinutes(sorted[i - 1].endTime);
      if (gap >= gapMin) {
        out.push({ kind: 'free', start: sorted[i - 1].endTime, end: sorted[i].startTime });
      }
    }
    out.push({ kind: 'class', row: sorted[i] });
  }
  return out;
}

function findLectureSlot(ctx: TeacherAttendanceContext | undefined, row: TimetableOccurrence) {
  if (!ctx || ctx.mode !== 'LECTURE_WISE') return undefined;
  const byIds = ctx.lectureSlots.find(
    (s) =>
      row.classGroupId != null &&
      row.lectureRowId != null &&
      s.classGroupId === row.classGroupId &&
      s.lectureRowId === row.lectureRowId,
  );
  if (byIds) return byIds;
  return ctx.lectureSlots.find(
    (s) =>
      s.startTime.slice(0, 5) === row.startTime.slice(0, 5) &&
      s.classGroupDisplayName === row.classGroupDisplayName,
  );
}

function attendanceHrefForRow(ymd: string, row: TimetableOccurrence): string {
  if (row.classGroupId != null && row.lectureRowId != null) {
    return `/app/attendance?date=${encodeURIComponent(ymd)}&classGroupId=${row.classGroupId}&lectureId=${row.lectureRowId}`;
  }
  return `/app/attendance?date=${encodeURIComponent(ymd)}`;
}

function pendingAttendanceCount(ctx: TeacherAttendanceContext | undefined): number {
  if (!ctx) return 0;
  if (ctx.mode === 'DAILY') {
    return ctx.dailySections.filter((s) => s.pendingAttendance && !s.locked).length;
  }
  return ctx.lectureSlots.filter((s) => !s.locked).length;
}

function classWorkspaceOrList(row: TimetableOccurrence | undefined | null): string {
  const id = row?.classGroupId;
  if (id != null && Number.isFinite(Number(id))) return `/app/teacher/classes/${id}`;
  return '/app/teacher/classes';
}

function aggregateLowAttendance(rows: StudentProgressRow[]): { name: string; pct: number } | null {
  const byClass = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = r.classGroupName?.trim();
    if (!k) continue;
    const x = byClass.get(k) ?? { sum: 0, n: 0 };
    x.sum += r.attendancePercentSinceJoin;
    x.n += 1;
    byClass.set(k, x);
  }
  let worst: { name: string; pct: number } | null = null;
  for (const [name, { sum, n }] of byClass) {
    if (n === 0) continue;
    const pct = sum / n;
    if (!worst || pct < worst.pct) worst = { name, pct };
  }
  return worst;
}

export function TeacherDashboard({ profile }: { profile: MeProfile }) {
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((n) => n + 1), 45_000);
    return () => window.clearInterval(id);
  }, []);

  const ymd = todayYmd();
  const mode = profile.schoolAttendanceMode ?? 'LECTURE_WISE';
  const isLeader = hasSchoolLeadershipRole(profile.roles ?? []);
  const displayName =
    profile.linkedStaffDisplayName?.trim() || profile.username?.trim() || profile.email.split('@')[0] || 'Teacher';

  const todaySchedule = useQuery({
    queryKey: ['teacher-schedule-today', ymd],
    queryFn: async () =>
      (
        await api.get<TimetableOccurrence[]>(
          `/api/v1/teacher/timetable?from=${encodeURIComponent(ymd)}&to=${encodeURIComponent(ymd)}`,
        )
      ).data,
    enabled: profile.linkedStaffId != null || isLeader,
  });

  const attendanceCtx = useQuery({
    queryKey: ['teacher-attendance-context', ymd, mode],
    queryFn: async () =>
      (await api.get<TeacherAttendanceContext>(`/api/attendance/teacher/context?date=${encodeURIComponent(ymd)}`)).data,
  });

  const progress = useQuery({
    queryKey: ['teacher-class-progress'],
    queryFn: async () => (await api.get<StudentProgressRow[]>('/api/v1/teacher/students/progress')).data,
  });

  const todayRows = useMemo(() => {
    const rows = [...(todaySchedule.data ?? [])];
    rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return rows;
  }, [todaySchedule.data]);

  const feed = useMemo(() => buildFeed(todayRows), [todayRows]);

  /** Recomputed each render so “now / next” stays accurate without a ticking dependency. */
  const operational = (() => {
    const nowM = nowMinutes();
    const rows = todayRows;

    let currentRow: TimetableOccurrence | null = null;
    let inFree = false;
    for (const item of feed) {
      if (item.kind === 'class') {
        const a = timeToMinutes(item.row.startTime);
        const b = timeToMinutes(item.row.endTime);
        if (nowM >= a && nowM < b) {
          currentRow = item.row;
          break;
        }
      } else {
        const a = timeToMinutes(item.start);
        const b = timeToMinutes(item.end);
        if (nowM >= a && nowM < b) {
          inFree = true;
          break;
        }
      }
    }

    let beforeDay = false;
    let afterDay = false;
    if (!currentRow && !inFree && rows.length > 0) {
      const firstStart = timeToMinutes(rows[0].startTime);
      const lastEnd = timeToMinutes(rows[rows.length - 1].endTime);
      if (nowM < firstStart) beforeDay = true;
      else if (nowM >= lastEnd) afterDay = true;
    }

    const nextRow = (() => {
      if (currentRow) {
        const idx = rows.indexOf(currentRow);
        return idx >= 0 ? rows[idx + 1] ?? null : null;
      }
      if (inFree || beforeDay || (!afterDay && rows.length)) {
        for (const r of rows) {
          if (timeToMinutes(r.startTime) > nowM) return r;
        }
      }
      return null;
    })();

    return { currentRow, inFree, beforeDay, afterDay, nextRow, nowM };
  })();

  const primaryAttendance = useMemo(() => {
    const ctx = attendanceCtx.data;
    if (!ctx) return { label: 'Take attendance', detail: '', to: `/app/attendance?date=${ymd}` };
    if (ctx.mode === 'DAILY') {
      const firstPending = ctx.dailySections.find((s) => s.pendingAttendance && !s.locked);
      const to = firstPending
        ? `/app/attendance?date=${encodeURIComponent(ymd)}&classGroupId=${firstPending.classGroupId}`
        : `/app/attendance?date=${encodeURIComponent(ymd)}`;
      const detail =
        firstPending != null
          ? `${firstPending.displayName} · Daily attendance pending`
          : ctx.dailySections.some((s) => !s.locked)
            ? 'Complete remaining sections'
            : 'All caught up for today';
      return { label: 'Take attendance', detail, to };
    }
    const current = ctx.lectureSlots.find((s) => s.markingWindowOpenNow && s.canOperateThisSlot && !s.locked);
    if (current) {
      return {
        label: 'Take attendance',
        detail: `${current.classGroupDisplayName} · ${current.subject} · ${current.startTime.slice(0, 5)}–${current.endTime.slice(0, 5)}`,
        to: `/app/attendance?date=${encodeURIComponent(ymd)}&classGroupId=${current.classGroupId}&lectureId=${current.lectureRowId}`,
      };
    }
    const nextPending = ctx.lectureSlots.find((s) => !s.locked);
    if (nextPending) {
      return {
        label: 'Take attendance',
        detail: `${nextPending.classGroupDisplayName} · ${nextPending.subject}`,
        to: `/app/attendance?date=${encodeURIComponent(ymd)}&classGroupId=${nextPending.classGroupId}&lectureId=${nextPending.lectureRowId}`,
      };
    }
    return {
      label: 'Attendance',
      detail: 'No pending slots right now',
      to: `/app/attendance?date=${encodeURIComponent(ymd)}`,
    };
  }, [attendanceCtx.data, ymd]);

  const pendingCount = pendingAttendanceCount(attendanceCtx.data);

  const heroNextLine = useMemo(() => {
    const n = operational.nextRow;
    if (!n) return null;
    return `${n.classGroupDisplayName} · ${n.subject} · ${formatTimeShort(n.startTime)}`;
  }, [operational.nextRow]);

  const openCurrentClassTo = operational.currentRow
    ? classWorkspaceOrList(operational.currentRow)
    : '/app/teacher/classes';

  const lowAtt = useMemo(() => aggregateLowAttendance(progress.data ?? []), [progress.data]);

  const derivedAlerts = useMemo(() => {
    const lines: string[] = [];
    const ctx = attendanceCtx.data;
    if (mode === 'LECTURE_WISE' && ctx) {
      for (const s of ctx.lectureSlots) {
        if (s.markingWindowOpenNow && s.canOperateThisSlot && !s.locked) {
          lines.push(`Attendance window — ${s.classGroupDisplayName} · ${s.subject} (${formatTimeShort(s.startTime)})`);
        }
      }
    }
    if (mode === 'DAILY' && ctx) {
      for (const s of ctx.dailySections) {
        if (s.pendingAttendance && !s.locked) {
          lines.push(`Daily roll pending — ${s.displayName}`);
        }
      }
    }
    return lines.slice(0, 4);
  }, [attendanceCtx.data, mode]);

  const insightsHomework = useMemo(() => {
    const rows = progress.data ?? [];
    const lowMarks = rows.filter((r) => r.marksCountSinceJoin === 0).length;
    return lowMarks;
  }, [progress.data]);

  const staffMissing = profile.linkedStaffId == null && !isLeader;

  return (
    <div className="workspace-page tdash tdash--erp">
      {/* 1. Compact hero */}
      <header className="tdash-hero">
        <div>
          <p className="tdash-greet">
            {greetingWord()}, {displayName}
          </p>
          <p className="tdash-hero-metrics">
            <span>
              <strong>{todayRows.length}</strong> lecture{todayRows.length === 1 ? '' : 's'} today
            </span>
            <span>
              <strong>{pendingCount}</strong> attendance pending
            </span>
          </p>
          {heroNextLine ? (
            <p className="tdash-hero-next">
              <strong>Next class:</strong> {heroNextLine}
            </p>
          ) : (
            <p className="tdash-hero-next">
              <strong>Next class:</strong> <span className="tdash-muted" style={{ display: 'inline' }}>—</span>
            </p>
          )}
        </div>
        <div className="tdash-hero-aside">
          <span className="tdash-pill">Teacher</span>
          <span className="tdash-meta-line">AY {academicYearLabel()}</span>
          {profile.schoolName ? (
            <span className="tdash-meta-line" title={profile.schoolName}>
              {profile.schoolName.length > 28 ? `${profile.schoolName.slice(0, 26)}…` : profile.schoolName}
            </span>
          ) : null}
          <span className="tdash-sync">
            <span className="tdash-sync-dot" aria-hidden />
            Live schedule
          </span>
        </div>
      </header>

      {/* 2. Quick actions */}
      <div className="tdash-actions" role="toolbar" aria-label="Quick teaching actions">
        <Link className="tdash-action tdash-action--primary" to={primaryAttendance.to}>
          Take attendance
        </Link>
        <Link className="tdash-action" to={openCurrentClassTo}>
          Open current class
        </Link>
        <Link className="tdash-action" to="/app/lectures">
          Homework
        </Link>
        <Link className="tdash-action" to="/app/teacher/announcements/new">
          Announcement
        </Link>
        <Link className="tdash-action" to="/app/lectures">
          Notes
        </Link>
      </div>

      {/* 3. Now / Next */}
      <div className="tdash-now-next">
        <div className="tdash-nn-card">
          <div className="tdash-nn-label">Now</div>
          {staffMissing ? (
            <>
              <div className="tdash-nn-status">Setup required</div>
              <div className="tdash-nn-main">Link your staff profile</div>
              <div className="tdash-nn-sub">Ask admin to attach your login to a teacher record.</div>
            </>
          ) : operational.currentRow ? (
            <>
              <div className="tdash-nn-status">In session</div>
              <div className="tdash-nn-main">
                {operational.currentRow.classGroupDisplayName} · {operational.currentRow.subject}
              </div>
              <div className="tdash-nn-sub">
                {operational.currentRow.room?.trim() ? operational.currentRow.room : 'Room TBD'} ·{' '}
                {operational.currentRow.startTime.slice(0, 5)}–{operational.currentRow.endTime.slice(0, 5)}
              </div>
              <Link className="tdash-nn-btn" to={classWorkspaceOrList(operational.currentRow)}>
                Open class
              </Link>
            </>
          ) : operational.inFree ? (
            <>
              <div className="tdash-nn-status">Between classes</div>
              <div className="tdash-nn-main">Free period</div>
              <div className="tdash-nn-sub">Use this window for prep or outreach.</div>
            </>
          ) : operational.beforeDay ? (
            <>
              <div className="tdash-nn-status">Before school day</div>
              <div className="tdash-nn-main">Classes haven&apos;t started</div>
              <div className="tdash-nn-sub">
                First block {todayRows[0] ? formatTimeShort(todayRows[0].startTime) : ''}
              </div>
            </>
          ) : operational.afterDay ? (
            <>
              <div className="tdash-nn-status">Day complete</div>
              <div className="tdash-nn-main">No further teaching blocks</div>
              <div className="tdash-nn-sub">Review attendance &amp; notes for tomorrow.</div>
            </>
          ) : todayRows.length === 0 ? (
            <>
              <div className="tdash-nn-status">Schedule</div>
              <div className="tdash-nn-main">No classes today</div>
              <div className="tdash-nn-sub">Published timetable may be empty for this date.</div>
            </>
          ) : (
            <>
              <div className="tdash-nn-status">Standby</div>
              <div className="tdash-nn-main">Waiting for next block</div>
              <div className="tdash-nn-sub">Your timeline below lists what&apos;s ahead.</div>
            </>
          )}
        </div>

        <div className="tdash-nn-card">
          <div className="tdash-nn-label">Next</div>
          {operational.nextRow ? (
            <>
              <div className="tdash-nn-status">{formatTimeShort(operational.nextRow.startTime)}</div>
              <div className="tdash-nn-main">
                {operational.nextRow.classGroupDisplayName} · {operational.nextRow.subject}
              </div>
              <div className="tdash-nn-sub">
                {operational.nextRow.room?.trim() ? operational.nextRow.room : 'Room TBD'}
              </div>
              <Link
                className="tdash-nn-btn"
                to={attendanceHrefForRow(ymd, operational.nextRow)}
              >
                Open attendance
              </Link>
            </>
          ) : (
            <>
              <div className="tdash-nn-status">—</div>
              <div className="tdash-nn-main">Nothing queued</div>
              <div className="tdash-nn-sub">You&apos;re clear after your last block.</div>
            </>
          )}
        </div>
      </div>

      {/* 4. Pending attendance (compact) */}
      <div className="tdash-att">
        <div className="tdash-att-head">
          <span className="tdash-att-title">Attendance pending</span>
          <span className="tdash-muted" style={{ fontSize: 10 }}>
            {mode === 'DAILY' ? 'Daily' : 'Period'} mode
          </span>
        </div>
        <div className="tdash-att-body">
          <strong>{primaryAttendance.detail || 'Review today’s sheets'}</strong>
        </div>
        <Link className="tdash-att-btn" to={primaryAttendance.to}>
          {primaryAttendance.label}
        </Link>
        {attendanceCtx.error ? <div className="tdash-err">{formatApiError(attendanceCtx.error)}</div> : null}
      </div>

      {/* 5. Today timeline */}
      <div>
        <div className="tdash-section-h">
          <span className="tdash-section-title">Today&apos;s timeline</span>
          <Link className="tdash-section-link" to="/app/teacher/timetable">
            Full timetable →
          </Link>
        </div>
        {staffMissing ? (
          <p className="tdash-muted">Connect your staff profile to load today&apos;s blocks.</p>
        ) : todaySchedule.isLoading ? (
          <p className="tdash-muted">Loading schedule…</p>
        ) : todaySchedule.error ? (
          <div className="tdash-err">{formatApiError(todaySchedule.error)}</div>
        ) : feed.length === 0 ? (
          <p className="tdash-muted">No published slots for today.</p>
        ) : (
          <div className="tdash-feed">
            {feed.map((item, idx) => {
              const nowM = nowMinutes();
              if (item.kind === 'free') {
                const rowCls =
                  nowM >= timeToMinutes(item.start) && nowM < timeToMinutes(item.end)
                    ? 'tdash-feed-row tdash-feed-row--free tdash-feed-row--now'
                    : 'tdash-feed-row tdash-feed-row--free';
                return (
                  <div key={`free-${idx}-${item.start}`} className={rowCls}>
                    <div className="tdash-feed-time">{formatTimeShort(item.start)}</div>
                    <div className="tdash-feed-core">
                      <div className="tdash-feed-line1">Free period</div>
                      <div className="tdash-feed-line2">
                        Until {formatTimeShort(item.end)} · Prep / coaching / admin
                      </div>
                    </div>
                    <div className="tdash-feed-actions" />
                  </div>
                );
              }

              const row = item.row;
              const slot = findLectureSlot(attendanceCtx.data, row);
              const inClass =
                nowM >= timeToMinutes(row.startTime) && nowM < timeToMinutes(row.endTime);
              const rowCls = inClass ? 'tdash-feed-row tdash-feed-row--now' : 'tdash-feed-row';

              const attHref = attendanceHrefForRow(ymd, row);
              const canMark =
                mode === 'LECTURE_WISE' &&
                slot &&
                slot.canOperateThisSlot &&
                slot.markingWindowOpenNow &&
                !slot.locked;

              const actions: { label: string; to: string; emphasis?: boolean }[] = [];
              actions.push({ label: 'Open class', to: classWorkspaceOrList(row), emphasis: false });
              if (mode === 'LECTURE_WISE') {
                actions.push({
                  label: canMark ? 'Take attendance' : slot?.locked ? 'Done' : 'Attendance',
                  to: attHref,
                  emphasis: Boolean(canMark),
                });
              } else if (mode === 'DAILY' && attendanceCtx.data) {
                const sec =
                  row.classGroupId != null
                    ? attendanceCtx.data.dailySections.find((s) => s.classGroupId === row.classGroupId)
                    : attendanceCtx.data.dailySections.find(
                        (s) =>
                          row.classGroupDisplayName === s.displayName ||
                          row.classGroupDisplayName.includes(s.displayName),
                      );
                if (sec && !sec.locked) {
                  actions.push({
                    label: 'Daily roll',
                    to: `/app/attendance?date=${encodeURIComponent(ymd)}&classGroupId=${sec.classGroupId}`,
                    emphasis: sec.pendingAttendance,
                  });
                }
              }

              return (
                <div
                  key={`${row.startTime}-${idx}-${row.subject}-${row.classGroupDisplayName}`}
                  className={rowCls}
                >
                  <div className="tdash-feed-time">{formatTimeShort(row.startTime)}</div>
                  <div className="tdash-feed-core">
                    <div className="tdash-feed-line1">
                      {row.classGroupDisplayName} · {row.subject}
                    </div>
                    <div className="tdash-feed-line2">
                      {row.room?.trim() ? row.room : 'Room TBD'} · {row.startTime.slice(0, 5)}–
                      {row.endTime.slice(0, 5)}
                    </div>
                  </div>
                  <div className="tdash-feed-actions">
                    {actions.map((a) => (
                      <Link
                        key={a.label}
                        className={`tdash-feed-chip ${a.emphasis ? 'tdash-feed-chip--emphasis' : ''}`}
                        to={a.to}
                      >
                        {a.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Operational alerts */}
      <div className="tdash-alerts">
        <div className="tdash-alerts-title">Operational alerts</div>
        {derivedAlerts.length === 0 ? (
          <p className="tdash-alert-empty">
            No live schedule changes posted. Substitutions and room moves will appear here when your school enables
            them.
          </p>
        ) : (
          derivedAlerts.map((t) => (
            <div key={t} className="tdash-alert-item">
              {t}
            </div>
          ))
        )}
      </div>

      {/* 7. Class insights */}
      <div>
        <div className="tdash-section-h">
          <span className="tdash-section-title">Class insights</span>
        </div>
        <div className="tdash-insights">
          <div className="tdash-insight">
            <div className="tdash-insight-k">Low attendance (since join)</div>
            <div className="tdash-insight-v">
              {progress.isLoading ? (
                'Loading…'
              ) : lowAtt ? (
                <>
                  {lowAtt.name} · {lowAtt.pct.toFixed(0)}% —{' '}
                  <Link to="/app/teacher/class-progress">Open roster insight →</Link>
                </>
              ) : (
                <span className="tdash-muted" style={{ fontSize: 12 }}>
                  No cohort data yet
                </span>
              )}
            </div>
          </div>
          <div className="tdash-insight">
            <div className="tdash-insight-k">Marks / homework signal</div>
            <div className="tdash-insight-v">
              {progress.isLoading ? (
                'Loading…'
              ) : insightsHomework > 0 ? (
                <>
                  {insightsHomework} student{insightsHomework === 1 ? '' : 's'} with no marks recorded —{' '}
                  <Link to="/app/lectures">Review lectures →</Link>
                </>
              ) : (
                <span className="tdash-muted" style={{ fontSize: 12 }}>
                  All sampled students have marks on file
                </span>
              )}
            </div>
          </div>
          <div className="tdash-insight">
            <div className="tdash-insight-k">Assessments</div>
            <div className="tdash-insight-v">
              <span className="tdash-muted" style={{ fontSize: 12 }}>
                Track scores and readiness from{' '}
                <Link to="/app/teacher/class-progress">Class progress</Link> — exam scheduling hooks when your school
                enables them.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 8. Tools row */}
      <div className="tdash-tools">
        <div className="tdash-tools-title">Tools</div>
        <div className="tdash-tools-row">
          <Link className="tdash-tool" to="/app/students">
            Students
          </Link>
          <Link className="tdash-tool" to={primaryAttendance.to}>
            Attendance
          </Link>
          <Link className="tdash-tool" to="/app/teacher/timetable">
            Timetable
          </Link>
          <Link className="tdash-tool" to="/app/teacher/class-progress">
            Reports
          </Link>
          <Link className="tdash-tool" to="/app/teacher/announcements/new">
            Announcements
          </Link>
          <Link className="tdash-tool" to="/app/lectures">
            Lectures
          </Link>
        </div>
      </div>
    </div>
  );
}
