import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { defaultAppHomePath } from '../lib/roleGroups';
import { OperationsHubPage } from './OperationsHubPage';

/**
 * `/app` index: operations hub for most roles; school leadership lands on `/app/dashboard`.
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
