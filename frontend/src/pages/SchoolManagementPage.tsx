import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { SelectKeeper } from '../components/SelectKeeper';
import { toast } from '../lib/toast';
import type { MeProfile } from '../modules/dashboards/SuperAdminDashboard';

type Overview = {
  fees: {
    studentCount: number;
    totalInvoiced: string | number;
    totalCollected: string | number;
    outstandingPending: string | number;
    invoiceCount: number;
    openInvoiceCount: number;
  };
  subscriptionPlanCode: string | null;
  subscriptionPlanName: string | null;
  subscriptionStatus: string;
  staffCount: number;
  classGroupCount: number;
  newStudentsLast30Days: number;
  newStudentsPrior30Days: number;
  enrollmentGrowthPercent: string | number;
};

type PlanRow = { planCode: string; name: string; description: string };

function inr(n: string | number): string {
  const v = typeof n === 'string' ? Number.parseFloat(n) : n;
  if (Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v);
}

export function SchoolManagementPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: async () => (await api.get<MeProfile>('/user/me')).data });
  const isSchoolOwner = (me.data?.roles ?? []).includes('SCHOOL_ADMIN');

  const overview = useQuery({
    queryKey: ['school-management-overview'],
    queryFn: async () => (await api.get<Overview>('/api/v1/school/management/overview')).data,
  });

  const catalog = useQuery({
    queryKey: ['school-plan-catalog'],
    queryFn: async () => (await api.get<PlanRow[]>('/api/v1/school/management/subscription/catalog')).data,
  });

  const [targetPlan, setTargetPlan] = useState('');
  const [planNote, setPlanNote] = useState('');

  const planRequest = useMutation({
    mutationFn: async () =>
      api.post('/api/v1/school/management/subscription/plan-request', {
        targetPlanCode: targetPlan,
        message: planNote || undefined,
      }),
    onSuccess: async () => {
      setPlanNote('');
      await qc.invalidateQueries({ queryKey: ['school-management-overview'] });
      toast.success('Request submitted', 'Plan change request sent to platform operators.');
    },
    onError: (e) => toast.error('Request failed', formatApiError(e)),
  });

  const growth = useMemo(() => {
    const v = overview.data?.enrollmentGrowthPercent;
    if (v == null) return '—';
    const n = typeof v === 'string' ? Number.parseFloat(v) : v;
    if (Number.isNaN(n)) return '—';
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  }, [overview.data?.enrollmentGrowthPercent]);

  return (
    <div className="workspace-feature-page stack">
      <div className="workspace-hero">
        <div className="workspace-hero__top">
          <p className="workspace-hero__eyebrow">School management</p>
          <span className="workspace-hero__tag">Business</span>
        </div>
        <h1 className="workspace-hero__title">Owner & leadership</h1>
        <p className="workspace-hero__subtitle">
          Revenue, enrollment, subscription tier, and who has access. Plan upgrades are coordinated with the platform —
          requests are logged for the operations team.
        </p>
      </div>

      {overview.isLoading ? (
        <div className="muted">Loading overview…</div>
      ) : overview.isError ? (
        <div style={{ color: '#b91c1c' }}>{formatApiError(overview.error)}</div>
      ) : overview.data ? (
        <>
          <div className="workspace-metric-strip">
            <div className="workspace-metric-card">
              <span className="workspace-metric-card__label">Revenue (collected)</span>
              <div className="workspace-metric-card__value">{inr(overview.data.fees.totalCollected)}</div>
              <p className="workspace-metric-card__hint">Confirmed fee payments (excludes voided invoices).</p>
            </div>
            <div className="workspace-metric-card">
              <span className="workspace-metric-card__label">Outstanding fees</span>
              <div className="workspace-metric-card__value">{inr(overview.data.fees.outstandingPending)}</div>
              <p className="workspace-metric-card__hint">{overview.data.fees.openInvoiceCount} open invoice(s).</p>
            </div>
            <div className="workspace-metric-card">
              <span className="workspace-metric-card__label">Students</span>
              <div className="workspace-metric-card__value">{overview.data.fees.studentCount}</div>
              <p className="workspace-metric-card__hint">Enrollment count in this school.</p>
            </div>
            <div className="workspace-metric-card">
              <span className="workspace-metric-card__label">Student growth (enrollment)</span>
              <div className="workspace-metric-card__value">{growth}</div>
              <p className="workspace-metric-card__hint">
                New profiles last 30 days: {overview.data.newStudentsLast30Days} · prior 30 days:{' '}
                {overview.data.newStudentsPrior30Days}
              </p>
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="workspace-metric-card" style={{ flex: '1 1 200px' }}>
              <span className="workspace-metric-card__label">Staff profiles</span>
              <div className="workspace-metric-card__value">{overview.data.staffCount}</div>
            </div>
            <div className="workspace-metric-card" style={{ flex: '1 1 200px' }}>
              <span className="workspace-metric-card__label">Class sections</span>
              <div className="workspace-metric-card__value">{overview.data.classGroupCount}</div>
            </div>
          </div>
        </>
      ) : null}

      <div className="workspace-panel">
        <h2 className="workspace-panel__title">Subscription & plan</h2>
        <p className="muted" style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.5 }}>
          Current:{' '}
          <strong>
            {overview.data?.subscriptionPlanName ?? overview.data?.subscriptionPlanCode ?? '—'} (
            {overview.data?.subscriptionStatus ?? '—'})
          </strong>
          . Upgrades/downgrades are applied by the platform team after review.
        </p>
        {catalog.isLoading ? (
          <div className="muted">Loading plans…</div>
        ) : catalog.isError ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(catalog.error)}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Plan</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {(catalog.data ?? []).map((p) => (
                  <tr key={p.planCode}>
                    <td>
                      <code>{p.planCode}</code>
                    </td>
                    <td>{p.name}</td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {p.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isSchoolOwner ? (
          <form
            className="stack"
            style={{ marginTop: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!targetPlan.trim()) return;
              planRequest.mutate();
            }}
          >
            <strong style={{ fontSize: 14 }}>Request plan change</strong>
            <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }} className="stack">
                <label htmlFor="school-target-plan">Target plan</label>
                <SelectKeeper
                  id="school-target-plan"
                  value={targetPlan}
                  onChange={setTargetPlan}
                  options={(catalog.data ?? []).map((p) => ({
                    value: p.planCode,
                    label: `${p.name} (${p.planCode})`,
                  }))}
                  emptyValueLabel="Select…"
                />
              </div>
              <div style={{ flex: '2 1 280px' }} className="stack">
                <label>Note to platform (optional)</label>
                <input
                  value={planNote}
                  onChange={(e) => setPlanNote(e.target.value)}
                  placeholder="Billing contact, timing, …"
                />
              </div>
              <button type="submit" className="btn" disabled={planRequest.isPending || !targetPlan.trim()}>
                {planRequest.isPending ? 'Sending…' : 'Submit request'}
              </button>
            </div>
            {planRequest.isError ? (
              <div style={{ color: '#b91c1c', fontSize: 14 }}>{formatApiError(planRequest.error)}</div>
            ) : null}
            {planRequest.isSuccess ? (
              <div className="muted" style={{ fontSize: 13 }}>
                Request recorded. The platform team will follow up.
              </div>
            ) : null}
          </form>
        ) : (
          <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
            Only the school owner account (<strong>SCHOOL_ADMIN</strong>) can submit subscription change requests.
          </p>
        )}
      </div>

      <div className="workspace-panel">
        <h2 className="workspace-panel__title">Budget approvals</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>
          Structured approval flows for annual fee budgets are on the roadmap. Use{' '}
          <Link to="/app/fees" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
            Fees & invoices
          </Link>{' '}
          today for billing control; export and finance integrations will plug in here later.
        </p>
      </div>
    </div>
  );
}
