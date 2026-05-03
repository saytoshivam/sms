import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { pageContent } from '../../lib/springPageContent';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import { RowActionsMenu } from '../RowActionsMenu';
import { ConfirmDialog } from '../ConfirmDialog';
import { SmartSelect } from '../SmartSelect';

type ClassGroupLite = {
  id: number;
  code?: string | null;
  gradeLevel?: number | null;
  section?: string | null;
  name?: string | null;
  displayName?: string | null;
  classTeacherStaffId?: number | null;
  classTeacherDisplayName?: string | null;
};

type ClassGroupDeleteSummary = {
  classGroupsDeleted: number;
  studentsDeleted: number;
  subjectAllocationsDeleted: number;
  classSubjectConfigsDeleted: number;
  subjectSectionOverridesDeleted: number;
  subjectClassMappingsDeleted: number;
  timetableEntriesDeleted: number;
  attendanceSessionsDeleted: number;
  lecturesDeleted: number;
  announcementTargetsDeleted: number;
};

function deriveGradeSection(g: ClassGroupLite): { grade: number | null; section: string | null } {
  const gradeLevel = g.gradeLevel;
  const section = g.section;
  if (typeof gradeLevel === 'number' && Number.isFinite(gradeLevel)) {
    return { grade: gradeLevel, section: section ? String(section) : null };
  }
  const code = String(g.code ?? '').trim();
  const m = code.match(/^(\d{1,2})\s*[-_ ]?\s*([A-Za-z0-9]{1,8})?$/);
  if (!m) return { grade: null, section: section ? String(section) : null };
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return { grade: null, section: section ? String(section) : null };
  const sec = m[2] ? String(m[2]).trim() : null;
  return { grade: n, section: sec ?? (section ? String(section) : null) };
}

function summarizeClassDelete(s: ClassGroupDeleteSummary) {
  const parts: string[] = [];
  if (s.classGroupsDeleted) parts.push(`${s.classGroupsDeleted} section(s)`);
  if (s.studentsDeleted) parts.push(`${s.studentsDeleted} student(s)`);
  if (s.subjectAllocationsDeleted) parts.push(`${s.subjectAllocationsDeleted} allocation row(s)`);
  if (s.subjectSectionOverridesDeleted) parts.push(`${s.subjectSectionOverridesDeleted} override row(s)`);
  if (s.subjectClassMappingsDeleted) parts.push(`${s.subjectClassMappingsDeleted} mapping row(s)`);
  if (s.timetableEntriesDeleted) parts.push(`${s.timetableEntriesDeleted} timetable entry(s)`);
  if (s.attendanceSessionsDeleted) parts.push(`${s.attendanceSessionsDeleted} attendance session(s)`);
  if (s.lecturesDeleted) parts.push(`${s.lecturesDeleted} lecture(s)`);
  if (s.announcementTargetsDeleted) parts.push(`${s.announcementTargetsDeleted} announcement target(s)`);
  return parts.length ? parts.join(' · ') : 'No dependent rows found.';
}

function SectionClassTeacherLine({
  teacherName,
}: {
  teacherName: string | null | undefined;
}) {
  const n = teacherName != null ? String(teacherName).trim() : '';
  if (!n)
    return (
      <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: 650 }}>
        Class teacher · <span style={{ fontStyle: 'italic', opacity: 0.92 }}>not set</span>
      </div>
    );
  return (
    <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: 650 }}>
      Class teacher · <span style={{ color: '#0f172a', fontWeight: 850 }}>{n}</span>
    </div>
  );
}

/** “Generated classes & sections” accordion (browse-only — same UX as onboarding step 2) */
export function SavedClassesSectionsCatalogPanel() {
  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const [classesDeleteAllOpen, setClassesDeleteAllOpen] = useState(false);
  const [classesSearch, setClassesSearch] = useState('');
  const [classesGradeFilter, setClassesGradeFilter] = useState('');
  const [classesExpandedGrades, setClassesExpandedGrades] = useState<Record<number, boolean>>({});
  const [classesDeleteGradeModal, setClassesDeleteGradeModal] = useState<{ open: boolean; grade: number | null; ids: number[] }>(
    { open: false, grade: null, ids: [] },
  );
  const [classDeleteModal, setClassDeleteModal] = useState<{ open: boolean; id: number | null; code: string }>({
    open: false,
    id: null,
    code: '',
  });
  const [classEditModal, setClassEditModal] = useState<{
    open: boolean;
    id: number | null;
    code: string;
    displayName: string;
    gradeLevel: number | '';
    section: string;
    capacity: number | '';
  }>({ open: false, id: null, code: '', displayName: '', gradeLevel: '', section: '', capacity: '' });

  const classGroups = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () =>
      (await api.get('/api/class-groups?size=500')).data as ClassGroupLite[] | { content: ClassGroupLite[] },
  });

  const deleteAllClasses = useMutation({
    mutationFn: async () => api.delete('/api/class-groups/delete-all'),
    onSuccess: async () => {
      setClassesDeleteAllOpen(false);
      recordChange({
        id: 'classes:delete-all',
        scope: 'classes',
        severity: 'hard',
        message: 'Deleted all class groups',
        refs: {},
      });
      await invalidate(['classes']);
      toast.success('Deleted', 'All classes and sections were deleted.');
    },
    onError: (e) => toast.error('Delete failed', formatApiError(e)),
  });

  const deleteOneClass = useMutation({
    mutationFn: async (id: number) => (await api.delete<ClassGroupDeleteSummary>(`/api/class-groups/${id}`)).data,
    onError: (e) => toast.error('Delete failed', formatApiError(e)),
  });

  const updateOneClass = useMutation({
    mutationFn: async (body: {
      id: number;
      code: string;
      displayName: string;
      gradeLevel: number | null;
      section: string | null;
      capacity: number | null;
    }) =>
      api.put(`/api/class-groups/${body.id}`, {
        code: body.code,
        displayName: body.displayName,
        gradeLevel: body.gradeLevel,
        section: body.section,
        capacity: body.capacity,
      }),
    onSuccess: async () => {
      setClassEditModal({ open: false, id: null, code: '', displayName: '', gradeLevel: '', section: '', capacity: '' });
      await invalidate(['classes']);
      toast.success('Saved', 'Class updated.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const body = useMemo(() => {
    if (classGroups.isLoading) return <div className="muted">Loading classes…</div>;
    if (classGroups.isError) return <div style={{ color: '#b91c1c' }}>{formatApiError(classGroups.error)}</div>;
    const q = classesSearch.trim().toLowerCase();
    const gradePick = classesGradeFilter ? Number(classesGradeFilter) : null;
    const allRows = pageContent(classGroups.data)
      .slice()
      .sort((a, b) => {
        const aa = deriveGradeSection(a);
        const bb = deriveGradeSection(b);
        const ga = aa.grade ?? 999;
        const gb = bb.grade ?? 999;
        if (ga !== gb) return ga - gb;
        return String(aa.section ?? '').localeCompare(String(bb.section ?? ''));
      });

    if (!allRows.length) {
      return (
        <div className="muted">
          No classes yet. Generate them in the{' '}
          <strong>setup wizard — Classes &amp; sections</strong> step (or CSV import).
        </div>
      );
    }

    const gradeOptions = Array.from(
      new Set(
        allRows.map((r) => deriveGradeSection(r).grade).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)),
      ),
    )
      .sort((a, b) => a - b)
      .map((g) => ({ value: String(g), label: `Grade ${g}` }));

    const byGrade = new Map<number, ClassGroupLite[]>();
    const other: ClassGroupLite[] = [];
    for (const r of allRows) {
      const d = deriveGradeSection(r);
      const g = d.grade;
      if (gradePick != null && g !== gradePick) continue;
      const hay = `${g ?? ''} ${d.section ?? ''} ${r.code ?? ''} ${r.name ?? ''} ${r.displayName ?? ''} ${r.classTeacherDisplayName ?? ''}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      if (typeof g === 'number' && Number.isFinite(g)) {
        byGrade.set(g, [...(byGrade.get(g) ?? []), r]);
      } else {
        other.push(r);
      }
    }

    const autoExpand = Boolean(q) || gradePick != null;

    return (
      <div className="stack" style={{ gap: 12 }}>
        <div className="card row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={classesSearch}
            onChange={(e) => setClassesSearch(e.target.value)}
            placeholder="Search grade / section / code…"
            style={{ flex: '1 1 260px' }}
          />
          <div style={{ minWidth: 220 }} className="stack">
            <SmartSelect
              value={classesGradeFilter}
              onChange={(v) => setClassesGradeFilter(v || '')}
              options={gradeOptions.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="All grades"
              allowClear
              clearLabel="All grades"
              ariaLabel="Filter by grade"
            />
          </div>
          {classesSearch.trim() || classesGradeFilter ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setClassesSearch('');
                setClassesGradeFilter('');
              }}
            >
              Clear
            </button>
          ) : null}
          <div className="muted" style={{ fontSize: 12 }}>
            {allRows.length} section(s)
          </div>
        </div>

        {byGrade.size === 0 && other.length === 0 ? (
          <div className="muted">No matches.</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {Array.from(byGrade.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([grade, rows]) => {
                const isOpen = classesExpandedGrades[grade] ?? false;
                const openNow = autoExpand ? true : isOpen;
                const toggleGrade = () => {
                  if (autoExpand) return;
                  setClassesExpandedGrades((p) => ({ ...p, [grade]: !(p[grade] ?? false) }));
                };
                return (
                  <div key={grade} className="card stack" style={{ gap: 10, padding: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={toggleGrade}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleGrade();
                          }
                        }}
                        title={autoExpand ? 'Clear filters/search to collapse' : undefined}
                        className="row"
                        style={{
                          gap: 10,
                          alignItems: 'center',
                          cursor: autoExpand ? 'default' : 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
                          {openNow ? '▾' : '▸'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 950 }}>Grade {grade}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            Sections: <strong>{rows.length}</strong>
                          </div>
                        </div>
                      </div>
                      <RowActionsMenu
                        ariaLabel={`Grade ${grade} actions`}
                        actions={[
                          {
                            id: 'delete-grade',
                            label: `Delete Grade ${grade}`,
                            danger: true,
                            onSelect: () => {
                              const ids = allRows
                                .filter((r) => deriveGradeSection(r).grade === grade)
                                .map((r) => r.id);
                              setClassesDeleteGradeModal({
                                open: true,
                                grade,
                                ids,
                              });
                            },
                          },
                        ]}
                      />
                    </div>

                    {openNow ? (
                      <div className="stack" style={{ gap: 8 }}>
                        {rows.map((r) => {
                          const code = r.code ?? r.name ?? `#${r.id}`;
                          const displayName = r.displayName ?? r.name ?? r.code ?? code;
                          return (
                            <div
                              key={r.id}
                              className="row"
                              style={{
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 12,
                                border: '1px solid rgba(15,23,42,0.10)',
                                background: 'rgba(255,255,255,0.9)',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 900 }}>{displayName}</div>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  <code>{code}</code>
                                  {deriveGradeSection(r).section ? ` · Section ${deriveGradeSection(r).section}` : ''}
                                </div>
                                <SectionClassTeacherLine teacherName={r.classTeacherDisplayName} />
                              </div>
                              <RowActionsMenu
                                ariaLabel="Class actions"
                                actions={[
                                  {
                                    id: 'edit',
                                    label: 'Edit',
                                    onSelect: () =>
                                      setClassEditModal({
                                        open: true,
                                        id: r.id,
                                        code: String(r.code ?? ''),
                                        displayName: String(r.displayName ?? r.name ?? r.code ?? ''),
                                        gradeLevel: Number.isFinite(Number(r.gradeLevel)) ? Number(r.gradeLevel) : '',
                                        section: String(r.section ?? ''),
                                        capacity: '',
                                      }),
                                  },
                                  {
                                    id: 'delete',
                                    label: 'Delete',
                                    danger: true,
                                    onSelect: () => setClassDeleteModal({ open: true, id: r.id, code }),
                                  },
                                ]}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Closed · Click the card to view sections
                      </div>
                    )}
                  </div>
                );
              })}

            {other.length ? (
              <div className="card stack" style={{ gap: 10, padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Other</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Classes without a grade/section (still usable elsewhere).
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {other.map((r) => {
                    const code = r.code ?? r.name ?? `#${r.id}`;
                    const displayName = r.displayName ?? r.name ?? r.code ?? code;
                    return (
                      <div
                        key={r.id}
                        className="row"
                        style={{
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: '1px solid rgba(15,23,42,0.10)',
                          background: 'rgba(255,255,255,0.9)',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900 }}>{displayName}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            <code>{code}</code>
                          </div>
                          <SectionClassTeacherLine teacherName={r.classTeacherDisplayName} />
                        </div>
                        <RowActionsMenu
                          ariaLabel="Class actions"
                          actions={[
                            {
                              id: 'edit',
                              label: 'Edit',
                              onSelect: () =>
                                setClassEditModal({
                                  open: true,
                                  id: r.id,
                                  code: String(r.code ?? ''),
                                  displayName: String(r.displayName ?? r.name ?? r.code ?? ''),
                                  gradeLevel: '',
                                  section: String(r.section ?? ''),
                                  capacity: '',
                                }),
                            },
                            {
                              id: 'delete',
                              label: 'Delete',
                              danger: true,
                              onSelect: () => setClassDeleteModal({ open: true, id: r.id, code }),
                            },
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }, [
    classGroups.data,
    classGroups.error,
    classGroups.isError,
    classGroups.isLoading,
    classesExpandedGrades,
    classesGradeFilter,
    classesSearch,
  ]);

  return (
    <>
      <div className="stack" style={{ gap: 10, marginTop: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div style={{ fontWeight: 900 }}>Classes &amp; sections</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Saved class groups · same browser as onboarding
            </div>
          </div>
          <RowActionsMenu
            ariaLabel="Classes catalog actions"
            actions={[
              {
                id: 'delete-all-classes',
                label: 'Delete all classes',
                danger: true,
                onSelect: () => setClassesDeleteAllOpen(true),
              },
            ]}
          />
        </div>
        {body}
      </div>

      <ConfirmDialog
        open={classesDeleteAllOpen}
        title="Delete all classes?"
        description="This removes all class groups/sections and dependent data (students, attendance, lectures, timetable entries, academic-structure mappings)."
        danger
        confirmLabel={deleteAllClasses.isPending ? 'Deleting…' : 'Delete all'}
        confirmDisabled={deleteAllClasses.isPending}
        onConfirm={async () => {
          await deleteAllClasses.mutateAsync();
        }}
        onClose={() => (deleteAllClasses.isPending ? null : setClassesDeleteAllOpen(false))}
      />

      <ConfirmDialog
        open={classDeleteModal.open}
        title={`Delete ${classDeleteModal.code || 'class'}?`}
        description="This will delete dependent data for this class/section (students, attendance, lectures, timetable entries, academic-structure mappings)."
        danger
        confirmLabel={deleteOneClass.isPending ? 'Deleting…' : 'Delete'}
        confirmDisabled={deleteOneClass.isPending || !classDeleteModal.id}
        onConfirm={async () => {
          if (!classDeleteModal.id) return;
          try {
            const summary = await deleteOneClass.mutateAsync(classDeleteModal.id);
            recordChange({
              id: `classes:del:${classDeleteModal.id}`,
              scope: 'classes',
              severity: 'hard',
              message: `Deleted class group ${classDeleteModal.code}`,
              refs: {},
            });
            await invalidate(['classes']);
            toast.success('Deleted', summarizeClassDelete(summary));
            setClassDeleteModal({ open: false, id: null, code: '' });
          } catch {
            // onError toast from mutation
          }
        }}
        onClose={() => (deleteOneClass.isPending ? null : setClassDeleteModal({ open: false, id: null, code: '' }))}
      />

      <ConfirmDialog
        open={classesDeleteGradeModal.open}
        title={classesDeleteGradeModal.grade != null ? `Delete Grade ${classesDeleteGradeModal.grade}?` : 'Delete grade?'}
        description="This will delete all sections in this grade and dependent data (students, attendance, lectures, timetable entries, academic-structure mappings)."
        danger
        confirmLabel={deleteOneClass.isPending ? 'Deleting…' : 'Delete grade'}
        confirmDisabled={deleteOneClass.isPending || !classesDeleteGradeModal.ids.length}
        onConfirm={async () => {
          const ids = classesDeleteGradeModal.ids.slice();
          const agg: ClassGroupDeleteSummary = {
            classGroupsDeleted: 0,
            studentsDeleted: 0,
            subjectAllocationsDeleted: 0,
            classSubjectConfigsDeleted: 0,
            subjectSectionOverridesDeleted: 0,
            subjectClassMappingsDeleted: 0,
            timetableEntriesDeleted: 0,
            attendanceSessionsDeleted: 0,
            lecturesDeleted: 0,
            announcementTargetsDeleted: 0,
          };
          for (const id of ids) {
            // eslint-disable-next-line no-await-in-loop
            const s = await deleteOneClass.mutateAsync(id);
            agg.classGroupsDeleted += s.classGroupsDeleted ?? 0;
            agg.studentsDeleted += s.studentsDeleted ?? 0;
            agg.subjectAllocationsDeleted += s.subjectAllocationsDeleted ?? 0;
            agg.classSubjectConfigsDeleted += s.classSubjectConfigsDeleted ?? 0;
            agg.subjectSectionOverridesDeleted += s.subjectSectionOverridesDeleted ?? 0;
            agg.subjectClassMappingsDeleted += s.subjectClassMappingsDeleted ?? 0;
            agg.timetableEntriesDeleted += s.timetableEntriesDeleted ?? 0;
            agg.attendanceSessionsDeleted += s.attendanceSessionsDeleted ?? 0;
            agg.lecturesDeleted += s.lecturesDeleted ?? 0;
            agg.announcementTargetsDeleted += s.announcementTargetsDeleted ?? 0;
          }
          setClassesDeleteGradeModal({ open: false, grade: null, ids: [] });
          await invalidate(['classes']);
          toast.success('Deleted', summarizeClassDelete(agg));
        }}
        onClose={() =>
          deleteOneClass.isPending ? null : setClassesDeleteGradeModal({ open: false, grade: null, ids: [] })
        }
      />

      <ConfirmDialog
        open={classEditModal.open}
        title="Edit class / section"
        confirmLabel={updateOneClass.isPending ? 'Saving…' : 'Save'}
        confirmDisabled={
          updateOneClass.isPending ||
          !classEditModal.id ||
          !classEditModal.code.trim() ||
          !classEditModal.displayName.trim() ||
          classEditModal.gradeLevel === ''
        }
        onConfirm={async () => {
          if (!classEditModal.id) return;
          const gradeLevel = classEditModal.gradeLevel === '' ? null : Number(classEditModal.gradeLevel);
          const capacity = classEditModal.capacity === '' ? null : Number(classEditModal.capacity);
          await updateOneClass.mutateAsync({
            id: classEditModal.id,
            code: classEditModal.code.trim(),
            displayName: classEditModal.displayName.trim(),
            gradeLevel: Number.isFinite(Number(gradeLevel)) ? Number(gradeLevel) : null,
            section: classEditModal.section.trim() ? classEditModal.section.trim() : null,
            capacity: Number.isFinite(Number(capacity)) ? Number(capacity) : null,
          });
        }}
        onClose={() =>
          updateOneClass.isPending
            ? null
            : setClassEditModal({ open: false, id: null, code: '', displayName: '', gradeLevel: '', section: '', capacity: '' })
        }
      >
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(220px, 2fr)',
          }}
        >
          <div className="stack" style={{ gap: 6 }}>
            <label>Grade</label>
            <input
              type="number"
              min={1}
              max={12}
              value={classEditModal.gradeLevel}
              onChange={(e) => {
                const v = e.target.value;
                setClassEditModal((p) => ({ ...p, gradeLevel: v === '' ? '' : Number(v) }));
              }}
            />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label>Section (optional)</label>
            <input
              value={classEditModal.section}
              onChange={(e) => setClassEditModal((p) => ({ ...p, section: e.target.value }))}
              placeholder="A"
            />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label>Code</label>
            <input
              value={classEditModal.code}
              onChange={(e) => setClassEditModal((p) => ({ ...p, code: e.target.value }))}
              placeholder="10-A"
            />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label>Display name</label>
            <input
              value={classEditModal.displayName}
              onChange={(e) => setClassEditModal((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="Class 10 · A"
            />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
