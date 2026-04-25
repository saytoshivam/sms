import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMemo, useState } from 'react';
import { SelectKeeper } from '../../components/SelectKeeper';

type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

type LogRow = {
  id: number;
  occurredAt: string;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  detail: string | null;
};

function includesLoose(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function PlatformAuditPage() {
  const q = useQuery({
    queryKey: ['platform-audit-logs'],
    queryFn: async () => (await api.get<Page<LogRow>>('/api/v1/platform/audit-logs?size=100')).data,
  });

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');

  const rows = q.data?.content ?? [];

  const actionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.action).filter(Boolean));
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const resourceTypeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.resourceType ?? '').filter(Boolean));
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim();
    return rows.filter((r) => {
      if (actionFilter && r.action !== actionFilter) return false;
      if (resourceTypeFilter && (r.resourceType ?? '') !== resourceTypeFilter) return false;
      if (!s) return true;
      const blob = [
        r.actorEmail ?? '',
        r.action ?? '',
        r.resourceType ?? '',
        r.resourceId ?? '',
        r.detail ?? '',
      ].join(' ');
      return includesLoose(blob, s);
    });
  }, [rows, search, actionFilter, resourceTypeFilter]);

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Audit log</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Immutable trail of platform-owner actions (school lifecycle, entitlements, payments, announcements).
      </p>
      {q.isLoading ? (
        <div className="muted">Loading…</div>
      ) : q.isError ? (
        <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error)}</div>
      ) : (
        <>
          <div className="card stack" style={{ gap: 12 }}>
            <div className="row" style={{ alignItems: 'end' }}>
              <div className="stack" style={{ gap: 6, minWidth: 260, flex: '2 1 320px' }}>
                <label>Search</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Actor, action, resource id, tenantId, plan code…"
                />
              </div>
              <div className="stack" style={{ gap: 6, minWidth: 240, flex: '1 1 240px' }}>
                <label>Action</label>
                <SelectKeeper
                  value={actionFilter}
                  onChange={setActionFilter}
                  options={actionOptions}
                  emptyValueLabel="All actions"
                />
              </div>
              <div className="stack" style={{ gap: 6, minWidth: 220, flex: '1 1 220px' }}>
                <label>Resource type</label>
                <SelectKeeper
                  value={resourceTypeFilter}
                  onChange={setResourceTypeFilter}
                  options={resourceTypeOptions}
                  emptyValueLabel="All resource types"
                />
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setSearch('');
                  setActionFilter('');
                  setResourceTypeFilter('');
                }}
              >
                Clear
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Showing <strong>{filtered.length}</strong> of {rows.length}
            </div>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="platform-schools-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{new Date(r.occurredAt).toLocaleString()}</td>
                  <td>{r.actorEmail ?? '—'}</td>
                  <td>
                    <code>{r.action}</code>
                  </td>
                  <td>
                    {r.resourceType ?? '—'} {r.resourceId ? `#${r.resourceId}` : ''}
                  </td>
                  <td style={{ fontSize: 13, maxWidth: 280 }}>{r.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
