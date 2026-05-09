import type { StudentListRow } from './studentListTypes';

export function StudentDocumentsCell({ row }: { row: StudentListRow }) {
  const v = row.documentVerifiedCount ?? 0;
  const p = row.documentPendingCount ?? 0;
  if (v === 0 && p === 0) {
    return <span className="sw-doc-muted">Not uploaded</span>;
  }
  return (
    <span className="sw-doc-counts">
      <span className="sw-doc-verified">{v} verified</span>
      <span className="sw-doc-sep">·</span>
      <span className="sw-doc-pending">{p} pending</span>
    </span>
  );
}
