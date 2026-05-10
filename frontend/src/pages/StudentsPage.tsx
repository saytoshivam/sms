import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { isWorkspaceReadOnly, WorkspaceReadOnlyRibbon } from '../lib/workspaceViewMode';
import { useClassGroupsCatalog } from '../components/ClassGroupSearchCombobox';
import { StudentCardsSkeleton } from '../components/students/StudentListSkeleton';
import { StudentListCards } from '../components/students/StudentListCards';
import { StudentListFilters, type QuickFilter } from '../components/students/StudentListFilters';
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

// ─── Roster health type ───────────────────────────────────────────────────────
type RosterHealth = {
  activeCount: number;
  newThisMonthCount: number;
  missingGuardianCount: number;
  noSectionCount: number;
  inactiveCount: number;
  transferredCount: number;
  alumniCount: number;
};

// ─── URL builder ─────────────────────────────────────────────────────────────
function buildStudentsListUrl(opts: {
  page: number; size: number; gradeLevel: string; section: string;
  status: string; search: string; noGuardian: boolean; noSection: boolean;
}) {
  const params = new URLSearchParams();
  params.set('page', String(opts.page));
  params.set('size', String(opts.size));
  params.append('sort', 'lastName,asc');
  params.append('sort', 'firstName,asc');
  params.append('sort', 'id,asc');
  if (opts.gradeLevel.trim()) params.set('gradeLevel', opts.gradeLevel.trim());
  if (opts.section.trim())    params.set('section',    opts.section.trim());
  if (opts.status.trim())     params.set('status',     opts.status.trim());
  if (opts.search.trim())     params.set('search',     opts.search.trim());
  if (opts.noGuardian)        params.set('noGuardian', 'true');
  if (opts.noSection)         params.set('noSection',  'true');
  return `/api/students?${params.toString()}`;
}

// ─── Bulk bulk-action modal ────────────────────────────────────────────────────
type BulkModal = 'changeStatus' | null;

function BulkChangeStatusModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (newStatus: string, reason: string) => void;
}) {
  const [newStatus, setNewStatus] = useState('INACTIVE');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) return;
    setBusy(true);
    await onConfirm(newStatus, reason.trim());
    setBusy(false);
  }

  return (
    <div className="sw-drawer-backdrop" onClick={onClose}>
      <div className="sw-drawer" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="sw-drawer-head">
          <h3>Change Status — {count} student{count !== 1 ? 's' : ''}</h3>
          <button type="button" className="btn secondary sw-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="sw-drawer-body" style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.65)', lineHeight: 1.55 }}>
            This will update the lifecycle status for <strong>{count}</strong> selected student{count !== 1 ? 's' : ''}.
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.52)', marginBottom: 5 }}>
              New Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)', fontSize: 13 }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="ALUMNI">Alumni</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.52)', marginBottom: 5 }}>
              Reason / Audit Note *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this status change is being made…"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)', fontSize: 13, resize: 'vertical' }}
            />
            {!reason.trim() && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>Reason is required for audit trail.</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn secondary" onClick={onClose} style={{ flex: 1 }} disabled={busy}>Cancel</button>
            <button
              type="button"
              className="btn"
              onClick={handleConfirm}
              disabled={!reason.trim() || busy}
              style={{ flex: 1 }}
            >
              {busy ? 'Applying…' : 'Apply to all selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function StudentsPage() {
  const [searchParams] = useSearchParams();
  const readOnly = isWorkspaceReadOnly(searchParams);

  const classCatalog = useClassGroupsCatalog();

  // Filters
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [gradeLevel, setGradeLevel] = useState('');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const debouncedSearch = useDebouncedValue(search, 320);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Bulk modals
  const [bulkModal, setBulkModal] = useState<BulkModal>(null);
  const [bulkStatus, setBulkStatus] = useState<{ done: number; errors: number } | null>(null);

  // Derive effective status from quick filter
  const effectiveStatus = useMemo(() => {
    if (quickFilter === 'transferred') return 'TRANSFERRED';
    if (quickFilter === 'alumni')      return 'ALUMNI';
    if (quickFilter === 'inactive')    return 'INACTIVE';
    return status;
  }, [quickFilter, status]);

  const noGuardian = quickFilter === 'noGuardian';
  const noSection  = quickFilter === 'noSection';

  useEffect(() => { setPage(0); setSelectedIds(new Set()); }, [debouncedSearch, gradeLevel, section, effectiveStatus, size, quickFilter]);

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of classCatalog.data?.content ?? [])
      if (typeof r.gradeLevel === 'number') set.add(r.gradeLevel);
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

  const listUrl = useMemo(() =>
    buildStudentsListUrl({ page, size, gradeLevel, section, status: effectiveStatus,
      search: debouncedSearch, noGuardian, noSection }),
    [page, size, gradeLevel, section, effectiveStatus, debouncedSearch, noGuardian, noSection],
  );

  const listQuery = useQuery({
    queryKey: ['students', 'list', listUrl],
    queryFn: async () => (await api.get<SpringPage<StudentListRow>>(listUrl)).data,
    staleTime: 25_000,
  });

  const healthQuery = useQuery({
    queryKey: ['students', 'roster-health'],
    queryFn: async () => (await api.get<RosterHealth>('/api/students/roster-health')).data,
    staleTime: 60_000,
  });

  useEffect(() => {
    const d = listQuery.data;
    if (!d || d.totalPages <= 0) return;
    const last = d.totalPages - 1;
    if (page > last) setPage(Math.max(0, last));
  }, [listQuery.data, page]);

  // ───── Selection helpers ──────────────────────────────────────────────────
  const rows = listQuery.data?.content ?? [];

  const toggleRow = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  }, [rows]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ───── Export helpers ─────────────────────────────────────────────────────────
  const exportCurrentPage = () => {
    if (!rows.length) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile(`students-page-${stamp}.csv`, buildStudentsCsv(rows));
  };

  const exportSelected = () => {
    const sel = rows.filter((r) => selectedIds.has(r.id));
    if (!sel.length) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile(`students-selected-${stamp}.csv`, buildStudentsCsv(sel));
  };

  // ───── Bulk change status ──────────────────────────────────────────────────
  async function handleBulkChangeStatus(newStatus: string, reason: string) {
    let done = 0; let errors = 0;
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await api.put(`/api/students/${id}`, {
          status: newStatus,
          // Pass reason as a comment field — backend may ignore if unsupported
          _auditReason: reason,
        });
        done++;
      } catch {
        errors++;
      }
    }
    setBulkStatus({ done, errors });
    setBulkModal(null);
    setSelectedIds(new Set());
    listQuery.refetch();
    healthQuery.refetch();
  }

  // ───── Metrics ────────────────────────────────────────────────────────────
  const h = healthQuery.data;
  const healthLoading = healthQuery.isLoading && !h;

  const rosterMetrics = useMemo((): RosterMetric[] => [
    {
      id: 'active',
      title: 'Active students',
      value: h?.activeCount ?? null,
      tone: 'accent',
      onClick: () => { setQuickFilter(null); setStatus('ACTIVE'); },
    },
    {
      id: 'newMonth',
      title: 'New this month',
      value: h?.newThisMonthCount ?? null,
    },
    {
      id: 'noGuardian',
      title: 'Missing guardian',
      value: h?.missingGuardianCount ?? null,
      tone: (h?.missingGuardianCount ?? 0) > 0 ? 'warn' : 'default',
      onClick: () => { setQuickFilter('noGuardian'); setStatus(''); },
    },
    {
      id: 'noSection',
      title: 'No section',
      value: h?.noSectionCount ?? null,
      tone: (h?.noSectionCount ?? 0) > 0 ? 'warn' : 'default',
      onClick: () => { setQuickFilter('noSection'); setStatus(''); },
    },
    {
      id: 'transferred',
      title: 'Transferred',
      value: h?.transferredCount ?? null,
      onClick: () => { setQuickFilter('transferred'); },
    },
    {
      id: 'alumni',
      title: 'Alumni',
      value: h?.alumniCount ?? null,
      onClick: () => { setQuickFilter('alumni'); },
    },
  ], [h]);

  // ───── State flags ─────────────────────────────────────────────────────────
  const filterActive = Boolean(
    debouncedSearch.trim() || gradeLevel.trim() || section.trim() ||
    status.trim() || quickFilter
  );
  const filteredEmpty =
    listQuery.isSuccess && rows.length === 0 && !listQuery.isFetching &&
    (listQuery.data?.totalElements ?? 0) === 0 && filterActive;
  const onboardedEmpty =
    listQuery.isSuccess && rows.length === 0 && !listQuery.isFetching &&
    (listQuery.data?.totalElements ?? 0) === 0 && !filterActive;

  const filterDisabled = listQuery.isLoading && !listQuery.data;

  function clearAllFilters() {
    setSearch(''); setGradeLevel(''); setSection(''); setStatus(''); setQuickFilter(null);
  }

  function handleQuickFilter(q: QuickFilter) {
    setQuickFilter(q);
    // Clear conflicting standard filters when quick filter is status-based
    if (q === 'transferred' || q === 'alumni' || q === 'inactive') setStatus('');
    if (q === 'noGuardian' || q === 'noSection') { /* keep other filters as-is */ }
  }

  return (
    <div className="workspace-feature-page stack students-workspace">
      <header className="sw-header">
        <div>
          <h2 className="workspace-feature-page__title">Students</h2>
          <p className="workspace-feature-page__lead" style={{ marginBottom: 0 }}>
            {readOnly ? 'Browse learners roster (read-only).' : 'Manage learners, placements, guardians, and onboarding.'}
          </p>
        </div>
        <div className="sw-header-actions">
          <button
            type="button"
            className="btn secondary"
            title="Export current page as CSV"
            disabled={readOnly || !rows.length}
            onClick={exportCurrentPage}
          >
            Export page
          </button>
          <Link className="btn secondary" to="/app/students/bulk-import">Bulk import</Link>
          <Link className="btn" to="/app/students/add">+ Add student</Link>
        </div>
      </header>

      {readOnly ? <WorkspaceReadOnlyRibbon title="Students — browse only" /> : null}

      {/* Bulk status toast */}
      {bulkStatus && (
        <div style={{ background: bulkStatus.errors ? '#fef2f2' : 'rgba(22,163,74,0.08)', border: `1px solid ${bulkStatus.errors ? 'rgba(185,28,28,0.2)' : 'rgba(22,163,74,0.25)'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {bulkStatus.done > 0 && <span style={{ color: '#166534' }}>✓ {bulkStatus.done} updated. </span>}
            {bulkStatus.errors > 0 && <span style={{ color: '#991b1b' }}>⚠ {bulkStatus.errors} failed.</span>}
          </span>
          <button type="button" className="btn secondary" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setBulkStatus(null)}>Dismiss</button>
        </div>
      )}

      {/* Summary metrics */}
      <StudentModuleSummaryCards metrics={rosterMetrics} loading={healthLoading} />

      {/* Sticky toolbar */}
      <div className="sw-toolbar">
        <StudentListFilters
          search={search}
          onSearchChange={setSearch}
          gradeLevel={gradeLevel}
          onGradeLevelChange={(v) => { setGradeLevel(v); setSection(''); }}
          section={section}
          onSectionChange={setSection}
          status={status}
          onStatusChange={setStatus}
          gradeOptions={gradeOptions}
          sectionOptions={sectionOptions}
          disabled={filterDisabled}
          quickFilter={quickFilter}
          onQuickFilter={handleQuickFilter}
          onClearAll={clearAllFilters}
          filterActive={filterActive}
        />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sw-bulk-bar">
          <span className="sw-bulk-count">{selectedIds.size} selected</span>
          <div className="sw-bulk-actions">
            <button type="button" className="btn secondary" onClick={exportSelected} style={{ fontSize: 12 }}>
              ↓ Export selected
            </button>
            {!readOnly && (
              <button type="button" className="btn secondary" onClick={() => setBulkModal('changeStatus')} style={{ fontSize: 12 }}>
                Change status
              </button>
            )}
            <button type="button" className="btn secondary" onClick={clearSelection} style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)' }}>
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      <section className="sw-panel sw-root">
        {listQuery.error ?
          <div className="sw-error">
            <span>{formatApiError(listQuery.error)}</span>
            <button type="button" className="btn secondary" onClick={() => listQuery.refetch()}>Retry</button>
          </div>
        : null}

        {listQuery.isLoading && !listQuery.data ?
          <><StudentListSkeleton rows={10} /><StudentCardsSkeleton cards={6} /></>
        : null}

        {onboardedEmpty ? (
          <div className="sw-empty sw-empty--onboard">
            <div className="sw-empty-kicker">Roster · getting started</div>
            <div className="sw-empty-title sw-empty-title--large">No students onboarded yet</div>
            <p className="sw-empty-body">Import existing student records in bulk or add a new admission manually.</p>
            <div className="sw-empty-actions">
              <Link className="btn secondary" to="/app/students/bulk-import">Bulk import students</Link>
              <Link className="btn" to="/app/students/add">Add student</Link>
            </div>
            <p className="sw-empty-helper">
              <strong>Tip:</strong> CSV import is recommended for established schools onboarding many learners at once.
            </p>
          </div>
        ) : null}

        {filteredEmpty ? (
          <div className="sw-empty">
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div className="sw-empty-title">No students match your filters</div>
            <p className="muted" style={{ margin: '6px 0 16px', fontSize: 14, lineHeight: 1.6 }}>
              {quickFilter === 'noGuardian' && 'Great — all active students have a guardian linked.'}
              {quickFilter === 'noSection' && 'All students have been assigned to a class-section.'}
              {!quickFilter && 'Try clearing search or changing class, section, or status filters.'}
            </p>
            <button type="button" className="btn secondary" onClick={clearAllFilters}>Clear all filters</button>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <StudentListTable
              rows={rows}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onSelectAll={selectAllPage}
              onClearAll={clearSelection}
            />
            <StudentListCards rows={rows} />
            <footer className="sw-footer">
              <div className="muted" style={{ fontSize: 12 }}>
                {listQuery.data && (
                  <>Showing {rows.length} of {listQuery.data.totalElements.toLocaleString()} learner{listQuery.data.totalElements === 1 ? '' : 's'}</>
                )}
                {selectedIds.size > 0 && <span style={{ marginLeft: 10, fontWeight: 700, color: 'var(--color-primary)' }}> · {selectedIds.size} selected</span>}
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
                <button type="button" className="btn secondary" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
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
        ) : null}
      </section>

      {/* Bulk status change modal */}
      {bulkModal === 'changeStatus' && (
        <BulkChangeStatusModal
          count={selectedIds.size}
          onClose={() => setBulkModal(null)}
          onConfirm={handleBulkChangeStatus}
        />
      )}
    </div>
  );
}
