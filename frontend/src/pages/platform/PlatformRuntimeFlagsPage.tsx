import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type Flag = { id: number; flagKey: string; enabled: boolean; description: string | null };

export function PlatformRuntimeFlagsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['platform-runtime-flags'],
    queryFn: async () => (await api.get<Flag[]>('/api/v1/platform/flags')).data,
  });

  const patch = useMutation({
    mutationFn: async ({ id, enabled, description }: { id: number; enabled: boolean; description?: string }) => {
      await api.patch(`/api/v1/platform/flags/${id}`, { enabled, description });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-runtime-flags'] }),
  });

  return (
    <div className="stack" style={{ maxWidth: 800 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Runtime feature flags</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Operational toggles (maintenance mode, signup gates, etc.). Wire additional checks in application code as needed.
      </p>
      {q.isLoading ? (
        <div className="muted">Loading…</div>
      ) : q.isError ? (
        <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error)}</div>
      ) : (
        <div className="card stack">
          {(q.data ?? []).map((f) => (
            <div key={f.id} className="stack" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <code>{f.flagKey}</code>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {f.description ?? '—'}
                  </div>
                </div>
                <label className="row" style={{ gap: 8, alignItems: 'center' }}>
                  Enabled
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) => patch.mutate({ id: f.id, enabled: e.target.checked })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
