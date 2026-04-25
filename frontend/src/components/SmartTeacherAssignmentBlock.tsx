import { useMemo, useState } from 'react';
import { SelectKeeper } from './SelectKeeper';
import { toast } from '../lib/toast';
import { buildEffectiveAllocRows, type ClassSubjectConfigRow, type SectionSubjectOverrideRow } from '../lib/academicStructureUtils';
import {
  type AssignmentSource,
  type AssignmentSlotMeta,
  buildTeacherLoadRows,
  runSmartTeacherAssignment,
  slotKey,
  applyUniformGradeSubjectTeacher,
  applySectionTeacher,
} from '../lib/academicStructureSmartAssign';

type StaffRow = {
  id: number;
  fullName: string;
  email: string;
  teachableSubjectIds: number[];
  roleNames: string[];
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[] | null;
};

type ClassG = { classGroupId: number; code: string; displayName: string; gradeLevel: number | null; section: string | null };
type Sub = { id: number; name: string; code: string; weeklyFrequency: number | null };

type Props = {
  classGroups: ClassG[];
  subjects: Sub[];
  staff: StaffRow[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  setClassSubjectConfigs: React.Dispatch<React.SetStateAction<ClassSubjectConfigRow[]>>;
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  setSectionSubjectOverrides: React.Dispatch<React.SetStateAction<SectionSubjectOverrideRow[]>>;
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  setAssignmentMeta: React.Dispatch<React.SetStateAction<Record<string, AssignmentSlotMeta>>>;
  subjectsCatalogForLabels: { id: number; name: string; code: string }[];
  filters?: { grade: string; subject: string; teacher: string };
  showBulkActions?: boolean;
};

export function SmartTeacherAssignmentBlock({
  classGroups,
  subjects,
  staff,
  classSubjectConfigs,
  setClassSubjectConfigs,
  sectionSubjectOverrides,
  setSectionSubjectOverrides,
  assignmentMeta,
  setAssignmentMeta,
  subjectsCatalogForLabels,
  filters,
  showBulkActions = false,
}: Props) {
  const [manualOverrideMode, setManualOverrideMode] = useState(false);
  const [bulkTid, setBulkTid] = useState<string>('');

  const gradeFilter = filters?.grade ?? '';
  const subjFilter = filters?.subject ?? '';
  const teacherFilter = filters?.teacher ?? '';

  const cgs = useMemo(
    () => classGroups.map((c) => ({ classGroupId: c.classGroupId, gradeLevel: c.gradeLevel })),
    [classGroups],
  );

  const effective = useMemo(
    () => buildEffectiveAllocRows(cgs, classSubjectConfigs, sectionSubjectOverrides),
    [cgs, classSubjectConfigs, sectionSubjectOverrides],
  );

  const loadRows = useMemo(() => {
    const rows = buildTeacherLoadRows(
      effective,
      staff,
      subjectsCatalogForLabels.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    );
    if (!teacherFilter) return rows;
    return rows.filter((r) => String(r.id) === teacherFilter);
  }, [effective, staff, subjectsCatalogForLabels, teacherFilter]);

  const flatRows = useMemo(() => {
    const out: { classGroupId: number; subId: number; subName: string; periods: number; staffId: number | null; k: string }[] = [];
    for (const a of effective) {
      if (subjFilter && String(a.subjectId) !== subjFilter) continue;
      if (gradeFilter) {
        const g = classGroups.find((c) => c.classGroupId === a.classGroupId)?.gradeLevel;
        if (g == null || String(g) !== gradeFilter) continue;
      }
      if (teacherFilter && String(a.staffId ?? '') !== teacherFilter) continue;
      const s = subjects.find((x) => x.id === a.subjectId);
      out.push({
        classGroupId: a.classGroupId,
        subId: a.subjectId,
        subName: s ? s.name : `Subject ${a.subjectId}`,
        periods: a.weeklyFrequency,
        staffId: a.staffId,
        k: slotKey(a.classGroupId, a.subjectId),
      });
    }
    return out;
  }, [effective, classGroups, gradeFilter, subjFilter, teacherFilter, subjects]);

  const run = (mode: 'auto' | 'rebalance' | 'reset', subjectOnly: number | null = null) => {
    const r = runSmartTeacherAssignment(
      cgs,
      staff,
      subjects,
      classSubjectConfigs,
      sectionSubjectOverrides,
      assignmentMeta,
      mode,
      subjectOnly,
    );
    setClassSubjectConfigs(r.classSubjectConfigs);
    setSectionSubjectOverrides(r.sectionSubjectOverrides);
    setAssignmentMeta(r.assignmentMeta);
    for (const w of r.warnings) toast.info('Assignment', w);
    if (r.warnings.length === 0 && mode === 'auto') {
      toast.success('Smart assign', 'Teachers applied by skill, grade cohesion, and load.');
    } else if (r.warnings.length === 0 && mode === 'rebalance') {
      toast.success('Rebalanced', 'Non-locked rows were redistributed where possible.');
    } else if (mode === 'reset') {
      toast.info('Reset', 'Auto and rebalanced assignments were cleared. Manual / locked kept.');
    }
  };

  const setTeacherOnSlot = (classGroupId: number, subjectId: number, newId: string) => {
    const lock = manualOverrideMode;
    if (!newId || String(newId).trim() === '') {
      const g = classGroups.find((c) => c.classGroupId === classGroupId)?.gradeLevel;
      if (g == null) return;
      const r = applyUniformGradeSubjectTeacher(
        classSubjectConfigs,
        sectionSubjectOverrides,
        cgs,
        Number(g),
        subjectId,
        null,
      );
      setClassSubjectConfigs(r.cfg);
      setSectionSubjectOverrides(r.ovs);
      setAssignmentMeta((m) => {
        const n = { ...m };
        delete n[slotKey(classGroupId, subjectId)];
        return n;
      });
      toast.info('Cleared for class+subject', 'Removed the default teacher for this subject for the whole class (all sections in this grade).');
      return;
    }
    const id = Number(newId);
    if (!Number.isFinite(id)) return;
    const r = applySectionTeacher(classSubjectConfigs, sectionSubjectOverrides, cgs, classGroupId, subjectId, id);
    setClassSubjectConfigs(r.cfg);
    setSectionSubjectOverrides(r.ovs);
    setAssignmentMeta((m) => ({
      ...m,
      [slotKey(classGroupId, subjectId)]: { source: 'manual' as const, locked: lock },
    }));
  };

  const teachOpts = (subjectId: number) =>
    staff
      .filter(
        (s) =>
          (s.roleNames ?? []).includes('TEACHER') ||
          ((s.roleNames?.length ?? 0) === 0 && (s.teachableSubjectIds?.length ?? 0) > 0),
      )
      .filter((s) => !s.teachableSubjectIds?.length || s.teachableSubjectIds.includes(subjectId))
      .map((s) => ({ value: String(s.id), label: s.fullName || s.email }));

  return (
    <div
      className="stack"
      style={{ gap: 12 }}
    >
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => run('auto', null)} disabled={!classSubjectConfigs.length}>
          Auto assign teachers
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => run('rebalance', null)}
          disabled={!classSubjectConfigs.length}
        >
          Rebalance loads
        </button>
        <button type="button" className="btn secondary" onClick={() => run('reset', null)} disabled={!classSubjectConfigs.length}>
          Reset auto assignments
        </button>
        {subjFilter ? (
          <button type="button" className="btn secondary" onClick={() => run('rebalance', Number(subjFilter) || null)}>
            Rebalance selected subject
          </button>
        ) : null}
        <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          <input type="checkbox" checked={manualOverrideMode} onChange={(e) => setManualOverrideMode(e.target.checked)} />
          Manual override mode (locks edits)
        </label>
        {showBulkActions ? (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <SelectKeeper
              value={bulkTid}
              onChange={setBulkTid}
              options={[
                { value: '', label: 'Bulk: pick teacher' },
                ...staff
                  .filter((s) => (s.roleNames ?? []).includes('TEACHER'))
                  .map((s) => ({ value: String(s.id), label: s.fullName })),
              ]}
            />
            <button
              type="button"
              className="btn secondary"
              disabled={!bulkTid || !gradeFilter || !subjFilter}
              onClick={() => {
                const g = Number(gradeFilter);
                const s = Number(subjFilter);
                const t = Number(bulkTid);
                if (!Number.isFinite(g) || !Number.isFinite(s) || !Number.isFinite(t)) return;
                const r = applyUniformGradeSubjectTeacher(classSubjectConfigs, sectionSubjectOverrides, cgs, g, s, t);
                setClassSubjectConfigs(r.cfg);
                setSectionSubjectOverrides(r.ovs);
                setAssignmentMeta((m) => {
                  const n = { ...m };
                  for (const cg of classGroups) {
                    if (Number(cg.gradeLevel) !== g) continue;
                    n[slotKey(cg.classGroupId, s)] = { source: 'manual' as const, locked: true };
                  }
                  return n;
                });
                toast.success('Bulk', `Teacher applied to all sections in class ${g} for the selected subject.`);
              }}
              title="Apply teacher to all sections in this grade for the selected subject"
            >
              Apply to all sections (grade)
            </button>
          </div>
        ) : null}
      </div>
      <div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Section</th>
                <th>Subject</th>
                <th>Periods / wk</th>
                <th>Assigned teacher</th>
                <th>Source</th>
                <th title="Lock keeps this row out of auto and rebalance">Lock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flatRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 12 }}>
                    No section mappings yet. First click <strong>Configure class</strong> for a grade to enable subjects and set default periods.
                    Then come back and click <strong>Auto assign teachers</strong>.
                  </td>
                </tr>
              ) : (
                flatRows.map((row) => {
                  const m = assignmentMeta[row.k];
                  const src: AssignmentSource | '—' = m?.source ?? '—';
                  const lo = m?.locked ?? false;
                  const label =
                    src === 'auto' ? 'Auto' : src === 'manual' ? 'Manual' : src === 'rebalanced' ? 'Rebalanced' : '—';
                  const sec = classGroups.find((c) => c.classGroupId === row.classGroupId);
                  return (
                    <tr key={row.k}>
                      <td>{sec?.displayName ?? sec?.code}</td>
                      <td style={{ fontWeight: 800 }}>{row.subName}</td>
                      <td>{row.periods}</td>
                      <td style={{ minWidth: 200 }}>
                        <SelectKeeper
                          value={row.staffId != null ? String(row.staffId) : ''}
                          onChange={(v) => setTeacherOnSlot(row.classGroupId, row.subId, v)}
                          options={teachOpts(row.subId)}
                        />
                      </td>
                      <td title="Auto-assigned based on subject skill + balanced workload.">{label}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={lo}
                          onChange={(e) => {
                            const locked = e.target.checked;
                            setAssignmentMeta((prev) => ({
                              ...prev,
                              [row.k]: { source: m?.source ?? 'manual', locked },
                            }));
                          }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ fontSize: 12, padding: '2px 8px' }}
                          onClick={() => setTeacherOnSlot(row.classGroupId, row.subId, '')}
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TeacherLoadDashboard({
  classGroups,
  subjects,
  staff,
  classSubjectConfigs,
  sectionSubjectOverrides,
  filters,
  subjectsCatalogForLabels,
}: {
  classGroups: ClassG[];
  subjects: Sub[];
  staff: StaffRow[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  filters?: { grade: string; subject: string; teacher: string };
  subjectsCatalogForLabels: { id: number; name: string; code: string }[];
}) {
  const cgs = useMemo(
    () => classGroups.map((c) => ({ classGroupId: c.classGroupId, gradeLevel: c.gradeLevel })),
    [classGroups],
  );
  const effective = useMemo(
    () => buildEffectiveAllocRows(cgs, classSubjectConfigs, sectionSubjectOverrides),
    [cgs, classSubjectConfigs, sectionSubjectOverrides],
  );
  const anyAssigned = useMemo(() => effective.some((e) => e.staffId != null), [effective]);
  const teacherFilter = filters?.teacher ?? '';

  const rows = useMemo(() => {
    const base = buildTeacherLoadRows(
      effective,
      staff,
      subjectsCatalogForLabels.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    );
    return teacherFilter ? base.filter((r) => String(r.id) === teacherFilter) : base;
  }, [effective, staff, subjectsCatalogForLabels, teacherFilter]);

  if (!classSubjectConfigs.length) {
    return <div className="muted">No load data yet. First configure a class template.</div>;
  }
  if (!anyAssigned) {
    return <div className="muted">No assignments yet. Click <strong>Auto assign teachers</strong> to generate teacher loads.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Subjects</th>
            <th>Load</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const color = r.status === 'over' ? '#b91c1c' : r.status === 'near' ? '#c2410c' : '#166534';
            const label = r.status === 'over' ? 'Overloaded' : r.status === 'near' ? 'Near limit' : 'Healthy';
            return (
              <tr key={r.id}>
                <td style={{ fontWeight: 800 }}>{r.name}</td>
                <td>{r.subjectLabels}</td>
                <td>
                  {r.load} / {r.max}
                </td>
                <td style={{ color, fontWeight: 800 }}>{label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
