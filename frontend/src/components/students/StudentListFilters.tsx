import { useMemo } from 'react';
import { SelectKeeper } from '../SelectKeeper';
import { STUDENT_STATUS_OPTIONS } from './studentListTypes';

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
};

export function StudentListFilters({
  search,
  onSearchChange,
  gradeLevel,
  onGradeLevelChange,
  section,
  onSectionChange,
  status,
  onStatusChange,
  gradeOptions,
  sectionOptions,
  disabled,
}: StudentListFiltersProps) {
  const gradeOpts = useMemo(
    () => gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` })),
    [gradeOptions],
  );
  const sectionOpts = useMemo(
    () => sectionOptions.map((sec) => ({ value: sec, label: sec })),
    [sectionOptions],
  );
  const statusOpts = useMemo(
    () => STUDENT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  return (
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
          value={status}
          onChange={onStatusChange}
          options={statusOpts}
          disabled={disabled}
        />
      </div>
      <div className="sw-filter">
        <label htmlFor="sw-missing-docs">Missing documents</label>
        <SelectKeeper
          id="sw-missing-docs"
          className="sw-filter-select"
          value=""
          onChange={() => {}}
          options={[]}
          emptyValueLabel="Later (coming soon)"
          disabled
        />
      </div>
    </div>
  );
}
