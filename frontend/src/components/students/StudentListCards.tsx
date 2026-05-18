import { Link } from 'react-router-dom';
import type { StudentListRow } from './studentListTypes';
import { classSectionLabel, studentFullName } from './studentListTypes';
import { StudentStatusBadge } from './StudentStatusBadge';
import { StudentRowActions } from './StudentRowActions';

type Props = {
  rows: StudentListRow[];
  onRefetch?: () => void;
};

export function StudentListCards({ rows, onRefetch }: Props) {
  return (
    <div className="sw-cards sw-mobile-only">
      {rows.map((row) => (
        <div key={row.id} className="sw-card" style={{ position: 'relative' }}>
          <Link to={`/app/students/${row.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <article>
              <div className="sw-card-main">
                <div className="sw-card-title">{studentFullName(row)}</div>
                <div className="sw-card-lines">
                  <div>
                    <span className="sw-card-k">Admission</span> {row.admissionNo}
                  </div>
                  <div>
                    <span className="sw-card-k">Class</span> {classSectionLabel(row)}
                  </div>
                  <div>
                    <span className="sw-card-k">Guardian</span>{' '}
                    <span className="sw-mono">{row.primaryGuardianPhone?.trim() || '—'}</span>
                  </div>
                </div>
                <div className="sw-card-badge">
                  <StudentStatusBadge status={row.status ?? undefined} />
                </div>
              </div>
            </article>
          </Link>
          <div
            style={{ position: 'absolute', top: 8, right: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <StudentRowActions
              studentId={row.id}
              studentName={studentFullName(row)}
              onDeleted={onRefetch}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
