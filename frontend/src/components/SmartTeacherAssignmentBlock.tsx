import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SelectKeeper } from './SelectKeeper';
import { toast } from '../lib/toast';
import {
  buildEffectiveAllocRows,
  homeroomMapFromDraft,
  otherClassGroupIdsSharingHomeroomRoom,
  sectionHasAssignedRoomDraft,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from '../lib/academicStructureUtils';
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
import { parseSubjectVenueRequirement } from '../lib/subjectVenueRequirement';
import {
  formatCompatibleRoomTypesList,
  isRoomTypeCompatible,
  parseRoomVenueType,
  schoolHasAnyCompatibleRoom,
} from '../lib/roomVenueCompatibility';
import { sectionMissingClassTeacher } from '../lib/classTeacherAutoAssign';
import {
  AssignmentSourceBadge,
  ProvenanceBadgeGroup,
  SectionBulkLockBadge,
} from './AssignmentProvenanceBadges';

const toolbarOutlineBtnSx: Record<string, string | number> = {
  border: '1px solid rgba(15,23,42,0.16)',
  background: '#fff',
  color: '#475569',
  fontSize: 12,
  fontWeight: 700,
  padding: '6px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const toolbarMenuPanelSx: Record<string, string | number> = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 6,
  minWidth: 288,
  maxWidth: 380,
  zIndex: 25,
  background: '#fff',
  border: '1px solid rgba(15,23,42,0.1)',
  borderRadius: 10,
  boxShadow: '0 10px 40px rgba(15,23,42,0.12)',
  padding: '8px 0',
};

const menuSectionLabelSx: Record<string, string | number> = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#94a3b8',
  padding: '6px 12px 4px',
};

const menuItemBtnSx: Record<string, string | number> = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
  cursor: 'pointer',
};

const menuItemDangerSx: Record<string, string | number> = {
  ...menuItemBtnSx,
  color: '#b91c1c',
  fontWeight: 700,
};

const menuDividerSx: Record<string, string | number> = {
  height: 1,
  margin: '6px 0',
  background: 'rgba(15,23,42,0.06)',
  border: 'none',
};

function ToolbarDropdown({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          ...toolbarOutlineBtnSx,
          opacity: disabled ? 0.45 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        {label}{' '}
        <span style={{ fontSize: 10, opacity: 0.65 }} aria-hidden>
          ▾
        </span>
      </button>
      {open && !disabled ? <div style={toolbarMenuPanelSx}>{children(close)}</div> : null}
    </div>
  );
}

type DemandSortKey = 'subject' | 'required' | 'qualified' | 'capacity' | 'teachersNeeded' | 'status';

const DEMAND_STATUS_RANK: Record<TeacherDemandStatus, number> = {
  CRITICAL: 0,
  WARN: 1,
  OK: 2,
};

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

function formatClassGroupShortLabel(cg: ClassG): string {
  if (cg.gradeLevel != null && String(cg.section ?? cg.code ?? '').trim()) {
    return `Class ${cg.gradeLevel} ${cg.section ?? cg.code}`;
  }
  return cg.displayName || cg.code || `Section ${cg.classGroupId}`;
}
type Sub = {
  id: number;
  name: string;
  code: string;
  weeklyFrequency: number | null;
  allocationVenueRequirement?: string | null;
  specializedVenueType?: string | null;
};

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
  roomOptions: { value: string; label: string; roomType?: string | null }[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  setClassSubjectConfigs: React.Dispatch<React.SetStateAction<ClassSubjectConfigRow[]>>;
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  setSectionSubjectOverrides: React.Dispatch<React.SetStateAction<SectionSubjectOverrideRow[]>>;
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  setAssignmentMeta: React.Dispatch<React.SetStateAction<Record<string, AssignmentSlotMeta>>>;
  subjectsCatalogForLabels: Sub[];
  filters?: { grade: string; subject: string; teacher: string };
  showBulkActions?: boolean;
  /** Single bulk homeroom automation (uses floor/building/capacity-aware placement). */
  autoAssignHomerooms: () => void;
  /** Greedy assignment of homeroom (class) teachers from effective subject-teaching allocations. */
  autoAssignClassTeachers: () => void;
  /** Clears section homeroom draft only. */
  clearHomeroomDraft?: () => void;
  /** Clears class teachers assigned via Auto assign class teachers only. */
  clearAutoAssignedClassTeachers?: () => void;
  /** Clears every section's class teacher (manual and auto). */
  clearAllClassTeacherAssignments?: () => void;
  /** Clears homeroom draft + auto class teachers (combined). */
  clearAutoHomeroomAssignments?: () => void;
  /**
   * Draft homerooms keyed by classGroupId → room id string (same persistence as overview homeroom column).
   */
  defaultRoomByClassId: Record<number, string>;
  /** Tracks whether each section homeroom was last set automatically vs manually (controls bulk overwrite). */
  homeroomSourceByClassId?: Record<number, 'auto' | 'manual' | ''>;
  homeroomLockedByClassId: Record<number, boolean>;
  patchHomeroomLock: (classGroupId: number, locked: boolean) => void;
  patchSectionHomeroom: (classGroupId: number, value: string) => void;
  /** Same option list as Overview homeroom picker (building + room label). */
  homeroomSelectOptions: { value: string; label: string }[];
  /** Section homeroom teacher (class teacher) — same draft as Overview. */
  classTeacherByClassId: Record<number, string>;
  classTeacherSourceByClassId?: Record<number, 'auto' | 'manual' | ''>;
  classTeacherLockedByClassId: Record<number, boolean>;
  patchSectionClassTeacher: (classGroupId: number, staffIdValue: string) => void;
  patchClassTeacherLock: (classGroupId: number, locked: boolean) => void;
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
  subjectsCatalogForLabels,
  filters,
  showBulkActions = false,
  autoAssignHomerooms,
  autoAssignClassTeachers,
  clearHomeroomDraft,
  clearAutoAssignedClassTeachers,
  clearAllClassTeacherAssignments,
  clearAutoHomeroomAssignments: _clearAutoHomeroomAssignments,
  defaultRoomByClassId,
  homeroomSourceByClassId = {},
  homeroomLockedByClassId,
  patchHomeroomLock,
  patchSectionHomeroom,
  homeroomSelectOptions,
  classTeacherByClassId,
  classTeacherSourceByClassId = {},
  classTeacherLockedByClassId,
  patchSectionClassTeacher,
  patchClassTeacherLock,
  slotsPerWeek,
  overviewContext = null,
  filterUi = null,
}: Props) {
  const [manualOverrideMode, setManualOverrideMode] = useState(false);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [bulkTid, setBulkTid] = useState<string>('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [onlyLocked, setOnlyLocked] = useState(false);
  const [onlyOverloaded, setOnlyOverloaded] = useState(false);
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);
  const [onlyManualOverrides, setOnlyManualOverrides] = useState(false);
  /** Single expanded assignment row slot key per section (classGroupId). */
  const [expandedSlotByClassId, setExpandedSlotByClassId] = useState<Record<number, string>>({});
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

  const sectionsMissingRoomCount = useMemo(
    () => classGroups.filter((cg) => !sectionHasAssignedRoomDraft(cg.classGroupId, defaultRoomByClassId)).length,
    [classGroups, defaultRoomByClassId],
  );

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

  const classTeacherStaffOptions = useMemo(() => {
    const opts = staff
      .filter((s) => (s.roleNames ?? []).includes('TEACHER'))
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }))
      .map((s) => ({ value: String(s.id), label: s.fullName || s.email || `Staff ${s.id}` }));
    return [{ value: '', label: 'No class teacher' }, ...opts];
  }, [staff]);

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

  const schedulableRoomTypeValues = useMemo(
    () =>
      roomOptions
        .map((o) => (o.value ? o.roomType : null))
        .filter((x): x is string => x != null && String(x).trim().length > 0),
    [roomOptions],
  );

  const scopedGridRows = useMemo(() => {
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
      const s = subjects.find((x) => x.id === a.subjectId) ?? subjectsCatalogForLabels.find((x) => x.id === a.subjectId);
      const subName = s?.name?.trim() ? s.name : `Subject ${a.subjectId}`;
      out.push({
        classGroupId: a.classGroupId,
        subId: a.subjectId,
        subName,
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
      const anyLocked = teacherLocked;
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
      if (onlyManualOverrides) {
        const mm = assignmentMeta[r.k];
        const manualSurface = mm?.source === 'manual' || (mm?.locked ?? false);
        if (!manualSurface) return false;
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
    subjectsCatalogForLabels,
    teacherCanTeach,
    assignmentMeta,
    onlyUnassigned,
    onlyLocked,
    onlyConflicts,
    onlyOverloaded,
    onlyManualOverrides,
    sectionSearch,
    teacherLoadById,
  ]);

  const needsAttention = useMemo(() => {
    const needs: (typeof scopedGridRows)[number][] = [];
    const healthy: (typeof scopedGridRows)[number][] = [];
    for (const r of scopedGridRows) {
      const m = assignmentMeta[r.k];
      const locked = m?.locked ?? false;
      const src = m?.source ?? null;
      const teacherOver = r.staffId != null ? teacherLoadById.get(Number(r.staffId))?.status === 'over' : false;
      const subRow =
        subjects.find((x) => Number(x.id) === Number(r.subId)) ??
        subjectsCatalogForLabels.find((x) => Number(x.id) === Number(r.subId));
      const req = parseSubjectVenueRequirement(subRow?.allocationVenueRequirement);
      const spec = parseRoomVenueType(subRow?.specializedVenueType ?? undefined);
      const effRoomType =
        r.roomId != null ? roomOptions.find((o) => o.value === String(r.roomId))?.roomType ?? null : null;
      const noSchoolVenue =
        req !== 'FLEXIBLE' &&
        (r.periods ?? 0) > 0 &&
        !schoolHasAnyCompatibleRoom(schedulableRoomTypeValues, req, spec);
      const venueMismatch =
        req !== 'FLEXIBLE' &&
        (r.periods ?? 0) > 0 &&
        !noSchoolVenue &&
        (effRoomType == null || !isRoomTypeCompatible(req, spec, effRoomType));
      const missingTeacher = r.staffId == null && (r.periods ?? 0) > 0;
      const conflict =
        src === 'conflict' || m?.conflictReason === 'NO_ELIGIBLE_TEACHER' || m?.conflictReason === 'UNKNOWN';

      const isNeeds =
        missingTeacher ||
        teacherOver ||
        noSchoolVenue ||
        venueMismatch ||
        conflict ||
        (locked && (missingTeacher || teacherOver || noSchoolVenue || venueMismatch || conflict));

      if (isNeeds) needs.push(r);
      else healthy.push(r);
    }
    return { needs, healthy };
  }, [
    scopedGridRows,
    assignmentMeta,
    teacherLoadById,
    homeroomMap,
    subjects,
    subjectsCatalogForLabels,
    roomOptions,
    schedulableRoomTypeValues,
  ]);

  const needsAttentionKeySet = useMemo(() => new Set(needsAttention.needs.map((r) => r.k)), [needsAttention.needs]);

  const flatRows = useMemo(() => {
    if (!onlyNeedsAttention) return scopedGridRows;
    return scopedGridRows.filter((r) => needsAttentionKeySet.has(r.k));
  }, [scopedGridRows, onlyNeedsAttention, needsAttentionKeySet]);

  /** Partition AFTER all quick/list filters — drives Needs / Healthy grids and counts. */
  const displayAttention = useMemo(() => {
    const needs: (typeof flatRows)[number][] = [];
    const healthy: (typeof flatRows)[number][] = [];
    for (const r of flatRows) {
      const m = assignmentMeta[r.k];
      const locked = m?.locked ?? false;
      const src = m?.source ?? null;
      const teacherOver = r.staffId != null ? teacherLoadById.get(Number(r.staffId))?.status === 'over' : false;
      const subRow =
        subjects.find((x) => Number(x.id) === Number(r.subId)) ??
        subjectsCatalogForLabels.find((x) => Number(x.id) === Number(r.subId));
      const req = parseSubjectVenueRequirement(subRow?.allocationVenueRequirement);
      const spec = parseRoomVenueType(subRow?.specializedVenueType ?? undefined);
      const effRoomType =
        r.roomId != null ? roomOptions.find((o) => o.value === String(r.roomId))?.roomType ?? null : null;
      const noSchoolVenue =
        req !== 'FLEXIBLE' &&
        (r.periods ?? 0) > 0 &&
        !schoolHasAnyCompatibleRoom(schedulableRoomTypeValues, req, spec);
      const venueMismatch =
        req !== 'FLEXIBLE' &&
        (r.periods ?? 0) > 0 &&
        !noSchoolVenue &&
        (effRoomType == null || !isRoomTypeCompatible(req, spec, effRoomType));
      const missingTeacher = r.staffId == null && (r.periods ?? 0) > 0;
      const conflictInner =
        src === 'conflict' || m?.conflictReason === 'NO_ELIGIBLE_TEACHER' || m?.conflictReason === 'UNKNOWN';

      const isNeeds =
        missingTeacher ||
        teacherOver ||
        noSchoolVenue ||
        venueMismatch ||
        conflictInner ||
        (locked && (missingTeacher || teacherOver || noSchoolVenue || venueMismatch || conflictInner));

      if (isNeeds) needs.push(r);
      else healthy.push(r);
    }
    return { needs, healthy };
  }, [
    flatRows,
    assignmentMeta,
    teacherLoadById,
    homeroomMap,
    subjects,
    subjectsCatalogForLabels,
    roomOptions,
    schedulableRoomTypeValues,
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
    for (const r of displayAttention.needs) {
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
  }, [displayAttention.needs, classGroups, subjectCodeById, assignmentMeta]);

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

  const groupedNeeds = useMemo(() => groupRows(displayAttention.needs), [groupRows, displayAttention.needs]);
  const groupedHealthy = useMemo(() => groupRows(displayAttention.healthy), [groupRows, displayAttention.healthy]);

  const toggleExpandedRow = useCallback((classGroupId: number, slotKey: string) => {
    setExpandedSlotByClassId((prev) => {
      const next = { ...prev };
      if (next[classGroupId] === slotKey) delete next[classGroupId];
      else next[classGroupId] = slotKey;
      return next;
    });
  }, []);

  /** Clear slot teacher locks, then rebalance for this subject. */
  const resetAssignmentSlotTowardAutoPool = useCallback(
    (row: (typeof flatRows)[number]) => {
      const k = row.k;
      const baseMeta = { ...assignmentMeta };
      delete baseMeta[k];
      const r = runSmartTeacherAssignment(
        cgs,
        staffNorm,
        subjects,
        classSubjectConfigs,
        sectionSubjectOverrides,
        baseMeta,
        'rebalance',
        row.subId,
        slotsPerWeek ?? null,
        homeroomMap,
      );
      setClassSubjectConfigs(r.classSubjectConfigs);
      setSectionSubjectOverrides(r.sectionSubjectOverrides);
      setAssignmentMeta(r.assignmentMeta);
      toast.info('Slot reset toward auto', 'Unlocked for algorithms · rebalance ran for this subject.');
    },
    [
      assignmentMeta,
      cgs,
      staffNorm,
      subjects,
      classSubjectConfigs,
      sectionSubjectOverrides,
      slotsPerWeek,
      homeroomMap,
      setClassSubjectConfigs,
      setSectionSubjectOverrides,
      setAssignmentMeta,
    ],
  );

  const notifyHomeroomShared = useCallback(
    (classGroupId: number, roomIdStr: string) => {
      const rid = roomIdStr && String(roomIdStr).trim() !== '' ? Number(roomIdStr) : NaN;
      if (!Number.isFinite(rid)) return;
      const optimisticDraft = { ...defaultRoomByClassId, [classGroupId]: String(rid) };
      const otherIds = otherClassGroupIdsSharingHomeroomRoom(rid, optimisticDraft, classGroupId);
      if (otherIds.length === 0) return;
      const labels = otherIds.map((id) => {
        const sec = classGroups.find((c) => Number(c.classGroupId) === Number(id));
        return sec ? formatClassGroupShortLabel(sec) : `Section ${id}`;
      });
      const roomLabel = roomOptions.find((o) => o.value === String(rid))?.label ?? `Room #${rid}`;
      toast.info(
        'Homeroom already in use',
        `${roomLabel} is already the homeroom for ${labels.join(', ')}. Duplicates are allowed but flagged in Overview.`,
        7000,
      );
    },
    [classGroups, defaultRoomByClassId, roomOptions],
  );

  const slotControlWrap = (children: ReactNode) => (
    <div
      data-smart-assign-control
      style={{ minWidth: 0 }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  const renderRow = (row: (typeof flatRows)[number], cg: ClassG) => {
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

    const hmId = homeroomMap.get(row.classGroupId);
    const hasSectionHomeroom = hmId != null;

    const expanded = expandedSlotByClassId[cg.classGroupId] === row.k;

    const subMeta =
      subjects.find((x) => Number(x.id) === Number(row.subId)) ??
      subjectsCatalogForLabels.find((x) => Number(x.id) === Number(row.subId));
    const venueReq = parseSubjectVenueRequirement(subMeta?.allocationVenueRequirement);
    const venueSpec = parseRoomVenueType(subMeta?.specializedVenueType ?? undefined);
    const effRoomType =
      row.roomId != null ? roomOptions.find((o) => o.value === String(row.roomId))?.roomType ?? null : null;
    const noSchoolVenue =
      venueReq !== 'FLEXIBLE' &&
      (row.periods ?? 0) > 0 &&
      !schoolHasAnyCompatibleRoom(schedulableRoomTypeValues, venueReq, venueSpec);
    const venueMismatch =
      venueReq !== 'FLEXIBLE' &&
      (row.periods ?? 0) > 0 &&
      !noSchoolVenue &&
      (effRoomType == null || !isRoomTypeCompatible(venueReq, venueSpec, effRoomType));
    const missingTeacher = row.staffId == null && (row.periods ?? 0) > 0;

    let primarySummary = '';
    let primaryWorst = false;
    if ((row.periods ?? 0) <= 0) primarySummary = 'Off timetable';
    else if (!hasSectionHomeroom && (row.periods ?? 0) > 0) {
      primarySummary = 'No homeroom';
      primaryWorst = false;
    } else if (src === 'conflict' || m?.conflictReason === 'NO_ELIGIBLE_TEACHER' || m?.conflictReason === 'UNKNOWN') {
      primarySummary = conflictReasonLabel ?? 'Needs review';
      primaryWorst = true;
    } else if (missingTeacher) {
      primarySummary = 'Missing teacher';
      primaryWorst = true;
    } else if (tl?.status === 'over') {
      primarySummary = `Overloaded +${Math.max(0, load - max)}`;
      primaryWorst = true;
    } else if (m?.conflictReason === 'CAPACITY_OVERFLOW') {
      primarySummary = 'Capacity constrained';
      primaryWorst = true;
    } else if (noSchoolVenue) {
      primarySummary = `No compatible room for ${venueReq}`;
      primaryWorst = true;
    } else if (venueMismatch) {
      primarySummary = `Required venue: ${formatCompatibleRoomTypesList(venueReq)}`;
      primaryWorst = true;
    } else primarySummary = 'OK';

    const teacherRec = row.staffId != null ? staffById.get(Number(row.staffId)) : null;
    const reasoningPieces: string[] = [];
    if (src === 'auto' || src === 'rebalanced') {
      const gTxt = cg.gradeLevel != null ? String(cg.gradeLevel) : 'this grade';
      reasoningPieces.push(`Assigned toward same-grade cohesion and workload balance across Class ${gTxt}.`);
      if (teacherRec && (teacherRec.preferredClassGroupIds ?? []).includes(row.classGroupId)) {
        reasoningPieces.push(`Teacher lists this section in preferred classrooms.`);
      }
    }
    if (src === 'manual') reasoningPieces.push('Teacher explicitly chosen (manual edit); locks protect from bulk rebalance.');
    if (teacherLocked) reasoningPieces.push('Teacher lock is ON — algorithms keep this assignment unless unlocked.');
    if (missingTeacher || (src === 'conflict' && conflictReasonLabel)) {
      reasoningPieces.push(conflictReasonLabel ?? 'Eligible teacher not found yet — verify staff tagging or workloads.');
    }
    if (!hasSectionHomeroom && (row.periods ?? 0) > 0) {
      reasoningPieces.push('Set the section homeroom in the section header above, or use Overview / Auto assign homeroom.');
    }
    if (noSchoolVenue) {
      reasoningPieces.push(
        `No compatible room currently exists for subject type ${venueReq}. Add a schedulable room with one of: ${formatCompatibleRoomTypesList(venueReq)}.`,
      );
    } else if (venueMismatch) {
      reasoningPieces.push(
        `Homeroom room type may not match this subject’s venue (${venueReq}). Use the timetable editor for period-specific labs.`,
      );
    }
    if (hasSectionHomeroom && hmId != null) {
      const shareIds = otherClassGroupIdsSharingHomeroomRoom(Number(hmId), defaultRoomByClassId, row.classGroupId);
      if (shareIds.length > 0) {
        const labels = shareIds.map((id) => {
          const sec = classGroups.find((c) => Number(c.classGroupId) === Number(id));
          return sec ? formatClassGroupShortLabel(sec) : `Section ${id}`;
        });
        reasoningPieces.push(
          `This room is already the Overview homeroom for ${labels.join(', ')} — same duplicate-section-room case flagged in Overview.`,
        );
      }
    }
    if (!reasoningPieces.length) reasoningPieces.push('No extra notes — inspect demand summary above for shortages.');

    const shortSectionTitle =
      cg.gradeLevel != null && (cg.section || cg.code)?.trim?.()
        ? `Class ${cg.gradeLevel} · ${cg.section ?? cg.code}`
        : cg.displayName || cg.code || `Section ${cg.classGroupId}`;

    return (
      <div
        key={row.k}
        style={{
          borderRadius: 10,
          background: expanded ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(15,23,42,0.06)',
          marginBottom: 2,
          overflow: 'hidden',
        }}
      >
        {/* Collapsed strip: tap expands; controls stop propagation */}
        <div
          role="button"
          aria-expanded={expanded}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleExpandedRow(cg.classGroupId, row.k);
            }
          }}
          onClick={() => toggleExpandedRow(cg.classGroupId, row.k)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(120px, 1fr) minmax(160px, 1.25fr) 22px',
            gap: 10,
            alignItems: 'start',
            padding: '7px 10px',
            cursor: 'pointer',
            borderBottom: expanded ? '1px solid rgba(15,23,42,0.06)' : 'none',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 12.5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.subName} <span className="muted" style={{ fontWeight: 800 }}>({row.periods}/wk)</span>
            </div>
          </div>
          {slotControlWrap(
            <SelectKeeper
              searchable
              emptyValueLabel="Select…"
              value={row.staffId != null ? String(row.staffId) : ''}
              onChange={(v) => setTeacherOnSlot(row.classGroupId, row.subId, v)}
              options={teachOpts(row.subId)}
            />,
          )}
          <div
            title={primaryWorst ? `⚠ ${primarySummary}` : primarySummary}
            style={{
              fontSize: 11,
              fontWeight: 850,
              lineHeight: 1.35,
              textAlign: 'right',
              color: primaryWorst ? '#b91c1c' : primarySummary === 'OK' ? '#166534' : '#64748b',
              minWidth: 0,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
          >
            {primaryWorst ? '⚠ ' : ''}
            <span>{primarySummary}</span>
          </div>
          <div
            className="muted"
            style={{ fontSize: 14, fontWeight: 900, textAlign: 'center', alignSelf: 'center', paddingTop: 2 }}
            aria-hidden
          >
            {expanded ? '▾' : '▸'}
          </div>
        </div>

        {expanded ? (
          <div
            data-smart-assign-detail
            style={{
              padding: '10px 12px 12px',
              background: 'rgba(248,250,252,0.65)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 10, fontWeight: 850, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              {shortSectionTitle} · Assignment detail
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div className="stack" style={{ flex: '1 1 200px', minWidth: 0, gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.85 }}>Teacher</div>
                  {row.staffId != null && tl ? (
                    <div>
                      <div style={{ height: 8, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                        <div
                          style={{ width: `${Math.min(100, Math.round((load / Math.max(1, max)) * 100))}%`, height: '100%', background: barColor }}
                        />
                      </div>
                      <div className="muted" style={{ fontSize: 11, fontWeight: 850, marginTop: 4 }}>
                        Load {load}/{max}
                        {ratio > 1 ? ` · over +${Math.max(0, load - max)}` : ''}
                      </div>
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>No teacher yet</div>
                  )}
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <ProvenanceBadgeGroup>
                      {src === 'auto' || src === 'manual' ? (
                        <AssignmentSourceBadge variant={src === 'auto' ? 'auto' : 'manual'} />
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 11px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            background:
                              statusLabel === 'REBALANCED'
                                ? 'rgba(22,163,74,0.12)'
                                : statusLabel === 'CONFLICT'
                                  ? 'rgba(220,38,38,0.10)'
                                  : 'rgba(100,116,139,0.10)',
                            color:
                              statusLabel === 'REBALANCED'
                                ? '#166534'
                                : statusLabel === 'CONFLICT'
                                  ? '#b91c1c'
                                  : '#64748b',
                          }}
                        >
                          {statusLabel}
                        </span>
                      )}
                      {teacherLocked ? <SectionBulkLockBadge kind="classTeacher" /> : null}
                    </ProvenanceBadgeGroup>
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
                      title={teacherLocked ? 'Unlock teacher assignment' : 'Lock teacher assignment'}
                      style={{
                        appearance: 'none',
                        border: '1px solid rgba(15,23,42,0.12)',
                        background: teacherLocked ? 'rgba(37,99,235,0.12)' : 'rgba(100,116,139,0.08)',
                        color: teacherLocked ? '#1d4ed8' : '#475569',
                        padding: '3px 9px',
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
              </div>

              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}
                  onClick={() => setTeacherOnSlot(row.classGroupId, row.subId, '')}
                >
                  Clear teacher
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}
                  onClick={() => resetAssignmentSlotTowardAutoPool(row)}
                  disabled={teacherLocked && row.staffId != null}
                  title={
                    teacherLocked && row.staffId != null
                      ? 'Unlock teacher lock first (or keep lock and use Rebalance loads from the toolbar).'
                      : 'Unlock slot meta and run a subject-scoped rebalance.'
                  }
                >
                  Reset to auto
                </button>
              </div>

              <div
                className="stack"
                style={{
                  gap: 6,
                  borderTop: '1px dashed rgba(15,23,42,0.12)',
                  paddingTop: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.85 }}>Assignment notes</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.45, color: '#475569' }}>
                  {reasoningPieces.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                {conflictReasonLabel && src === 'conflict' ? (
                  <div style={{ fontSize: 11, fontWeight: 850, color: '#b91c1c' }}>Alert: {conflictReasonLabel}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderGrouped = (
    groups: { grade: number; sections: Array<{ cg: ClassG; rows: typeof flatRows }>; totalRows: number }[],
    defaultOpen: boolean,
  ) => {
    const statBadge = (label: string, tone: 'neutral' | 'bad' | 'good' | 'accent') => {
      const colors =
        tone === 'bad'
          ? { bg: 'rgba(220,38,38,0.10)', fg: '#b91c1c' }
          : tone === 'good'
            ? { bg: 'rgba(22,163,74,0.10)', fg: '#166534' }
            : tone === 'accent'
              ? { bg: 'rgba(37,99,235,0.10)', fg: '#1d4ed8' }
              : { bg: 'rgba(100,116,139,0.10)', fg: '#475569' };
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 900,
            background: colors.bg,
            color: colors.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      );
    };

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
              {g.sections.map(({ cg, rows }) => {
                const active = rows.filter((r) => (r.periods ?? 0) > 0);
                const missing = active.filter((r) => r.staffId == null).length;
                const overloadedSlots = active.filter((r) => {
                  if (r.staffId == null) return false;
                  return teacherLoadById.get(Number(r.staffId))?.status === 'over';
                }).length;
                const hmStr = defaultRoomByClassId[cg.classGroupId];
                const hasSectionHomeroom = hmStr != null && String(hmStr).trim() !== '';
                const hmLocked = homeroomLockedByClassId[cg.classGroupId] === true;
                const hmSrc = homeroomSourceByClassId[cg.classGroupId] ?? '';
                const ctLocked = classTeacherLockedByClassId[cg.classGroupId] === true;
                const shortTitle =
                  cg.gradeLevel != null && (cg.section || cg.code)?.trim?.()
                    ? `Class ${cg.gradeLevel}${cg.section ? ` ${String(cg.section).replace(/^\s+/, '')}` : ''}`
                    : cg.displayName || cg.code;

                return (
                  <details
                    key={cg.classGroupId}
                    open={defaultOpen}
                    style={{ border: '1px solid rgba(15,23,42,0.06)', borderRadius: 10, background: 'rgba(255,255,255,0.95)' }}
                  >
                    <summary
                      className="row"
                      style={{
                        cursor: 'pointer',
                        padding: '8px 9px',
                        listStyle: 'none',
                        gap: 10,
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{shortTitle}</div>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {statBadge(`${rows.length} subjects`, 'neutral')}
                          {statBadge(`${overloadedSlots} overloaded`, overloadedSlots ? 'bad' : 'good')}
                          {statBadge(`${missing} missing`, missing ? 'bad' : 'good')}
                          {hasSectionHomeroom ? statBadge('Homeroom set', 'good') : statBadge('No homeroom', 'bad')}
                        </div>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid rgba(15,23,42,0.06)',
                            width: '100%',
                          }}
                        >
                          <div className="stack" style={{ gap: 10 }}>
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 900, color: '#475569' }}>Homeroom</span>
                              <div style={{ minWidth: 140, flex: '1 1 180px', maxWidth: 380 }}>
                                <SelectKeeper
                                  searchable
                                  emptyValueLabel="No homeroom — choose or Auto assign"
                                  value={hasSectionHomeroom ? String(hmStr).trim() : ''}
                                  onChange={(v) => {
                                    patchSectionHomeroom(cg.classGroupId, v);
                                    notifyHomeroomShared(cg.classGroupId, v);
                                  }}
                                  options={homeroomSelectOptions.filter((o) => o.value !== '')}
                                  disabled={hmLocked}
                                />
                              </div>
                              <ProvenanceBadgeGroup>
                                {hasSectionHomeroom && (hmSrc === 'auto' || hmSrc === 'manual') ? (
                                  <AssignmentSourceBadge variant={hmSrc} />
                                ) : null}
                                {hmLocked ? <SectionBulkLockBadge kind="homeroom" /> : null}
                              </ProvenanceBadgeGroup>
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}
                                onClick={() => patchHomeroomLock(cg.classGroupId, !hmLocked)}
                                title={hmLocked ? 'Unlock homeroom (edits and bulk auto-assign allowed)' : 'Lock homeroom (skip bulk auto-assign)'}
                              >
                                {hmLocked ? 'Unlock' : 'Lock'}
                              </button>
                              {!hasSectionHomeroom ? (
                                <button
                                  type="button"
                                  className="btn secondary"
                                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999 }}
                                  onClick={() => autoAssignHomerooms()}
                                  disabled={hmLocked}
                                  title={
                                    hmLocked
                                      ? 'Unlock this section first'
                                      : 'Runs Auto assign homeroom for all unlocked sections school-wide.'
                                  }
                                >
                                  Auto assign
                                </button>
                              ) : null}
                            </div>
                            <div
                              className="row"
                              style={{
                                gap: 8,
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                minWidth: 0,
                              }}
                            >
                              <span style={{ fontSize: 11, fontWeight: 900, color: '#475569', flexShrink: 0 }}>
                                Class teacher
                              </span>
                              <div style={{ minWidth: 0, flex: '1 1 160px', maxWidth: 380 }}>
                                <SelectKeeper
                                  searchable
                                  value={classTeacherByClassId[cg.classGroupId] ?? ''}
                                  onChange={(v) => patchSectionClassTeacher(cg.classGroupId, v)}
                                  options={classTeacherStaffOptions}
                                  disabled={ctLocked}
                                />
                              </div>
                              <ProvenanceBadgeGroup>
                                {((classTeacherSourceByClassId[cg.classGroupId] ?? '') === 'auto' ||
                                  (classTeacherSourceByClassId[cg.classGroupId] ?? '') === 'manual') &&
                                (classTeacherByClassId[cg.classGroupId] ?? '').trim() !== '' ? (
                                  <AssignmentSourceBadge
                                    variant={(classTeacherSourceByClassId[cg.classGroupId] ?? '') === 'auto' ? 'auto' : 'manual'}
                                  />
                                ) : null}
                                {ctLocked ? <SectionBulkLockBadge kind="classTeacher" /> : null}
                              </ProvenanceBadgeGroup>
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, flexShrink: 0 }}
                                onClick={() => patchClassTeacherLock(cg.classGroupId, !ctLocked)}
                                title={
                                  ctLocked
                                    ? 'Unlock class teacher (edits and bulk auto-assign allowed)'
                                    : 'Lock class teacher (skip bulk Auto assign class teachers)'
                                }
                              >
                                {ctLocked ? 'Unlock' : 'Lock'}
                              </button>
                              {sectionMissingClassTeacher(cg.classGroupId, effective, classTeacherByClassId) ? (
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309', flexShrink: 0 }}>Missing</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </summary>
                    <div style={{ width: '100%', overflowX: 'hidden', padding: '4px 6px 8px' }}>
                      <div className="stack" style={{ gap: 0 }}>
                        {rows.map((row) => renderRow(row, cg))}
                      </div>
                    </div>
                  </details>
                );
              })}
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
      toast.success(
        'Smart assign',
        'Teachers applied by skill, grade cohesion, and load. Section rooms are allocated only via Overview or Auto assign homeroom.',
      );
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
      toast.info(
        'Reset',
        'Teacher auto/rebalanced assignments cleared where allowed. Locked teacher rows were preserved.',
      );
    }
  };

  const clearSubjectTeacherAssignments = () => {
    run('reset', null);
  };

  const clearAutoAssignedHomeroomsOnly = useCallback(() => {
    let n = 0;
    for (const cg of classGroups) {
      const id = cg.classGroupId;
      if ((homeroomSourceByClassId[id] ?? '') === 'auto') {
        patchSectionHomeroom(id, '');
        n += 1;
      }
    }
    toast.info('Homeroom', n ? `Cleared ${n} auto-assigned homeroom(s).` : 'No auto-assigned homerooms to clear.');
  }, [classGroups, homeroomSourceByClassId, patchSectionHomeroom]);

  const wipeAllSubjectTeachers = useCallback(() => {
    setClassSubjectConfigs((cfg) => cfg.map((r) => ({ ...r, defaultTeacherId: null })));
    setSectionSubjectOverrides((ov) => ov.map((r) => ({ ...r, teacherId: null })));
    setAssignmentMeta({});
    toast.info('Subject teachers', 'All subject teacher assignments cleared.');
  }, [setClassSubjectConfigs, setSectionSubjectOverrides, setAssignmentMeta]);

  const clearAllAssignmentsDestructive = useCallback(() => {
    if (
      !window.confirm(
        'Clear all assignments? This removes all subject teachers, class teachers, and homerooms in this draft. Save your academic structure to persist.',
      )
    )
      return;
    setClassSubjectConfigs((cfg) => cfg.map((r) => ({ ...r, defaultTeacherId: null })));
    setSectionSubjectOverrides((ov) => ov.map((r) => ({ ...r, teacherId: null })));
    setAssignmentMeta({});
    clearAllClassTeacherAssignments?.();
    clearHomeroomDraft?.();
    toast.info('Assignments', 'All assignments cleared in this draft.');
  }, [
    setClassSubjectConfigs,
    setSectionSubjectOverrides,
    setAssignmentMeta,
    clearAllClassTeacherAssignments,
    clearHomeroomDraft,
  ]);

  const unlockAllSubjectTeacherLocks = useCallback(() => {
    setAssignmentMeta((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        const m = next[k];
        if (m?.locked) next[k] = { ...m, locked: false };
      }
      return next;
    });
    toast.success('Locks', 'Subject teacher locks cleared.');
  }, [setAssignmentMeta]);

  const unlockAllClassTeacherLocksOnly = useCallback(() => {
    for (const cg of classGroups) {
      patchClassTeacherLock(cg.classGroupId, false);
    }
    toast.success('Locks', 'Class teacher locks cleared.');
  }, [classGroups, patchClassTeacherLock]);

  const unlockAllHomeroomLocksOnly = useCallback(() => {
    for (const cg of classGroups) {
      patchHomeroomLock(cg.classGroupId, false);
    }
    toast.success('Locks', 'Homeroom locks cleared.');
  }, [classGroups, patchHomeroomLock]);

  const unlockEverythingConfirmed = useCallback(() => {
    if (!window.confirm('Unlock everything? This removes all subject teacher locks, class teacher locks, and homeroom locks.')) return;
    setAssignmentMeta((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        const m = next[k];
        if (m?.locked) next[k] = { ...m, locked: false };
      }
      return next;
    });
    for (const cg of classGroups) {
      patchClassTeacherLock(cg.classGroupId, false);
      patchHomeroomLock(cg.classGroupId, false);
    }
    toast.success('Locks', 'All locks cleared.');
  }, [classGroups, patchClassTeacherLock, patchHomeroomLock, setAssignmentMeta]);

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
        const next = { ...m };
        delete next[k];
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
    if (onlyUnassigned) bits.push('Missing teacher');
    if (onlyLocked) bits.push('Locked');
    if (onlyOverloaded) bits.push('Overloaded');
    if (onlyConflicts) bits.push('Conflicts');
    if (onlyNeedsAttention) bits.push('Needs attention');
    if (onlyManualOverrides) bits.push('Manual overrides');
    return bits.length ? bits.join(' · ') : 'Showing all rows';
  }, [
    filterUi,
    sectionSearch,
    onlyUnassigned,
    onlyLocked,
    onlyOverloaded,
    onlyConflicts,
    onlyNeedsAttention,
    onlyManualOverrides,
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

  const filterChipSx = (active: boolean) =>
    ({
      ...ghostBtnSx,
      ...(active ? { borderColor: '#2563eb', background: 'rgba(37,99,235,0.08)', color: '#1d4ed8', fontWeight: 800 } : {}),
    }) as Record<string, string | number>;

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
          {sectionsMissingRoomCount > 0 ? (
            <div className="sms-alert sms-alert--info">
              <div>
                <div className="sms-alert__title">Sections without homeroom</div>
                <div className="sms-alert__msg">
                  {sectionsMissingRoomCount} section{sectionsMissingRoomCount === 1 ? '' : 's'} still need a default homeroom.
                  Use <strong>Auto assign homeroom</strong> below, set homeroom in each section header, or use <strong>Overview</strong>.
                  Subject rows show <strong>No homeroom</strong> until the section has one.
                </div>
              </div>
            </div>
          ) : null}
          <div
            className="row"
            style={{
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => run('auto', null)}
                disabled={!classSubjectConfigs.length || teacherDemand.hasSevereShortage}
                title={
                  teacherDemand.hasSevereShortage
                    ? 'Resolve severe shortages in Teacher demand summary (overview).'
                    : 'Assigns subject teachers only. Does not allocate section rooms.'
                }
              >
                Auto assign teachers
              </button>
              <button
                type="button"
                className="btn"
                onClick={autoAssignClassTeachers}
                disabled={!classSubjectConfigs.length}
                title="Pick a class teacher per section from current subject-teacher assignments (before timetable)."
              >
                Auto assign class teachers
              </button>
              <button
                type="button"
                className="btn"
                onClick={autoAssignHomerooms}
                disabled={!classSubjectConfigs.length}
                title="Assign default homeroom rooms from building/floor/capacity heuristics."
              >
                Auto assign homeroom
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => run('rebalance', null)}
                disabled={!classSubjectConfigs.length}
                title="Redistribute teachers on non-locked rows."
              >
                Rebalance loads
              </button>
            </div>

            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <ToolbarDropdown label="Reset">
                {(close) => (
                  <>
                    <div style={menuSectionLabelSx}>Auto-assigned only</div>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      disabled={!classSubjectConfigs.length}
                      title="Clears auto/rebalanced subject teachers; keeps manual and locked rows."
                      onClick={() => {
                        clearSubjectTeacherAssignments();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Clear auto-assigned teachers
                    </button>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      disabled={classGroups.length === 0 || clearAutoAssignedClassTeachers == null}
                      onClick={() => {
                        clearAutoAssignedClassTeachers?.();
                        toast.info('Class teachers', 'Cleared class teachers from Auto assign class teachers only.');
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Clear auto-assigned class teachers
                    </button>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      disabled={classGroups.length === 0}
                      onClick={() => {
                        clearAutoAssignedHomeroomsOnly();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Clear auto-assigned homerooms
                    </button>
                    <hr style={menuDividerSx} />
                    <div style={menuSectionLabelSx}>All assignments</div>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      disabled={!classSubjectConfigs.length}
                      title="Removes every subject teacher from templates and overrides."
                      onClick={() => {
                        wipeAllSubjectTeachers();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Clear subject teachers
                    </button>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      disabled={classGroups.length === 0 || clearAllClassTeacherAssignments == null}
                      onClick={() => {
                        clearAllClassTeacherAssignments?.();
                        toast.info('Class teachers', 'All class teachers cleared for every section.');
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Clear class teachers
                    </button>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      disabled={classGroups.length === 0 || clearHomeroomDraft == null}
                      onClick={() => {
                        clearHomeroomDraft?.();
                        toast.info('Homeroom', 'Homeroom draft cleared for all sections.');
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Clear homerooms
                    </button>
                    <hr style={menuDividerSx} />
                    <div style={menuSectionLabelSx}>Destructive</div>
                    <button
                      type="button"
                      style={menuItemDangerSx}
                      disabled={classGroups.length === 0 && !classSubjectConfigs.length}
                      onClick={() => {
                        clearAllAssignmentsDestructive();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Clear all assignments
                    </button>
                  </>
                )}
              </ToolbarDropdown>

              <ToolbarDropdown label="Locks" disabled={classGroups.length === 0}>
                {(close) => (
                  <>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      disabled={!classSubjectConfigs.length}
                      onClick={() => {
                        unlockAllSubjectTeacherLocks();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Unlock subject teachers
                    </button>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      onClick={() => {
                        unlockAllClassTeacherLocksOnly();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Unlock class teachers
                    </button>
                    <button
                      type="button"
                      style={menuItemBtnSx}
                      onClick={() => {
                        unlockAllHomeroomLocksOnly();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Unlock homerooms
                    </button>
                    <hr style={menuDividerSx} />
                    <button
                      type="button"
                      style={menuItemDangerSx}
                      onClick={() => {
                        unlockEverythingConfirmed();
                        close();
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      Unlock everything
                    </button>
                  </>
                )}
              </ToolbarDropdown>

              {showBulkActions || subjFilter ? (
                <ToolbarDropdown label="Bulk actions">
                  {(close) => (
                    <>
                      {showBulkActions ? (
                        <button
                          type="button"
                          style={menuItemBtnSx}
                          onClick={() => {
                            setBulkDrawerOpen(true);
                            close();
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          Open bulk tools…
                        </button>
                      ) : null}
                      {subjFilter ? (
                        <button
                          type="button"
                          style={menuItemBtnSx}
                          disabled={!classSubjectConfigs.length}
                          onClick={() => {
                            run('rebalance', Number(subjFilter) || null);
                            close();
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          Rebalance filtered subject
                        </button>
                      ) : null}
                    </>
                  )}
                </ToolbarDropdown>
              ) : null}

              <button type="button" style={toolbarOutlineBtnSx} onClick={() => setInsightsOpen(true)}>
                Insights
              </button>

              <label
                className="row"
                style={{
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 750,
                  cursor: 'pointer',
                  color: '#64748b',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                <input type="checkbox" checked={manualOverrideMode} onChange={(e) => setManualOverrideMode(e.target.checked)} />
                Manual edit
              </label>
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
          </div>

          <div
            className="row"
            style={{
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              paddingBottom: 2,
              borderTop: '1px dashed rgba(15,23,42,0.08)',
              marginTop: 8,
              paddingTop: 8,
            }}
            aria-label="Quick filters"
          >
            <span className="muted" style={{ fontSize: 11, fontWeight: 850, flex: '0 0 auto' }}>
              Quick filters
            </span>
            <button type="button" style={filterChipSx(onlyNeedsAttention)} onClick={() => setOnlyNeedsAttention((v) => !v)}>
              Needs attention
            </button>
            <button type="button" style={filterChipSx(onlyOverloaded)} onClick={() => setOnlyOverloaded((v) => !v)}>
              Overloaded
            </button>
            <button type="button" style={filterChipSx(onlyUnassigned)} onClick={() => setOnlyUnassigned((v) => !v)}>
              Missing teacher
            </button>
            <button type="button" style={filterChipSx(onlyLocked)} title="Teacher lock" onClick={() => setOnlyLocked((v) => !v)}>
              Locked
            </button>
            <button
              type="button"
              style={filterChipSx(onlyManualOverrides)}
              title="Manual teacher/room sourcing or locks visible on rows"
              onClick={() => setOnlyManualOverrides((v) => !v)}
            >
              Manual overrides
            </button>
            <button
              type="button"
              style={filterChipSx(onlyConflicts)}
              onClick={() => setOnlyConflicts((v) => !v)}
            >
              Conflicts
            </button>
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
            <div
              className="muted"
              style={{ fontSize: 11, fontWeight: 700, opacity: 0.78, padding: '0 4px' }}
              title="missing teacher · overload · preferred room missing · conflicts · locked conflicts"
            >
              {filterSummaryText}
            </div>

            <details
              style={{
                borderRadius: 12,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(248,250,252,0.55)',
                padding: '10px 12px',
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
                <span>{`Needs attention (${displayAttention.needs.length} row${displayAttention.needs.length === 1 ? '' : 's'})`}</span>
                <span className="muted" style={{ fontSize: 11, fontWeight: 750 }}>
                  Open / close
                </span>
              </summary>
              <div style={{ marginTop: 12, padding: '0 2px 8px', minWidth: 0 }}>
                {displayAttention.needs.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, opacity: 0.82 }}>
                    No issues found in the current filters.
                  </div>
                ) : (
                  renderGrouped(groupedNeeds, true)
                )}
              </div>
            </details>

            <details
              style={{
                borderRadius: 12,
                border: '1px solid rgba(15,23,42,0.06)',
                background: 'rgba(248,250,252,0.55)',
                padding: '10px 12px',
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
                <span>
                  Healthy assignments ({displayAttention.healthy.length} row{displayAttention.healthy.length === 1 ? '' : 's'})
                </span>
                <span className="muted" style={{ fontSize: 11, fontWeight: 750 }}>
                  Open / close
                </span>
              </summary>
              <div style={{ marginTop: 12, padding: '0 2px 8px', minWidth: 0 }}>
                {displayAttention.healthy.length === 0 ? (
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
  subjectsCatalogForLabels: Sub[];
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
