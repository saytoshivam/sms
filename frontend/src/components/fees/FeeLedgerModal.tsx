/**
 * FeeLedgerModal — shared fee ledger component used in both
 * Student Profile (Fees tab, inline) and Fee Management → Student Dues (modal).
 *
 * Exports:
 *  - FeeLedger, FeeLedgerEntry, LedgerEntryType  — data types
 *  - LEDGER_TYPE_CONFIG                          — badge config
 *  - FeeLedgerView                               — pure rendering (no fetch, no modal)
 *  - FeeLedgerModal                              — fetches + wraps in a modal overlay
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fmtMoney, toNum } from './CollectPaymentModal';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'DEMAND'
  | 'PAYMENT'
  | 'PAYMENT_CANCELLED'
  | 'CONCESSION'
  | 'FINE'
  | 'WAIVER'
  | 'REFUND'
  | 'ADJUSTMENT';

export type FeeLedgerEntry = {
  date: string;
  type: LedgerEntryType;
  referenceNo?: string | null;
  description?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  balanceAfter: number | string;
  sourceType?: string | null;
  sourceId?: number | null;
};

export type FeeLedger = {
  studentId: number;
  studentName: string;
  totalDebit: number | string;
  totalCredit: number | string;
  balance: number | string;
  entries: FeeLedgerEntry[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const LEDGER_TYPE_CONFIG: Record<LedgerEntryType, { label: string; bg: string; color: string; sign: 'debit' | 'credit' | 'neutral' }> = {
  DEMAND:            { label: 'Demand',     bg: '#fef3c7', color: '#92400e', sign: 'debit'   },
  PAYMENT:           { label: 'Payment',    bg: '#dcfce7', color: '#166534', sign: 'credit'  },
  PAYMENT_CANCELLED: { label: 'Cancelled',  bg: '#fee2e2', color: '#991b1b', sign: 'debit'   },
  CONCESSION:        { label: 'Concession', bg: '#dbeafe', color: '#1e40af', sign: 'credit'  },
  FINE:              { label: 'Fine',        bg: '#fce7f3', color: '#9d174d', sign: 'debit'   },
  WAIVER:            { label: 'Waiver',     bg: '#e0f2fe', color: '#0369a1', sign: 'credit'  },
  REFUND:            { label: 'Refund',     bg: '#f3e8ff', color: '#6b21a8', sign: 'debit'   },
  ADJUSTMENT:        { label: 'Adjustment', bg: '#f1f5f9', color: '#475569', sign: 'neutral' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format date string as "26 May 2026" */
export function fmtHumanDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return raw; }
}

// ─── FeeLedgerView ────────────────────────────────────────────────────────────

export interface FeeLedgerViewProps {
  isLoading: boolean;
  error: unknown;
  data: FeeLedger | null | undefined;
}

/**
 * Pure rendering component — no fetching, no modal wrapper.
 * Used inline in StudentProfilePage and inside FeeLedgerModal.
 */
export function FeeLedgerView({ isLoading, error, data }: FeeLedgerViewProps) {
  if (isLoading) {
    return <div className="muted" style={{ textAlign: 'center', padding: 20 }}>Loading ledger…</div>;
  }
  if (error) {
    return (
      <div style={{ color: '#b91c1c', fontSize: 13, padding: '12px 16px' }}>
        {(error as Error)?.message ?? 'Failed to load ledger.'}
      </div>
    );
  }
  if (!data || data.entries.length === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>
        No fee ledger entries yet.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
        {([
          { label: 'Total Charged', value: fmtMoney(data.totalDebit),  color: '#b45309' },
          { label: 'Total Paid',    value: fmtMoney(data.totalCredit), color: '#166534' },
          { label: 'Balance',       value: fmtMoney(data.balance),
            color: toNum(data.balance) > 0 ? '#b91c1c' : '#166534' },
        ] as { label: string; value: string; color: string }[]).map(s => (
          <div key={s.label} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Ledger table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'].map(h => (
              <th
                key={h}
                style={{
                  padding: '9px 12px',
                  textAlign: h === 'Debit' || h === 'Credit' || h === 'Balance' ? 'right' : 'left',
                  fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(15,23,42,0.07)',
                  background: 'rgba(250,250,249,0.98)', whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.entries.map((entry, idx) => {
            const cfg = LEDGER_TYPE_CONFIG[entry.type] ?? LEDGER_TYPE_CONFIG.ADJUSTMENT;
            const balance = toNum(entry.balanceAfter);
            return (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(15,23,42,0.055)' }}>
                <td style={{ padding: '9px 12px', color: 'rgba(15,23,42,0.55)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {fmtHumanDate(entry.date)}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                    {cfg.label}
                  </span>
                </td>
                <td style={{ padding: '9px 12px', fontFamily: entry.referenceNo ? 'monospace' : undefined, color: entry.referenceNo ? '#4f46e5' : 'rgba(15,23,42,0.3)', fontSize: entry.referenceNo ? 12 : 11 }}>
                  {entry.referenceNo ?? '—'}
                </td>
                <td style={{ padding: '9px 12px', color: 'rgba(15,23,42,0.6)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.description ?? '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                  {entry.debit != null ? `₹${toNum(entry.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                  {entry.credit != null ? `₹${toNum(entry.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: balance > 0 ? '#b91c1c' : balance < 0 ? '#166534' : 'rgba(15,23,42,0.5)' }}>
                  {fmtMoney(balance)}
                </td>
              </tr>
            );
          })}
          {/* Totals footer */}
          <tr style={{ background: 'rgba(15,23,42,0.025)', borderTop: '2px solid rgba(15,23,42,0.09)', fontWeight: 800 }}>
            <td colSpan={4} style={{ padding: '9px 12px', fontSize: 11, color: 'rgba(15,23,42,0.5)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Totals</td>
            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#b45309' }}>
              ₹{toNum(data.totalDebit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#166534' }}>
              ₹{toNum(data.totalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'right', color: toNum(data.balance) > 0 ? '#b91c1c' : '#166534' }}>
              {fmtMoney(data.balance)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── FeeLedgerModal ───────────────────────────────────────────────────────────

export interface FeeLedgerModalProps {
  studentId: number;
  studentName: string;
  onClose: () => void;
}

/**
 * Modal wrapper — fetches the ledger for studentId and renders it in an overlay.
 * Used in Fee Management → Student Dues → Ledger action.
 */
export function FeeLedgerModal({ studentId, studentName, onClose }: FeeLedgerModalProps) {
  const ledgerQ = useQuery({
    queryKey: ['student-fee-ledger', studentId],
    queryFn: async () => (await api.get<FeeLedger>(`/api/students/${studentId}/fees/ledger`)).data,
    staleTime: 30_000,
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        className="card stack"
        style={{ maxWidth: 860, width: '100%', gap: 0, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Fee Ledger</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Student: <strong>{studentName}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn secondary"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>

        {/* Ledger content */}
        <FeeLedgerView
          isLoading={ledgerQ.isLoading}
          error={ledgerQ.error}
          data={ledgerQ.data}
        />
      </div>
    </div>
  );
}

