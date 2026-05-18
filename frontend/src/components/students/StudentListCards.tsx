import { Link } from 'react-router-dom';
import type { StudentListRow } from './studentListTypes';
import { classSectionLabel, studentFullName } from './studentListTypes';
import { StudentStatusBadge } from './StudentStatusBadge';

export function StudentListCards({ rows }: { rows: StudentListRow[] }) {
  return (
    <div className="sw-cards sw-mobile-only">
      {rows.map((row) => (
        <Link key={row.id} to={`/app/students/${row.id}`} className="sw-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
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
      ))}
    </div>
  );
}
