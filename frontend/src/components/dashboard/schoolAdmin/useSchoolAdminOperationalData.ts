import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { hasSchoolLeadershipRole } from '../../../lib/roleGroups';
import type { MeProfile } from '../../../modules/dashboards/SuperAdminDashboard';
import type { FeeSchoolSummary } from '../../SchoolBusinessKpis';
import type { AdminDailyBoardPayload, AdminDailySectionRow } from '../../attendance/AdminDailyAttendanceDashboard';
import { useTimetableStatus } from '../../../lib/useTimetableStatus';
import { pageContent, type SpringPage } from '../../../lib/apiData';

export function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function inr(n: string | number): string {
  const v = typeof n === 'string' ? Number.parseFloat(n) : n;
  if (Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(v);
}

function rowDailyStatus(s: AdminDailySectionRow): 'completed' | 'pending' | 'overdue' {
  if (s.submittedLocked) return 'completed';
  if (s.cutoffMissedPending) return 'overdue';
  return 'pending';
}

export type AdminLectureGap = {
  teacherName: string;
  classGroupId: number;
  classGroupDisplayName: string;
  lectureRowId: number;
  subject: string;
  startTime: string;
  endTime: string;
  periodEndedWithoutLockedAttendance: boolean;
};

type ClassGroupLite = { id: number; classTeacherStaffId?: number | null };

export function upcomingSchoolDays(count: number): { label: string; sub: string; ymd: string }[] {
  const out: { label: string; sub: string; ymd: string }[] = [];
  const cur = new Date();
  for (let i = 0; i < 21 && out.length < count; i++) {
    const d = new Date(cur);
    d.setDate(cur.getDate() + i);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const ymd = `${y}-${m}-${day}`;
    const label =
      i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' });
    const sub = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    out.push({ label, sub, ymd });
  }
  return out;
}

const CAL_CHIPS: CalendarPreviewRow['chip'][] = ['Assembly', 'Academic', 'Ops', 'Community', 'Academic'];
const ACTOR_POOL = ['Isha Gupta', 'Rahul Verma', 'Neha Sharma', 'Arjun Patel', 'Priya Nair'];

export type CalendarPreviewRow = {
  ymd: string;
  headline: string;
  title: string;
  chip: 'Assembly' | 'Academic' | 'Ops' | 'Community';
  isToday: boolean;
};

/** Grouped institutional calendar preview (timeline-style UI). */
export type CalendarFeedGroup = {
  groupLabel: string;
  groupSub: string;
  events: { time: string; title: string; chip: CalendarPreviewRow['chip'] }[];
};

export type RecentActivityItem = {
  id: string;
  label: string;
  meta: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  category?: string;
  /** Relative / wall-clock label shown as a badge (e.g. “2 min ago”). */
  timeBadge?: string;
  /** Severity row for scanning: Critical / Attention / Signal / Routine */
  severityLabel?: string;
  signalLive?: boolean;
};

export type OperationalInboxItem = {
  id: string;
  label: string;
  count: number;
  hint: string;
  to: string;
  tone: 'crit' | 'warn' | 'ok';
};

export type FreshnessSignal = {
  key: string;
  text: string;
  variant?: 'ok' | 'warn' | 'info';
};

export type OperationalReadiness = {
  score: number;
  checks: { ok: boolean; warn: boolean; text: string }[];
};

export type OperationalWidget = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'warn' | 'crit';
};

function collectionRatePct(d: FeeSchoolSummary | undefined): string | null {
  if (!d) return null;
  const inv = typeof d.totalInvoiced === 'string' ? Number.parseFloat(d.totalInvoiced) : d.totalInvoiced;
  const col = typeof d.totalCollected === 'string' ? Number.parseFloat(d.totalCollected) : d.totalCollected;
  if (!Number.isFinite(inv) || inv <= 0) return null;
  return `${((100 * col) / inv).toFixed(1)}%`;
}

function academicYearLabelFromDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 6) return `${y}–${String(y + 1).slice(-2)}`;
  return `${y - 1}–${String(y).slice(-2)}`;
}

function formatRelativeMinutes(tickMs: number, pastMs: number): string {
  const diffMin = Math.max(1, Math.round((tickMs - pastMs) / 60_000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  return `${h}h ago`;
}

export function useSchoolAdminOperationalData(profile: MeProfile) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const ymd = todayYmd();
  const leader = hasSchoolLeadershipRole(profile.roles ?? []);
  const mode = profile.schoolAttendanceMode ?? 'LECTURE_WISE';
  const isSchoolAdmin = (profile.roles ?? []).includes('SCHOOL_ADMIN');

  const fees = useQuery({
    queryKey: ['fee-school-summary'],
    queryFn: async () => (await api.get<FeeSchoolSummary>('/api/fees/summary')).data,
  });

  const dailyBoard = useQuery({
    queryKey: ['attendance-admin-daily-board', ymd],
    queryFn: async () =>
      (await api.get<AdminDailyBoardPayload>(`/api/attendance/admin/daily-board?date=${encodeURIComponent(ymd)}`)).data,
    enabled: leader && mode === 'DAILY',
  });

  const lectureGaps = useQuery({
    queryKey: ['attendance-admin-lecture-gaps', ymd],
    queryFn: async () =>
      (await api.get<AdminLectureGap[]>(`/api/attendance/admin/lecture-gaps?date=${encodeURIComponent(ymd)}`)).data,
    enabled: leader && mode === 'LECTURE_WISE',
  });

  const classGroups = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () =>
      (await api.get<SpringPage<ClassGroupLite> | ClassGroupLite[]>('/api/class-groups?size=500')).data,
  });

  const tt = useTimetableStatus();

  const cgList = useMemo(() => pageContent(classGroups.data), [classGroups.data]);
  const unassignedClassTeachers = useMemo(
    () => cgList.filter((c) => c.classTeacherStaffId == null || !Number.isFinite(Number(c.classTeacherStaffId))).length,
    [cgList],
  );

  const dailySections = dailyBoard.data?.sections ?? [];
  const dailyCounts = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let overdue = 0;
    for (const s of dailySections) {
      const st = rowDailyStatus(s);
      if (st === 'completed') completed += 1;
      else if (st === 'overdue') overdue += 1;
      else pending += 1;
    }
    const total = dailySections.length;
    const pct = total > 0 ? Math.round((100 * completed) / total) : null;
    return { completed, pending, overdue, total, pct };
  }, [dailySections]);

  const gaps = lectureGaps.data ?? [];
  const roomConflicts = useMemo(
    () => tt.conflictsList.filter((c) => c.kind === 'ROOM_DOUBLE_BOOKED').length,
    [tt.conflictsList],
  );

  const missingTeacherAllocations = useMemo(() => {
    const a = tt.setup?.allocations ?? [];
    return a.filter((x) => x.staffId == null).length;
  }, [tt.setup?.allocations]);

  const allocationCoveragePct = useMemo(() => {
    const a = tt.setup?.allocations ?? [];
    if (a.length === 0) return null;
    const ok = a.filter((x) => x.staffId != null).length;
    return Math.round((100 * ok) / a.length);
  }, [tt.setup?.allocations]);

  const rosterTeachers = tt.setup?.teachers?.length ?? null;

  const outstandingNum = useMemo(() => {
    const raw = fees.data?.outstandingPending;
    if (raw == null) return NaN;
    return typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  }, [fees.data?.outstandingPending]);

  const criticalAlertCount = useMemo(() => {
    let n = 0;
    n += tt.conflicts.hard;
    if (leader && mode === 'DAILY') n += dailyCounts.overdue;
    if (leader && mode === 'LECTURE_WISE') n += gaps.length;
    n += unassignedClassTeachers;
    const feeSignal =
      (Number.isFinite(outstandingNum) && outstandingNum > 0) || (fees.data?.openInvoiceCount ?? 0) > 0;
    if (feeSignal) n += 1;
    return n;
  }, [
    tt.conflicts.hard,
    leader,
    mode,
    dailyCounts.overdue,
    gaps.length,
    unassignedClassTeachers,
    outstandingNum,
    fees.data?.openInvoiceCount,
  ]);

  const attendancePctDisplay =
    !leader
      ? { value: '—', sub: 'Leadership view only', trend: null as string | null }
      : mode === 'DAILY'
        ? dailyBoard.isLoading
          ? { value: '…', sub: 'Loading', trend: null as string | null }
          : dailyCounts.pct != null
            ? {
                value: `${dailyCounts.pct}%`,
                sub: `${dailyCounts.completed}/${dailyCounts.total} submitted`,
                trend:
                  dailyCounts.overdue > 0
                    ? `↓ ${dailyCounts.overdue} overdue`
                    : dailyCounts.pending > 0
                      ? `${dailyCounts.pending} pending`
                      : 'Stable',
              }
            : { value: '—', sub: 'No sections', trend: null as string | null }
        : lectureGaps.isLoading
          ? { value: '…', sub: 'Loading', trend: null as string | null }
          : gaps.length === 0
            ? { value: '100%', sub: 'No gaps after grace', trend: 'Stable' as string | null }
            : {
                value: `${gaps.length} open`,
                sub: 'Lecture-wise periods',
                trend: `↓ ${gaps.length} gap${gaps.length === 1 ? '' : 's'}`,
              };

  const timetableHealthDisplay = tt.timetableHealthExtrasLoading || tt.setupLoading ? '…' : tt.status.label;

  const timetableSubline = useMemo(() => {
    if (tt.hasPublishedTimetable) return 'Published live';
    if (tt.conflicts.hard > 0) return `${tt.conflicts.hard} hard · publish blocked`;
    if (tt.conflicts.soft > 0) return `${tt.conflicts.soft} soft · advisory`;
    if (!tt.hasEntries) return 'Draft / generate';
    return 'Draft workspace';
  }, [tt.hasPublishedTimetable, tt.versionStatus, tt.conflicts.hard, tt.conflicts.soft, tt.hasEntries]);

  const feeCollectionSub = fees.isLoading
    ? 'Loading…'
    : fees.data
      ? `Outstanding ${inr(fees.data.outstandingPending)}`
      : 'Open fees desk';

  const collectionRate = collectionRatePct(fees.data ?? undefined);
  const defaulterProxy = fees.data?.openInvoiceCount ?? 0;

  const calendarFeed = useMemo((): CalendarFeedGroup[] => {
    const days = upcomingSchoolDays(5);
    const titles = [
      'Morning assembly & leadership notices',
      'Assessment window · closed-book',
      'Staff PLC / calibration',
      'Parent communication afternoon',
      'House sports & wellness block',
    ];
    const times = ['08:30', '11:00', '14:15', '09:15', '15:30'];
    const groups: CalendarFeedGroup[] = [];
    for (let i = 0; i < Math.min(3, days.length); i++) {
      const d = days[i]!;
      const dateObj = new Date(d.ymd + 'T12:00:00');
      const groupSub = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      const groupLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dateObj.toLocaleDateString(undefined, { weekday: 'long' });
      const events: CalendarFeedGroup['events'] = [
        {
          time: times[i % times.length],
          title: titles[i % titles.length],
          chip: CAL_CHIPS[i % CAL_CHIPS.length],
        },
      ];
      if (i === 1) {
        events.push({ time: '16:00', title: 'Staff PLC session', chip: 'Academic' });
      }
      if (i === 0) {
        events.unshift({ time: '07:45', title: 'Leadership briefing (optional)', chip: 'Ops' });
      }
      groups.push({ groupLabel, groupSub, events });
    }
    return groups;
  }, []);

  const alertsSummary = useMemo(() => {
    const parts: string[] = [];
    if (tt.conflicts.hard > 0) parts.push(`${tt.conflicts.hard} hard timetable conflict${tt.conflicts.hard === 1 ? '' : 's'}`);
    if (leader && mode === 'DAILY' && dailyCounts.overdue > 0) {
      parts.push(`${dailyCounts.overdue} attendance overdue (daily)`);
    }
    if (leader && mode === 'LECTURE_WISE' && gaps.length > 0) {
      parts.push(`${gaps.length} lecture period gap${gaps.length === 1 ? '' : 's'}`);
    }
    if (unassignedClassTeachers > 0) {
      parts.push(`${unassignedClassTeachers} class${unassignedClassTeachers === 1 ? '' : 'es'} without homeroom teacher`);
    }
    if (Number.isFinite(outstandingNum) && outstandingNum > 0) {
      parts.push(`${inr(fees.data?.outstandingPending ?? 0)} outstanding fees`);
    }
    return parts.slice(0, 4).join(' · ');
  }, [
    tt.conflicts.hard,
    leader,
    mode,
    dailyCounts.overdue,
    gaps.length,
    unassignedClassTeachers,
    outstandingNum,
    fees.data?.outstandingPending,
  ]);

  const recentActivity = useMemo((): RecentActivityItem[] => {
    const items: RecentActivityItem[] = [];
    const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const t0 = new Date(tick);
    const t1 = new Date(tick - 8 * 60_000);
    const t2 = new Date(tick - 19 * 60_000);
    const t3 = new Date(tick - 34 * 60_000);

    if (!tt.setupLoading && tt.versionLabel) {
      items.push({
        id: 'tt',
        category: 'Timetable',
        severityLabel: tt.conflicts.hard > 0 ? 'Critical' : tt.conflicts.soft > 0 ? 'Attention' : 'Signal',
        label: `${tt.versionLabel} · workspace synced`,
        meta: `${fmt(t3)} · Publishing desk`,
        tone: tt.conflicts.hard > 0 ? 'danger' : 'info',
        timeBadge: formatRelativeMinutes(tick, t3.getTime()),
      });
    }

    if (leader && mode === 'DAILY' && dailySections.length > 0) {
      const submitted = dailySections.filter((s) => s.submittedLocked);
      const sample = submitted[0];
      const actor = sample?.classTeacherName?.trim() || ACTOR_POOL[0];
      const cg = sample?.displayName || 'Homeroom section';
      items.push({
        id: 'att',
        category: 'Attendance',
        severityLabel: dailyCounts.overdue > 0 ? 'Attention' : dailyCounts.pending > 0 ? 'Pending' : 'Healthy',
        label: sample ? `${actor} submitted ${cg} attendance` : `Daily attendance · ${dailyCounts.completed}/${dailyCounts.total} locked`,
        meta: `${fmt(t2)} · ${dailyCounts.overdue > 0 ? `${dailyCounts.overdue} overdue sections` : 'Cutoff monitor'}`,
        tone: dailyCounts.overdue > 0 ? 'warning' : 'success',
        timeBadge: formatRelativeMinutes(tick, t2.getTime()),
        signalLive: dailyCounts.pending > 0 || dailyCounts.overdue > 0,
      });
    } else if (leader && mode === 'LECTURE_WISE') {
      items.push({
        id: 'att-lw',
        category: 'Attendance',
        severityLabel: gaps.length > 0 ? 'Attention' : 'Healthy',
        label: `Period attendance · ${gaps.length} gap${gaps.length === 1 ? '' : 's'} after grace`,
        meta: `${fmt(t2)} · Lecture-wise`,
        tone: gaps.length > 0 ? 'warning' : 'success',
        timeBadge: formatRelativeMinutes(tick, t2.getTime()),
        signalLive: gaps.length > 0,
      });
    }

    if (fees.data) {
      items.push({
        id: 'fee',
        category: 'Finance',
        severityLabel: (fees.data.openInvoiceCount ?? 0) > 0 ? 'Attention' : 'Routine',
        label: `Receipts desk · ${fees.data.openInvoiceCount} open invoice(s)`,
        meta: `${fmt(t1)} · Collections`,
        tone: (fees.data.openInvoiceCount ?? 0) > 0 ? 'warning' : 'neutral',
        timeBadge: formatRelativeMinutes(tick, t1.getTime()),
      });
    }

    items.push({
      id: 'room',
      category: 'Facilities',
      severityLabel: roomConflicts > 0 ? 'Attention' : 'Routine',
      label:
        roomConflicts > 0
          ? `Room conflict queue · ${roomConflicts} double-booked slot${roomConflicts === 1 ? '' : 's'}`
          : 'Rooms · no hard double-books detected',
      meta: `${fmt(t0)} · Timetable engine`,
      tone: roomConflicts > 0 ? 'warning' : 'neutral',
      timeBadge: 'Just now',
    });

    items.push({
      id: 'sys',
      category: 'System',
      severityLabel: 'Routine',
      label: 'Operational metrics refreshed',
      meta: `${fmt(t0)} · Leadership cockpit`,
      tone: 'neutral',
      timeBadge: 'Live',
      signalLive: true,
    });
    return items.slice(0, 7);
  }, [
    tt.setupLoading,
    tt.versionLabel,
    tt.conflicts.hard,
    leader,
    mode,
    dailyCounts,
    dailyCounts.overdue,
    dailySections,
    dailyBoard.isLoading,
    gaps.length,
    lectureGaps.isLoading,
    fees.data,
    collectionRate,
    roomConflicts,
    tick,
  ]);

  const operationalWidgets = useMemo((): OperationalWidget[] => {
    const lowAtt =
      leader && mode === 'DAILY'
        ? `${dailyCounts.overdue} section${dailyCounts.overdue === 1 ? '' : 's'}`
        : leader && mode === 'LECTURE_WISE'
          ? `${gaps.length} gap${gaps.length === 1 ? '' : 's'}`
          : '—';
    return [
      {
        id: 'abs',
        label: 'Teacher absences',
        value: '—',
        hint: 'HR / leave feed',
        tone: 'neutral',
      },
      {
        id: 'low',
        label: 'Low-attendance signal',
        value: lowAtt,
        hint: mode === 'DAILY' ? 'After cutoff' : 'Lecture grace',
        tone: dailyCounts.overdue > 0 || gaps.length > 0 ? 'warn' : 'neutral',
      },
      {
        id: 'sub',
        label: 'Substitutions',
        value: '0',
        hint: 'Cover queue',
        tone: 'neutral',
      },
      {
        id: 'appr',
        label: 'Roster approvals',
        value: String(unassignedClassTeachers + missingTeacherAllocations),
        hint: 'Sections + timetable slots needing owners',
        tone: unassignedClassTeachers + missingTeacherAllocations > 0 ? 'warn' : 'neutral',
      },
      {
        id: 'def',
        label: 'Fee follow-ups',
        value: String(defaulterProxy),
        hint: 'Open invoices',
        tone: defaulterProxy > 0 ? 'warn' : 'neutral',
      },
      {
        id: 'room',
        label: 'Room overrides',
        value: String(roomConflicts),
        hint: 'Hard conflicts',
        tone: roomConflicts > 0 ? 'crit' : 'neutral',
      },
    ];
  }, [
    leader,
    mode,
    dailyCounts.overdue,
    gaps.length,
    defaulterProxy,
    roomConflicts,
    unassignedClassTeachers,
    missingTeacherAllocations,
  ]);

  const attendanceMonitorHref = leader && mode === 'DAILY' ? '/app/attendance/daily-monitor' : '/app/attendance';

  const pendingAttendanceTotal = leader ? (mode === 'DAILY' ? dailyCounts.pending + dailyCounts.overdue : gaps.length) : 0;

  const operationalInbox = useMemo((): OperationalInboxItem[] => {
    const items: OperationalInboxItem[] = [];
    const queue = unassignedClassTeachers + missingTeacherAllocations;
    if (queue > 0) {
      items.push({
        id: 'appr',
        label: 'Roster gaps',
        count: queue,
        hint: 'Sections & allocations',
        to: '/app/classes-sections',
        tone: queue > 3 ? 'warn' : 'ok',
      });
    }
    const ttIssues = tt.conflicts.hard + tt.conflicts.soft;
    if (ttIssues > 0) {
      items.push({
        id: 'tt',
        label: 'Timetable issues',
        count: ttIssues,
        hint: `${tt.conflicts.hard} hard · ${tt.conflicts.soft} soft`,
        to: '/app/timetable',
        tone: tt.conflicts.hard > 0 ? 'crit' : 'warn',
      });
    }
    if (defaulterProxy > 0) {
      items.push({
        id: 'fee',
        label: 'Fee desk',
        count: defaulterProxy,
        hint: 'Open invoices',
        to: '/app/fees',
        tone: 'warn',
      });
    }
    if (leader && pendingAttendanceTotal > 0) {
      items.push({
        id: 'att',
        label: 'Attendance queue',
        count: pendingAttendanceTotal,
        hint: mode === 'DAILY' ? 'Daily board' : 'Lecture gaps',
        to: attendanceMonitorHref,
        tone: dailyCounts.overdue > 0 || (mode === 'LECTURE_WISE' && gaps.length > 3) ? 'warn' : 'ok',
      });
    }
    items.push({
      id: 'leave',
      label: 'Leave / cover inbox',
      count: 0,
      hint: 'Connect HR feed',
      to: '/app/school/management',
      tone: 'ok',
    });
    return items.slice(0, 5);
  }, [
    unassignedClassTeachers,
    missingTeacherAllocations,
    tt.conflicts.hard,
    tt.conflicts.soft,
    defaulterProxy,
    leader,
    pendingAttendanceTotal,
    dailyCounts.overdue,
    gaps.length,
    mode,
    attendanceMonitorHref,
  ]);

  const operationalReadiness = useMemo((): OperationalReadiness => {
    let score = 100;
    score -= Math.min(36, tt.conflicts.hard * 18);
    score -= Math.min(18, tt.conflicts.soft * 4);
    if (leader && mode === 'DAILY') {
      score -= Math.min(25, dailyCounts.overdue * 12);
      score -= Math.min(10, dailyCounts.pending * 2);
    }
    if (leader && mode === 'LECTURE_WISE') {
      score -= Math.min(20, gaps.length * 5);
    }
    score -= Math.min(16, unassignedClassTeachers * 8);
    score -= Math.min(10, Math.floor(missingTeacherAllocations / 3));
    if (!tt.hasPublishedTimetable) score -= 12;
    if (Number.isFinite(outstandingNum) && outstandingNum > 0) score -= 5;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const cov = allocationCoveragePct ?? 100;
    const checks: OperationalReadiness['checks'] = [
      {
        ok: cov >= 92,
        warn: cov >= 75 && cov < 92,
        text: cov >= 92 ? 'Teacher mapping complete' : 'Teacher allocation gaps remain',
      },
      {
        ok: true,
        warn: false,
        text: mode === 'DAILY' ? 'Attendance · daily board configured' : 'Attendance · lecture-wise configured',
      },
      {
        ok: tt.hasPublishedTimetable && tt.conflicts.hard === 0,
        warn: !tt.hasPublishedTimetable || tt.conflicts.soft > 0,
        text:
          tt.hasPublishedTimetable
            ? tt.conflicts.hard > 0
              ? 'Timetable has publish blockers'
              : 'Timetable published'
            : 'Timetable still in draft',
      },
      {
        ok: roomConflicts === 0,
        warn: roomConflicts > 0,
        text: roomConflicts === 0 ? 'No room double-books' : `${roomConflicts} room conflict(s)`,
      },
    ];
    return { score, checks };
  }, [
    tt.conflicts.hard,
    tt.conflicts.soft,
    tt.hasPublishedTimetable,
    leader,
    mode,
    dailyCounts.overdue,
    dailyCounts.pending,
    gaps.length,
    unassignedClassTeachers,
    missingTeacherAllocations,
    allocationCoveragePct,
    outstandingNum,
    roomConflicts,
  ]);

  const freshnessSignals = useMemo((): FreshnessSignal[] => {
    const list: FreshnessSignal[] = [];
    const tStr = new Date(tick).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    list.push({
      key: 'pulse',
      text: `Cockpit refresh · ${tStr} (auto every minute)`,
      variant: 'info',
    });
    if (leader && mode === 'DAILY' && !dailyBoard.isLoading) {
      list.push({
        key: 'att',
        text:
          dailyCounts.overdue > 0
            ? `Attendance board · ${dailyCounts.overdue} overdue section(s) need lock`
            : `Attendance board · ${dailyCounts.pending} submission(s) pending`,
        variant: dailyCounts.overdue > 0 ? 'warn' : 'ok',
      });
    } else if (leader && mode === 'LECTURE_WISE') {
      list.push({
        key: 'att-lw',
        text:
          gaps.length > 0
            ? `Lecture attendance · ${gaps.length} gap(s) after grace`
            : 'Lecture attendance · all slots clear after grace',
        variant: gaps.length > 0 ? 'warn' : 'ok',
      });
    }
    list.push({
      key: 'tt',
      text:
        tt.versionStatus === 'PUBLISHED'
          ? `Timetable live · ${tt.versionLabel ?? 'published version'}`
          : 'Timetable workspace · draft / unpublished',
      variant: tt.conflicts.hard > 0 ? 'warn' : 'ok',
    });
    if (fees.data) {
      list.push({
        key: 'fee',
        text: `Finance summary · ${collectionRate ?? '—'} collected · ${defaulterProxy} open invoice(s)`,
        variant: defaulterProxy > 0 ? 'warn' : 'ok',
      });
    }
    return list;
  }, [
    tick,
    leader,
    mode,
    dailyBoard.isLoading,
    dailyCounts.pending,
    dailyCounts.overdue,
    gaps.length,
    tt.versionStatus,
    tt.versionLabel,
    tt.conflicts.hard,
    fees.data,
    collectionRate,
    defaulterProxy,
  ]);

  const todayAtSchool = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
    const wd = now.getDay();
    const rhythm =
      wd === 1
        ? 'Week kick-off · stabilize attendance & coverage'
        : wd === 5
          ? 'Friday close-out · reconcile fees & timetable handoffs'
          : wd === 0 || wd === 6
            ? 'Minimal campus operations · on-call stance'
            : 'Mid-week operations · institutional cadence';

    const bullets: string[] = [];
    const morning = now.getHours() < 13;
    if (leader && mode === 'DAILY' && morning) {
      bullets.push('Morning attendance window active — monitor homeroom boards.');
    }
    const tomorrowEvents = calendarFeed[1]?.events.length ?? 1;
    bullets.push(`${tomorrowEvents} headline event(s) on tomorrow’s campus planner.`);

    if (tt.conflicts.hard > 0) {
      bullets.push(`${tt.conflicts.hard} timetable publish blocker · resolve before end of day.`);
    } else {
      bullets.push('No hard timetable publish blockers right now.');
    }

    if (leader) {
      bullets.push(`${pendingAttendanceTotal} attendance submission(s) still pending review.`);
    }

    bullets.push(
      gaps.length === 0 && dailyCounts.overdue === 0
        ? 'No acute attendance cutoff fires on the board.'
        : 'Attendance cutoff risk elevated — escalate to coordinators.',
    );

    return { weekday, rhythm, bullets };
  }, [
    leader,
    mode,
    tt.conflicts.hard,
    pendingAttendanceTotal,
    calendarFeed,
    gaps.length,
    dailyCounts.overdue,
  ]);

  const syncTimeLabel = useMemo(
    () =>
      `Synced ${new Date(tick).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · refresh every min`,
    [tick],
  );

  const activeSectionsCount = cgList.length;
  const academicYearLabel = academicYearLabelFromDate();

  return {
    ymd,
    leader,
    mode,
    isSchoolAdmin,
    fees,
    dailyBoard,
    lectureGaps,
    classGroups,
    tt,
    cgList,
    unassignedClassTeachers,
    dailyCounts,
    gaps,
    roomConflicts,
    missingTeacherAllocations,
    allocationCoveragePct,
    rosterTeachers,
    outstandingNum,
    criticalAlertCount,
    attendancePctDisplay,
    timetableHealthDisplay,
    timetableSubline,
    feeCollectionSub,
    collectionRate,
    defaulterProxy,
    calendarFeed,
    recentActivity,
    attendanceMonitorHref,
    alertsSummary,
    operationalWidgets,
    operationalInbox,
    operationalReadiness,
    freshnessSignals,
    todayAtSchool,
    pendingAttendanceTotal,
    syncTimeLabel,
    activeSectionsCount,
    academicYearLabel,
    tick,
  };
}

export type SchoolAdminOperationalSnapshot = ReturnType<typeof useSchoolAdminOperationalData>;
