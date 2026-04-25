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
  lectureDurationMinutes: number;
  workingDays: string[];
} | null | undefined;

export function parseHm(s: string) {
  const p = s.split(':').map((x) => Number(x.trim()));
  if (p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  return p[0] * 60 + p[1];
}

export function estimateSlotsPerWeek(b: BasicInfoLite): number | null {
  if (!b) return null;
  const days = b.workingDays?.length ?? 0;
  if (days < 1) return null;
  const start = parseHm(b.schoolStartTime);
  const end = parseHm(b.schoolEndTime);
  const dur = b.lectureDurationMinutes;
  if (start == null || end == null || !dur || dur < 1) return null;
  const perDay = Math.max(1, Math.floor((end - start) / dur));
  return days * perDay;
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

type StaffTeachable = { id: number; teachableSubjectIds: number[]; roleNames: string[] };

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
    if (slotsPerWeek != null && load > slotsPerWeek) {
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

export function buildEffectiveAllocRows(
  classGroups: { classGroupId: number; gradeLevel: number | null }[],
  classSubjectConfigs: ClassSubjectConfigRow[],
  sectionSubjectOverrides: SectionSubjectOverrideRow[],
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
  for (const o of sectionSubjectOverrides ?? []) {
    if (!o) continue;
    const cg = Number(o.classGroupId);
    const s = Number(o.subjectId);
    if (!Number.isFinite(cg) || !Number.isFinite(s)) continue;
    ovByKey.set(`${cg}:${s}`, o);
  }

  const out: AcademicAllocRow[] = [];
  for (const cg of classGroups ?? []) {
    const grade = cg.gradeLevel == null ? null : Number(cg.gradeLevel);
    if (grade == null || !Number.isFinite(grade)) continue;
    for (const [key, cfg] of cfgByKey.entries()) {
      const [gStr, sStr] = key.split(':');
      const g = Number(gStr);
      if (g !== grade) continue;
      const subjectId = Number(sStr);
      const ov = ovByKey.get(`${cg.classGroupId}:${subjectId}`);
      const weeklyFrequency = ov?.periodsPerWeek ?? cfg.defaultPeriodsPerWeek;
      if (!weeklyFrequency || weeklyFrequency <= 0) continue;
      out.push({
        classGroupId: cg.classGroupId,
        subjectId,
        weeklyFrequency,
        staffId: ov?.teacherId ?? cfg.defaultTeacherId ?? null,
        roomId: ov?.roomId ?? cfg.defaultRoomId ?? null,
      });
    }
  }
  return out;
}
