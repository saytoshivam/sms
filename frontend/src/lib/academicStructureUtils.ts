/** Same shape as SubjectAllocation row in onboarding state. */
export type AcademicAllocRow = {
  classGroupId: number;
  subjectId: number;
  staffId: number | null;
  weeklyFrequency: number;
  roomId: number | null;
};

type BasicInfoLite = {
  schoolStartTime: string;
  schoolEndTime: string;
  openWindows?: { startTime: string; endTime: string }[];
  lectureDurationMinutes: number;
  workingDays: string[];
} | null | undefined;

/** Normalizes API `auto` / `manual` strings for section-level draft state. */
export function assignmentSourceFromApi(s: string | null | undefined): 'auto' | 'manual' | '' {
  const u = String(s ?? '').trim().toLowerCase();
  if (u === 'auto') return 'auto';
  if (u === 'manual') return 'manual';
  return '';
}

export function parseHm(s: string) {
  const p = s.split(':').map((x) => Number(x.trim()));
  if (p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  return p[0] * 60 + p[1];
}

export function estimateSlotsPerWeek(b: BasicInfoLite): number | null {
  if (!b) return null;
  const days = b.workingDays?.length ?? 0;
  if (days < 1) return null;
  const dur = b.lectureDurationMinutes;
  if (!dur || dur < 1) return null;
  const wins = (b.openWindows ?? []).filter(Boolean);
  const perDay = wins.length
    ? wins.reduce((acc, w) => {
        const s = parseHm(w.startTime);
        const e = parseHm(w.endTime);
        if (s == null || e == null || e <= s) return acc;
        return acc + Math.max(0, Math.floor((e - s) / dur));
      }, 0)
    : (() => {
        const start = parseHm(b.schoolStartTime);
        const end = parseHm(b.schoolEndTime);
        if (start == null || end == null || end <= start) return null;
        return Math.max(0, Math.floor((end - start) / dur));
      })();
  if (perDay == null) return null;
  return days * Math.max(1, perDay);
}

export type SectionHealth = {
  subjectCount: number;
  totalPeriods: number;
  issueCount: number;
  /** missing periods, missing teacher, or ineligible */
  hasHardIssue: boolean;
  overCapacity: boolean;
  /** global teacher load > capacity */
  hasTeacherLoadWarn: boolean;
  completenessPct: number;
};

type StaffTeachable = {
  id: number;
  teachableSubjectIds: number[];
  roleNames: string[];
  /** Optional teacher cap override; when set, it overrides school-wide slotsPerWeek capacity checks. */
  maxWeeklyLectureLoad?: number | null;
};

const TEACHER = 'TEACHER';

function isTeacher(s: StaffTeachable) {
  const r = s.roleNames ?? [];
  if (r.includes(TEACHER)) return true;
  if (r.length === 0 && (s.teachableSubjectIds?.length ?? 0) > 0) return true;
  return false;
}

function canTeach(s: StaffTeachable, subjectId: number) {
  const t = s.teachableSubjectIds ?? [];
  if (t.length === 0) return true;
  return t.includes(subjectId);
}

/**
 * per-section stats for overview cards. `catalogSubjectCount` = global subjects in school catalog.
 */
export function computeSectionHealth(
  classGroupId: number,
  allocRows: AcademicAllocRow[],
  catalogSubjectCount: number,
  staff: StaffTeachable[],
  slotsPerWeek: number | null,
): SectionHealth {
  // If the subject catalog is empty (e.g. after bulk delete), treat every section as unconfigured.
  // Any stale allocRows in local draft / server responses should not show up as "subjects on" or "issues".
  if (!catalogSubjectCount || catalogSubjectCount <= 0) {
    return {
      subjectCount: 0,
      totalPeriods: 0,
      issueCount: 0,
      hasHardIssue: false,
      overCapacity: false,
      hasTeacherLoadWarn: false,
      completenessPct: 0,
    };
  }
  const rows = allocRows.filter((r) => Number(r.classGroupId) === Number(classGroupId));
  const subjectCount = rows.length;
  const totalPeriods = rows.reduce((a, r) => a + (r.weeklyFrequency > 0 ? r.weeklyFrequency : 0), 0);
  const loadByStaff = new Map<number, number>();
  for (const a of allocRows) {
    if (a.staffId == null) continue;
    loadByStaff.set(a.staffId, (loadByStaff.get(a.staffId) ?? 0) + (a.weeklyFrequency > 0 ? a.weeklyFrequency : 0));
  }
  let issueCount = 0;
  let hasHardIssue = false;
  for (const r of rows) {
    const tOpts = staff.filter((s) => isTeacher(s) && canTeach(s, r.subjectId));
    if (tOpts.length === 0) {
      issueCount += 1;
      hasHardIssue = true;
    } else if (!r.staffId || !tOpts.some((t) => t.id === r.staffId)) {
      issueCount += 1;
      hasHardIssue = true;
    }
    if (!r.weeklyFrequency || r.weeklyFrequency < 1) {
      issueCount += 1;
      hasHardIssue = true;
    }
  }
  const overCapacity = slotsPerWeek != null && totalPeriods > slotsPerWeek;
  if (overCapacity) hasHardIssue = true;
  let hasTeacherLoadWarn = false;
  for (const r of rows) {
    if (r.staffId == null) continue;
    const load = loadByStaff.get(r.staffId) ?? 0;
    const t = staff.find((s) => Number(s.id) === Number(r.staffId));
    // If teacher has an explicit cap, it overrides school-wide slot estimate.
    const teacherCap =
      t?.maxWeeklyLectureLoad != null && t.maxWeeklyLectureLoad > 0 ? t.maxWeeklyLectureLoad : slotsPerWeek;
    if (teacherCap != null && load > teacherCap) {
      hasTeacherLoadWarn = true;
      break;
    }
  }
  const maxSubjects = Math.max(1, catalogSubjectCount);
  const configured = subjectCount;
  const validRows = rows.filter((r) => {
    if (!r.weeklyFrequency || r.weeklyFrequency < 1) return false;
    const tOpts = staff.filter((s) => isTeacher(s) && canTeach(s, r.subjectId));
    return r.staffId != null && tOpts.some((t) => t.id === r.staffId);
  }).length;
  const completenessPct = Math.min(100, Math.round((validRows / maxSubjects) * 100));
  return {
    subjectCount,
    totalPeriods,
    issueCount,
    hasHardIssue,
    overCapacity,
    hasTeacherLoadWarn: hasTeacherLoadWarn && !overCapacity,
    completenessPct: configured === 0 ? 0 : completenessPct,
  };
}

export function countSectionsWithIssues(
  classGroupIds: number[],
  allocRows: AcademicAllocRow[],
  catalogSubjectCount: number,
  staff: StaffTeachable[],
  slotsPerWeek: number | null,
) {
  let n = 0;
  for (const id of classGroupIds) {
    const h = computeSectionHealth(id, allocRows, catalogSubjectCount, staff, slotsPerWeek);
    if (h.hasHardIssue || h.issueCount > 0) n += 1;
  }
  return n;
}

export type ClassSubjectConfigRow = {
  gradeLevel: number;
  subjectId: number;
  defaultPeriodsPerWeek: number;
  defaultTeacherId: number | null;
  defaultRoomId: number | null;
};

export type SectionSubjectOverrideRow = {
  classGroupId: number;
  subjectId: number;
  periodsPerWeek: number | null;
  teacherId: number | null;
  roomId: number | null;
};

/** Resolved section homeroom (ClassGroup.defaultRoom) as a numeric id, when known from draft UI. */
export function homeroomMapFromDraft(
  classGroups: { classGroupId: number }[],
  defaultRoomByClassId: Record<number, string>,
): Map<number, number | null> {
  const m = new Map<number, number | null>();
  for (const cg of classGroups ?? []) {
    const raw = defaultRoomByClassId[cg.classGroupId];
    const n = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
    m.set(cg.classGroupId, Number.isFinite(n) ? n : null);
  }
  return m;
}

export function sectionHasAssignedRoomDraft(
  classGroupId: number,
  defaultRoomByClassId: Record<number, string>,
): boolean {
  const raw = defaultRoomByClassId[classGroupId];
  return raw != null && String(raw).trim() !== '';
}

/**
 * Class groups (excluding `excludeClassGroupId`) whose Overview draft already assigns this room id as the section homeroom.
 * Matches the “duplicate assigned room” rule used in the sections overview table.
 */
export function otherClassGroupIdsSharingHomeroomRoom(
  roomId: number,
  defaultRoomByClassId: Record<number, string>,
  excludeClassGroupId: number,
): number[] {
  const target = String(roomId);
  const out: number[] = [];
  for (const [k, raw] of Object.entries(defaultRoomByClassId)) {
    const cg = Number(k);
    if (!Number.isFinite(cg) || cg === excludeClassGroupId) continue;
    const v = raw != null ? String(raw).trim() : '';
    if (v !== '' && v === target) out.push(cg);
  }
  return out;
}

export function findSectionSubjectOverrideRow(
  sectionSubjectOverrides: SectionSubjectOverrideRow[],
  classGroupId: number,
  subjectId: number,
): SectionSubjectOverrideRow | undefined {
  return sectionSubjectOverrides.find(
    (o) => Number(o.classGroupId) === Number(classGroupId) && Number(o.subjectId) === Number(subjectId),
  );
}

export function slotHasExplicitRoomOverride(ov: SectionSubjectOverrideRow | undefined): boolean {
  return ov != null && ov.roomId != null && Number.isFinite(Number(ov.roomId));
}

/** Any subject in this section has a saved per-slot room — unlocks subject row room pickers without Overview homeroom. */
export function sectionHasAnyExplicitRoomOverride(
  sectionSubjectOverrides: SectionSubjectOverrideRow[],
  classGroupId: number,
): boolean {
  const cg = Number(classGroupId);
  return sectionSubjectOverrides.some(
    (o) => Number(o.classGroupId) === cg && o.roomId != null && Number.isFinite(Number(o.roomId)),
  );
}

/**
 * Smart Assignment: show a concrete room after the section has an assigned room, this slot has an explicit override,
 * or any sibling subject in the section already has a manual room (so remaining subjects can be filled without Overview first).
 * Avoids implying a subject-level room exists from grade templates before section rooms exist.
 */
export function smartAssignSubjectRoomIsVisible(args: {
  classGroupId: number;
  subjectId: number;
  defaultRoomByClassId: Record<number, string>;
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
}): boolean {
  const { classGroupId, subjectId, defaultRoomByClassId, sectionSubjectOverrides } = args;
  if (sectionHasAssignedRoomDraft(classGroupId, defaultRoomByClassId)) return true;
  if (slotHasExplicitRoomOverride(findSectionSubjectOverrideRow(sectionSubjectOverrides, classGroupId, subjectId))) return true;
  if (sectionHasAnyExplicitRoomOverride(sectionSubjectOverrides, classGroupId)) return true;
  return false;
}

export function buildEffectiveAllocRows(
  classGroups: { classGroupId: number; gradeLevel: number | null }[],
  classSubjectConfigs: ClassSubjectConfigRow[],
  sectionSubjectOverrides: SectionSubjectOverrideRow[],
  homeroomByClassGroupId?: ReadonlyMap<number, number | null> | null,
): AcademicAllocRow[] {
  const cfgByKey = new Map<string, ClassSubjectConfigRow>();
  for (const c of classSubjectConfigs ?? []) {
    if (!c) continue;
    const g = Number(c.gradeLevel);
    const s = Number(c.subjectId);
    if (!Number.isFinite(g) || !Number.isFinite(s)) continue;
    cfgByKey.set(`${g}:${s}`, c);
  }
  const ovByKey = new Map<string, SectionSubjectOverrideRow>();
  const overrideByClassGroup = new Map<number, SectionSubjectOverrideRow[]>();
  for (const o of sectionSubjectOverrides ?? []) {
    if (!o) continue;
    const cg = Number(o.classGroupId);
    const s = Number(o.subjectId);
    if (!Number.isFinite(cg) || !Number.isFinite(s)) continue;
    ovByKey.set(`${cg}:${s}`, o);
    const arr = overrideByClassGroup.get(cg) ?? [];
    arr.push(o);
    overrideByClassGroup.set(cg, arr);
  }

  const out: AcademicAllocRow[] = [];
  for (const cg of classGroups ?? []) {
    const grade = cg.gradeLevel == null ? null : Number(cg.gradeLevel);
    if (grade == null || !Number.isFinite(grade)) continue;

    // Template-driven subjects (class defaults)
    for (const [key, cfg] of cfgByKey.entries()) {
      const [gStr, sStr] = key.split(':');
      const g = Number(gStr);
      if (g !== grade) continue;
      const subjectId = Number(sStr);
      const ov = ovByKey.get(`${cg.classGroupId}:${subjectId}`);
      const weeklyFrequency = ov?.periodsPerWeek ?? cfg.defaultPeriodsPerWeek;
      if (!weeklyFrequency || weeklyFrequency <= 0) continue;
      const homeroom = homeroomByClassGroupId?.get(cg.classGroupId) ?? null;
      out.push({
        classGroupId: cg.classGroupId,
        subjectId,
        weeklyFrequency,
        staffId: ov?.teacherId ?? cfg.defaultTeacherId ?? null,
        /** Section homeroom + grade template hint only — per-subject room overrides live in timetable editor. */
        roomId: homeroom ?? cfg.defaultRoomId ?? null,
      });
    }

    // Section-only additions (subjects NOT in class defaults but explicitly enabled in this section)
    const ovr = overrideByClassGroup.get(cg.classGroupId) ?? [];
    for (const o of ovr) {
      const subjectId = Number(o.subjectId);
      if (!Number.isFinite(subjectId)) continue;
      // If template has this subject, it was already handled above.
      if (cfgByKey.has(`${grade}:${subjectId}`)) continue;
      const weeklyFrequency = o.periodsPerWeek;
      if (!weeklyFrequency || weeklyFrequency <= 0) continue;
      const homeroom = homeroomByClassGroupId?.get(cg.classGroupId) ?? null;
      out.push({
        classGroupId: cg.classGroupId,
        subjectId,
        weeklyFrequency,
        staffId: o.teacherId ?? null,
        roomId: homeroom ?? null,
      });
    }
  }
  return out;
}
