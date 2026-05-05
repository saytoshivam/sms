/**
 * Pure conflict detectors for the Timetable module.
 *
 * The backend's /api/timetable/generate response carries hard/soft conflicts
 * for the *latest engine run*, but conflicts also exist before any engine run
 * (overload, missing teachers, missing slots, frequency mismatch). Both can be
 * computed on the client from /api/timetable/setup + /api/timetable/entries
 * shapes, with no extra server roundtrip.
 *
 * This file owns the deterministic, pure detectors. The UI layer (ConflictsPanel)
 * just renders the result and offers deep-link resolution actions.
 */

export type ConflictSeverity = 'HARD' | 'SOFT';

export type ConflictKind =
  // Pre-generation (structural readiness)
  | 'NO_TIME_SLOTS'
  | 'NO_WORKING_DAYS'
  | 'NO_CLASS_GROUPS'
  | 'NO_ALLOCATIONS'
  | 'NO_TEACHER_ASSIGNED'
  | 'NO_ELIGIBLE_TEACHER'
  | 'TEACHER_OVERLOAD'
  | 'NO_ROOM_ANY'
  | 'SUBJECT_MISSING_FREQUENCY'
  // Post-generation (computed from entries)
  | 'FREQUENCY_MISMATCH'
  | 'TEACHER_DOUBLE_BOOKED'
  | 'ROOM_DOUBLE_BOOKED';

export type ConflictResolution =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'action'; label: string; actionId: 'regenerate' | 'auto-fix' };

export type Conflict = {
  /** Stable id for dedupe / animations. */
  id: string;
  severity: ConflictSeverity;
  kind: ConflictKind;
  title: string;
  detail: string;
  /** Where the user should go to resolve this. */
  resolutions: ConflictResolution[];
  /** Entity refs for selection / counts. */
  refs?: {
    classGroupIds?: number[];
    subjectIds?: number[];
    teacherIds?: number[];
    roomIds?: number[];
    timeSlotIds?: number[];
    days?: string[];
  };
};

export type SetupTeacher = {
  id: number;
  fullName: string;
  maxWeeklyLectureLoad: number | null;
  teachableSubjectIds: number[];
};

export type SetupAllocation = {
  id?: number;
  classGroupId: number;
  subjectId: number;
  staffId: number | null;
  roomId: number | null;
  weeklyFrequency: number | null;
};

export type SetupClassGroup = {
  id: number;
  code: string;
  displayName: string;
  defaultRoomId: number | null;
};

export type SetupSubject = {
  id: number;
  code: string;
  name: string;
  weeklyFrequency?: number | null;
};

export type SetupSlot = { id: number; isBreak: boolean; slotOrder: number };

export type SetupRoom = { id: number; isSchedulable: boolean };

export type SetupSnapshot = {
  workingDays: string[];
  slots: SetupSlot[];
  classGroups: SetupClassGroup[];
  subjects: SetupSubject[];
  teachers: SetupTeacher[];
  rooms: SetupRoom[];
  allocations: SetupAllocation[];
  capacities?: { schoolSlotsPerWeek: number };
};

export type EntryRef = {
  classGroupId: number;
  subjectId: number;
  staffId: number;
  roomId: number | null;
  dayOfWeek: string;
  timeSlotId: number;
};

const ROUTE = {
  CLASSES_SECTIONS: '/app/classes-sections',
  ACADEMIC: '/app/academic',
  ACADEMIC_SMART: '/app/academic?tab=smart',
  ACADEMIC_LOAD: '/app/academic?tab=load',
  TEACHERS: '/app/teachers',
  SUBJECTS: '/app/subjects',
  ROOMS: '/app/rooms',
  TIME_BASIC: '/app/time?tab=basic',
  TIME_SLOTS: '/app/time?tab=slots',
} as const;

/**
 * Detect every conflict the structural data alone can prove.
 *
 * Output is grouped HARD-first, then SOFT, with stable ordering so list diffs
 * don't jitter as the user edits.
 */
export function detectStructuralConflicts(setup: SetupSnapshot | null | undefined): Conflict[] {
  if (!setup) return [];

  const out: Conflict[] = [];
  const teacherById = new Map(setup.teachers.map((t) => [t.id, t] as const));
  const subjectById = new Map(setup.subjects.map((s) => [s.id, s] as const));

  const classGroups = setup.classGroups ?? [];
  const subjects = setup.subjects ?? [];
  const teachers = setup.teachers ?? [];
  const rooms = setup.rooms ?? [];
  const allocations = setup.allocations ?? [];
  const slots = setup.slots ?? [];

  // ---- catastrophic / structural HARD ----
  if ((setup.workingDays ?? []).length === 0) {
    out.push({
      id: 'NO_WORKING_DAYS',
      severity: 'HARD',
      kind: 'NO_WORKING_DAYS',
      title: 'No working days configured',
      detail: 'The school has no working days set. The engine has nothing to schedule.',
      resolutions: [{ kind: 'link', label: 'Open Time slots', href: ROUTE.TIME_BASIC }],
    });
  }

  const nonBreak = slots.filter((s) => !s.isBreak);
  if (nonBreak.length === 0) {
    out.push({
      id: 'NO_TIME_SLOTS',
      severity: 'HARD',
      kind: 'NO_TIME_SLOTS',
      title: 'No teaching time slots',
      detail: slots.length === 0
        ? 'No time slots exist. Create the period grid before generating.'
        : 'All slots are marked as breaks. The engine has nowhere to place lectures.',
      resolutions: [{ kind: 'link', label: 'Edit slots', href: ROUTE.TIME_SLOTS }],
    });
  }

  if (classGroups.length === 0) {
    out.push({
      id: 'NO_CLASS_GROUPS',
      severity: 'HARD',
      kind: 'NO_CLASS_GROUPS',
      title: 'No classes / sections',
      detail: 'Generate at least one class group before mapping subjects.',
      resolutions: [{ kind: 'link', label: 'Open Classes & sections', href: ROUTE.CLASSES_SECTIONS }],
    });
  }

  if (allocations.length === 0 && classGroups.length > 0) {
    out.push({
      id: 'NO_ALLOCATIONS',
      severity: 'HARD',
      kind: 'NO_ALLOCATIONS',
      title: 'No subjects mapped to sections',
      detail: 'Map subjects to sections in Academic structure before generating.',
      resolutions: [{ kind: 'link', label: 'Map subjects', href: ROUTE.ACADEMIC }],
    });
  }

  // ---- per-allocation: missing teacher (HARD) and no eligible teacher (HARD) ----
  const missingTeacherByCG = new Map<number, number[]>(); // classGroupId -> subjectIds
  const noEligibleByCG = new Map<number, number[]>();

  for (const a of allocations) {
    if (a.staffId == null) {
      const arr = missingTeacherByCG.get(a.classGroupId) ?? [];
      arr.push(a.subjectId);
      missingTeacherByCG.set(a.classGroupId, arr);
      continue;
    }
    const t = teacherById.get(a.staffId);
    if (!t) continue;
    if (
      Array.isArray(t.teachableSubjectIds) &&
      t.teachableSubjectIds.length > 0 &&
      !t.teachableSubjectIds.includes(a.subjectId)
    ) {
      const arr = noEligibleByCG.get(a.classGroupId) ?? [];
      arr.push(a.subjectId);
      noEligibleByCG.set(a.classGroupId, arr);
    }
  }

  for (const [cgId, subIds] of missingTeacherByCG.entries()) {
    const cg = classGroups.find((c) => c.id === cgId);
    const subjectCodes = subIds
      .map((id) => subjectById.get(id)?.code)
      .filter(Boolean)
      .slice(0, 6)
      .join(', ');
    out.push({
      id: `NO_TEACHER_ASSIGNED:${cgId}`,
      severity: 'HARD',
      kind: 'NO_TEACHER_ASSIGNED',
      title: `No teacher for ${cg?.displayName ?? cg?.code ?? `class #${cgId}`}`,
      detail: `${subIds.length} subject${subIds.length === 1 ? '' : 's'} have no teacher assigned: ${subjectCodes}${subIds.length > 6 ? '…' : ''}.`,
      resolutions: [{ kind: 'link', label: 'Assign teachers', href: ROUTE.ACADEMIC_SMART }],
      refs: { classGroupIds: [cgId], subjectIds: subIds },
    });
  }

  for (const [cgId, subIds] of noEligibleByCG.entries()) {
    const cg = classGroups.find((c) => c.id === cgId);
    const subjectCodes = subIds
      .map((id) => subjectById.get(id)?.code)
      .filter(Boolean)
      .slice(0, 6)
      .join(', ');
    out.push({
      id: `NO_ELIGIBLE_TEACHER:${cgId}`,
      severity: 'HARD',
      kind: 'NO_ELIGIBLE_TEACHER',
      title: `Assigned teacher can't teach those subjects (${cg?.displayName ?? cg?.code ?? `class #${cgId}`})`,
      detail: `Teacher's "can teach" list excludes: ${subjectCodes}${subIds.length > 6 ? '…' : ''}. Either add the subject to the teacher, or pick another teacher.`,
      resolutions: [
        { kind: 'link', label: 'Edit teacher subjects', href: ROUTE.TEACHERS },
        { kind: 'link', label: 'Reassign in Academic', href: ROUTE.ACADEMIC_SMART },
      ],
      refs: { classGroupIds: [cgId], subjectIds: subIds },
    });
  }

  // ---- teacher overload (HARD) ----
  const cap = Number(setup.capacities?.schoolSlotsPerWeek ?? 0);
  const allocByTeacher = new Map<number, number>();
  for (const a of allocations) {
    if (a.staffId == null) continue;
    allocByTeacher.set(a.staffId, (allocByTeacher.get(a.staffId) ?? 0) + (a.weeklyFrequency ?? 0));
  }
  for (const t of teachers) {
    const load = allocByTeacher.get(t.id) ?? 0;
    const max = t.maxWeeklyLectureLoad != null ? Number(t.maxWeeklyLectureLoad) : cap;
    if (max > 0 && load > max) {
      out.push({
        id: `TEACHER_OVERLOAD:${t.id}`,
        severity: 'HARD',
        kind: 'TEACHER_OVERLOAD',
        title: `${t.fullName} is over capacity (${load}/${max} weekly periods)`,
        detail: `Reduce assigned periods or raise the teacher's max weekly load before generating.`,
        resolutions: [
          { kind: 'link', label: 'Open Teacher load', href: ROUTE.ACADEMIC_LOAD },
          { kind: 'link', label: 'Edit max load', href: ROUTE.TEACHERS },
        ],
        refs: { teacherIds: [t.id] },
      });
    }
  }

  // ---- soft / advisory ----
  if (rooms.filter((r) => r.isSchedulable !== false).length === 0 && classGroups.length > 0) {
    out.push({
      id: 'NO_ROOM_ANY',
      severity: 'SOFT',
      kind: 'NO_ROOM_ANY',
      title: 'No schedulable rooms',
      detail: 'The engine can run without rooms (homeroom only), but lab subjects and capacity won\'t be respected.',
      resolutions: [{ kind: 'link', label: 'Add rooms', href: ROUTE.ROOMS }],
    });
  }

  const subsWithoutFreq = subjects.filter((s) => s.weeklyFrequency == null || Number(s.weeklyFrequency) <= 0);
  if (subsWithoutFreq.length > 0) {
    out.push({
      id: 'SUBJECT_MISSING_FREQUENCY',
      severity: 'SOFT',
      kind: 'SUBJECT_MISSING_FREQUENCY',
      title: `${subsWithoutFreq.length} subject${subsWithoutFreq.length === 1 ? '' : 's'} have no default weekly frequency`,
      detail: `Defaulted to 4 periods/week. Set explicit values where they matter: ${subsWithoutFreq.slice(0, 6).map((s) => s.code).join(', ')}${subsWithoutFreq.length > 6 ? '…' : ''}.`,
      resolutions: [{ kind: 'link', label: 'Open Subjects', href: ROUTE.SUBJECTS }],
      refs: { subjectIds: subsWithoutFreq.map((s) => s.id) },
    });
  }

  return out;
}

/**
 * Detect post-generation conflicts from the latest entries grid.
 * These are conditions the engine couldn't satisfy (or the user introduced via manual edits).
 *
 * When there are zero entries, we return none: comparing required weekly periods to scheduled
 * counts would flag every allocation as “0/X” — that reads like bad subject config but actually
 * just means “no draft scheduled yet”.
 */
export function detectEntryConflicts(setup: SetupSnapshot | null | undefined, entries: EntryRef[] | null | undefined): Conflict[] {
  if (!setup) return [];
  const list = entries ?? [];
  if (list.length === 0) return [];

  const out: Conflict[] = [];
  const subjectById = new Map(setup.subjects.map((s) => [s.id, s] as const));
  const classGroupById = new Map(setup.classGroups.map((c) => [c.id, c] as const));

  // ---- frequency mismatch (HARD) ----
  const countByClassSub = new Map<string, number>();
  for (const e of list) {
    countByClassSub.set(`${e.classGroupId}:${e.subjectId}`, (countByClassSub.get(`${e.classGroupId}:${e.subjectId}`) ?? 0) + 1);
  }
  const subjectWeeklyById = new Map<number, number>();
  for (const sub of setup.subjects ?? []) {
    const v = sub.weeklyFrequency;
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) subjectWeeklyById.set(sub.id, n);
  }
  const mismatches: { cgId: number; subId: number; want: number; have: number }[] = [];
  for (const a of setup.allocations ?? []) {
    const want = Number(a.weeklyFrequency ?? subjectWeeklyById.get(a.subjectId) ?? 0);
    if (!want) continue;
    const have = countByClassSub.get(`${a.classGroupId}:${a.subjectId}`) ?? 0;
    if (have !== want) mismatches.push({ cgId: a.classGroupId, subId: a.subjectId, want, have });
  }
  // Group by class for compact rendering.
  const byClass = new Map<number, { subId: number; want: number; have: number }[]>();
  for (const m of mismatches) {
    const arr = byClass.get(m.cgId) ?? [];
    arr.push({ subId: m.subId, want: m.want, have: m.have });
    byClass.set(m.cgId, arr);
  }
  for (const [cgId, items] of byClass.entries()) {
    const cg = classGroupById.get(cgId);
    const sample = items
      .slice(0, 4)
      .map((it) => `${subjectById.get(it.subId)?.code ?? `#${it.subId}`} ${it.have}/${it.want}`)
      .join(', ');
    out.push({
      id: `FREQUENCY_MISMATCH:${cgId}`,
      severity: 'HARD',
      kind: 'FREQUENCY_MISMATCH',
      title: `Weekly frequency mismatch in ${cg?.displayName ?? cg?.code ?? `class #${cgId}`}`,
      detail: `${items.length} subject${items.length === 1 ? '' : 's'} are not at their required weekly period count on this timetable (${sample}${items.length > 4 ? '…' : ''}).`,
      resolutions: [
        { kind: 'action', label: 'Auto-fix', actionId: 'auto-fix' },
        { kind: 'action', label: 'Regenerate', actionId: 'regenerate' },
        { kind: 'link', label: 'Open class', href: `/app/timetable?cg=${cgId}` },
      ],
      refs: { classGroupIds: [cgId], subjectIds: items.map((x) => x.subId) },
    });
  }

  // ---- teacher double-booked (HARD) ----
  const teacherSlotMap = new Map<string, EntryRef[]>();
  for (const e of list) {
    const k = `${e.staffId}__${e.dayOfWeek}__${e.timeSlotId}`;
    const arr = teacherSlotMap.get(k) ?? [];
    arr.push(e);
    teacherSlotMap.set(k, arr);
  }
  for (const [k, arr] of teacherSlotMap.entries()) {
    if (arr.length < 2) continue;
    const [staffIdStr, day, tsIdStr] = k.split('__');
    const teacherId = Number(staffIdStr);
    out.push({
      id: `TEACHER_DOUBLE_BOOKED:${k}`,
      severity: 'HARD',
      kind: 'TEACHER_DOUBLE_BOOKED',
      title: `Teacher double-booked on ${day} (${arr.length} sections)`,
      detail: `Same teacher assigned to ${arr.map((e) => classGroupById.get(e.classGroupId)?.code ?? `cg#${e.classGroupId}`).join(', ')} at the same period.`,
      resolutions: [
        { kind: 'action', label: 'Auto-fix', actionId: 'auto-fix' },
        { kind: 'action', label: 'Regenerate', actionId: 'regenerate' },
      ],
      refs: {
        teacherIds: [teacherId],
        classGroupIds: arr.map((e) => e.classGroupId),
        timeSlotIds: [Number(tsIdStr)],
        days: [day],
      },
    });
  }

  // ---- room double-booked (HARD) ----
  const roomSlotMap = new Map<string, EntryRef[]>();
  for (const e of list) {
    if (e.roomId == null) continue;
    const k = `${e.roomId}__${e.dayOfWeek}__${e.timeSlotId}`;
    const arr = roomSlotMap.get(k) ?? [];
    arr.push(e);
    roomSlotMap.set(k, arr);
  }
  for (const [k, arr] of roomSlotMap.entries()) {
    if (arr.length < 2) continue;
    const [roomIdStr, day, tsIdStr] = k.split('__');
    out.push({
      id: `ROOM_DOUBLE_BOOKED:${k}`,
      severity: 'HARD',
      kind: 'ROOM_DOUBLE_BOOKED',
      title: `Room double-booked on ${day} (${arr.length} sections)`,
      detail: `Same room assigned to ${arr.map((e) => classGroupById.get(e.classGroupId)?.code ?? `cg#${e.classGroupId}`).join(', ')} at the same period.`,
      resolutions: [
        { kind: 'action', label: 'Auto-fix', actionId: 'auto-fix' },
        { kind: 'action', label: 'Regenerate', actionId: 'regenerate' },
      ],
      refs: {
        roomIds: [Number(roomIdStr)],
        classGroupIds: arr.map((e) => e.classGroupId),
        timeSlotIds: [Number(tsIdStr)],
        days: [day],
      },
    });
  }

  return out;
}

export function summariseConflicts(list: Conflict[]) {
  let hard = 0;
  let soft = 0;
  for (const c of list) {
    if (c.severity === 'HARD') hard += 1;
    else soft += 1;
  }
  return { hard, soft, total: list.length };
}
