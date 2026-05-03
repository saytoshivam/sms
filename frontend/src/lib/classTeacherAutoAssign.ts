import type { AcademicAllocRow } from './academicStructureUtils';

/** Section-level provenance for class teacher (homeroom) pick — `'manual'` skips bulk auto assignment. */
export type ClassTeacherSource = 'auto' | 'manual' | '';

export type AutoAssignClassTeacherStats = {
  /** Rows written or cleared by this bulk run for non-manual sections. */
  touched: number;
  /** Sections that now have a class teacher ID after run. */
  assigned: number;
  /** Distinct staff IDs acting as some section's class teacher. */
  uniqueAssignments: number;
  /** Sections that share a class teacher with another section (sum of sectionCount - 1 per staff). */
  sharedAssignments: number;
  skippedLocked: number;
  skippedNoEligibleTeacher: number;
};

type ClassGroupMini = { classGroupId: number; gradeLevel: number | null };

/**
 * Intelligent class-teacher picker using only resolved subject allocations per section
 * (effective smart-assignment mappings + weekly frequencies). No timetable dependence.
 *
 * Rules (additive score): primary weekly load (~100 scale), uniqueness bonus/penalty (±70/80),
 * same-grade continuity (~40), multi-subject breadth in section (~35).
 */
export function runAutoAssignClassTeachers(args: {
  classGroups: ClassGroupMini[];
  effectiveAllocRows: AcademicAllocRow[];
  classTeacherByClassGroupId: Readonly<Record<number, string | undefined>>;
  classTeacherSourceByClassGroupId: Readonly<Record<number, ClassTeacherSource | undefined>>;
  /** Passed for forward-compat with school rhythm; scorer currently uses allocations only. */
  schoolSlotsPerWeek?: number | null;
}): {
  nextTeachers: Record<number, string>;
  nextSource: Record<number, ClassTeacherSource>;
  stats: AutoAssignClassTeacherStats;
} {
  const { effectiveAllocRows, classGroups } = args;
  void args.schoolSlotsPerWeek;

  const nextTeachers: Record<number, string> = {};
  for (const cg of classGroups) {
    const v = args.classTeacherByClassGroupId[cg.classGroupId];
    nextTeachers[cg.classGroupId] = v != null && v !== '' ? String(v) : '';
  }

  const nextSource: Record<number, ClassTeacherSource> = {};
  for (const cg of classGroups) {
    const k = cg.classGroupId;
    nextSource[k] = args.classTeacherSourceByClassGroupId[k] ?? '';
  }

  const skippedLockedManual = classGroups.filter(
    (cg) => (args.classTeacherSourceByClassGroupId[cg.classGroupId] ?? '') === 'manual',
  ).length;

  const gradeByCg = new Map<number, number | null>();
  for (const cg of classGroups) gradeByCg.set(cg.classGroupId, cg.gradeLevel);

  /** Aggregated teaching load only from allocations with staff assigned. */
  const bySectionTeacher = new Map<number, Map<number, { periods: number; subjects: Set<number> }>>();
  for (const a of effectiveAllocRows) {
    const sid = Number(a.subjectId);
    const wf = Number(a.weeklyFrequency);
    const tid = a.staffId == null ? null : Number(a.staffId);
    if (!tid || !Number.isFinite(wf) || wf <= 0) continue;

    let m = bySectionTeacher.get(a.classGroupId);
    if (!m) {
      m = new Map();
      bySectionTeacher.set(a.classGroupId, m);
    }
    const prev = m.get(tid) ?? { periods: 0, subjects: new Set<number>() };
    prev.periods += wf;
    prev.subjects.add(sid);
    m.set(tid, prev);
  }

  const teacherOtherSectionsInSameGrade = (teacherId: number, currentCg: number): number => {
    const gCur = gradeByCg.get(currentCg);
    if (gCur == null || !Number.isFinite(Number(gCur))) return 0;
    let n = 0;
    for (const cg of classGroups) {
      if (cg.classGroupId === currentCg) continue;
      if (cg.gradeLevel == null || Number(cg.gradeLevel) !== Number(gCur)) continue;
      const m = bySectionTeacher.get(cg.classGroupId);
      if (!m?.has(teacherId)) continue;
      n += 1;
    }
    return n;
  };

  type Scored = { teacherId: number; score: number };
  function scoreTeacherForSection(sectionId: number, teacherId: number, agg: { periods: number; subjects: Set<number> }, ctx: Context): Scored {
    const maxPeriods = ctx.maxPeriods;
    const maxSubjects = ctx.maxSubjects;
    const loadPart = maxPeriods > 0 ? (agg.periods / maxPeriods) * 100 : 0;
    const uniquePart = ctx.alreadyClassTeacherElsewhere.has(teacherId) ? -80 : 70;
    const continuityPart = teacherOtherSectionsInSameGrade(teacherId, sectionId) >= 1 ? 40 : 0;
    const breadthPart =
      maxSubjects > 0 ? (Math.min(agg.subjects.size, maxSubjects) / maxSubjects) * 35 : (agg.subjects.size > 0 ? 35 : 0);
    const score = loadPart + uniquePart + continuityPart + breadthPart;
    return { teacherId, score };
  }

  type Context = { maxPeriods: number; maxSubjects: number; alreadyClassTeacherElsewhere: Set<number> };

  /** Existing manual class teachers constrain uniqueness scoring for auto rows. */
  const lockedStaff = new Set<number>();
  for (const cg of classGroups) {
    if (nextSource[cg.classGroupId] !== 'manual') continue;
    const raw = nextTeachers[cg.classGroupId] ?? '';
    const tid = raw && String(raw).trim() !== '' ? Number(raw) : NaN;
    if (Number.isFinite(tid)) lockedStaff.add(tid);
  }

  /** Greedy picks in order — sections with fewer candidate teachers first. */
  type Job = {
    cgId: number;
    scores: Map<number, { periods: number; subjects: Set<number> }>;
  };
  const jobs: Job[] = [];
  for (const cg of classGroups) {
    if (cg.gradeLevel == null) continue;
    const cgId = cg.classGroupId;
    if (nextSource[cgId] === 'manual') continue;
    const scores = bySectionTeacher.get(cgId);
    if (!scores || scores.size === 0) {
      jobs.push({ cgId, scores: new Map() });
      continue;
    }
    jobs.push({ cgId, scores: new Map(scores) });
  }

  jobs.sort((a, b) => {
    const ca = a.scores.size;
    const cb = b.scores.size;
    if (ca !== cb) return ca - cb;
    const ga = gradeByCg.get(a.cgId);
    const gb = gradeByCg.get(b.cgId);
    if (Number(ga ?? NaN) !== Number(gb ?? NaN)) return Number(ga ?? 999) - Number(gb ?? 999);
    return a.cgId - b.cgId;
  });

  const alreadyClassTeacherElsewhereGlobal = new Set<number>(lockedStaff);

  let touched = 0;
  let skippedNoEligibleTeacher = 0;

  for (const job of jobs) {
    const { cgId, scores } = job;
    if (scores.size === 0) {
      if (nextTeachers[cgId] && String(nextTeachers[cgId]).trim() !== '') {
        touched += 1;
      }
      nextTeachers[cgId] = '';
      nextSource[cgId] = '';
      skippedNoEligibleTeacher += 1;
      continue;
    }

    let maxPeriods = 0;
    let maxSubjects = 0;
    for (const v of scores.values()) {
      if (v.periods > maxPeriods) maxPeriods = v.periods;
      if (v.subjects.size > maxSubjects) maxSubjects = v.subjects.size;
    }

    const ctx: Context = { maxPeriods, maxSubjects, alreadyClassTeacherElsewhere: alreadyClassTeacherElsewhereGlobal };
    let best: Scored | null = null;
    for (const [tid, agg] of scores) {
      const s = scoreTeacherForSection(cgId, tid, agg, ctx);
      if (best == null || s.score > best.score || (s.score === best.score && tid < best.teacherId)) best = s;
    }
    if (!best) {
      skippedNoEligibleTeacher += 1;
      continue;
    }

    const prev = nextTeachers[cgId] ?? '';
    const nextVal = String(best.teacherId);
    if (prev !== nextVal) touched += 1;
    nextTeachers[cgId] = nextVal;
    nextSource[cgId] = 'auto';

    /** Global uniqueness heuristic: penalize repeating CT when future sections are processed. */
    alreadyClassTeacherElsewhereGlobal.add(best.teacherId);
  }

  const assignedIds: number[] = [];
  for (const cg of classGroups) {
    const raw = nextTeachers[cg.classGroupId] ?? '';
    const tid = raw && String(raw).trim() !== '' ? Number(raw) : NaN;
    if (Number.isFinite(tid)) assignedIds.push(tid);
  }

  const distinct = new Set(assignedIds);
  const assigned = assignedIds.length;
  const uniqueAssignments = distinct.size;
  let sharedAssignments = 0;
  const freq = new Map<number, number>();
  for (const id of assignedIds) freq.set(id, (freq.get(id) ?? 0) + 1);
  for (const c of freq.values()) if (c > 1) sharedAssignments += c - 1;

  return {
    nextTeachers,
    nextSource,
    stats: {
      touched,
      assigned,
      uniqueAssignments,
      sharedAssignments,
      skippedLocked: skippedLockedManual,
      skippedNoEligibleTeacher,
    },
  };
}

/** True when a section has subject teaching load but no class teacher on draft. */
export function sectionMissingClassTeacher(
  cgId: number,
  effectiveRows: AcademicAllocRow[],
  classTeacherDraft: Readonly<Record<number, string | undefined>>,
): boolean {
  const hasTeaching = effectiveRows.some(
    (r) =>
      Number(r.classGroupId) === Number(cgId) && r.staffId != null && Number(r.staffId) > 0 && Number(r.weeklyFrequency) > 0,
  );
  if (!hasTeaching) return false;
  const raw = classTeacherDraft[cgId];
  return !(raw && String(raw).trim() !== '');
}
