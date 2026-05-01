import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import {
  buildEffectiveAllocRows,
  type AcademicAllocRow,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from './academicStructureUtils';
import type { AssignmentSlotMeta } from './academicStructureSmartAssign';
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
  assignmentSlotMeta?: { classGroupId: number; subjectId: number; source: string; locked: boolean }[];
};

type SpringPage<T> = { content: T[]; totalElements?: number };

function pageContent<T>(data: SpringPage<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.content) ? data.content : [];
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

  // derived helpers
  classDefaultRoomSelectOptions: { value: string; label: string }[];
  classDefaultRoomUsage: Map<string, number>;
  classDefaultRoomHasConflicts: boolean;
  autoAssignDefaultRooms: () => void;
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
  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const [allocRows, setAllocRows] = useState<AcademicAllocRow[]>([]);
  const [classSubjectConfigs, setClassSubjectConfigs] = useState<ClassSubjectConfigRow[]>([]);
  const [sectionSubjectOverrides, setSectionSubjectOverrides] = useState<SectionSubjectOverrideRow[]>([]);
  const [defaultRoomByClassId, setDefaultRoomByClassId] = useState<Record<number, string>>({});
  const [assignmentMeta, setAssignmentMeta] = useState<Record<string, AssignmentSlotMeta>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  // ---- hydrate drafts from server (first time only) ----
  useEffect(() => {
    const d = academicStructureQuery.data;
    if (!d) return;
    if (hydrated) return;
    setClassSubjectConfigs(d.classSubjectConfigs ?? []);
    setSectionSubjectOverrides(d.sectionSubjectOverrides ?? []);

    if (d.assignmentSlotMeta?.length) {
      const rec: Record<string, AssignmentSlotMeta> = {};
      for (const x of d.assignmentSlotMeta) {
        if (!x) continue;
        const sk = `${x.classGroupId}:${x.subjectId}`;
        const src = x.source;
        if (src === 'auto' || src === 'manual' || src === 'rebalanced') {
          rec[sk] = { source: src, locked: !!x.locked };
        }
      }
      setAssignmentMeta(rec);
    }

    if ((d.classSubjectConfigs?.length ?? 0) > 0) {
      setAllocRows(buildEffectiveAllocRows(d.classGroups ?? [], d.classSubjectConfigs ?? [], d.sectionSubjectOverrides ?? []));
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

    const nextDefaults: Record<number, string> = {};
    for (const r of d.classGroups ?? []) {
      nextDefaults[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
    }
    setDefaultRoomByClassId(nextDefaults);
    setHydrated(true);
  }, [academicStructureQuery.data, hydrated]);

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
    return [{ value: '', label: 'No default room' }, ...opts];
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

  const autoAssignDefaultRooms = useCallback(() => {
    const classes = (academicStructureQuery.data?.classGroups ?? []).slice();
    const all = rooms.slice();
    if (classes.length === 0 || all.length === 0) return;

    const isClassroom = (r: RoomOption) => String(r.type ?? '').toUpperCase() === 'CLASSROOM';
    const numericPrefix = (s: string) => {
      const m = String(s ?? '').trim().match(/^(\d{1,4})/);
      return m ? Number(m[1]) : null;
    };
    const sortedRooms = all
      .filter((r) => isClassroom(r))
      .sort((a, b) => {
        const ba = String(a.buildingName ?? a.building ?? '').localeCompare(String(b.buildingName ?? b.building ?? ''));
        if (ba !== 0) return ba;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      });

    const next = { ...defaultRoomByClassId };
    const used = new Set(Object.values(next).filter(Boolean));

    for (const cg of classes) {
      if (next[cg.classGroupId]) continue;
      const grade = cg.gradeLevel;
      if (typeof grade !== 'number' || !Number.isFinite(grade)) continue;
      const picked = sortedRooms.find((r) => {
        const n = numericPrefix(r.roomNumber);
        if (n == null) return false;
        if (Math.floor(n / 100) !== grade) return false;
        return !used.has(String(r.id));
      });
      if (picked) {
        next[cg.classGroupId] = String(picked.id);
        used.add(String(picked.id));
      }
    }

    let rr = 0;
    for (const cg of classes) {
      if (next[cg.classGroupId]) continue;
      if (sortedRooms.length === 0) break;
      const unused = sortedRooms.find((r) => !used.has(String(r.id)));
      const picked = unused ?? sortedRooms[rr % sortedRooms.length];
      rr += 1;
      next[cg.classGroupId] = String(picked.id);
      used.add(String(picked.id));
    }

    setDefaultRoomByClassId(next);
    toast.success('Auto-assigned', 'Assigned default rooms. Review conflicts/exceptions and adjust if needed.');
  }, [academicStructureQuery.data?.classGroups, defaultRoomByClassId, rooms]);

  // ---- dirty tracking ----
  const serverSnapshot = academicStructureQuery.data;

  const draftSignature = useMemo(() => {
    return JSON.stringify({
      classSubjectConfigs,
      sectionSubjectOverrides,
      defaultRoomByClassId,
      assignmentMeta,
    });
  }, [classSubjectConfigs, sectionSubjectOverrides, defaultRoomByClassId, assignmentMeta]);

  const serverSignature = useMemo(() => {
    if (!serverSnapshot) return '';
    const defaults: Record<number, string> = {};
    for (const r of serverSnapshot.classGroups ?? []) {
      defaults[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
    }
    const meta: Record<string, AssignmentSlotMeta> = {};
    for (const x of serverSnapshot.assignmentSlotMeta ?? []) {
      const sk = `${x.classGroupId}:${x.subjectId}`;
      const src = x.source;
      if (src === 'auto' || src === 'manual' || src === 'rebalanced') {
        meta[sk] = { source: src, locked: !!x.locked };
      }
    }
    return JSON.stringify({
      classSubjectConfigs: serverSnapshot.classSubjectConfigs ?? [],
      sectionSubjectOverrides: serverSnapshot.sectionSubjectOverrides ?? [],
      defaultRoomByClassId: defaults,
      assignmentMeta: meta,
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
    for (const r of serverSnapshot.classGroups ?? []) {
      sd[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
    }
    if (JSON.stringify(defaultRoomByClassId) !== JSON.stringify(sd)) n += 1;
    const sm: Record<string, AssignmentSlotMeta> = {};
    for (const x of serverSnapshot.assignmentSlotMeta ?? []) {
      const sk = `${x.classGroupId}:${x.subjectId}`;
      const src = x.source;
      if (src === 'auto' || src === 'manual' || src === 'rebalanced') {
        sm[sk] = { source: src, locked: !!x.locked };
      }
    }
    if (JSON.stringify(assignmentMeta) !== JSON.stringify(sm)) n += 1;
    return n;
  }, [dirty, serverSnapshot, classSubjectConfigs, sectionSubjectOverrides, defaultRoomByClassId, assignmentMeta]);

  // ---- reset / save ----
  const resetToServer = useCallback(() => {
    const d = serverSnapshot;
    if (!d) return;
    setClassSubjectConfigs(d.classSubjectConfigs ?? []);
    setSectionSubjectOverrides(d.sectionSubjectOverrides ?? []);
    const defaults: Record<number, string> = {};
    for (const r of d.classGroups ?? []) {
      defaults[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
    }
    setDefaultRoomByClassId(defaults);
    const meta: Record<string, AssignmentSlotMeta> = {};
    for (const x of d.assignmentSlotMeta ?? []) {
      const sk = `${x.classGroupId}:${x.subjectId}`;
      const src = x.source;
      if (src === 'auto' || src === 'manual' || src === 'rebalanced') {
        meta[sk] = { source: src, locked: !!x.locked };
      }
    }
    setAssignmentMeta(meta);
    if ((d.classSubjectConfigs?.length ?? 0) > 0) {
      setAllocRows(
        buildEffectiveAllocRows(d.classGroups ?? [], d.classSubjectConfigs ?? [], d.sectionSubjectOverrides ?? []),
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
      const defaultRooms = cgs.map((r) => {
        const raw = defaultRoomByClassId[r.classGroupId];
        const rid = raw && String(raw).trim() !== '' ? Number(raw) : NaN;
        return { classGroupId: r.classGroupId, roomId: Number.isFinite(rid) ? rid : null };
      });
      const assignmentSlotMetaList = Object.entries(assignmentMeta).map(([k, v]) => {
        const [a, b] = k.split(':');
        return {
          classGroupId: Number(a),
          subjectId: Number(b),
          source: v.source,
          locked: v.locked,
        };
      });
      await api.put('/api/v1/onboarding/academic-structure', {
        classSubjectConfigs,
        sectionSubjectOverrides,
        defaultRooms,
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
      // Force the drafts to re-hydrate from the next server payload so the
      // dirty flag drops cleanly even if the server normalised our payload.
      setHydrated(false);
    },
    onError: () => setSaveSuccess(false),
  });

  // ---- exposed ----
  return {
    classGroups: serverSnapshot?.classGroups ?? [],
    subjects: serverSnapshot?.subjects ?? [],
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

    classDefaultRoomSelectOptions,
    classDefaultRoomUsage,
    classDefaultRoomHasConflicts,
    autoAssignDefaultRooms,
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
