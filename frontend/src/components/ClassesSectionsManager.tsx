import { memo, useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { SelectKeeper } from './SelectKeeper';
import { toast } from '../lib/toast';

type StaffLite = { id: number; fullName: string; email?: string | null };
type SectionRow = {
  id: number;
  code: string;
  displayName: string;
  gradeLevel: number | null;
  section: string | null;
  classTeacherStaffId: number | null;
  classTeacherDisplayName: string | null;
  studentCount: number;
};

type OverrideState = {
  override: boolean;
  teacherId: number | null;
};

type SpringPage<T> = { content: T[] };
function pageContent<T>(data: SpringPage<T> | T[] | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.content) ? data.content : [];
}

function sum(nums: number[]) {
  let s = 0;
  for (const n of nums) s += Number.isFinite(n) ? n : 0;
  return s;
}

export const ClassesSectionsManager = memo(function ClassesSectionsManager() {
  const qc = useQueryClient();
  const [overrides, setOverrides] = useState<Record<number, OverrideState>>({});
  const [classDefaultTeacherByGrade, setClassDefaultTeacherByGrade] = useState<Record<number, number | null>>({});
  const [expandedGrades, setExpandedGrades] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  const [overrideFilter, setOverrideFilter] = useState<'all' | 'overrides' | 'defaults'>('all');
  const [missingTeacherOnly, setMissingTeacherOnly] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const sections = useQuery({
    queryKey: ['class-groups-sections-summary'],
    queryFn: async () => (await api.get<SectionRow[]>('/api/class-groups/sections-summary')).data,
  });

  const staff = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get<SpringPage<StaffLite> | StaffLite[]>('/api/staff?size=500')).data,
  });

  const staffOptions = useMemo(
    () =>
      pageContent(staff.data)
        .slice()
        .sort((a, b) => String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')))
        .map((s) => ({ value: String(s.id), label: s.fullName || s.email || `Staff #${s.id}` })),
    [staff.data],
  );

  const byGrade = useMemo(() => {
    const rows = (sections.data ?? []).slice();
    rows.sort((a, b) => {
      const ga = a.gradeLevel ?? 999;
      const gb = b.gradeLevel ?? 999;
      if (ga !== gb) return ga - gb;
      return String(a.section ?? '').localeCompare(String(b.section ?? ''));
    });
    const m = new Map<number, SectionRow[]>();
    for (const r of rows) {
      if (typeof r.gradeLevel !== 'number') continue;
      m.set(r.gradeLevel, [...(m.get(r.gradeLevel) ?? []), r]);
    }
    return m;
  }, [sections.data]);

  const searchNorm = search.trim().toLowerCase();
  const filteredByGrade = useMemo(() => {
    const next = new Map<number, SectionRow[]>();
    for (const [grade, rows] of byGrade.entries()) {
      const filtered = rows.filter((r) => {
        const ov = overrides[r.id];
        const overrideOn = Boolean(ov?.override);
        const effectiveTeacherId = overrideOn ? (ov?.teacherId ?? null) : (classDefaultTeacherByGrade[grade] ?? null);
        const missing = effectiveTeacherId == null;
        if (overrideFilter === 'overrides' && !overrideOn) return false;
        if (overrideFilter === 'defaults' && overrideOn) return false;
        if (missingTeacherOnly && !missing) return false;

        if (!searchNorm) return true;
        const hay = [
          `grade ${grade}`,
          String(r.code ?? ''),
          String(r.displayName ?? ''),
          String(r.section ?? ''),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(searchNorm);
      });
      if (filtered.length) next.set(grade, filtered);
    }
    return next;
  }, [byGrade, overrides, overrideFilter, missingTeacherOnly, searchNorm, classDefaultTeacherByGrade]);

  const batchAssign = useMutation({
    mutationFn: async (items: { classGroupId: number; staffId: number | null }[]) => {
      await api.post('/api/class-groups/class-teachers/batch', { items });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['class-groups-sections-summary'] });
      await qc.invalidateQueries({ queryKey: ['class-groups'] });
      toast.success('Saved', 'Teacher assignments updated.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const resolveEffectiveTeacher = useCallback(
    (grade: number, s: SectionRow) => {
      const ov = overrides[s.id];
      if (ov?.override) return ov.teacherId;
      const d = classDefaultTeacherByGrade[grade];
      return d ?? null;
    },
    [overrides, classDefaultTeacherByGrade],
  );

  const persistDefaultTeacherForGrade = useCallback(
    (grade: number, teacherId: number | null) => {
      const rows = byGrade.get(grade) ?? [];
      const items = rows
        .filter((r) => !Boolean(overrides[r.id]?.override))
        .map((r) => ({ classGroupId: r.id, staffId: teacherId }));
      if (items.length === 0) return;
      batchAssign.mutate(items);
    },
    [byGrade, overrides, batchAssign],
  );

  const setClassTeacher = useCallback(
    (grade: number, teacherId: number | null) => {
      setClassDefaultTeacherByGrade((p) => ({ ...p, [grade]: teacherId }));
      setOverrides((prev) => {
        // When class teacher changes, sections without override follow automatically.
        return prev;
      });
      // Persist change for all sections that are not overridden.
      persistDefaultTeacherForGrade(grade, teacherId);
    },
    [persistDefaultTeacherForGrade],
  );

  const applyToAllSections = useCallback(
    (grade: number) => {
      const teacherId = classDefaultTeacherByGrade[grade] ?? null;
      if (!teacherId) {
        toast.error('Missing class teacher', 'Pick a class teacher first.');
        return;
      }
      const rows = byGrade.get(grade) ?? [];
      setOverrides((p) => {
        const next = { ...p };
        for (const r of rows) next[r.id] = { override: false, teacherId: null };
        return next;
      });
      // Persist: set all sections' teacher to the chosen default.
      batchAssign.mutate(rows.map((r) => ({ classGroupId: r.id, staffId: teacherId })));
    },
    [classDefaultTeacherByGrade, byGrade, batchAssign],
  );

  const resetOverrides = useCallback(
    (grade: number) => {
      const teacherId = classDefaultTeacherByGrade[grade] ?? null;
      const rows = byGrade.get(grade) ?? [];
      setOverrides((p) => {
        const next = { ...p };
        for (const r of rows) next[r.id] = { override: false, teacherId: null };
        return next;
      });
      if (!teacherId) {
        toast.info('Reset', 'Overrides cleared. Pick a class teacher to apply.');
        return;
      }
      batchAssign.mutate(rows.map((r) => ({ classGroupId: r.id, staffId: teacherId })));
    },
    [classDefaultTeacherByGrade, byGrade, batchAssign],
  );

  const persistSectionOverride = useCallback(
    (sectionId: number, teacherId: number | null) => {
      batchAssign.mutate([{ classGroupId: sectionId, staffId: teacherId }]);
    },
    [batchAssign],
  );

  // Initialize defaults from server the first time we load.
  useMemo(() => {
    if (!sections.data || sections.data.length === 0) return;
    setClassDefaultTeacherByGrade((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<number, number | null> = {};
      for (const [grade, rows] of byGrade.entries()) {
        // Choose the most common current teacher as the "default" for this grade.
        const freq = new Map<number, number>();
        for (const r of rows) {
          if (!r.classTeacherStaffId) continue;
          freq.set(r.classTeacherStaffId, (freq.get(r.classTeacherStaffId) ?? 0) + 1);
        }
        let best: number | null = null;
        let bestC = 0;
        for (const [tid, c] of freq.entries()) {
          if (c > bestC) {
            best = tid;
            bestC = c;
          }
        }
        next[grade] = best;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.data]);

  if (sections.isLoading) return <div className="muted">Loading classes &amp; sections…</div>;
  if (sections.isError) return <div style={{ color: '#b91c1c' }}>{formatApiError(sections.error)}</div>;
  if (!sections.data?.length) return <div className="muted">No sections found yet. Generate classes above to see them here.</div>;

  const autoExpand = Boolean(searchNorm) || overrideFilter !== 'all' || missingTeacherOnly;

  return (
    <div className="stack" style={{ gap: 12, marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontWeight: 900 }}>Manage class teachers (Class → Sections)</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn secondary" onClick={() => setPreviewOpen(true)}>
            Preview structure
          </button>
          <div className="muted" style={{ fontSize: 12 }}>
            {sections.data.length} section(s)
          </div>
        </div>
      </div>

      <div className="card row" style={{ gap: 10 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search grade / section / code…"
          style={{ flex: '1 1 260px' }}
        />
        <div className="stack" style={{ minWidth: 220 }}>
          <SelectKeeper
            value={overrideFilter}
            onChange={(v) => setOverrideFilter(((v || 'all') as 'all' | 'overrides' | 'defaults') ?? 'all')}
            options={[
              { value: 'all', label: 'All rows' },
              { value: 'overrides', label: 'Overrides only' },
              { value: 'defaults', label: 'Defaults only' },
            ]}
          />
        </div>
        <label className="row" style={{ gap: 8, alignItems: 'center', fontWeight: 900, fontSize: 13 }}>
          <input
            className="sms-checkbox"
            type="checkbox"
            checked={missingTeacherOnly}
            onChange={(e) => setMissingTeacherOnly(e.target.checked)}
          />
          Missing teacher only
        </label>
        {(searchNorm || overrideFilter !== 'all' || missingTeacherOnly) && (
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setSearch('');
              setOverrideFilter('all');
              setMissingTeacherOnly(false);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {Array.from(filteredByGrade.entries()).map(([grade, rows]) => {
        const total = sum(rows.map((r) => r.studentCount ?? 0));
        const defaultTeacherId = classDefaultTeacherByGrade[grade] ?? null;
        const isOpen = expandedGrades[grade] ?? autoExpand;

        return (
          <div
            key={grade}
            className="card stack"
            style={{ gap: 10, padding: 12 }}
          >
            <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '8px 10px', borderRadius: 12 }}
                  onClick={() =>
                    setExpandedGrades((p) => ({
                      ...p,
                      [grade]: !(p[grade] ?? autoExpand),
                    }))
                  }
                >
                  {isOpen ? 'Hide' : 'Show'}
                </button>
                <span style={{ fontWeight: 950, marginLeft: 10 }}>Grade {grade}</span>
                <div className="muted" style={{ fontSize: 12 }}>
                  Students: <strong>{total}</strong> · Sections: {rows.length}
                </div>
              </div>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="stack" style={{ minWidth: 260 }}>
                  <label style={{ fontSize: 11 }}>Class teacher (default)</label>
                  <SelectKeeper
                    value={defaultTeacherId ? String(defaultTeacherId) : ''}
                    onChange={(v) => setClassTeacher(grade, v ? Number(v) : null)}
                    options={staffOptions}
                    emptyValueLabel="No class teacher"
                  />
                </div>
                <button type="button" className="btn secondary" onClick={() => applyToAllSections(grade)}>
                  Apply to all sections
                </button>
                <button type="button" className="btn secondary" onClick={() => resetOverrides(grade)}>
                  Reset overrides
                </button>
              </div>
            </div>

            {isOpen ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Students</th>
                      <th>Override</th>
                      <th>Teacher</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const ov = overrides[r.id];
                      const overrideOn = Boolean(ov?.override);
                      const effectiveTeacherId = resolveEffectiveTeacher(grade, r);
                      const teacherLabel = staffOptions.find((o) => Number(o.value) === (effectiveTeacherId ?? -1))?.label;
                      const missingOverrideTeacher = overrideOn && !ov?.teacherId;

                      return (
                        <tr
                          key={r.id}
                          style={overrideOn ? { background: 'rgba(245, 158, 11, 0.08)' } : { background: 'transparent' }}
                        >
                          <td style={{ fontWeight: 800 }}>
                            <div>{r.section ? `Section ${r.section}` : r.code}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {r.code}
                            </div>
                          </td>
                          <td>
                            <span className={r.studentCount === 0 ? 'muted' : undefined} style={{ fontWeight: 900 }}>
                              {r.studentCount}
                            </span>
                          </td>
                          <td>
                            <label className="row" style={{ gap: 10, alignItems: 'center', fontWeight: 900 }}>
                              <input
                                className="sms-checkbox"
                                type="checkbox"
                                checked={overrideOn}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setOverrides((p) => ({
                                    ...p,
                                    [r.id]: {
                                      override: on,
                                      teacherId: on ? (p[r.id]?.teacherId ?? null) : null,
                                    },
                                  }));
                                  if (!on) {
                                    // fallback to class teacher: persist section teacher == class default
                                    const d = classDefaultTeacherByGrade[grade] ?? null;
                                    if (d) persistSectionOverride(r.id, d);
                                    else persistSectionOverride(r.id, null);
                                  }
                                }}
                              />
                              {overrideOn ? (
                                <span style={{ fontSize: 12, fontWeight: 950 }}>Override</span>
                              ) : (
                                <span className="muted" style={{ fontSize: 12 }}>
                                  Default
                                </span>
                              )}
                            </label>
                          </td>
                          <td style={{ minWidth: 260 }}>
                            <SelectKeeper
                              value={overrideOn ? String(ov?.teacherId ?? '') : effectiveTeacherId ? String(effectiveTeacherId) : ''}
                              onChange={(v) => {
                                const tid = v ? Number(v) : null;
                                setOverrides((p) => ({ ...p, [r.id]: { override: true, teacherId: tid } }));
                                persistSectionOverride(r.id, tid);
                              }}
                              options={staffOptions}
                              emptyValueLabel={overrideOn ? 'Select teacher…' : 'Using default'}
                              disabled={!overrideOn}
                            />
                            {!overrideOn ? (
                              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                                <span title={teacherLabel ? `Using default teacher: ${teacherLabel}` : 'Using default teacher'}>
                                  Using default{teacherLabel ? ` (${teacherLabel})` : ''}
                                </span>
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {missingOverrideTeacher ? (
                              <span style={{ fontSize: 12, fontWeight: 950, color: '#b91c1c' }}>Pick a teacher</span>
                            ) : overrideOn ? (
                              <span style={{ fontSize: 12, fontWeight: 950, color: '#a16207' }}>Override</span>
                            ) : (
                              <span className="muted" style={{ fontSize: 12, fontWeight: 900 }}>Default</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                Hidden · Click <strong>Show</strong> to manage sections
              </div>
            )}

            {batchAssign.isPending ? <div className="muted" style={{ fontSize: 12 }}>Saving…</div> : null}
          </div>
        );
      })}

      {previewOpen ? (
        <div
          className="sms-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPreviewOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 32000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-label="Classes and sections preview"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 920, width: '100%', maxHeight: '88vh', overflow: 'auto' }}
          >
            <div className="row" style={{ justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: '1.1rem' }}>Classes &amp; sections — preview</div>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.45 }}>
                  Read-only view of every grade and section, student counts, and the effective class teacher.
                </p>
              </div>
              <button type="button" className="btn" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>
            {Array.from(byGrade.entries()).map(([grade, rows]) => {
              const total = sum(rows.map((r) => r.studentCount ?? 0));
              return (
                <div key={grade} className="stack" style={{ gap: 8, marginTop: 14 }}>
                  <div style={{ fontWeight: 900 }}>Grade {grade}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Students: <strong>{total}</strong> · Sections: {rows.length}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th>Code</th>
                          <th>Students</th>
                          <th>Class teacher (effective)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const eff = resolveEffectiveTeacher(grade, r);
                          const label = staffOptions.find((o) => Number(o.value) === (eff ?? -1))?.label;
                          return (
                            <tr key={r.id}>
                              <td style={{ fontWeight: 800 }}>{r.section ? `Section ${r.section}` : r.displayName}</td>
                              <td className="muted">{r.code}</td>
                              <td>
                                <span className={r.studentCount === 0 ? 'muted' : undefined} style={{ fontWeight: 800 }}>
                                  {r.studentCount}
                                </span>
                              </td>
                              <td>{label ?? (eff ? `Staff #${eff}` : '—')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
});

