import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { extractTeacherDemandWarnings } from '../lib/teacherDemandAnalysis';
import { ClassGroupSearchCombobox, useClassGroupsCatalog } from './ClassGroupSearchCombobox';
import { OptionSearchCombobox } from './OptionSearchCombobox';

function Icon({
  name,
  className = 'h-4 w-4',
}: {
  name:
    | 'sparkle'
    | 'grid'
    | 'warning'
    | 'check'
    | 'bolt'
    | 'clock'
    | 'lock'
    | 'unlock'
    | 'publish'
    | 'wand'
    | 'save';
  className?: string;
}) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'sparkle':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 2l1.5 6L20 10l-6.5 2L12 22l-1.5-10L4 10l6.5-2L12 2z" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M10.3 4.3L2.6 18.1c-.5.9.1 1.9 1.1 1.9h16.6c1 0 1.6-1 1.1-1.9L13.7 4.3c-.5-.9-1.9-.9-2.4 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 8v5l3 2" />
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M17 11V7a5 5 0 0 0-10 0v4" />
          <path d="M12 17v2" />
          <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
        </svg>
      );
    case 'unlock':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M7 11V7a5 5 0 0 1 10 0" />
          <path d="M12 17v2" />
          <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
        </svg>
      );
    case 'publish':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 3v12" />
          <path d="M8 7l4-4 4 4" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5" />
        </svg>
      );
    case 'save':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M17 21v-8H7v8" />
          <path d="M7 3v5h8" />
        </svg>
      );
    case 'wand':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M15 4l5 5" />
          <path d="M13 6l-9 9" />
          <path d="M7 18l-3 3" />
          <path d="M16 2l.5 2" />
          <path d="M20 6l2 .5" />
          <path d="M14 8l.5 2" />
        </svg>
      );
    default:
      return null;
  }
}

type TimeSlot = { id: number; startTime: string; endTime: string; slotOrder: number; isBreak: boolean };
type Version = { id: number; status: string; version: number };
type Entry = {
  id: number;
  classGroupId: number;
  dayOfWeek: string;
  timeSlotId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  staffId: number;
  staffName: string;
  roomId: number | null;
  roomLabel: string | null;
};

type Conflict = {
  severity: 'HARD' | 'SOFT';
  kind: string;
  classGroupId: number | null;
  classGroupCode: string | null;
  dayOfWeek: string | null;
  timeSlotId: number | null;
  title: string;
  detail: string;
};

type GenerateResponse = {
  success: boolean;
  version: { id: number; status: string; version: number };
  timetable: Entry[];
  hardConflicts: Conflict[];
  softConflicts: Conflict[];
  generatedAt: string;
  stats?: Record<string, unknown>;
};

type SetupDTO = {
  schoolId: number;
  workingDays: string[];
  slots: { id: number; startTime: string; endTime: string; slotOrder: number; isBreak: boolean }[];
  classGroups: { id: number; code: string; displayName: string; defaultRoomId: number | null }[];
  subjects: { id: number; code: string; name: string; weeklyFrequency?: number | null }[];
  teachers: { id: number; fullName: string; maxWeeklyLectureLoad: number | null; teachableSubjectIds: number[] }[];
  rooms: { id: number; building: string; roomNumber: string; type: string; isSchedulable: boolean }[];
  allocations: { id: number; classGroupId: number; subjectId: number; staffId: number | null; roomId: number | null; weeklyFrequency: number | null }[];
  capacities: { schoolSlotsPerWeek: number };
};

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'MON',
  TUESDAY: 'TUE',
  WEDNESDAY: 'WED',
  THURSDAY: 'THU',
  FRIDAY: 'FRI',
  SATURDAY: 'SAT',
  SUNDAY: 'SUN',
};

function keyOf(day: string, timeSlotId: number) {
  return `${day}__${timeSlotId}`;
}

function parseKey(k: string): { day: string; timeSlotId: number } | null {
  const parts = String(k ?? '').split('__');
  if (parts.length !== 2) return null;
  const day = parts[0] ?? '';
  const timeSlotId = Number(parts[1]);
  if (!day || !Number.isFinite(timeSlotId)) return null;
  return { day, timeSlotId };
}

function lockKey(classGroupId: number, dayOfWeek: string, timeSlotId: number) {
  return `${classGroupId}__${dayOfWeek}__${timeSlotId}`;
}

function Chip({ tone, children }: { tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: React.ReactNode }) {
  const map: Record<typeof tone, string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    good: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    bad: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
  };
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold tracking-wide ${map[tone]}`}>{children}</span>;
}

function KpiCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-4 py-4">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs font-bold text-slate-500">{sub}</div> : null}
    </div>
  );
}

function ReadinessRow({
  ok,
  title,
  detail,
  badge,
}: {
  ok: boolean;
  title: string;
  detail: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${ok ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-900">{title}</div>
          <div className="mt-1 text-xs font-bold text-slate-600">{detail}</div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <Chip tone={ok ? 'good' : 'warn'}>{ok ? 'OK' : 'Needs attention'}</Chip>
        </div>
      </div>
    </div>
  );
}

type TabKey = 'SECTION' | 'TEACHER' | 'ROOM';

export default function Step7TimetableWorkspace({
  onAutoGenerateDraft,
  onOpenEditor,
  onCompleteStep,
  autoGeneratePending = false,
  autoGenerateErrorText,
  completePending = false,
}: {
  onAutoGenerateDraft: () => Promise<unknown>;
  onOpenEditor: () => void;
  onCompleteStep: () => void;
  autoGeneratePending?: boolean;
  autoGenerateErrorText?: string | null;
  completePending?: boolean;
  timetableAutoGenCount?: number | null;
  workingDays?: string[] | null;
}) {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ schoolId?: number | null }>('/user/me')).data,
  });
  const schoolId = Number(me.data?.schoolId);

  const setup = useQuery({
    queryKey: ['tt-setup', schoolId],
    enabled: Number.isFinite(schoolId) && schoolId > 0,
    queryFn: async () => (await api.get<SetupDTO>(`/api/timetable/setup`)).data,
  });

  const draft = useQuery({
    queryKey: ['ttv2-draft-version'],
    queryFn: async () => (await api.post<Version>('/api/v2/timetable/versions/draft')).data,
    enabled: me.isSuccess,
  });

  const versionId = draft.data?.id ?? null;

  const allEntries = useQuery({
    queryKey: ['tt-entries', versionId],
    enabled: Boolean(versionId),
    queryFn: async () =>
      (await api.get<Entry[]>(`/api/timetable/entries?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data,
  });

  const locks = useQuery({
    queryKey: ['tt-locks', versionId],
    enabled: Boolean(versionId),
    queryFn: async () =>
      (await api.get<{ classGroupId: number; dayOfWeek: string; timeSlotId: number }[]>(`/api/timetable/locks?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data,
  });

  const lockedSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of locks.data ?? []) s.add(lockKey(l.classGroupId, l.dayOfWeek, l.timeSlotId));
    return s;
  }, [locks.data]);

  const classGroups = useClassGroupsCatalog();
  const [selectedClassGroupId, setSelectedClassGroupId] = useState('');
  const [tab, setTab] = useState<TabKey>('SECTION');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [editSubjectId, setEditSubjectId] = useState<string>('');
  const [editStaffId, setEditStaffId] = useState<string>('');
  const [editRoomId, setEditRoomId] = useState<string>('');

  const [lastGenerate, setLastGenerate] = useState<GenerateResponse | null>(null);

  useEffect(() => {
    if (selectedClassGroupId) return;
    const first = classGroups.data?.content?.[0];
    if (first) setSelectedClassGroupId(String(first.id));
  }, [classGroups.data, selectedClassGroupId]);

  useEffect(() => {
    if (selectedTeacherId) return;
    const t = setup.data?.teachers?.[0];
    if (t) setSelectedTeacherId(String(t.id));
  }, [setup.data, selectedTeacherId]);

  useEffect(() => {
    if (selectedRoomId) return;
    const r = (setup.data?.rooms ?? []).find((x) => x.isSchedulable);
    if (r) setSelectedRoomId(String(r.id));
  }, [setup.data, selectedRoomId]);

  const days = useMemo(() => {
    const wd = setup.data?.workingDays ?? [];
    const normalized = wd.length ? wd : ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const mapped = normalized.map((d) => d.trim().toUpperCase());
    const full = mapped.map((k) => {
      // our DB stores MON/TUE..., generator uses DayOfWeek enums; setup returns MON/TUE etc from onboarding JSON.
      // normalize to MONDAY... keys when possible
      const key =
        k === 'MON' ? 'MONDAY' : k === 'TUE' ? 'TUESDAY' : k === 'WED' ? 'WEDNESDAY' : k === 'THU' ? 'THURSDAY' : k === 'FRI' ? 'FRIDAY' : k === 'SAT' ? 'SATURDAY' : k === 'SUN' ? 'SUNDAY' : k;
      return { key, label: DAY_LABEL[key] ?? key.slice(0, 3) };
    });
    return full;
  }, [setup.data?.workingDays]);

  const slots = useMemo(() => {
    const list = setup.data?.slots ?? [];
    return [...list].sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0));
  }, [setup.data?.slots]);

  const generateSlots = useMutation({
    mutationFn: async () => (await api.post<TimeSlot[]>('/api/v2/timetable/time-slots/generate-from-onboarding')).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tt-setup', schoolId] });
      await qc.invalidateQueries({ queryKey: ['tt-entries', versionId] });
      toast.success('Slots created', 'Lecture time slots were generated from Basic Setup timings.');
    },
    onError: (e) => toast.error('Slot generation failed', formatApiError(e)),
  });

  const [autoSlotsAttempted, setAutoSlotsAttempted] = useState(false);
  useEffect(() => {
    if (autoSlotsAttempted) return;
    if (setup.isLoading || setup.isError) return;
    if ((setup.data?.slots ?? []).length > 0) return;
    // Auto-generate once when user reaches Step 7 and slots are missing.
    setAutoSlotsAttempted(true);
    generateSlots.mutate();
  }, [autoSlotsAttempted, setup.isLoading, setup.isError, setup.data, generateSlots]);

  const entriesSource = useMemo(() => (lastGenerate?.timetable?.length ? lastGenerate.timetable : allEntries.data ?? []), [lastGenerate, allEntries.data]);

  const entryByClass = useMemo(() => {
    const m = new Map<number, Entry[]>();
    for (const e of entriesSource) {
      const arr = m.get(e.classGroupId) ?? [];
      arr.push(e);
      m.set(e.classGroupId, arr);
    }
    return m;
  }, [entriesSource]);

  const entryByKeyForSelected = useMemo(() => {
    const m = new Map<string, Entry>();
    const cgId = Number(selectedClassGroupId);
    for (const e of entryByClass.get(cgId) ?? []) {
      m.set(keyOf(e.dayOfWeek, e.timeSlotId), e);
    }
    return m;
  }, [entryByClass, selectedClassGroupId]);

  const selectedClassGroupLabel = useMemo(() => {
    const list = classGroups.data?.content ?? [];
    const row = list.find((x) => String(x.id) === selectedClassGroupId);
    return row?.displayName ?? row?.code ?? '—';
  }, [classGroups.data, selectedClassGroupId]);

  const conflicts = useMemo(() => {
    return {
      hard: lastGenerate?.hardConflicts ?? [],
      soft: lastGenerate?.softConflicts ?? [],
    };
  }, [lastGenerate]);

  const lastGeneratedTime = useMemo(() => {
    const raw = lastGenerate?.generatedAt;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString();
  }, [lastGenerate?.generatedAt]);

  const kpis = useMemo(() => {
    const sec = new Set<number>();
    const t = new Set<number>();
    const r = new Set<number>();
    for (const e of entriesSource) {
      sec.add(e.classGroupId);
      t.add(e.staffId);
      if (e.roomId != null) r.add(e.roomId);
    }
    return {
      sectionsCovered: sec.size,
      teachersScheduled: t.size,
      roomsUsed: r.size,
      hardConflicts: conflicts.hard.length,
      softConflicts: conflicts.soft.length,
      conflictsTotal: conflicts.hard.length + conflicts.soft.length,
    };
  }, [entriesSource, conflicts.hard.length, conflicts.soft.length]);

  const readiness = useMemo(() => {
    const s = setup.data;
    if (!s) {
      return {
        timeSlotsConfigured: false,
        academicStructureCompleted: false,
        teachersAssigned: false,
        roomsAssigned: false,
        missingTeacherCount: 0,
        overloadedTeacherCount: 0,
        frequencyMismatchCount: 0,
        schoolSlotsPerWeek: null as number | null,
      };
    }

    const slotsConfigured = (s.slots ?? []).some((x) => !x.isBreak);
    const academicOk = (s.classGroups ?? []).length > 0 && (s.allocations ?? []).length > 0;
    const missingTeacher = (s.allocations ?? []).filter((a) => !a.staffId).length;
    const teachersAssigned = missingTeacher === 0 && (s.allocations ?? []).length > 0;

    const roomsAssigned = (s.allocations ?? []).some((a) => a.roomId != null) || (s.classGroups ?? []).some((cg) => cg.defaultRoomId != null);

    const capFallback = Number(s.capacities?.schoolSlotsPerWeek ?? 0);
    const allocByTeacher = new Map<number, number>();
    for (const a of s.allocations ?? []) {
      if (!a.staffId) continue;
      allocByTeacher.set(a.staffId, (allocByTeacher.get(a.staffId) ?? 0) + (a.weeklyFrequency ?? 0));
    }
    let overloaded = 0;
    for (const t of s.teachers ?? []) {
      const load = allocByTeacher.get(t.id) ?? 0;
      const max = t.maxWeeklyLectureLoad != null ? Number(t.maxWeeklyLectureLoad) : capFallback;
      if (max > 0 && load > max) overloaded += 1;
    }

    // Frequency mismatch:
    // - default: subject.weeklyFrequency
    // - override: allocation.weeklyFrequency (class/section level)
    // Only meaningful after there is at least one scheduled entry.
    if ((entriesSource ?? []).length === 0) {
      return {
        timeSlotsConfigured: slotsConfigured,
        academicStructureCompleted: academicOk,
        teachersAssigned,
        roomsAssigned,
        missingTeacherCount: missingTeacher,
        overloadedTeacherCount: overloaded,
        frequencyMismatchCount: 0,
        schoolSlotsPerWeek: Number.isFinite(capFallback) ? capFallback : null,
      };
    }

    const countByClassSub = new Map<string, number>();
    for (const e of entriesSource) {
      countByClassSub.set(`${e.classGroupId}:${e.subjectId}`, (countByClassSub.get(`${e.classGroupId}:${e.subjectId}`) ?? 0) + 1);
    }
    const subjectWeeklyById = new Map<number, number>();
    for (const sub of s.subjects ?? []) {
      const v = sub.weeklyFrequency;
      if (v == null) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) subjectWeeklyById.set(sub.id, n);
    }
    let freqMismatch = 0;
    for (const a of s.allocations ?? []) {
      const want = Number(a.weeklyFrequency ?? subjectWeeklyById.get(a.subjectId) ?? 0);
      if (!want) continue;
      const have = countByClassSub.get(`${a.classGroupId}:${a.subjectId}`) ?? 0;
      if (have !== want) freqMismatch += 1;
    }

    return {
      timeSlotsConfigured: slotsConfigured,
      academicStructureCompleted: academicOk,
      teachersAssigned,
      roomsAssigned,
      missingTeacherCount: missingTeacher,
      overloadedTeacherCount: overloaded,
      frequencyMismatchCount: freqMismatch,
      schoolSlotsPerWeek: Number.isFinite(capFallback) ? capFallback : null,
    };
  }, [setup.data, entriesSource]);

  const drawerMeta = useMemo(() => (drawerKey ? parseKey(drawerKey) : null), [drawerKey]);
  const cgIdNum = Number(selectedClassGroupId);
  const drawerEntry = useMemo(() => (drawerKey ? entryByKeyForSelected.get(drawerKey) ?? null : null), [drawerKey, entryByKeyForSelected]);
  const isLocked = useMemo(() => {
    if (!drawerMeta || !Number.isFinite(cgIdNum)) return false;
    return lockedSet.has(lockKey(cgIdNum, drawerMeta.day, drawerMeta.timeSlotId));
  }, [drawerMeta, cgIdNum, lockedSet]);

  useEffect(() => {
    if (!drawerKey) return;
    setDrawerError(null);
    setEditSubjectId(drawerEntry?.subjectId != null ? String(drawerEntry.subjectId) : '');
    setEditStaffId(drawerEntry?.staffId != null ? String(drawerEntry.staffId) : '');
    setEditRoomId(drawerEntry?.roomId != null ? String(drawerEntry.roomId) : '');
  }, [drawerKey, drawerEntry]);

  const subjectsForClass = useQuery({
    queryKey: ['subjects-for-class', selectedClassGroupId],
    enabled: Boolean(selectedClassGroupId),
    queryFn: async () => (await api.get<{ id: number; code: string; name: string }[]>(`/api/subjects/for-class-group?classGroupId=${encodeURIComponent(selectedClassGroupId)}`)).data,
  });

  const doGenerate = async () => {
    try {
      const res = (await onAutoGenerateDraft()) as GenerateResponse;
      setLastGenerate(res);
      await qc.invalidateQueries({ queryKey: ['tt-entries'] });
      await qc.invalidateQueries({ queryKey: ['tt-locks'] });
      const warn = extractTeacherDemandWarnings(res);
      if (warn.length) {
        toast.info(
          'Teacher capacity warning',
          `${warn.slice(0, 2).join(' · ')}${warn.length > 2 ? ` (+${warn.length - 2} more)` : ''}`,
        );
      }
      toast.success('Generated', 'Draft timetable generated.');
    } catch (e) {
      toast.error('Generate failed', formatApiError(e));
    }
  };

  const autoFix = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(schoolId) || schoolId <= 0) throw new Error('Missing school id');
      return (await api.post<GenerateResponse>('/api/timetable/auto-fix', { schoolId, academicYearId: null, replaceExisting: true })).data;
    },
    onSuccess: async (d) => {
      setLastGenerate(d);
      await qc.invalidateQueries({ queryKey: ['tt-entries'] });
      toast.success('Auto-fix complete', 'Conflicts were re-evaluated.');
    },
    onError: (e) => toast.error('Auto-fix failed', formatApiError(e)),
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error('Missing draft version');
      return (await api.post(`/api/timetable/save-draft?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data as { id: number; status: string; version: number };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ttv2-draft-version'] });
      toast.success('Saved', 'Draft moved to review.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error('Missing draft version');
      return (await api.post(`/api/timetable/publish?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data as { id: number; status: string; version: number };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ttv2-draft-version'] });
      toast.success('Published', 'Timetable is now active.');
    },
    onError: (e) => toast.error('Publish failed', formatApiError(e)),
  });

  const hasBlockingIssues = useMemo(() => {
    // Publishing must be blocked when we *know* the draft is not valid.
    // Even if the last generate response didn't include conflicts, a frequency mismatch is a hard blocker.
    return kpis.hardConflicts > 0 || readiness.frequencyMismatchCount > 0 || !readiness.timeSlotsConfigured || !readiness.academicStructureCompleted;
  }, [kpis.hardConflicts, readiness.frequencyMismatchCount, readiness.timeSlotsConfigured, readiness.academicStructureCompleted]);

  const upsertCell = useMutation({
    mutationFn: async (body: { dayOfWeek: string; timeSlotId: number; subjectId: number; staffId: number; roomId: number | null }) => {
      if (!versionId) throw new Error('Missing draft version');
      if (!Number.isFinite(cgIdNum) || cgIdNum <= 0) throw new Error('Select a class');
      setDrawerError(null);
      return (
        await api.put<Entry>('/api/timetable/cell', {
          timetableVersionId: Number(versionId),
          classGroupId: cgIdNum,
          dayOfWeek: body.dayOfWeek,
          timeSlotId: body.timeSlotId,
          subjectId: body.subjectId,
          staffId: body.staffId,
          roomId: body.roomId,
          locked: null,
        })
      ).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tt-entries', versionId] });
      toast.success('Saved', 'Cell updated.');
    },
    onError: (e) => {
      const msg = formatApiError(e);
      setDrawerError(msg);
      toast.error('Save failed', msg);
    },
  });

  const clearCell = useMutation({
    mutationFn: async (body: { dayOfWeek: string; timeSlotId: number }) => {
      if (!versionId) throw new Error('Missing draft version');
      if (!Number.isFinite(cgIdNum) || cgIdNum <= 0) throw new Error('Select a class');
      setDrawerError(null);
      await api.put('/api/timetable/cell', {
        timetableVersionId: Number(versionId),
        classGroupId: cgIdNum,
        dayOfWeek: body.dayOfWeek,
        timeSlotId: body.timeSlotId,
        subjectId: null,
        staffId: null,
        roomId: null,
        locked: null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tt-entries', versionId] });
      setDrawerKey(null);
      toast.success('Cleared', 'Cell cleared.');
    },
    onError: (e) => {
      const msg = formatApiError(e);
      setDrawerError(msg);
      toast.error('Clear failed', msg);
    },
  });

  const toggleLock = useMutation({
    mutationFn: async (body: { dayOfWeek: string; timeSlotId: number; locked: boolean }) => {
      if (!versionId) throw new Error('Missing draft version');
      if (!Number.isFinite(cgIdNum) || cgIdNum <= 0) throw new Error('Select a class');
      setDrawerError(null);
      await api.put('/api/timetable/cell', {
        timetableVersionId: Number(versionId),
        classGroupId: cgIdNum,
        dayOfWeek: body.dayOfWeek,
        timeSlotId: body.timeSlotId,
        subjectId: drawerEntry?.subjectId ?? null,
        staffId: drawerEntry?.staffId ?? null,
        roomId: drawerEntry?.roomId ?? null,
        locked: body.locked,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tt-locks', versionId] });
    },
    onError: (e) => {
      const msg = formatApiError(e);
      setDrawerError(msg);
      toast.error('Lock failed', msg);
    },
  });

  const loading = me.isLoading || setup.isLoading || draft.isLoading || allEntries.isLoading || locks.isLoading;
  const loadError =
    (me.error ? formatApiError(me.error) : null) ??
    (setup.error ? formatApiError(setup.error) : null) ??
    (draft.error ? formatApiError(draft.error) : null) ??
    (allEntries.error ? formatApiError(allEntries.error) : null) ??
    (locks.error ? formatApiError(locks.error) : null) ??
    null;

  const teacherOptions = setup.data?.teachers ?? [];
  const roomOptions = (setup.data?.rooms ?? []).filter((r) => r.isSchedulable);

  const teacherOptionRows = useMemo(
    () => teacherOptions.map((t) => ({ value: String(t.id), label: t.fullName })),
    [teacherOptions],
  );
  const roomOptionRows = useMemo(
    () => roomOptions.map((r) => ({ value: String(r.id), label: `${r.building} ${r.roomNumber}`.trim(), meta: r.type })),
    [roomOptions],
  );

  const readinessRef = useRef<HTMLDivElement | null>(null);
  const [readinessHeight, setReadinessHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = readinessRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setReadinessHeight(Math.max(0, Math.round(rect.height)));
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setReadinessHeight(Math.max(0, Math.round(rect.height)));
    return () => ro.disconnect();
  }, [loading, loadError, tab, selectedClassGroupId, selectedTeacherId, selectedRoomId, teacherOptions.length, roomOptions.length]);

  const jumpToConflict = (c: Conflict) => {
    if (!c.dayOfWeek || !c.timeSlotId) return;
    if (tab !== 'SECTION') setTab('SECTION');
    if (c.classGroupId != null) setSelectedClassGroupId(String(c.classGroupId));
    // Open the drawer for that cell; when section changes, drawer still shows correct key.
    setDrawerKey(keyOf(c.dayOfWeek, c.timeSlotId));
  };

  const viewTitle = useMemo(() => {
    if (tab === 'SECTION') return selectedClassGroupLabel;
    if (tab === 'TEACHER') return teacherOptions.find((t) => String(t.id) === selectedTeacherId)?.fullName ?? '—';
    return roomOptions.find((r) => String(r.id) === selectedRoomId)?.building + ' ' + (roomOptions.find((r) => String(r.id) === selectedRoomId)?.roomNumber ?? '') ?? '—';
  }, [tab, selectedClassGroupLabel, teacherOptions, selectedTeacherId, roomOptions, selectedRoomId]);

  const gridEntriesForView = useMemo(() => {
    if (tab === 'SECTION') return entryByClass.get(Number(selectedClassGroupId)) ?? [];
    if (tab === 'TEACHER') return entriesSource.filter((e) => String(e.staffId) === selectedTeacherId);
    return entriesSource.filter((e) => e.roomId != null && String(e.roomId) === selectedRoomId);
  }, [tab, entryByClass, selectedClassGroupId, entriesSource, selectedTeacherId, selectedRoomId]);

  const gridEntryByKey = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of gridEntriesForView) {
      m.set(keyOf(e.dayOfWeek, e.timeSlotId), e);
    }
    return m;
  }, [gridEntriesForView]);

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-200">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm font-black text-slate-900">Step 7 — Timetable</div>
                <Chip tone={kpis.hardConflicts > 0 ? 'bad' : kpis.softConflicts > 0 ? 'warn' : 'good'}>
                  Conflicts <span className="font-black">{kpis.hardConflicts}</span> hard · <span className="font-black">{kpis.softConflicts}</span> soft
                </Chip>
                <Chip tone="info">School slots/week: <span className="font-black">{readiness.schoolSlotsPerWeek ?? '—'}</span></Chip>
              </div>
              <div className="mt-2 text-xs font-bold text-slate-600">
                Intelligent scheduling workspace powered by your academic structure (draft → conflicts → editor → publish).
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={doGenerate}
                disabled={autoGeneratePending || loading}
                className={[
                  'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                  autoGeneratePending || loading ? 'opacity-60 cursor-not-allowed bg-orange-500 text-white border-orange-500' : 'bg-orange-500 text-white hover:bg-orange-600 border-orange-500',
                ].join(' ')}
              >
                <Icon name="bolt" className="h-4 w-4" />
                {autoGeneratePending ? 'Generating…' : 'Generate Draft Timetable'}
              </button>

              <button
                type="button"
                onClick={() => autoFix.mutate()}
                disabled={autoFix.isPending || loading}
                className={[
                  'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                  autoFix.isPending || loading ? 'opacity-60 cursor-not-allowed bg-white text-slate-900 border-slate-200' : 'bg-white text-slate-900 hover:bg-slate-50 border-slate-200',
                ].join(' ')}
              >
                <Icon name="wand" className="h-4 w-4" />
                Auto Fix
              </button>

              <button
                type="button"
                onClick={onOpenEditor}
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition bg-white text-slate-900 hover:bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <Icon name="grid" className="h-4 w-4" />
                Open Editor
              </button>
            </div>
          </div>

          {autoGenerateErrorText ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">
              {autoGenerateErrorText}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Sections Covered" value={kpis.sectionsCovered} sub="Scheduled this draft" />
            <KpiCard label="Teachers Scheduled" value={kpis.teachersScheduled} sub="Active in timetable" />
            <KpiCard label="Rooms Used" value={kpis.roomsUsed} sub="Schedulable rooms booked" />
            <KpiCard label="Conflicts" value={kpis.conflictsTotal} sub={`${kpis.hardConflicts} hard · ${kpis.softConflicts} soft`} />
            <KpiCard label="Last Generated Time" value={lastGeneratedTime ?? '—'} sub={lastGeneratedTime ? 'Latest engine run' : 'No draft yet'} />
          </div>
        </div>

        <div className="p-5 md:p-6">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto w-fit rounded-3xl bg-slate-900 text-white p-3">
                <Icon name="clock" className="h-6 w-6" />
              </div>
              <div className="mt-4 text-xl font-black">Loading timetable workspace…</div>
              <div className="mt-2 text-sm font-bold text-slate-600">Fetching slots, classes, allocations, and draft entries.</div>
            </div>
          ) : null}

          {loadError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-rose-600 text-white p-2">
                  <Icon name="warning" className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-rose-900">Couldn’t load timetable data</div>
                  <div className="mt-1 text-xs font-bold text-rose-800">{loadError}</div>
                </div>
              </div>
            </div>
          ) : null}

          {!loading && !loadError ? (
            <div className="min-w-0 space-y-4">
              {/* Row 1: Readiness + Conflict Center (same height) */}
              <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-stretch">
                <div ref={readinessRef} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-black">Readiness Validation</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">Before generation: checklist & safety gates.</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip tone={readiness.overloadedTeacherCount > 0 || readiness.frequencyMismatchCount > 0 ? 'warn' : 'good'}>
                        {readiness.overloadedTeacherCount > 0 || readiness.frequencyMismatchCount > 0 ? 'Ready (conflicts expected)' : 'Ready'}
                      </Chip>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ReadinessRow ok={readiness.timeSlotsConfigured} title="Time slots configured" detail="Using working days + periods" />
                    <ReadinessRow ok={readiness.academicStructureCompleted} title="Academic structure completed" detail="Sections, subjects, allocations" />
                    <ReadinessRow
                      ok={readiness.teachersAssigned}
                      title="Teachers assigned"
                      detail={readiness.teachersAssigned ? 'All allocations have teachers' : `${readiness.missingTeacherCount} allocation(s) missing teacher`}
                      badge={readiness.missingTeacherCount ? <Chip tone="warn">{readiness.missingTeacherCount}</Chip> : undefined}
                    />
                    <ReadinessRow ok={readiness.roomsAssigned} title="Rooms assigned" detail="Room hints available (homeroom or allocation room)" />
                    <ReadinessRow
                      ok={readiness.overloadedTeacherCount === 0}
                      title="Overloaded teachers"
                      detail={readiness.overloadedTeacherCount === 0 ? 'No overload detected from weekly allocations' : 'Try balancing after generation'}
                      badge={readiness.overloadedTeacherCount ? <Chip tone="warn">{readiness.overloadedTeacherCount}</Chip> : undefined}
                    />
                    <ReadinessRow
                      ok={readiness.frequencyMismatchCount === 0}
                      title="Frequency mismatch"
                      detail={readiness.frequencyMismatchCount === 0 ? 'Timetable matches weekly frequencies' : 'Some class-subject totals differ from required'}
                      badge={readiness.frequencyMismatchCount ? <Chip tone="warn">{readiness.frequencyMismatchCount}</Chip> : undefined}
                    />
                  </div>
                </div>

                <div
                  className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col min-w-0"
                  style={readinessHeight ? { height: readinessHeight } : undefined}
                >
                  <div className="p-5 border-b border-slate-200">
                    <div className="text-sm font-black">Conflict Center</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">Hard conflicts block publish. Soft conflicts are advisory.</div>
                  </div>
                  <div className="p-5 space-y-3 min-h-0 flex-1 overflow-y-auto">
                    {!lastGenerate ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
                        Generate a draft to see conflicts.
                      </div>
                    ) : null}

                    {conflicts.hard.length ? (
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold uppercase tracking-wide text-rose-700">Hard ({conflicts.hard.length})</div>
                        {conflicts.hard.map((c, i) => (
                          <button
                            key={`${c.kind}-${i}`}
                            type="button"
                            onClick={() => jumpToConflict(c)}
                            className="w-full text-left rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 hover:bg-rose-100 transition"
                          >
                            <div className="text-sm font-black text-rose-900">{c.title}</div>
                            <div className="mt-1 text-xs font-bold text-rose-800">{c.detail}</div>
                            {c.classGroupCode || c.dayOfWeek || c.timeSlotId ? (
                              <div className="mt-2 text-[11px] font-extrabold text-rose-700">
                                {(c.classGroupCode ?? '—') + (c.dayOfWeek ? ` · ${c.dayOfWeek}` : '') + (c.timeSlotId ? ` · slot ${c.timeSlotId}` : '')}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {conflicts.soft.length ? (
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold uppercase tracking-wide text-amber-700">Soft ({conflicts.soft.length})</div>
                        {conflicts.soft.map((c, i) => (
                          <button
                            key={`${c.kind}-${i}`}
                            type="button"
                            onClick={() => jumpToConflict(c)}
                            className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition"
                          >
                            <div className="text-sm font-black text-amber-900">{c.title}</div>
                            <div className="mt-1 text-xs font-bold text-amber-800">{c.detail}</div>
                            {c.classGroupCode || c.dayOfWeek || c.timeSlotId ? (
                              <div className="mt-2 text-[11px] font-extrabold text-amber-700">
                                {(c.classGroupCode ?? '—') + (c.dayOfWeek ? ` · ${c.dayOfWeek}` : '') + (c.timeSlotId ? ` · slot ${c.timeSlotId}` : '')}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {lastGenerate && !conflicts.hard.length && !conflicts.soft.length ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
                        No conflicts detected in the latest generated draft.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Row 2: Timetable Editor (full width) */}
              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden w-full">
                  <div className="p-5 border-b border-slate-200">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm font-black">Timetable Editor</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">Switch tabs to refine by section, teacher, or room.</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Chip tone="neutral">
                          Locked cells: <span className="font-black ml-1">{lockedSet.size}</span>
                        </Chip>
                        <button
                          type="button"
                          onClick={onOpenEditor}
                          className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition bg-white text-slate-900 hover:bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        >
                          <Icon name="grid" className="h-4 w-4" />
                          Open Editor
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setTab('SECTION')}
                        className={`rounded-2xl border px-3 py-2 text-sm font-extrabold ${tab === 'SECTION' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                        Section View
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('TEACHER')}
                        className={`rounded-2xl border px-3 py-2 text-sm font-extrabold ${tab === 'TEACHER' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                        Teacher View
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('ROOM')}
                        className={`rounded-2xl border px-3 py-2 text-sm font-extrabold ${tab === 'ROOM' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                        Room View
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Showing timetable for</div>
                        <div className="mt-1 text-lg font-black truncate">{viewTitle}</div>
                      </div>

                      {tab === 'SECTION' ? (
                        <div className="w-full sm:w-[360px]">
                          <ClassGroupSearchCombobox value={selectedClassGroupId} onChange={setSelectedClassGroupId} placeholder="Search sections…" />
                        </div>
                      ) : null}

                      {tab === 'TEACHER' ? (
                        <div className="w-full sm:w-[360px]">
                          <OptionSearchCombobox
                            value={selectedTeacherId}
                            onChange={setSelectedTeacherId}
                            options={teacherOptionRows}
                            placeholder="Search teachers…"
                            emptyLabel="Select teacher…"
                          />
                        </div>
                      ) : null}

                      {tab === 'ROOM' ? (
                        <div className="w-full sm:w-[360px]">
                          <OptionSearchCombobox
                            value={selectedRoomId}
                            onChange={setSelectedRoomId}
                            options={roomOptionRows}
                            placeholder="Search rooms…"
                            emptyLabel="Select room…"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-5 min-w-0">
                    {slots.length ? (
                      <div className="max-w-full overflow-x-auto">
                        <div className="min-w-[820px] space-y-3">
                          <div
                            className="gap-3 text-[12px] font-extrabold uppercase tracking-wide text-slate-500"
                            style={{ display: 'grid', gridTemplateColumns: `160px repeat(${days.length}, minmax(0, 1fr))` }}
                          >
                            <div className="px-2">Period</div>
                            {days.map((d) => (
                              <div key={d.key} className="text-center px-2">
                                {d.label}
                              </div>
                            ))}
                          </div>

                          {slots.map((ts) => (
                            <div
                              key={ts.id}
                              className="gap-3 items-start"
                              style={{ display: 'grid', gridTemplateColumns: `160px repeat(${days.length}, minmax(0, 1fr))` }}
                            >
                              <div className="px-2 pt-2 text-[11px] font-extrabold text-slate-600">
                                <div className="font-black text-slate-900">{`P${ts.slotOrder}`}</div>
                                <div className="text-[10px] font-bold text-slate-500 truncate">{`${ts.startTime}–${ts.endTime}`}</div>
                                {ts.isBreak ? <div className="mt-1 text-[10px] font-black text-amber-700">Break</div> : null}
                              </div>
                              {days.map((d) => {
                                const k = keyOf(d.key, ts.id);
                                const e = gridEntryByKey.get(k) ?? null;
                                const isEmpty = !e;
                                const locked = tab === 'SECTION' && Number.isFinite(cgIdNum) ? lockedSet.has(lockKey(cgIdNum, d.key, ts.id)) : false;
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    onClick={() => {
                                      if (tab !== 'SECTION') return;
                                      setDrawerKey(k);
                                    }}
                                    className={[
                                      'rounded-2xl border p-3 text-left transition hover:shadow-md',
                                      locked ? 'border-slate-900/30 bg-slate-50' : '',
                                      isEmpty ? 'bg-white/70 text-slate-400 border-slate-200' : 'bg-white text-slate-900 border-slate-200',
                                      tab !== 'SECTION' ? 'cursor-default' : '',
                                    ].join(' ')}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-[12px] font-extrabold truncate">{isEmpty ? 'Free' : e.subjectCode}</div>
                                      {locked ? <Icon name="lock" className="h-3.5 w-3.5 text-slate-700" /> : null}
                                    </div>
                                    <div className="mt-1 text-[11px] font-bold text-slate-500 truncate">{isEmpty ? '—' : e.staffName}</div>
                                    <div className="mt-1 text-[11px] font-bold text-slate-500 truncate">{isEmpty ? '—' : e.roomLabel ?? 'No room'}</div>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                        <div className="text-sm font-black text-amber-900">No time slots found</div>
                        <div className="mt-1 text-xs font-bold text-amber-800">
                          We can generate lecture slots automatically from Basic Setup (school timings + lecture duration).
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => generateSlots.mutate()}
                            disabled={generateSlots.isPending}
                            className={[
                              'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                              generateSlots.isPending ? 'opacity-60 cursor-not-allowed bg-orange-500 text-white border-orange-500' : 'bg-orange-500 text-white hover:bg-orange-600 border-orange-500',
                            ].join(' ')}
                          >
                            <Icon name="bolt" className="h-4 w-4" />
                            {generateSlots.isPending ? 'Generating…' : 'Generate Time Slots'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              {/* Row 3: Publish Flow (full width) */}
              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden w-full">
                  <div className="p-5 border-b border-slate-200">
                    <div className="text-sm font-black">Publish Flow</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">Draft → Review → Publish. Publish is blocked by hard conflicts.</div>
                  </div>
                  <div className="p-5 flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Current version</div>
                      <div className="text-sm font-black text-slate-900">
                        v{draft.data?.version ?? '—'} · <span className="uppercase">{draft.data?.status ?? '—'}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        {hasBlockingIssues
                          ? kpis.hardConflicts > 0
                            ? `${kpis.hardConflicts} hard conflict(s) must be resolved before publish.`
                            : readiness.frequencyMismatchCount > 0
                              ? `Frequency mismatch in ${readiness.frequencyMismatchCount} allocation(s) must be fixed before publish.`
                              : !readiness.timeSlotsConfigured
                                ? 'Time slots are not configured.'
                                : 'Academic structure is incomplete.'
                          : 'Ready to publish when you’re satisfied.'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => saveDraft.mutate()}
                        disabled={saveDraft.isPending || loading}
                        className={[
                          'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                          saveDraft.isPending || loading ? 'opacity-60 cursor-not-allowed bg-white text-slate-900 border-slate-200' : 'bg-white text-slate-900 hover:bg-slate-50 border-slate-200',
                        ].join(' ')}
                      >
                        <Icon name="save" className="h-4 w-4" />
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => publish.mutate()}
                        disabled={publish.isPending || loading || hasBlockingIssues}
                        className={[
                          'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                          publish.isPending || loading || hasBlockingIssues
                            ? 'opacity-60 cursor-not-allowed bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-900 text-white hover:bg-slate-950 border-slate-900',
                        ].join(' ')}
                      >
                        <Icon name="publish" className="h-4 w-4" />
                        Publish Final
                      </button>
                      <button
                        type="button"
                        onClick={onCompleteStep}
                        disabled={completePending}
                        className={[
                          'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                          completePending ? 'opacity-60 cursor-not-allowed bg-orange-500 text-white border-orange-500' : 'bg-orange-500 text-white hover:bg-orange-600 border-orange-500',
                        ].join(' ')}
                      >
                        <Icon name="check" className="h-4 w-4" />
                        {completePending ? 'Completing…' : 'Mark Step Complete'}
                      </button>
                    </div>
                  </div>
                </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Drawer for cell editing (Section view) */}
      {drawerKey ? (
        <div className="fixed inset-0 z-[50000]">
          <div className="absolute inset-0 bg-black/25" onClick={() => setDrawerKey(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-[440px] bg-white shadow-2xl border-l border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black">Edit cell</div>
                <div className="mt-1 text-xs font-bold text-slate-500">{selectedClassGroupLabel}</div>
              </div>
              <button type="button" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold hover:bg-slate-50" onClick={() => setDrawerKey(null)}>
                Close
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Day / Slot</div>
                <div className="mt-1 text-sm font-black">{drawerMeta?.day ?? '—'}</div>
                <div className="mt-1 text-sm font-bold text-slate-600">Time slot id: {drawerMeta?.timeSlotId ?? '—'}</div>
              </div>

              {drawerError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">{drawerError}</div> : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Subject</div>
                  <div className="mt-1">
                    <OptionSearchCombobox
                      value={editSubjectId}
                      onChange={setEditSubjectId}
                      options={(subjectsForClass.data ?? []).map((s) => ({ value: String(s.id), label: `${s.code} · ${s.name}` }))}
                      placeholder="Search subjects…"
                      emptyLabel="Select subject…"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Teacher</div>
                  <div className="mt-1">
                    <OptionSearchCombobox
                      value={editStaffId}
                      onChange={setEditStaffId}
                      options={teacherOptionRows}
                      placeholder="Search teachers…"
                      emptyLabel="Select teacher…"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Room (optional)</div>
                  <div className="mt-1">
                    <OptionSearchCombobox
                      value={editRoomId}
                      onChange={setEditRoomId}
                      options={roomOptionRows}
                      placeholder="Search rooms…"
                      emptyLabel="No room"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={upsertCell.isPending || isLocked || !drawerMeta || !editSubjectId || !editStaffId}
                  onClick={() => {
                    if (!drawerMeta) return;
                    upsertCell.mutate({
                      dayOfWeek: drawerMeta.day,
                      timeSlotId: drawerMeta.timeSlotId,
                      subjectId: Number(editSubjectId),
                      staffId: Number(editStaffId),
                      roomId: editRoomId ? Number(editRoomId) : null,
                    });
                  }}
                  className={[
                    'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                    upsertCell.isPending ? 'opacity-60 cursor-not-allowed bg-orange-500 text-white border-orange-500' : 'bg-orange-500 text-white hover:bg-orange-600 border-orange-500',
                    isLocked ? 'opacity-60 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <Icon name="save" className="h-4 w-4" />
                  {upsertCell.isPending ? 'Saving…' : 'Save'}
                </button>

                <button
                  type="button"
                  disabled={clearCell.isPending || isLocked || !drawerMeta || !drawerEntry}
                  onClick={() => {
                    if (!drawerMeta) return;
                    clearCell.mutate({ dayOfWeek: drawerMeta.day, timeSlotId: drawerMeta.timeSlotId });
                  }}
                  className={[
                    'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                    clearCell.isPending || !drawerEntry ? 'opacity-60 cursor-not-allowed bg-white text-slate-900 border-slate-200' : 'bg-white text-slate-900 hover:bg-slate-50 border-slate-200',
                    isLocked ? 'opacity-60 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  Clear
                </button>

                <button
                  type="button"
                  disabled={toggleLock.isPending || !drawerMeta}
                  onClick={() => {
                    if (!drawerMeta) return;
                    toggleLock.mutate({ dayOfWeek: drawerMeta.day, timeSlotId: drawerMeta.timeSlotId, locked: !isLocked });
                  }}
                  className={[
                    'ml-auto inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300',
                    isLocked ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-950' : 'bg-white text-slate-900 hover:bg-slate-50 border-slate-200',
                    toggleLock.isPending ? 'opacity-60 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <Icon name={isLocked ? 'unlock' : 'lock'} className="h-4 w-4" />
                  {isLocked ? 'Unlock' : 'Lock'}
                </button>
              </div>

              {isLocked ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                  This cell is <span className="font-black">locked</span>. Unlock it to edit or clear.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

