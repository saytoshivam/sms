import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { defaultAppHomePath } from '../lib/roleGroups';
import { OperationsHubPage } from './OperationsHubPage';

/**
 * `/app` index: redirects roles with a persona dashboard there; otherwise shows {@link OperationsHubPage}.
 * The hub is always available at `/app/operations-hub` (sidebar «Operations hub» / «School hub»).
 */
export function AppHomeRoute() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ roles: string[] }>('/user/me')).data,
  });

  if (me.isLoading) {
    return <div className="muted">Loading…</div>;
  }
  if (me.isError || !me.data) {
    return <OperationsHubPage />;
  }

  const path = defaultAppHomePath(me.data.roles);
  if (path === '/app/dashboard') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <OperationsHubPage />;
}
