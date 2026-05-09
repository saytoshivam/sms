import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import type { ClassGroupRef } from './types';
import './teacherWorkspace.css';

export function TeacherMyClassesPage() {
  const q = useQuery({
    queryKey: ['teacher-my-class-groups'],
    queryFn: async () => (await api.get<ClassGroupRef[]>('/api/v1/teacher/my-class-groups')).data,
  });

  return (
    <div className="workspace-feature-page tws-page">
      <div className="tws-toolbar">
        <h2>My classes</h2>
      </div>
      <p className="workspace-feature-page__lead" style={{ marginTop: -6 }}>
        Sections you teach from the published timetable. Open a class workspace for roster, attendance links, and progress.
      </p>

      {q.isLoading ? <p className="muted">Loading…</p> : null}
      {q.error ? <p style={{ color: '#b91c1c' }}>{formatApiError(q.error)}</p> : null}
      {q.isSuccess && (q.data?.length ?? 0) === 0 ? (
        <div className="tws-placeholder">
          <div className="tws-placeholder__title">No class groups mapped</div>
          <p>
            Your staff profile needs published timetable assignments, or mapped teachable subjects. Ask your timetable
            coordinator if this looks wrong.
          </p>
        </div>
      ) : null}

      {q.isSuccess && q.data && q.data.length > 0 ? (
        <div className="tws-class-grid">
          {q.data.map((cg) => (
            <Link key={cg.id} className="tws-class-card" to={`/app/teacher/classes/${cg.id}`}>
              <span className="tws-class-card__title">{cg.displayName}</span>
              <span className="tws-class-card__meta">{cg.code.trim() ? `Code ${cg.code}` : `ID ${cg.id}`}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
