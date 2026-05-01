import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { PlatformSchoolSearchCombobox } from '../../components/PlatformSchoolSearchCombobox';
import { SmartSelect } from '../../components/SmartSelect';

type Plan = { id: number; planCode: string; name: string; description: string | null; active: boolean };
type PlanFeatureRow = { featureCode: string; name: string; enabled: boolean };

export function PlatformPlansFeaturesPage() {
  const qc = useQueryClient();
  const [planCode, setPlanCode] = useState('BASIC');
  const [tenantId, setTenantId] = useState('');
  const [assignPlanCode, setAssignPlanCode] = useState('PREMIUM');
  const [status, setStatus] = useState('ACTIVE');

  const plans = useQuery({
    queryKey: ['platform-plans'],
    queryFn: async () => (await api.get<Plan[]>('/api/v1/platform/plans')).data,
  });

  const features = useQuery({
    queryKey: ['platform-plan-features', planCode],
    queryFn: async () =>
      (await api.get<PlanFeatureRow[]>(`/api/v1/platform/plans/${encodeURIComponent(planCode)}/features`)).data,
    enabled: !!planCode,
  });

  const toggleFeature = useMutation({
    mutationFn: async ({ code, enabled }: { code: string; enabled: boolean }) => {
      await api.put(`/api/v1/platform/plans/${encodeURIComponent(planCode)}/features/${encodeURIComponent(code)}`, {
        enabled,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-plan-features', planCode] });
      toast.success('Saved', 'Entitlement updated.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const assignPlan = useMutation({
    mutationFn: async () => {
      const id = Number(tenantId);
      if (!Number.isFinite(id)) throw new Error('Invalid tenant id');
      await api.put(`/api/v1/platform/tenants/${id}/subscription`, { planCode: assignPlanCode });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-schools'] });
      toast.success('Saved', `Applied plan ${assignPlanCode} to tenant ${tenantId || '—'}.`);
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const patchStatus = useMutation({
    mutationFn: async () => {
      const id = Number(tenantId);
      if (!Number.isFinite(id)) throw new Error('Invalid tenant id');
      await api.patch(`/api/v1/platform/tenants/${id}/subscription/status`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-schools'] });
      toast.success('Saved', `Subscription status updated to ${status}.`);
    },
    onError: (e) => toast.error('Update failed', formatApiError(e)),
  });

  const planOptions = useMemo(() => {
    const fromApi = plans.data?.map((p) => p.planCode) ?? [];
    return fromApi.length ? fromApi : ['BASIC', 'PREMIUM', 'ENTERPRISE'];
  }, [plans.data]);

  return (
    <div className="stack" style={{ maxWidth: 960 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Plans & entitlements</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Assign subscription plans to tenants and toggle which product modules each plan includes.
      </p>

      <div className="card stack">
        <strong>Billing & subscription</strong>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="stack" style={{ minWidth: 260, flex: '2 1 320px' }}>
            <label>Tenant (school)</label>
            <PlatformSchoolSearchCombobox value={tenantId} onChange={setTenantId} placeholder="Search by name, code, or id…" />
          </div>
          <div className="stack" style={{ minWidth: 140 }}>
            <label>Assign plan</label>
            <SmartSelect
              value={assignPlanCode}
              onChange={setAssignPlanCode}
              options={planOptions.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <button className="btn" type="button" disabled={assignPlan.isPending} onClick={() => assignPlan.mutate()}>
            {assignPlan.isPending ? 'Saving…' : 'Apply plan'}
          </button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="stack" style={{ minWidth: 140 }}>
            <label>Subscription status</label>
            <SmartSelect
              value={status}
              onChange={setStatus}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'CANCELLED', label: 'CANCELLED' },
                { value: 'EXPIRED', label: 'EXPIRED' },
              ]}
            />
          </div>
          <button className="btn secondary" type="button" disabled={patchStatus.isPending} onClick={() => patchStatus.mutate()}>
            {patchStatus.isPending ? 'Updating…' : 'Update status'}
          </button>
        </div>
        {(assignPlan.isError || patchStatus.isError) && (
          <div style={{ color: '#b91c1c' }}>{String((assignPlan.error || patchStatus.error) as any)}</div>
        )}
      </div>

      <div className="card stack">
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Features per plan</strong>
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            Plan
            <SmartSelect
              value={planCode}
              onChange={setPlanCode}
              options={planOptions.map((c) => ({ value: c, label: c }))}
              style={{ minWidth: 140 }}
            />
          </label>
        </div>
        {features.isLoading ? (
          <div className="muted">Loading…</div>
        ) : features.isError ? (
          <div style={{ color: '#b91c1c' }}>{String((features.error as any)?.response?.data ?? features.error)}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="platform-schools-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Code</th>
                  <th>Enabled for plan</th>
                </tr>
              </thead>
              <tbody>
                {(features.data ?? []).map((row) => (
                  <tr key={row.featureCode}>
                    <td>{row.name}</td>
                    <td>
                      <code>{row.featureCode}</code>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) =>
                          toggleFeature.mutate({ code: row.featureCode, enabled: e.target.checked })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
