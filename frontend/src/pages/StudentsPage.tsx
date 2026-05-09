import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { onboardingStepHref } from '../lib/onboardingWizardMeta';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { isWorkspaceReadOnly, WorkspaceReadOnlyRibbon } from '../lib/workspaceViewMode';
import { useClassGroupsCatalog } from '../components/ClassGroupSearchCombobox';
import { StudentCardsSkeleton } from '../components/students/StudentListSkeleton';
import { StudentListCards } from '../components/students/StudentListCards';
import { StudentListFilters } from '../components/students/StudentListFilters';
import { StudentListSkeleton } from '../components/students/StudentListSkeleton';
import { SelectKeeper } from '../components/SelectKeeper';
import { StudentListTable } from '../components/students/StudentListTable';
import type { SpringPage, StudentListRow } from '../components/students/studentListTypes';
import { buildStudentsCsv, downloadTextFile } from '../components/students/studentListExport';
import {
  StudentModuleSummaryCards,
  type RosterMetric,
} from '../components/students/StudentModuleSummaryCards';
import '../components/students/studentsWorkspace.css';

function buildStudentsListUrl(opts: {
  page: number;
  size: number;
  gradeLevel: string;
  section: string;
  status: string;
  search: string;
}) {
  const params = new URLSearchParams();
  params.set('page', String(opts.page));
  params.set('size', String(opts.size));
  params.append('sort', 'lastName,asc');
  params.append('sort', 'firstName,asc');
  params.append('sort', 'id,asc');
  if (opts.gradeLevel.trim()) params.set('gradeLevel', opts.gradeLevel.trim());
  if (opts.section.trim()) params.set('section', opts.section.trim());
  if (opts.status.trim()) params.set('status', opts.status.trim());
  if (opts.search.trim()) params.set('search', opts.search.trim());
  return `/api/students?${params.toString()}`;
}

export function StudentsPage() {
  const [searchParams] = useSearchParams();
  const readOnly = isWorkspaceReadOnly(searchParams);

  const classCatalog = useClassGroupsCatalog();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [gradeLevel, setGradeLevel] = useState('');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 320);

  useEffect(() => setPage(0), [debouncedSearch, gradeLevel, section, status, size]);

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of classCatalog.data?.content ?? []) {
      if (typeof r.gradeLevel === 'number') set.add(r.gradeLevel);
    }
    return [...set].sort((a, b) => a - b);
  }, [classCatalog.data?.content]);

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of classCatalog.data?.content ?? []) {
      if (!gradeLevel.trim() || String(r.gradeLevel ?? '') === gradeLevel.trim()) {
        const s = r.section?.trim();
        if (s) set.add(s);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [classCatalog.data?.content, gradeLevel]);

  const listUrl = useMemo(
    () =>
      buildStudentsListUrl({
        page,
        size,
        gradeLevel,
        section,
        status,
        search: debouncedSearch,
      }),
    [page, size, gradeLevel, section, status, debouncedSearch],
  );

  const listQuery = useQuery({
    queryKey: ['students', 'list', listUrl],
    queryFn: async () => (await api.get<SpringPage<StudentListRow>>(listUrl)).data,
    staleTime: 25_000,
  });

  const activeCountUrl = useMemo(
    () =>
      buildStudentsListUrl({
        page: 0,
        size: 1,
        gradeLevel: '',
        section: '',
        status: 'ACTIVE',
        search: '',
      }),
    [],
  );

  const activeStudentsCountQuery = useQuery({
    queryKey: ['students', 'overview', 'count-active'],
    queryFn: async () => (await api.get<SpringPage<StudentListRow>>(activeCountUrl)).data,
    staleTime: 45_000,
  });

  const rosterMetrics = useMemo((): RosterMetric[] => {
    const active = activeStudentsCountQuery.data?.totalElements ?? null;
    return [
      { id: 'active', title: 'Active students', value: active, caption: undefined, tone: 'accent' },
      {
        id: 'newMonth',
        title: 'New admissions (this month)',
        value: null,
        caption: 'Monthly intake summary will appear when reporting is enabled.',
      },
      {
        id: 'noGuardian',
        title: 'Missing guardians',
        value: null,
        caption: 'Compliance counts will populate from the upcoming roster-health API.',
      },
      {
        id: 'noSection',
        title: 'No section assigned',
        value: null,
        caption: 'Placement gaps will surface here automatically.',
      },
      {
        id: 'documents',
        title: 'Pending documents',
        value: null,
        caption: 'Document queues will summarize here.',
      },
    ];
  }, [activeStudentsCountQuery.data?.totalElements]);

  useEffect(() => {
    const d = listQuery.data;
    if (!d || d.totalPages <= 0) return;
    const last = d.totalPages - 1;
    if (page > last) setPage(Math.max(0, last));
  }, [listQuery.data, page]);

  const rows = listQuery.data?.content ?? [];
  const filterActive = Boolean(debouncedSearch.trim() || gradeLevel.trim() || section.trim() || status.trim());
  const filteredEmpty =
    listQuery.isSuccess &&
    rows.length === 0 &&
    !listQuery.isFetching &&
    (listQuery.data?.totalElements ?? 0) === 0 &&
    filterActive;
  const onboardedEmpty =
    listQuery.isSuccess &&
    rows.length === 0 &&
    !listQuery.isFetching &&
    (listQuery.data?.totalElements ?? 0) === 0 &&
    !filterActive;

  const exportCsv = () => {
    if (!rows.length) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile(`students-export-${stamp}.csv`, buildStudentsCsv(rows));
  };

  const filterDisabled = listQuery.isLoading && !listQuery.data;

  return (
    <div className="workspace-feature-page stack students-workspace">
      <header className="sw-header">
        <div>
          <h2 className="workspace-feature-page__title">Students</h2>
          <p className="workspace-feature-page__lead" style={{ marginBottom: 0 }}>
            {readOnly ?
              'Browse learners roster (read-only).'
            : 'Manage learners, placements, guardians, and onboarding.'}
          </p>
        </div>
        <div className="sw-header-actions">
          <button
            type="button"
            className="btn secondary"
            title="Downloads the CSV for the rows on the current page (same filters as the table)."
            disabled={readOnly || !rows.length}
            onClick={exportCsv}
          >
            Export
          </button>
          <Link className="btn secondary" to={onboardingStepHref('STUDENTS')}>
            Bulk import students
          </Link>
          <Link className="btn" to="/app/students/add">
            Add student
          </Link>
        </div>
      </header>

      {readOnly ? <WorkspaceReadOnlyRibbon title="Students — browse only" /> : null}

      <StudentModuleSummaryCards metrics={rosterMetrics} loading={activeStudentsCountQuery.isLoading && !activeStudentsCountQuery.data} />

      <div className="sw-toolbar">
        <StudentListFilters
          search={search}
          onSearchChange={setSearch}
          gradeLevel={gradeLevel}
          onGradeLevelChange={(v) => {
            setGradeLevel(v);
            setSection('');
          }}
          section={section}
          onSectionChange={setSection}
          status={status}
          onStatusChange={setStatus}
          gradeOptions={gradeOptions}
          sectionOptions={sectionOptions}
          disabled={filterDisabled}
        />
      </div>

      <section className="sw-panel sw-root">
        {listQuery.error ?
          <div className="sw-error">
            <span>{formatApiError(listQuery.error)}</span>
            <button type="button" className="btn secondary" onClick={() => listQuery.refetch()}>
              Retry
            </button>
          </div>
        : null}

        {listQuery.isLoading && !listQuery.data ?
          <>
            <StudentListSkeleton rows={10} />
            <StudentCardsSkeleton cards={6} />
          </>
        : null}

        {onboardedEmpty ?
          <div className="sw-empty sw-empty--onboard">
            <div className="sw-empty-kicker">Roster · getting started</div>
            <div className="sw-empty-title sw-empty-title--large">No students onboarded yet</div>
            <p className="sw-empty-body">
              Import existing student records in bulk or add a new admission manually.
            </p>
            <div className="sw-empty-actions">
              <Link className="btn secondary" to={onboardingStepHref('STUDENTS')}>
                Bulk import students
              </Link>
              <Link className="btn" to="/app/students/add">
                Add student
              </Link>
            </div>
            <p className="sw-empty-helper">
              <strong>Tip:</strong> CSV import is recommended for established schools onboarding many learners at once.
            </p>
          </div>
        : null}

        {filteredEmpty ?
          <div className="sw-empty">
            <div className="sw-empty-title">No learners match your filters.</div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Try clearing search or changing class, section, or status filters.
            </p>
          </div>
        : null}

        {rows.length > 0 ?
          <>
            <StudentListTable rows={rows} />
            <StudentListCards rows={rows} />
            <footer className="sw-footer">
              <div className="muted" style={{ fontSize: 12 }}>
                {listQuery.data ?
                  <>
                    Showing {rows.length} of {listQuery.data.totalElements} learner
                    {listQuery.data.totalElements === 1 ? '' : 's'}
                  </>
                : null}
              </div>
              <div className="sw-pagination">
                <div className="muted sw-per-page" style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>Per page</span>
                  <SelectKeeper
                    id="sw-per-page"
                    className="sw-per-page-select"
                    value={String(size)}
                    onChange={(v) => setSize(Number(v))}
                    options={[
                      { value: '10', label: '10' },
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                      { value: '100', label: '100' },
                    ]}
                  />
                </div>
                <button type="button" className="btn secondary" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span style={{ fontSize: 13 }} className="muted">
                  Page {(listQuery.data?.number ?? 0) + 1} / {Math.max(listQuery.data?.totalPages ?? 1, 1)}
                </span>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={listQuery.data != null && page >= (listQuery.data.totalPages ?? 1) - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        : null}
      </section>
    </div>
  );
}
