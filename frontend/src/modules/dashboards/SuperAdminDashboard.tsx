import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { WorkspaceHero, WorkspaceSection, WorkspaceTileLink } from '../../components/workspace/WorkspaceKit';

export type MeProfile = {
  email: string;
  username: string;
  roles: string[];
  schoolId?: number;
  schoolCode?: string;
  schoolName?: string;
  /** How this school records attendance — from `/user/me`. */
  schoolAttendanceMode?: 'DAILY' | 'LECTURE_WISE';
  linkedStudentId?: number;
  linkedStaffId?: number;
  linkedStudentPhotoUrl?: string | null;
  linkedStudentDisplayName?: string | null;
  linkedStudentAdmissionNo?: string | null;
  linkedStudentClassLabel?: string | null;
  linkedStaffPhotoUrl?: string | null;
  linkedStaffDisplayName?: string | null;
  linkedStaffEmployeeNo?: string | null;
};

export type PlatformSchoolRow = {
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

type Metrics = {
  totalSchools: number;
  activeSchools: number;
  totalStudents: number;
  activeSubscriptions: number;
};

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function subscriptionPillClass(status: string) {
  const k = status.toLowerCase();
  if (k === 'active') return 'platform-sub-pill platform-sub-pill--active';
  if (k === 'none') return 'platform-sub-pill platform-sub-pill--none';
  return 'platform-sub-pill';
}

export function SuperAdminDashboard({ profile }: { profile: MeProfile }) {
  const qc = useQueryClient();
  const schools = useQuery({
    queryKey: ['platform-schools'],
    queryFn: async () => (await api.get<PlatformSchoolRow[]>('/api/v1/platform/schools')).data,
  });

  const metrics = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => (await api.get<Metrics>('/api/v1/platform/metrics')).data,
  });

  const archive = useMutation({
    mutationFn: async (schoolId: number) => {
      await api.delete(`/api/v1/platform/schools/${schoolId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-schools'] });
      qc.invalidateQueries({ queryKey: ['platform-metrics'] });
    },
  });

  const restore = useMutation({
    mutationFn: async (schoolId: number) => {
      await api.post(`/api/v1/platform/schools/${schoolId}/restore`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-schools'] });
      qc.invalidateQueries({ queryKey: ['platform-metrics'] });
    },
  });

  return (
    <div className="workspace-page stack">
      <WorkspaceHero
        eyebrow="MyHaimi platform"
        title="Operations center"
        tag="Super admin"
        subtitle={
          <>
            Signed in as <strong>{profile.email}</strong> — tenants, plans, billing hooks, and safety controls.
          </>
        }
      />

      <div className="workspace-metric-strip">
        <div className="workspace-metric-card">
          <span className="workspace-metric-card__label">Total schools</span>
          <div className="workspace-metric-card__value">{metrics.data?.totalSchools ?? '—'}</div>
          <p className="workspace-metric-card__hint">All tenants (includes archived).</p>
        </div>
        <div className="workspace-metric-card">
          <span className="workspace-metric-card__label">Active schools</span>
          <div className="workspace-metric-card__value">{metrics.data?.activeSchools ?? '—'}</div>
          <p className="workspace-metric-card__hint">Not archived — users can sign in.</p>
        </div>
        <div className="workspace-metric-card">
          <span className="workspace-metric-card__label">Students (all)</span>
          <div className="workspace-metric-card__value">{metrics.data?.totalStudents ?? '—'}</div>
          <p className="workspace-metric-card__hint">Profiles across every school.</p>
        </div>
        <div className="workspace-metric-card">
          <span className="workspace-metric-card__label">Active subscriptions</span>
          <div className="workspace-metric-card__value">{metrics.data?.activeSubscriptions ?? '—'}</div>
          <p className="workspace-metric-card__hint">Plans in ACTIVE status.</p>
        </div>
      </div>

      <WorkspaceSection title="Platform tools" hint="Plans, safety, integrations, and broadcast messaging.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/admin/schools" icon="🏫" label="Schools directory" />
          <WorkspaceTileLink to="/app/admin/plans-features" icon="📋" label="Plans & entitlements" />
          <WorkspaceTileLink to="/app/admin/feature-catalog" icon="🧩" label="Feature catalog" />
          <WorkspaceTileLink to="/app/admin/announcements" icon="📣" label="Announcements" />
          <WorkspaceTileLink to="/app/admin/notifications" icon="🔔" label="Operator notifications" />
          <WorkspaceTileLink to="/app/admin/audit" icon="📜" label="Audit log" />
          <WorkspaceTileLink to="/app/admin/integrations" icon="🔌" label="Payments" />
          <WorkspaceTileLink to="/app/admin/flags" icon="🚩" label="Runtime flags" />
        </div>
      </WorkspaceSection>

      <div className="workspace-panel">
        <div className="workspace-panel__head">
          <h2 className="workspace-panel__title">Schools (tenants)</h2>
          <Link className="btn" to="/app/admin/register-school" style={{ padding: '8px 14px', fontSize: 14 }}>
            Onboard a new school
          </Link>
        </div>
        {schools.isLoading ? (
          <div className="muted">Loading schools…</div>
        ) : schools.isError ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(schools.error)}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
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
                {(schools.data ?? []).map((s) => (
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
                      <span className={subscriptionPillClass(s.subscriptionStatus)}>{s.subscriptionStatus}</span>
                    </td>
                    <td>{s.archived ? <span style={{ color: '#b45309' }}>archived</span> : <span className="muted">active</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link className="muted" to={`/app/admin/schools/${s.schoolId}`} style={{ marginRight: 10 }}>
                        Edit
                      </Link>
                      {!s.archived ? (
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ padding: '4px 10px', fontSize: 13 }}
                          disabled={archive.isPending}
                          onClick={() => {
                            if (confirm(`Archive tenant "${s.name}"? Users cannot sign in until restored.`)) archive.mutate(s.schoolId);
                          }}
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ padding: '4px 10px', fontSize: 13 }}
                          disabled={restore.isPending}
                          onClick={() => restore.mutate(s.schoolId)}
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(schools.data ?? []).length === 0 ? (
              <p className="muted" style={{ margin: '12px 0 0' }}>
                No schools yet. Use <strong>Onboard a new school</strong> to create the first tenant.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="workspace-placeholder">
        <strong>API reference</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--color-text-muted)', fontSize: 14 }}>
          <li>
            Metrics: <code>GET /api/v1/platform/metrics</code>
          </li>
          <li>
            List schools: <code>GET /api/v1/platform/schools</code>
          </li>
          <li>
            Assign plan: <code>{'PUT /api/v1/platform/tenants/{tenantId}/subscription'}</code> with body{' '}
            <code>{'{"planCode":"PREMIUM"}'}</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
