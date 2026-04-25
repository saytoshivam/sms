import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';

export type FeeSchoolSummary = {
  studentCount: number;
  totalInvoiced: string | number;
  totalCollected: string | number;
  outstandingPending: string | number;
  invoiceCount: number;
  openInvoiceCount: number;
};

function inr(n: string | number): string {
  const v = typeof n === 'string' ? Number.parseFloat(n) : n;
  if (Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(v);
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—';
  return `${((100 * part) / whole).toFixed(1)}%`;
}

type Props = {
  /** Shorter copy for dense layouts */
  compact?: boolean;
};

export function SchoolBusinessKpis({ compact }: Props) {
  const q = useQuery({
    queryKey: ['fee-school-summary'],
    queryFn: async () => (await api.get<FeeSchoolSummary>('/api/fees/summary')).data,
  });

  if (q.isLoading) {
    return (
      <div className="card">
        <div className="muted">{compact ? 'Loading…' : 'Loading school overview…'}</div>
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="card">
        <div style={{ color: '#b91c1c' }}>{formatApiError(q.error)}</div>
      </div>
    );
  }
  if (!q.data) return null;

  const d = q.data;
  const invoicedNum =
    typeof d.totalInvoiced === 'string' ? Number.parseFloat(d.totalInvoiced) : d.totalInvoiced;
  const collectedNum =
    typeof d.totalCollected === 'string' ? Number.parseFloat(d.totalCollected) : d.totalCollected;
  const collectionRate = pct(collectedNum, invoicedNum);

  return (
    <div className="stack" style={{ gap: compact ? 10 : 14 }}>
      {!compact ? (
        <div>
          <h3 className="feature-area-heading" style={{ marginBottom: 8 }}>
            Business overview
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Fee collection and enrollment for your school. Totals exclude voided invoices; collected amounts include
            cash and successful online payments.
          </p>
        </div>
      ) : null}
      <div
        className="row"
        style={{
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        <KpiCard label="Students enrolled" value={String(d.studentCount)} hint="Active student profiles" />
        <KpiCard label="Fee collected (revenue)" value={inr(d.totalCollected)} hint="Confirmed payments" accent="positive" />
        <KpiCard
          label="Outstanding / pending"
          value={inr(d.outstandingPending)}
          hint={`${d.openInvoiceCount} open invoice(s)`}
          accent="warn"
        />
        <KpiCard
          label="Total invoiced"
          value={inr(d.totalInvoiced)}
          hint={`${d.invoiceCount} invoice(s) • collection ${collectionRate} of billed`}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: 'positive' | 'warn';
}) {
  const border =
    accent === 'positive'
      ? '1px solid rgba(22, 163, 74, 0.35)'
      : accent === 'warn'
        ? '1px solid rgba(217, 119, 6, 0.4)'
        : undefined;
  return (
    <div
      className="card"
      style={{
        flex: '1 1 160px',
        minWidth: 140,
        margin: 0,
        padding: '14px 16px',
        border,
      }}
    >
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        {hint}
      </div>
    </div>
  );
}
