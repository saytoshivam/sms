import type { AcademicAllocRow } from './academicStructureUtils';

/** Keep aligned with {@code TeachableSlotsMath.DEFAULT_MAX_WEEKLY_LECTURE_LOAD}. */
const DEFAULT_MAX_WEEKLY_LECTURE_LOAD = 32;

const TEACHER = 'TEACHER';

export type TeacherDemandStatus = 'OK' | 'WARN' | 'CRITICAL';

export type DemandStaff = {
  id: number;
  teachableSubjectIds: number[];
  roleNames: string[];
  maxWeeklyLectureLoad?: number | null;
};

export type TeacherDemandSubjectRow = {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  requiredPeriods: number;
  qualifiedTeacherCount: number;
  availableCapacity: number;
  avgTeacherCapacity: number | null;
  teachersNeeded: number | null;
  periodShortfall: number;
  teacherShortfall: number;
  status: TeacherDemandStatus;
  statusDetail: string;
  assignmentFeasible: boolean;
};

export type TeacherDemandComputeArgs = {
  subjects: { id: number; name: string; code: string }[];
  allocations: AcademicAllocRow[];
  staff: DemandStaff[];
  slotsPerWeek: number | null;
};

function isStaffTeacher(s: DemandStaff): boolean {
  const r = s.roleNames ?? [];
  return r.includes(TEACHER);
}

/** Mirrors smart-assign eligibility: TEACHER role + non-empty teachables including subjectId. */
function eligibleForDemand(s: DemandStaff, subjectId: number): boolean {
  if (!isStaffTeacher(s)) return false;
  const t = s.teachableSubjectIds ?? [];
  return t.length > 0 && t.includes(subjectId);
}

function effectiveMaxLoad(s: DemandStaff, fallbackMaxLoad: number | null | undefined): number {
  if (s.maxWeeklyLectureLoad != null && s.maxWeeklyLectureLoad > 0) return s.maxWeeklyLectureLoad;
  if (fallbackMaxLoad != null && fallbackMaxLoad > 0) return fallbackMaxLoad;
  return DEFAULT_MAX_WEEKLY_LECTURE_LOAD;
}

function classify(required: number, qualified: number, capacity: number): TeacherDemandStatus {
  if (required <= 0) return 'OK';
  if (qualified <= 0) return 'CRITICAL';
  if (capacity >= required) return 'OK';
  const thresh = 0.9 * required;
  if (capacity >= thresh) return 'WARN';
  return 'CRITICAL';
}

function describeStatus(
  status: TeacherDemandStatus,
  required: number,
  qualified: number,
  _capacity: number,
  periodShortfall: number,
  teacherShortfall: number,
): string {
  if (required <= 0) return 'No weekly demand';
  if (qualified <= 0) return 'No qualified teachers';
  if (status === 'OK') return 'Capacity meets demand';
  if (status === 'WARN') return 'Near capacity (within 90%)';
  if (teacherShortfall > 0) {
    return `Short by ${teacherShortfall} teacher${teacherShortfall === 1 ? '' : 's'}`;
  }
  if (periodShortfall > 0) {
    return `Short by ${periodShortfall} period${periodShortfall === 1 ? '' : 's'}`;
  }
  return 'Insufficient capacity';
}

export function computeTeacherDemandSummary(args: TeacherDemandComputeArgs): {
  rows: TeacherDemandSubjectRow[];
  hasSevereShortage: boolean;
  schoolSlotsPerWeek: number | null;
} {
  const { subjects, allocations, staff, slotsPerWeek } = args;

  const requiredBySubject = new Map<number, number>();
  for (const a of allocations) {
    const freq = a.weeklyFrequency > 0 ? a.weeklyFrequency : 0;
    if (freq <= 0) continue;
    const sid = Number(a.subjectId);
    requiredBySubject.set(sid, (requiredBySubject.get(sid) ?? 0) + freq);
  }

  const rows: TeacherDemandSubjectRow[] = [];
  let hasSevereShortage = false;

  for (const sub of subjects) {
    const sid = Number(sub.id);
    const req = requiredBySubject.get(sid) ?? 0;

    let qualified = 0;
    let capacity = 0;
    for (const st of staff) {
      if (!eligibleForDemand(st, sid)) continue;
      qualified++;
      capacity += effectiveMaxLoad(st, slotsPerWeek ?? undefined);
    }

    const avgCap = qualified > 0 ? capacity / qualified : null;
    let teachersNeeded: number | null = null;
    if (qualified > 0 && avgCap != null && avgCap > 0.0001) {
      teachersNeeded = Math.ceil(req / avgCap);
    }

    const periodShortfall = Math.max(0, req - capacity);
    const tn = teachersNeeded == null ? qualified : teachersNeeded;
    const teacherShortfall = Math.max(0, tn - qualified);

    const status = classify(req, qualified, capacity);
    if (status === 'CRITICAL' && req > 0) hasSevereShortage = true;

    const statusDetail = describeStatus(status, req, qualified, capacity, periodShortfall, teacherShortfall);
    const assignmentFeasible = req <= 0 || capacity >= req;

    rows.push({
      subjectId: sid,
      subjectCode: String(sub.code ?? '').trim(),
      subjectName: String(sub.name ?? '').trim(),
      requiredPeriods: req,
      qualifiedTeacherCount: qualified,
      availableCapacity: capacity,
      avgTeacherCapacity: avgCap == null ? null : Math.round(avgCap * 100) / 100,
      teachersNeeded,
      periodShortfall,
      teacherShortfall,
      status,
      statusDetail,
      assignmentFeasible,
    });
  }

  rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName, undefined, { sensitivity: 'base' }));

  return { rows, hasSevereShortage, schoolSlotsPerWeek: slotsPerWeek };
}

export function shouldBlockSmartAutoAssign(args: TeacherDemandComputeArgs): boolean {
  return computeTeacherDemandSummary(args).hasSevereShortage;
}

/** Reads onboarding timetable auto-generate payload warnings (camelCase JSON). */
export function extractTeacherDemandWarnings(res: unknown): string[] {
  if (!res || typeof res !== 'object') return [];
  const w = (res as Record<string, unknown>).teacherDemandWarnings;
  if (!Array.isArray(w)) return [];
  return w.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}
