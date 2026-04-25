import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SelectKeeper } from '../components/SelectKeeper';

type RegisterResponse = { schoolId: number; schoolCode: string };
type Plan = { planCode: string; name: string; description?: string | null; active?: boolean | null };

export function RegisterSchoolPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [schoolName, setSchoolName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [domain, setDomain] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ roles: string[] }>('/user/me')).data,
  });

  const isSuperAdmin = (me.data?.roles ?? []).includes('SUPER_ADMIN');

  const plans = useQuery({
    queryKey: ['platform-plans'],
    queryFn: async () => (await api.get<Plan[]>('/api/v1/platform/plans')).data,
    enabled: isSuperAdmin,
  });

  const planOptions = (plans.data ?? [])
    .filter((p) => p.active !== false)
    .map((p) => ({ value: p.planCode, label: p.name ? `${p.name} (${p.planCode})` : p.planCode }));

  return (
    <div className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ margin: 0 }}>Onboard a new school (MyHaimi)</h2>
        {me.isLoading ? <div className="muted">Checking permissions…</div> : null}
        {!me.isLoading && !isSuperAdmin ? (
          <div className="card">
            <div className="stack">
              <div>
                <strong>Access denied</strong>
              </div>
              <div className="muted">
                Only MyHaimi platform administrators (<code>SUPER_ADMIN</code>) can create new schools.
              </div>
              <Link className="muted" to="/app">
                Back to dashboard
              </Link>
            </div>
          </div>
        ) : null}
        {!me.isLoading && isSuperAdmin ? (
          <div className="card">
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setLoading(true);
                try {
                  const res = await api.post<RegisterResponse>('/admin/schools/register', {
                    schoolName,
                    schoolCode,
                    domain: domain.trim() || null,
                    adminUsername,
                    adminEmail,
                    adminPassword,
                    planCode,
                  });
                  await qc.invalidateQueries({ queryKey: ['platform-schools'] });
                  await qc.invalidateQueries({ queryKey: ['platform-metrics'] });
                  navigate('/app', { state: { registered: res.data } });
                } catch (err: any) {
                  setError(err?.response?.data ?? 'Registration failed');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="stack">
                <div className="row">
                  <div style={{ flex: 1 }} className="stack">
                    <label>School name</label>
                    <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }} className="stack">
                    <label>School code (unique)</label>
                    <input
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      placeholder="greenwood-high"
                    />
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: 1 }} className="stack">
                    <label>Domain (optional)</label>
                    <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="greenwood.edu" />
                  </div>
                  <div style={{ flex: 1 }} className="stack">
                    <label>Plan</label>
                    <SelectKeeper
                      value={planCode}
                      onChange={setPlanCode}
                      emptyValueLabel={plans.isLoading ? 'Loading plans…' : 'Select a plan…'}
                      options={planOptions}
                      disabled={plans.isLoading || plans.isError}
                    />
                    {plans.isError ? (
                      <div style={{ color: '#b91c1c', fontSize: 12 }}>Could not load plans.</div>
                    ) : null}
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: 1 }} className="stack">
                    <label>Admin username</label>
                    <input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }} className="stack">
                    <label>Admin email</label>
                    <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                  </div>
                </div>
                <div className="stack">
                  <label>Admin password</label>
                  <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} type="password" />
                </div>
              </div>

              {error ? <div style={{ color: '#b91c1c' }}>{String(error)}</div> : null}
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn" disabled={loading || !planCode}>
                  {loading ? 'Creating…' : 'Create school'}
                </button>
                <Link className="muted" to="/app">
                  Back to dashboard
                </Link>
              </div>
            </form>
          </div>
        ) : null}
        <div className="muted" style={{ fontSize: 12 }}>
          This will create the first user for the school with role <code>SCHOOL_ADMIN</code>.
        </div>
    </div>
  );
}

