import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { SelectKeeper } from './SelectKeeper';
import { SmartSelect } from './SmartSelect';
import { toast } from '../lib/toast';
import {
  buildEffectiveAllocRows,
  computeSectionHealth,
  estimateSlotsPerWeek,
  homeroomMapFromDraft,
  type AcademicAllocRow,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from '../lib/academicStructureUtils';
import { sectionMissingClassTeacher } from '../lib/classTeacherAutoAssign';
import type { AssignmentSlotMeta } from '../lib/academicStructureSmartAssign';
import { SmartTeacherAssignmentBlock, TeacherLoadDashboard } from './SmartTeacherAssignmentBlock';
import { WeeklyCapacitySummary } from './WeeklyCapacitySummary';

export type { AcademicAllocRow };

type RoomOption = {
  id: number;
  building?: string | null;
  buildingName?: string | null;
  floorName?: string | null;
  roomNumber: string;
  type?: string | null;
  labType?: string | null;
  isSchedulable?: boolean;
};

type ClassGroupRow = {
  classGroupId: number;
  code: string;
  displayName: string;
  gradeLevel: number | null;
  section: string | null;
  defaultRoomId: number | null;
};

type SubjectRow = { id: number; code: string; name: string; weeklyFrequency: number | null };

/** Matches class-default save logic: missing/zero frequency defaults to 4 periods/week. */
function subjectDefaultWeeklyPeriods(sub: Pick<SubjectRow, 'weeklyFrequency'>): number {
  return sub.weeklyFrequency && sub.weeklyFrequency > 0 ? sub.weeklyFrequency : 4;
}

type StaffRow = {
  id: number;
  fullName: string;
  email: string;
  teachableSubjectIds: number[];
  roleNames: string[];
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[] | null;
};

type BasicInfo = {
  schoolStartTime: string;
  schoolEndTime: string;
  lectureDurationMinutes: number;
  workingDays: string[];
  openWindows?: { startTime: string; endTime: string }[];
};

const TEACHER = 'TEACHER';

function staffCanTeachSubject(s: StaffRow, subjectId: number): boolean {
  const t = s.teachableSubjectIds ?? [];
  if (t.length === 0) return true;
  return t.includes(subjectId);
}

function isStaffTeacher(s: StaffRow): boolean {
  const roles = s.roleNames ?? [];
  if (roles.includes(TEACHER)) return true;
  if (roles.length === 0 && (s.teachableSubjectIds?.length ?? 0) > 0) return true;
  return false;
}

function teacherOptionsForSubject(staff: StaffRow[], subjectId: number) {
  return staff.filter((s) => isStaffTeacher(s) && staffCanTeachSubject(s, subjectId));
}

function sameAllocSlot(x: AcademicAllocRow, classGroupId: number | null, subjectId: number): boolean {
  if (classGroupId == null) return false;
  return Number(x.classGroupId) === Number(classGroupId) && Number(x.subjectId) === Number(subjectId);
}

function pageContent<T>(data: { content?: T[] } | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.content) ? data.content : [];
}

type Props = {
  stepTitle?: string;
  initialTab?: 'sections' | 'smart' | 'load' | 'overview';
  allowedTabs?: Array<'sections' | 'smart' | 'load' | 'overview'>;
  classGroups: ClassGroupRow[];
  subjects: SubjectRow[];
  staff: StaffRow[];
  rooms: { content?: RoomOption[] } | RoomOption[] | null | undefined;
  allocRows: AcademicAllocRow[];
  setAllocRows: React.Dispatch<React.SetStateAction<AcademicAllocRow[]>>;
  classSubjectConfigs: ClassSubjectConfigRow[];
  setClassSubjectConfigs: React.Dispatch<React.SetStateAction<ClassSubjectConfigRow[]>>;
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  setSectionSubjectOverrides: React.Dispatch<React.SetStateAction<SectionSubjectOverrideRow[]>>;
  defaultRoomByClassId: Record<number, string>;
  setDefaultRoomByClassId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  classDefaultRoomSelectOptions: { value: string; label: string }[];
  classDefaultRoomUsage: Map<string, number>;
  classDefaultRoomHasConflicts: boolean;
  autoAssignDefaultRooms: () => void;
  defaultRoomsLoading: boolean;
  basicInfo: BasicInfo | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  roomsError: unknown | null;
  onSave: () => void | Promise<void>;
  savePending: boolean;
  saveError: unknown;
  /** Cleared on each save; after success parent sets true. */
  saveSuccess?: boolean;
  formatError: (e: unknown) => string;
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  setAssignmentMeta: React.Dispatch<React.SetStateAction<Record<string, AssignmentSlotMeta>>>;
  clearAutoHomeroomAssignments: () => void;
  patchSectionHomeroom: (classGroupId: number, value: string) => void;
  homeroomSourceByClassId: Record<number, 'auto' | 'manual' | ''>;
  classTeacherByClassId: Record<number, string>;
  classTeacherSourceByClassId: Record<number, 'auto' | 'manual' | ''>;
  patchSectionClassTeacher: (classGroupId: number, staffIdValue: string) => void;
  autoAssignClassTeachers: () => void;
};

export function AcademicStructureSetupStep({
  classGroups,
  subjects,
  staff,
  rooms,
  allocRows,
  setAllocRows,
  classSubjectConfigs,
  setClassSubjectConfigs,
  sectionSubjectOverrides,
  setSectionSubjectOverrides,
  defaultRoomByClassId,
  setDefaultRoomByClassId: _setDefaultRoomByClassId,
  classDefaultRoomSelectOptions,
  classDefaultRoomUsage,
  classDefaultRoomHasConflicts,
  autoAssignDefaultRooms,
  basicInfo,
  isLoading,
  isError,
  error,
  roomsError,
  onSave,
  savePending,
  saveError,
  saveSuccess = false,
  formatError,
  assignmentMeta,
  setAssignmentMeta,
  clearAutoHomeroomAssignments,
  patchSectionHomeroom,
  homeroomSourceByClassId,
  classTeacherByClassId,
  classTeacherSourceByClassId,
  patchSectionClassTeacher,
  autoAssignClassTeachers,
  stepTitle: _stepTitle = 'Step 6 — Academic structure',
  initialTab,
  allowedTabs,
}: Props) {
  const [view, setView] = useState<'overview' | 'edit' | 'template'>('overview');
  const [tab, setTab] = useState<'sections' | 'smart' | 'load' | 'overview'>(initialTab ?? 'sections');
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('');

  const [smartGradeFilter, setSmartGradeFilter] = useState<string>('');
  const [smartSubjectFilter, setSmartSubjectFilter] = useState<string>('');
  const [smartTeacherFilter, setSmartTeacherFilter] = useState<string>('');
  const [initialGradePick, setInitialGradePick] = useState<string>('');
  const [mappingSearch, setMappingSearch] = useState('');
  const [overrideDrawer, setOverrideDrawer] = useState<{ open: boolean; classGroupId: number | null }>({ open: false, classGroupId: null });
  const [overrideSearch, setOverrideSearch] = useState<string>('');

  const slotsPerWeek = useMemo(() => estimateSlotsPerWeek(basicInfo), [basicInfo]);

  const roomOpts = useMemo(() => {
    const list = pageContent(rooms)
      .filter((r) => (r as RoomOption & { isSchedulable?: boolean }).isSchedulable !== false)
      .slice()
      .sort((a, b) => {
        const ba = String(a.buildingName ?? a.building ?? '').localeCompare(String(b.buildingName ?? b.building ?? ''));
        if (ba !== 0) return ba;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      });
    return [
      { value: '', label: '🏠 Homeroom' },
      ...list.map((r) => ({
        value: String(r.id),
        label: `${String(r.buildingName ?? r.building ?? '').trim()} ${r.roomNumber}${r.type ? ` · ${r.type}` : ''}`.trim(),
      })),
    ];
  }, [rooms]);

  const sortedClassGroups = useMemo(() => {
    return classGroups
      .slice()
      .sort((a, b) => {
        const ga = a.gradeLevel ?? 999;
        const gb = b.gradeLevel ?? 999;
        if (ga !== gb) return ga - gb;
        return String(a.code ?? '').localeCompare(String(b.code ?? ''));
      });
  }, [classGroups]);

  const classTeacherStaffOptions = useMemo(() => {
    const opts = staff
      .filter((s) => (s.roleNames ?? []).includes('TEACHER'))
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }))
      .map((s) => ({ value: String(s.id), label: s.fullName || s.email || `Staff ${s.id}` }));
    return [{ value: '', label: 'No class teacher' }, ...opts];
  }, [staff]);

  const effectiveAllocForCt = useMemo(() => {
    const hm = homeroomMapFromDraft(classGroups, defaultRoomByClassId);
    if ((classSubjectConfigs?.length ?? 0) > 0) {
      return buildEffectiveAllocRows(classGroups, classSubjectConfigs, sectionSubjectOverrides, hm);
    }
    return allocRows;
  }, [classGroups, classSubjectConfigs, sectionSubjectOverrides, defaultRoomByClassId, allocRows]);

  const missingClassTeacherSections = useMemo(() => {
    return sortedClassGroups.filter((cg) =>
      sectionMissingClassTeacher(cg.classGroupId, effectiveAllocForCt, classTeacherByClassId),
    );
  }, [sortedClassGroups, effectiveAllocForCt, classTeacherByClassId]);

  const catalogCount = subjects.length;
  const validSubjectIdSet = useMemo(() => new Set<number>(subjects.map((s) => Number(s.id))), [subjects]);

  /** Stable across referential churn of `subjects` while React Query loads — drives purge effect only when IDs truly change. */
  const subjectCatalogSignature = useMemo(
    () =>
      subjects.length === 0
        ? ''
        : [...subjects.map((s) => Number(s.id))]
            .filter((id) => Number.isFinite(id))
            .sort((a, b) => a - b)
            .join(','),
    [subjects],
  );

  const loadByStaff = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of allocRows) {
      if (a.staffId == null) continue;
      m.set(a.staffId, (m.get(a.staffId) ?? 0) + (a.weeklyFrequency > 0 ? a.weeklyFrequency : 0));
    }
    return m;
  }, [allocRows]);

  // When any grade uses class templates, derive those sections' allocs from template+overrides.
  // Merge with legacy allocation rows for grades that do not have template rows yet (avoid wiping siblings).
  useEffect(() => {
    if (!classSubjectConfigs?.length) return;
    setAllocRows((prev) => {
      const effective = buildEffectiveAllocRows(classGroups, classSubjectConfigs, sectionSubjectOverrides);
      const gradesWithAnyTemplate = new Set(classSubjectConfigs.map((c) => Number(c.gradeLevel)));

      const merged = [...effective];
      const keys = new Set(effective.map((r) => `${r.classGroupId}:${r.subjectId}`));

      for (const cg of classGroups) {
        const g = cg.gradeLevel == null ? NaN : Number(cg.gradeLevel);
        if (!Number.isFinite(g)) continue;
        if (gradesWithAnyTemplate.has(g)) continue;
        for (const a of prev) {
          if (Number(a.classGroupId) !== Number(cg.classGroupId)) continue;
          if (a.weeklyFrequency <= 0) continue;
          const k = `${a.classGroupId}:${a.subjectId}`;
          if (keys.has(k)) continue;
          merged.push(a);
          keys.add(k);
        }
      }
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classGroups, classSubjectConfigs, sectionSubjectOverrides]);

  // If a subject is deleted from the catalog, drop stale mappings — only when catalog *membership* changes.
  // Do not key off `validSubjectIdSet` (new Set every render while `subjects` is `data ?? []`) — that wiped all templates.
  useEffect(() => {
    if (!subjectCatalogSignature) return;
    const allowed = new Set(subjects.map((s) => Number(s.id)).filter((id) => Number.isFinite(id)));
    setClassSubjectConfigs((prev) => prev.filter((c) => allowed.has(Number(c.subjectId))));
    setSectionSubjectOverrides((prev) => prev.filter((o) => allowed.has(Number(o.subjectId))));
    setAssignmentMeta((prev) => {
      const next: Record<string, AssignmentSlotMeta> = {};
      for (const [k, v] of Object.entries(prev)) {
        const parts = k.split(':');
        const sid = Number(parts[1]);
        if (!Number.isFinite(sid) || !allowed.has(sid)) continue;
        next[k] = v;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `subjects` is from the render where `subjectCatalogSignature` changed
  }, [subjectCatalogSignature]);

  // Reset override search whenever drawer target changes.
  useEffect(() => {
    setOverrideSearch('');
  }, [overrideDrawer.open, overrideDrawer.classGroupId]);

  useEffect(() => {
    if (view === 'edit' && editingClassId != null && !classGroups.some((c) => c.classGroupId === editingClassId)) {
      setView('overview');
      setEditingClassId(null);
    }
  }, [classGroups, view, editingClassId]);

  useEffect(() => {
    if (view !== 'template') return;
    if (editingGrade == null) return;
    const any = classGroups.some((c) => c.gradeLevel === editingGrade);
    if (!any) {
      setView('overview');
      setEditingGrade(null);
    }
  }, [classGroups, view, editingGrade]);

  const schoolProgress = useMemo(() => {
    const total = classGroups.length;
    if (total === 0) return { pct: 0, withIssues: 0 };
    let ready = 0;
    for (const c of classGroups) {
      const h = computeSectionHealth(c.classGroupId, allocRows, catalogCount, staff, slotsPerWeek);
      if (h.subjectCount > 0 && !h.hasHardIssue && h.issueCount === 0) ready += 1;
    }
    const withIssues = classGroups.filter((c) => {
      const h = computeSectionHealth(c.classGroupId, allocRows, catalogCount, staff, slotsPerWeek);
      return h.subjectCount === 0 || h.hasHardIssue || h.issueCount > 0;
    }).length;
    return { pct: Math.round((ready / total) * 100), withIssues };
  }, [classGroups, allocRows, catalogCount, staff, slotsPerWeek]);

  const overCapacitySections = useMemo(() => {
    if (slotsPerWeek == null) return [];
    const out: Array<{ classGroupId: number; label: string; totalPeriods: number; capacity: number; overBy: number }> = [];
    for (const cg of sortedClassGroups) {
      const h = computeSectionHealth(cg.classGroupId, allocRows, catalogCount, staff, slotsPerWeek);
      if (!h.overCapacity) continue;
      const label = String(cg.displayName || cg.code || `Section ${cg.classGroupId}`).trim();
      out.push({
        classGroupId: cg.classGroupId,
        label,
        totalPeriods: h.totalPeriods,
        capacity: slotsPerWeek,
        overBy: Math.max(1, h.totalPeriods - slotsPerWeek),
      });
    }
    out.sort((a, b) => b.overBy - a.overBy || a.label.localeCompare(b.label));
    return out;
  }, [slotsPerWeek, sortedClassGroups, allocRows, catalogCount, staff]);

  const gradesInSchool = useMemo(() => {
    const set = new Set<number>();
    for (const c of classGroups) {
      if (c.gradeLevel == null) continue;
      set.add(Number(c.gradeLevel));
    }
    return [...set].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  }, [classGroups]);

  // Keep mapper usable without an extra "pick a class" empty state.
  useEffect(() => {
    if (initialGradePick) return;
    if (gradesInSchool.length === 0) return;
    setInitialGradePick(String(gradesInSchool[0]!));
  }, [initialGradePick, gradesInSchool]);

  const quickWin = useMemo(() => {
    const grades = new Map<number, { notStarted: number; needsHelp: number; total: number }>();
    for (const cg of classGroups) {
      if (cg.gradeLevel == null) continue;
      const h = computeSectionHealth(cg.classGroupId, allocRows, catalogCount, staff, slotsPerWeek);
      const g = cg.gradeLevel;
      const cur = grades.get(g) ?? { notStarted: 0, needsHelp: 0, total: 0 };
      cur.total += 1;
      if (h.subjectCount === 0) cur.notStarted += 1;
      if (h.hasHardIssue || h.issueCount > 0) cur.needsHelp += 1;
      grades.set(g, cur);
    }
    const sorted = [...grades.entries()].sort((a, b) => {
      if (b[1].notStarted !== a[1].notStarted) return b[1].notStarted - a[1].notStarted;
      if (b[1].needsHelp !== a[1].needsHelp) return b[1].needsHelp - a[1].needsHelp;
      return a[0] - b[0];
    });
    const best = sorted.find(([, v]) => v.notStarted > 0) ?? sorted.find(([, v]) => v.needsHelp > 0) ?? null;
    if (!best) return null;
    return { grade: best[0], ...best[1] };
  }, [classGroups, allocRows, catalogCount, staff, slotsPerWeek]);

  const upsertOverride = (
    classGroupId: number,
    subjectId: number,
    patch: Partial<SectionSubjectOverrideRow>,
  ) => {
    setSectionSubjectOverrides((p) => {
      const rest = p.filter((o) => !(Number(o.classGroupId) === Number(classGroupId) && Number(o.subjectId) === Number(subjectId)));
      const cur = p.find((o) => Number(o.classGroupId) === Number(classGroupId) && Number(o.subjectId) === Number(subjectId));
      const next: SectionSubjectOverrideRow = {
        classGroupId,
        subjectId,
        periodsPerWeek: cur?.periodsPerWeek ?? null,
        teacherId: cur?.teacherId ?? null,
        roomId: cur?.roomId ?? null,
        ...patch,
      };
      // If all fields are null, drop override row (inherit template).
      if (next.periodsPerWeek == null && next.teacherId == null && next.roomId == null) {
        return rest;
      }
      return [...rest, next];
    });
  };

  const removeOverrideIfOnlyDisable = (classGroupId: number, subjectId: number) => {
    setSectionSubjectOverrides((p) => {
      const cur = p.find((o) => Number(o.classGroupId) === Number(classGroupId) && Number(o.subjectId) === Number(subjectId));
      if (!cur) return p;
      const onlyDisable =
        (cur.periodsPerWeek ?? null) === 0 && cur.teacherId == null && cur.roomId == null;
      if (!onlyDisable) return p;
      return p.filter((o) => !(Number(o.classGroupId) === Number(classGroupId) && Number(o.subjectId) === Number(subjectId)));
    });
  };

  /** Stable key for saved class-default subject ids — avoids resetting draft when unrelated config arrays get new references. */
  const savedTemplateIdsKeyForPick = useMemo(() => {
    if (!initialGradePick) return '';
    const g = Number(initialGradePick);
    if (!Number.isFinite(g)) return '';
    const ids = classSubjectConfigs
      .filter((c) => Number(c.gradeLevel) === g && validSubjectIdSet.has(Number(c.subjectId)))
      .map((c) => Number(c.subjectId))
      .sort((a, b) => a - b)
      .join(',');
    return `${g}:${ids}`;
  }, [initialGradePick, classSubjectConfigs, validSubjectIdSet]);

  const [draftClassDefaults, setDraftClassDefaults] = useState<Set<number>>(new Set());
  const [copyFromGradePick, setCopyFromGradePick] = useState<string>('');

  const templateSubjectIdSetForGrade = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const row of classSubjectConfigs) {
      const g = Number(row.gradeLevel);
      const sid = Number(row.subjectId);
      if (!Number.isFinite(g) || !Number.isFinite(sid)) continue;
      // If a subject was deleted from the catalog, ignore stale template rows.
      if (!validSubjectIdSet.has(sid)) continue;
      const set = m.get(g) ?? new Set<number>();
      set.add(sid);
      m.set(g, set);
    }
    return m;
  }, [classSubjectConfigs, validSubjectIdSet]);

  /** Subject IDs for class defaults: saved grade template if any, otherwise union from legacy allocations for that grade. */
  const subjectIdsForGradeTemplateOrLegacy = useCallback(
    (grade: number): Set<number> => {
      const g = Number(grade);
      const fromTpl = templateSubjectIdSetForGrade.get(g);
      if (fromTpl?.size) return new Set(fromTpl);

      const out = new Set<number>();
      for (const cg of classGroups) {
        if (Number(cg.gradeLevel) !== g) continue;
        for (const a of allocRows) {
          if (Number(a.classGroupId) !== Number(cg.classGroupId)) continue;
          if (a.weeklyFrequency <= 0) continue;
          const sid = Number(a.subjectId);
          if (!validSubjectIdSet.has(sid)) continue;
          out.add(sid);
        }
      }
      return out;
    },
    [templateSubjectIdSetForGrade, classGroups, allocRows, validSubjectIdSet],
  );

  /**
   * Enabled subjects per section: grade template + overrides, or legacy allocation rows until that grade has templates.
   */
  const mappingEnabledSet = useCallback(
    (classGroupId: number, gradeLevel: number | null | undefined) => {
      const g = gradeLevel == null ? NaN : Number(gradeLevel);
      const templateSet = Number.isFinite(g) ? templateSubjectIdSetForGrade.get(g) : undefined;

      const set = new Set<number>();
      if (templateSet?.size) {
        for (const sid of templateSet) set.add(sid);
      } else {
        for (const a of allocRows) {
          if (Number(a.classGroupId) !== Number(classGroupId)) continue;
          if (a.weeklyFrequency <= 0) continue;
          const sid = Number(a.subjectId);
          if (!validSubjectIdSet.has(sid)) continue;
          set.add(sid);
        }
      }

      for (const o of sectionSubjectOverrides) {
        if (Number(o.classGroupId) !== Number(classGroupId)) continue;
        const sid = Number(o.subjectId);
        if (!Number.isFinite(sid)) continue;
        const pw = o.periodsPerWeek;
        if (pw === 0) set.delete(sid);
        else if (pw != null && pw > 0) set.add(sid);
      }
      return set;
    },
    [templateSubjectIdSetForGrade, sectionSubjectOverrides, allocRows, validSubjectIdSet],
  );

  const sectionHasAnyEnabledSubject = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const cg of classGroups) {
      const enabled = mappingEnabledSet(cg.classGroupId, cg.gradeLevel);
      m.set(cg.classGroupId, enabled.size > 0);
    }
    return m;
  }, [classGroups, mappingEnabledSet]);

  const mappingComplete = useMemo(() => {
    if (classGroups.length === 0) return false;
    for (const cg of classGroups) {
      if (!sectionHasAnyEnabledSubject.get(cg.classGroupId)) return false;
    }
    return true;
  }, [classGroups, sectionHasAnyEnabledSubject]);

  const copyFromOptions = useMemo(() => {
    const current = Number(initialGradePick);
    return gradesInSchool
      .slice()
      .sort((a, b) => Number(a) - Number(b))
      .filter((g) => !Number.isFinite(current) || Number(g) !== current)
      .map((g) => ({ value: String(g), label: `Class ${g}` }));
  }, [gradesInSchool, initialGradePick]);

  const nextPendingGrade = useMemo(() => {
    const current = Number(initialGradePick);
    const ordered = gradesInSchool.slice().sort((a, b) => Number(a) - Number(b));
    const missingInGrade = (g: number) => {
      const secs = classGroups.filter((c) => Number(c.gradeLevel) === Number(g));
      if (!secs.length) return false;
      return secs.some((cg) => !sectionHasAnyEnabledSubject.get(cg.classGroupId));
    };
    // Prefer next grades after current; then wrap to beginning.
    const startIdx = Number.isFinite(current) ? Math.max(0, ordered.indexOf(current) + 1) : 0;
    for (let i = startIdx; i < ordered.length; i++) if (missingInGrade(Number(ordered[i]))) return Number(ordered[i]);
    for (let i = 0; i < startIdx; i++) if (missingInGrade(Number(ordered[i]))) return Number(ordered[i]);
    return null;
  }, [gradesInSchool, classGroups, sectionHasAnyEnabledSubject, initialGradePick]);

  // Reset copy-from source only when switching the grade being edited (not when saved templates update).
  useEffect(() => {
    setCopyFromGradePick('');
  }, [initialGradePick]);

  // Keep draft aligned with saved templates when grade changes or server/template snapshot changes — not on unrelated renders.
  useEffect(() => {
    if (!initialGradePick) {
      setDraftClassDefaults(new Set());
      return;
    }
    const g = Number(initialGradePick);
    if (!Number.isFinite(g)) {
      setDraftClassDefaults(new Set());
      return;
    }
    const ids = classSubjectConfigs
      .filter((c) => Number(c.gradeLevel) === g && validSubjectIdSet.has(Number(c.subjectId)))
      .map((c) => Number(c.subjectId));
    setDraftClassDefaults(new Set(ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: classSubjectConfigs read only when savedTemplateIdsKeyForPick changes
  }, [initialGradePick, savedTemplateIdsKeyForPick]);

  const filteredSubjectsForMapping = useMemo(() => {
    const q = mappingSearch.trim().toLowerCase();
    const list = subjects.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [subjects, mappingSearch]);

  const selectedSubjectsForDraft = useMemo(() => {
    const byId = new Map<number, SubjectRow>(subjects.map((s) => [Number(s.id), s]));
    return [...draftClassDefaults]
      .map((id) => byId.get(Number(id)))
      .filter(Boolean)
      .sort((a, b) => (a as SubjectRow).name.localeCompare((b as SubjectRow).name)) as SubjectRow[];
  }, [subjects, draftClassDefaults]);

  const draftScheduledPeriods = useMemo(() => {
    const byId = new Map<number, SubjectRow>(subjects.map((s) => [Number(s.id), s]));
    let sum = 0;
    for (const id of draftClassDefaults) {
      const sub = byId.get(Number(id));
      if (!sub) continue;
      sum += subjectDefaultWeeklyPeriods(sub);
    }
    return sum;
  }, [subjects, draftClassDefaults]);

  const sectionEnabledSet = (classGroupId: number) => {
    const set = new Set<number>();
    for (const a of allocRows) {
      if (a.classGroupId !== classGroupId) continue;
      if (a.weeklyFrequency <= 0) continue;
      set.add(a.subjectId);
    }
    return set;
  };

  const setSectionSubjectEnabled = (classGroupId: number, subjectId: number, enabled: boolean) => {
    if (enabled) {
      // Clear disable override if it exists.
      removeOverrideIfOnlyDisable(classGroupId, subjectId);
      upsertOverride(classGroupId, subjectId, { periodsPerWeek: null });
    } else {
      upsertOverride(classGroupId, subjectId, { periodsPerWeek: 0 });
    }
  };

  const setSectionSubjectAdditionEnabled = (classGroupId: number, subjectId: number, enabled: boolean) => {
    const sub = subjects.find((s) => Number(s.id) === Number(subjectId));
    const freq = sub ? subjectDefaultWeeklyPeriods(sub) : 4;
    if (enabled) {
      // For section-only additions, we must materialize frequency in the override row (no template to inherit from).
      upsertOverride(classGroupId, subjectId, { periodsPerWeek: freq });
    } else {
      upsertOverride(classGroupId, subjectId, { periodsPerWeek: 0 });
    }
  };

  const saveClassDefaults = (grade: number, selected: Set<number>) => {
    setClassSubjectConfigs((p) => {
      const rest = p.filter((c) => Number(c.gradeLevel) !== Number(grade));
      const prev = p.filter((c) => Number(c.gradeLevel) === Number(grade));
      const byId = new Map<number, ClassSubjectConfigRow>();
      for (const c of prev) byId.set(Number(c.subjectId), c);
      const out: ClassSubjectConfigRow[] = [...rest];
      for (const sid of [...selected].sort((a, b) => a - b)) {
        const existing = byId.get(sid);
        if (existing) {
          out.push(existing);
        } else {
          const sub = subjects.find((s) => Number(s.id) === sid);
          if (!sub) continue;
          const freq = subjectDefaultWeeklyPeriods(sub);
          const tch = teacherOptionsForSubject(staff, sub.id)[0] ?? staff.find((s) => isStaffTeacher(s));
          out.push({
            gradeLevel: grade,
            subjectId: sub.id,
            defaultPeriodsPerWeek: freq,
            defaultTeacherId: tch ? tch.id : null,
            defaultRoomId: null,
          });
        }
      }
      return out;
    });
  };

  const filterNorm = subjectFilter.trim().toLowerCase();
  const subjectsFiltered = useMemo(() => {
    if (!filterNorm) return subjects;
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(filterNorm) || s.code.toLowerCase().includes(filterNorm),
    );
  }, [subjects, filterNorm]);

  const openEdit = (classGroupId: number) => {
    setEditingClassId(classGroupId);
    setView('edit');
    setTab('sections');
  };

  const openTemplate = (gradeLevel: number) => {
    setEditingGrade(gradeLevel);
    setView('template');
    setTab('sections');
  };

  const backToOverview = () => {
    setView('overview');
    setEditingClassId(null);
    setEditingGrade(null);
    setSubjectFilter('');
    setTab('sections');
  };

  if (isError) {
    return (
      <div className="sms-alert sms-alert--error">
        <div>
          <div className="sms-alert__title">Couldn’t load academic structure</div>
          <div className="sms-alert__msg">{formatError(error)}</div>
        </div>
      </div>
    );
  }
  if (roomsError) {
    return (
      <div className="sms-alert sms-alert--error">
        <div>
          <div className="sms-alert__title">Couldn’t load rooms</div>
          <div className="sms-alert__msg">{formatError(roomsError)}</div>
        </div>
      </div>
    );
  }

  const tabsAllowed =
    allowedTabs && allowedTabs.length
      ? allowedTabs
      : (['sections', 'smart', 'load', 'overview'] as Array<'sections' | 'smart' | 'load' | 'overview'>);

  useEffect(() => {
    if (!tabsAllowed.includes(tab)) setTab(tabsAllowed[0] ?? 'sections');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedTabs?.join(','), tab]);

  return (
    <div className="card stack" style={{ gap: 16 }}>
      {/* Header/description intentionally omitted here; wizard already provides it. */}

      {tabsAllowed.length > 1 ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {tabsAllowed.includes('sections') ? (
            <button type="button" className={tab === 'sections' ? 'btn' : 'btn secondary'} onClick={() => setTab('sections')}>
              Subject → section mapping
            </button>
          ) : null}
          {tabsAllowed.includes('smart') ? (
            <button
              type="button"
              className={tab === 'smart' ? 'btn' : 'btn secondary'}
              onClick={() => setTab('smart')}
              disabled={!mappingComplete}
              title={!mappingComplete ? 'Complete subject mapping first to unlock smart assignment.' : undefined}
            >
              Smart assignment
            </button>
          ) : null}
          {tabsAllowed.includes('load') ? (
            <button
              type="button"
              className={tab === 'load' ? 'btn' : 'btn secondary'}
              onClick={() => setTab('load')}
              disabled={!mappingComplete}
              title={!mappingComplete ? 'Complete subject mapping first to unlock teacher load.' : undefined}
            >
              Teacher load
            </button>
          ) : null}
          {/* Bulk tools removed */}
          {tabsAllowed.includes('overview') ? (
            <button
              type="button"
              className={tab === 'overview' ? 'btn' : 'btn secondary'}
              onClick={() => setTab('overview')}
              disabled={!mappingComplete}
              title={!mappingComplete ? 'Complete subject mapping first to unlock overview.' : undefined}
            >
              Overall overview
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === 'load' || tab === 'overview' ? (
        <div
          className="row"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(15,23,42,0.08)',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
            Filters
          </span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: 220 }}>
              <SelectKeeper
                value={smartSubjectFilter}
                onChange={setSmartSubjectFilter}
                options={[{ value: '', label: 'All subjects' }, ...subjects.map((s) => ({ value: String(s.id), label: s.name }))]}
              />
            </div>
            <div style={{ minWidth: 220 }}>
              <SelectKeeper
                value={smartGradeFilter}
                onChange={setSmartGradeFilter}
                options={[
                  { value: '', label: 'All grades' },
                  ...Array.from(new Set(classGroups.map((c) => c.gradeLevel).filter((g): g is number => g != null)))
                    .sort((a, b) => a - b)
                    .map((g) => ({ value: String(g), label: `Class ${g}` })),
                ]}
              />
            </div>
            {tab === 'load' ? (
              <div style={{ minWidth: 220 }}>
                <SelectKeeper
                  value={smartTeacherFilter}
                  onChange={setSmartTeacherFilter}
                  options={[
                    { value: '', label: 'All teachers' },
                    ...staff
                      .filter((s) => (s.roleNames ?? []).includes('TEACHER'))
                      .map((s) => ({ value: String(s.id), label: s.fullName || s.email })),
                  ]}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'sections' && view === 'overview' && classGroups.length > 0 ? (
        <div className="stack" style={{ gap: 12 }}>
          {subjects.length === 0 ? (
            <div className="sms-alert sms-alert--warning">
              <div>
                <div className="sms-alert__title">No subjects available</div>
                <div className="sms-alert__msg">Please complete Step 3 — Subjects first.</div>
              </div>
            </div>
          ) : null}

          {!mappingComplete ? (
            <div className="sms-alert sms-alert--warning" style={{ margin: 0 }}>
              <div>
                <div className="sms-alert__title">Required</div>
                <div className="sms-alert__msg">
                  Map at least one subject for <strong>every section</strong> to unlock Smart assignment and Teacher load.
                </div>
              </div>
            </div>
          ) : null}

          <div
            className="row"
            style={{
              gap: 12,
              alignItems: 'stretch',
              // Responsive: stack columns on small widths, 2-col on desktop.
              flexWrap: 'wrap',
            }}
          >
            <div
              className=""
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                flex: '1 1 340px',
                minWidth: 300,
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: 12,
                // Extra padding so focus rings / 2px selected borders don't get clipped by the scroll container.
                padding: 12,
                background: 'rgba(255,255,255,0.65)',
                maxHeight: 520,
                overflow: 'auto',
              }}
            >
              {gradesInSchool.map((g) => {
                const secRows = classGroups
                  .filter((c) => Number(c.gradeLevel) === Number(g))
                  .slice()
                  .sort((a, b) => String(a.section ?? '').localeCompare(String(b.section ?? '')));

                const isSelected = Number(initialGradePick) === Number(g);
                const sectionStatuses =
                  catalogCount === 0
                    ? secRows.map((s) => ({ classGroupId: s.classGroupId, label: s.section ?? s.code, status: 'missing' as const }))
                    : secRows.map((s) => {
                        const enabled = mappingEnabledSet(s.classGroupId, g);
                        const inherited = new Set<number>(
                          classSubjectConfigs
                            .filter((c) => Number(c.gradeLevel) === Number(g))
                            .map((c) => Number(c.subjectId)),
                        );
                        const added = [...enabled].filter((x) => !inherited.has(x));
                        const removed = [...inherited].filter((x) => !enabled.has(x));
                        const hasOverride = added.length > 0 || removed.length > 0;
                        const started = enabled.size > 0;
                        const status: 'inherited' | 'override' | 'missing' =
                          !started ? 'missing' : hasOverride ? 'override' : 'inherited';
                        return { classGroupId: s.classGroupId, label: s.section ?? s.code, status };
                      });

                let classStatus: 'fully' | 'partial' | 'not_started' = 'not_started';
                const anyStarted = sectionStatuses.some((x) => x.status !== 'missing');
                const missingCount = sectionStatuses.filter((x) => x.status === 'missing').length;
                if (!anyStarted) classStatus = 'not_started';
                else if (missingCount === 0) classStatus = 'fully';
                else classStatus = 'partial';

                const badge =
                  classStatus === 'fully'
                    ? { text: '✔ Fully mapped', bg: 'rgba(22,163,74,0.12)', color: '#166534' }
                    : classStatus === 'partial'
                      ? { text: '⚠ Partial', bg: 'rgba(234,179,8,0.15)', color: '#a16207' }
                      : { text: '⏳ Not started', bg: 'rgba(100,116,139,0.12)', color: '#64748b' };

                const counts = {
                  inherited: sectionStatuses.filter((s) => s.status === 'inherited').length,
                  override: sectionStatuses.filter((s) => s.status === 'override').length,
                  missing: sectionStatuses.filter((s) => s.status === 'missing').length,
                };

                const selectedSubjectCount =
                  catalogCount === 0 ? 0 : subjectIdsForGradeTemplateOrLegacy(Number(g)).size;
                const pendingSections = counts.missing;

                return (
                  <button
                    key={g}
                    type="button"
                    className="sms-grade-pick-card"
                    onClick={() => setInitialGradePick(String(g))}
                    title="Select class"
                    style={{
                      borderRadius: 12,
                      border: isSelected ? '3px solid var(--color-primary)' : '1px solid rgba(15,23,42,0.08)',
                      background: isSelected ? 'rgba(255,247,237,0.65)' : 'rgba(255,255,255,0.75)',
                      overflow: 'visible',
                      padding: '10px 12px',
                      gap: 8,
                    }}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950 }}>{`Class ${g} (${secRows.length} section${secRows.length === 1 ? '' : 's'})`}</div>
                      </div>
                      <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 12, fontWeight: 900, background: badge.bg, color: badge.color, flexShrink: 0 }}>
                        {badge.text}
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 2, marginTop: 2 }}>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        {selectedSubjectCount} subject{selectedSubjectCount === 1 ? '' : 's'} selected
                      </div>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        {pendingSections} section{pendingSections === 1 ? '' : 's'} pending
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="stack" style={{ flex: '1 1 560px', minWidth: 320, gap: 12 }}>
              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>
                      {initialGradePick ? `Class ${initialGradePick} — Subject defaults` : 'Select a class'}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      These subjects apply to all sections of this class unless overridden below.
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div className="stack" style={{ gap: 4, flex: '1 1 280px', minWidth: 200 }}>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        Copy from class
                      </span>
                      <div style={{ minWidth: 200, flex: '1 1 200px' }}>
                        <SmartSelect
                          value={copyFromGradePick}
                          onChange={setCopyFromGradePick}
                          placeholder="Select class…"
                          options={copyFromOptions}
                          allowClear
                          clearLabel="Clear"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={!initialGradePick || !copyFromGradePick}
                        onClick={() => {
                          const src = Number(copyFromGradePick);
                          if (!Number.isFinite(src)) return;
                          const set = subjectIdsForGradeTemplateOrLegacy(src);
                          setDraftClassDefaults(new Set(set));
                          if (!set.size) {
                            toast.success('Nothing to copy', `Class ${src} has no subjects in defaults or existing allocations yet.`);
                          } else {
                            toast.success('Copied', `Loaded Class ${src} subjects into draft.`);
                          }
                        }}
                      >
                        Copy
                      </button>
                      </div>
                      <div className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                        If the draft below is empty, Save & apply uses the class chosen above (same as Copy).
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        if (!initialGradePick) return;
                        setDraftClassDefaults(new Set(subjects.map((s) => s.id)));
                      }}
                      disabled={!initialGradePick}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        if (!initialGradePick) return;
                        setDraftClassDefaults(new Set());
                      }}
                      disabled={!initialGradePick}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        const g = Number(initialGradePick);
                        if (!Number.isFinite(g)) return;
                        void (async () => {
                          try {
                            /** Prefer explicit draft; if empty but "Copy from class" is set, apply that grade (same as pressing Copy). */
                            let selectedIds: Set<number>;
                            let appliedFromGrade: number | null = null;
                            if (draftClassDefaults.size > 0) {
                              selectedIds = new Set(draftClassDefaults);
                            } else if (copyFromGradePick) {
                              const src = Number(copyFromGradePick);
                              if (Number.isFinite(src) && src !== g) {
                                selectedIds = new Set(subjectIdsForGradeTemplateOrLegacy(src));
                                appliedFromGrade = src;
                              } else {
                                selectedIds = new Set();
                              }
                            } else {
                              selectedIds = new Set();
                            }

                            if (selectedIds.size === 0 && copyFromGradePick) {
                              toast.error(
                                'Nothing to apply',
                                `Class ${copyFromGradePick} has no subjects in defaults or allocations to copy.`,
                              );
                              return;
                            }

                            flushSync(() => {
                              setDraftClassDefaults(new Set(selectedIds));
                              saveClassDefaults(g, selectedIds);
                            });
                            await Promise.resolve(onSave());
                            const secs = classGroups.filter((c) => Number(c.gradeLevel) === Number(g)).length;
                            const detail =
                              appliedFromGrade != null
                                ? `Copied ${selectedIds.size} subject${selectedIds.size === 1 ? '' : 's'} from Class ${appliedFromGrade} → ${secs} section${secs === 1 ? '' : 's'}.`
                                : `Class defaults saved for ${secs} section${secs === 1 ? '' : 's'}.`;
                            toast.success('Saved', detail);
                          } catch (e) {
                            toast.error('Save failed', formatError(e));
                          }
                        })();
                      }}
                      disabled={!initialGradePick || savePending}
                    >
                      {(() => {
                        const g = Number(initialGradePick);
                        const secs = Number.isFinite(g) ? classGroups.filter((c) => Number(c.gradeLevel) === Number(g)).length : 0;
                        return `Save & apply to ${secs || '—'} section${secs === 1 ? '' : 's'}`;
                      })()}
                    </button>
                  </div>
                </div>

                {initialGradePick ? (
                  <div
                    style={{
                      border: '1px solid rgba(15,23,42,0.08)',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.75)',
                      padding: 10,
                    }}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>Selected subjects</div>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        {selectedSubjectsForDraft.length} selected
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px solid rgba(15,23,42,0.06)',
                        fontSize: 12,
                        lineHeight: 1.55,
                      }}
                    >
                      <WeeklyCapacitySummary
                        slotsPerWeek={slotsPerWeek}
                        periodsScheduled={draftScheduledPeriods}
                        variant="class_defaults"
                        missingHint="Set working days, period length, and school hours in Basic info (or open windows) to show weekly capacity and free slots while you map subjects."
                      />
                    </div>
                    {selectedSubjectsForDraft.length === 0 ? (
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        None selected yet.
                      </div>
                    ) : (
                      <div
                        className="row"
                        style={{
                          gap: 8,
                          flexWrap: 'wrap',
                          marginTop: 8,
                          maxHeight: 92,
                          overflow: 'auto',
                          paddingRight: 4,
                        }}
                      >
                        {selectedSubjectsForDraft.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="sms-badge"
                            style={{
                              borderRadius: 999,
                              padding: '6px 10px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                            title="Remove from selection"
                            onClick={() => {
                              const next = new Set(draftClassDefaults);
                              next.delete(s.id);
                              setDraftClassDefaults(next);
                            }}
                          >
                            <span style={{ fontWeight: 900 }}>{s.name}</span>
                            <span className="muted" style={{ fontSize: 11, fontWeight: 900 }}>
                              {s.code}
                            </span>
                            <span style={{ fontWeight: 950, marginLeft: 2, color: '#b91c1c' }}>×</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <input
                  style={{ maxWidth: 420 }}
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  placeholder="Search subject by name/code…"
                />

                <div
                  style={{
                    maxHeight: 420,
                    overflow: 'auto',
                    paddingRight: 4,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
                    {filteredSubjectsForMapping.map((sub) => {
                      const on = draftClassDefaults.has(sub.id);
                      const periods = subjectDefaultWeeklyPeriods(sub);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            const next = new Set(draftClassDefaults);
                            if (next.has(sub.id)) next.delete(sub.id);
                            else next.add(sub.id);
                            setDraftClassDefaults(next);
                          }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 12,
                            border: on ? '2px solid var(--color-primary)' : '1px solid rgba(15,23,42,0.08)',
                            background: on ? 'rgba(255,247,237,0.7)' : 'rgba(255,255,255,0.8)',
                            textAlign: 'left',
                          }}
                          title={
                            on
                              ? `Counts as ${periods} period${periods === 1 ? '' : 's'}/week toward section capacity. Click to remove.`
                              : `Adds ${periods} period${periods === 1 ? '' : 's'}/week per section when saved.`
                          }
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900 }}>{sub.name}</div>
                            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{sub.code}</div>
                            <div className="muted" style={{ fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                              {periods} period{periods === 1 ? '' : 's'}/wk
                            </div>
                          </div>
                          <div style={{ fontWeight: 950, fontSize: 16, color: on ? '#16a34a' : '#94a3b8' }}>
                            {on ? '☑' : '☐'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {nextPendingGrade != null ? (
                    <span className="muted" style={{ fontSize: 12 }}>
                      Next pending: <strong>{`Class ${nextPendingGrade}`}</strong>
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>
                      Next pending: <strong>—</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Section overrides (optional)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Status</th>
                        <th>Override summary</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {classGroups
                        .filter((c) => Number(c.gradeLevel) === Number(initialGradePick))
                        .map((cg) => {
                          const inherited = new Set(
                            classSubjectConfigs
                              .filter((c) => Number(c.gradeLevel) === Number(initialGradePick))
                              .map((c) => Number(c.subjectId)),
                          );
                          const enabled = sectionEnabledSet(cg.classGroupId);
                          const added = [...enabled].filter((x) => !inherited.has(x));
                          const removed = [...inherited].filter((x) => !enabled.has(x));
                          const hasOverride = added.length > 0 || removed.length > 0;
                          const status = enabled.size === 0 ? 'Missing' : hasOverride ? 'Override' : 'Inherited';
                          const toLabel = (sid: number) => {
                            const s = subjects.find((x) => Number(x.id) === Number(sid));
                            if (!s) return `#${sid}`;
                            return `${s.name}${s.code ? ` (${s.code})` : ''}`;
                          };
                          const sum =
                            enabled.size === 0
                              ? 'No subjects enabled'
                              : hasOverride
                                ? [
                                    ...added
                                      .map((sid) => ({ sid, text: `+ ${toLabel(sid)}` }))
                                      .sort((a, b) => a.text.localeCompare(b.text)),
                                    ...removed
                                      .map((sid) => ({ sid, text: `- ${toLabel(sid)}` }))
                                      .sort((a, b) => a.text.localeCompare(b.text)),
                                  ]
                                    .map((x) => x.text)
                                    .join(', ')
                                : 'Uses class defaults';
                          const statusColor = enabled.size === 0 ? '#b91c1c' : hasOverride ? '#a16207' : '#166534';
                          return (
                            <tr key={cg.classGroupId}>
                              <td>
                                <div style={{ fontWeight: 800 }}>{cg.displayName || cg.code}</div>
                                <div className="muted" style={{ fontSize: 12 }}>{cg.section ?? ''}</div>
                              </td>
                              <td style={{ fontWeight: 900, color: statusColor }}>{status}</td>
                              <td style={{ maxWidth: 520 }}>
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sum}>
                                  {sum}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button type="button" className="btn secondary" onClick={() => setOverrideDrawer({ open: true, classGroupId: cg.classGroupId })}>
                                  Configure
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {overrideDrawer.open && overrideDrawer.classGroupId != null ? (() => {
            const cg = classGroups.find((c) => c.classGroupId === overrideDrawer.classGroupId);
            if (!cg) return null;
            const grade = cg.gradeLevel ?? null;
            if (grade == null) return null;
            const inherited = new Set(
              classSubjectConfigs.filter((c) => Number(c.gradeLevel) === Number(grade)).map((c) => Number(c.subjectId)),
            );
            const enabled = sectionEnabledSet(cg.classGroupId);
            const weeklyForSubjectInSection = (subjectId: number): number => {
              const sub = subjects.find((x) => Number(x.id) === Number(subjectId));
              const fallback = sub ? subjectDefaultWeeklyPeriods(sub) : 4;
              const cfg = classSubjectConfigs.find(
                (c) => Number(c.gradeLevel) === Number(grade) && Number(c.subjectId) === Number(subjectId),
              );
              const ov = sectionSubjectOverrides.find(
                (o) => Number(o.classGroupId) === Number(cg.classGroupId) && Number(o.subjectId) === Number(subjectId),
              );
              if (cfg) {
                const w = ov?.periodsPerWeek ?? cfg.defaultPeriodsPerWeek;
                return w && w > 0 ? w : fallback;
              }
              const w2 = ov?.periodsPerWeek;
              return w2 && w2 > 0 ? w2 : fallback;
            };
            const sectionPeriods = [...enabled].reduce((a, sid) => a + weeklyForSubjectInSection(sid), 0);
            const addedOverrideSubjects = [...enabled].filter((sid) => !inherited.has(sid));
            const removedOverrideSubjects = [...inherited].filter((sid) => !enabled.has(sid));
            const all = new Set<number>([...inherited, ...enabled]);
            for (const s of subjects) all.add(s.id);
            const list = [...all].map((id) => subjects.find((s) => s.id === id)).filter(Boolean) as SubjectRow[];
            list.sort((a, b) => a.name.localeCompare(b.name));
            const overrideFiltered = (() => {
              const q = overrideSearch.trim().toLowerCase();
              if (!q) return list;
              return list.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
            })();

            return (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(2,6,23,0.35)',
                  zIndex: 50,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <div style={{ width: 'min(520px, 92vw)', height: '100%', background: 'white', padding: 14, overflow: 'auto' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>{`Section: ${cg.displayName || cg.code}`}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Inherits class defaults; use this override to add/remove subjects for this section.
                      </div>
                    </div>
                    <button type="button" className="btn secondary" onClick={() => setOverrideDrawer({ open: false, classGroupId: null })}>
                      Close
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 12,
                      background: 'rgba(248,250,252,0.95)',
                      border: '1px solid rgba(15,23,42,0.08)',
                      fontSize: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    <WeeklyCapacitySummary
                      slotsPerWeek={slotsPerWeek}
                      periodsScheduled={sectionPeriods}
                      variant="section_override"
                      missingHint="Set working days, period length, and school hours in Basic info to show weekly capacity and free slots for this section."
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Inherited subjects</div>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {[...inherited].map((sid) => {
                        const s = subjects.find((x) => x.id === sid);
                        if (!s) return null;
                        return (
                          <span key={sid} className="sms-badge" style={{ padding: '4px 8px' }}>
                            {s.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Overrides</div>
                    {(addedOverrideSubjects.length > 0 || removedOverrideSubjects.length > 0) ? (
                      <div style={{ marginBottom: 10 }}>
                        <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Overridden subjects</div>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {addedOverrideSubjects.map((sid) => {
                            const s = subjects.find((x) => x.id === sid);
                            if (!s) return null;
                            return (
                              <span key={`add-${sid}`} className="sms-badge" style={{ padding: '4px 8px', border: '1px solid rgba(22,163,74,0.35)', background: 'rgba(22,163,74,0.10)', color: '#166534' }}>
                                {`+ ${s.name}`}
                              </span>
                            );
                          })}
                          {removedOverrideSubjects.map((sid) => {
                            const s = subjects.find((x) => x.id === sid);
                            if (!s) return null;
                            return (
                              <span key={`rem-${sid}`} className="sms-badge" style={{ padding: '4px 8px', border: '1px solid rgba(185,28,28,0.35)', background: 'rgba(185,28,28,0.08)', color: '#b91c1c' }}>
                                {`- ${s.name}`}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    <input
                      value={overrideSearch}
                      onChange={(e) => setOverrideSearch(e.target.value)}
                      placeholder="Search subject by name/code…"
                      style={{ width: '100%', marginBottom: 10 }}
                    />
                    <div className="stack" style={{ gap: 8 }}>
                      {overrideFiltered.map((s) => {
                        const on = enabled.has(s.id);
                        const defaultIfOn = subjectDefaultWeeklyPeriods(s);
                        const eff = weeklyForSubjectInSection(s.id);
                        return (
                          <label key={s.id} className="row" style={{ gap: 10, alignItems: 'center' }}>
                            <input
                              className="sms-checkbox"
                              type="checkbox"
                              checked={on}
                              onChange={() => {
                                // immediate update: apply as user toggles
                                if (!Number.isFinite(Number(grade))) return;
                                if (on) {
                                  // disable
                                  if (inherited.has(s.id)) setSectionSubjectEnabled(cg.classGroupId, s.id, false);
                                  else setSectionSubjectAdditionEnabled(cg.classGroupId, s.id, false);
                                } else {
                                  // enable
                                  if (inherited.has(s.id)) setSectionSubjectEnabled(cg.classGroupId, s.id, true);
                                  else setSectionSubjectAdditionEnabled(cg.classGroupId, s.id, true);
                                }
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800 }}>{s.name}</div>
                              <div className="muted" style={{ fontSize: 12 }}>{s.code}</div>
                              <div className="muted" style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>
                                {on
                                  ? `${eff} period${eff === 1 ? '' : 's'}/wk in this section`
                                  : `If enabled: ${defaultIfOn} period${defaultIfOn === 1 ? '' : 's'}/wk (from subject default)`}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        // Reset to inherit: remove pure-disable overrides for inherited subjects and disable any additions
                        for (const sid of enabled) {
                          if (!inherited.has(sid)) {
                            upsertOverride(cg.classGroupId, sid, { periodsPerWeek: 0 });
                          } else {
                            removeOverrideIfOnlyDisable(cg.classGroupId, sid);
                            upsertOverride(cg.classGroupId, sid, { periodsPerWeek: null });
                          }
                        }
                        toast.info('Reset', 'Section reset to inherit class defaults.');
                      }}
                    >
                      Reset to inherit
                    </button>
                    <button type="button" className="btn" onClick={() => setOverrideDrawer({ open: false, classGroupId: null })}>
                      Done
                    </button>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </div>
      ) : null}

      {tab === 'smart' ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Smart teacher assignment</div>
            <p
              className="muted"
              style={{ margin: 0, fontSize: 11, opacity: 0.82, lineHeight: 1.45 }}
              title="Auto-assign teachers by subject skill and balanced workload. The same teacher is preferred across sections in a class. Lock keeps a row out of rebalance."
            >
              Balance workload by skill; prefer one teacher per class across sections. Locked rows skip rebalance.
            </p>
            {!mappingComplete ? (
              <div className="sms-alert sms-alert--warning">
                <div>
                  <div className="sms-alert__title">Locked</div>
                  <div className="sms-alert__msg">Complete subject mapping for all classes first (Subject → section mapping tab).</div>
                </div>
              </div>
            ) : null}
            {classDefaultRoomHasConflicts ? (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c' }}>Homeroom conflict: two classes share a room</span>
              </div>
            ) : null}
            <SmartTeacherAssignmentBlock
              classGroups={classGroups}
              subjects={subjects}
              staff={staff}
              roomOptions={roomOpts}
              classSubjectConfigs={classSubjectConfigs}
              setClassSubjectConfigs={setClassSubjectConfigs}
              sectionSubjectOverrides={sectionSubjectOverrides}
              setSectionSubjectOverrides={setSectionSubjectOverrides}
              assignmentMeta={assignmentMeta}
              setAssignmentMeta={setAssignmentMeta}
              subjectsCatalogForLabels={subjects}
              filters={{ grade: smartGradeFilter, subject: smartSubjectFilter, teacher: smartTeacherFilter }}
              showBulkActions
              autoAssignHomerooms={autoAssignDefaultRooms}
              clearAutoHomeroomAssignments={clearAutoHomeroomAssignments}
              autoAssignClassTeachers={autoAssignClassTeachers}
              defaultRoomByClassId={defaultRoomByClassId}
              homeroomSourceByClassId={homeroomSourceByClassId}
              slotsPerWeek={slotsPerWeek}
              overviewContext={{
                slotsPerWeek,
                overCapacitySections,
                schoolProgressPct: schoolProgress.pct,
                schoolProgressWithIssues: schoolProgress.withIssues,
              }}
              filterUi={{
                gradeValue: smartGradeFilter,
                subjectValue: smartSubjectFilter,
                teacherValue: smartTeacherFilter,
                onGradeChange: setSmartGradeFilter,
                onSubjectChange: setSmartSubjectFilter,
                onTeacherChange: setSmartTeacherFilter,
                gradeOptions: Array.from(new Set(classGroups.map((c) => c.gradeLevel).filter((g): g is number => g != null)))
                  .sort((a, b) => a - b)
                  .map((g) => ({ value: String(g), label: `Class ${g}` })),
                subjectOptions: subjects.map((s) => ({ value: String(s.id), label: s.name })),
                teacherOptions: staff
                  .filter((s) => (s.roleNames ?? []).includes('TEACHER'))
                  .map((s) => ({ value: String(s.id), label: s.fullName || s.email })),
              }}
            />
          </div>
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Sections overview</div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Homerooms, weekly periods, readiness, and class teachers are managed here. Use Configure section to override one section.
            </p>
            {missingClassTeacherSections.length > 0 ? (
              <div className="sms-alert sms-alert--warning">
                <div>
                  <div className="sms-alert__title">Class teacher required before timetable generation</div>
                  <div className="sms-alert__msg">
                    {missingClassTeacherSections.length} section{missingClassTeacherSections.length === 1 ? '' : 's'} have mapped
                    teaching but no class teacher. Use <strong>Smart assignment</strong> → <strong>Auto assign class teachers</strong>{' '}
                    or pick manually below.
                  </div>
                </div>
              </div>
            ) : null}
            {quickWin ? (
              <div className="sms-alert sms-alert--info">
                <div>
                  <div className="sms-alert__title">Recommended next step</div>
                  <div className="sms-alert__msg">
                    Configure <strong>Class {quickWin.grade}</strong> ({quickWin.notStarted} section{quickWin.notStarted === 1 ? '' : 's'} not started).
                  </div>
                </div>
                <div>
                  <button type="button" className="btn" onClick={() => openTemplate(quickWin.grade)} disabled={!mappingComplete}>
                    Start
                  </button>
                </div>
              </div>
            ) : null}
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Class teacher</th>
                    <th>Homeroom</th>
                    <th>Subjects on</th>
                    <th>Periods / week</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortedClassGroups.map((row) => {
                    const h = computeSectionHealth(row.classGroupId, allocRows, catalogCount, staff, slotsPerWeek);
                    const v = defaultRoomByClassId[row.classGroupId] ?? '';
                    const usedCount = v ? (classDefaultRoomUsage.get(v) ?? 0) : 0;
                    const conflict = v && usedCount > 1;
                    const capLabel = slotsPerWeek != null ? `${h.totalPeriods} / ${slotsPerWeek}` : String(h.totalPeriods);
                    const issueDetails: string[] = [];
                    if (h.subjectCount === 0) {
                      issueDetails.push('No subjects configured yet');
                    } else {
                      const disabled = Math.max(0, catalogCount - h.subjectCount);
                      if (disabled > 0) issueDetails.push(`${disabled} subject${disabled === 1 ? '' : 's'} disabled`);
                      if (h.overCapacity) issueDetails.push('Over capacity (total periods exceed weekly slots)');
                      if (h.hasTeacherLoadWarn) issueDetails.push('Teacher overloaded (weekly load exceeds limit)');
                      if (h.issueCount > 0) issueDetails.push('Missing teacher / periods in one or more rows');
                    }

                    let statusLabel = '✔ Ready';
                    let statusBg = 'rgba(22, 163, 74, 0.12)';
                    let statusColor = '#166534';
                    if (h.subjectCount === 0) {
                      statusLabel = 'Not started';
                      statusBg = 'rgba(100, 116, 139, 0.12)';
                      statusColor = '#64748b';
                    } else if (h.hasHardIssue) {
                      statusLabel = h.issueCount ? `⚠ ${h.issueCount} issue${h.issueCount === 1 ? '' : 's'}` : '⚠ Fix required';
                      statusBg = 'rgba(220, 38, 38, 0.1)';
                      statusColor = '#b91c1c';
                    } else if (h.hasTeacherLoadWarn) {
                      statusLabel = '⚠ Teacher overloaded';
                      statusBg = 'rgba(234, 179, 8, 0.15)';
                      statusColor = '#a16207';
                    }

                    return (
                      <tr key={row.classGroupId} style={conflict ? { background: 'rgba(185, 28, 28, 0.05)' } : undefined}>
                        <td>
                          <div style={{ fontWeight: 800 }}>{row.displayName || row.code}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            <strong>{row.code}</strong>
                            {row.section ? ` · ${row.section}` : ''}
                          </div>
                        </td>
                        <td style={{ minWidth: 220 }}>
                          <SelectKeeper
                            id={`ov-ct-${row.classGroupId}`}
                            value={classTeacherByClassId[row.classGroupId] ?? ''}
                            onChange={(nv) => patchSectionClassTeacher(row.classGroupId, nv)}
                            options={classTeacherStaffOptions}
                          />
                          <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {((classTeacherSourceByClassId[row.classGroupId] ?? '') === 'auto' ||
                              (classTeacherSourceByClassId[row.classGroupId] ?? '') === 'manual') &&
                            (classTeacherByClassId[row.classGroupId] ?? '').trim() !== '' ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 900,
                                  letterSpacing: 0.4,
                                  background:
                                    (classTeacherSourceByClassId[row.classGroupId] ?? '') === 'auto'
                                      ? 'rgba(234, 88, 12, 0.18)'
                                      : 'rgba(100, 116, 139, 0.16)',
                                  color: (classTeacherSourceByClassId[row.classGroupId] ?? '') === 'auto' ? '#9a3412' : '#475569',
                                }}
                              >
                                {(classTeacherSourceByClassId[row.classGroupId] ?? '') === 'auto' ? 'AUTO' : 'MANUAL'}
                              </span>
                            ) : null}
                            {sectionMissingClassTeacher(row.classGroupId, effectiveAllocForCt, classTeacherByClassId) ? (
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309' }}>Missing</span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ minWidth: 260 }}>
                          <SelectKeeper
                            id={`ov-room-${row.classGroupId}`}
                            value={v}
                            onChange={(nv) => patchSectionHomeroom(row.classGroupId, nv)}
                            options={classDefaultRoomSelectOptions}
                          />
                          {conflict ? (
                            <div style={{ color: '#b91c1c', fontSize: 11, fontWeight: 800 }}>Duplicate homeroom</div>
                          ) : null}
                        </td>
                        <td>
                          <span style={{ fontWeight: 900 }}>{h.subjectCount}</span>
                          <span className="muted" style={{ fontSize: 12 }}> / {catalogCount}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 900 }}>{capLabel}</span>
                          {h.overCapacity ? (
                            <div style={{ color: '#b45309', fontSize: 11, fontWeight: 800 }}>Over capacity</div>
                          ) : null}
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 900,
                              background: statusBg,
                              color: statusColor,
                            }}
                            title={issueDetails.length ? issueDetails.map((x) => `- ${x}`).join('\n') : 'Ready'}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => openEdit(row.classGroupId)}
                            disabled={!mappingComplete}
                            title="Configure section: override one section only (teacher/periods/room)"
                          >
                            Configure section
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'load' ? (
        <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Teacher load dashboard</div>
          {!mappingComplete ? (
            <div className="sms-alert sms-alert--warning">
              <div>
                <div className="sms-alert__title">Locked</div>
                <div className="sms-alert__msg">Complete subject mapping for all classes first (Subject → section mapping tab).</div>
              </div>
            </div>
          ) : null}
          <TeacherLoadDashboard
            classGroups={classGroups}
            staff={staff}
            classSubjectConfigs={classSubjectConfigs}
            sectionSubjectOverrides={sectionSubjectOverrides}
            filters={{ grade: smartGradeFilter, subject: smartSubjectFilter, teacher: smartTeacherFilter }}
            subjectsCatalogForLabels={subjects}
            slotsPerWeek={slotsPerWeek}
          />
        </div>
      ) : null}

      {/* Bulk tools removed */}

      {tab === 'sections' && view === 'template' && editingGrade != null
        ? (() => {
            const templateRow = (subId: number) =>
              classSubjectConfigs.find(
                (c) => Number(c.gradeLevel) === Number(editingGrade) && Number(c.subjectId) === Number(subId),
              );
            return (
              <div className="stack" style={{ gap: 16 }}>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button type="button" className="btn secondary" onClick={backToOverview}>
                    ← Back to overview
                  </button>
                  {slotsPerWeek != null ? (
                    <div className="muted" style={{ fontSize: 13, fontWeight: 800 }}>
                      Capacity: ~{slotsPerWeek} slots / week
                    </div>
                  ) : null}
                </div>

                <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                  <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        Class (grade)
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 950 }}>Class {editingGrade}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        Class template — defaults for every section in this grade
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 8 }}>2 · Subject selection</div>
                  <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                    Subjects are mapped in <strong>Sections setup</strong> (Step 1). This screen is for periods, default teachers, and rooms.
                  </p>
                  {classSubjectConfigs.filter((c) => Number(c.gradeLevel) === Number(editingGrade)).length === 0 ? (
                    <div className="sms-alert sms-alert--warning">
                      <div>
                        <div className="sms-alert__title">No subjects mapped yet</div>
                        <div className="sms-alert__msg">
                          Go back to <strong>Sections setup</strong> and map subjects for <strong>Class {editingGrade}</strong> to unlock this table.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>3 · Timetable details</div>
                    <span className="muted" style={{ fontSize: 12 }}>Only enabled subjects. Column actions apply to this class template.</span>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 12, fontWeight: 800 }}>
                    <span className="muted">Apply to class:</span>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => {
                        const first = staff.filter(isStaffTeacher)[0];
                        if (!first) {
                          toast.error('No teacher', 'Add staff with TEACHER role first.');
                          return;
                        }
                        setClassSubjectConfigs((p) =>
                          p.map((c) => (Number(c.gradeLevel) === Number(editingGrade) ? { ...c, defaultTeacherId: first.id } : c)),
                        );
                        toast.info('Applied', 'First listed eligible teacher set for all template rows in this class.');
                      }}
                    >
                      One teacher to all rows
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => {
                        setClassSubjectConfigs((p) =>
                          p.map((c) => (Number(c.gradeLevel) === Number(editingGrade) ? { ...c, defaultRoomId: null } : c)),
                        );
                        toast.info('Cleared', 'Room set to class default (homeroom) for all template rows.');
                      }}
                    >
                      Use homeroom for all
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Periods/wk</th>
                          <th>Teacher</th>
                          <th>Room</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects
                          .filter((sub) => templateRow(sub.id))
                          .map((sub) => {
                            const row = templateRow(sub.id);
                            if (!row) return null;
                            const tOpts = teacherOptionsForSubject(staff, sub.id);
                            const sid = row.defaultTeacherId;
                            const load = sid == null ? 0 : (loadByStaff.get(sid) ?? 0);
                            const teacherCap =
                              sid != null
                                ? staff.find((s) => Number(s.id) === Number(sid))?.maxWeeklyLectureLoad ?? null
                                : null;
                            const overTeacher = (teacherCap != null && teacherCap > 0 ? teacherCap : slotsPerWeek) != null &&
                              load > (teacherCap != null && teacherCap > 0 ? teacherCap : (slotsPerWeek ?? 0));
                            return (
                              <tr key={sub.id}>
                                <td>
                                  <div style={{ fontWeight: 800 }}>{sub.name}</div>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {sub.code}
                                  </div>
                                </td>
                                <td style={{ minWidth: 100 }}>
                                  <input
                                    type="number"
                                    min={1}
                                    max={40}
                                    value={row.defaultPeriodsPerWeek ?? ''}
                                    onChange={(e) => {
                                      const n = Number(e.target.value);
                                      if (!Number.isFinite(n) || n < 1) return;
                                      setClassSubjectConfigs((p) =>
                                        p.map((x) =>
                                          Number(x.gradeLevel) === Number(editingGrade) && Number(x.subjectId) === Number(sub.id)
                                            ? { ...x, defaultPeriodsPerWeek: n }
                                            : x,
                                        ),
                                      );
                                    }}
                                  />
                                  {(!row.defaultPeriodsPerWeek || row.defaultPeriodsPerWeek < 1) ? (
                                    <div style={{ color: '#b91c1c', fontSize: 11, fontWeight: 800 }}>Required</div>
                                  ) : null}
                                </td>
                                <td style={{ minWidth: 200 }}>
                                  <SelectKeeper
                                    id={`template-teacher-${editingGrade}-${sub.id}`}
                                    value={sid != null ? String(sid) : ''}
                                    onChange={(v) => {
                                      const id = v && String(v).trim() !== '' ? Number(v) : null;
                                      setClassSubjectConfigs((p) =>
                                        p.map((x) =>
                                          Number(x.gradeLevel) === Number(editingGrade) && Number(x.subjectId) === Number(sub.id)
                                            ? { ...x, defaultTeacherId: id }
                                            : x,
                                        ),
                                      );
                                    }}
                                    options={tOpts.map((s) => ({ value: String(s.id), label: s.fullName || s.email }))}
                                  />
                                  {tOpts.length === 0 ? (
                                    <div style={{ color: '#b91c1c', fontSize: 11, fontWeight: 800 }}>No eligible teacher</div>
                                  ) : null}
                                  {overTeacher && sid != null ? (
                                    <div style={{ color: '#b45309', fontSize: 11, fontWeight: 800 }}>High weekly load for this teacher</div>
                                  ) : null}
                                </td>
                                <td style={{ minWidth: 220 }}>
                                  <SelectKeeper
                                    id={`template-room-${editingGrade}-${sub.id}`}
                                    value={row.defaultRoomId != null ? String(row.defaultRoomId) : ''}
                                    onChange={(v) => {
                                      const rid = v === '' ? null : Number(v);
                                      setClassSubjectConfigs((p) =>
                                        p.map((x) =>
                                          Number(x.gradeLevel) === Number(editingGrade) && Number(x.subjectId) === Number(sub.id)
                                            ? { ...x, defaultRoomId: rid }
                                            : x,
                                        ),
                                      );
                                    }}
                                    options={roomOpts}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {subjects.filter((s) => templateRow(s.id)).length === 0 ? (
                    <div className="muted" style={{ padding: 12, textAlign: 'center', fontSize: 14 }}>
                      Turn on at least one subject above to set periods and teachers.
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })()
        : null}

      {tab === 'sections' && view === 'edit' && editingClassId != null ? (
        <div className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" className="btn secondary" onClick={backToOverview}>
              ← Back to overview
            </button>
            {slotsPerWeek != null ? (
              <div className="muted" style={{ fontSize: 13, fontWeight: 800 }}>
                Capacity: ~{slotsPerWeek} slots / week
              </div>
            ) : null}
          </div>

          {(() => {
            const cg = classGroups.find((c) => c.classGroupId === editingClassId);
            if (!cg) return null;
            const h = computeSectionHealth(editingClassId, allocRows, catalogCount, staff, slotsPerWeek);
            const perClassTotal = allocRows
              .filter((r) => r.classGroupId === editingClassId)
              .reduce((a, b) => a + (b.weeklyFrequency > 0 ? b.weeklyFrequency : 0), 0);
            const homeroomVal = defaultRoomByClassId[editingClassId] ?? '';
            return (
              <div
                className="stack card"
                style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}
              >
                <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Section
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 950 }}>{cg.displayName || cg.code}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {cg.code} · Global subject codes only
                    </div>
                  </div>
                  <div className="stack" style={{ flex: '1 1 280px' }}>
                    <label style={{ fontSize: 12, fontWeight: 800 }}>Default room (homeroom)</label>
                    <SelectKeeper
                      id={`edit-homeroom-${editingClassId}`}
                      value={homeroomVal}
                      onChange={(nv) => patchSectionHomeroom(editingClassId, nv)}
                      options={classDefaultRoomSelectOptions}
                    />
                  </div>
                </div>
                <div className="row" style={{ gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
                  <div>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Total periods</span>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>{perClassTotal}</div>
                  </div>
                  {slotsPerWeek != null ? (
                    <div>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>vs capacity</span>
                      <div style={{ fontWeight: 950, fontSize: 18, color: perClassTotal > slotsPerWeek ? '#b45309' : '#166534' }}>
                        {perClassTotal} / {slotsPerWeek}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Issues</span>
                    <div style={{ fontWeight: 950, fontSize: 18, color: h.hasHardIssue ? '#b91c1c' : '#166534' }}>
                      {h.issueCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 8 }}>2 · Subject selection</div>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
              Section overrides. Subjects are enabled in the class template. Here you can override teacher/room/periods.
            </p>
            <input
              style={{ maxWidth: 360, marginBottom: 10 }}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              placeholder="Filter by name or code (MTH)…"
            />
            <div
              style={{
                maxHeight: 'min(360px, 42vh)',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: 4,
                borderRadius: 10,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.5)',
              }}
            >
              <div
                className="academic-subject-toggles"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 8,
                  padding: 8,
                }}
              >
              {subjectsFiltered.map((sub) => {
                const cg = classGroups.find((c) => c.classGroupId === editingClassId);
                const grade = cg?.gradeLevel ?? null;
                const on =
                  grade != null &&
                  classSubjectConfigs.some((c) => Number(c.gradeLevel) === Number(grade) && Number(c.subjectId) === Number(sub.id));
                return (
                  <div
                    key={sub.id}
                    className="academic-subject-tile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(15,23,42,0.1)',
                      background: on ? 'rgba(255,247,237,0.6)' : 'rgba(255,255,255,0.8)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{sub.name}</div>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        {sub.code}
                      </div>
                    </div>
                    <label className="sms-switch" style={{ marginLeft: 4 }}>
                      <input
                        className="sms-switch__input"
                        type="checkbox"
                        checked={on}
                        aria-label={`Use ${sub.name} in this section`}
                        onChange={() => {
                          // Enable/disable lives on template; keep switch read-only here.
                          toast.info('Template controlled', 'Enable/disable subjects in the class template.');
                        }}
                        disabled
                      />
                      <span className="sms-switch__ui" aria-hidden>
                        <span className="sms-switch__thumb" />
                      </span>
                    </label>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>3 · Timetable details</div>
              <span className="muted" style={{ fontSize: 12 }}>Only enabled subjects. Column actions apply to this section.</span>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: 12, fontWeight: 800 }}>
              <span className="muted">Apply in section:</span>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => {
                  if (editingClassId == null) return;
                  const first = staff.filter(isStaffTeacher)[0];
                  if (!first) {
                    toast.error('No teacher', 'Add staff with TEACHER role first.');
                    return;
                  }
                  setAllocRows((p) =>
                    p.map((r) => (r.classGroupId === editingClassId ? { ...r, staffId: first.id } : r)),
                  );
                  toast.info('Applied', 'First listed teacher set for all rows in this section.');
                }}
              >
                One teacher to all rows
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => {
                  if (editingClassId == null) return;
                  setAllocRows((p) =>
                    p.map((r) => (r.classGroupId === editingClassId ? { ...r, roomId: null } : r)),
                  );
                  toast.info('Cleared', 'Room override removed — using homeroom where applicable.');
                }}
              >
                Use homeroom for all
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Periods/wk</th>
                    <th>Teacher</th>
                    <th>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects
                    .filter((sub) => allocRows.some((r) => sameAllocSlot(r, editingClassId, sub.id)))
                    .map((sub) => {
                      const row = allocRows.find((r) => sameAllocSlot(r, editingClassId, sub.id));
                      if (!row) return null;
                      const tOpts = teacherOptionsForSubject(staff, sub.id);
                      const load = row.staffId == null ? 0 : loadByStaff.get(row.staffId) ?? 0;
                      const teacherCap =
                        row.staffId != null
                          ? staff.find((s) => Number(s.id) === Number(row.staffId))?.maxWeeklyLectureLoad ?? null
                          : null;
                      const overTeacher =
                        (teacherCap != null && teacherCap > 0 ? teacherCap : slotsPerWeek) != null &&
                        load > (teacherCap != null && teacherCap > 0 ? teacherCap : (slotsPerWeek ?? 0));
                      return (
                        <tr key={sub.id}>
                          <td>
                            <div style={{ fontWeight: 800 }}>{sub.name}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {sub.code}
                            </div>
                          </td>
                          <td style={{ minWidth: 100 }}>
                            <input
                              type="number"
                              min={1}
                              max={40}
                              value={row.weeklyFrequency ?? ''}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                const v = Number.isFinite(n) ? Math.trunc(n) : 0;
                                setAllocRows((p) =>
                                  p.map((x) => (sameAllocSlot(x, editingClassId, sub.id) ? { ...x, weeklyFrequency: v } : x)),
                                );
                              }}
                            />
                            {(!row.weeklyFrequency || row.weeklyFrequency < 1) ? (
                              <div style={{ color: '#b91c1c', fontSize: 11, fontWeight: 800 }}>Required</div>
                            ) : null}
                          </td>
                          <td style={{ minWidth: 200 }}>
                            <SelectKeeper
                              id={`academic-teacher-${editingClassId}-${sub.id}`}
                              value={String(row.staffId ?? '')}
                              onChange={(v) => {
                                setAllocRows((p) =>
                                  p.map((x) => (sameAllocSlot(x, editingClassId, sub.id) ? { ...x, staffId: Number(v) } : x)),
                                );
                              }}
                              options={tOpts.map((s) => ({ value: String(s.id), label: s.fullName || s.email }))}
                            />
                            {tOpts.length === 0 ? (
                              <div style={{ color: '#b91c1c', fontSize: 11, fontWeight: 800 }}>No eligible teacher</div>
                            ) : null}
                            {overTeacher ? (
                              <div style={{ color: '#b45309', fontSize: 11, fontWeight: 800 }}>High weekly load for this teacher</div>
                            ) : null}
                          </td>
                          <td style={{ minWidth: 220 }}>
                            <SelectKeeper
                              id={`academic-room-${editingClassId}-${sub.id}`}
                              value={row.roomId != null ? String(row.roomId) : ''}
                              onChange={(v) => {
                                const rid = v === '' ? null : Number(v);
                                setAllocRows((p) =>
                                  p.map((x) => (sameAllocSlot(x, editingClassId, sub.id) ? { ...x, roomId: rid } : x)),
                                );
                              }}
                              options={roomOpts}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {subjects.filter((s) => allocRows.some((r) => sameAllocSlot(r, editingClassId, s.id))).length === 0 ? (
              <div className="muted" style={{ padding: 12, textAlign: 'center', fontSize: 14 }}>
                Turn on at least one subject above to set periods and teachers.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isLoading ? <div className="muted">Loading classes…</div> : null}
      {!isLoading && !classGroups.length ? (
        <div className="muted">No sections yet. Add them from the wizard’s Classes & sections step, or open Classes & sections in Operations Hub.</div>
      ) : null}

      {classGroups.length > 0 ? (
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 4 }}>
          <button type="button" className="btn" onClick={onSave} disabled={savePending || isLoading}>
            {savePending ? 'Saving…' : 'Save academic structure'}
          </button>
          {saveError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Save failed</div>
                <div className="sms-alert__msg">{formatError(saveError)}</div>
              </div>
            </div>
          ) : null}
          {saveSuccess && !saveError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Saved</div>
                <div className="sms-alert__msg">Academic structure is updated and synced.</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
