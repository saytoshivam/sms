import { useCallback, useMemo, useState } from 'react';
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
  // Keep aligned with smart-assign heuristics: optional fields still treated as "unset" (null) for TS.
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[] | null;
};

type ClassG = { classGroupId: number; code: string; displayName: string; gradeLevel: number | null; section: string | null };
type Sub = { id: number; name: string; code: string; weeklyFrequency: number | null };

type Props = {
  classGroups: ClassG[];
  subjects: Sub[];
  staff: StaffRow[];
  roomOptions: { value: string; label: string }[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  setClassSubjectConfigs: React.Dispatch<React.SetStateAction<ClassSubjectConfigRow[]>>;
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  setSectionSubjectOverrides: React.Dispatch<React.SetStateAction<SectionSubjectOverrideRow[]>>;
  assignmentMeta: Record<string, AssignmentSlotMeta>;
  setAssignmentMeta: React.Dispatch<React.SetStateAction<Record<string, AssignmentSlotMeta>>>;
  subjectsCatalogForLabels: { id: number; name: string; code: string }[];
  filters?: { grade: string; subject: string; teacher: string };
  showBulkActions?: boolean;
  autoAssignHomerooms?: () => void;
  /**
   * When a teacher doesn't have `maxWeeklyLectureLoad` set, this is used as the fallback
   * teacher capacity for load checks / KPI (instead of hardcoded 32).
   */
  slotsPerWeek?: number | null;
};

export function SmartTeacherAssignmentBlock({
  classGroups,
  subjects,
  staff,
  roomOptions,
  classSubjectConfigs,
  setClassSubjectConfigs,
  sectionSubjectOverrides,
  setSectionSubjectOverrides,
  assignmentMeta,
  setAssignmentMeta,
  subjectsCatalogForLabels: _subjectsCatalogForLabels,
  filters,
  showBulkActions = false,
  autoAssignHomerooms,
  slotsPerWeek,
}: Props) {
  const [manualOverrideMode, setManualOverrideMode] = useState(false);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [bulkTid, setBulkTid] = useState<string>('');
  const [bulkRoomId, setBulkRoomId] = useState<string>('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [onlyLocked, setOnlyLocked] = useState(false);
  const [onlyOverloaded, setOnlyOverloaded] = useState(false);
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [sectionSearch, setSectionSearch] = useState('');

  const gradeFilter = filters?.grade ?? '';
  const subjFilter = filters?.subject ?? '';
  const teacherFilter = filters?.teacher ?? '';

  const staffById = useMemo(() => {
    const m = new Map<number, StaffRow>();
    for (const s of staff) m.set(Number(s.id), s);
    return m;
  }, [staff]);

  const teacherCanTeach = useCallback(
    (teacherId: number, subjectId: number) => {
      const t = staffById.get(Number(teacherId));
      if (!t) return false;
      const roles = t.roleNames ?? [];
      const isTeacher = roles.includes('TEACHER') || (roles.length === 0 && (t.teachableSubjectIds?.length ?? 0) > 0);
      if (!isTeacher) return false;
      const teachables = t.teachableSubjectIds ?? [];
      if (teachables.length === 0) return true;
      return teachables.includes(Number(subjectId));
    },
    [staffById],
  );

  const cgs = useMemo(
    () => classGroups.map((c) => ({ classGroupId: c.classGroupId, gradeLevel: c.gradeLevel })),
    [classGroups],
  );

  const effective = useMemo(
    () => buildEffectiveAllocRows(cgs, classSubjectConfigs, sectionSubjectOverrides),
    [cgs, classSubjectConfigs, sectionSubjectOverrides],
  );

  const staffNorm = useMemo(
    () =>
      staff.map((s) => ({
        ...s,
        maxWeeklyLectureLoad: s.maxWeeklyLectureLoad ?? null,
        preferredClassGroupIds: s.preferredClassGroupIds ?? null,
      })),
    [staff],
  );

  const loadRows = useMemo(() => {
    const base = buildTeacherLoadRows(
      effective,
      staffNorm,
      subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      slotsPerWeek ?? null,
    );
    return base;
  }, [effective, staffNorm, subjects, slotsPerWeek]);

  const teacherLoadById = useMemo(() => {
    const m = new Map<number, { load: number; max: number; status: 'healthy' | 'near' | 'over' }>();
    for (const r of loadRows) m.set(Number(r.id), { load: r.load, max: r.max, status: r.status });
    return m;
  }, [loadRows]);

  const subjectCodeById = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of subjects) m.set(Number(s.id), String(s.code ?? '').trim());
    return m;
  }, [subjects]);

  const flatRows = useMemo(() => {
    const out: {
      classGroupId: number;
      subId: number;
      subName: string;
      periods: number;
      staffId: number | null;
      roomId: number | null;
      k: string;
    }[] = [];
    for (const a of effective) {
      if (subjFilter && String(a.subjectId) !== subjFilter) continue;
      if (gradeFilter) {
        const g = classGroups.find((c) => c.classGroupId === a.classGroupId)?.gradeLevel;
        if (g == null || String(g) !== gradeFilter) continue;
      }
      if (teacherFilter) {
        const tid = Number(teacherFilter);
        // Filter should be useful for planning: show rows already assigned to this teacher,
        // plus unassigned rows that this teacher is eligible to teach.
        const matchesAssigned = String(a.staffId ?? '') === teacherFilter;
        const matchesEligibleUnassigned = a.staffId == null && Number.isFinite(tid) && teacherCanTeach(tid, a.subjectId);
        if (!matchesAssigned && !matchesEligibleUnassigned) continue;
      }
      const s = subjects.find((x) => x.id === a.subjectId);
      // If the subject catalog is empty or doesn't contain this subjectId anymore (e.g. after bulk delete),
      // hide the row instead of showing "Subject 11".
      if (!s) continue;
      out.push({
        classGroupId: a.classGroupId,
        subId: a.subjectId,
        subName: s.name,
        periods: a.weeklyFrequency,
        staffId: a.staffId,
        roomId: (a as any).roomId ?? null,
        k: slotKey(a.classGroupId, a.subjectId),
      });
    }
    const q = sectionSearch.trim().toLowerCase();
    return out.filter((r) => {
      const m = assignmentMeta[r.k];
      const locked = m?.locked ?? false;
      const isUnassigned = r.staffId == null;
      if (onlyUnassigned && !isUnassigned) return false;
      if (onlyLocked && !locked) return false;
      if (
        onlyConflicts &&
        !(
          m?.source === 'conflict' ||
          m?.conflictReason === 'NO_ELIGIBLE_TEACHER' ||
          m?.conflictReason === 'UNKNOWN'
        )
      )
        return false;
      if (onlyOverloaded) {
        const tl = r.staffId != null ? teacherLoadById.get(Number(r.staffId)) : null;
        if (!tl || tl.status !== 'over') return false;
      }
      if (q) {
        const sec = classGroups.find((c) => c.classGroupId === r.classGroupId);
        const label = `${sec?.displayName ?? ''} ${sec?.code ?? ''} ${sec?.section ?? ''}`.toLowerCase();
        if (!label.includes(q)) return false;
      }
      return true;
    });
  }, [
    effective,
    classGroups,
    gradeFilter,
    subjFilter,
    teacherFilter,
    subjects,
    teacherCanTeach,
    assignmentMeta,
    onlyUnassigned,
    onlyLocked,
    onlyConflicts,
    onlyOverloaded,
    sectionSearch,
    teacherLoadById,
  ]);

  const kpis = useMemo(() => {
    const total = flatRows.length;
    const assigned = flatRows.filter((r) => r.staffId != null).length;
    const pending = total - assigned;
    const conflicts = flatRows.filter((r) => {
      const m = assignmentMeta[r.k];
      return (
        m?.source === 'conflict' ||
        m?.conflictReason === 'NO_ELIGIBLE_TEACHER' ||
        m?.conflictReason === 'UNKNOWN'
      );
    }).length;
    const teacherIdsInView = new Set<number>();
    for (const r of flatRows) {
      if (r.staffId != null) teacherIdsInView.add(Number(r.staffId));
    }
    // KPI should reflect current filter scope (especially when a teacher is selected).
    const overloadedTeachers = Array.from(teacherIdsInView).filter((id) => teacherLoadById.get(id)?.status === 'over').length;
    return { total, assigned, pending, conflicts, overloadedTeachers };
  }, [flatRows, assignmentMeta, teacherLoadById]);

  const preferredRoomTypeBySubjectId = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const s of subjects) {
      m.set(Number(s.id), detectPreferredRoom(s.name, s.code));
    }
    return m;
  }, [subjects]);

  const needsAttention = useMemo(() => {
    const needs: typeof flatRows = [];
    const healthy: typeof flatRows = [];
    for (const r of flatRows) {
      const m = assignmentMeta[r.k];
      const locked = m?.locked ?? false;
      const src = m?.source ?? null;
      const teacherOver = r.staffId != null ? teacherLoadById.get(Number(r.staffId))?.status === 'over' : false;

      const pref = preferredRoomTypeBySubjectId.get(Number(r.subId)) ?? null;
      // roomId null means "homeroom" in our UI. Treat it as "needs attention" only when the subject strongly prefers a lab-like room.
      const noRoomForPreferred = pref != null && r.roomId == null;

      // Only treat as "missing teacher" when this slot actually has periods.
      // period=0 means the subject is disabled for this section.
      const missingTeacher = r.staffId == null && (r.periods ?? 0) > 0;
      const conflict =
        src === 'conflict' || m?.conflictReason === 'NO_ELIGIBLE_TEACHER' || m?.conflictReason === 'UNKNOWN';

      const isNeeds =
        missingTeacher ||
        teacherOver ||
        noRoomForPreferred ||
        conflict ||
        (locked && (missingTeacher || teacherOver || noRoomForPreferred || conflict));

      if (isNeeds) needs.push(r);
      else healthy.push(r);
    }
    return { needs, healthy };
  }, [flatRows, assignmentMeta, teacherLoadById, preferredRoomTypeBySubjectId]);

  const missingTeacherReport = useMemo(() => {
    const byKey = new Map<
      string,
      {
        subjectId: number;
        subjectName: string;
        subjectCode: string;
        grade: number | null;
        sections: string[];
        reasons: Set<NonNullable<AssignmentSlotMeta['conflictReason']>>;
      }
    >();
    for (const r of needsAttention.needs) {
      if (r.staffId != null) continue;
      if ((r.periods ?? 0) <= 0) continue;
      const cg = classGroups.find((c) => Number(c.classGroupId) === Number(r.classGroupId));
      const grade = cg?.gradeLevel ?? null;
      const sectionLabel = cg?.section ? String(cg.section) : String(cg?.displayName || cg?.code || r.classGroupId);
      const code = subjectCodeById.get(Number(r.subId)) ?? '';
      const key = `${Number(r.subId)}:${grade ?? ''}`;
      const cur = byKey.get(key) ?? {
        subjectId: r.subId,
        subjectName: r.subName,
        subjectCode: code,
        grade,
        sections: [],
        reasons: new Set<NonNullable<AssignmentSlotMeta['conflictReason']>>(),
      };
      cur.sections.push(sectionLabel);
      const m = assignmentMeta[r.k];
      if (m?.conflictReason) cur.reasons.add(m.conflictReason);
      byKey.set(key, cur);
    }
    const rows = [...byKey.values()].map((x) => ({
      ...x,
      sections: Array.from(new Set(x.sections)).sort((a, b) => a.localeCompare(b)),
    }));
    rows.sort((a, b) => {
      const ga = a.grade ?? 999;
      const gb = b.grade ?? 999;
      if (ga !== gb) return ga - gb;
      return `${a.subjectName} ${a.subjectCode}`.localeCompare(`${b.subjectName} ${b.subjectCode}`);
    });
    return rows;
  }, [needsAttention.needs, classGroups, subjectCodeById, assignmentMeta]);

  const groupRows = useCallback(
    (rows: typeof flatRows) => {
      const byCg = new Map<number, ClassG>(classGroups.map((c) => [Number(c.classGroupId), c]));
      const byGrade = new Map<number, Map<number, { cg: ClassG; rows: typeof flatRows }>>();
      for (const r of rows) {
        const cg = byCg.get(Number(r.classGroupId));
        const grade = cg?.gradeLevel != null ? Number(cg.gradeLevel) : NaN;
        if (!Number.isFinite(grade) || !cg) continue;
        const gMap = byGrade.get(grade) ?? new Map<number, { cg: ClassG; rows: typeof flatRows }>();
        const sec = gMap.get(Number(cg.classGroupId)) ?? { cg, rows: [] as any };
        (sec.rows as any).push(r);
        gMap.set(Number(cg.classGroupId), sec as any);
        byGrade.set(grade, gMap);
      }
      const grades = [...byGrade.entries()].sort((a, b) => a[0] - b[0]);
      return grades.map(([grade, secMap]) => {
        const secs = [...secMap.values()].sort((a, b) => String(a.cg.section ?? a.cg.code).localeCompare(String(b.cg.section ?? b.cg.code)));
        const totalRows = secs.reduce((a, s) => a + (s.rows as any).length, 0);
        return { grade, sections: secs as any[], totalRows };
      });
    },
    [classGroups],
  );

  const groupedNeeds = useMemo(() => groupRows(needsAttention.needs), [groupRows, needsAttention.needs]);
  const groupedHealthy = useMemo(() => groupRows(needsAttention.healthy), [groupRows, needsAttention.healthy]);

  // IMPORTANT: avoid page-level horizontal scrolling.
  // Use flexible columns that can shrink to the viewport (minmax(0, ...)),
  // and rely on ellipsis within cells rather than fixed min widths.
  const rowGridCols = 'minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 0.85fr) minmax(0, 0.8fr) minmax(0, 0.65fr) minmax(0, 0.6fr)';

  const renderRow = (row: (typeof flatRows)[number]) => {
    const m = assignmentMeta[row.k];
    const src: AssignmentSource | '—' = m?.source ?? '—';
    const lo = m?.locked ?? false;
    const tl = row.staffId != null ? teacherLoadById.get(Number(row.staffId)) : null;
    const load = tl?.load ?? 0;
    const max = tl?.max ?? 0;
    const ratio = max > 0 ? load / max : 0;
    const barColor = ratio > 1 ? '#b91c1c' : ratio > 0.85 ? '#c2410c' : '#16a34a';

    const statusLabel =
      src === 'auto'
        ? 'AUTO'
        : src === 'manual'
          ? 'MANUAL'
          : src === 'rebalanced'
            ? 'REBALANCED'
            : src === 'conflict'
              ? 'CONFLICT'
              : '—';

    const conflictReasonLabel =
      src !== 'conflict'
        ? null
        : m?.conflictReason === 'NO_ELIGIBLE_TEACHER'
          ? 'No eligible teacher'
          : m?.conflictReason === 'CAPACITY_OVERFLOW'
            ? 'Teacher overloaded'
            : 'Needs review';

    const roomValue = row.roomId != null ? String(row.roomId) : '';

    return (
      <div
        key={row.k}
        style={{
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.9)',
          padding: 10,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: rowGridCols,
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.subName}
            </div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              {row.periods} / wk
            </div>
          </div>

          <div>
            <SelectKeeper value={row.staffId != null ? String(row.staffId) : ''} onChange={(v) => setTeacherOnSlot(row.classGroupId, row.subId, v)} options={teachOpts(row.subId)} />
          </div>

          <div>
            {row.staffId != null && tl ? (
              <div>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(140, Math.round((load / Math.max(1, max)) * 100))}%`, height: '100%', background: barColor }} />
                </div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 900, marginTop: 4 }}>
                  {load}/{max}{ratio > 1 ? ` · Overloaded +${Math.max(0, load - max)}` : ''}
                </div>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>—</div>
            )}
          </div>

          <div>
            <SelectKeeper value={roomValue} onChange={(v) => setRoomOnSlot(row.classGroupId, row.subId, v)} options={roomOptions} />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                flex: '0 0 auto',
                background:
                  statusLabel === 'AUTO'
                    ? 'rgba(249,115,22,0.12)'
                    : statusLabel === 'MANUAL'
                      ? 'rgba(37,99,235,0.12)'
                      : statusLabel === 'REBALANCED'
                        ? 'rgba(22,163,74,0.12)'
                        : statusLabel === 'CONFLICT'
                          ? 'rgba(220,38,38,0.10)'
                          : 'rgba(100,116,139,0.10)',
                color:
                  statusLabel === 'AUTO'
                    ? '#c2410c'
                    : statusLabel === 'MANUAL'
                      ? '#1d4ed8'
                      : statusLabel === 'REBALANCED'
                        ? '#166534'
                        : statusLabel === 'CONFLICT'
                          ? '#b91c1c'
                          : '#64748b',
              }}
              title={conflictReasonLabel ?? undefined}
            >
              {lo ? 'LOCKED' : statusLabel}
            </span>
            {conflictReasonLabel ? (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  background: 'rgba(220,38,38,0.10)',
                  color: '#b91c1c',
                  flex: '0 0 auto',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {conflictReasonLabel}
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0, overflow: 'hidden' }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  const locked = !lo;
                  setAssignmentMeta((prev) => ({
                    ...prev,
                    [row.k]: { source: m?.source ?? 'manual', locked, conflictReason: m?.conflictReason },
                  }));
                }}
                title={lo ? 'Unlock' : 'Lock'}
                style={{
                  appearance: 'none',
                  border: '1px solid rgba(15,23,42,0.14)',
                  background: lo ? 'rgba(249,115,22,0.14)' : 'rgba(100,116,139,0.10)',
                  color: lo ? '#c2410c' : '#475569',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 950,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto',
                }}
              >
                {lo ? 'Locked' : 'Lock'}
              </button>

              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}
                onClick={() => setTeacherOnSlot(row.classGroupId, row.subId, '')}
                title="Clear teacher"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGrouped = (
    groups: { grade: number; sections: Array<{ cg: ClassG; rows: typeof flatRows }>; totalRows: number }[],
    defaultOpen: boolean,
  ) => {
    return (
      <div className="stack" style={{ gap: 10 }}>
        {groups.map((g) => (
          <details
            key={g.grade}
            open={defaultOpen}
            style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, background: 'rgba(255,255,255,0.75)' }}
          >
            <summary
              className="row"
              style={{ cursor: 'pointer', padding: '10px 12px', listStyle: 'none', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ fontWeight: 950 }}>{`Grade ${g.grade}`}</div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                {g.sections.length} section{g.sections.length === 1 ? '' : 's'} · {g.totalRows} row{g.totalRows === 1 ? '' : 's'}
              </div>
            </summary>
            <div className="stack" style={{ gap: 10, padding: 12, paddingTop: 0 }}>
              {g.sections.map(({ cg, rows }) => (
                <details
                  key={cg.classGroupId}
                  open={defaultOpen}
                  style={{ border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, background: 'rgba(255,255,255,0.9)' }}
                >
                  <summary
                    className="row"
                    style={{ cursor: 'pointer', padding: '10px 12px', listStyle: 'none', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ fontWeight: 900 }}>{cg.displayName || cg.code}</div>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                      {rows.length} subject{rows.length === 1 ? '' : 's'}
                    </div>
                  </summary>
                  <div style={{ width: '100%', overflowX: 'hidden' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: rowGridCols,
                        gap: 10,
                        padding: '10px 10px 0 10px',
                        fontSize: 12,
                        fontWeight: 950,
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <div>Subject</div>
                      <div>Assigned teacher</div>
                      <div>Teacher load</div>
                      <div>Room</div>
                      <div>Source</div>
                      <div style={{ textAlign: 'right' }}>Lock · Actions</div>
                    </div>
                    <div className="stack" style={{ gap: 8, padding: 10 }}>
                      {rows.map(renderRow)}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    );
  };

  const run = (mode: 'auto' | 'rebalance' | 'reset', subjectOnly: number | null = null) => {
    const r = runSmartTeacherAssignment(
      cgs,
      staffNorm,
      subjects,
      classSubjectConfigs,
      sectionSubjectOverrides,
      assignmentMeta,
      mode,
      subjectOnly,
      slotsPerWeek ?? null,
    );
    setClassSubjectConfigs(r.classSubjectConfigs);
    setSectionSubjectOverrides(r.sectionSubjectOverrides);
    setAssignmentMeta(r.assignmentMeta);
    if (r.warnings.length) {
      const uniq = Array.from(new Set(r.warnings.map((w) => String(w).trim()).filter(Boolean)));
      const teacherMissing: string[] = [];
      const other: string[] = [];
      for (const w of uniq) {
        const m = w.match(/^No teacher tagged to teach (.+?) in Class (\d+)\./i);
        if (m) {
          const subj = String(m[1] ?? '').trim();
          const g = String(m[2] ?? '').trim();
          teacherMissing.push(`${subj} — Class ${g}`);
        } else {
          other.push(w);
        }
      }

      const parts: string[] = [];
      if (teacherMissing.length) {
        parts.push(
          `Missing teacher mappings: ${teacherMissing.length} row(s). Open Insights for the detailed report.`,
        );
      }
      if (other.length) {
        const head = other.slice(0, 2);
        const more = other.length - head.length;
        parts.push(`${head.join(' · ')}${more > 0 ? ` (+${more} more)` : ''}`);
      }
      toast.info('Assignment', parts.join(' | '));
    }
    if (r.warnings.length === 0 && mode === 'auto') {
      toast.success('Smart assign', 'Teachers applied by skill, grade cohesion, and load.');
    } else if (r.warnings.length === 0 && mode === 'rebalance') {
      toast.success('Rebalanced', 'Non-locked rows were redistributed where possible.');
    } else if (mode === 'reset') {
      toast.info('Reset', 'Auto and rebalanced assignments were cleared. Manual / locked kept.');
    }
  };

  function detectPreferredRoom(subjectName: string, subjectCode: string) {
    const s = `${subjectName} ${subjectCode}`.toLowerCase();
    if (s.includes('physics') || s.includes('chemistry') || s.includes('biology') || s.includes('science')) return 'LAB';
    if (s.includes('computer') || s.includes('informatics') || s.includes('it ') || s.includes('csc') || s.includes('ip ')) return 'COMPUTER';
    if (s.includes('music')) return 'MUSIC';
    return null;
  }

  function pickRoomForSubject(subjectName: string, subjectCode: string) {
    const pref = detectPreferredRoom(subjectName, subjectCode);
    // roomOptions only contains labels; best-effort match by label keywords.
    if (pref === 'LAB') {
      const lab = roomOptions.find((r) => r.value && /lab/i.test(r.label));
      if (lab) return lab.value;
    }
    if (pref === 'COMPUTER') {
      const comp = roomOptions.find((r) => r.value && /(computer|cs)\b/i.test(r.label));
      if (comp) return comp.value;
      const lab = roomOptions.find((r) => r.value && /lab/i.test(r.label));
      if (lab) return lab.value;
    }
    if (pref === 'MUSIC') {
      const mus = roomOptions.find((r) => r.value && /music/i.test(r.label));
      if (mus) return mus.value;
    }
    // default: use homeroom (null / empty selection)
    return '';
  }

  const autoAssignRooms = () => {
    const targets = flatRows.filter((r) => {
      const m = assignmentMeta[r.k];
      if (m?.locked) return false;
      if (m?.source === 'manual') return false;
      // only fill missing room
      return r.roomId == null;
    });
    if (!targets.length) {
      toast.info('Rooms', 'No rows need a room assignment.');
      return;
    }
    setSectionSubjectOverrides((prev) => {
      const next = prev.slice();
      const idxByKey = new Map<string, number>();
      for (let i = 0; i < next.length; i++) idxByKey.set(`${next[i]!.classGroupId}:${next[i]!.subjectId}`, i);
      for (const t of targets) {
        const sub = subjects.find((s) => s.id === t.subId);
        if (!sub) continue;
        const picked = pickRoomForSubject(sub.name, sub.code);
        const rid = picked && picked.trim() !== '' ? Number(picked) : null;
        const key = `${t.classGroupId}:${t.subId}`;
        const idx = idxByKey.get(key);
        if (idx != null) {
          next[idx] = { ...next[idx]!, roomId: rid };
        } else {
          next.push({ classGroupId: t.classGroupId, subjectId: t.subId, periodsPerWeek: null, teacherId: null, roomId: rid });
        }
      }
      return next;
    });
    toast.success('Rooms', 'Room suggestions applied (labs where possible, otherwise homeroom).');
  };

  const fixAllPossibleIssues = () => {
    // Best-effort: fill teachers -> rebalance -> fill rooms.
    run('auto', null);
    run('rebalance', null);
    autoAssignRooms();
    toast.success('Fix all', 'Applied best-effort fixes. Remaining rows (if any) need manual decisions.');
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

  const setRoomOnSlot = (classGroupId: number, subjectId: number, newId: string) => {
    const lock = manualOverrideMode;
    const rid = newId && String(newId).trim() !== '' ? Number(newId) : null;
    if (newId && rid != null && !Number.isFinite(rid)) return;

    setSectionSubjectOverrides((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((r) => Number(r.classGroupId) === Number(classGroupId) && Number(r.subjectId) === Number(subjectId));
      if (idx >= 0) {
        next[idx] = { ...next[idx], roomId: rid };
        return next;
      }
      // Create a minimal override row (inherit periods/teacher unless explicitly overridden elsewhere).
      next.push({ classGroupId, subjectId, periodsPerWeek: null, teacherId: null, roomId: rid });
      return next;
    });

    setAssignmentMeta((m) => ({
      ...m,
      [slotKey(classGroupId, subjectId)]: { source: 'manual' as const, locked: lock },
    }));
  };

  const teachOpts = (subjectId: number) =>
    staffNorm
      .filter((s) => {
        // Align with other onboarding screens: treat TEACHER role as teacher,
        // and also allow legacy rows where roles are empty but teachables are set.
        const roles = s.roleNames ?? [];
        const teachables = s.teachableSubjectIds ?? [];
        const isTeacher = roles.includes('TEACHER') || (roles.length === 0 && teachables.length > 0);
        if (!isTeacher) return false;
        // IMPORTANT: empty teachables means "can teach none" (must be explicitly tagged).
        if (teachables.length === 0) return false;
        return teachables.includes(subjectId);
      })
      .map((s) => ({ value: String(s.id), label: s.fullName || s.email }))
      .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', flex: '1 1 auto' }}>
          <div className="card" style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', background: 'rgba(255,255,255,0.75)' }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Total rows</div>
            <div style={{ fontSize: 18, fontWeight: 950 }}>{kpis.total}</div>
          </div>
          <div className="card" style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', background: 'rgba(255,255,255,0.75)' }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Assigned</div>
            <div style={{ fontSize: 18, fontWeight: 950, color: '#166534' }}>{kpis.assigned}</div>
          </div>
          <div className="card" style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', background: 'rgba(255,255,255,0.75)' }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Pending</div>
            <div style={{ fontSize: 18, fontWeight: 950, color: kpis.pending ? '#b91c1c' : '#166534' }}>{kpis.pending}</div>
          </div>
          <div className="card" style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', background: 'rgba(255,255,255,0.75)' }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Overloaded</div>
            <div style={{ fontSize: 18, fontWeight: 950, color: kpis.overloadedTeachers ? '#c2410c' : '#166534' }}>{kpis.overloadedTeachers}</div>
          </div>
          <div className="card" style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', background: 'rgba(255,255,255,0.75)' }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Conflicts</div>
            <div style={{ fontSize: 18, fontWeight: 950, color: kpis.conflicts ? '#b91c1c' : '#166534' }}>{kpis.conflicts}</div>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: 0, zIndex: 5, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)' }}>
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
          Clear Auto Assigned Rows
        </button>
        <button type="button" className="btn secondary" onClick={autoAssignRooms} disabled={!classSubjectConfigs.length}>
          Auto assign rooms
        </button>
        {autoAssignHomerooms ? (
          <button type="button" className="btn secondary" onClick={autoAssignHomerooms}>
            Auto assign homerooms
          </button>
        ) : null}
        <button type="button" className="btn" onClick={fixAllPossibleIssues} disabled={!classSubjectConfigs.length}>
          Fix all possible issues
        </button>
        {subjFilter ? (
          <button type="button" className="btn secondary" onClick={() => run('rebalance', Number(subjFilter) || null)}>
            Rebalance selected subject
          </button>
        ) : null}
        <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          <input type="checkbox" checked={manualOverrideMode} onChange={(e) => setManualOverrideMode(e.target.checked)} />
          Manual Edit Mode (locks edits)
        </label>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
            Only unassigned
          </label>
          <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyLocked} onChange={(e) => setOnlyLocked(e.target.checked)} />
            Only locked
          </label>
          <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyOverloaded} onChange={(e) => setOnlyOverloaded(e.target.checked)} />
            Only overloaded
          </label>
          <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} />
            Only conflicts
          </label>
          <input
            value={sectionSearch}
            onChange={(e) => setSectionSearch(e.target.value)}
            placeholder="Search section…"
            style={{ width: 220 }}
          />
        </div>
        {showBulkActions ? (
          <button type="button" className="btn secondary" onClick={() => setBulkDrawerOpen(true)}>
            Bulk actions
          </button>
        ) : null}
        <button type="button" className="btn secondary" onClick={() => setInsightsOpen(true)} style={{ marginLeft: 'auto' }}>
          Insights ▸
        </button>
      </div>

      <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 100%', minWidth: 320 }}>
          {flatRows.length === 0 ? (
            <div className="muted" style={{ padding: 12 }}>
              No section mappings yet. First click <strong>Configure class</strong> for a grade to enable subjects and set default periods.
              Then come back and click <strong>Auto assign teachers</strong>.
            </div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 950 }}>{`Needs attention (${needsAttention.needs.length} row${needsAttention.needs.length === 1 ? '' : 's'})`}</div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                    Showing: missing teacher · overload · preferred room missing · conflicts · locked conflicts
                  </div>
                </div>
                {needsAttention.needs.length === 0 ? (
                  <div className="muted">No issues found in the current filters.</div>
                ) : (
                  renderGrouped(groupedNeeds, true)
                )}
              </div>

              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 950 }}>Healthy assignments</div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Collapsed by default</div>
                </div>
                {needsAttention.healthy.length === 0 ? (
                  <div className="muted">No healthy rows for current filters.</div>
                ) : (
                  renderGrouped(groupedHealthy, false)
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {insightsOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.35)',
            zIndex: 55,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setInsightsOpen(false)}
        >
          <div
            style={{ width: 'min(520px, 92vw)', height: '100%', background: 'white', padding: 14, overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Insights</div>
              <button type="button" className="btn secondary" onClick={() => setInsightsOpen(false)}>
                Close
              </button>
            </div>

            <div className="stack" style={{ gap: 12, marginTop: 12 }}>
              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div style={{ fontWeight: 950 }}>Recommendations</div>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {kpis.pending > 0 ? (
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <div>⚠ {kpis.pending} rows missing teacher</div>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => {
                          setOnlyUnassigned(true);
                          setOnlyConflicts(false);
                          setOnlyOverloaded(false);
                          setSectionSearch('');
                          setInsightsOpen(false);
                        }}
                      >
                        View
                      </button>
                    </div>
                  ) : (
                    <div>• All rows have a teacher</div>
                  )}
                  {missingTeacherReport.length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 950, marginBottom: 6 }}>
                        Missing teacher mappings for
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>Subject</th>
                              <th>Code</th>
                              <th>Class</th>
                              <th>Sections</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingTeacherReport.slice(0, 12).map((r) => (
                              <tr key={`${r.subjectId}:${r.grade ?? ''}`}>
                                <td style={{ fontWeight: 900 }}>{r.subjectName}</td>
                                <td className="muted" style={{ fontWeight: 900 }}>{r.subjectCode || '—'}</td>
                                <td>{r.grade != null ? `Class ${r.grade}` : '—'}</td>
                                <td title={r.sections.join(', ')}>
                                  {r.sections.length <= 3 ? r.sections.join(', ') : `${r.sections.slice(0, 3).join(', ')} (+${r.sections.length - 3} more)`}
                                </td>
                                <td className="muted">
                                  {r.reasons.has('NO_ELIGIBLE_TEACHER')
                                    ? 'No eligible teacher'
                                    : r.reasons.has('UNKNOWN')
                                      ? 'Unknown subject'
                                      : r.reasons.has('CAPACITY_OVERFLOW')
                                        ? 'Capacity overflow'
                                        : 'Unassigned'}
                                </td>
                              </tr>
                            ))}
                            {missingTeacherReport.length > 12 ? (
                              <tr>
                                <td colSpan={4} className="muted" style={{ padding: 10 }}>
                                  Showing top 12. Use <strong>View</strong> to open the full list in the grid.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {kpis.overloadedTeachers > 0 ? (
                    <div>
                      • {kpis.overloadedTeachers} teacher(s) overloaded — try <strong>Rebalance loads</strong>
                      <div style={{ marginTop: 4 }}>
                        {loadRows
                          .filter((r) => r.status === 'over')
                          .slice(0, 8)
                          .map((r) => (
                            <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                              <div>
                                ⚠ {r.name} overloaded by {Math.max(0, r.load - r.max)}
                                {r.subjectLabels && r.subjectLabels !== '—' ? (
                                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                    Subjects: {r.subjectLabels}
                                  </div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="btn secondary"
                                style={{ fontSize: 12, padding: '2px 8px' }}
                                onClick={() => {
                                  setOnlyOverloaded(true);
                                  setInsightsOpen(false);
                                }}
                              >
                                Fix now
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div>• No overloaded teachers</div>
                  )}

                  {kpis.conflicts > 0 ? (
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <div>⚠ {kpis.conflicts} conflicts</div>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => {
                          setOnlyConflicts(true);
                          setOnlyUnassigned(false);
                          setInsightsOpen(false);
                        }}
                      >
                        Open
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="stack card" style={{ gap: 10, padding: 12, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 12 }}>
                <div style={{ fontWeight: 950 }}>Teacher load</div>
                <div className="stack" style={{ gap: 8 }}>
                  {loadRows
                    .slice()
                    .sort((a, b) => b.load - a.load)
                    .map((r) => {
                      const ratio = r.max > 0 ? r.load / r.max : 0;
                      const barColor = ratio > 1 ? '#b91c1c' : ratio > 0.85 ? '#c2410c' : '#16a34a';
                      return (
                        <div key={r.id}>
                          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.name}
                            </div>
                            <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                              {r.load}/{r.max}
                            </div>
                          </div>
                          <div style={{ height: 8, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden', marginTop: 4 }}>
                            <div style={{ width: `${Math.min(140, Math.round((r.load / Math.max(1, r.max)) * 100))}%`, height: '100%', background: barColor }} />
                          </div>
                          {r.status === 'over' ? (
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c', marginTop: 4 }}>
                              Overloaded +{Math.max(0, r.load - r.max)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDrawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.35)',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ width: 'min(520px, 92vw)', height: '100%', background: 'white', padding: 14, overflow: 'auto' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Bulk actions</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Scope uses current filters: {gradeFilter ? `Class ${gradeFilter}` : 'All grades'} {subjFilter ? `· Subject ${subjFilter}` : ''}
                </div>
              </div>
              <button type="button" className="btn secondary" onClick={() => setBulkDrawerOpen(false)}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 12 }} className="stack">
              <div className="sms-alert sms-alert--info">
                <div>
                  <div className="sms-alert__title">Preview</div>
                  <div className="sms-alert__msg">
                    This will affect <strong>{flatRows.length}</strong> row(s) in the current view.
                  </div>
                </div>
              </div>

              <div className="stack">
                <label style={{ fontSize: 12, fontWeight: 900 }}>Teacher (grade+subject)</label>
            <SelectKeeper
              value={bulkTid}
              onChange={setBulkTid}
              options={[
                    { value: '', label: 'Select teacher…' },
                    ...staff.filter((s) => (s.roleNames ?? []).includes('TEACHER')).map((s) => ({ value: String(s.id), label: s.fullName || s.email })),
              ]}
            />
            <button
              type="button"
                  className="btn"
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
            >
                  Apply teacher
            </button>
          </div>

              <div className="stack">
                <label style={{ fontSize: 12, fontWeight: 900 }}>Room (grade+subject)</label>
                        <SelectKeeper
                  value={bulkRoomId}
                  onChange={setBulkRoomId}
                  options={[
                    { value: '', label: '🏠 Homeroom' },
                    ...roomOptions.filter((r) => r.value !== ''),
                  ]}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!gradeFilter || !subjFilter}
                  onClick={() => {
                    const g = Number(gradeFilter);
                    const s = Number(subjFilter);
                    if (!Number.isFinite(g) || !Number.isFinite(s)) return;
                    const rid = bulkRoomId && bulkRoomId.trim() !== '' ? Number(bulkRoomId) : null;
                    if (bulkRoomId && bulkRoomId.trim() !== '' && !Number.isFinite(rid)) return;
                    const inGrade = classGroups.filter((cg) => Number(cg.gradeLevel) === g).map((cg) => cg.classGroupId);
                    setSectionSubjectOverrides((prev) => {
                      const next = prev.slice();
                      const idxByKey = new Map<string, number>();
                      for (let i = 0; i < next.length; i++) idxByKey.set(`${next[i]!.classGroupId}:${next[i]!.subjectId}`, i);
                      for (const cid of inGrade) {
                        const key = `${cid}:${s}`;
                        const idx = idxByKey.get(key);
                        if (idx != null) next[idx] = { ...next[idx]!, roomId: rid };
                        else next.push({ classGroupId: cid, subjectId: s, periodsPerWeek: null, teacherId: null, roomId: rid });
                      }
                      return next;
                    });
                    toast.success('Bulk', `Room applied to all sections in class ${g} for the selected subject.`);
                  }}
                >
                  Apply room
                </button>
              </div>

              <div className="stack">
                <label style={{ fontSize: 12, fontWeight: 900 }}>Lock</label>
                        <button
                          type="button"
                          className="btn secondary"
                  disabled={!gradeFilter}
                  onClick={() => {
                    const g = Number(gradeFilter);
                    if (!Number.isFinite(g)) return;
                    const inGrade = classGroups.filter((cg) => Number(cg.gradeLevel) === g).map((cg) => cg.classGroupId);
                    setAssignmentMeta((m) => {
                      const n = { ...m };
                      for (const row of flatRows) {
                        if (!inGrade.includes(row.classGroupId)) continue;
                        const cur = n[row.k];
                        n[row.k] = { source: cur?.source ?? 'manual', locked: true, conflictReason: cur?.conflictReason };
                      }
                      return n;
                    });
                    toast.success('Bulk', `Locked all rows in class ${g}.`);
                  }}
                >
                  Lock grade
                        </button>
        </div>
      </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TeacherLoadDashboard({
  classGroups,
  staff,
  classSubjectConfigs,
  sectionSubjectOverrides,
  filters,
  subjectsCatalogForLabels,
  slotsPerWeek,
}: {
  classGroups: ClassG[];
  staff: StaffRow[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  filters?: { grade: string; subject: string; teacher: string };
  subjectsCatalogForLabels: { id: number; name: string; code: string }[];
  slotsPerWeek?: number | null;
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

  const staffNorm = useMemo(
    () =>
      staff.map((s) => ({
        ...s,
        maxWeeklyLectureLoad: s.maxWeeklyLectureLoad ?? null,
        preferredClassGroupIds: s.preferredClassGroupIds ?? null,
      })),
    [staff],
  );

  const rows = useMemo(() => {
    const base = buildTeacherLoadRows(
      effective,
      staffNorm,
      subjectsCatalogForLabels.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      slotsPerWeek ?? null,
    );
    return teacherFilter ? base.filter((r) => String(r.id) === teacherFilter) : base;
  }, [effective, staffNorm, subjectsCatalogForLabels, teacherFilter, slotsPerWeek]);

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
