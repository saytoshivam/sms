import type { StudentListRow } from './studentListTypes';
import { classSectionLabel, studentFullName } from './studentListTypes';
import { StudentAvatar } from './StudentAvatar';
import { StudentDocumentsCell } from './StudentDocumentsCell';
import { StudentRowActions } from './StudentRowActions';
import { StudentStatusBadge } from './StudentStatusBadge';

type Props = {
  rows: StudentListRow[];
  selectedIds: Set<number>;
  onToggleRow: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

export function StudentListTable({ rows, selectedIds, onToggleRow, onSelectAll, onClearAll }: Props) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = !allSelected && rows.some((r) => selectedIds.has(r.id));

  return (
    <div className="sw-table-wrap sw-desktop-only">
      <table className="sw-table">
        <thead>
          <tr>
            <th scope="col" className="sw-th-check">
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={(e) => e.target.checked ? onSelectAll() : onClearAll()}
              />
            </th>
            <th scope="col">Student</th>
            <th scope="col">Class / section</th>
            <th scope="col">Roll no</th>
            <th scope="col">Guardian</th>
            <th scope="col">Status</th>
            <th scope="col">Documents</th>
            <th scope="col" className="sw-th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sel = selectedIds.has(row.id);
            return (
              <tr key={row.id} className={sel ? 'sw-row-selected' : undefined}>
                <td className="sw-td-check">
                  <input
                    type="checkbox"
                    aria-label={`Select ${studentFullName(row)}`}
                    checked={sel}
                    onChange={() => onToggleRow(row.id)}
                  />
                </td>
                <td>
                  <div className="sw-cell-student">
                    <StudentAvatar student={row} size={32} />
                    <div className="sw-cell-student-meta">
                      <div className="sw-name">{studentFullName(row)}</div>
                      <div className="sw-sub">{row.admissionNo}</div>
                    </div>
                  </div>
                </td>
                <td>{classSectionLabel(row)}</td>
                <td className="sw-mono">{row.rollNo?.trim() || '—'}</td>
                <td>
                  <div className="sw-guardian">
                    <div>{row.primaryGuardianName?.trim() || '—'}</div>
                    <div className="sw-sub sw-mono">{row.primaryGuardianPhone?.trim() || '—'}</div>
                  </div>
                </td>
                <td><StudentStatusBadge status={row.status ?? undefined} /></td>
                <td><StudentDocumentsCell row={row} /></td>
                <td className="sw-td-actions">
                  <StudentRowActions studentId={row.id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
