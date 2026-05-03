import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SelectKeeper } from './SelectKeeper';
import { toast } from '../lib/toast';
import { buildEffectiveAllocRows, homeroomMapFromDraft, type ClassSubjectConfigRow, type SectionSubjectOverrideRow } from '../lib/academicStructureUtils';
import {
  type AssignmentSource,
  type AssignmentSlotMeta,
  buildTeacherLoadRows,
  runSmartTeacherAssignment,
  slotKey,
  applyUniformGradeSubjectTeacher,
  applySectionTeacher,
  mergeAssignmentSlotMeta,
} from '../lib/academicStructureSmartAssign';
import {
  computeTeacherDemandSummary,
  type TeacherDemandStatus,
} from '../lib/teacherDemandAnalysis';

type DemandSortKey = 'subject' | 'required' | 'qualified' | 'capacity' | 'teachersNeeded' | 'status';

const DEMAND_STATUS_RANK: Record<TeacherDemandStatus, number> = {
  CRITICAL: 0,
  WARN: 1,
  OK: 2,
};

/** Used only for “needs attention” when a lab-like subject still resolves to homeroom only. */
function preferredTeachingRoomCategory(subjectName: string, subjectCode: string): string | null {
  const s = `${subjectName} ${subjectCode}`.toLowerCase();
  if (s.includes('physics') || s.includes('chemistry') || s.includes('biology') || s.includes('science')) return 'LAB';
  if (s.includes('computer') || s.includes('informatics') || s.includes('it ') || s.includes('csc') || s.includes('ip ')) return 'COMPUTER';
  if (s.includes('music')) return 'MUSIC';
  return null;
}

type StaffRow = {
  id: number;
  fullName: string;
  email: string;
  teachableSubjectIds: number[];
  roleNames: string[];
  // Keep aligned with smart-assign heuristics: optional fields still treated as "unset" (null) for TS.
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[] | null;
};

type ClassG = { classGroupId: number; code: string; displayName: string; gradeLevel: number | null; section: string | null };
type Sub = { id: number; name: string; code: string; weeklyFrequency: number | null };

/** Passed from Academic module shell — weekly hint, progress, section capacity warnings. */
export type SmartAssignmentOverviewContext = {
  slotsPerWeek: number | null;
  overCapacitySections: Array<{ classGroupId: number; label: string; totalPeriods: number; capacity: number; overBy: number }>;
  schoolProgressPct: number;
  schoolProgressWithIssues: number;
};

export type SmartAssignmentFilterUi = {
  gradeValue: string;
  subjectValue: string;
  teacherValue: string;
  onGradeChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
  onTeacherChange: (v: string) => void;
  gradeOptions: { value: string; label: string }[];
  subjectOptions: { value: string; label: string }[];
  teacherOptions: { value: string; label: string }[];
};

type Props = {
  classGroups: ClassG[];
  subjects: Sub[];
  staff: StaffRow[];
  roomOptions: { value: string; label: string }[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  setClassSubjectConfigs: React.Dispatch<React.SetStateAction<ClassSubjectConfigRow[]>>;
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  setSectionSubjectOverrides: React.Dispatch<React.SetStateAction<SectionSubjectOverrideRow[]>>;
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  setAssignmentMeta: React.Dispatch<React.SetStateAction<Record<string, AssignmentSlotMeta>>>;
  subjectsCatalogForLabels: { id: number; name: string; code: string }[];
  filters?: { grade: string; subject: string; teacher: string };
  showBulkActions?: boolean;
  /** Single bulk homeroom automation (uses floor/building/capacity-aware placement). */
  autoAssignHomerooms: () => void;
  /** Greedy assignment of homeroom (class) teachers from effective subject-teaching allocations. */
  autoAssignClassTeachers: () => void;
  /** Clears homerooms assigned by automation only. */
  clearAutoHomeroomAssignments?: () => void;
  /**
   * Draft homerooms keyed by classGroupId → room id string (same persistence as overview homeroom column).
   */
  defaultRoomByClassId: Record<number, string>;
  /** Tracks whether each section homeroom was last set automatically vs manually (controls bulk overwrite). */
  homeroomSourceByClassId?: Record<number, 'auto' | 'manual' | ''>;
  /**
   * When a teacher doesn't have `maxWeeklyLectureLoad` set, this is used as the fallback
   * teacher capacity for load checks / KPI (instead of hardcoded 32).
   */
  slotsPerWeek?: number | null;
  overviewContext?: SmartAssignmentOverviewContext | null;
  filterUi?: SmartAssignmentFilterUi | null;
};

export function SmartTeacherAssignmentBlock({
  classGroups,
  subjects,
  staff,
  roomOptions,
  classSubjectConfigs,
  setClassSubjectConfigs,
  sectionSubjectOverrides,
  setSectionSubjectOverrides,
  assignmentMeta,
  setAssignmentMeta,
  subjectsCatalogForLabels: _subjectsCatalogForLabels,
  filters,
  showBulkActions = false,
  autoAssignHomerooms,
  autoAssignClassTeachers,
  clearAutoHomeroomAssignments,
  defaultRoomByClassId,
  homeroomSourceByClassId = {},
  slotsPerWeek,
  overviewContext = null,
  filterUi = null,
}: Props) {
  const [manualOverrideMode, setManualOverrideMode] = useState(false);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [bulkTid, setBulkTid] = useState<string>('');
  const [bulkRoomId, setBulkRoomId] = useState<string>('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [onlyLocked, setOnlyLocked] = useState(false);
  const [onlyOverloaded, setOnlyOverloaded] = useState(false);
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [sectionSearch, setSectionSearch] = useState('');
  const [demandSort, setDemandSort] = useState<{ key: DemandSortKey; dir: 'asc' | 'desc' }>({
    key: 'subject',
    dir: 'asc',
  });

  const [overviewExpanded, setOverviewExpanded] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('smart-assign-overview-collapsed') !== '1';
    } catch {
      return true;
    }
  });
  const [demandExpanded, setDemandExpanded] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('smart-assign-demand-collapsed') !== '1';
    } catch {
      return true;
    }
  });

  const toggleDemandSort = useCallback((column: DemandSortKey) => {
    setDemandSort((prev) =>
      prev.key === column ? { key: column, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: column, dir: 'asc' },
    );
  }, []);

  const gradeFilter = filters?.grade ?? '';
  const subjFilter = filters?.subject ?? '';
  const teacherFilter = filters?.teacher ?? '';

  const staffById = useMemo(() => {
    const m = new Map<number, StaffRow>();
    for (const s of staff) m.set(Number(s.id), s);
    return m;
  }, [staff]);

  const teacherCanTeach = useCallback(
    (teacherId: number, subjectId: number) => {
      const t = staffById.get(Number(teacherId));
      if (!t) return false;
      const roles = t.roleNames ?? [];
      const isTeacher = roles.includes('TEACHER') || (roles.length === 0 && (t.teachableSubjectIds?.length ?? 0) > 0);
      if (!isTeacher) return false;
      const teachables = t.teachableSubjectIds ?? [];
      if (teachables.length === 0) return true;
      return teachables.includes(Number(subjectId));
    },
    [staffById],
  );

  const cgs = useMemo(
    () =>
      classGroups.map((c) => ({
        classGroupId: c.classGroupId,
        gradeLevel: c.gradeLevel,
        section: c.section ?? null,
        code: c.code ?? null,
      })),
    [classGroups],
  );

  const homeroomMap = useMemo(() => homeroomMapFromDraft(classGroups, defaultRoomByClassId), [classGroups, defaultRoomByClassId]);

  const effective = useMemo(
    () => buildEffectiveAllocRows(cgs, classSubjectConfigs, sectionSubjectOverrides, homeroomMap),
    [cgs, classSubjectConfigs, sectionSubjectOverrides, homeroomMap],
  );

  const staffNorm = useMemo(
    () =>
      staff.map((s) => ({
        ...s,
        maxWeeklyLectureLoad: s.maxWeeklyLectureLoad ?? null,
        preferredClassGroupIds: s.preferredClassGroupIds ?? null,
      })),
    [staff],
  );

  const loadRows = useMemo(() => {
    const base = buildTeacherLoadRows(
      effective,
      staffNorm,
      subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      slotsPerWeek ?? null,
    );
    return base;
  }, [effective, staffNorm, subjects, slotsPerWeek]);

  const teacherLoadById = useMemo(() => {
    const m = new Map<number, { load: number; max: number; status: 'healthy' | 'near' | 'over' }>();
    for (const r of loadRows) m.set(Number(r.id), { load: r.load, max: r.max, status: r.status });
    return m;
  }, [loadRows]);

  const subjectCodeById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of subjects) m.set(Number(s.id), String(s.code ?? '').trim());
    return m;
  }, [subjects]);

  const flatRows = useMemo(() => {
    const out: {
      classGroupId: number;
      subId: number;
      subName: string;
      periods: number;
      staffId: number | null;
      roomId: number | null;
      k: string;
    }[] = [];
    for (const a of effective) {
      if (subjFilter && String(a.subjectId) !== subjFilter) continue;
      if (gradeFilter) {
        const g = classGroups.find((c) => c.classGroupId === a.classGroupId)?.gradeLevel;
        if (g == null || String(g) !== gradeFilter) continue;
      }
      if (teacherFilter) {
        const tid = Number(teacherFilter);
        // Filter should be useful for planning: show rows already assigned to this teacher,
        // plus unassigned rows that this teacher is eligible to teach.
        const matchesAssigned = String(a.staffId ?? '') === teacherFilter;
        const matchesEligibleUnassigned = a.staffId == null && Number.isFinite(tid) && teacherCanTeach(tid, a.subjectId);
        if (!matchesAssigned && !matchesEligibleUnassigned) continue;
      }
      const s = subjects.find((x) => x.id === a.subjectId);
      // If the subject catalog is empty or doesn't contain this subjectId anymore (e.g. after bulk delete),
      // hide the row instead of showing "Subject 11".
      if (!s) continue;
      out.push({
        classGroupId: a.classGroupId,
        subId: a.subjectId,
        subName: s.name,
        periods: a.weeklyFrequency,
        staffId: a.staffId,
        roomId: a.roomId ?? null,
        k: slotKey(a.classGroupId, a.subjectId),
      });
    }
    const q = sectionSearch.trim().toLowerCase();
    return out.filter((r) => {
      const m = assignmentMeta[r.k];
      const teacherLocked = m?.locked ?? false;
      const roomLockedRow = !!(m?.roomLocked ?? false);
      const anyLocked = teacherLocked || roomLockedRow;
      const isUnassigned = r.staffId == null;
      if (onlyUnassigned && !isUnassigned) return false;
      if (onlyLocked && !anyLocked) return false;
      if (
        onlyConflicts &&
        !(
          m?.source === 'conflict' ||
          m?.conflictReason === 'NO_ELIGIBLE_TEACHER' ||
          m?.conflictReason === 'UNKNOWN'
        )
      )
        return false;
      if (onlyOverloaded) {
        const tl = r.staffId != null ? teacherLoadById.get(Number(r.staffId)) : null;
        if (!tl || tl.status !== 'over') return false;
      }
      if (q) {
        const sec = classGroups.find((c) => c.classGroupId === r.classGroupId);
        const label = `${sec?.displayName ?? ''} ${sec?.code ?? ''} ${sec?.section ?? ''}`.toLowerCase();
        if (!label.includes(q)) return false;
      }
      return true;
    });
  }, [
    effective,
    classGroups,
    gradeFilter,
    subjFilter,
    teacherFilter,
    subjects,
    teacherCanTeach,
    assignmentMeta,
    onlyUnassigned,
    onlyLocked,
    onlyConflicts,
    onlyOverloaded,
    sectionSearch,
    teacherLoadById,
  ]);

  const kpis = useMemo(() => {
    const total = flatRows.length;
    const assigned = flatRows.filter((r) => r.staffId != null).length;
    const pending = total - assigned;
    const conflicts = flatRows.filter((r) => {
      const m = assignmentMeta[r.k];
      return (
        m?.source === 'conflict' ||
        m?.conflictReason === 'NO_ELIGIBLE_TEACHER' ||
        m?.conflictReason === 'UNKNOWN'
      );
    }).length;
    const teacherIdsInView = new Set<number>();
    for (const r of flatRows) {
      if (r.staffId != null) teacherIdsInView.add(Number(r.staffId));
    }
    // KPI should reflect current filter scope (especially when a teacher is selected).
    const overloadedTeachers = Array.from(teacherIdsInView).filter((id) => teacherLoadById.get(id)?.status === 'over').length;
    return { total, assigned, pending, conflicts, overloadedTeachers };
  }, [flatRows, assignmentMeta, teacherLoadById]);

  const teacherDemand = useMemo(
    () =>
      computeTeacherDemandSummary({
        subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
        allocations: effective,
        staff: staffNorm.map((s) => ({
          id: s.id,
          teachableSubjectIds: s.teachableSubjectIds ?? [],
          roleNames: s.roleNames ?? [],
          maxWeeklyLectureLoad: s.maxWeeklyLectureLoad ?? null,
        })),
        slotsPerWeek: slotsPerWeek ?? null,
      }),
    [subjects, effective, staffNorm, slotsPerWeek],
  );

  const sortedDemandRows = useMemo(() => {
    const rows = teacherDemand.rows.slice();
    const { key, dir } = demandSort;
    const mul = dir === 'asc' ? 1 : -1;

    const cmpNum = (a: number, b: number) => {
      if (a === b) return 0;
      return a < b ? -mul : mul;
    };
    const cmpStr = (a: string, b: string) => mul * a.localeCompare(b, undefined, { sensitivity: 'base' });

    rows.sort((a, b) => {
      let c = 0;
      switch (key) {
        case 'subject': {
          const sa = (a.subjectName || `Subject ${a.subjectId}`).trim();
          const sb = (b.subjectName || `Subject ${b.subjectId}`).trim();
          c = cmpStr(sa, sb);
          if (c === 0) c = cmpStr(String(a.subjectCode ?? ''), String(b.subjectCode ?? ''));
          break;
        }
        case 'required':
          c = cmpNum(a.requiredPeriods, b.requiredPeriods);
          break;
        case 'qualified':
          c = cmpNum(a.qualifiedTeacherCount, b.qualifiedTeacherCount);
          break;
        case 'capacity':
          c = cmpNum(a.availableCapacity, b.availableCapacity);
          break;
        case 'teachersNeeded': {
          const av = a.teachersNeeded ?? Number.POSITIVE_INFINITY;
          const bv = b.teachersNeeded ?? Number.POSITIVE_INFINITY;
          c = cmpNum(av, bv);
          break;
        }
        case 'status': {
          c = cmpNum(DEMAND_STATUS_RANK[a.status], DEMAND_STATUS_RANK[b.status]);
          if (c === 0) c = cmpStr(a.statusDetail, b.statusDetail);
          break;
        }
        default:
          break;
      }
      if (c === 0) c = cmpNum(a.subjectId, b.subjectId);
      return c;
    });
    return rows;
  }, [teacherDemand.rows, demandSort]);

  const preferredRoomTypeBySubjectId = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const s of subjects) {
      m.set(Number(s.id), preferredTeachingRoomCategory(s.name, s.code));
    }
    return m;
  }, [subjects]);

  const needsAttention = useMemo(() => {
    const needs: typeof flatRows = [];
    const healthy: typeof flatRows = [];
    for (const r of flatRows) {
      const m = assignmentMeta[r.k];
      const locked = m?.locked ?? false;
      const src = m?.source ?? null;
      const teacherOver = r.staffId != null ? teacherLoadById.get(Number(r.staffId))?.status === 'over' : false;

      const pref = preferredRoomTypeBySubjectId.get(Number(r.subId)) ?? null;
      const homeroomId = homeroomMap.get(r.classGroupId) ?? null;
      const usesHomeroomOnly =
        homeroomId == null ? r.roomId == null : r.roomId === homeroomId || r.roomId == null;
      const noRoomForPreferred = pref != null && usesHomeroomOnly;

      // Only treat as "missing teacher" when this slot actually has periods.
      // period=0 means the subject is disabled for this section.
      const missingTeacher = r.staffId == null && (r.periods ?? 0) > 0;
      const conflict =
        src === 'conflict' || m?.conflictReason === 'NO_ELIGIBLE_TEACHER' || m?.conflictReason === 'UNKNOWN';

      const isNeeds =
        missingTeacher ||
        teacherOver ||
        noRoomForPreferred ||
        conflict ||
        (locked && (missingTeacher || teacherOver || noRoomForPreferred || conflict));

      if (isNeeds) needs.push(r);
      else healthy.push(r);
    }
    return { needs, healthy };
  }, [flatRows, assignmentMeta, teacherLoadById, preferredRoomTypeBySubjectId, homeroomMap]);

  const missingTeacherReport = useMemo(() => {
    const byKey = new Map<
      string,
      {
        subjectId: number;
        subjectName: string;
        subjectCode: string;
        grade: number | null;
        sections: string[];
        reasons: Set<NonNullable<AssignmentSlotMeta['conflictReason']>>;
      }
    >();
    for (const r of needsAttention.needs) {
      if (r.staffId != null) continue;
      if ((r.periods ?? 0) <= 0) continue;
      const cg = classGroups.find((c) => Number(c.classGroupId) === Number(r.classGroupId));
      const grade = cg?.gradeLevel ?? null;
      const sectionLabel = cg?.section ? String(cg.section) : String(cg?.displayName || cg?.code || r.classGroupId);
      const code = subjectCodeById.get(Number(r.subId)) ?? '';
      const key = `${Number(r.subId)}:${grade ?? ''}`;
      const cur = byKey.get(key) ?? {
        subjectId: r.subId,
        subjectName: r.subName,
        subjectCode: code,
        grade,
        sections: [],
        reasons: new Set<NonNullable<AssignmentSlotMeta['conflictReason']>>(),
      };
      cur.sections.push(sectionLabel);
      const m = assignmentMeta[r.k];
      if (m?.conflictReason) cur.reasons.add(m.conflictReason);
      byKey.set(key, cur);
    }
    const rows = [...byKey.values()].map((x) => ({
      ...x,
      sections: Array.from(new Set(x.sections)).sort((a, b) => a.localeCompare(b)),
    }));
    rows.sort((a, b) => {
      const ga = a.grade ?? 999;
      const gb = b.grade ?? 999;
      if (ga !== gb) return ga - gb;
      return `${a.subjectName} ${a.subjectCode}`.localeCompare(`${b.subjectName} ${b.subjectCode}`);
    });
    return rows;
  }, [needsAttention.needs, classGroups, subjectCodeById, assignmentMeta]);

  const groupRows = useCallback(
    (rows: typeof flatRows) => {
      const byCg = new Map<number, ClassG>(classGroups.map((c) => [Number(c.classGroupId), c]));
      const byGrade = new Map<number, Map<number, { cg: ClassG; rows: typeof flatRows }>>();
      for (const r of rows) {
        const cg = byCg.get(Number(r.classGroupId));
        const grade = cg?.gradeLevel != null ? Number(cg.gradeLevel) : NaN;
        if (!Number.isFinite(grade) || !cg) continue;
        const gMap = byGrade.get(grade) ?? new Map<number, { cg: ClassG; rows: typeof flatRows }>();
        const sec = gMap.get(Number(cg.classGroupId)) ?? { cg, rows: [] as any };
        (sec.rows as any).push(r);
        gMap.set(Number(cg.classGroupId), sec as any);
        byGrade.set(grade, gMap);
      }
      const grades = [...byGrade.entries()].sort((a, b) => a[0] - b[0]);
      return grades.map(([grade, secMap]) => {
        const secs = [...secMap.values()].sort((a, b) => String(a.cg.section ?? a.cg.code).localeCompare(String(b.cg.section ?? b.cg.code)));
        const totalRows = secs.reduce((a, s) => a + (s.rows as any).length, 0);
        return { grade, sections: secs as any[], totalRows };
      });
    },
    [classGroups],
  );

  const groupedNeeds = useMemo(() => groupRows(needsAttention.needs), [groupRows, needsAttention.needs]);
  const groupedHealthy = useMemo(() => groupRows(needsAttention.healthy), [groupRows, needsAttention.healthy]);

  // IMPORTANT: avoid page-level horizontal scrolling.
  // Use flexible columns that can shrink to the viewport (minmax(0, ...)),
  // and rely on ellipsis within cells rather than fixed min widths.
  const rowGridCols =
    'minmax(0, 1.05fr) minmax(184px, 1.95fr) minmax(96px, 0.82fr) minmax(184px, 1.85fr) minmax(72px, 0.52fr) minmax(72px,max-content)';

  const renderRow = (row: (typeof flatRows)[number]) => {
    const m = assignmentMeta[row.k];
    const src: AssignmentSource | '—' = m?.source ?? '—';
    const teacherLocked = m?.locked ?? false;
    const tl = row.staffId != null ? teacherLoadById.get(Number(row.staffId)) : null;
    const load = tl?.load ?? 0;
    const max = tl?.max ?? 0;
    const ratio = max > 0 ? load / max : 0;
    const barColor = ratio > 1 ? '#b91c1c' : ratio > 0.85 ? '#c2410c' : '#16a34a';

    const statusLabel =
      src === 'auto'
        ? 'AUTO'
        : src === 'manual'
          ? 'MANUAL'
          : src === 'rebalanced'
            ? 'REBALANCED'
            : src === 'conflict'
              ? 'CONFLICT'
              : '—';

    const conflictReasonLabel =
      src !== 'conflict'
        ? null
        : m?.conflictReason === 'NO_ELIGIBLE_TEACHER'
          ? 'No eligible teacher'
          : m?.conflictReason === 'CAPACITY_OVERFLOW'
            ? 'Teacher overloaded'
            : 'Needs review';

    const roomValue = row.roomId != null ? String(row.roomId) : '';
    const hmId = homeroomMap.get(row.classGroupId);
    const rowUsesHomeroom =
      hmId != null && row.roomId != null && Number(row.roomId) === Number(hmId);
    const roomSrcMeta = m?.roomSource;
    const roomBadgeLabel =
      roomSrcMeta === 'manual'
        ? 'MANUAL'
        : roomSrcMeta === 'auto'
          ? 'AUTO'
          : rowUsesHomeroom && homeroomSourceByClassId[row.classGroupId] === 'manual'
            ? 'MANUAL'
            : rowUsesHomeroom && homeroomSourceByClassId[row.classGroupId] === 'auto'
              ? 'AUTO'
              : '—';
    const roomLocked = !!m?.roomLocked;

    return (
      <div
        key={row.k}
        style={{
          border: '1px solid rgba(15,23,42,0.06)',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.92)',
          padding: 6,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: rowGridCols,
            gap: 6,
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.subName}
            </div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 750, opacity: 0.85 }}>
              {row.periods} / wk
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <SelectKeeper value={row.staffId != null ? String(row.staffId) : ''} onChange={(v) => setTeacherOnSlot(row.classGroupId, row.subId, v)} options={teachOpts(row.subId)} />
            <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <span
              style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                borderRadius: 999,
                  fontSize: 10,
                fontWeight: 900,
                background:
                  statusLabel === 'AUTO'
                    ? 'rgba(249,115,22,0.12)'
                    : statusLabel === 'MANUAL'
                      ? 'rgba(37,99,235,0.12)'
                      : statusLabel === 'REBALANCED'
                        ? 'rgba(22,163,74,0.12)'
                        : statusLabel === 'CONFLICT'
                          ? 'rgba(220,38,38,0.10)'
                          : 'rgba(100,116,139,0.10)',
                color:
                  statusLabel === 'AUTO'
                    ? '#c2410c'
                    : statusLabel === 'MANUAL'
                      ? '#1d4ed8'
                      : statusLabel === 'REBALANCED'
                        ? '#166534'
                        : statusLabel === 'CONFLICT'
                          ? '#b91c1c'
                          : '#64748b',
              }}
                title="Teacher assignment source"
            >
                {statusLabel}
                {teacherLocked ? <span aria-hidden>🔒</span> : null}
            </span>
              <button
                type="button"
                onClick={() => {
                  const next = !teacherLocked;
                  setAssignmentMeta((prev) => ({
                    ...prev,
                    [row.k]: mergeAssignmentSlotMeta(prev[row.k], {
                      source: m?.source ?? 'manual',
                      locked: next,
                      conflictReason: m?.conflictReason,
                    }),
                  }));
                }}
                title={
                  teacherLocked
                    ? 'Unlock teacher assignment (auto-assign / rebalance may change)'
                    : 'Lock teacher assignment'
                }
                style={{
                  appearance: 'none',
                  border: '1px solid rgba(15,23,42,0.12)',
                  background: teacherLocked ? 'rgba(37,99,235,0.12)' : 'rgba(100,116,139,0.08)',
                  color: teacherLocked ? '#1d4ed8' : '#475569',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {teacherLocked ? 'Teacher locked' : 'Teacher lock'}
              </button>
            </div>
          </div>

          <div>
            {row.staffId != null && tl ? (
              <div>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(140, Math.round((load / Math.max(1, max)) * 100))}%`, height: '100%', background: barColor }} />
                </div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 900, marginTop: 4 }}>
                  {load}/{max}{ratio > 1 ? ` · Overloaded +${Math.max(0, load - max)}` : ''}
                </div>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>—</div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <SelectKeeper value={roomValue} onChange={(v) => setRoomOnSlot(row.classGroupId, row.subId, v)} options={roomOptions} />
            <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 900,
                  background:
                    roomBadgeLabel === 'AUTO'
                      ? 'rgba(249,115,22,0.12)'
                      : roomBadgeLabel === 'MANUAL'
                        ? 'rgba(37,99,235,0.12)'
                        : 'rgba(100,116,139,0.10)',
                  color:
                    roomBadgeLabel === 'AUTO' ? '#c2410c' : roomBadgeLabel === 'MANUAL' ? '#1d4ed8' : '#64748b',
                }}
                title="Room assignment source for this subject slot"
              >
                {roomBadgeLabel}
                {roomLocked ? <span aria-hidden>🔒</span> : null}
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextLocked = !roomLocked;
                  setAssignmentMeta((prev) => ({
                    ...prev,
                    [row.k]: mergeAssignmentSlotMeta(prev[row.k], {
                      source: prev[row.k]?.source ?? 'manual',
                      locked: prev[row.k]?.locked ?? false,
                      conflictReason: prev[row.k]?.conflictReason,
                      roomLocked: nextLocked,
                      roomSource: nextLocked ? (prev[row.k]?.roomSource ?? 'manual') : prev[row.k]?.roomSource,
                    }),
                  }));
                }}
                title={roomLocked ? 'Unlock room assignment' : 'Lock room assignment'}
                style={{
                  appearance: 'none',
                  border: '1px solid rgba(15,23,42,0.12)',
                  background: roomLocked ? 'rgba(249,115,22,0.12)' : 'rgba(100,116,139,0.08)',
                  color: roomLocked ? '#c2410c' : '#475569',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {roomLocked ? 'Room locked' : 'Room lock'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
            {conflictReasonLabel ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 900,
                  background: 'rgba(220,38,38,0.10)',
                  color: '#b91c1c',
                  flex: '0 0 auto',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {conflictReasonLabel}
              </span>
            ) : (
              <span className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                —
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0, overflow: 'hidden' }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}
                onClick={() => setTeacherOnSlot(row.classGroupId, row.subId, '')}
                title="Clear teacher"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGrouped = (
    groups: { grade: number; sections: Array<{ cg: ClassG; rows: typeof flatRows }>; totalRows: number }[],
    defaultOpen: boolean,
  ) => {
    return (
      <div className="stack" style={{ gap: 8 }}>
        {groups.map((g) => (
          <details
            key={g.grade}
            open={defaultOpen}
            style={{ border: '1px solid rgba(15,23,42,0.06)', borderRadius: 10, background: 'rgba(255,255,255,0.85)' }}
          >
            <summary
              className="row"
              style={{ cursor: 'pointer', padding: '7px 9px', listStyle: 'none', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ fontWeight: 900, fontSize: 13 }}>{`Grade ${g.grade}`}</div>
              <div className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                {g.sections.length} section{g.sections.length === 1 ? '' : 's'} · {g.totalRows} row{g.totalRows === 1 ? '' : 's'}
              </div>
            </summary>
            <div className="stack" style={{ gap: 8, padding: '0 9px 9px' }}>
              {g.sections.map(({ cg, rows }) => (
                <details
                  key={cg.classGroupId}
                  open={defaultOpen}
                  style={{ border: '1px solid rgba(15,23,42,0.06)', borderRadius: 10, background: 'rgba(255,255,255,0.95)' }}
                >
                  <summary
                    className="row"
                    style={{ cursor: 'pointer', padding: '7px 9px', listStyle: 'none', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ fontWeight: 850, fontSize: 12 }}>{cg.displayName || cg.code}</div>
                    <div className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                      {rows.length} subject{rows.length === 1 ? '' : 's'}
                    </div>
                  </summary>
                  <div style={{ width: '100%', overflowX: 'hidden' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: rowGridCols,
                        gap: 6,
                        padding: '6px 6px 0 6px',
                        fontSize: 10,
                        fontWeight: 850,
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        opacity: 0.85,
                      }}
                    >
                      <div>Subject</div>
                      <div>Assigned teacher</div>
                      <div>Teacher load</div>
                      <div>Room</div>
                      <div>Alert</div>
                      <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>
                    <div className="stack" style={{ gap: 5, padding: 6 }}>
                      {rows.map(renderRow)}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    );
  };

  const run = (mode: 'auto' | 'rebalance' | 'reset', subjectOnly: number | null = null) => {
    const r = runSmartTeacherAssignment(
      cgs,
      staffNorm,
      subjects,
      classSubjectConfigs,
      sectionSubjectOverrides,
      assignmentMeta,
      mode,
      subjectOnly,
      slotsPerWeek ?? null,
      homeroomMap,
    );
    setClassSubjectConfigs(r.classSubjectConfigs);
    setSectionSubjectOverrides(r.sectionSubjectOverrides);
    setAssignmentMeta(r.assignmentMeta);
    if (r.warnings.length) {
      const uniq = Array.from(new Set(r.warnings.map((w) => String(w).trim()).filter(Boolean)));
      const teacherMissing: string[] = [];
      const other: string[] = [];
      for (const w of uniq) {
        const m = w.match(/^No teacher tagged to teach (.+?) in Class (\d+)\./i);
        if (m) {
          const subj = String(m[1] ?? '').trim();
          const g = String(m[2] ?? '').trim();
          teacherMissing.push(`${subj} — Class ${g}`);
        } else {
          other.push(w);
        }
      }

      const parts: string[] = [];
      if (teacherMissing.length) {
        parts.push(
          `Missing teacher mappings: ${teacherMissing.length} row(s). Open Insights for the detailed report.`,
        );
      }
      if (other.length) {
        const head = other.slice(0, 2);
        const more = other.length - head.length;
        parts.push(`${head.join(' · ')}${more > 0 ? ` (+${more} more)` : ''}`);
      }
      toast.info('Assignment', parts.join(' | '));
    }
    if (r.warnings.length === 0 && mode === 'auto') {
      toast.success('Smart assign', 'Teachers applied by skill, grade cohesion, and load.');
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('smart-assign-overview-collapsed', '1');
          sessionStorage.setItem('smart-assign-demand-collapsed', '1');
        }
      } catch {
        /* ignore */
      }
      setOverviewExpanded(false);
      setDemandExpanded(false);
    } else if (r.warnings.length === 0 && mode === 'rebalance') {
      toast.success('Rebalanced', 'Non-locked rows were redistributed where possible.');
    } else if (mode === 'reset') {
      toast.info('Reset', 'Auto and rebalanced assignments were cleared. Manual / locked kept.');
    }
  };

  const clearAutomaticAssignments = () => {
    run('reset', null);
    clearAutoHomeroomAssignments?.();
  };

  const setTeacherOnSlot = (classGroupId: number, subjectId: number, newId: string) => {
    const lock = manualOverrideMode;
    if (!newId || String(newId).trim() === '') {
      const g = classGroups.find((c) => c.classGroupId === classGroupId)?.gradeLevel;
      if (g == null) return;
      const r = applyUniformGradeSubjectTeacher(
        classSubjectConfigs,
        sectionSubjectOverrides,
        cgs,
        Number(g),
        subjectId,
        null,
      );
      setClassSubjectConfigs(r.cfg);
      setSectionSubjectOverrides(r.ovs);
      setAssignmentMeta((m) => {
        const k = slotKey(classGroupId, subjectId);
        const prev = m[k];
        const next = { ...m };
        delete next[k];
        if (prev?.roomSource || prev?.roomLocked) {
          next[k] = {
            source: 'manual',
            locked: false,
            roomSource: prev.roomSource,
            roomLocked: prev.roomLocked,
          };
        }
        return next;
      });
      toast.info('Cleared for class+subject', 'Removed the default teacher for this subject for the whole class (all sections in this grade).');
      return;
    }
    const id = Number(newId);
    if (!Number.isFinite(id)) return;
    const r = applySectionTeacher(classSubjectConfigs, sectionSubjectOverrides, cgs, classGroupId, subjectId, id);
    setClassSubjectConfigs(r.cfg);
    setSectionSubjectOverrides(r.ovs);
    setAssignmentMeta((m) => {
      const k = slotKey(classGroupId, subjectId);
      const prev = m[k];
      return {
      ...m,
        [k]: mergeAssignmentSlotMeta(prev, {
          source: 'manual',
          locked: lock,
          conflictReason: prev?.conflictReason,
        }),
      };
    });
  };

  const setRoomOnSlot = (classGroupId: number, subjectId: number, newId: string) => {
    const rid = newId && String(newId).trim() !== '' ? Number(newId) : null;
    if (newId && rid != null && !Number.isFinite(rid)) return;

    setSectionSubjectOverrides((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((r) => Number(r.classGroupId) === Number(classGroupId) && Number(r.subjectId) === Number(subjectId));
      if (idx >= 0) {
        next[idx] = { ...next[idx], roomId: rid };
        return next;
      }
      next.push({ classGroupId, subjectId, periodsPerWeek: null, teacherId: null, roomId: rid });
      return next;
    });

    setAssignmentMeta((m) => {
      const k = slotKey(classGroupId, subjectId);
      const prev = m[k];
      return {
      ...m,
        [k]: mergeAssignmentSlotMeta(prev ?? { source: 'manual', locked: false }, {
          source: prev?.source ?? 'manual',
          locked: prev?.locked ?? false,
          conflictReason: prev?.conflictReason,
          roomSource: 'manual',
          roomLocked: true,
        }),
      };
    });
  };

  const teachOpts = (subjectId: number) =>
    staffNorm
      .filter((s) => {
        // Align with other onboarding screens: treat TEACHER role as teacher,
        // and also allow legacy rows where roles are empty but teachables are set.
        const roles = s.roleNames ?? [];
        const teachables = s.teachableSubjectIds ?? [];
        const isTeacher = roles.includes('TEACHER') || (roles.length === 0 && teachables.length > 0);
        if (!isTeacher) return false;
        // IMPORTANT: empty teachables means "can teach none" (must be explicitly tagged).
        if (teachables.length === 0) return false;
        return teachables.includes(subjectId);
      })
      .map((s) => ({ value: String(s.id), label: s.fullName || s.email }))
      .sort((a, b) => a.label.localeCompare(b.label));

  const filterSummaryText = useMemo(() => {
    const bits: string[] = [];
    if (filterUi?.gradeValue) {
      const lab = filterUi.gradeOptions.find((o) => o.value === filterUi.gradeValue)?.label;
      bits.push(lab ?? `Class ${filterUi.gradeValue}`);
    }
    if (filterUi?.subjectValue) {
      const lab = filterUi.subjectOptions.find((o) => o.value === filterUi.subjectValue)?.label;
      bits.push(lab ?? 'Subject');
    }
    if (filterUi?.teacherValue) {
      const lab = filterUi.teacherOptions.find((o) => o.value === filterUi.teacherValue)?.label;
      bits.push(lab ?? 'Teacher');
    }
    const q = sectionSearch.trim();
    if (q) bits.push(`Search "${q}"`);
    if (onlyUnassigned) bits.push('Unassigned only');
    if (onlyLocked) bits.push('Teacher or room locked');
    if (onlyOverloaded) bits.push('Overloaded only');
    if (onlyConflicts) bits.push('Conflicts only');
    return bits.length ? bits.join(' · ') : 'Showing all rows';
  }, [
    filterUi,
    sectionSearch,
    onlyUnassigned,
    onlyLocked,
    onlyOverloaded,
    onlyConflicts,
  ]);

  const persistOverviewOpen = (open: boolean) => {
    setOverviewExpanded(open);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('smart-assign-overview-collapsed', open ? '0' : '1');
      }
    } catch {
      /* ignore */
    }
  };

  const persistDemandOpen = (open: boolean) => {
    setDemandExpanded(open);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('smart-assign-demand-collapsed', open ? '0' : '1');
      }
    } catch {
      /* ignore */
    }
  };

  const ghostBtnSx = {
    border: '1px solid rgba(15,23,42,0.12)',
    background: 'transparent',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 10px',
    borderRadius: 8,
    cursor: 'pointer',
  } as const;

  return (
    <div className="stack smart-assign-root" style={{ gap: 32 }}>
      {/* SECTION 1 — Assignment overview (collapsible) */}
      <details
        open={overviewExpanded}
        onToggle={(e) => persistOverviewOpen(e.currentTarget.open)}
        style={{
          borderRadius: 12,
          border: '1px solid rgba(15,23,42,0.06)',
          background: 'rgba(248,250,252,0.94)',
          padding: '8px 12px',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 13,
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>Assignment overview</span>
          <span className="muted" style={{ fontSize: 11, fontWeight: 750 }}>
            {overviewExpanded ? 'Hide' : 'Show'}
          </span>
        </summary>

        <div className="stack" style={{ gap: 16, marginTop: 12 }}>
          {overviewContext ? (
    <div className="stack" style={{ gap: 12 }}>
              {overviewContext.slotsPerWeek != null ? (
                <div
                  className="muted"
                  style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.82 }}
                  title={
                    `About ${overviewContext.slotsPerWeek} teachable slots per week for your school schedule. Aim to keep each section's total weekly subject periods within this budget when possible.`
                  }
                >
                  Weekly capacity hint: ~<strong>{overviewContext.slotsPerWeek}</strong> teachable slots/week.
          </div>
              ) : null}

              {overviewContext.overCapacitySections.length ? (
                <details style={{ fontSize: 11 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800, opacity: 0.88 }}>
                    {overviewContext.overCapacitySections.length} section
                    {overviewContext.overCapacitySections.length === 1 ? '' : 's'} over weekly capacity
                  </summary>
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {overviewContext.overCapacitySections.slice(0, 10).map((s) => (
                      <div key={s.classGroupId} className="row" style={{ gap: 10, justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 750 }}>{s.label}</span>
                        <span className="muted" style={{ fontWeight: 750 }}>
                          {s.totalPeriods} / {s.capacity} (+{s.overBy})
                        </span>
          </div>
                    ))}
                    {overviewContext.overCapacitySections.length > 10 ? (
                      <div className="muted" style={{ fontSize: 11, fontWeight: 750 }}>
                        +{overviewContext.overCapacitySections.length - 10} more…
          </div>
                    ) : null}
          </div>
                </details>
              ) : null}

              <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-text-muted)',
                      opacity: 0.85,
                    }}
                  >
                    School progress
          </div>
                  <div style={{ fontSize: 15, fontWeight: 950, marginTop: 2 }}>
                    {overviewContext.schoolProgressPct}% sections ready
        </div>
                  <div className="muted" style={{ fontSize: 11, opacity: 0.82 }}>
                    {overviewContext.schoolProgressWithIssues} section
                    {overviewContext.schoolProgressWithIssues === 1 ? '' : 's'} need attention
      </div>
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 120 }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: 'rgba(15,23,42,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${overviewContext.schoolProgressPct}%`,
                        height: '100%',
                        borderRadius: 999,
                        background:
                          overviewContext.schoolProgressPct >= 100 ? '#16a34a' : 'var(--color-primary)',
                        transition: 'width 0.25s ease',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : slotsPerWeek != null ? (
            <div className="muted" style={{ fontSize: 11, opacity: 0.78 }} title="Used when estimating loads if teacher caps are unset.">
              Weekly capacity fallback for load checks: <strong>{slotsPerWeek}</strong> periods.
            </div>
          ) : null}

          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(255,255,255,0.72)',
                minWidth: 88,
              }}
            >
              <div className="muted" style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', opacity: 0.85 }}>
                Total rows
              </div>
              <div style={{ fontSize: 15, fontWeight: 950 }}>{kpis.total}</div>
            </div>
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(255,255,255,0.72)',
                minWidth: 88,
              }}
            >
              <div className="muted" style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', opacity: 0.85 }}>
                Assigned
              </div>
              <div style={{ fontSize: 15, fontWeight: 950, color: '#166534' }}>{kpis.assigned}</div>
            </div>
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(255,255,255,0.72)',
                minWidth: 88,
              }}
            >
              <div className="muted" style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', opacity: 0.85 }}>
                Pending
              </div>
              <div style={{ fontSize: 15, fontWeight: 950, color: kpis.pending ? '#b91c1c' : '#166534' }}>{kpis.pending}</div>
            </div>
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(255,255,255,0.72)',
                minWidth: 88,
              }}
            >
              <div className="muted" style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', opacity: 0.85 }}>
                Overloaded
              </div>
              <div style={{ fontSize: 15, fontWeight: 950, color: kpis.overloadedTeachers ? '#c2410c' : '#166534' }}>
                {kpis.overloadedTeachers}
              </div>
            </div>
            <div
              style={{
                padding: '7px 10px',
                borderRadius: 10,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(255,255,255,0.72)',
                minWidth: 88,
              }}
            >
              <div className="muted" style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', opacity: 0.85 }}>
                Conflicts
              </div>
              <div style={{ fontSize: 15, fontWeight: 950, color: kpis.conflicts ? '#b91c1c' : '#166534' }}>{kpis.conflicts}</div>
            </div>
          </div>

          <details
            open={demandExpanded}
            onToggle={(e) => persistDemandOpen(e.currentTarget.open)}
            style={{
              borderRadius: 10,
              border: '1px solid rgba(15,23,42,0.06)',
              background: 'rgba(255,255,255,0.72)',
              padding: '8px 10px',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 12, listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>
                Teacher demand summary{' '}
                <span className="muted" style={{ fontWeight: 750 }}>
                  {demandExpanded ? '' : '(expand)'}
                </span>
              </span>
              <span
                className="muted"
                style={{ fontWeight: 750, fontSize: 11 }}
                title={
                  `Totals weekly periods mapped across sections vs aggregate qualified teacher capacity for teachers explicitly tagged per subject.${slotsPerWeek != null ? ` Default weekly cap when a teacher has no personal cap: ${slotsPerWeek} periods.` : ''} Tap headers to sort.`
                }
              >
                ℹ
              </span>
            </summary>

            <div className="stack" style={{ gap: 12, marginTop: 12 }}>
              {teacherDemand.hasSevereShortage ? (
                <div className="sms-alert sms-alert--warning" style={{ marginBottom: 0 }}>
                  <div>
                    <div className="sms-alert__title">Severe shortage</div>
                    <div className="sms-alert__msg">
                      Smart auto-assign is blocked until capacity meets demand or reaches the near-limit band (≥90%) for every demanded subject.
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  maxHeight: 260,
                  overflow: 'auto',
                  border: '1px solid rgba(15,23,42,0.06)',
                  borderRadius: 10,
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <table
                  className="data-table"
                  style={{
                    fontSize: 12,
                    width: '100%',
                    margin: 0,
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                  }}
                >
                  <thead
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      background: 'rgba(248,250,252,0.98)',
                      boxShadow: '0 1px 0 rgba(15,23,42,0.06)',
                    }}
                  >
                    <tr>
                      <th scope="col" style={{ verticalAlign: 'middle' }} aria-sort={demandSort.key === 'subject' ? (demandSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="demand-sort-th" onClick={() => toggleDemandSort('subject')}>
                          Subject
                          {demandSort.key === 'subject' ? (demandSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th scope="col" style={{ verticalAlign: 'middle' }} aria-sort={demandSort.key === 'required' ? (demandSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="demand-sort-th" onClick={() => toggleDemandSort('required')}>
                          Required periods
                          {demandSort.key === 'required' ? (demandSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th scope="col" style={{ verticalAlign: 'middle' }} aria-sort={demandSort.key === 'qualified' ? (demandSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="demand-sort-th" onClick={() => toggleDemandSort('qualified')}>
                          Qualified teachers
                          {demandSort.key === 'qualified' ? (demandSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th scope="col" style={{ verticalAlign: 'middle' }} aria-sort={demandSort.key === 'capacity' ? (demandSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="demand-sort-th" onClick={() => toggleDemandSort('capacity')}>
                          Available capacity
                          {demandSort.key === 'capacity' ? (demandSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th scope="col" style={{ verticalAlign: 'middle' }} aria-sort={demandSort.key === 'teachersNeeded' ? (demandSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="demand-sort-th" onClick={() => toggleDemandSort('teachersNeeded')}>
                          Teachers needed
                          {demandSort.key === 'teachersNeeded' ? (demandSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th scope="col" style={{ verticalAlign: 'middle' }} aria-sort={demandSort.key === 'status' ? (demandSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="demand-sort-th" onClick={() => toggleDemandSort('status')}>
                          Status
                          {demandSort.key === 'status' ? (demandSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th scope="col" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDemandRows.map((row) => {
                      const tone = row.status === 'OK' ? '#166534' : row.status === 'WARN' ? '#b45309' : '#b91c1c';
                      const needsFix = row.requiredPeriods > 0 && row.status !== 'OK';
                      const ghostLinkSxLocal = {
                        ...ghostBtnSx,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 8px',
                        fontSize: 11,
                      } as const;
                      return (
                        <tr key={row.subjectId}>
                          <td style={{ fontWeight: 800 }}>
                            {row.subjectName || `Subject ${row.subjectId}`}
                            {row.subjectCode ? (
                              <span className="muted" style={{ fontWeight: 700, marginLeft: 6 }}>
                                ({row.subjectCode})
                              </span>
                            ) : null}
                          </td>
                          <td>{row.requiredPeriods}</td>
                          <td>{row.qualifiedTeacherCount}</td>
                          <td>{row.availableCapacity}</td>
                          <td>{row.teachersNeeded ?? '—'}</td>
                          <td style={{ fontWeight: 850, color: tone }}>{row.statusDetail}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {needsFix ? (
                              <span className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <Link style={ghostLinkSxLocal} to="/app/teachers">
                                  Add teacher
                                </Link>
                                <Link style={ghostLinkSxLocal} to="/app/teachers">
                                  Capacity
                                </Link>
                                <Link style={ghostLinkSxLocal} to="/app/academic">
                                  Frequency
                                </Link>
                                <button type="button" style={{ ...ghostBtnSx, fontSize: 11, padding: '3px 8px' }} onClick={() => run('rebalance', row.subjectId)}>
                                  Rebalance
                                </button>
                              </span>
                            ) : (
                              <span className="muted" style={{ fontSize: 11 }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </div>
      </details>

      {/* SECTION 2 + sticky review header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 8,
          marginLeft: -2,
          marginRight: -2,
          padding: '10px 10px 12px',
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
          borderRadius: '0 0 12px 12px',
        }}
      >
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              onClick={() => run('auto', null)}
              disabled={!classSubjectConfigs.length || teacherDemand.hasSevereShortage}
              title={
                teacherDemand.hasSevereShortage ? 'Resolve severe shortages in Teacher demand summary (overview).' : undefined
              }
            >
          Auto assign teachers
        </button>
        <button
          type="button"
          className="btn secondary"
              onClick={autoAssignClassTeachers}
          disabled={!classSubjectConfigs.length}
              title="Pick a class teacher per section from current subject-teacher assignments (before timetable)."
        >
              Auto assign class teachers
            </button>
            <button type="button" style={ghostBtnSx} onClick={() => run('rebalance', null)} disabled={!classSubjectConfigs.length}>
          Rebalance loads
        </button>
            <button type="button" style={ghostBtnSx} onClick={autoAssignHomerooms} disabled={!classSubjectConfigs.length}>
            Auto assign homerooms
          </button>
            <button type="button" style={ghostBtnSx} onClick={clearAutomaticAssignments} disabled={!classSubjectConfigs.length}>
              Clear auto assignments
        </button>
        {subjFilter ? (
              <button type="button" style={ghostBtnSx} onClick={() => run('rebalance', Number(subjFilter) || null)}>
                Rebalance filtered subject
          </button>
        ) : null}

            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
              <label className="row" style={{ gap: 6, fontSize: 11, fontWeight: 750, cursor: 'pointer', color: '#64748b', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={manualOverrideMode} onChange={(e) => setManualOverrideMode(e.target.checked)} />
                Manual edit
        </label>
              {showBulkActions ? (
                <button type="button" style={ghostBtnSx} onClick={() => setBulkDrawerOpen(true)}>
                  Bulk actions
                </button>
              ) : null}
              <button type="button" style={ghostBtnSx} onClick={() => setInsightsOpen(true)}>
                Insights
              </button>
            </div>
          </div>

          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 2 }}>
            {filterUi ? (
              <>
                <div style={{ flex: '0 1 140px', minWidth: 104 }}>
                  <SelectKeeper
                    value={filterUi.subjectValue}
                    onChange={filterUi.onSubjectChange}
                    options={filterUi.subjectOptions}
                    emptyValueLabel="All subjects"
                  />
                </div>
                <div style={{ flex: '0 1 120px', minWidth: 96 }}>
                  <SelectKeeper
                    value={filterUi.gradeValue}
                    onChange={filterUi.onGradeChange}
                    options={filterUi.gradeOptions}
                    emptyValueLabel="All grades"
                  />
                </div>
                <div style={{ flex: '0 1 140px', minWidth: 104 }}>
                  <SelectKeeper
                    value={filterUi.teacherValue}
                    onChange={filterUi.onTeacherChange}
                    options={filterUi.teacherOptions}
                    emptyValueLabel="All teachers"
                  />
                </div>
              </>
            ) : null}
            <input
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              placeholder="Search sections…"
              style={{
                flex: filterUi ? '1 1 140px' : '1 1 200px',
                minWidth: filterUi ? 120 : 160,
                maxWidth: 280,
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(15,23,42,0.12)',
              }}
            />
            <details style={{ flex: '0 0 auto' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  listStyle: 'none',
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid rgba(15,23,42,0.08)',
                  background: 'rgba(248,250,252,0.9)',
                  whiteSpace: 'nowrap',
                }}
              >
                More filters
              </summary>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="row" style={{ gap: 6, fontSize: 11, fontWeight: 750, cursor: 'pointer', alignItems: 'center', opacity: 0.88 }}>
            <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
            Only unassigned
          </label>
                <label
                  className="row"
                  style={{ gap: 6, fontSize: 11, fontWeight: 750, cursor: 'pointer', alignItems: 'center', opacity: 0.88 }}
                  title="Teacher-lock or room-lock enabled"
                >
            <input type="checkbox" checked={onlyLocked} onChange={(e) => setOnlyLocked(e.target.checked)} />
            Only locked
          </label>
                <label className="row" style={{ gap: 6, fontSize: 11, fontWeight: 750, cursor: 'pointer', alignItems: 'center', opacity: 0.88 }}>
            <input type="checkbox" checked={onlyOverloaded} onChange={(e) => setOnlyOverloaded(e.target.checked)} />
            Only overloaded
          </label>
                <label className="row" style={{ gap: 6, fontSize: 11, fontWeight: 750, cursor: 'pointer', alignItems: 'center', opacity: 0.88 }}>
            <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} />
            Only conflicts
          </label>
        </div>
            </details>
      </div>

          <div className="stack" style={{ gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 950, fontSize: 15 }}>
                {`Needs attention (${needsAttention.needs.length} row${needsAttention.needs.length === 1 ? '' : 's'})`}
              </div>
              <div
                className="muted"
                style={{ fontSize: 11, fontWeight: 700, opacity: 0.78, marginTop: 6 }}
                title="missing teacher · overload · preferred room missing · conflicts · locked conflicts"
              >
                {filterSummaryText}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 — Review workspace */}
      <div className="stack" style={{ gap: 24 }}>
          {flatRows.length === 0 ? (
          <div className="muted" style={{ padding: '12px 8px', fontSize: 12, opacity: 0.82 }}>
              No section mappings yet. First click <strong>Configure class</strong> for a grade to enable subjects and set default periods.
              Then come back and click <strong>Auto assign teachers</strong>.
            </div>
          ) : (
          <>
            <div style={{ padding: '8px 8px 16px', minWidth: 0 }}>
                {needsAttention.needs.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, opacity: 0.82 }}>
                  No issues found in the current filters.
                </div>
                ) : (
                  renderGrouped(groupedNeeds, true)
                )}
              </div>

            <details
              style={{
                borderRadius: 12,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(248,250,252,0.55)',
                padding: '10px 12px',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13, listStyle: 'none' }}>
                Healthy assignments ({needsAttention.healthy.length} row{needsAttention.healthy.length === 1 ? '' : 's'})
              </summary>
              <div style={{ marginTop: 16 }}>
                {needsAttention.healthy.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, opacity: 0.82 }}>
                    No healthy rows for current filters.
                  </div>
                ) : (
                  renderGrouped(groupedHealthy, false)
                )}
              </div>
            </details>
          </>
          )}
      </div>

      {insightsOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.35)',
            zIndex: 55,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setInsightsOpen(false)}
        >
          <div
            style={{ width: 'min(520px, 92vw)', height: '100%', background: 'white', padding: 14, overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Insights</div>
              <button type="button" className="btn secondary" onClick={() => setInsightsOpen(false)}>
                Close
              </button>
            </div>

            <div className="stack" style={{ gap: 12, marginTop: 12 }}>
              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div style={{ fontWeight: 950 }}>Recommendations</div>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {kpis.pending > 0 ? (
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <div>⚠ {kpis.pending} rows missing teacher</div>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => {
                          setOnlyUnassigned(true);
                          setOnlyConflicts(false);
                          setOnlyOverloaded(false);
                          setSectionSearch('');
                          setInsightsOpen(false);
                        }}
                      >
                        View
                      </button>
                    </div>
                  ) : (
                    <div>• All rows have a teacher</div>
                  )}
                  {missingTeacherReport.length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 950, marginBottom: 6 }}>
                        Missing teacher mappings for
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>Subject</th>
                              <th>Code</th>
                              <th>Class</th>
                              <th>Sections</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingTeacherReport.slice(0, 12).map((r) => (
                              <tr key={`${r.subjectId}:${r.grade ?? ''}`}>
                                <td style={{ fontWeight: 900 }}>{r.subjectName}</td>
                                <td className="muted" style={{ fontWeight: 900 }}>{r.subjectCode || '—'}</td>
                                <td>{r.grade != null ? `Class ${r.grade}` : '—'}</td>
                                <td title={r.sections.join(', ')}>
                                  {r.sections.length <= 3 ? r.sections.join(', ') : `${r.sections.slice(0, 3).join(', ')} (+${r.sections.length - 3} more)`}
                                </td>
                                <td className="muted">
                                  {r.reasons.has('NO_ELIGIBLE_TEACHER')
                                    ? 'No eligible teacher'
                                    : r.reasons.has('UNKNOWN')
                                      ? 'Unknown subject'
                                      : r.reasons.has('CAPACITY_OVERFLOW')
                                        ? 'Capacity overflow'
                                        : 'Unassigned'}
                                </td>
                              </tr>
                            ))}
                            {missingTeacherReport.length > 12 ? (
                              <tr>
                                <td colSpan={4} className="muted" style={{ padding: 10 }}>
                                  Showing top 12. Use <strong>View</strong> to open the full list in the grid.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {kpis.overloadedTeachers > 0 ? (
                    <div>
                      • {kpis.overloadedTeachers} teacher(s) overloaded — try <strong>Rebalance loads</strong>
                      <div style={{ marginTop: 4 }}>
                        {loadRows
                          .filter((r) => r.status === 'over')
                          .slice(0, 8)
                          .map((r) => (
                            <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                              <div>
                                ⚠ {r.name} overloaded by {Math.max(0, r.load - r.max)}
                                {r.subjectLabels && r.subjectLabels !== '—' ? (
                                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                    Subjects: {r.subjectLabels}
                                  </div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: 12, padding: '2px 8px' }}
                                onClick={() => {
                                  setOnlyOverloaded(true);
                                  setInsightsOpen(false);
                                }}
                              >
                                Fix now
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div>• No overloaded teachers</div>
                  )}

                  {kpis.conflicts > 0 ? (
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <div>⚠ {kpis.conflicts} conflicts</div>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => {
                          setOnlyConflicts(true);
                          setOnlyUnassigned(false);
                          setInsightsOpen(false);
                        }}
                      >
                        Open
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div style={{ fontWeight: 950 }}>Teacher load</div>
                <div className="stack" style={{ gap: 8 }}>
                  {loadRows
                    .slice()
                    .sort((a, b) => b.load - a.load)
                    .map((r) => {
                      const ratio = r.max > 0 ? r.load / r.max : 0;
                      const barColor = ratio > 1 ? '#b91c1c' : ratio > 0.85 ? '#c2410c' : '#16a34a';
                      return (
                        <div key={r.id}>
                          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.name}
                            </div>
                            <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                              {r.load}/{r.max}
                            </div>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden', marginTop: 4 }}>
                            <div style={{ width: `${Math.min(140, Math.round((r.load / Math.max(1, r.max)) * 100))}%`, height: '100%', background: barColor }} />
                          </div>
                          {r.status === 'over' ? (
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c', marginTop: 4 }}>
                              Overloaded +{Math.max(0, r.load - r.max)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDrawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.35)',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ width: 'min(520px, 92vw)', height: '100%', background: 'white', padding: 14, overflow: 'auto' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Bulk actions</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Scope uses current filters: {gradeFilter ? `Class ${gradeFilter}` : 'All grades'} {subjFilter ? `· Subject ${subjFilter}` : ''}
                </div>
              </div>
              <button type="button" className="btn secondary" onClick={() => setBulkDrawerOpen(false)}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 12 }} className="stack">
              <div className="sms-alert sms-alert--info">
                <div>
                  <div className="sms-alert__title">Preview</div>
                  <div className="sms-alert__msg">
                    This will affect <strong>{flatRows.length}</strong> row(s) in the current view.
                  </div>
                </div>
              </div>

              <div className="stack">
                <label style={{ fontSize: 12, fontWeight: 900 }}>Teacher (grade+subject)</label>
            <SelectKeeper
              value={bulkTid}
              onChange={setBulkTid}
              options={[
                    { value: '', label: 'Select teacher…' },
                    ...staff.filter((s) => (s.roleNames ?? []).includes('TEACHER')).map((s) => ({ value: String(s.id), label: s.fullName || s.email })),
              ]}
            />
            <button
              type="button"
                  className="btn"
              disabled={!bulkTid || !gradeFilter || !subjFilter}
              onClick={() => {
                const g = Number(gradeFilter);
                const s = Number(subjFilter);
                const t = Number(bulkTid);
                if (!Number.isFinite(g) || !Number.isFinite(s) || !Number.isFinite(t)) return;
                const r = applyUniformGradeSubjectTeacher(classSubjectConfigs, sectionSubjectOverrides, cgs, g, s, t);
                setClassSubjectConfigs(r.cfg);
                setSectionSubjectOverrides(r.ovs);
                setAssignmentMeta((m) => {
                  const n = { ...m };
                  for (const cg of classGroups) {
                    if (Number(cg.gradeLevel) !== g) continue;
                    const sk = slotKey(cg.classGroupId, s);
                    n[sk] = mergeAssignmentSlotMeta(n[sk], { source: 'manual', locked: true });
                  }
                  return n;
                });
                toast.success('Bulk', `Teacher applied to all sections in class ${g} for the selected subject.`);
              }}
            >
                  Apply teacher
            </button>
          </div>

              <div className="stack">
                <label style={{ fontSize: 12, fontWeight: 900 }}>Room (grade+subject)</label>
                        <SelectKeeper
                  value={bulkRoomId}
                  onChange={setBulkRoomId}
                  options={[
                    { value: '', label: '🏠 Homeroom' },
                    ...roomOptions.filter((r) => r.value !== ''),
                  ]}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!gradeFilter || !subjFilter}
                  onClick={() => {
                    const g = Number(gradeFilter);
                    const s = Number(subjFilter);
                    if (!Number.isFinite(g) || !Number.isFinite(s)) return;
                    const rid = bulkRoomId && bulkRoomId.trim() !== '' ? Number(bulkRoomId) : null;
                    if (bulkRoomId && bulkRoomId.trim() !== '' && !Number.isFinite(rid)) return;
                    const inGrade = classGroups.filter((cg) => Number(cg.gradeLevel) === g).map((cg) => cg.classGroupId);
                    setSectionSubjectOverrides((prev) => {
                      const next = prev.slice();
                      const idxByKey = new Map<string, number>();
                      for (let i = 0; i < next.length; i++) idxByKey.set(`${next[i]!.classGroupId}:${next[i]!.subjectId}`, i);
                      for (const cid of inGrade) {
                        const key = `${cid}:${s}`;
                        const idx = idxByKey.get(key);
                        if (idx != null) next[idx] = { ...next[idx]!, roomId: rid };
                        else next.push({ classGroupId: cid, subjectId: s, periodsPerWeek: null, teacherId: null, roomId: rid });
                      }
                      return next;
                    });
                    setAssignmentMeta((m) => {
                      const n = { ...m };
                      for (const cid of inGrade) {
                        const sk = slotKey(cid, s);
                        n[sk] = mergeAssignmentSlotMeta(n[sk], {
                          source: n[sk]?.source ?? 'manual',
                          locked: n[sk]?.locked ?? false,
                          conflictReason: n[sk]?.conflictReason,
                          roomSource: 'manual',
                          roomLocked: true,
                        });
                      }
                      return n;
                    });
                    toast.success('Bulk', `Room applied to all sections in class ${g} for the selected subject.`);
                  }}
                >
                  Apply room
                </button>
              </div>

              <div className="stack">
                <label style={{ fontSize: 12, fontWeight: 900 }}>Lock filtered grade rows</label>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn secondary"
                  disabled={!gradeFilter}
                  onClick={() => {
                    const g = Number(gradeFilter);
                    if (!Number.isFinite(g)) return;
                    const inGrade = classGroups.filter((cg) => Number(cg.gradeLevel) === g).map((cg) => cg.classGroupId);
                    setAssignmentMeta((m) => {
                      const n = { ...m };
                      for (const row of flatRows) {
                        if (!inGrade.includes(row.classGroupId)) continue;
                        const cur = n[row.k];
                          n[row.k] = mergeAssignmentSlotMeta(cur, {
                            source: cur?.source ?? 'manual',
                            locked: true,
                            conflictReason: cur?.conflictReason,
                          });
                      }
                      return n;
                    });
                      toast.success('Bulk', `Teacher-lock applied to visible slots in Class ${g}.`);
                    }}
                  >
                    Lock teachers
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={!gradeFilter}
                    onClick={() => {
                      const g = Number(gradeFilter);
                      if (!Number.isFinite(g)) return;
                      const inGrade = classGroups.filter((cg) => Number(cg.gradeLevel) === g).map((cg) => cg.classGroupId);
                      setAssignmentMeta((m) => {
                        const n = { ...m };
                        for (const row of flatRows) {
                          if (!inGrade.includes(row.classGroupId)) continue;
                          const cur = n[row.k];
                          n[row.k] = mergeAssignmentSlotMeta(cur, {
                            source: cur?.source ?? 'manual',
                            locked: cur?.locked ?? false,
                            conflictReason: cur?.conflictReason,
                            roomLocked: true,
                            roomSource: cur?.roomSource ?? 'manual',
                          });
                        }
                        return n;
                      });
                      toast.success('Bulk', `Room-lock applied to visible slots in Class ${g}.`);
                    }}
                  >
                    Lock rooms
                        </button>
                </div>
        </div>
      </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TeacherLoadDashboard({
  classGroups,
  staff,
  classSubjectConfigs,
  sectionSubjectOverrides,
  filters,
  subjectsCatalogForLabels,
  slotsPerWeek,
}: {
  classGroups: ClassG[];
  staff: StaffRow[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  filters?: { grade: string; subject: string; teacher: string };
  subjectsCatalogForLabels: { id: number; name: string; code: string }[];
  slotsPerWeek?: number | null;
}) {
  const cgs = useMemo(
    () => classGroups.map((c) => ({ classGroupId: c.classGroupId, gradeLevel: c.gradeLevel })),
    [classGroups],
  );
  const effective = useMemo(
    () => buildEffectiveAllocRows(cgs, classSubjectConfigs, sectionSubjectOverrides),
    [cgs, classSubjectConfigs, sectionSubjectOverrides],
  );
  const anyAssigned = useMemo(() => effective.some((e) => e.staffId != null), [effective]);
  const teacherFilter = filters?.teacher ?? '';

  const staffNorm = useMemo(
    () =>
      staff.map((s) => ({
        ...s,
        maxWeeklyLectureLoad: s.maxWeeklyLectureLoad ?? null,
        preferredClassGroupIds: s.preferredClassGroupIds ?? null,
      })),
    [staff],
  );

  const rows = useMemo(() => {
    const base = buildTeacherLoadRows(
      effective,
      staffNorm,
      subjectsCatalogForLabels.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      slotsPerWeek ?? null,
    );
    return teacherFilter ? base.filter((r) => String(r.id) === teacherFilter) : base;
  }, [effective, staffNorm, subjectsCatalogForLabels, teacherFilter, slotsPerWeek]);

  if (!classSubjectConfigs.length) {
    return <div className="muted">No load data yet. First configure a class template.</div>;
  }
  if (!anyAssigned) {
    return <div className="muted">No assignments yet. Click <strong>Auto assign teachers</strong> to generate teacher loads.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Subjects</th>
            <th>Load</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const color = r.status === 'over' ? '#b91c1c' : r.status === 'near' ? '#c2410c' : '#166534';
            const label = r.status === 'over' ? 'Overloaded' : r.status === 'near' ? 'Near limit' : 'Healthy';
            return (
              <tr key={r.id}>
                <td style={{ fontWeight: 800 }}>{r.name}</td>
                <td>{r.subjectLabels}</td>
                <td>
                  {r.load} / {r.max}
                </td>
                <td style={{ color, fontWeight: 800 }}>{label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
