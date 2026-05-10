import { useMemo } from 'react';
import { SelectKeeper } from '../SelectKeeper';
import { STUDENT_STATUS_OPTIONS } from './studentListTypes';

export type QuickFilter = 'noGuardian' | 'noSection' | 'transferred' | 'alumni' | 'inactive' | null;

export type StudentListFiltersProps = {
  search: string;
  onSearchChange: (v: string) => void;
  gradeLevel: string;
  onGradeLevelChange: (v: string) => void;
  section: string;
  onSectionChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  gradeOptions: number[];
  sectionOptions: string[];
  disabled?: boolean;
  quickFilter: QuickFilter;
  onQuickFilter: (q: QuickFilter) => void;
  onClearAll: () => void;
  filterActive: boolean;
};

type QuickFilterDef = { id: QuickFilter; label: string; icon: string; tone?: 'warn' };

const QUICK_FILTERS: QuickFilterDef[] = [
  { id: 'noGuardian',  label: 'Missing guardian',   icon: '⚠️', tone: 'warn' },
  { id: 'noSection',   label: 'No section',         icon: '📍', tone: 'warn' },
  { id: 'transferred', label: 'Transferred',         icon: '🔄' },
  { id: 'alumni',      label: 'Alumni',              icon: '🎓' },
  { id: 'inactive',    label: 'Inactive',            icon: '⏸️' },
];

export function StudentListFilters({
  search, onSearchChange,
  gradeLevel, onGradeLevelChange,
  section, onSectionChange,
  status, onStatusChange,
  gradeOptions, sectionOptions,
  disabled,
  quickFilter, onQuickFilter,
  onClearAll, filterActive,
}: StudentListFiltersProps) {
  const gradeOpts = useMemo(
    () => gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` })),
    [gradeOptions],
  );
  const sectionOpts = useMemo(
    () => sectionOptions.map((sec) => ({ value: sec, label: sec })),
    [sectionOptions],
  );
  const statusLocked = quickFilter === 'transferred' || quickFilter === 'alumni' || quickFilter === 'inactive';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Quick filter chips */}
      <div className="sw-quick-filters">
        <span className="sw-quick-filters-label">Quick:</span>
        {QUICK_FILTERS.map((qf) => (
          <button
            key={String(qf.id)}
            type="button"
            className={`sw-qf-chip${quickFilter === qf.id ? ' sw-qf-chip--active' : ''}${qf.tone === 'warn' ? ' sw-qf-chip--warn' : ''}`}
            onClick={() => onQuickFilter(quickFilter === qf.id ? null : qf.id)}
            disabled={disabled}
          >
            <span aria-hidden>{qf.icon}</span>
            {qf.label}
          </button>
        ))}
        {filterActive && (
          <button type="button" className="sw-qf-clear" onClick={onClearAll}>
            ✕ Clear all
          </button>
        )}
      </div>

      {/* Standard filters */}
      <div className="sw-filters">
        <div className="sw-filter sw-filter--grow">
          <label htmlFor="sw-search">Search</label>
          <input
            id="sw-search"
            type="search"
            placeholder="Name, admission no, guardian phone…"
            value={search}
            disabled={disabled}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="sw-filter">
          <label htmlFor="sw-grade">Class</label>
          <SelectKeeper
            id="sw-grade"
            className="sw-filter-select"
            value={gradeLevel}
            onChange={onGradeLevelChange}
            options={gradeOpts}
            emptyValueLabel="All classes"
            disabled={disabled}
          />
        </div>
        <div className="sw-filter">
          <label htmlFor="sw-section">Section</label>
          <SelectKeeper
            id="sw-section"
            className="sw-filter-select"
            value={section}
            onChange={onSectionChange}
            options={sectionOpts}
            emptyValueLabel="All sections"
            disabled={disabled}
          />
        </div>
        <div className="sw-filter">
          <label htmlFor="sw-status">Status</label>
          <SelectKeeper
            id="sw-status"
            className="sw-filter-select"
            value={statusLocked ? (quickFilter === 'transferred' ? 'TRANSFERRED' : quickFilter === 'alumni' ? 'ALUMNI' : 'INACTIVE') : status}
            onChange={onStatusChange}
            options={STUDENT_STATUS_OPTIONS}
            disabled={disabled || statusLocked}
          />
        </div>
      </div>
    </div>
  );
}
