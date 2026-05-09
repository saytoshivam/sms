import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Building2,
  CalendarDays,
  Clock,
  GraduationCap,
  Network,
  Search,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import '../styles/erpDashboard.css';
import { hasSchoolLeadershipRole } from '../lib/roleGroups';
import { DashboardPage } from './DashboardPage';
import { SetupChecklistPanel } from '../components/module/SetupChecklistPanel';
import { ImpactPreviewPanel } from '../components/module/ImpactPreviewPanel';
import { ImpactPill, StatusChip, type StatusLevel } from '../components/module/ModulePage';
import { useImpactSummary } from '../lib/impactStore';
import { computeNextBestActions, type Nba } from '../lib/nextBestActions';
import { useTimetableStatus } from '../lib/useTimetableStatus';
import { REQUIRED_STEPS } from '../lib/onboardingWizardMeta';
import {
  buildEffectiveAllocRows,
  computeSectionHealth,
  estimateSlotsPerWeek,
  type AcademicAllocRow,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from '../lib/academicStructureUtils';
import { pageTotalElements, type SpringPage } from '../lib/apiData';

type Me = { roles: string[]; schoolName?: string | null };

type OnboardingProgress = { status?: string; completedSteps?: string[] };

type BasicInfo = {
  schoolStartTime: string;
  schoolEndTime: string;
  lectureDurationMinutes: number;
  workingDays: string[];
  openWindows?: { startTime: string; endTime: string }[];
};

type AcademicStructure = {
  /** Enriched roster (roles + teachables) — required for section health; `/api/staff` alone does not include these. */
  staff?: {
    id: number;
    fullName?: string;
    email?: string;
    teachableSubjectIds?: number[];
    roleNames?: string[];
    maxWeeklyLectureLoad?: number | null;
  }[];
  classGroups: { classGroupId: number; gradeLevel: number | null; defaultRoomId: number | null; code?: string; displayName?: string; section?: string | null }[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  allocations: { classGroupId: number; subjectId: number; weeklyFrequency: number; staffId: number | null; roomId: number | null }[];
};

type SubjectsPage = { content?: { id: number; name: string; code: string }[] } | { id: number; name: string; code: string }[];
type StaffPage = { content?: StaffRow[] } | StaffRow[];
type RoomsPage = { content?: { id: number; isSchedulable?: boolean }[] } | { id: number; isSchedulable?: boolean }[];
type StudentIdRow = { id: number };
type FeesSetupLite = {
  classFees: { classGroupId: number; totalAmount: number }[];
  installments: { label: string; dueDateIso: string; percent: number }[];
};

type StaffRow = {
  id: number;
  fullName: string;
  email: string;
  teachableSubjectIds: number[];
  roleNames: string[];
  maxWeeklyLectureLoad?: number | null;
};

function pageContent<T>(p: { content?: T[] } | T[] | null | undefined): T[] {
  if (!p) return [];
  if (Array.isArray(p)) return p;
  return Array.isArray(p.content) ? p.content : [];
}

function HubCard({
  title,
  icon: Icon,
  level,
  primary,
  secondary,
  to,
}: {
  title: string;
  icon: LucideIcon;
  level: StatusLevel;
  primary: string;
  secondary?: string;
  to: string;
}) {
  return (
    <Link to={to} className="erp-hub-card">
      <div className="erp-hub-card__top">
        <span className="erp-hub-card__icon-wrap">
          <Icon size={17} strokeWidth={2} aria-hidden />
        </span>
        <StatusChip level={level} label={level === 'ok' ? 'Ready' : level === 'warn' ? 'Attention' : level === 'error' ? 'Issues' : level === 'info' ? 'Info' : 'Not started'} />
      </div>
      <div className="erp-hub-card__title">{title}</div>
      <div className="erp-hub-card__primary">{primary}</div>
      {secondary ? <div className="erp-hub-card__secondary">{secondary}</div> : null}
      <span className="erp-hub-card__cta">
        Open <span aria-hidden>→</span>
      </span>
    </Link>
  );
}

function NbaCard({ nba }: { nba: Nba }) {
  return (
    <Link
      to={nba.to}
      className="erp-nba-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        border: `1px solid ${nba.level === 'error' ? 'rgba(220,38,38,0.28)' : nba.level === 'warn' ? 'rgba(234,179,8,0.28)' : 'rgba(37,99,235,0.28)'}`,
        background: nba.level === 'error' ? 'rgba(254,242,242,0.92)' : nba.level === 'warn' ? 'rgba(254,252,232,0.92)' : 'rgba(239,246,255,0.92)',
        textDecoration: 'none',
        color: '#0f172a',
      }}
    >
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <StatusChip level={nba.level} label={nba.level === 'error' ? 'Action required' : nba.level === 'warn' ? 'Recommended' : 'Suggested'} />
      </div>
      <div style={{ fontWeight: 950, fontSize: 14, marginTop: 2 }}>{nba.title}</div>
      {nba.detail ? <div className="muted" style={{ fontSize: 12 }}>{nba.detail}</div> : null}
      <div style={{ marginTop: 4, fontSize: 11, fontWeight: 900, color: 'var(--color-primary, #ea580c)' }}>{nba.cta}</div>
    </Link>
  );
}

export function OperationsHubPage() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>('/user/me')).data,
  });

  const isLeadership = !!me.data && hasSchoolLeadershipRole(me.data.roles ?? []);

  if (me.isLoading) return <div className="muted" style={{ padding: 16 }}>Loading…</div>;
  if (!me.data || !isLeadership) {
    // Non-admin roles keep their existing role-specific dashboard.
    return <DashboardPage />;
  }

  return <SchoolOperationsHub schoolName={me.data.schoolName ?? 'Your school'} />;
}

function SchoolOperationsHub({ schoolName }: { schoolName: string }) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const impact = useImpactSummary();

  const progress = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => (await api.get<OnboardingProgress>('/api/v1/onboarding/progress')).data,
  });
  const basicInfo = useQuery({
    queryKey: ['onboarding-basic-info'],
    queryFn: async () => (await api.get<BasicInfo>('/api/v1/onboarding/basic-info')).data,
  });
  const academic = useQuery({
    queryKey: ['onboarding-academic-structure'],
    queryFn: async () => (await api.get<AcademicStructure>('/api/v1/onboarding/academic-structure')).data,
  });
  const subjects = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () => (await api.get<SubjectsPage>('/api/subjects?size=500')).data,
  });
  const staff = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get<StaffPage>('/api/staff?size=500')).data,
  });
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api.get<RoomsPage>('/api/rooms?size=500')).data,
  });
  const studentsPage = useQuery({
    queryKey: ['students-hub-page'],
    queryFn: async () =>
      (await api.get<SpringPage<StudentIdRow> | StudentIdRow[]>('/api/students?size=500')).data,
  });
  const feesOnboarding = useQuery({
    queryKey: ['onboarding-fees'],
    queryFn: async () => {
      const res = await api.get<FeesSetupLite>('/api/v1/onboarding/fees', { validateStatus: () => true });
      return res.status === 200 ? res.data : null;
    },
  });

  const ttStatus = useTimetableStatus();

  const completed = new Set(progress.data?.completedSteps ?? []);
  const requiredDone = REQUIRED_STEPS.filter((s) => completed.has(s)).length;
  const setupComplete = requiredDone === REQUIRED_STEPS.length;

  const slotsPerWeek = useMemo(() => estimateSlotsPerWeek(basicInfo.data ?? null), [basicInfo.data]);

  const effectiveAllocs: AcademicAllocRow[] = useMemo(() => {
    const d = academic.data;
    if (!d) return [];
    const fromTemplate = (d.classSubjectConfigs?.length ?? 0) > 0;
    if (fromTemplate) {
      return buildEffectiveAllocRows(d.classGroups, d.classSubjectConfigs, d.sectionSubjectOverrides);
    }
    return (d.allocations ?? []).map((a) => ({
      classGroupId: a.classGroupId,
      subjectId: a.subjectId,
      weeklyFrequency: a.weeklyFrequency,
      staffId: a.staffId ?? null,
      roomId: a.roomId ?? null,
    }));
  }, [academic.data]);

  const subjectList = pageContent(subjects.data ?? null) as { id: number; name: string; code: string }[];
  const staffList = pageContent(staff.data ?? null);
  const roomList = pageContent(rooms.data ?? null);

  /** Same source as Academic Structure UI: onboarding payload includes roleNames + teachables. Plain Staff list does not. */
  const staffForAcademicHealth = useMemo((): StaffRow[] => {
    const fromOnboarding = academic.data?.staff;
    if (Array.isArray(fromOnboarding) && fromOnboarding.length > 0) {
      return fromOnboarding.map((s) => ({
        id: s.id,
        fullName: s.fullName ?? '',
        email: s.email ?? '',
        teachableSubjectIds: s.teachableSubjectIds ?? [],
        roleNames: s.roleNames ?? [],
        maxWeeklyLectureLoad: s.maxWeeklyLectureLoad ?? null,
      }));
    }
    return (staffList as StaffRow[]).map((s) => ({
      ...s,
      teachableSubjectIds: s.teachableSubjectIds ?? [],
      roleNames: s.roleNames ?? [],
    }));
  }, [academic.data?.staff, staffList]);

  // ---- per-module readiness ----
  const academicReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    const cgs = academic.data?.classGroups ?? [];
    if (cgs.length === 0)
      return {
        level: 'idle',
        primary: 'No sections yet',
        secondary: 'Add sections in Classes & sections; CSV in Setup wizard.',
      };
    let withIssues = 0;
    let overCap = 0;
    let notStarted = 0;
    for (const cg of cgs) {
      const h = computeSectionHealth(cg.classGroupId, effectiveAllocs, subjectList.length, staffForAcademicHealth, slotsPerWeek);
      if (h.subjectCount === 0) notStarted += 1;
      if (h.overCapacity) overCap += 1;
      if (h.hasHardIssue || h.issueCount > 0) withIssues += 1;
    }
    const level: StatusLevel = withIssues > 0 || overCap > 0 ? 'error' : notStarted > 0 ? 'warn' : 'ok';
    const primary = `${cgs.length} section${cgs.length === 1 ? '' : 's'} · ${notStarted} not started`;
    const secondary = overCap > 0 ? `${overCap} over capacity` : withIssues > 0 ? `${withIssues} need fixing` : 'Subjects mapped, teachers assigned.';
    return { level, primary, secondary };
  }, [academic.data, effectiveAllocs, subjectList.length, staffForAcademicHealth, slotsPerWeek]);

  const classesSectionsReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    if (!academic.data && academic.isLoading) return { level: 'idle', primary: 'Loading…' };
    const cgs = academic.data?.classGroups ?? [];
    if (cgs.length === 0)
      return {
        level: 'idle',
        primary: 'Not configured yet',
        secondary: 'Generators & classes CSV live in Setup wizard.',
      };
    const grades = new Set(
      cgs.map((c) => c.gradeLevel).filter((g): g is number => typeof g === 'number' && Number.isFinite(g)),
    );
    return {
      level: 'ok',
      primary: `${cgs.length} section${cgs.length === 1 ? '' : 's'} · ${grades.size} grade${grades.size === 1 ? '' : 's'}`,
      secondary: 'Same browser as onboarding.',
    };
  }, [academic.data, academic.isLoading]);

  const subjectsReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    if (subjectList.length === 0) return { level: 'idle', primary: 'No subjects yet', secondary: 'Add the subject catalog.' };
    const validIds = new Set(subjectList.map((s) => s.id));
    const orphan = (academic.data?.allocations ?? []).filter((a) => !validIds.has(a.subjectId)).length;
    const level: StatusLevel = orphan > 0 ? 'error' : 'ok';
    return {
      level,
      primary: `${subjectList.length} subject${subjectList.length === 1 ? '' : 's'}`,
      secondary: orphan > 0 ? `${orphan} orphan reference${orphan === 1 ? '' : 's'}` : 'Catalog ready.',
    };
  }, [subjectList, academic.data]);

  const teachersReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    if (staffForAcademicHealth.length === 0)
      return { level: 'idle', primary: 'No teachers yet', secondary: 'Onboard teachers and roles.' };
    // Derive load per teacher from effective allocations.
    const load = new Map<number, number>();
    for (const a of effectiveAllocs) {
      if (a.staffId == null) continue;
      load.set(a.staffId, (load.get(a.staffId) ?? 0) + (a.weeklyFrequency > 0 ? a.weeklyFrequency : 0));
    }
    let over = 0;
    for (const s of staffForAcademicHealth) {
      const cap = s.maxWeeklyLectureLoad && s.maxWeeklyLectureLoad > 0 ? s.maxWeeklyLectureLoad : slotsPerWeek;
      const used = load.get(s.id) ?? 0;
      if (cap != null && used > cap) over += 1;
    }
    const level: StatusLevel = over > 0 ? 'warn' : 'ok';
    return {
      level,
      primary: `${staffForAcademicHealth.length} teacher${staffForAcademicHealth.length === 1 ? '' : 's'}`,
      secondary: over > 0 ? `${over} over weekly load` : 'Loads within capacity.',
    };
  }, [staffForAcademicHealth, effectiveAllocs, slotsPerWeek]);

  const roomsReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    const list = roomList ?? [];
    if (list.length === 0) return { level: 'idle', primary: 'No rooms yet', secondary: 'Add rooms or skip if homeroom-only.' };
    const schedulable = list.filter((r) => r.isSchedulable !== false).length;
    return { level: 'ok', primary: `${list.length} room${list.length === 1 ? '' : 's'}`, secondary: `${schedulable} schedulable` };
  }, [roomList]);

  const timeReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    if (!basicInfo.data) return { level: 'idle', primary: 'Not configured', secondary: 'Set days, hours, and period length.' };
    const days = basicInfo.data.workingDays?.length ?? 0;
    const dur = basicInfo.data.lectureDurationMinutes;
    if (!days || !dur) return { level: 'warn', primary: 'Incomplete', secondary: 'Set working days and period length.' };
    const cap = slotsPerWeek;
    return {
      level: 'ok',
      primary: `${days} day${days === 1 ? '' : 's'} · ${dur} min`,
      secondary: cap != null ? `~${cap} teachable slots/week per section` : 'Capacity not yet derivable.',
    };
  }, [basicInfo.data, slotsPerWeek]);

  const timetableReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    const ttBusy =
      ttStatus.setupLoading || ttStatus.versionLoading || ttStatus.entriesLoading || ttStatus.timetableHealthExtrasLoading;
    if (ttBusy) {
      return { level: 'idle', primary: 'Loading…', secondary: 'Reading timetable status.' };
    }
    if (!setupComplete && !ttStatus.hasPublishedTimetable) {
      return { level: 'idle', primary: 'Setup pending', secondary: 'Finish required steps to generate.' };
    }
    if (!ttStatus.hasEntries) {
      if (ttStatus.hasPublishedTimetable) {
        /** Normal steady state: the live schedule is the published version; draft workspace can stay empty until you edit. */
        const n = ttStatus.latestPublishedEntriesCount;
        return {
          level: 'ok',
          primary: 'Published timetable active',
          secondary:
            n != null && n > 0
              ? `${n} slot${n === 1 ? '' : 's'} on the live timetable · open Timetable to start a draft when you need changes.`
              : 'Live schedule is published · open Timetable to start a draft when you need changes.',
        };
      }
      return { level: 'warn', primary: 'No draft yet', secondary: 'Generate the first draft.' };
    }
    if (ttStatus.conflicts.hard > 0) {
      return {
        level: 'error',
        primary: `${ttStatus.conflicts.hard} hard conflict${ttStatus.conflicts.hard === 1 ? '' : 's'}`,
        secondary: ttStatus.conflicts.soft > 0
          ? `${ttStatus.conflicts.soft} soft · publish blocked`
          : 'Publish blocked.',
      };
    }
    if (ttStatus.versionStatus === 'PUBLISHED') {
      return {
        level: impact.total > 0 ? 'warn' : 'ok',
        primary: ttStatus.versionLabel ?? 'Published',
        secondary: impact.total > 0
          ? `${impact.total} change${impact.total === 1 ? '' : 's'} since publish`
          : `${ttStatus.entries.length} entries live`,
      };
    }
    if (ttStatus.conflicts.soft > 0) {
      return {
        level: 'warn',
        primary: `${ttStatus.conflicts.soft} soft conflict${ttStatus.conflicts.soft === 1 ? '' : 's'}`,
        secondary: ttStatus.versionLabel ?? 'Draft ready',
      };
    }
    return {
      level: 'info',
      primary: ttStatus.versionLabel ?? 'Draft ready',
      secondary: 'No conflicts — ready to publish.',
    };
  }, [
    setupComplete,
    ttStatus.setupLoading,
    ttStatus.versionLoading,
    ttStatus.entriesLoading,
    ttStatus.timetableHealthExtrasLoading,
    ttStatus.hasPublishedTimetable,
    ttStatus.latestPublishedEntriesCount,
    ttStatus.hasEntries,
    ttStatus.conflicts.hard,
    ttStatus.conflicts.soft,
    ttStatus.versionStatus,
    ttStatus.versionLabel,
    ttStatus.entries.length,
    impact.total,
  ]);

  const studentsReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    if (studentsPage.isLoading) return { level: 'idle', primary: 'Loading…', secondary: 'Fetching roster.' };
    const n = pageTotalElements(studentsPage.data ?? null);
    if (n === 0) {
      return {
        level: 'warn',
        primary: 'No students yet',
        secondary: 'Add records and section placements in Students.',
      };
    }
    return {
      level: 'ok',
      primary: `${n} student${n === 1 ? '' : 's'}`,
      secondary: 'Roster & placements.',
    };
  }, [studentsPage.data, studentsPage.isLoading]);

  const feesReadiness = useMemo<{ level: StatusLevel; primary: string; secondary?: string }>(() => {
    if (feesOnboarding.isLoading && feesOnboarding.data === undefined) {
      return { level: 'idle', primary: 'Loading…', secondary: 'Reading fee setup.' };
    }
    const d = feesOnboarding.data;
    if (d == null) {
      return { level: 'idle', primary: 'Fee setup', secondary: 'Open Fees to configure or review.' };
    }
    const nClass = d.classFees?.length ?? 0;
    const nInst = d.installments?.length ?? 0;
    if (nClass === 0 && nInst === 0) {
      return {
        level: 'warn',
        primary: 'Fee structure not set',
        secondary: 'Define class fees and installments.',
      };
    }
    return {
      level: 'ok',
      primary: `${nClass} class tier${nClass === 1 ? '' : 's'} · ${nInst} installment${nInst === 1 ? '' : 's'}`,
      secondary: 'Billing configured.',
    };
  }, [feesOnboarding.data, feesOnboarding.isLoading]);

  // ---- next best actions ----
  const allNbas: Nba[] = useMemo(
    () =>
      computeNextBestActions({
        completedSteps: progress.data?.completedSteps ?? [],
        impact,
        hasPublishedTimetable: ttStatus.hasPublishedTimetable,
        hasTimetableEntries: ttStatus.hasEntries,
        timetableConflicts: { hard: ttStatus.conflicts.hard, soft: ttStatus.conflicts.soft },
        signals: {
          academic: academicReadiness,
          subjects: subjectsReadiness,
          teachers: teachersReadiness,
          rooms: roomsReadiness,
          time: timeReadiness,
        },
      }),
    [
      progress.data,
      impact,
      ttStatus.hasPublishedTimetable,
      ttStatus.hasEntries,
      ttStatus.conflicts.hard,
      ttStatus.conflicts.soft,
      academicReadiness,
      subjectsReadiness,
      teachersReadiness,
      roomsReadiness,
      timeReadiness,
    ],
  );
  const nbas = allNbas.slice(0, 3);

  const overallHealth: StatusLevel = useMemo(() => {
    const levels = [
      classesSectionsReadiness.level,
      academicReadiness.level,
      subjectsReadiness.level,
      teachersReadiness.level,
      roomsReadiness.level,
      timeReadiness.level,
      timetableReadiness.level,
      studentsReadiness.level,
      feesReadiness.level,
    ];
    if (levels.includes('error')) return 'error';
    if (levels.includes('warn')) return 'warn';
    if (levels.includes('idle')) return 'idle';
    return 'ok';
  }, [
    classesSectionsReadiness.level,
    academicReadiness.level,
    subjectsReadiness.level,
    teachersReadiness.level,
    roomsReadiness.level,
    timeReadiness.level,
    timetableReadiness.level,
    studentsReadiness.level,
    feesReadiness.level,
  ]);

  return (
    <div className="stack operations-hub-erp" style={{ gap: 10 }}>
      <header className="erp-hub-page-head">
        <div className="erp-hub-page-head__row">
          <div className="erp-hub-page-head__title-block" style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Operations hub
            </div>
            <h1>{schoolName}</h1>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <StatusChip
                level={overallHealth}
                label={
                  overallHealth === 'ok'
                    ? 'Healthy'
                    : overallHealth === 'warn'
                      ? 'Attention'
                      : overallHealth === 'error'
                        ? 'Issues'
                        : 'Setup needed'
                }
              />
              <span className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                Setup {requiredDone}/{REQUIRED_STEPS.length} required
              </span>
              <ImpactPill
                changes={impact.total}
                hard={impact.hard}
                soft={impact.soft}
                onPreview={() => setImpactOpen(true)}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
            <div className="erp-cmd-search-wrap" role="search" style={{ minWidth: 200, flex: '1 1 220px' }}>
              <Search size={16} strokeWidth={2.25} aria-hidden />
              <input
                className="erp-cmd-search-input"
                placeholder="Search modules, entities, setup steps…"
                readOnly
                onFocus={(e) => e.currentTarget.blur()}
                title="Hub-wide search preview"
                aria-label="Hub search preview"
              />
            </div>
            <Link to="/app/onboarding" className="btn secondary" style={{ whiteSpace: 'nowrap' }}>
              Setup wizard & CSV
            </Link>
          </div>
        </div>
      </header>

      {/* Next Best Actions */}
      {nbas.length ? (
        <section className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="erp-hub-section-title" style={{ margin: 0 }}>
              Next best actions
            </h2>
            <button type="button" className="btn secondary" onClick={() => setChecklistOpen(true)}>
              See all
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
            {nbas.map((n) => (
              <NbaCard key={n.id} nba={n} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Modules */}
      <section className="stack" style={{ gap: 6 }}>
        <h2 className="erp-hub-section-title" style={{ margin: 0 }}>
          Modules
        </h2>
        <div className="erp-hub-grid">
          {/*
            Time → roster & catalogs → Academic → Timetable → Students → Fees.
          */}
          <HubCard icon={Clock} title="Time slots" level={timeReadiness.level} primary={timeReadiness.primary} secondary={timeReadiness.secondary} to="/app/time" />
          <HubCard
            icon={Users}
            title="Classes & sections"
            level={classesSectionsReadiness.level}
            primary={classesSectionsReadiness.primary}
            secondary={classesSectionsReadiness.secondary}
            to="/app/classes-sections"
          />
          <HubCard icon={BookOpen} title="Subjects" level={subjectsReadiness.level} primary={subjectsReadiness.primary} secondary={subjectsReadiness.secondary} to="/app/subjects" />
          <HubCard icon={Building2} title="Rooms" level={roomsReadiness.level} primary={roomsReadiness.primary} secondary={roomsReadiness.secondary} to="/app/rooms" />
          <HubCard icon={GraduationCap} title="Teachers" level={teachersReadiness.level} primary={teachersReadiness.primary} secondary={teachersReadiness.secondary} to="/app/teachers" />
          <HubCard icon={Network} title="Academic structure" level={academicReadiness.level} primary={academicReadiness.primary} secondary={academicReadiness.secondary} to="/app/academic" />
          <HubCard icon={CalendarDays} title="Timetable" level={timetableReadiness.level} primary={timetableReadiness.primary} secondary={timetableReadiness.secondary} to="/app/timetable" />
          <HubCard
            icon={UsersRound}
            title="Students"
            level={studentsReadiness.level}
            primary={studentsReadiness.primary}
            secondary={studentsReadiness.secondary}
            to="/app/students"
          />
          <HubCard icon={Wallet} title="Fees" level={feesReadiness.level} primary={feesReadiness.primary} secondary={feesReadiness.secondary} to="/app/fees" />
        </div>
      </section>

      <SetupChecklistPanel open={checklistOpen} onClose={() => setChecklistOpen(false)} />
      <ImpactPreviewPanel open={impactOpen} onClose={() => setImpactOpen(false)} />
    </div>
  );
}
