import { useEffect, useMemo, useState } from 'react';
import { ClassGroupSearchCombobox } from './ClassGroupSearchCombobox';
import { SelectKeeper } from './SelectKeeper';
import { MultiSelectKeeper } from './MultiSelectKeeper';
import { toast } from '../lib/toast';
import {
  buildEffectiveAllocRows,
  computeSectionHealth,
  estimateSlotsPerWeek,
  type AcademicAllocRow,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from '../lib/academicStructureUtils';
import type { AssignmentSlotMeta } from '../lib/academicStructureSmartAssign';
import { SmartTeacherAssignmentBlock, TeacherLoadDashboard } from './SmartTeacherAssignmentBlock';

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
};

const TEACHER = 'TEACHER';

type BulkAction =
  | ''
  | 'apply_teacher_grade'
  | 'apply_room_grade'
  | 'copy_periods_grade';

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
  onSave: () => void;
  savePending: boolean;
  saveError: unknown;
  formatError: (e: unknown) => string;
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  setAssignmentMeta: React.Dispatch<React.SetStateAction<Record<string, AssignmentSlotMeta>>>;
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
  setDefaultRoomByClassId,
  classDefaultRoomSelectOptions,
  classDefaultRoomUsage,
  classDefaultRoomHasConflicts,
  autoAssignDefaultRooms,
  defaultRoomsLoading,
  basicInfo,
  isLoading,
  isError,
  error,
  roomsError,
  onSave,
  savePending,
  saveError,
  formatError,
  assignmentMeta,
  setAssignmentMeta,
  stepTitle = 'Step 6 — Academic structure',
}: Props) {
  const [view, setView] = useState<'overview' | 'edit' | 'template'>('overview');
  const [tab, setTab] = useState<'sections' | 'smart' | 'load' | 'bulk'>('sections');
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>({});

  const [bulkContextSectionId, setBulkContextSectionId] = useState<string>('');
  const [bulkAction, setBulkAction] = useState<BulkAction>('');
  const [bulkTeacherId, setBulkTeacherId] = useState('');
  const [bulkRoomId, setBulkRoomId] = useState('');
  const [smartGradeFilter, setSmartGradeFilter] = useState<string>('');
  const [smartSubjectFilter, setSmartSubjectFilter] = useState<string>('');
  const [smartTeacherFilter, setSmartTeacherFilter] = useState<string>('');
  const [initialGradePick, setInitialGradePick] = useState<string>('');
  const [initialSectionPicks, setInitialSectionPicks] = useState<string[]>([]);
  const [mappingTouched, setMappingTouched] = useState<Record<string, boolean>>({});
  const [mappingSearch, setMappingSearch] = useState('');
  const [overrideDrawer, setOverrideDrawer] = useState<{ open: boolean; classGroupId: number | null }>({ open: false, classGroupId: null });

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
      { value: '', label: 'Class default (homeroom)' },
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

  const byGrade = useMemo(() => {
    const m = new Map<string, ClassGroupRow[]>();
    for (const r of sortedClassGroups) {
      const k = r.gradeLevel != null ? `Class ${r.gradeLevel}` : 'Other';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [sortedClassGroups]);

  const catalogCount = subjects.length;

  const loadByStaff = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of allocRows) {
      if (a.staffId == null) continue;
      m.set(a.staffId, (m.get(a.staffId) ?? 0) + (a.weeklyFrequency > 0 ? a.weeklyFrequency : 0));
    }
    return m;
  }, [allocRows]);

  // If templates exist, ensure allocRows shown are derived from template+override.
  useEffect(() => {
    if (!classSubjectConfigs?.length) return;
    const effective = buildEffectiveAllocRows(classGroups, classSubjectConfigs, sectionSubjectOverrides);
    setAllocRows(effective);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classGroups, classSubjectConfigs, sectionSubjectOverrides]);

  useEffect(() => {
    if (!classGroups.length) return;
    if (bulkContextSectionId === '' && sortedClassGroups[0]) {
      setBulkContextSectionId(String(sortedClassGroups[0].classGroupId));
    }
  }, [classGroups.length, sortedClassGroups, bulkContextSectionId]);

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

  const gradeHasAnyEnabledSubject = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const g of gradesInSchool) m.set(g, false);
    for (const a of allocRows) {
      const cg = classGroups.find((c) => c.classGroupId === a.classGroupId);
      const g = cg?.gradeLevel;
      if (g == null) continue;
      m.set(Number(g), true);
    }
    return m;
  }, [gradesInSchool, allocRows, classGroups]);

  const sectionHasAnyEnabledSubject = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const cg of classGroups) m.set(cg.classGroupId, false);
    for (const a of allocRows) {
      m.set(a.classGroupId, true);
    }
    return m;
  }, [classGroups, allocRows]);

  const mappingComplete = useMemo(() => {
    if (classGroups.length === 0) return false;
    for (const cg of classGroups) {
      if (!sectionHasAnyEnabledSubject.get(cg.classGroupId)) return false;
    }
    return true;
  }, [classGroups, sectionHasAnyEnabledSubject]);

  // (gradeSelectOptions removed — class mapping uses the left list now)

  const sectionsForInitialGrade = useMemo(() => {
    const g = Number(initialGradePick);
    if (!Number.isFinite(g)) return [];
    return classGroups
      .filter((c) => Number(c.gradeLevel) === g)
      .slice()
      .sort((a, b) => String(a.section ?? '').localeCompare(String(b.section ?? '')))
      .map((c) => ({ value: String(c.classGroupId), label: `${c.displayName || c.code}${c.section ? ` · ${c.section}` : ''}` }));
  }, [classGroups, initialGradePick]);

  // When class changes, default to all sections selected.
  useEffect(() => {
    if (!initialGradePick) {
      setInitialSectionPicks([]);
      return;
    }
    const all = sectionsForInitialGrade.map((s) => s.value);
    setInitialSectionPicks(all);
  }, [initialGradePick, sectionsForInitialGrade]);

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

  const applySubjectsToSelectedSections = (grade: number, sectionIds: number[], subjectIds: number[]) => {
    setMappingTouched((p) => ({ ...p, [String(grade)]: true }));
    const selected = new Set(sectionIds);
    if (selected.size === 0) return;

    const desired = new Set(subjectIds.map((x) => Number(x)).filter((n) => Number.isFinite(n)));

    // Current subjects for selected sections (effective)
    const currentBySection = new Map<number, Set<number>>();
    for (const sid of selected) currentBySection.set(sid, new Set());
    for (const a of allocRows) {
      if (!selected.has(a.classGroupId)) continue;
      currentBySection.get(a.classGroupId)!.add(a.subjectId);
    }

    // Ensure template rows exist for subjects that will be enabled in any selected section.
    const tplSet = new Set(
      classSubjectConfigs.filter((c) => Number(c.gradeLevel) === Number(grade)).map((c) => Number(c.subjectId)),
    );
    const needTpl = new Set<number>();
    for (const s of desired) needTpl.add(s);
    // also keep template for subjects already used by other sections in this grade (avoid accidental removal)
    for (const a of allocRows) {
      const cg = classGroups.find((c) => c.classGroupId === a.classGroupId);
      if (cg?.gradeLevel == null) continue;
      if (Number(cg.gradeLevel) !== Number(grade)) continue;
      needTpl.add(a.subjectId);
    }
    const toAddTpl = [...needTpl].filter((sid) => !tplSet.has(sid));
    if (toAddTpl.length) {
      setClassSubjectConfigs((p) => {
        const out = [...p];
        for (const sid of toAddTpl) {
          const sub = subjects.find((s) => Number(s.id) === Number(sid));
          if (!sub) continue;
          const freq = sub.weeklyFrequency && sub.weeklyFrequency > 0 ? sub.weeklyFrequency : 4;
          const tch = teacherOptionsForSubject(staff, sub.id)[0] ?? staff.find((s) => isStaffTeacher(s));
          out.push({
            gradeLevel: grade,
            subjectId: sub.id,
            defaultPeriodsPerWeek: freq,
            defaultTeacherId: tch ? tch.id : null,
            defaultRoomId: null,
          });
        }
        return out;
      });
    }

    // Apply enable/disable only for selected sections (others unchanged).
    for (const sid of selected) {
      const cur = currentBySection.get(sid) ?? new Set<number>();
      // disable subjects removed from desired (for this section)
      for (const subj of cur) {
        if (!desired.has(subj)) {
          upsertOverride(sid, subj, { periodsPerWeek: 0 });
        }
      }
      // enable subjects added in desired (for this section)
      for (const subj of desired) {
        if (cur.has(subj)) continue;
        // remove pure-disable override so it inherits template again
        removeOverrideIfOnlyDisable(sid, subj);
        // if there is an override row disabling via periodsPerWeek=0 with teacher/room fields, clear periods so it inherits template
        upsertOverride(sid, subj, { periodsPerWeek: null });
      }
    }

    // Cleanup: if a subject is not used by any section in grade after changes, remove the template row.
    // We recompute usage from allocRows after state settles; keep it simple (no hard delete here).
  };

  const effectiveForGrade = useMemo(() => {
    const g = Number(initialGradePick);
    if (!Number.isFinite(g)) return [];
    const inGrade = new Set(classGroups.filter((c) => Number(c.gradeLevel) === g).map((c) => c.classGroupId));
    return allocRows.filter((a) => inGrade.has(a.classGroupId) && a.weeklyFrequency > 0);
  }, [allocRows, classGroups, initialGradePick]);

  const templateSubjectIdsForGrade = useMemo(() => {
    const g = Number(initialGradePick);
    if (!Number.isFinite(g)) return [];
    return classSubjectConfigs.filter((c) => Number(c.gradeLevel) === g).map((c) => Number(c.subjectId));
  }, [classSubjectConfigs, initialGradePick]);

  const classDefaultsSelected = useMemo(() => {
    const set = new Set<number>();
    for (const id of templateSubjectIdsForGrade) set.add(Number(id));
    return set;
  }, [templateSubjectIdsForGrade]);

  const filteredSubjectsForMapping = useMemo(() => {
    const q = mappingSearch.trim().toLowerCase();
    const list = subjects.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [subjects, mappingSearch]);

  const sectionEnabledSet = (classGroupId: number) => {
    const set = new Set<number>();
    for (const a of allocRows) {
      if (a.classGroupId !== classGroupId) continue;
      if (a.weeklyFrequency <= 0) continue;
      set.add(a.subjectId);
    }
    return set;
  };

  const ensureTemplateHas = (grade: number, subjectId: number) => {
    if (classSubjectConfigs.some((c) => Number(c.gradeLevel) === Number(grade) && Number(c.subjectId) === Number(subjectId))) return;
    const sub = subjects.find((s) => Number(s.id) === Number(subjectId));
    if (!sub) return;
    const freq = sub.weeklyFrequency && sub.weeklyFrequency > 0 ? sub.weeklyFrequency : 4;
    const tch = teacherOptionsForSubject(staff, sub.id)[0] ?? staff.find((s) => isStaffTeacher(s));
    setClassSubjectConfigs((p) => [
      ...p,
      {
        gradeLevel: grade,
        subjectId: sub.id,
        defaultPeriodsPerWeek: freq,
        defaultTeacherId: tch ? tch.id : null,
        defaultRoomId: null,
      },
    ]);
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

  const saveClassDefaults = (grade: number, selected: Set<number>) => {
    // Preserve any subject that is enabled in any section of this grade (so section-only adds don't disappear).
    const keep = new Set<number>(selected);
    for (const a of effectiveForGrade) keep.add(a.subjectId);

    setClassSubjectConfigs((p) => {
      const rest = p.filter((c) => Number(c.gradeLevel) !== Number(grade));
      const prev = p.filter((c) => Number(c.gradeLevel) === Number(grade));
      const byId = new Map<number, ClassSubjectConfigRow>();
      for (const c of prev) byId.set(Number(c.subjectId), c);
      const out: ClassSubjectConfigRow[] = [...rest];
      for (const sid of [...keep].sort((a, b) => a - b)) {
        const existing = byId.get(sid);
        if (existing) {
          out.push(existing);
        } else {
          const sub = subjects.find((s) => Number(s.id) === sid);
          if (!sub) continue;
          const freq = sub.weeklyFrequency && sub.weeklyFrequency > 0 ? sub.weeklyFrequency : 4;
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
    toast.success('Saved', `Class ${grade} subject defaults updated.`);
  };

  const runBulk = () => {
    const sid = Number(bulkContextSectionId);
    if (!Number.isFinite(sid) || !bulkAction) {
      toast.error('Bulk action', 'Choose a target section and an action.');
      return;
    }
    if (bulkAction === 'apply_teacher_grade') {
      const tid = Number(bulkTeacherId);
      if (!Number.isFinite(tid)) {
        toast.error('Teacher', 'Pick a teacher.');
        return;
      }
      const g = classGroups.find((c) => c.classGroupId === sid)?.gradeLevel;
      if (g == null) return;
      const same = new Set(classGroups.filter((c) => c.gradeLevel === g).map((c) => c.classGroupId));
      setAllocRows((prev) => prev.map((r) => (same.has(r.classGroupId) ? { ...r, staffId: tid } : r)));
      toast.success('Updated', 'Teacher set for all rows in this grade.');
      return;
    }
    if (bulkAction === 'apply_room_grade') {
      const g = classGroups.find((c) => c.classGroupId === sid)?.gradeLevel;
      if (g == null) return;
      const same = new Set(classGroups.filter((c) => c.gradeLevel === g).map((c) => c.classGroupId));
      const roomId = bulkRoomId === '' ? null : Number(bulkRoomId);
      if (bulkRoomId !== '' && !Number.isFinite(roomId)) return;
      setAllocRows((prev) => prev.map((r) => (same.has(r.classGroupId) ? { ...r, roomId: roomId as number | null } : r)));
      toast.success('Updated', 'Room set for all rows in this grade.');
      return;
    }
    if (bulkAction === 'copy_periods_grade') {
      const g = classGroups.find((c) => c.classGroupId === sid)?.gradeLevel;
      if (g == null) {
        toast.error('Grade', 'Target section has no grade.');
        return;
      }
      const inGrade = new Set(classGroups.filter((c) => c.gradeLevel === g).map((c) => c.classGroupId));
      setAllocRows((prev) => {
        const bySubject = new Map<number, number>();
        for (const r of prev) {
          if (r.classGroupId === sid) bySubject.set(r.subjectId, r.weeklyFrequency);
        }
        if (bySubject.size === 0) {
          toast.info('Nothing to copy', 'Enable subjects on the target section first.');
          return prev;
        }
        let changed = 0;
        const next = prev.map((r) => {
          if (!inGrade.has(r.classGroupId) || r.classGroupId === sid) return r;
          const w = bySubject.get(r.subjectId);
          if (w == null || w < 1) return r;
          if (r.weeklyFrequency === w) return r;
          changed += 1;
          return { ...r, weeklyFrequency: w };
        });
        if (changed > 0) toast.success('Periods copied', `${changed} row(s) updated.`);
        else toast.info('No change', 'Other sections need matching subjects or already match.');
        return next;
      });
    }
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

  return (
    <div className="card stack" style={{ gap: 16 }}>
      {/* Header/description intentionally omitted here; wizard already provides it. */}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className={tab === 'sections' ? 'btn' : 'btn secondary'} onClick={() => setTab('sections')}>
          Subject → section mapping
        </button>
        <button
          type="button"
          className={tab === 'smart' ? 'btn' : 'btn secondary'}
          onClick={() => setTab('smart')}
          disabled={!mappingComplete}
          title={!mappingComplete ? 'Complete subject mapping first to unlock smart assignment.' : undefined}
        >
          Smart assignment
        </button>
        <button
          type="button"
          className={tab === 'load' ? 'btn' : 'btn secondary'}
          onClick={() => setTab('load')}
          disabled={!mappingComplete}
          title={!mappingComplete ? 'Complete subject mapping first to unlock teacher load.' : undefined}
        >
          Teacher load
        </button>
        <button
          type="button"
          className={tab === 'bulk' ? 'btn' : 'btn secondary'}
          onClick={() => setTab('bulk')}
          disabled={!mappingComplete}
          title={!mappingComplete ? 'Complete subject mapping first to unlock bulk tools.' : undefined}
        >
          Bulk tools
        </button>
      </div>

      {tab === 'smart' || tab === 'load' ? (
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
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <SelectKeeper
              value={smartSubjectFilter}
              onChange={setSmartSubjectFilter}
              options={[{ value: '', label: 'All subjects' }, ...subjects.map((s) => ({ value: String(s.id), label: s.name }))]}
            />
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
        </div>
      ) : null}

      {tab === 'smart' && slotsPerWeek != null ? (
        <div className="sms-alert sms-alert--info">
          <div>
            <div className="sms-alert__title">Weekly capacity (hint)</div>
            <div className="sms-alert__msg">
              Your school day allows about <strong>{slotsPerWeek}</strong> teachable slots per week. Keep each section’s total
              subject periods at or under this when possible.
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'smart' && classGroups.length > 0 && !isLoading ? (
        <div
          className="academic-progress-strip row"
          style={{
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(15,23,42,0.08)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(249,250,251,0.8))',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              School progress
            </div>
            <div style={{ fontSize: 18, fontWeight: 950, marginTop: 2 }}>{schoolProgress.pct}% sections ready</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {schoolProgress.withIssues} section{schoolProgress.withIssues === 1 ? '' : 's'} need attention
            </div>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 120 }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: 'rgba(15,23,42,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${schoolProgress.pct}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: schoolProgress.pct >= 100 ? '#16a34a' : 'var(--color-primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
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
                  Map at least one subject for <strong>every section</strong> to unlock Smart assignment, Teacher load, and Bulk tools.
                </div>
              </div>
            </div>
          ) : null}

          <div
            className="row"
            style={{
              gap: 12,
              alignItems: 'stretch',
              flexWrap: 'wrap',
            }}
          >
            <div
              className="stack"
              style={{
                flex: '0 0 340px',
                minWidth: 280,
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: 12,
                padding: 10,
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
                const sectionStatuses = secRows.map((s) => {
                  const enabled = sectionEnabledSet(s.classGroupId);
                  const inherited = new Set<number>(
                    classSubjectConfigs
                      .filter((c) => Number(c.gradeLevel) === Number(g))
                      .map((c) => Number(c.subjectId)),
                  );
                  const added = [...enabled].filter((x) => !inherited.has(x));
                  const removed = [...inherited].filter((x) => !enabled.has(x));
                  const hasOverride = added.length > 0 || removed.length > 0;
                  const started = enabled.size > 0;
                  const status: 'inherited' | 'override' | 'missing' | 'not_started' =
                    !started ? 'missing' : hasOverride ? 'override' : 'inherited';
                  return { classGroupId: s.classGroupId, label: s.section ?? s.code, status };
                });

                let classStatus: 'fully' | 'partial' | 'not_started' = 'not_started';
                const anyStarted = sectionStatuses.some((x) => x.status !== 'missing' && x.status !== 'not_started');
                const allInherited = sectionStatuses.every((x) => x.status === 'inherited');
                const anyOverride = sectionStatuses.some((x) => x.status === 'override');
                const anyMissing = sectionStatuses.some((x) => x.status === 'missing' || x.status === 'not_started');
                if (allInherited && anyStarted) classStatus = 'fully';
                else if (anyStarted || anyOverride) classStatus = 'partial';
                else classStatus = 'not_started';

                const badge =
                  classStatus === 'fully'
                    ? { text: '✔ Fully mapped', bg: 'rgba(22,163,74,0.12)', color: '#166534' }
                    : classStatus === 'partial'
                      ? { text: '⚠ Partial', bg: 'rgba(234,179,8,0.15)', color: '#a16207' }
                      : { text: '⏳ Not started', bg: 'rgba(100,116,139,0.12)', color: '#64748b' };

                return (
                  <div
                    key={g}
                    className="stack"
                    style={{
                      borderRadius: 12,
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(15,23,42,0.08)',
                      background: isSelected ? 'rgba(255,247,237,0.65)' : 'rgba(255,255,255,0.75)',
                      overflow: 'hidden',
                      marginBottom: 10,
                    }}
                  >
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setInitialGradePick(String(g))}
                      style={{
                        textAlign: 'left',
                        justifyContent: 'space-between',
                        display: 'flex',
                        gap: 10,
                        padding: '10px 12px',
                        border: 'none',
                        borderRadius: 0,
                        background: 'transparent',
                      }}
                      title="Select class"
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950 }}>{`Class ${g} (${secRows.length} section${secRows.length === 1 ? '' : 's'})`}</div>
                      </div>
                      <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 12, fontWeight: 900, background: badge.bg, color: badge.color }}>
                        {badge.text}
                      </span>
                    </button>
                    <div className="stack" style={{ gap: 6, padding: '0 12px 10px' }}>
                      {sectionStatuses.map((s) => {
                        const txt =
                          s.status === 'inherited'
                            ? '✔ Inherited'
                            : s.status === 'override'
                              ? '⚠ Override'
                              : 'Missing';
                        const color =
                          s.status === 'inherited' ? '#166534' : s.status === 'override' ? '#a16207' : '#b91c1c';
                        return (
                          <button
                            key={s.classGroupId}
                            type="button"
                            className="btn secondary"
                            style={{
                              padding: '6px 10px',
                              fontSize: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              border: '1px solid rgba(15,23,42,0.08)',
                              borderRadius: 10,
                            }}
                            onClick={() => {
                              setInitialGradePick(String(g));
                              setOverrideDrawer({ open: true, classGroupId: s.classGroupId });
                            }}
                            title="Configure section override"
                          >
                            <span style={{ fontWeight: 900 }}>{s.label}</span>
                            <span style={{ fontWeight: 900, color }}>{txt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        if (!initialGradePick) return;
                        const g = Number(initialGradePick);
                        if (!Number.isFinite(g)) return;
                        const all = new Set(subjects.map((s) => s.id));
                        saveClassDefaults(g, all);
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
                        const g = Number(initialGradePick);
                        if (!Number.isFinite(g)) return;
                        saveClassDefaults(g, new Set());
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
                        saveClassDefaults(g, classDefaultsSelected);
                      }}
                      disabled={!initialGradePick}
                    >
                      Save class defaults
                    </button>
                  </div>
                </div>

                <input
                  style={{ maxWidth: 420 }}
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  placeholder="Search subject by name/code…"
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
                  {filteredSubjectsForMapping.map((sub) => {
                    const on = classDefaultsSelected.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          const g = Number(initialGradePick);
                          if (!Number.isFinite(g)) return;
                          const next = new Set(classDefaultsSelected);
                          if (next.has(sub.id)) next.delete(sub.id);
                          else next.add(sub.id);
                          saveClassDefaults(g, next);
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
                        title={on ? 'Enabled in class defaults' : 'Disabled'}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900 }}>{sub.name}</div>
                          <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{sub.code}</div>
                        </div>
                        <div style={{ fontWeight: 950, fontSize: 16, color: on ? '#16a34a' : '#94a3b8' }}>
                          {on ? '☑' : '☐'}
                        </div>
                      </button>
                    );
                  })}
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
                          const sum =
                            enabled.size === 0
                              ? 'No subjects enabled'
                              : hasOverride
                                ? `${added.length ? `+${added.length}` : ''}${added.length && removed.length ? ' ' : ''}${removed.length ? `-${removed.length}` : ''}`.trim()
                                : 'Uses class defaults';
                          const statusColor = enabled.size === 0 ? '#b91c1c' : hasOverride ? '#a16207' : '#166534';
                          return (
                            <tr key={cg.classGroupId}>
                              <td>
                                <div style={{ fontWeight: 800 }}>{cg.displayName || cg.code}</div>
                                <div className="muted" style={{ fontSize: 12 }}>{cg.section ?? ''}</div>
                              </td>
                              <td style={{ fontWeight: 900, color: statusColor }}>{status}</td>
                              <td>{sum}</td>
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
            const desired = new Set(enabled);
            const all = new Set<number>([...inherited, ...enabled]);
            for (const s of subjects) all.add(s.id);
            const list = [...all].map((id) => subjects.find((s) => s.id === id)).filter(Boolean) as SubjectRow[];
            list.sort((a, b) => a.name.localeCompare(b.name));

            const toggle = (sid: number) => {
              if (desired.has(sid)) desired.delete(sid);
              else desired.add(sid);
              // eslint-disable-next-line @typescript-eslint/no-unused-expressions
              0;
            };

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
                    <div className="stack" style={{ gap: 8 }}>
                      {list.map((s) => {
                        const on = enabled.has(s.id);
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
                                  setSectionSubjectEnabled(cg.classGroupId, s.id, false);
                                } else {
                                  // enable (ensure template exists; disable others to make it an addition if needed)
                                  ensureTemplateHas(grade, s.id);
                                  setSectionSubjectEnabled(cg.classGroupId, s.id, true);
                                  for (const other of classGroups.filter((x) => Number(x.gradeLevel) === Number(grade))) {
                                    if (other.classGroupId === cg.classGroupId) continue;
                                    const otherEnabled = sectionEnabledSet(other.classGroupId);
                                    if (!otherEnabled.has(s.id) && !inherited.has(s.id)) {
                                      upsertOverride(other.classGroupId, s.id, { periodsPerWeek: 0 });
                                    }
                                  }
                                }
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800 }}>{s.name}</div>
                              <div className="muted" style={{ fontSize: 12 }}>{s.code}</div>
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
            <div style={{ fontWeight: 900, fontSize: 15 }}>Sections overview</div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Homerooms, weekly periods, and readiness are managed here. Use Configure section to override one section.
            </p>
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
                        <td style={{ minWidth: 260 }}>
                          <SelectKeeper
                            id={`ov-room-${row.classGroupId}`}
                            value={v}
                            onChange={(nv) => setDefaultRoomByClassId((prev) => ({ ...prev, [row.classGroupId]: nv }))}
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
          <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Smart teacher assignment</div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Auto-assign teachers by subject skill and balanced workload. Same teacher is preferred across all sections in a class.
              Lock keeps a row out of rebalance.
            </p>
            {!mappingComplete ? (
              <div className="sms-alert sms-alert--warning">
                <div>
                  <div className="sms-alert__title">Locked</div>
                  <div className="sms-alert__msg">Complete subject mapping for all classes first (Subject → section mapping tab).</div>
                </div>
              </div>
            ) : null}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn secondary"
                disabled={isLoading || defaultRoomsLoading || !mappingComplete}
                onClick={autoAssignDefaultRooms}
                title={!mappingComplete ? 'Complete subject mapping first to unlock.' : undefined}
              >
                Auto-assign homerooms
              </button>
              {classDefaultRoomHasConflicts ? (
                <span style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c' }}>Homeroom conflict: two classes share a room</span>
              ) : null}
            </div>
            <SmartTeacherAssignmentBlock
              classGroups={classGroups}
              subjects={subjects}
              staff={staff}
              classSubjectConfigs={classSubjectConfigs}
              setClassSubjectConfigs={setClassSubjectConfigs}
              sectionSubjectOverrides={sectionSubjectOverrides}
              setSectionSubjectOverrides={setSectionSubjectOverrides}
              assignmentMeta={assignmentMeta}
              setAssignmentMeta={setAssignmentMeta}
              subjectsCatalogForLabels={subjects}
              filters={{ grade: smartGradeFilter, subject: smartSubjectFilter, teacher: smartTeacherFilter }}
              showBulkActions
            />
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
            subjects={subjects}
            staff={staff}
            classSubjectConfigs={classSubjectConfigs}
            sectionSubjectOverrides={sectionSubjectOverrides}
            filters={{ grade: smartGradeFilter, subject: smartSubjectFilter, teacher: smartTeacherFilter }}
            subjectsCatalogForLabels={subjects}
          />
        </div>
      ) : null}

      {tab === 'bulk' ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Bulk tools</div>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
              Pick the <em>target section</em> (anchor), choose an action, add any extra field, then run it.
            </p>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="stack" style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 12, fontWeight: 800 }}>Target section</label>
                <ClassGroupSearchCombobox value={bulkContextSectionId} onChange={setBulkContextSectionId} />
              </div>
              <div className="stack" style={{ flex: '1 1 220px' }}>
                <label style={{ fontSize: 12, fontWeight: 800 }}>Action</label>
                <SelectKeeper
                  value={bulkAction}
                  onChange={(v) => setBulkAction((v || '') as BulkAction)}
                  options={[
                    { value: '', label: 'Choose action…' },
                    { value: 'apply_teacher_grade', label: 'Set same teacher (all rows in grade)' },
                    { value: 'apply_room_grade', label: 'Set same room (all rows in grade)' },
                    { value: 'copy_periods_grade', label: 'Copy periods from target to rest of grade' },
                  ]}
                />
              </div>
            </div>
            {bulkAction === 'apply_teacher_grade' ? (
              <div className="stack" style={{ maxWidth: 400 }}>
                <label style={{ fontSize: 12, fontWeight: 800 }}>Teacher</label>
                <SelectKeeper
                  value={bulkTeacherId}
                  onChange={setBulkTeacherId}
                  options={staff.filter(isStaffTeacher).map((s) => ({ value: String(s.id), label: s.fullName || s.email }))}
                  emptyValueLabel="Select teacher…"
                />
              </div>
            ) : null}
            {bulkAction === 'apply_room_grade' ? (
              <div className="stack" style={{ maxWidth: 400 }}>
                <label style={{ fontSize: 12, fontWeight: 800 }}>Room</label>
                <SelectKeeper
                  value={bulkRoomId}
                  onChange={setBulkRoomId}
                  options={roomOpts.filter((o) => o.value !== '')}
                  emptyValueLabel="Homeroom / default"
                />
              </div>
            ) : null}
            <button type="button" className="btn" onClick={runBulk} disabled={!bulkAction || !bulkContextSectionId}>
              Run bulk action
            </button>
          </div>
        </div>
      ) : null}

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
                            const overTeacher = slotsPerWeek != null && load > slotsPerWeek;
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
                      onChange={(nv) => setDefaultRoomByClassId((prev) => ({ ...prev, [editingClassId]: nv }))}
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
              className="academic-subject-toggles"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 8,
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
                      const load = loadByStaff.get(row.staffId) ?? 0;
                      const overTeacher = slotsPerWeek != null && load > slotsPerWeek;
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
                                setAllocRows((p) =>
                                  p.map((x) => (sameAllocSlot(x, editingClassId, sub.id) ? { ...x, weeklyFrequency: n } : x)),
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

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn"
          disabled={savePending || !classGroups.length || classDefaultRoomHasConflicts}
          onClick={onSave}
        >
          {savePending ? 'Saving…' : 'Save to server & continue'}
        </button>
        {saveError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Save failed</div>
              <div className="sms-alert__msg">{formatError(saveError)}</div>
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? <div className="muted">Loading classes…</div> : null}
      {!isLoading && !classGroups.length ? (
        <div className="muted">No class groups yet. Complete “Classes & sections” first.</div>
      ) : null}
    </div>
  );
}
