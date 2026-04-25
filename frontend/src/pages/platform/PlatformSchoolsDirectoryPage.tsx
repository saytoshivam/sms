import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { SelectKeeper } from '../../components/SelectKeeper';

type SchoolRow = {
  schoolId: number;
  name: string;
  code: string;
  registeredAt: string;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string;
  archived: boolean;
  studentCount: number;
};

function includesLoose(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function PlatformSchoolsDirectoryPage() {
  const schools = useQuery({
    queryKey: ['platform-schools'],
    queryFn: async () => (await api.get<SchoolRow[]>('/api/v1/platform/schools')).data,
  });

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState('');

  const statusOptions = useMemo(() => {
    const set = new Set((schools.data ?? []).map((s) => s.subscriptionStatus).filter(Boolean));
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [schools.data]);

  const filtered = useMemo(() => {
    const list = schools.data ?? [];
    const needle = q.trim();
    return list.filter((s) => {
      if (status && s.subscriptionStatus !== status) return false;
      if (archived === 'archived' && !s.archived) return false;
      if (archived === 'active' && s.archived) return false;
      if (!needle) return true;
      const blob = `${s.name} ${s.code} ${s.schoolId} ${s.planCode ?? ''} ${s.planName ?? ''}`.trim();
      return includesLoose(blob, needle);
    });
  }, [schools.data, q, status, archived]);

  const activeCount = (schools.data ?? []).filter((s) => !s.archived).length;

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Schools</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Directory of all tenant schools. Search, filter, then click a school to manage plan, view logs, and see school-specific tools.
      </p>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="row" style={{ alignItems: 'end' }}>
          <div className="stack" style={{ gap: 6, minWidth: 280, flex: '2 1 360px' }}>
            <label>Search</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code, id, plan…" />
          </div>
          <div className="stack" style={{ gap: 6, minWidth: 220, flex: '1 1 220px' }}>
            <label>Subscription status</label>
            <SelectKeeper value={status} onChange={setStatus} options={statusOptions} emptyValueLabel="All statuses" />
          </div>
          <div className="stack" style={{ gap: 6, minWidth: 200, flex: '0 1 200px' }}>
            <label>Tenant</label>
            <SelectKeeper
              value={archived}
              onChange={setArchived}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
              emptyValueLabel="All"
            />
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setQ('');
              setStatus('');
              setArchived('');
            }}
          >
            Clear
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          Showing <strong>{filtered.length}</strong> of {(schools.data ?? []).length} (active {activeCount})
        </div>
      </div>

      {schools.isLoading ? (
        <div className="muted">Loading schools…</div>
      ) : schools.isError ? (
        <div style={{ color: '#b91c1c' }}>{formatApiError(schools.error)}</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="platform-schools-table">
            <thead>
              <tr>
                <th>School</th>
                <th>Code</th>
                <th>Students</th>
                <th>Registered</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Tenant</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.schoolId}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      ID {s.schoolId}
                    </div>
                  </td>
                  <td>
                    <code>{s.code}</code>
                  </td>
                  <td>{s.studentCount}</td>
                  <td>{formatWhen(s.registeredAt)}</td>
                  <td>
                    {s.planName ? (
                      <>
                        {s.planName}
                        {s.planCode ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {s.planCode}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="platform-sub-pill">{s.subscriptionStatus}</span>
                  </td>
                  <td>{s.archived ? <span style={{ color: '#b45309' }}>archived</span> : <span className="muted">active</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} to={`/app/admin/schools/${s.schoolId}`}>
                      Open
                    </Link>
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

