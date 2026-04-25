import {
  buildEffectiveAllocRows,
  type AcademicAllocRow,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from './academicStructureUtils';

export const DEFAULT_MAX_WEEKLY_LECTURE_LOAD = 32;

export type AssignmentSource = 'auto' | 'manual' | 'rebalanced';

export type AssignmentSlotMeta = {
  source: AssignmentSource;
  locked: boolean;
};

export function slotKey(classGroupId: number, subjectId: number) {
  return `${classGroupId}:${subjectId}`;
}

type ClassGroup = { classGroupId: number; gradeLevel: number | null };
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
  const r = s.roleNames ?? [];
  if (r.includes(TEACHER)) return true;
  if (r.length === 0 && (s.teachableSubjectIds?.length ?? 0) > 0) return true;
  return false;
}

export function eligibleForAuto(s: StaffLite, subjectId: number): boolean {
  if (!isStaffTeacher(s)) return false;
  const t = s.teachableSubjectIds ?? [];
  return t.length > 0 && t.includes(subjectId);
}

function effectiveMaxLoad(s: StaffLite): number {
  return s.maxWeeklyLectureLoad != null && s.maxWeeklyLectureLoad > 0
    ? s.maxWeeklyLectureLoad
    : DEFAULT_MAX_WEEKLY_LECTURE_LOAD;
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
        roomId: prev?.roomId ?? null,
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
  _subjects: { id: number; weeklyFrequency: number | null }[],
  classSubjectConfigs: ClassSubjectConfigRow[],
  sectionSubjectOverrides: SectionSubjectOverrideRow[],
  assignmentMeta: Record<string, AssignmentSlotMeta>,
  mode: 'auto' | 'rebalance' | 'reset',
  subjectIdFilter: number | null = null,
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

  const eff = (): AcademicAllocRow[] =>
    buildEffectiveAllocRows(classGroups, cfg, ov);

  if (mode === 'reset') {
    for (const a of eff()) {
      const k = slotKey(a.classGroupId, a.subjectId);
      const m = meta[k];
      if (m?.locked) continue;
      if (m?.source === 'manual') continue;
      const g = classGroups.find((c) => c.classGroupId === a.classGroupId)?.gradeLevel;
      if (g == null) continue;
      const r = applyUniformGradeSubjectTeacher(cfg, ov, classGroups, Number(g), a.subjectId, null);
      cfg = r.cfg;
      ov = r.ovs;
      delete meta[k];
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
    if (m?.locked) continue;
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

  for (const [, demands] of byGs) {
    if (demands.length === 0) continue;
    const subjectId = demands[0]!.subjectId;
    const grade = demands[0]!.grade;
    const cands = candidatesAll.filter((s) => eligibleForAuto(s, subjectId));
    if (cands.length === 0) {
      warnings.push(
        `No teacher tagged to teach the subject in grade ${grade}. Add a staff member with that subject in “can teach”.`,
      );
      continue;
    }
    cands.sort((a, b) => a.id - b.id);
    const totalP = demands.reduce((a, d) => a + d.periods, 0);
    if (totalP < 1) continue;

    // Baseline load from the rest of the timetable (keeps other subjects’ assignments).
    const load = new Map<number, number>();
    for (const x of eff()) {
      if (x.staffId == null) continue;
      load.set(x.staffId, (load.get(x.staffId) ?? 0) + (x.weeklyFrequency > 0 ? x.weeklyFrequency : 0));
    }
    for (const d of demands) {
      const x = eff().find((e) => e.classGroupId === d.classGroupId && e.subjectId === d.subjectId);
      if (x?.staffId) {
        load.set(x.staffId, (load.get(x.staffId) ?? 0) - d.periods);
      }
    }

    const prefW = (t: StaffLite, cgid: number) =>
      (t.preferredClassGroupIds ?? []).includes(cgid) ? 0.5 : 0;
    const sortByLoad = (a: StaffLite, b: StaffLite) => {
      const la = (load.get(a.id) ?? 0) - prefW(a, demands[0]!.classGroupId);
      const lb = (load.get(b.id) ?? 0) - prefW(b, demands[0]!.classGroupId);
      if (la !== lb) return la - lb;
      return a.id - b.id;
    };
    cands.sort(sortByLoad);

    let one: StaffLite | null = null;
    for (const c of cands) {
      if ((load.get(c.id) ?? 0) + totalP <= effectiveMaxLoad(c)) {
        one = c;
        break;
      }
    }

    if (one) {
      const r = applyUniformGradeSubjectTeacher(cfg, ov, classGroups, grade, subjectId, one.id);
      cfg = r.cfg;
      ov = r.ovs;
      const label: AssignmentSource = mode === 'rebalance' ? 'rebalanced' : 'auto';
      for (const d of demands) meta[d.k] = { source: label, locked: false };
    } else {
      const r0 = applyUniformGradeSubjectTeacher(cfg, ov, classGroups, grade, subjectId, null);
      cfg = r0.cfg;
      ov = r0.ovs;
      for (const d of demands) {
        const pool = cands
          .slice()
          .sort(
            (a, b) =>
              (load.get(a.id) ?? 0) - prefW(a, d.classGroupId) - ((load.get(b.id) ?? 0) - prefW(b, d.classGroupId)),
          );
        const pick = pool[0]!;
        if ((load.get(pick.id) ?? 0) + d.periods > effectiveMaxLoad(pick)) {
          warnings.push(
            `Load cap may be exceeded for ${pick.fullName} after assigning a split section in grade ${grade}.`,
          );
        }
        const r1 = applySectionTeacher(cfg, ov, classGroups, d.classGroupId, d.subjectId, pick.id);
        cfg = r1.cfg;
        ov = r1.ovs;
        load.set(pick.id, (load.get(pick.id) ?? 0) + d.periods);
        const label: AssignmentSource = mode === 'rebalance' ? 'rebalanced' : 'auto';
        meta[d.k] = { source: label, locked: false };
      }
    }
  }

  return { classSubjectConfigs: cfg, sectionSubjectOverrides: ov, assignmentMeta: meta, warnings };
}

export function buildTeacherLoadRows(
  effective: AcademicAllocRow[],
  staff: StaffLite[],
  subjects: { id: number; name: string; code: string }[],
) {
  const subBy = new Map(subjects.map((s) => [s.id, s.name]));
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
      const max = effectiveMaxLoad(s);
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
