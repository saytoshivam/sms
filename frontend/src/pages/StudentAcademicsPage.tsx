import { Navigate } from 'react-router-dom';

/** Legacy URL: combined academics moved to separate Schedule and View marks pages. */
export function StudentAcademicsPage() {
  return <Navigate to="/app/student/schedule" replace />;
}
