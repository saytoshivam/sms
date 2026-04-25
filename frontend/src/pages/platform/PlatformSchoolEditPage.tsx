import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import type { PlatformSchoolRow } from '../../modules/dashboards/SuperAdminDashboard';
import { SelectKeeper } from '../../components/SelectKeeper';

type Plan = { id: number; planCode: string; name: string; description: string | null; active: boolean };
type AuditPage<T> = { content: T[] };
type AuditRow = {
  id: number;
  occurredAt: string;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  detail: string | null;
};
type NotifPage<T> = { content: T[] };
type NotifRow = {
  id: number;
  createdAt: string;
  kind: string;
  title: string;
  body: string | null;
  tenantId: number | null;
  actorEmail: string | null;
  read: boolean;
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

function includesLoose(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function PlatformSchoolEditPage() {
  const { schoolId } = useParams();
  const id = Number(schoolId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'subscription' | 'logs' | 'notifications'>('overview');

  const school = useQuery({
    queryKey: ['platform-school', id],
    queryFn: async () => (await api.get<PlatformSchoolRow>(`/api/v1/platform/schools/${id}`)).data,
    enabled: Number.isFinite(id),
  });

  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const plans = useQuery({
    queryKey: ['platform-plans'],
    queryFn: async () => (await api.get<Plan[]>('/api/v1/platform/plans')).data,
  });

  const [assignPlanCode, setAssignPlanCode] = useState('PREMIUM');
  const [status, setStatus] = useState('ACTIVE');

  useEffect(() => {
    if (!school.data) return;
    if (school.data.planCode) setAssignPlanCode(school.data.planCode);
    if (school.data.subscriptionStatus) setStatus(school.data.subscriptionStatus);
  }, [school.data]);

  const assignPlan = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(id)) throw new Error('Invalid tenant id');
      await api.put(`/api/v1/platform/tenants/${id}/subscription`, { planCode: assignPlanCode });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['platform-schools'] });
      await qc.invalidateQueries({ queryKey: ['platform-school', id] });
      toast.success('Saved', `Applied plan ${assignPlanCode}.`);
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const patchStatus = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(id)) throw new Error('Invalid tenant id');
      await api.patch(`/api/v1/platform/tenants/${id}/subscription/status`, { status });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['platform-schools'] });
      await qc.invalidateQueries({ queryKey: ['platform-school', id] });
      toast.success('Saved', `Subscription status updated to ${status}.`);
    },
    onError: (e) => toast.error('Update failed', formatApiError(e)),
  });

  const audit = useQuery({
    queryKey: ['platform-audit-logs', id],
    queryFn: async () => (await api.get<AuditPage<AuditRow>>('/api/v1/platform/audit-logs?size=200')).data,
    enabled: Number.isFinite(id) && (tab === 'logs' || tab === 'overview'),
  });
  const [auditSearch, setAuditSearch] = useState('');

  const auditRowsForSchool = useMemo(() => {
    const all = audit.data?.content ?? [];
    const needle = `tenantId=${id}`;
    const idStr = String(id);
    return all.filter((r) => {
      if ((r.resourceId ?? '') === idStr) return true;
      if ((r.detail ?? '').includes(needle)) return true;
      return false;
    });
  }, [audit.data, id]);

  const auditFiltered = useMemo(() => {
    const s = auditSearch.trim();
    if (!s) return auditRowsForSchool;
    return auditRowsForSchool.filter((r) => {
      const blob = [r.actorEmail ?? '', r.action ?? '', r.resourceType ?? '', r.resourceId ?? '', r.detail ?? ''].join(' ');
      return includesLoose(blob, s);
    });
  }, [auditRowsForSchool, auditSearch]);

  const notifications = useQuery({
    queryKey: ['platform-operator-notifications', id],
    queryFn: async () =>
      (await api.get<NotifPage<NotifRow>>('/api/v1/platform/operator-notifications?size=200')).data,
    enabled: Number.isFinite(id) && (tab === 'notifications' || tab === 'overview'),
  });

  const notifRowsForSchool = useMemo(() => {
    const all = notifications.data?.content ?? [];
    return all.filter((n) => n.tenantId === id);
  }, [notifications.data, id]);

  useEffect(() => {
    if (school.data) {
      setName(school.data.name);
      setCode(school.data.code);
    }
  }, [school.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/api/v1/platform/schools/${id}`, { name, code });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-schools'] });
      toast.success('Saved', 'School updated.');
      navigate('/app');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const planOptions = useMemo(() => {
    const fromApi = plans.data?.map((p) => p.planCode) ?? [];
    return fromApi.length ? fromApi : ['BASIC', 'PREMIUM', 'ENTERPRISE'];
  }, [plans.data]);

  return (
    <div className="stack" style={{ maxWidth: 960 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          {school.data?.name ?? 'School'} <span className="muted">· ID {id}</span>
        </h2>
        <Link className="muted" to="/app/admin/schools">
          ← Schools directory
        </Link>
      </div>
      {school.isLoading ? (
        <div className="muted">Loading…</div>
      ) : school.isError ? (
        <div style={{ color: '#b91c1c' }}>{String((school.error as any)?.response?.data ?? school.error)}</div>
      ) : (
        <>
          <div className="card row" style={{ gap: 10 }}>
            <button
              type="button"
              className={tab === 'overview' ? 'btn' : 'btn secondary'}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={tab === 'subscription' ? 'btn' : 'btn secondary'}
              onClick={() => setTab('subscription')}
            >
              Subscription
            </button>
            <button type="button" className={tab === 'logs' ? 'btn' : 'btn secondary'} onClick={() => setTab('logs')}>
              Logs
            </button>
            <button
              type="button"
              className={tab === 'notifications' ? 'btn' : 'btn secondary'}
              onClick={() => setTab('notifications')}
            >
              Notifications
            </button>
            <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
              Code: <code>{school.data?.code}</code>
            </span>
          </div>

          {tab === 'overview' ? (
            <div className="card stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div className="stack" style={{ gap: 2 }}>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Subscription
                  </div>
                  <div style={{ fontWeight: 900 }}>
                    {school.data?.planName ?? school.data?.planCode ?? '—'}{' '}
                    <span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>
                      ({school.data?.subscriptionStatus ?? '—'})
                    </span>
                  </div>
                </div>
                <div className="row" style={{ gap: 10 }}>
                  <button type="button" className="btn secondary" onClick={() => setTab('subscription')}>
                    Change plan / status
                  </button>
                  <button type="button" className="btn secondary" onClick={() => setTab('logs')}>
                    View logs
                  </button>
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Recent logs: <strong>{auditRowsForSchool.length}</strong> · Notifications: <strong>{notifRowsForSchool.length}</strong>
              </div>
            </div>
          ) : null}

          {tab === 'subscription' ? (
            <div className="card stack">
              <strong>Billing & subscription</strong>
              <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div className="stack" style={{ minWidth: 220, flex: '1 1 260px' }}>
                  <label>Assign plan</label>
                  <SelectKeeper
                    value={assignPlanCode}
                    onChange={setAssignPlanCode}
                    options={planOptions.map((c) => ({ value: c, label: c }))}
                  />
                </div>
                <button
                  className="btn"
                  type="button"
                  disabled={assignPlan.isPending || !assignPlanCode}
                  onClick={() => assignPlan.mutate()}
                >
                  {assignPlan.isPending ? 'Saving…' : 'Apply plan'}
                </button>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div className="stack" style={{ minWidth: 220, flex: '1 1 260px' }}>
                  <label>Subscription status</label>
                  <SelectKeeper
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: 'ACTIVE', label: 'ACTIVE' },
                      { value: 'CANCELLED', label: 'CANCELLED' },
                      { value: 'EXPIRED', label: 'EXPIRED' },
                    ]}
                  />
                </div>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={patchStatus.isPending || !status}
                  onClick={() => patchStatus.mutate()}
                >
                  {patchStatus.isPending ? 'Updating…' : 'Update status'}
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'logs' ? (
            <div className="card stack">
              <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>School logs</strong>
                <Link className="muted" to="/app/admin/audit">
                  Open full audit log →
                </Link>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <label>Search logs</label>
                <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Action, actor, detail…" />
              </div>
              {audit.isLoading ? (
                <div className="muted">Loading logs…</div>
              ) : audit.isError ? (
                <div style={{ color: '#b91c1c' }}>{formatApiError(audit.error)}</div>
              ) : auditFiltered.length === 0 ? (
                <div className="muted">No matching log rows.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
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
                      {auditFiltered.slice(0, 80).map((r) => (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{formatWhen(r.occurredAt)}</td>
                          <td>{r.actorEmail ?? '—'}</td>
                          <td>
                            <code>{r.action}</code>
                          </td>
                          <td>
                            {r.resourceType ?? '—'} {r.resourceId ? `#${r.resourceId}` : ''}
                          </td>
                          <td style={{ fontSize: 13, maxWidth: 320 }}>{r.detail ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Showing {Math.min(80, auditFiltered.length)} of {auditFiltered.length} school-matched rows (from latest 200 platform logs).
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'notifications' ? (
            <div className="card stack">
              <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>Operator notifications for this school</strong>
                <Link className="muted" to="/app/admin/notifications">
                  Open all notifications →
                </Link>
              </div>
              {notifications.isLoading ? (
                <div className="muted">Loading notifications…</div>
              ) : notifications.isError ? (
                <div style={{ color: '#b91c1c' }}>{formatApiError(notifications.error)}</div>
              ) : notifRowsForSchool.length === 0 ? (
                <div className="muted">No notifications for this school yet.</div>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {notifRowsForSchool.slice(0, 30).map((n) => (
                    <div
                      key={n.id}
                      className={`card stack platform-op-notif-card${n.read ? '' : ' platform-op-notif-card--unread'}`}
                      style={{ gap: 6 }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: n.read ? 700 : 900 }}>{n.title}</div>
                        <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {formatWhen(n.createdAt)}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{n.body ?? '—'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        <code>{n.kind}</code>
                        {n.actorEmail ? (
                          <>
                            {' '}
                            · From <strong>{n.actorEmail}</strong>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <div className="muted" style={{ fontSize: 12 }}>
                    Showing {Math.min(30, notifRowsForSchool.length)} of {notifRowsForSchool.length}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Basic profile edits live under Overview */}
          {tab === 'overview' ? (
            <div className="card stack">
              <strong>School profile</strong>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
              <label>Code (slug)</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} />
              <div className="row" style={{ gap: 12 }}>
                <button
                  className="btn"
                  type="button"
                  disabled={save.isPending || !name.trim() || !code.trim()}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn secondary" onClick={() => navigate('/app/admin/schools')}>
                  Back to directory
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
