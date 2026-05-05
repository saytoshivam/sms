import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import {
  assignmentSourceFromApi,
  buildEffectiveAllocRows,
  estimateSlotsPerWeek,
  homeroomMapFromDraft,
  type AcademicAllocRow,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from './academicStructureUtils';
import type { AssignmentSlotMeta } from './academicStructureSmartAssign';
import { assignHomeroomsGreedy, classGroupsToHomeroomSections, roomsToHomeroomInputs } from './homeroomAssignment';
import { runAutoAssignClassTeachers, type ClassTeacherSource } from './classTeacherAutoAssign';
import { useApiTags } from './apiTags';
import { useImpactStore } from './impactStore';

/**
 * Lifts the academic-structure orchestration that used to live inside
 * `SchoolOnboardingWizardPage` so that the wizard step component can be
 * mounted standalone (e.g. inside `AcademicModulePage`).
 *
 * Responsibilities:
 *   - Source server data (academic structure, rooms, and basic info for weekly capacity hints).
 *   - Own the local draft state (configs, overrides, default rooms, smart-assign meta, alloc rows).
 *   - Hydrate drafts from the server on first load.
 *   - Provide a save mutation that PUTs to /api/v1/onboarding/academic-structure
 *     and propagates impact + cache invalidation.
 *   - Provide derived bits (room option list, default-room conflict map, auto-assign helper).
 *
 * The wizard keeps its own duplicate state today; both are wire-compatible
 * because they share `AcademicStructureSetupStep`'s prop contract. This hook is
 * intentionally read-only on the server side until `save()` is called, so
 * cross-tab / cross-flow editing won't clobber unsaved local changes.
 */

type RoomOption = {
  id: number;
  building?: string | null;
  buildingName?: string | null;
  floorName?: string | null;
  roomNumber: string;
  type?: string | null;
  labType?: string | null;
  isSchedulable?: boolean;
  capacity?: number | null;
  rawFloorNumber?: number | null;
};

type ClassGroupRow = {
  classGroupId: number;
  code: string;
  displayName: string;
  gradeLevel: number | null;
  section: string | null;
  defaultRoomId: number | null;
  classTeacherStaffId?: number | null;
  /** When true, bulk Auto assign homeroom skips this section. */
  homeroomLocked?: boolean;
  homeroomSource?: string | null;
  classTeacherSource?: string | null;
  classTeacherLocked?: boolean;
};

type SubjectRow = { id: number; code: string; name: string; weeklyFrequency: number | null };

/** Stable reference — avoids `?? []` creating a new array every render while snapshot is loading. */
const EMPTY_SUBJECTS: SubjectRow[] = [];

type StaffRow = {
  id: number;
  fullName: string;
  email: string;
  teachableSubjectIds: number[];
  roleNames: string[];
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[] | null;
};

/** Mirrors `/api/v1/onboarding/basic-info`; used with `estimateSlotsPerWeek`. */
type BasicInfoShape = {
  schoolStartTime: string;
  schoolEndTime: string;
  lectureDurationMinutes: number;
  workingDays: string[];
  openWindows?: { startTime: string; endTime: string }[];
};

type AcademicStructurePayload = {
  classGroups: ClassGroupRow[];
  subjects: SubjectRow[];
  staff: StaffRow[];
  rooms?: RoomOption[];
  basicInfo?: BasicInfoShape;
  allocations: { classGroupId: number; subjectId: number; weeklyFrequency: number; staffId: number | null; roomId: number | null }[];
  classSubjectConfigs?: ClassSubjectConfigRow[];
  sectionSubjectOverrides?: SectionSubjectOverrideRow[];
  assignmentSlotMeta?: {
    classGroupId: number;
    subjectId: number;
    source: string;
    locked: boolean;
  }[];
};

type SpringPage<T> = { content: T[]; totalElements?: number };

function pageContent<T>(data: SpringPage<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.content) ? data.content : [];
}

function assignmentSlotMetaFromApi(
  x: NonNullable<AcademicStructurePayload['assignmentSlotMeta']>[number],
): AssignmentSlotMeta | null {
  const src = x.source;
  if (src !== 'auto' && src !== 'manual' && src !== 'rebalanced') return null;
  return { source: src as AssignmentSlotMeta['source'], locked: !!x.locked };
}

export type UseAcademicStructureModuleResult = {
  // server data
  classGroups: ClassGroupRow[];
  subjects: SubjectRow[];
  staff: StaffRow[];
  rooms: RoomOption[];
  basicInfo: BasicInfoShape | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  roomsError: unknown | null;

  // draft state
  allocRows: AcademicAllocRow[];
  setAllocRows: React.Dispatch<React.SetStateAction<AcademicAllocRow[]>>;
  classSubjectConfigs: ClassSubjectConfigRow[];
  setClassSubjectConfigs: React.Dispatch<React.SetStateAction<ClassSubjectConfigRow[]>>;
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  setSectionSubjectOverrides: React.Dispatch<React.SetStateAction<SectionSubjectOverrideRow[]>>;
  defaultRoomByClassId: Record<number, string>;
  setDefaultRoomByClassId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  setAssignmentMeta: React.Dispatch<React.SetStateAction<Record<string, AssignmentSlotMeta>>>;
  /** Section-level homeroom provenance ('auto' rows can be cleared by bulk automation). */
  homeroomSourceByClassId: Record<number, 'auto' | 'manual' | ''>;
  /** Class teacher (daily homeroom) staff id draft per section. */
  classTeacherByClassId: Record<number, string>;
  /** Manual source prevents bulk auto-assign class teachers from overwriting picks. */
  classTeacherSourceByClassId: Record<number, ClassTeacherSource>;
  patchSectionClassTeacher: (classGroupId: number, staffIdValue: string) => void;
  autoAssignClassTeachers: () => void;

  // derived helpers
  classDefaultRoomSelectOptions: { value: string; label: string }[];
  classDefaultRoomUsage: Map<string, number>;
  classDefaultRoomHasConflicts: boolean;
  autoAssignDefaultRooms: () => void;
  /** Clears section homeroom draft fields only (default rooms + homeroom provenance + locks). */
  clearHomeroomDraft: () => void;
  /** Clears class teachers only where source is Auto assign class teachers. */
  clearAutoAssignedClassTeachers: () => void;
  /** Clears every section's class teacher draft (manual and auto). */
  clearAllClassTeacherAssignments: () => void;
  /** Clears homeroom draft and auto class teachers (same as both granular clears). */
  clearAutoHomeroomAssignments: () => void;
  /** Mark a section homeroom as manually chosen (skips future bulk auto overwrite for that section). */
  patchSectionHomeroom: (classGroupId: number, value: string) => void;
  homeroomLockedByClassId: Record<number, boolean>;
  patchHomeroomLock: (classGroupId: number, locked: boolean) => void;
  /** When true, bulk Auto assign class teachers skips this section. */
  classTeacherLockedByClassId: Record<number, boolean>;
  patchClassTeacherLock: (classGroupId: number, locked: boolean) => void;
  defaultRoomsLoading: boolean;

  // dirty tracking + save
  dirty: boolean;
  pendingChanges: number;
  resetToServer: () => void;
  save: () => Promise<void>;
  savePending: boolean;
  saveError: unknown;
  saveSuccess: boolean;
};

export function useAcademicStructureModule(): UseAcademicStructureModuleResult {
  const qc = useQueryClient();
  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const [allocRows, setAllocRows] = useState<AcademicAllocRow[]>([]);
  const [classSubjectConfigs, setClassSubjectConfigs] = useState<ClassSubjectConfigRow[]>([]);
  const [sectionSubjectOverrides, setSectionSubjectOverrides] = useState<SectionSubjectOverrideRow[]>([]);
  const [defaultRoomByClassId, setDefaultRoomByClassId] = useState<Record<number, string>>({});
  const [homeroomSourceByClassId, setHomeroomSourceByClassId] = useState<Record<number, 'auto' | 'manual' | ''>>({});
  const [homeroomLockedByClassId, setHomeroomLockedByClassId] = useState<Record<number, boolean>>({});
  const [classTeacherByClassId, setClassTeacherByClassId] = useState<Record<number, string>>({});
  const [classTeacherSourceByClassId, setClassTeacherSourceByClassId] = useState<Record<number, ClassTeacherSource>>({});
  const [classTeacherLockedByClassId, setClassTeacherLockedByClassId] = useState<Record<number, boolean>>({});
  const [assignmentMeta, setAssignmentMeta] = useState<Record<string, AssignmentSlotMeta>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /** Latest draft fields for PUT — avoids stale closures inside useMutation after flushSync/setState. */
  const academicDraftRef = useRef({
    classSubjectConfigs,
    sectionSubjectOverrides,
    defaultRoomByClassId,
    homeroomSourceByClassId,
    classTeacherByClassId,
    classTeacherSourceByClassId,
    classTeacherLockedByClassId,
    assignmentMeta,
    homeroomLockedByClassId,
  });
  academicDraftRef.current = {
    classSubjectConfigs,
    sectionSubjectOverrides,
    defaultRoomByClassId,
    homeroomSourceByClassId,
    classTeacherByClassId,
    classTeacherSourceByClassId,
    classTeacherLockedByClassId,
    assignmentMeta,
    homeroomLockedByClassId,
  };

  // ---- queries ----
  const basicInfoQuery = useQuery({
    queryKey: ['onboarding-basic-info'],
    queryFn: async () => (await api.get<BasicInfoShape>('/api/v1/onboarding/basic-info')).data,
  });

  const academicStructureQuery = useQuery({
    queryKey: ['onboarding-academic-structure'],
    queryFn: async () => {
      const data = (await api.get<AcademicStructurePayload>('/api/v1/onboarding/academic-structure')).data;
      // Guard against a backend serializer quirk that sometimes used `id` instead of `classGroupId`.
      const classGroups = (data.classGroups ?? []).map((cg) => {
        const raw = cg as ClassGroupRow & { id?: number };
        const g = raw.classGroupId ?? raw.id;
        return { ...raw, classGroupId: Number.isFinite(Number(g)) ? Number(g) : raw.classGroupId };
      });
      return { ...data, classGroups };
    },
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: async () =>
      (await api.get<SpringPage<RoomOption> | RoomOption[]>('/api/rooms?size=500')).data,
  });

  // Hydrate local drafts when opening the module or after an explicit post-save resync.
  // Important: skip while `isFetching` so we never overlay fresh edits with stale cache before refetch completes.
  useEffect(() => {
    const d = academicStructureQuery.data;
    if (!d) return;
    if (hydrated) return;
    if (academicStructureQuery.isFetching) return;

    setClassSubjectConfigs(d.classSubjectConfigs ?? []);
    setSectionSubjectOverrides(
      (d.sectionSubjectOverrides ?? []).map((o) => ({
        ...o,
        roomId: null,
      })),
    );

    if (d.assignmentSlotMeta?.length) {
      const rec: Record<string, AssignmentSlotMeta> = {};
      for (const x of d.assignmentSlotMeta) {
        if (!x) continue;
        const sk = `${x.classGroupId}:${x.subjectId}`;
        const meta = assignmentSlotMetaFromApi(x);
        if (meta) rec[sk] = meta;
      }
      setAssignmentMeta(rec);
    } else {
      setAssignmentMeta({});
    }

    const nextDefaults: Record<number, string> = {};
    for (const r of d.classGroups ?? []) {
      nextDefaults[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
    }

    const homeroomMap = homeroomMapFromDraft(d.classGroups ?? [], nextDefaults);

    if ((d.classSubjectConfigs?.length ?? 0) > 0) {
      setAllocRows(
        buildEffectiveAllocRows(d.classGroups ?? [], d.classSubjectConfigs ?? [], d.sectionSubjectOverrides ?? [], homeroomMap),
      );
    } else {
      setAllocRows(
        (d.allocations ?? []).map((a) => ({
          classGroupId: a.classGroupId,
          subjectId: a.subjectId,
          staffId: a.staffId ?? null,
          weeklyFrequency: a.weeklyFrequency,
          roomId: a.roomId ?? null,
        })),
      );
    }

    const nextHomeroomSrc: Record<number, 'manual' | 'auto' | ''> = {};
    for (const r of d.classGroups ?? []) {
      const persisted = assignmentSourceFromApi(r.homeroomSource);
      if (persisted) nextHomeroomSrc[r.classGroupId] = persisted;
      else nextHomeroomSrc[r.classGroupId] = r.defaultRoomId != null ? 'manual' : '';
    }
    setHomeroomSourceByClassId(nextHomeroomSrc);

    const nextHomeroomLockedHydrate: Record<number, boolean> = {};
    for (const r of d.classGroups ?? []) {
      nextHomeroomLockedHydrate[r.classGroupId] = !!(r as ClassGroupRow).homeroomLocked;
    }
    setHomeroomLockedByClassId(nextHomeroomLockedHydrate);

    const nextCt: Record<number, string> = {};
    const nextCtSrc: Record<number, ClassTeacherSource> = {};
    const nextCtLock: Record<number, boolean> = {};
    for (const r of d.classGroups ?? []) {
      const rawId = r.classTeacherStaffId;
      nextCt[r.classGroupId] = rawId != null && Number.isFinite(Number(rawId)) ? String(rawId) : '';
      nextCtSrc[r.classGroupId] = assignmentSourceFromApi(r.classTeacherSource) as ClassTeacherSource;
      nextCtLock[r.classGroupId] = !!r.classTeacherLocked;
    }
    setClassTeacherByClassId(nextCt);
    setClassTeacherSourceByClassId(nextCtSrc);
    setClassTeacherLockedByClassId(nextCtLock);

    setDefaultRoomByClassId(nextDefaults);
    setHydrated(true);
  }, [academicStructureQuery.data, academicStructureQuery.isFetching, hydrated]);

  // ---- derived: room options + usage + conflicts ----
  const rooms = useMemo(() => pageContent<RoomOption>(roomsQuery.data), [roomsQuery.data]);

  const classDefaultRoomSelectOptions = useMemo(() => {
    const opts = rooms
      .filter((r) => (r as RoomOption).isSchedulable !== false)
      .slice()
      .sort((a, b) => {
        const ba = String(a.buildingName ?? a.building ?? '').localeCompare(String(b.buildingName ?? b.building ?? ''));
        if (ba !== 0) return ba;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      })
      .map((r) => ({
        value: String(r.id),
        label: `${String(r.buildingName ?? r.building ?? '').trim()} ${r.roomNumber}${r.type ? ` · ${r.type}` : ''}`.trim(),
      }));
    return [{ value: '', label: 'No room assigned' }, ...opts];
  }, [rooms]);

  const classDefaultRoomUsage = useMemo(() => {
    const groups = academicStructureQuery.data?.classGroups ?? [];
    const usage = new Map<string, number>();
    for (const g of groups) {
      const v = defaultRoomByClassId[g.classGroupId] ?? '';
      if (!v) continue;
      usage.set(v, (usage.get(v) ?? 0) + 1);
    }
    return usage;
  }, [academicStructureQuery.data?.classGroups, defaultRoomByClassId]);

  const classDefaultRoomHasConflicts = useMemo(() => {
    for (const c of classDefaultRoomUsage.values()) if (c > 1) return true;
    return false;
  }, [classDefaultRoomUsage]);

  const patchSectionHomeroom = useCallback((classGroupId: number, value: string) => {
    setDefaultRoomByClassId((prev) => ({ ...prev, [classGroupId]: value }));
    setHomeroomSourceByClassId((prev) => ({
      ...prev,
      [classGroupId]: value.trim() !== '' ? 'manual' : '',
    }));
    if (value.trim() === '') {
      setHomeroomLockedByClassId((prev) => ({ ...prev, [classGroupId]: false }));
    }
  }, []);

  const patchHomeroomLock = useCallback((classGroupId: number, locked: boolean) => {
    setHomeroomLockedByClassId((prev) => ({ ...prev, [classGroupId]: locked }));
  }, []);

  const patchClassTeacherLock = useCallback((classGroupId: number, locked: boolean) => {
    setClassTeacherLockedByClassId((prev) => ({ ...prev, [classGroupId]: locked }));
  }, []);

  const patchSectionClassTeacher = useCallback((classGroupId: number, staffIdValue: string) => {
    const v = String(staffIdValue ?? '').trim();
    setClassTeacherByClassId((prev) => ({ ...prev, [classGroupId]: v }));
    setClassTeacherSourceByClassId((prev) => ({
      ...prev,
      [classGroupId]: v !== '' ? 'manual' : '',
    }));
    if (v === '') {
      setClassTeacherLockedByClassId((prev) => ({ ...prev, [classGroupId]: false }));
    }
  }, []);

  const autoAssignClassTeachers = useCallback(() => {
    const cgRows = academicStructureQuery.data?.classGroups ?? [];
    if (!cgRows.length || !classSubjectConfigs.length) {
      toast.info('Class teachers', 'Add sections and academic mappings first.');
      return;
    }
    const hm = homeroomMapFromDraft(cgRows, defaultRoomByClassId);
    const effective = buildEffectiveAllocRows(cgRows, classSubjectConfigs, sectionSubjectOverrides, hm);
    const slotsPw = estimateSlotsPerWeek(basicInfoQuery.data ?? academicStructureQuery.data?.basicInfo ?? null);
    const mini = cgRows.map((c) => ({ classGroupId: c.classGroupId, gradeLevel: c.gradeLevel }));
    const { nextTeachers, nextSource, stats } = runAutoAssignClassTeachers({
      classGroups: mini,
      effectiveAllocRows: effective,
      classTeacherByClassGroupId: classTeacherByClassId,
      classTeacherSourceByClassGroupId: classTeacherSourceByClassId,
      classTeacherLockedByClassGroupId: classTeacherLockedByClassId,
      schoolSlotsPerWeek: slotsPw,
    });
    setClassTeacherByClassId(nextTeachers);
    setClassTeacherSourceByClassId(nextSource);
    toast.success(
      'Class teacher assignment complete',
      `Assigned: ${stats.assigned} · Unique: ${stats.uniqueAssignments} · Shared: ${stats.sharedAssignments} · Locked skipped: ${stats.skippedLocked} · No eligible teacher: ${stats.skippedNoEligibleTeacher}`,
    );
  }, [
    academicStructureQuery.data?.classGroups,
    academicStructureQuery.data?.basicInfo,
    classSubjectConfigs,
    sectionSubjectOverrides,
    defaultRoomByClassId,
    classTeacherByClassId,
    classTeacherSourceByClassId,
    classTeacherLockedByClassId,
    basicInfoQuery.data,
  ]);

  const autoAssignDefaultRooms = useCallback(() => {
    const cgRows = academicStructureQuery.data?.classGroups ?? [];
    if (cgRows.length === 0 || rooms.length === 0) {
      toast.info('Section rooms', 'Add class sections and rooms first.');
      return;
    }

    const roomInputs = roomsToHomeroomInputs(rooms as unknown as Array<Record<string, unknown>>);
    // Per-slot room locks do not skip bulk homeroom — locking a subject room was blocking Auto assign homeroom for the whole section.
    const sections = classGroupsToHomeroomSections(
      cgRows as ClassGroupRow[],
      homeroomSourceByClassId,
      null,
      homeroomLockedByClassId,
    );
    const { assignments, stats } = assignHomeroomsGreedy({
      sections,
      rooms: roomInputs,
      assumeHeadcountWhenUnknown: 28,
    });

    setDefaultRoomByClassId((prev) => {
      const next = { ...prev };
      for (const [cgIdStr, rid] of Object.entries(assignments)) {
        next[Number(cgIdStr)] = String(rid);
      }
      return next;
    });
    setHomeroomSourceByClassId((prev) => {
      const n = { ...prev };
      for (const cgIdStr of Object.keys(assignments)) {
        n[Number(cgIdStr)] = 'auto';
      }
      return n;
    });

    toast.success(
      'Section rooms assigned',
      `Assigned: ${stats.assigned} · Consecutive clusters: ${stats.consecutiveClusters} · Lower-floor optimized: ${stats.lowerFloorOptimized} · Skipped locked sections: ${stats.skippedLockedSections} · Conflicts: ${stats.conflicts}`,
    );
  }, [academicStructureQuery.data?.classGroups, rooms, homeroomSourceByClassId, homeroomLockedByClassId]);

  const clearHomeroomDraft = useCallback(() => {
    const cgs = academicStructureQuery.data?.classGroups ?? [];
    setDefaultRoomByClassId((prev) => {
      const next = { ...prev };
      const ids = new Set(cgs.map((cg) => cg.classGroupId));
      if (ids.size === 0) {
        for (const k of Object.keys(next)) next[Number(k)] = '';
      } else {
        for (const id of ids) next[id] = '';
      }
      return next;
    });
    setHomeroomSourceByClassId({});
    setHomeroomLockedByClassId({});
  }, [academicStructureQuery.data?.classGroups]);

  const clearAutoAssignedClassTeachers = useCallback(() => {
    const cgs = academicStructureQuery.data?.classGroups ?? [];
    let idsToClear: number[] = [];
    flushSync(() => {
      setClassTeacherSourceByClassId((srcPrev) => {
        const nextSrc = { ...srcPrev } as Record<number, ClassTeacherSource>;
        idsToClear = [];
        for (const cg of cgs) {
          const id = Number(cg.classGroupId);
          if (!Number.isFinite(id)) continue;
          const src =
            srcPrev[id] ??
            (srcPrev as Record<string, ClassTeacherSource | undefined>)[String(id)] ??
            '';
          if (src === 'auto') {
            nextSrc[id] = '';
            idsToClear.push(id);
          }
        }
        return nextSrc;
      });
    });
    if (idsToClear.length === 0) return;
    setClassTeacherByClassId((ctPrev) => {
      const nextCt = { ...ctPrev };
      for (const cid of idsToClear) nextCt[cid] = '';
      return nextCt;
    });
  }, [academicStructureQuery.data?.classGroups]);

  const clearAllClassTeacherAssignments = useCallback(() => {
    const cgs = academicStructureQuery.data?.classGroups ?? [];
    setClassTeacherByClassId((ctPrev) => {
      const nextCt = { ...ctPrev };
      for (const cg of cgs) {
        const id = Number(cg.classGroupId);
        if (Number.isFinite(id)) nextCt[id] = '';
      }
      return nextCt;
    });
    setClassTeacherSourceByClassId((srcPrev) => {
      const nextSrc = { ...srcPrev } as Record<number, ClassTeacherSource>;
      for (const cg of cgs) {
        const id = Number(cg.classGroupId);
        if (Number.isFinite(id)) nextSrc[id] = '';
      }
      return nextSrc;
    });
    setClassTeacherLockedByClassId((prev) => {
      const next = { ...prev };
      for (const cg of cgs) {
        const id = Number(cg.classGroupId);
        if (Number.isFinite(id)) next[id] = false;
      }
      return next;
    });
  }, [academicStructureQuery.data?.classGroups]);

  const clearAutoHomeroomAssignments = useCallback(() => {
    clearHomeroomDraft();
    clearAutoAssignedClassTeachers();
  }, [clearHomeroomDraft, clearAutoAssignedClassTeachers]);

  // ---- dirty tracking ----
  const serverSnapshot = academicStructureQuery.data;

  const draftSignature = useMemo(() => {
    return JSON.stringify({
      classSubjectConfigs,
      sectionSubjectOverrides,
      defaultRoomByClassId,
      homeroomSourceByClassId,
      classTeacherByClassId,
      classTeacherSourceByClassId,
      classTeacherLockedByClassId,
      assignmentMeta,
      homeroomLockedByClassId,
    });
  }, [
    classSubjectConfigs,
    sectionSubjectOverrides,
    defaultRoomByClassId,
    homeroomSourceByClassId,
    classTeacherByClassId,
    classTeacherSourceByClassId,
    classTeacherLockedByClassId,
    assignmentMeta,
    homeroomLockedByClassId,
  ]);

  const serverSignature = useMemo(() => {
    if (!serverSnapshot) return '';
    const defaults: Record<number, string> = {};
    const serverHmSrc: Record<number, 'auto' | 'manual' | ''> = {};
    const serverCt: Record<number, string> = {};
    const serverCtSrc: Record<number, ClassTeacherSource> = {};
    const serverCtl: Record<number, boolean> = {};
    for (const r of serverSnapshot.classGroups ?? []) {
      defaults[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
      serverHmSrc[r.classGroupId] = assignmentSourceFromApi(r.homeroomSource);
      if (!serverHmSrc[r.classGroupId] && r.defaultRoomId != null) serverHmSrc[r.classGroupId] = 'manual';
      serverCt[r.classGroupId] = r.classTeacherStaffId != null && Number.isFinite(Number(r.classTeacherStaffId)) ? String(r.classTeacherStaffId) : '';
      serverCtSrc[r.classGroupId] = assignmentSourceFromApi(r.classTeacherSource) as ClassTeacherSource;
      serverCtl[r.classGroupId] = !!r.classTeacherLocked;
    }
    const meta: Record<string, AssignmentSlotMeta> = {};
    for (const x of serverSnapshot.assignmentSlotMeta ?? []) {
      const sk = `${x.classGroupId}:${x.subjectId}`;
      const m = assignmentSlotMetaFromApi(x);
      if (m) meta[sk] = m;
    }
    const serverHl: Record<number, boolean> = {};
    for (const r of serverSnapshot.classGroups ?? []) {
      serverHl[r.classGroupId] = !!(r as ClassGroupRow).homeroomLocked;
    }
    return JSON.stringify({
      classSubjectConfigs: serverSnapshot.classSubjectConfigs ?? [],
      sectionSubjectOverrides: serverSnapshot.sectionSubjectOverrides ?? [],
      defaultRoomByClassId: defaults,
      homeroomSourceByClassId: serverHmSrc,
      classTeacherByClassId: serverCt,
      classTeacherSourceByClassId: serverCtSrc,
      classTeacherLockedByClassId: serverCtl,
      assignmentMeta: meta,
      homeroomLockedByClassId: serverHl,
    });
  }, [serverSnapshot]);

  const dirty = hydrated && draftSignature !== serverSignature;

  const pendingChanges = useMemo(() => {
    if (!dirty || !serverSnapshot) return 0;
    let n = 0;
    const sc = JSON.stringify(serverSnapshot.classSubjectConfigs ?? []);
    if (JSON.stringify(classSubjectConfigs) !== sc) n += 1;
    const so = JSON.stringify(serverSnapshot.sectionSubjectOverrides ?? []);
    if (JSON.stringify(sectionSubjectOverrides) !== so) n += 1;
    const sd: Record<number, string> = {};
    const serverHmSrc: Record<number, 'auto' | 'manual' | ''> = {};
    for (const r of serverSnapshot.classGroups ?? []) {
      sd[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
      serverHmSrc[r.classGroupId] = assignmentSourceFromApi(r.homeroomSource);
      if (!serverHmSrc[r.classGroupId] && r.defaultRoomId != null) serverHmSrc[r.classGroupId] = 'manual';
    }
    if (JSON.stringify(defaultRoomByClassId) !== JSON.stringify(sd)) n += 1;
    if (JSON.stringify(homeroomSourceByClassId) !== JSON.stringify(serverHmSrc)) n += 1;
    const serverCt: Record<number, string> = {};
    const serverCtSrc: Record<number, ClassTeacherSource> = {};
    const serverCtl: Record<number, boolean> = {};
    for (const r of serverSnapshot.classGroups ?? []) {
      serverCt[r.classGroupId] =
        r.classTeacherStaffId != null && Number.isFinite(Number(r.classTeacherStaffId)) ? String(r.classTeacherStaffId) : '';
      serverCtSrc[r.classGroupId] = assignmentSourceFromApi(r.classTeacherSource) as ClassTeacherSource;
      serverCtl[r.classGroupId] = !!r.classTeacherLocked;
    }
    if (JSON.stringify(classTeacherByClassId) !== JSON.stringify(serverCt)) n += 1;
    if (JSON.stringify(classTeacherSourceByClassId) !== JSON.stringify(serverCtSrc)) n += 1;
    if (JSON.stringify(classTeacherLockedByClassId) !== JSON.stringify(serverCtl)) n += 1;
    const sm: Record<string, AssignmentSlotMeta> = {};
    for (const x of serverSnapshot.assignmentSlotMeta ?? []) {
      const sk = `${x.classGroupId}:${x.subjectId}`;
      const m = assignmentSlotMetaFromApi(x);
      if (m) sm[sk] = m;
    }
    if (JSON.stringify(assignmentMeta) !== JSON.stringify(sm)) n += 1;
    const serverHl: Record<number, boolean> = {};
    for (const r of serverSnapshot.classGroups ?? []) {
      serverHl[r.classGroupId] = !!(r as ClassGroupRow).homeroomLocked;
    }
    if (JSON.stringify(homeroomLockedByClassId) !== JSON.stringify(serverHl)) n += 1;
    return n;
  }, [
    dirty,
    serverSnapshot,
    classSubjectConfigs,
    sectionSubjectOverrides,
    defaultRoomByClassId,
    classTeacherByClassId,
    classTeacherSourceByClassId,
    assignmentMeta,
    homeroomLockedByClassId,
    homeroomSourceByClassId,
    classTeacherLockedByClassId,
  ]);

  // ---- reset / save ----
  const resetToServer = useCallback(() => {
    const d = serverSnapshot;
    if (!d) return;
    setClassSubjectConfigs(d.classSubjectConfigs ?? []);
    setSectionSubjectOverrides(
      (d.sectionSubjectOverrides ?? []).map((o) => ({
        ...o,
        roomId: null,
      })),
    );
    const defaults: Record<number, string> = {};
    for (const r of d.classGroups ?? []) {
      defaults[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
    }
    setDefaultRoomByClassId(defaults);
    const meta: Record<string, AssignmentSlotMeta> = {};
    for (const x of d.assignmentSlotMeta ?? []) {
      const sk = `${x.classGroupId}:${x.subjectId}`;
      const m = assignmentSlotMetaFromApi(x);
      if (m) meta[sk] = m;
    }
    setAssignmentMeta(meta);
    const homeroomMap = homeroomMapFromDraft(d.classGroups ?? [], defaults);
    const nextHomeroomSrc: Record<number, 'manual' | 'auto' | ''> = {};
    for (const r of d.classGroups ?? []) {
      const persisted = assignmentSourceFromApi(r.homeroomSource);
      if (persisted) nextHomeroomSrc[r.classGroupId] = persisted;
      else nextHomeroomSrc[r.classGroupId] = r.defaultRoomId != null ? 'manual' : '';
    }
    setHomeroomSourceByClassId(nextHomeroomSrc);

    const nextHl: Record<number, boolean> = {};
    for (const r of d.classGroups ?? []) {
      nextHl[r.classGroupId] = !!(r as ClassGroupRow).homeroomLocked;
    }
    setHomeroomLockedByClassId(nextHl);

    const nextCt: Record<number, string> = {};
    const nextCtSrc: Record<number, ClassTeacherSource> = {};
    const nextCtLock: Record<number, boolean> = {};
    for (const r of d.classGroups ?? []) {
      nextCt[r.classGroupId] =
        r.classTeacherStaffId != null && Number.isFinite(Number(r.classTeacherStaffId)) ? String(r.classTeacherStaffId) : '';
      nextCtSrc[r.classGroupId] = assignmentSourceFromApi(r.classTeacherSource) as ClassTeacherSource;
      nextCtLock[r.classGroupId] = !!r.classTeacherLocked;
    }
    setClassTeacherByClassId(nextCt);
    setClassTeacherSourceByClassId(nextCtSrc);
    setClassTeacherLockedByClassId(nextCtLock);

    if ((d.classSubjectConfigs?.length ?? 0) > 0) {
      setAllocRows(
        buildEffectiveAllocRows(d.classGroups ?? [], d.classSubjectConfigs ?? [], d.sectionSubjectOverrides ?? [], homeroomMap),
      );
    } else {
      setAllocRows(
        (d.allocations ?? []).map((a) => ({
          classGroupId: a.classGroupId,
          subjectId: a.subjectId,
          staffId: a.staffId ?? null,
          weeklyFrequency: a.weeklyFrequency,
          roomId: a.roomId ?? null,
        })),
      );
    }
    setSaveSuccess(false);
  }, [serverSnapshot]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cgs = serverSnapshot?.classGroups ?? [];
      if (cgs.length === 0) throw new Error('No class groups found. Generate classes first.');
      const {
        classSubjectConfigs: configsPayload,
        sectionSubjectOverrides: overridesPayload,
        defaultRoomByClassId: roomsDraft,
        homeroomSourceByClassId: hmSrcDraft,
        classTeacherByClassId: ctDraft,
        classTeacherSourceByClassId: ctSrcDraft,
        classTeacherLockedByClassId: ctLockDraft,
        assignmentMeta: metaDraft,
        homeroomLockedByClassId: hlDraft,
      } = academicDraftRef.current;
      const overridesSanitized = overridesPayload.map((o) => ({ ...o, roomId: null as number | null }));
      const defaultRooms = cgs.map((r) => {
        const raw = roomsDraft[r.classGroupId];
        const rid = raw && String(raw).trim() !== '' ? Number(raw) : NaN;
        const srcRaw = hmSrcDraft[r.classGroupId];
        const homeroomSource =
          Number.isFinite(rid) && (srcRaw === 'auto' || srcRaw === 'manual') ? srcRaw : null;
        return {
          classGroupId: r.classGroupId,
          roomId: Number.isFinite(rid) ? rid : null,
          homeroomLocked: hlDraft[r.classGroupId] === true,
          homeroomSource,
        };
      });
      const classTeachers = cgs.map((r) => {
        const raw = ctDraft[r.classGroupId];
        const sid = raw && String(raw).trim() !== '' ? Number(raw) : NaN;
        const srcRaw = ctSrcDraft[r.classGroupId];
        const classTeacherSource =
          Number.isFinite(sid) && (srcRaw === 'auto' || srcRaw === 'manual') ? srcRaw : null;
        return {
          classGroupId: r.classGroupId,
          staffId: Number.isFinite(sid) ? sid : null,
          classTeacherLocked: Number.isFinite(sid) ? ctLockDraft[r.classGroupId] === true : false,
          classTeacherSource,
        };
      });
      const assignmentSlotMetaList = Object.entries(metaDraft).map(([k, v]) => {
        const [a, b] = k.split(':');
        return {
          classGroupId: Number(a),
          subjectId: Number(b),
          source: v.source,
          locked: v.locked,
          roomSource: null as string | null,
          roomLocked: null as boolean | null,
        };
      });
      await api.put('/api/v1/onboarding/academic-structure', {
        classSubjectConfigs: configsPayload,
        sectionSubjectOverrides: overridesSanitized,
        defaultRooms,
        classTeachers,
        assignmentSlotMeta: assignmentSlotMetaList,
      });
    },
    onMutate: () => setSaveSuccess(false),
    onSuccess: async () => {
      setSaveSuccess(true);
      // Allocations / room defaults / weekly periods all directly affect the timetable.
      recordChange({
        id: `academic:save:${Date.now()}`,
        scope: 'allocations',
        severity: 'hard',
        message: 'Saved academic structure changes',
      });
      await invalidate(['allocations', 'classes']);
      // Ensure GET payload matches PUT before re-hydrating; otherwise stale cache wipes Class N templates.
      await qc.refetchQueries({ queryKey: ['onboarding-academic-structure'] });
      setHydrated(false);
    },
    onError: () => setSaveSuccess(false),
  });

  // ---- exposed ----
  return {
    classGroups: serverSnapshot?.classGroups ?? [],
    subjects: serverSnapshot?.subjects ?? EMPTY_SUBJECTS,
    staff: (serverSnapshot?.staff ?? []).map((s) => ({ ...s, roleNames: s.roleNames ?? [] })),
    rooms,
    basicInfo: basicInfoQuery.data ?? serverSnapshot?.basicInfo ?? null,
    isLoading: academicStructureQuery.isLoading || roomsQuery.isLoading,
    isError: academicStructureQuery.isError,
    error: academicStructureQuery.error,
    roomsError: roomsQuery.isError ? roomsQuery.error : null,

    allocRows,
    setAllocRows,
    classSubjectConfigs,
    setClassSubjectConfigs,
    sectionSubjectOverrides,
    setSectionSubjectOverrides,
    defaultRoomByClassId,
    setDefaultRoomByClassId,
    assignmentMeta,
    setAssignmentMeta,
    homeroomSourceByClassId,
    classTeacherByClassId,
    classTeacherSourceByClassId,
    patchSectionClassTeacher,
    autoAssignClassTeachers,

    classDefaultRoomSelectOptions,
    classDefaultRoomUsage,
    classDefaultRoomHasConflicts,
    autoAssignDefaultRooms,
    clearHomeroomDraft,
    clearAutoAssignedClassTeachers,
    clearAllClassTeacherAssignments,
    clearAutoHomeroomAssignments,
    patchSectionHomeroom,
    homeroomLockedByClassId,
    patchHomeroomLock,
    classTeacherLockedByClassId,
    patchClassTeacherLock,
    defaultRoomsLoading: roomsQuery.isLoading,

    dirty,
    pendingChanges,
    resetToServer,
    save: () => saveMutation.mutateAsync(),
    savePending: saveMutation.isPending,
    saveError: saveMutation.isError ? saveMutation.error : null,
    saveSuccess,
  };
}
