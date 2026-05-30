 /**
 * CollectPaymentModal — shared collect-payment modal used in both
 * Student Profile (Fees tab) and Fee Management → Student Dues.
 *
 * Fetches outstanding demands itself from /api/fees/demands?studentId=…
 * so callers only need to provide studentId + studentName.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { formatJsonDate } from '../../lib/apiData';
import { SelectKeeper } from '../SelectKeeper';
import { DateKeeper } from '../DateKeeper';

// ─── Types ────────────────────────────────────────────────────────────────────

type StudentFeeDemandStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED' | 'CANCELLED';

type OutstandingDemand = {
  id: number;
  demandNo: string;
  feeHeadName: string;
  feeHeadCode: string;
  installmentName: string;
  dueDate: unknown;
  payableAmount: number | string;
  paidAmount: number | string;
  balanceAmount: number | string;
  status: StudentFeeDemandStatus;
  feePlanName?: string;
};

export type FeePaymentResult = {
  id: number;
  receiptNo: string;
  studentId: number;
  studentName: string;
  studentAdmissionNo?: string | null;
  classGroupName?: string | null;
  amount: number | string;
  paymentMode: string;
  paymentDate: string;
  referenceNo?: string | null;
  notes?: string | null;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';
  outstandingBalance?: number | string | null;
  allocations?: {
    id: number;
    demandId: number;
    demandNo: string;
    feeHeadName?: string | null;
    feeHeadCode?: string | null;
    installmentName?: string | null;
    allocatedAmount: number | string;
    demandPayableAmount: number | string;
    demandPaidAmount: number | string;
    demandBalanceAmount: number | string;
    demandStatus: StudentFeeDemandStatus;
    createdAt: string;
  }[];
  receipt?: {
    id: number;
    receiptNo: string;
    issuedAt: string;
    pdfUrl?: string | null;
    cancelledAt?: string | null;
    cancelReason?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'DEMAND_DRAFT' | 'ADJUSTMENT';

const PAYMENT_MODES: PaymentMode[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'DEMAND_DRAFT', 'ADJUSTMENT'];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque', CARD: 'Card', DEMAND_DRAFT: 'Demand Draft', ADJUSTMENT: 'Adjustment',
};

const REFERENCE_REQUIRED_MODES = new Set<PaymentMode>(['UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtMoney(v: number | string | null | undefined): string {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface CollectPaymentModalProps {
  studentId: number;
  studentName: string;
  /** Optional: pre-fill allocation for this specific demand. */
  preSelectedDemandId?: number | null;
  onClose: () => void;
  onSuccess: (payment: FeePaymentResult) => void;
}

export function CollectPaymentModal({
  studentId,
  studentName,
  preSelectedDemandId,
  onClose,
  onSuccess,
}: CollectPaymentModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [submitErr, setSubmitErr] = useState('');

  // Load outstanding demands for this student
  const demandsQ = useQuery({
    queryKey: ['student-outstanding-demands', studentId],
    queryFn: async () => {
      const res = await api.get<OutstandingDemand[]>(`/api/fees/demands?studentId=${studentId}`);
      return (Array.isArray(res.data) ? res.data : []).filter(
        d => d.status === 'UNPAID' || d.status === 'PARTIAL',
      );
    },
  });
  const demands = demandsQ.data ?? [];

  // Pre-select demand when demands load
  useEffect(() => {
    if (!preSelectedDemandId || demands.length === 0) return;
    const d = demands.find(d => d.id === preSelectedDemandId);
    if (d) {
      setAllocations(prev => {
        if (prev[d.id]) return prev; // already set
        return { ...prev, [d.id]: String(toNum(d.balanceAmount)) };
      });
    }
  }, [preSelectedDemandId, demands]);

  function autoAllocate() {
    const newAlloc: Record<number, string> = {};
    demands.forEach(d => { newAlloc[d.id] = String(toNum(d.balanceAmount)); });
    setAllocations(newAlloc);
  }

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const refRequired = REFERENCE_REQUIRED_MODES.has(paymentMode);

  let validationError = '';
  if (totalAllocated <= 0) validationError = 'Total allocated must be greater than 0.';
  else if (refRequired && !referenceNo.trim()) validationError = `Reference number is required for ${PAYMENT_MODE_LABELS[paymentMode]}.`;
  else {
    for (const d of demands) {
      const alloc = parseFloat(allocations[d.id] ?? '0') || 0;
      if (alloc > toNum(d.balanceAmount)) {
        validationError = `Allocation for ${d.feeHeadName} (${d.installmentName}) exceeds balance.`;
        break;
      }
    }
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const allocationsList = demands
        .filter(d => (parseFloat(allocations[d.id] ?? '0') || 0) > 0)
        .map(d => ({ demandId: d.id, amount: parseFloat(allocations[d.id]) }));
      return (await api.post<FeePaymentResult>('/api/fees/payments', {
        studentId,
        paymentDate,
        paymentMode,
        referenceNo: referenceNo || undefined,
        notes: notes || undefined,
        allocations: allocationsList,
      })).data;
    },
    onSuccess: (data) => {
      toast.success('Payment recorded', `Receipt ${data.receiptNo} created.`);
      onSuccess(data);
    },
    onError: (e) => setSubmitErr(formatApiError(e)),
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={() => { if (!submitMutation.isPending) onClose(); }}
    >
      <div
        className="card stack"
        style={{ maxWidth: 680, width: '100%', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: 16 }}>Collect Payment</strong>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Student: <strong>{studentName}</strong></div>
          </div>
          <button
            type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}
            disabled={submitMutation.isPending} onClick={onClose}
          >✕ Close</button>
        </div>

        {/* Payment fields */}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="stack" style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12 }}>Payment Date *</label>
            <DateKeeper value={paymentDate} onChange={setPaymentDate} />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 12 }}>Payment Mode *</label>
            <SelectKeeper
              value={paymentMode}
              onChange={v => setPaymentMode(v as PaymentMode)}
              options={PAYMENT_MODES.map(m => ({ value: m, label: PAYMENT_MODE_LABELS[m] }))}
            />
          </div>
          <div className="stack" style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 12 }}>
              Reference No {refRequired ? '*' : '(optional)'}
            </label>
            <input
              value={referenceNo}
              onChange={e => setReferenceNo(e.target.value)}
              placeholder={
                paymentMode === 'UPI' ? 'UPI transaction ID'
                  : paymentMode === 'CHEQUE' ? 'Cheque no.'
                    : 'Reference…'
              }
            />
          </div>
        </div>

        <div className="stack">
          <label style={{ fontSize: 12 }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes…"
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Outstanding demands table */}
        <div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Outstanding Demands</div>
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button" className="btn secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={autoAllocate}
              >⚡ Auto-Allocate All</button>
              <button
                type="button" className="btn secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setAllocations({})}
              >✕ Clear</button>
            </div>
          </div>

          {demandsQ.isLoading ? (
            <div className="muted" style={{ textAlign: 'center', padding: 16 }}>Loading demands…</div>
          ) : demands.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20, border: '1px dashed #e2e8f0', borderRadius: 8 }}>
              No outstanding demands for this student.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    {['Fee Head', 'Installment', 'Due Date', 'Balance', 'Amount to Pay'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {demands.map(d => {
                    const balance = toNum(d.balanceAmount);
                    const alloc = parseFloat(allocations[d.id] ?? '') || 0;
                    const overAlloc = alloc > balance;
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600 }}>{d.feeHeadName}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{d.feeHeadCode}</div>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 12 }}>{d.installmentName}</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#475569' }}>
                          {formatJsonDate(d.dueDate)}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#b45309' }}>
                          {fmtMoney(balance)}
                        </td>
                        <td style={{ padding: '8px 10px', minWidth: 130 }}>
                          <input
                            type="number" min="0" step="0.01" max={String(balance)}
                            value={allocations[d.id] ?? ''}
                            onChange={e => setAllocations(prev => ({ ...prev, [d.id]: e.target.value }))}
                            style={{ width: '100%', borderColor: overAlloc ? '#dc2626' : undefined }}
                            placeholder="0.00"
                          />
                          {overAlloc && (
                            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>Exceeds balance</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Total */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Total Payment Amount</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: totalAllocated > 0 ? '#1e293b' : '#94a3b8' }}>
            {fmtMoney(totalAllocated)}
          </span>
        </div>

        {/* Errors */}
        {(validationError || submitErr) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13 }}>
            {validationError || submitErr}
          </div>
        )}

        {/* Submit */}
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button" className="btn" style={{ flex: 1 }}
            disabled={submitMutation.isPending || !!validationError || demands.length === 0}
            onClick={() => { setSubmitErr(''); submitMutation.mutate(); }}
          >
            {submitMutation.isPending ? 'Recording Payment…' : `Record Payment — ${fmtMoney(totalAllocated)}`}
          </button>
          <button
            type="button" className="btn secondary"
            disabled={submitMutation.isPending}
            onClick={onClose}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}


