import {
  buildEffectiveAllocRows,
  type AcademicAllocRow,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from './academicStructureUtils';
import { shouldBlockSmartAutoAssign } from './teacherDemandAnalysis';

export const DEFAULT_MAX_WEEKLY_LECTURE_LOAD = 32;

export type AssignmentSource = 'auto' | 'manual' | 'rebalanced' | 'conflict';

export type AssignmentSlotMeta = {
  source: AssignmentSource;
  locked: boolean;
  /** Present when source='conflict'. */
  conflictReason?: 'NO_ELIGIBLE_TEACHER' | 'CAPACITY_OVERFLOW' | 'UNKNOWN';
};

export function slotKey(classGroupId: number, subjectId: number) {
  return `${classGroupId}:${subjectId}`;
}

type ClassGroup = {
  classGroupId: number;
  gradeLevel: number | null;
  /** Stable sibling order within a grade (section letter/code). Optional; omission falls back to classGroupId. */
  section?: string | null;
  code?: string | null;
};
type StaffLite = {
  id: number;
  fullName: string;
  teachableSubjectIds: number[];
  roleNames: string[];
  maxWeeklyLectureLoad: number | null;
  preferredClassGroupIds: number[] | null | undefined;
};

const TEACHER = 'TEACHER';

function isStaffTeacher(s: StaffLite) {
  // Constraint: only staff explicitly having TEACHER role can be assigned subjects.
  const r = s.roleNames ?? [];
  return r.includes(TEACHER);
}

export function eligibleForAuto(s: StaffLite, subjectId: number): boolean {
  if (!isStaffTeacher(s)) return false;
  const t = s.teachableSubjectIds ?? [];
  return t.length > 0 && t.includes(subjectId);
}

function effectiveMaxLoad(s: StaffLite, fallbackMaxLoad: number | null | undefined): number {
  if (s.maxWeeklyLectureLoad != null && s.maxWeeklyLectureLoad > 0) return s.maxWeeklyLectureLoad;
  if (fallbackMaxLoad != null && fallbackMaxLoad > 0) return fallbackMaxLoad;
  return DEFAULT_MAX_WEEKLY_LECTURE_LOAD;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function buildLoadAndFragmentation(effective: AcademicAllocRow[], classGroups: ClassGroup[]) {
  const load = new Map<number, number>();
  const grades = new Map<number, Set<number>>();
  const byGSub = new Map<string, number>(); // teacherId -> (grade:subject) count
  const cgToGrade = new Map<number, number>();
  for (const cg of classGroups) {
    if (cg.gradeLevel == null) continue;
    cgToGrade.set(cg.classGroupId, Number(cg.gradeLevel));
  }
  for (const a of effective) {
    if (a.staffId == null) continue;
    const tid = Number(a.staffId);
    load.set(tid, (load.get(tid) ?? 0) + (a.weeklyFrequency > 0 ? a.weeklyFrequency : 0));
    const g = cgToGrade.get(a.classGroupId);
    if (g != null) {
      const set = grades.get(tid) ?? new Set<number>();
      set.add(g);
      grades.set(tid, set);
      const k = `${tid}:${g}:${a.subjectId}`;
      byGSub.set(k, (byGSub.get(k) ?? 0) + 1);
    }
  }
  return { load, grades, byGSub, cgToGrade };
}

function sectionOrderingKey(cg: ClassGroup | undefined): string {
  if (!cg) return '';
  const sec = String(cg.section ?? '').trim();
  return sec || String(cg.code ?? cg.classGroupId);
}

/** Same grade + subject as another section (RULE 5 / cohesion). */
function teacherAlreadyGradeSubject(
  tid: number,
  grade: number,
  subjectId: number,
  effectiveRows: AcademicAllocRow[],
  cgToGrade: Map<number, number>,
): boolean {
  for (const a of effectiveRows) {
    if (a.staffId == null || Number(a.staffId) !== Number(tid) || a.subjectId !== subjectId) continue;
    const g = cgToGrade.get(a.classGroupId);
    if (g != null && Number(g) === Number(grade)) return true;
  }
  return false;
}

/** Min |grade difference| along this subject among current assignments (-1 if none). */
function teacherMinGradeDistanceSameSubject(
  tid: number,
  targetGrade: number,
  subjectId: number,
  effectiveRows: AcademicAllocRow[],
  cgToGrade: Map<number, number>,
): number | null {
  let best: number | null = null;
  for (const a of effectiveRows) {
    if (a.staffId == null || Number(a.staffId) !== Number(tid) || a.subjectId !== subjectId) continue;
    const g = cgToGrade.get(a.classGroupId);
    if (g == null) continue;
    const dist = Math.abs(Number(g) - Number(targetGrade));
    if (best == null || dist < best) best = dist;
  }
  return best;
}

/** Smart-assign teacher scorer (relative weights match product spec for ordering—RULES 2–6). */
function teacherScore(args: {
  teacherId: number;
  baseLoad: number;
  maxLoad: number;
  required: number;
  prefersAny: boolean;
  gradeCount: number;
  /** RULE 5: prefers one teacher across sections in same grade+subject once any row exists */
  continuitySameGradeSubject: boolean;
  /** RULE 6: nearest-grade preference when no continuity (null = unknown / no rows) */
  minGradeDistSameSubject: number | null;
}) {
  const { baseLoad, maxLoad, required, prefersAny, gradeCount, continuitySameGradeSubject, minGradeDistSameSubject } = args;

  const loadRatio = maxLoad > 0 ? baseLoad / maxLoad : 1;
  const afterRatio = maxLoad > 0 ? (baseLoad + required) / maxLoad : 2;
  const overBy = Math.max(0, baseLoad + required - maxLoad);

  let score = 0;

  /** RULE 3 overload disfavor (+ explicit cap handling via sort + fits flag in callers). */
  if (overBy > 0) score -= 200;

  if (continuitySameGradeSubject) score += 100;

  if (!continuitySameGradeSubject && minGradeDistSameSubject != null && minGradeDistSameSubject >= 1) {
    const d = minGradeDistSameSubject;
    score += d === 1 ? 40 : d === 2 ? 22 : Math.max(0, 22 - (d - 2) * 9);
  }

  score += (1 - clamp(loadRatio, 0, 1)) * 60;
  score += prefersAny ? 8 : 0;
  score -= Math.max(0, gradeCount - 1) * 15;

  const nearFullPenalty = afterRatio > 0.92 ? (afterRatio - 0.92) * 45 : 0;
  score -= nearFullPenalty;

  return score;
}

function cloneCfgs(p: ClassSubjectConfigRow[]): ClassSubjectConfigRow[] {
  return p.map((x) => ({ ...x }));
}
function cloneOvs(p: SectionSubjectOverrideRow[]): SectionSubjectOverrideRow[] {
  return p.map((x) => ({ ...x }));
}
function cloneMeta(m: Record<string, AssignmentSlotMeta>): Record<string, AssignmentSlotMeta> {
  const o: Record<string, AssignmentSlotMeta> = {};
  for (const k of Object.keys(m)) o[k] = { ...m[k]! };
  return o;
}

/** Merge teacher-assignment meta updates (teacher lock / source / conflict). */
export function mergeAssignmentSlotMeta(prev: AssignmentSlotMeta | undefined, next: AssignmentSlotMeta): AssignmentSlotMeta {
  return {
    source: next.source ?? prev?.source ?? 'auto',
    locked: next.locked ?? prev?.locked ?? false,
    conflictReason: next.conflictReason ?? prev?.conflictReason,
  };
}

function setTemplateTeacher(
  cfg: ClassSubjectConfigRow[],
  grade: number,
  subjectId: number,
  teacherId: number | null,
) {
  return cfg.map((c) =>
    Number(c.gradeLevel) === grade && Number(c.subjectId) === subjectId
      ? { ...c, defaultTeacherId: teacherId }
      : c,
  );
}

/**
 * Inherit template for every section: clear teacher in overrides (null → merge uses template in buildEffective).
 */
export function applyUniformGradeSubjectTeacher(
  cfg: ClassSubjectConfigRow[],
  ovs: SectionSubjectOverrideRow[],
  classGroups: ClassGroup[],
  grade: number,
  subjectId: number,
  teacherId: number | null,
) {
  const c2 = setTemplateTeacher(cfg, grade, subjectId, teacherId);
  const ids = new Set(
    classGroups.filter((c) => c.gradeLevel != null && Number(c.gradeLevel) === grade).map((c) => c.classGroupId),
  );
  const o2 = ovs.map((o) => {
    if (Number(o.subjectId) !== subjectId || !ids.has(o.classGroupId)) return o;
    return { ...o, teacherId: null as number | null };
  });
  return { cfg: c2, ovs: o2 };
}

/**
 * Update only one section row's teacher in overrides (no sibling uniform/template merge).
 * Used when clearing autos in a bucket so locked/manual rows are not wiped by uniform updates.
 */
export function patchSectionSubjectOverrideTeacher(
  cfg: ClassSubjectConfigRow[],
  ovs: SectionSubjectOverrideRow[],
  classGroupId: number,
  subjectId: number,
  teacherId: number | null,
) {
  const prev = ovs.find((o) => o.classGroupId === classGroupId && o.subjectId === subjectId);
  const without = ovs.filter(
    (o) => !(o.classGroupId === classGroupId && o.subjectId === subjectId),
  );
  return {
    cfg,
    ovs: [
      ...without,
      {
        classGroupId,
        subjectId,
        periodsPerWeek: prev?.periodsPerWeek ?? null,
        teacherId,
        roomId: null,
      },
    ],
  };
}

export function applySectionTeacher(
  cfg: ClassSubjectConfigRow[],
  ovs: SectionSubjectOverrideRow[],
  classGroups: ClassGroup[],
  classGroupId: number,
  subjectId: number,
  teacherId: number,
) {
  const cg = classGroups.find((c) => c.classGroupId === classGroupId);
  const g = cg?.gradeLevel;
  if (g == null) return { cfg, ovs };
  const tpl = cfg.find(
    (c) => Number(c.gradeLevel) === Number(g) && Number(c.subjectId) === subjectId,
  )?.defaultTeacherId;
  if (tpl != null && Number(tpl) === teacherId) {
    return applyUniformGradeSubjectTeacher(cfg, ovs, classGroups, Number(g), subjectId, tpl);
  }
  const c0 = setTemplateTeacher(cfg, Number(g), subjectId, null);
  const key = (cid: number, sid: number) => `${cid}:${sid}`;
  const without = ovs.filter(
    (o) => key(o.classGroupId, o.subjectId) !== key(classGroupId, subjectId),
  );
  const prev = ovs.find(
    (o) => o.classGroupId === classGroupId && o.subjectId === subjectId,
  );
  return {
    cfg: c0,
    ovs: [
      ...without,
      {
        classGroupId,
        subjectId,
        periodsPerWeek: prev?.periodsPerWeek ?? null,
        teacherId,
        roomId: null,
      },
    ],
  };
}

/**
 * `reset` clears non-manual, non-locked auto/rebalanced by nulling the template and override teachers for those slots.
 */
export function runSmartTeacherAssignment(
  classGroups: ClassGroup[],
  staff: StaffLite[],
  subjects: { id: number; weeklyFrequency: number | null; name?: string; code?: string }[],
  classSubjectConfigs: ClassSubjectConfigRow[],
  sectionSubjectOverrides: SectionSubjectOverrideRow[],
  assignmentMeta: Record<string, AssignmentSlotMeta>,
  mode: 'auto' | 'rebalance' | 'reset',
  subjectIdFilter: number | null = null,
  schoolSlotsPerWeek: number | null = null,
  homeroomByClassGroupId: ReadonlyMap<number, number | null> | null | undefined = undefined,
): {
  classSubjectConfigs: ClassSubjectConfigRow[];
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  warnings: string[];
} {
  let cfg = cloneCfgs(classSubjectConfigs);
  let ov = cloneOvs(sectionSubjectOverrides);
  let meta = cloneMeta(assignmentMeta);
  const warnings: string[] = [];
  const subById = new Map<number, { name: string; code: string }>(
    (subjects ?? []).map((s) => [Number(s.id), { name: String(s.name ?? ''), code: String(s.code ?? '') }]),
  );

  const draftEff = buildEffectiveAllocRows(classGroups, cfg, ov, homeroomByClassGroupId ?? undefined);
  if (
    mode === 'auto' &&
    shouldBlockSmartAutoAssign({
      subjects: (subjects ?? []).map((s) => ({
        id: Number(s.id),
        name: String(s.name ?? ''),
        code: String(s.code ?? ''),
      })),
      allocations: draftEff,
      staff,
      slotsPerWeek: schoolSlotsPerWeek ?? null,
    })
  ) {
    warnings.push(
      'Smart auto-assign blocked: severe teacher capacity shortage versus mapped weekly frequencies. Add qualified teachers, raise weekly caps in Staff, reduce section frequencies in Academic Structure, or rebalance assignments — then retry.',
    );
    return {
      classSubjectConfigs: cfg,
      sectionSubjectOverrides: ov,
      assignmentMeta: meta,
      warnings,
    };
  }

  const cgToGrade = new Map<number, number>();
  for (const cg of classGroups) {
    if (cg.gradeLevel == null) continue;
    cgToGrade.set(cg.classGroupId, Number(cg.gradeLevel));
  }

  const eff = (): AcademicAllocRow[] => buildEffectiveAllocRows(classGroups, cfg, ov, homeroomByClassGroupId ?? undefined);

  if (mode === 'reset') {
    /** Teacher-protected slots (keep assignment when clearing autos in same grade×subject bucket). */
    const teacherProtected = (a: AcademicAllocRow) => {
      const mk = meta[slotKey(a.classGroupId, a.subjectId)];
      // If locked but empty, allow clear to manage; lock protects an existing pick.
      if (mk?.locked && a.staffId != null) return true;
      if (mk?.source === 'manual' && a.staffId != null) return true;
      return false;
    };

    const buckets = new Map<string, AcademicAllocRow[]>();
    for (const a of eff()) {
      if (subjectIdFilter != null && a.subjectId !== subjectIdFilter) continue;
      const g = cgToGrade.get(a.classGroupId);
      if (g == null) continue;
      const sk = `${g}:${a.subjectId}`;
      if (!buckets.has(sk)) buckets.set(sk, []);
      buckets.get(sk)!.push(a);
    }

    for (const [, bucket] of buckets) {
      const clearList = bucket.filter((a) => !teacherProtected(a));
      if (clearList.length === 0) continue;

      const grade = cgToGrade.get(bucket[0]!.classGroupId)!;
      const subjectId = bucket[0]!.subjectId;

      // Pin every protected assignment with an explicit section override BEFORE nulling grade template,
      // so uniform-style clearing cannot drop locked/manual teachers on sibling sections.
      for (const p of bucket) {
        if (!teacherProtected(p) || p.staffId == null) continue;
        const rPin = patchSectionSubjectOverrideTeacher(cfg, ov, p.classGroupId, p.subjectId, p.staffId);
        cfg = rPin.cfg;
        ov = rPin.ovs;
      }

      cfg = setTemplateTeacher(cfg, grade, subjectId, null);

      for (const c of clearList) {
        const rClr = patchSectionSubjectOverrideTeacher(cfg, ov, c.classGroupId, c.subjectId, null);
        cfg = rClr.cfg;
        ov = rClr.ovs;

        const k = slotKey(c.classGroupId, c.subjectId);
        const mk = meta[k];
        const lk = mk?.locked ?? false;
        delete meta[k];
        if (lk) {
          meta[k] = mergeAssignmentSlotMeta(undefined, {
            source: 'manual',
            locked: lk,
          });
        }
      }
    }
    return { classSubjectConfigs: cfg, sectionSubjectOverrides: ov, assignmentMeta: meta, warnings };
  }

  const candidatesAll = staff.filter((s) => s.teachableSubjectIds?.length).slice();

  type Demand = { classGroupId: number; grade: number; subjectId: number; periods: number; k: string };
  const byGs = new Map<string, Demand[]>();
  for (const a of eff()) {
    if (subjectIdFilter != null && a.subjectId !== subjectIdFilter) continue;
    const g = classGroups.find((c) => c.classGroupId === a.classGroupId)?.gradeLevel;
    if (g == null) continue;
    const k = slotKey(a.classGroupId, a.subjectId);
    const m = meta[k];
    // If locked but empty, allow auto-assign to fill; lock should protect an existing pick.
    if (m?.locked && a.staffId != null) continue;
    // If user manually set a teacher, keep it. If it's manual-but-empty, allow auto-assign to fill it.
    if (m?.source === 'manual' && a.staffId != null) continue;
    const sk = `${Number(g)}:${a.subjectId}`;
    const d: Demand = {
      classGroupId: a.classGroupId,
      grade: Number(g),
      subjectId: a.subjectId,
      periods: a.weeklyFrequency,
      k,
    };
    if (!byGs.has(sk)) byGs.set(sk, []);
    byGs.get(sk)!.push(d);
  }

  const orderedGs = [...byGs.entries()].sort(([ka], [kb]) => {
    const [ga, sa] = ka.split(':').map(Number);
    const [gb, sb] = kb.split(':').map(Number);
    if (ga !== gb) return ga - gb;
    return sa - sb;
  });

  // Pass 1: best-effort assign grade+subject groups with cohesion + load scoring.
  for (const [, demands] of orderedGs) {
    if (demands.length === 0) continue;
    const subjectId = demands[0]!.subjectId;
    const grade = demands[0]!.grade;
    const cands = candidatesAll.filter((s) => eligibleForAuto(s, subjectId));
    if (cands.length === 0) {
      const sub = subById.get(Number(subjectId));
      const label = sub?.name ? `${sub.name}${sub.code ? ` (${sub.code})` : ''}` : 'Unknown subject';
      warnings.push(
        `No teacher tagged to teach ${label} in Class ${grade}. Add a teacher mapped to this subject (Staff → subjects).${label === 'Unknown subject' ? ' (This subject is missing from the catalog — it may have been deleted.)' : ''}`,
      );
      for (const d of demands) meta[d.k] = mergeAssignmentSlotMeta(meta[d.k], { source: 'conflict', locked: false, conflictReason: 'NO_ELIGIBLE_TEACHER' });
      continue;
    }
    cands.sort((a, b) => a.id - b.id);
    const totalP = demands.reduce((a, d) => a + d.periods, 0);
    if (totalP < 1) continue;

    const snapEff = eff();
    const base = buildLoadAndFragmentation(snapEff, classGroups);
    // remove current demands from base load (we are re-assigning them)
    for (const d of demands) {
      const x = snapEff.find((e) => e.classGroupId === d.classGroupId && e.subjectId === d.subjectId);
      if (x?.staffId != null) {
        base.load.set(Number(x.staffId), (base.load.get(Number(x.staffId)) ?? 0) - d.periods);
      }
    }

    const classGroupIdsInGrade = classGroups
      .filter((c) => c.gradeLevel != null && Number(c.gradeLevel) === grade)
      .map((c) => c.classGroupId);

    const scored = cands
      .map((t) => {
        const baseLoad = base.load.get(t.id) ?? 0;
        const max = effectiveMaxLoad(t, schoolSlotsPerWeek);
        const gradeCount = (base.grades.get(t.id)?.size ?? 0) || 0;
        const prefersAny = (t.preferredClassGroupIds ?? []).some((id) => classGroupIdsInGrade.includes(id));
        const continuity = teacherAlreadyGradeSubject(t.id, grade, subjectId, snapEff, cgToGrade);
        const dist = teacherMinGradeDistanceSameSubject(t.id, grade, subjectId, snapEff, cgToGrade);
        const score = teacherScore({
          teacherId: t.id,
          baseLoad,
          maxLoad: max,
          required: totalP,
          prefersAny,
          gradeCount,
          continuitySameGradeSubject: continuity,
          minGradeDistSameSubject: dist,
        });
        return { t, score, baseLoad, max };
      })
      .sort((a, b) => b.score - a.score || a.t.id - b.t.id);

    // Prefer a single teacher for all sections in this grade+subject when possible.
    const single = scored.find((x) => x.baseLoad + totalP <= x.max) ?? null;
    if (single) {
      const label: AssignmentSource = mode === 'rebalance' ? 'rebalanced' : 'auto';
      // IMPORTANT: Some subjects exist only via section overrides (not in grade template).
      // Using grade-template assignment would clear override teachers and leave rows unassigned.
      // So we apply the same teacher per-section to guarantee assignment.
      for (const d of demands) {
        const r1 = applySectionTeacher(cfg, ov, classGroups, d.classGroupId, d.subjectId, single.t.id);
        cfg = r1.cfg;
        ov = r1.ovs;
        meta[d.k] = mergeAssignmentSlotMeta(meta[d.k], { source: label, locked: false });
      }
      continue;
    }

    // Otherwise, assign section-by-section using per-demand scoring, minimizing fragmentation.
    const localLoad = new Map<number, number>(base.load);
    const label: AssignmentSource = mode === 'rebalance' ? 'rebalanced' : 'auto';
    const sortedDemands = demands.slice().sort((a, b) => {
      const cga = classGroups.find((cg) => cg.classGroupId === a.classGroupId);
      const cgb = classGroups.find((cg) => cg.classGroupId === b.classGroupId);
      const ak = sectionOrderingKey(cga);
      const bk = sectionOrderingKey(cgb);
      const sc = ak.localeCompare(bk, undefined, { numeric: true, sensitivity: 'base' });
      if (sc !== 0) return sc;
      if (b.periods !== a.periods) return b.periods - a.periods;
      return a.classGroupId - b.classGroupId;
    });
    for (const d of sortedDemands) {
      const liveEff = eff();
      const scored2 = cands
        .map((t) => {
          const baseLoad = localLoad.get(t.id) ?? 0;
          const max = effectiveMaxLoad(t, schoolSlotsPerWeek);
          const gradeCount = (base.grades.get(t.id)?.size ?? 0) || 0;
          const prefersAny = (t.preferredClassGroupIds ?? []).includes(d.classGroupId);
          const continuity = teacherAlreadyGradeSubject(t.id, grade, subjectId, liveEff, cgToGrade);
          const dist = teacherMinGradeDistanceSameSubject(t.id, grade, subjectId, liveEff, cgToGrade);
          const score = teacherScore({
            teacherId: t.id,
            baseLoad,
            maxLoad: max,
            required: d.periods,
            prefersAny,
            gradeCount,
            continuitySameGradeSubject: continuity,
            minGradeDistSameSubject: dist,
          });
          const fits = baseLoad + d.periods <= max;
          return { t, score, baseLoad, max, fits };
        })
        .sort((a, b) => {
          // prefer fit; then score
          if (a.fits !== b.fits) return a.fits ? -1 : 1;
          return b.score - a.score || a.t.id - b.t.id;
        });
      const pick = scored2[0]!;
      if (!pick.fits) {
        warnings.push(`Could not fit grade ${grade} subject into capacity; assigned best effort (may overload).`);
        // Keep the assignment source as AUTO/REBALANCED (we still assign a teacher),
        // but attach a conflictReason so UI can flag it without inflating "hard conflicts".
        meta[d.k] = mergeAssignmentSlotMeta(meta[d.k], { source: label, locked: false, conflictReason: 'CAPACITY_OVERFLOW' });
      } else {
        meta[d.k] = mergeAssignmentSlotMeta(meta[d.k], { source: label, locked: false });
      }
      const r1 = applySectionTeacher(cfg, ov, classGroups, d.classGroupId, d.subjectId, pick.t.id);
      cfg = r1.cfg;
      ov = r1.ovs;
      localLoad.set(pick.t.id, (localLoad.get(pick.t.id) ?? 0) + d.periods);
    }
  }

  // Pass 2 (rebalance only): try to move AUTO/REBALANCED rows away from overloaded teachers.
  if (mode === 'rebalance') {
    const effective = eff();
    const base = buildLoadAndFragmentation(effective, classGroups);
    const maxById = new Map<number, number>();
    for (const s of staff) maxById.set(s.id, effectiveMaxLoad(s, schoolSlotsPerWeek));

    const over = [...base.load.entries()].filter(([tid, l]) => l > (maxById.get(tid) ?? 0));
    if (over.length > 0) {
      // Try biggest rows first for each overloaded teacher.
      for (const [tid] of over) {
        const rows = effective
          .filter((r) => Number(r.staffId) === Number(tid))
          .slice()
          .sort((a, b) => b.weeklyFrequency - a.weeklyFrequency);
        for (const r of rows) {
          const k = slotKey(r.classGroupId, r.subjectId);
          const m = meta[k];
          // If locked but empty, allow rebalance to populate; lock should protect an existing pick.
          if (m?.locked && r.staffId != null) continue;
          // Don't rebalance away a manual pick, but allow rebalancing manual-but-empty rows.
          if (m?.source === 'manual' && r.staffId != null) continue;
          // only move non-manual
          const cg = classGroups.find((c) => c.classGroupId === r.classGroupId);
          const grade = cg?.gradeLevel;
          if (grade == null) continue;
          const cands = candidatesAll.filter((s) => eligibleForAuto(s, r.subjectId) && s.id !== tid);
          if (cands.length === 0) continue;
          // pick best candidate that fits after move
          const scored = cands
            .map((t) => {
              const curLoad = base.load.get(t.id) ?? 0;
              const max = effectiveMaxLoad(t, schoolSlotsPerWeek);
              const fits = curLoad + r.weeklyFrequency <= max;
              const gradeCount = (base.grades.get(t.id)?.size ?? 0) || 0;
              const prefersAny = (t.preferredClassGroupIds ?? []).includes(r.classGroupId);
              const continuity = teacherAlreadyGradeSubject(t.id, Number(grade), r.subjectId, effective, cgToGrade);
              const dist = teacherMinGradeDistanceSameSubject(t.id, Number(grade), r.subjectId, effective, cgToGrade);
              const score = teacherScore({
                teacherId: t.id,
                baseLoad: curLoad,
                maxLoad: max,
                required: r.weeklyFrequency,
                prefersAny,
                gradeCount,
                continuitySameGradeSubject: continuity,
                minGradeDistSameSubject: dist,
              });
              return { t, score, fits };
            })
            .sort((a, b) => (a.fits !== b.fits ? (a.fits ? -1 : 1) : b.score - a.score || a.t.id - b.t.id));
          const pick = scored.find((x) => x.fits) ?? null;
          if (!pick) continue;

          // apply move
          const r1 = applySectionTeacher(cfg, ov, classGroups, r.classGroupId, r.subjectId, pick.t.id);
          cfg = r1.cfg;
          ov = r1.ovs;
          meta[k] = mergeAssignmentSlotMeta(meta[k], { source: 'rebalanced', locked: false });
          base.load.set(tid, (base.load.get(tid) ?? 0) - r.weeklyFrequency);
          base.load.set(pick.t.id, (base.load.get(pick.t.id) ?? 0) + r.weeklyFrequency);

          // stop early once teacher no longer overloaded
          if ((base.load.get(tid) ?? 0) <= (maxById.get(tid) ?? 0)) break;
        }
      }
    }
  }

  // Final pass: mark still-unassigned enabled slots with a clear reason.
  // This makes the UI explain why some rows remain pending after an auto-assign attempt.
  for (const a of eff()) {
    if (a.weeklyFrequency <= 0) continue;
    if (subjectIdFilter != null && a.subjectId !== subjectIdFilter) continue;
    const k = slotKey(a.classGroupId, a.subjectId);
    const m = meta[k];
    if (m?.locked && a.staffId != null) continue;
    if (m?.source === 'manual' && a.staffId != null) continue;
    if (a.staffId != null) continue;

    const eligible = candidatesAll.filter((s) => eligibleForAuto(s, a.subjectId));
    if (eligible.length === 0) {
      meta[k] = mergeAssignmentSlotMeta(meta[k], { source: 'conflict', locked: m?.locked ?? false, conflictReason: 'NO_ELIGIBLE_TEACHER' });
    } else {
      // There are eligible teachers but none got assigned (usually due to load constraints).
      // Keep source if present; attach a reason for visibility.
      meta[k] = mergeAssignmentSlotMeta(meta[k], {
        source: (m?.source ?? 'auto') as AssignmentSource,
        locked: m?.locked ?? false,
        conflictReason: 'CAPACITY_OVERFLOW',
      });
    }
  }

  return { classSubjectConfigs: cfg, sectionSubjectOverrides: ov, assignmentMeta: meta, warnings };
}

export function buildTeacherLoadRows(
  effective: AcademicAllocRow[],
  staff: StaffLite[],
  subjects: { id: number; name: string; code: string }[],
  schoolSlotsPerWeek: number | null = null,
) {
  const subBy = new Map(
    subjects.map((s) => [
      s.id,
      `${String(s.code ?? '').trim() || `S${s.id}`} — ${String(s.name ?? '').trim() || `Subject ${s.id}`}`,
    ]),
  );
  const loadBy: Record<number, { n: number; subj: Set<number> }> = {};
  for (const a of effective) {
    if (a.staffId == null) continue;
    if (!loadBy[a.staffId]) loadBy[a.staffId] = { n: 0, subj: new Set() };
    loadBy[a.staffId]!.n += a.weeklyFrequency > 0 ? a.weeklyFrequency : 0;
    loadBy[a.staffId]!.subj.add(a.subjectId);
  }
  return staff
    .filter((s) => isStaffTeacher(s))
    .map((s) => {
      const entry = loadBy[s.id] ?? { n: 0, subj: new Set<number>() };
      const names = [...entry.subj]
        .map((id) => subBy.get(id) ?? `S${id}`)
        .sort()
        .join(', ');
      const max = effectiveMaxLoad(s, schoolSlotsPerWeek);
      const load = entry.n;
      let status: 'healthy' | 'near' | 'over' = 'healthy';
      if (load > max) status = 'over';
      else if (load > max * 0.85) status = 'near';
      return {
        id: s.id,
        name: s.fullName,
        subjectLabels: names || '—',
        load,
        max,
        status,
      };
    });
}
