import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type Row = { featureCode: string; name: string; globallyEnabled: boolean };

export function PlatformFeatureCatalogPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['platform-feature-catalog'],
    queryFn: async () => (await api.get<Row[]>('/api/v1/platform/features/catalog')).data,
  });

  const toggle = useMutation({
    mutationFn: async ({ code, enabled }: { code: string; enabled: boolean }) => {
      await api.patch(`/api/v1/platform/features/catalog/${encodeURIComponent(code)}`, { globallyEnabled: enabled });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-feature-catalog'] }),
  });

  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Global product features</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Master switches for subscription features. When off, the capability is unavailable for every school regardless of plan.
      </p>
      {q.isLoading ? (
        <div className="muted">Loading…</div>
      ) : q.isError ? (
        <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error)}</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="platform-schools-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Globally enabled</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((row) => (
                <tr key={row.featureCode}>
                  <td>{row.name}</td>
                  <td>
                    <code>{row.featureCode}</code>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.globallyEnabled}
                      onChange={(e) => toggle.mutate({ code: row.featureCode, enabled: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
