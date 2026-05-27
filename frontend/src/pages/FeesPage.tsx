import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { pageContent, type SpringPage, formatJsonDate } from '../lib/apiData';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SmartSelect } from '../components/SmartSelect';
import { SelectKeeper } from '../components/SelectKeeper';
import { DateKeeper } from '../components/DateKeeper';

// ─── Domain types ──────────────────────────────────────────────────────────────

type FeeType = 'TUITION' | 'ADMISSION' | 'EXAM' | 'LIBRARY' | 'LAB' | 'TRANSPORT' | 'HOSTEL' | 'ACTIVITY' | 'ANNUAL' | 'OTHER';
type FeePlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type ApplicableScopeType = 'SCHOOL' | 'CLASS' | 'SECTION' | 'STUDENT';
type FeeFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';

const FEE_TYPES: FeeType[] = ['TUITION', 'ADMISSION', 'EXAM', 'LIBRARY', 'LAB', 'TRANSPORT', 'HOSTEL', 'ACTIVITY', 'ANNUAL', 'OTHER'];
const FEE_FREQUENCIES: FeeFrequency[] = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'];
// SCOPE_TYPES used for iteration in UI when needed

const FEE_TYPE_LABELS: Record<FeeType, string> = {
  TUITION: 'Tuition', ADMISSION: 'Admission', EXAM: 'Exam', LIBRARY: 'Library',
  LAB: 'Lab', TRANSPORT: 'Transport', HOSTEL: 'Hostel', ACTIVITY: 'Activity',
  ANNUAL: 'Annual', OTHER: 'Other',
};

const FREQUENCY_LABELS: Record<FeeFrequency, string> = {
  ONE_TIME: 'One-time', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly', YEARLY: 'Yearly', CUSTOM: 'Custom',
};

type FeeHead = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  feeType: FeeType;
  refundable: boolean;
  optional: boolean;
  active: boolean;
  createdAt?: string | null;
};

type FeePlan = {
  id: number;
  name: string;
  academicYearId: number;
  academicYearLabel: string;
  description?: string | null;
  status: FeePlanStatus;
  publishedAt?: string | null;
  createdAt?: string | null;
};

type FeePlanItem = {
  id: number;
  feePlanId: number;
  feeHeadId: number;
  feeHeadCode: string;
  feeHeadName: string;
  applicableScopeType: ApplicableScopeType;
  applicableScopeId: number;
  amount: number | string;
  frequency: FeeFrequency;
  mandatory: boolean;
  installments?: FeeInstallment[];
};

type FeeInstallment = {
  id: number;
  feePlanItemId: number;
  name: string;
  dueDate: unknown;
  amount: number | string;
  sequence: number;
};

type FeePlanDetail = { plan: FeePlan; items: FeePlanItem[] };
type AcademicYear = { id: number; label: string };
type ClassGroup = { id: number; code: string; displayName: string; gradeLevel?: number | null; section?: string | null };
type Student = { id: number; admissionNo: string; firstName: string; lastName?: string | null };

type StudentFeeDemandStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED' | 'CANCELLED';

type DemandSummary = {
  totalDemands: number;
  totalPayable: number | string;
  totalPaid: number | string;
  totalOutstanding: number | string;
  overdueAmount: number | string;
  overdueCount: number;
  partialBalance: number | string;
};

type StudentFeeDemand = {
  id: number;
  demandNo: string;
  studentId: number;
  studentName: string;
  studentAdmissionNo?: string | null;
  classGroupId?: number | null;
  classGroupName?: string | null;
  classGroupGradeLevel?: number | null;
  classGroupSection?: string | null;
  academicYearLabel: string;
  feePlanId: number;
  feePlanName: string;
  feeHeadCode: string;
  feeHeadName: string;
  installmentName: string;
  originalAmount: number | string;
  concessionAmount: number | string;
  fineAmount: number | string;
  payableAmount: number | string;
  paidAmount: number | string;
  balanceAmount: number | string;
  dueDate: unknown;
  status: StudentFeeDemandStatus;
  generatedAt: string;
};

type DemandGenerationResult = {
  planId: number;
  planName: string;
  dryRun: boolean;
  totalApplicableStudents: number;
  createdDemands: number;
  skippedExistingDemands: number;
  totalAmountGenerated: number | string;
  warnings: string[];
  overrideNotes: string[];
};

type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'DEMAND_DRAFT' | 'ADJUSTMENT';
type PaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';

const PAYMENT_MODES: PaymentMode[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'DEMAND_DRAFT', 'ADJUSTMENT'];
const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque', CARD: 'Card', DEMAND_DRAFT: 'Demand Draft', ADJUSTMENT: 'Adjustment',
};
const REFERENCE_REQUIRED_MODES = new Set<PaymentMode>(['UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD']);

type FeePaymentAllocationDTO = {
  id: number;
  demandId: number;
  demandNo: string;
  allocatedAmount: number | string;
  demandPayableAmount: number | string;
  demandPaidAmount: number | string;
  demandBalanceAmount: number | string;
  demandStatus: StudentFeeDemandStatus;
  createdAt: string;
};

type FeeReceiptDTO = {
  id: number;
  receiptNo: string;
  issuedAt: string;
  pdfUrl?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
};

type FeePaymentDTO = {
  id: number;
  schoolId: number;
  studentId: number;
  studentName: string;
  receiptNo: string;
  amount: number | string;
  paymentMode: string;
  paymentDate: string;
  referenceNo?: string | null;
  notes?: string | null;
  status: PaymentStatus;
  collectedByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  allocations?: FeePaymentAllocationDTO[];
  receipt?: FeeReceiptDTO | null;
};

const PAYMENT_STATUS_PILL: Record<PaymentStatus, { bg: string; color: string }> = {
  SUCCESS:   { bg: '#dcfce7', color: '#166534' },
  PENDING:   { bg: '#fef3c7', color: '#92400e' },
  FAILED:    { bg: '#fee2e2', color: '#991b1b' },
  CANCELLED: { bg: '#f1f5f9', color: '#94a3b8' },
};

// ─── Dashboard & Report types ─────────────────────────────────────────────────

type FeeDashboard = {
  totalExpected: number | string;
  totalCollected: number | string;
  totalOutstanding: number | string;
  overdueAmount: number | string;
  collectionRate: number | string;
  studentsWithDues: number;
};

type DailyCollectionRow = {
  paymentDate: string;
  paymentMode: string;
  totalAmount: number | string;
  paymentCount: number;
};

type ClassOutstandingRow = {
  classGroupId: number;
  className: string;
  section: string;
  studentCount: number;
  demandCount: number;
  totalPayable: number | string;
  totalPaid: number | string;
  totalOutstanding: number | string;
};

type StudentDueRow = {
  studentId: number;
  studentName: string;
  admissionNo: string;
  className: string;
  totalPayable: number | string;
  totalPaid: number | string;
  totalBalance: number | string;
};

type PaymentModeRow = {
  paymentMode: string;
  totalAmount: number | string;
  paymentCount: number;
};

type ReceiptRegisterRow = {
  paymentId: number;
  receiptId: number;
  receiptNo: string;
  paymentDate: string;
  studentId: number;
  studentName: string;
  admissionNo: string;
  className: string;
  amount: number | string;
  paymentMode: string;
  referenceNo: string;
  status: string;
  issuedAt: string;
  cancelledAt?: string | null;
};

// ─── Permission helpers ────────────────────────���──────────────────────────────

type FeePermissions = {
  canEdit: boolean;     // SCHOOL_ADMIN | ACCOUNTANT — fee heads, plans, plan items
  canCollect: boolean;  // SCHOOL_ADMIN | ACCOUNTANT — collect / cancel payments
  canPublish: boolean;  // SCHOOL_ADMIN | PRINCIPAL  — publish / archive fee plans
  canGenerate: boolean; // SCHOOL_ADMIN | ACCOUNTANT — generate student demands
  viewOnly: boolean;    // any role; true when neither canEdit nor canCollect
};

function derivePermissions(roles: string[]): FeePermissions {
  const isAdmin      = roles.includes('SCHOOL_ADMIN');
  const isAccountant = roles.includes('ACCOUNTANT');
  const isPrincipal  = roles.includes('PRINCIPAL');
  const canEdit    = isAdmin || isAccountant;
  const canCollect = isAdmin || isAccountant;
  const canPublish = isAdmin || isPrincipal;
  const canGenerate = isAdmin || isAccountant;
  const viewOnly   = !canEdit && !canCollect;
  return { canEdit, canCollect, canPublish, canGenerate, viewOnly };
}

function fmt(v: number | string | undefined | null): string {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Indian compact currency: ₹12.60 Cr / ₹15.25 L / ₹35,000 */
function fmtCompact(v: number | string | undefined | null): string {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)   return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const _MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/** Format ISO date "2026-05-23" → "23 May 2026" */
function fmtHumanDate(value: unknown): string {
  const raw = formatJsonDate(value);
  if (!raw || raw === '—') return '—';
  const parts = raw.split('-');
  if (parts.length !== 3) return raw;
  const [y, m, d] = parts.map(Number);
  if (!_MONTHS_SHORT[m - 1]) return raw;
  return `${d} ${_MONTHS_SHORT[m - 1]} ${y}`;
}

function toNum(v: number | string | undefined | null): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function sumItems(items: FeePlanItem[]): number {
  return items.reduce((a, i) => a + (typeof i.amount === 'string' ? parseFloat(i.amount) || 0 : i.amount || 0), 0);
}

function sumInst(insts: FeeInstallment[]): number {
  return insts.reduce((a, i) => a + (typeof i.amount === 'string' ? parseFloat(i.amount) || 0 : i.amount || 0), 0);
}

const STATUS_PILL: Record<FeePlanStatus, { bg: string; color: string }> = {
  DRAFT: { bg: '#f1f5f9', color: '#475569' },
  PUBLISHED: { bg: '#dcfce7', color: '#166534' },
  ARCHIVED: { bg: '#f1f5f9', color: '#94a3b8' },
};

const DEMAND_STATUS_PILL: Record<StudentFeeDemandStatus, { bg: string; color: string }> = {
  UNPAID:    { bg: '#fef3c7', color: '#92400e' },
  PARTIAL:   { bg: '#dbeafe', color: '#1e40af' },
  PAID:      { bg: '#dcfce7', color: '#166534' },
  WAIVED:    { bg: '#f0f9ff', color: '#0369a1' },
  CANCELLED: { bg: '#f1f5f9', color: '#94a3b8' },
};

type TabKey = 'overview' | 'heads' | 'plans' | 'dues' | 'collections' | 'reports';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'heads', label: 'Fee Heads' },
  { key: 'plans', label: 'Fee Plans' },
  { key: 'dues', label: 'Student Dues' },
  { key: 'collections', label: 'Collections' },
  { key: 'reports', label: 'Reports' },
];

// ─── Receipt Summary Modal ─────────────────────────────────────────────────────

function ReceiptSummaryModal({ payment, onClose }: { payment: FeePaymentDTO; onClose: () => void }) {
  const r = payment.receipt;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div className="card stack" style={{ maxWidth: 560, width: '100%', gap: 16 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>🧾</div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#166534' }}>Payment Successful</h3>
          {r && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Receipt No: <strong style={{ fontFamily: 'monospace' }}>{r.receiptNo}</strong></div>}
        </div>

        {/* Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
          {[
            ['Student', payment.studentName],
            ['Amount', fmt(payment.amount)],
            ['Payment Mode', PAYMENT_MODE_LABELS[payment.paymentMode as PaymentMode] ?? payment.paymentMode],
            ['Date', payment.paymentDate],
            ['Reference', payment.referenceNo ?? '—'],
            ['Status', payment.status],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Allocations */}
        {payment.allocations && payment.allocations.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Allocations</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  {['Demand No', 'Allocated', 'Balance After'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payment.allocations.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{a.demandNo}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#166534' }}>{fmt(a.allocatedAmount)}</td>
                    <td style={{ padding: '6px 8px', color: toNum(a.demandBalanceAmount) > 0 ? '#b45309' : '#166534', fontWeight: 600 }}>{fmt(a.demandBalanceAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PDF placeholder */}
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          📄 Receipt PDF generation is not enabled yet.
        </div>

        {/* Actions */}
        <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
          <button type="button" className="btn secondary" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled title="PDF not enabled">🖨 Print Receipt</button>
          <button type="button" className="btn secondary" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled title="PDF not enabled">⬇ Download</button>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Collect Payment Modal ──────────────────────────────────────��──────────────

interface CollectPaymentModalProps {
  studentId: number;
  studentName: string;
  preSelectDemandId?: number;
  onClose: () => void;
  onSuccess: (payment: FeePaymentDTO) => void;
}

function CollectPaymentModal({ studentId, studentName, preSelectDemandId, onClose, onSuccess }: CollectPaymentModalProps) {
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
      const res = await api.get<StudentFeeDemand[]>(`/api/fees/demands?studentId=${studentId}`);
      return (res.data ?? []).filter(d => d.status === 'UNPAID' || d.status === 'PARTIAL');
    },
  });
  const demands = demandsQ.data ?? [];

  // Pre-select demand if provided
  useEffect(() => {
    if (preSelectDemandId && demands.length > 0) {
      const d = demands.find(d => d.id === preSelectDemandId);
      if (d) {
        setAllocations(prev => ({ ...prev, [d.id]: String(toNum(d.balanceAmount)) }));
      }
    }
  }, [preSelectDemandId, demands]);

  function autoAllocate() {
    const newAlloc: Record<number, string> = {};
    demands.forEach(d => { newAlloc[d.id] = String(toNum(d.balanceAmount)); });
    setAllocations(newAlloc);
  }

  function clearAllocation() { setAllocations({}); }

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
      return (await api.post<FeePaymentDTO>('/api/fees/payments', {
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={() => { if (!submitMutation.isPending) onClose(); }}>
      <div className="card stack" style={{ maxWidth: 680, width: '100%', gap: 16, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: 16 }}>Collect Payment</strong>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Student: <strong>{studentName}</strong></div>
          </div>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}
            disabled={submitMutation.isPending} onClick={onClose}>✕ Close</button>
        </div>

        {/* Payment fields */}
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="stack" style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12 }}>Payment Date *</label>
            <DateKeeper value={paymentDate} onChange={setPaymentDate} />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 12 }}>Payment Mode *</label>
            <SelectKeeper value={paymentMode} onChange={v => setPaymentMode(v as PaymentMode)}
              options={PAYMENT_MODES.map(m => ({ value: m, label: PAYMENT_MODE_LABELS[m] }))} />
          </div>
          <div className="stack" style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 12 }}>Reference No {refRequired ? '*' : '(optional)'}</label>
            <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
              placeholder={paymentMode === 'UPI' ? 'UPI transaction ID' : paymentMode === 'CHEQUE' ? 'Cheque no.' : 'Reference…'} />
          </div>
        </div>
        <div className="stack">
          <label style={{ fontSize: 12 }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" style={{ resize: 'vertical' }} />
        </div>

        {/* Outstanding demands table */}
        <div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Outstanding Demands</div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={autoAllocate}>⚡ Auto-Allocate All</button>
              <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={clearAllocation}>✕ Clear</button>
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
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#475569' }}>{formatJsonDate(d.dueDate)}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#b45309' }}>{fmt(balance)}</td>
                        <td style={{ padding: '8px 10px', minWidth: 130 }}>
                          <input
                            type="number" min="0" step="0.01" max={String(balance)}
                            value={allocations[d.id] ?? ''}
                            onChange={e => setAllocations(prev => ({ ...prev, [d.id]: e.target.value }))}
                            style={{ width: '100%', borderColor: overAlloc ? '#dc2626' : undefined }}
                            placeholder="0.00"
                          />
                          {overAlloc && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>Exceeds balance</div>}
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
          <span style={{ fontSize: 18, fontWeight: 800, color: totalAllocated > 0 ? '#1e293b' : '#94a3b8' }}>{fmt(totalAllocated)}</span>
        </div>

        {/* Errors */}
        {(validationError || submitErr) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13 }}>
            {validationError || submitErr}
          </div>
        )}

        {/* Submit */}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1 }}
            disabled={submitMutation.isPending || !!validationError || demands.length === 0}
            onClick={() => { setSubmitErr(''); submitMutation.mutate(); }}>
            {submitMutation.isPending ? 'Recording Payment…' : `Record Payment — ${fmt(totalAllocated)}`}
          </button>
          <button type="button" className="btn secondary" disabled={submitMutation.isPending} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Student Dues ─────────────────────────────────────────────────────────

function TabStudentDues({ perms }: { perms: FeePermissions }) {
  const qc = useQueryClient();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [academicYearId, setAcademicYearId] = useState('');
  const [feePlanFilter, setFeePlanFilter]   = useState('');
  const [gradeFilter, setGradeFilter]       = useState('');
  const [sectionFilter, setSectionFilter]   = useState('');
  const [quickStatus, setQuickStatus]       = useState('');   // operational status filter
  const [feeHeadFilter, setFeeHeadFilter]   = useState('');
  const [dueFrom, setDueFrom]               = useState('');
  const [dueTo, setDueTo]                   = useState('');
  const [searchInput, setSearchInput]       = useState('');
  const [search, setSearch]                 = useState(''); // debounced
  const [moreOpen, setMoreOpen]             = useState(false);
  const [exporting, setExporting]           = useState(false);

  // ── Pagination state ──────────────────────────────────────────────────────
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [collectTarget, setCollectTarget] = useState<{ studentId: number; studentName: string; demandId?: number } | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<FeePaymentDTO | null>(null);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 0 on any filter change
  useEffect(() => { setPage(0); }, [academicYearId, feePlanFilter, gradeFilter, sectionFilter, quickStatus, feeHeadFilter, dueFrom, dueTo]);

  // ── Reference data ────────────────────────────────────────────────────────
  const academicYearsQ = useQuery({
    queryKey: ['academic-years-dues'],
    queryFn: async () => (await api.get<AcademicYear[]>('/api/academic-years')).data,
    staleTime: 300_000,
  });
  const academicYears = Array.isArray(academicYearsQ.data) ? academicYearsQ.data : [];

  const classGroupsQ = useQuery({
    queryKey: ['class-groups-dues'],
    queryFn: async () => (await api.get<SpringPage<ClassGroup> | ClassGroup[]>('/api/class-groups?size=500')).data,
    staleTime: 300_000,
  });
  const classGroups = pageContent(classGroupsQ.data);

  const feePlansQ = useQuery({
    queryKey: ['fee-plans-dues'],
    queryFn: async () => (await api.get<SpringPage<FeePlan>>('/api/fees/plans?size=200&sort=name,asc')).data,
    staleTime: 300_000,
  });
  const feePlans = pageContent(feePlansQ.data);

  const feeHeadsQ = useQuery({
    queryKey: ['fee-heads-dues'],
    queryFn: async () => (await api.get<SpringPage<FeeHead>>('/api/fees/heads?size=200&sort=name,asc')).data,
    staleTime: 300_000,
  });
  const feeHeads = pageContent(feeHeadsQ.data);

  // ── Derived dropdowns ─────────────────────────────────────────────────────
  const uniqueGrades = useMemo(() => {
    const grades = classGroups.map(cg => cg.gradeLevel).filter((g): g is number => g != null);
    return [...new Set(grades)].sort((a, b) => a - b);
  }, [classGroups]);

  const availableSections = useMemo(() => {
    const cgFiltered = gradeFilter
      ? classGroups.filter(cg => String(cg.gradeLevel) === gradeFilter)
      : classGroups;
    const sections = cgFiltered.map(cg => cg.section).filter((s): s is string => !!s);
    return [...new Set(sections)].sort();
  }, [classGroups, gradeFilter]);

  const apiClassGroupId = useMemo(() => {
    if (!gradeFilter || !sectionFilter) return '';
    const match = classGroups.find(cg => String(cg.gradeLevel) === gradeFilter && cg.section === sectionFilter);
    return match ? String(match.id) : '';
  }, [classGroups, gradeFilter, sectionFilter]);

  // ── Build query string ────────────────────────────────────────────────────
  // skipQuickStatus=true → used by the summary endpoint (KPI cards are always global)
  const buildQs = useCallback((extra?: Record<string, string>, skipQuickStatus = false) => {
    const p = new URLSearchParams();
    if (academicYearId) p.append('academicYearId', academicYearId);
    if (feePlanFilter)  p.append('feePlanId', feePlanFilter);
    if (feeHeadFilter)  p.append('feeHeadId', feeHeadFilter);
    if (gradeFilter && sectionFilter) {
      if (apiClassGroupId) {
        p.append('classGroupId', apiClassGroupId);
      } else {
        p.append('gradeLevel', gradeFilter);
        p.append('sectionName', sectionFilter);
      }
    } else if (gradeFilter) {
      p.append('gradeLevel', gradeFilter);
    } else if (sectionFilter) {
      p.append('sectionName', sectionFilter);
    }
    if (!skipQuickStatus && quickStatus) p.append('quickStatus', quickStatus);
    if (dueFrom)       p.append('dueFrom', dueFrom);
    if (dueTo)         p.append('dueTo', dueTo);
    if (search.trim()) p.append('search', search.trim());
    if (extra) Object.entries(extra).forEach(([k, v]) => p.append(k, v));
    return p.toString();
  }, [academicYearId, feePlanFilter, feeHeadFilter, apiClassGroupId, gradeFilter, sectionFilter, quickStatus, dueFrom, dueTo, search]);

  // ── Paginated demands query ───────────────────────────────────────��────────
  const demandsQ = useQuery({
    queryKey: ['fee-demands-paged', academicYearId, feePlanFilter, feeHeadFilter, gradeFilter, sectionFilter, apiClassGroupId, quickStatus, dueFrom, dueTo, search, page, pageSize],
    queryFn: async () => {
      const qs = buildQs({ page: String(page), size: String(pageSize) });
      return (await api.get<SpringPage<StudentFeeDemand>>(`/api/fees/demands?${qs}`)).data;
    },
    placeholderData: (prev) => prev,
  });

  const demands       = demandsQ.data?.content ?? [];
  const totalElements = demandsQ.data?.totalElements ?? 0;
  const totalPages    = demandsQ.data?.totalPages ?? 1;
  const visibleDemands = demands;

  // ── Summary KPI query — does NOT include quickStatus (KPIs show global totals) ──
  const summaryQ = useQuery({
    queryKey: ['fee-demands-summary', academicYearId, feePlanFilter, feeHeadFilter, gradeFilter, sectionFilter, apiClassGroupId, dueFrom, dueTo, search],
    queryFn: async () => {
      const qs = buildQs(undefined, true); // skipQuickStatus=true
      const data = (await api.get<DemandSummary>(`/api/fees/demands/summary?${qs}`)).data;
      if (!data || typeof data !== 'object') throw new Error('Empty summary response');
      return data;
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Fallback: compute approximate KPIs from current page when summary endpoint fails
  const pageFallbackSummary: DemandSummary | undefined = useMemo(() => {
    if (!summaryQ.isError || demands.length === 0) return undefined;
    const todStr = new Date().toISOString().split('T')[0];
    const outstanding = demands.reduce((s, d) => (d.status === 'UNPAID' || d.status === 'PARTIAL') ? s + toNum(d.balanceAmount) : s, 0);
    const overdueCount = demands.filter(d => {
      const ds = formatJsonDate(d.dueDate);
      return ds < todStr && (d.status === 'UNPAID' || d.status === 'PARTIAL');
    }).length;
    const overdueAmount = demands.reduce((s, d) => {
      const ds = formatJsonDate(d.dueDate);
      return (ds < todStr && (d.status === 'UNPAID' || d.status === 'PARTIAL')) ? s + toNum(d.balanceAmount) : s;
    }, 0);
    return {
      totalDemands: totalElements,
      totalPayable: demands.reduce((s, d) => s + toNum(d.payableAmount), 0),
      totalPaid: demands.reduce((s, d) => s + toNum(d.paidAmount), 0),
      totalOutstanding: outstanding,
      overdueAmount,
      overdueCount,
      partialBalance: demands.reduce((s, d) => d.status === 'PARTIAL' ? s + toNum(d.balanceAmount) : s, 0),
    };
  }, [summaryQ.isError, demands, totalElements]);

  const summary = summaryQ.data ?? pageFallbackSummary;
  const summaryIsLoading = summaryQ.isLoading && !summaryQ.isError;

  const today = new Date().toISOString().split('T')[0];

  // ── Pagination helpers ────────────────────────────────────────────────────
  const firstItem  = totalElements === 0 ? 0 : page * pageSize + 1;
  const lastItem   = Math.min((page + 1) * pageSize, totalElements);
  const hasFilters = !!(academicYearId || feePlanFilter || feeHeadFilter || gradeFilter || sectionFilter || quickStatus || dueFrom || dueTo || searchInput);

  function clearFilters() {
    setAcademicYearId(''); setFeePlanFilter(''); setGradeFilter(''); setSectionFilter('');
    setQuickStatus(''); setFeeHeadFilter(''); setDueFrom(''); setDueTo('');
    setSearchInput(''); setSearch(''); setPage(0);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const qs = buildQs();
      const resp = await api.get<string>(`/api/fees/demands/export?${qs}`, {
        responseType: 'blob' as const,
      });
      const url  = URL.createObjectURL(new Blob([resp.data as unknown as BlobPart], { type: 'text/csv' }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'student-dues.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Export failed', formatApiError(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="stack">

      {/* ── KPI Cards (clickable — apply quickStatus filter) ─────────────── */}
      {(() => {
        const kpiCard = (
          label: string, color: string, qs: string,
          content: React.ReactNode, sub?: React.ReactNode
        ) => {
          const isActive = quickStatus === qs;
          return (
            <div key={label} className="card" onClick={() => setQuickStatus(isActive ? '' : qs)}
              style={{
                borderTop: `3px solid ${color}`, padding: '12px 14px', cursor: 'pointer',
                boxShadow: isActive ? `0 0 0 2px ${color}` : undefined,
                background: isActive ? `${color}12` : undefined,
                transition: 'box-shadow .15s, background .15s',
              }}>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>
                {label}{isActive && <span style={{ marginLeft: 6, color, fontSize: 9, fontWeight: 800 }}>▶ ACTIVE</span>}
              </div>
              {summaryIsLoading ? <div style={{ fontSize: 18, fontWeight: 800, color }}>…</div> : content}
              {sub && !summaryIsLoading && sub}
            </div>
          );
        };
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            {kpiCard('Total Demands', '#6366f1', '', (
              <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1', lineHeight: 1.3 }}>
                {(summary?.totalDemands ?? totalElements).toLocaleString('en-IN')}
              </div>
            ))}
            {kpiCard('Outstanding', '#f59e0b', 'OUTSTANDING', (
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', lineHeight: 1.3 }}>{fmtCompact(summary?.totalOutstanding)}</div>
            ))}
            {kpiCard('Collected', '#16a34a', 'COLLECTED', (
              <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', lineHeight: 1.3 }}>{fmtCompact(summary?.totalPaid)}</div>
            ))}
            {kpiCard('Overdue', '#dc2626', 'OVERDUE', (
              <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', lineHeight: 1.3 }}>{fmtCompact(summary?.overdueAmount)}</div>
            ), (
              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{(summary?.overdueCount ?? 0).toLocaleString('en-IN')} demands</div>
            ))}
            {kpiCard('Partial Outstanding', '#3b82f6', 'PARTIAL', (
              <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', lineHeight: 1.3 }}>{fmtCompact(summary?.partialBalance)}</div>
            ))}
          </div>
        );
      })()}

      {/* ── Filters ────────────────────────────────────────────────────��──── */}
      <div className="card" style={{ padding: '14px 16px' }}>
        {/* Main filter row */}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 12 }}>Academic Year</label>
            <SelectKeeper value={academicYearId} onChange={setAcademicYearId}
              options={academicYears.map(y => ({ value: String(y.id), label: y.label }))}
              emptyValueLabel="All years" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 12 }}>Fee Plan</label>
            <SelectKeeper value={feePlanFilter} onChange={setFeePlanFilter}
              options={feePlans.map(p => ({ value: String(p.id), label: p.name }))}
              emptyValueLabel="All plans" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 130 }}>
            <label style={{ fontSize: 12 }}>Class</label>
            <SelectKeeper value={gradeFilter} onChange={v => { setGradeFilter(v); setSectionFilter(''); }}
              options={uniqueGrades.map(g => ({ value: String(g), label: `Class ${g}` }))}
              emptyValueLabel="All classes" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12 }}>Section</label>
            <SelectKeeper value={sectionFilter} onChange={setSectionFilter}
              options={availableSections.map(s => ({ value: s, label: `Section ${s}` }))}
              emptyValueLabel="All sections" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12 }}>Quick Status</label>
            <SelectKeeper value={quickStatus} onChange={v => { setQuickStatus(v); setPage(0); }}
              options={[
                { value: 'OUTSTANDING', label: 'Outstanding' },
                { value: 'UNPAID',      label: 'Unpaid' },
                { value: 'PARTIAL',     label: 'Partial' },
                { value: 'COLLECTED',   label: 'Collected' },
                { value: 'OVERDUE',     label: 'Overdue' },
                { value: 'DUE_TODAY',   label: 'Due Today' },
                { value: 'UPCOMING',    label: 'Upcoming' },
                { value: 'CANCELLED',   label: 'Cancelled' },
                { value: 'WAIVED',      label: 'Waived' },
              ]}
              emptyValueLabel="All" />
          </div>
          <div className="stack" style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 12 }}>Search</label>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search student name, admission no, demand no..." />
          </div>
          <div className="row" style={{ gap: 6, alignSelf: 'flex-end' }}>
            <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '8px 12px' }}
              onClick={() => setMoreOpen(o => !o)}>
              {moreOpen ? '▲ Less' : '▼ More filters'}
            </button>
            {hasFilters && (
              <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '8px 12px', color: '#dc2626' }}
                onClick={clearFilters}>Clear</button>
            )}
          </div>
        </div>

        {/* More filters (collapsible) */}
        {moreOpen && (
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
            <div className="stack" style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 12 }}>Fee Head</label>
              <SelectKeeper value={feeHeadFilter} onChange={setFeeHeadFilter}
                options={feeHeads.filter(h => h.active).map(h => ({ value: String(h.id), label: h.name }))}
                emptyValueLabel="All fee heads" />
            </div>
            <div className="stack" style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12 }}>Due From</label>
              <DateKeeper value={dueFrom} onChange={setDueFrom} clearable emptyLabel="Any date" />
            </div>
            <div className="stack" style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12 }}>Due To</label>
              <DateKeeper value={dueTo} onChange={setDueTo} clearable emptyLabel="Any date" />
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar: count + export ────────────────────────────────────────── */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {demandsQ.isLoading
            ? 'Loading…'
            : totalElements === 0
              ? 'No demands found'
              : `Showing ${firstItem}–${lastItem} of ${totalElements.toLocaleString('en-IN')}`
          }
        </div>
        <button type="button" className="btn secondary"
          disabled={exporting || totalElements === 0}
          onClick={exportCsv}
          style={{ fontSize: 12, padding: '6px 12px' }}>
          {exporting ? '⏳ Exporting…' : '⬇ Export CSV'}
        </button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {demandsQ.isLoading ? (
        <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>Loading demands…</div>
      ) : demandsQ.error ? (
        <div style={{ color: '#dc2626', fontSize: 13 }}>{formatApiError(demandsQ.error)}</div>
      ) : totalElements === 0 ? (
        <div className="fee-empty-state">
          <div className="fee-empty-state__icon">📋</div>
          <div className="fee-empty-state__title">{hasFilters ? 'No results match your filters' : 'No student demands generated yet'}</div>
          {!hasFilters && (
            <div className="fee-empty-state__desc">
              Publish a fee plan and click <strong>Generate Student Dues</strong> to create demand records for enrolled students.
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="fee-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  {['Student', 'Class / Section', 'Fee Head', 'Installment', 'Due Date', 'Payable', 'Paid', 'Balance', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDemands.map(d => {
                  const sp = DEMAND_STATUS_PILL[d.status] ?? { bg: '#f1f5f9', color: '#64748b' };
                  const dueDateStr  = formatJsonDate(d.dueDate);
                  const humanDate   = fmtHumanDate(d.dueDate);
                  const bal         = toNum(d.balanceAmount);
                  const hasBalance  = bal > 0 && (d.status === 'UNPAID' || d.status === 'PARTIAL');
                  const isOverdue   = hasBalance && dueDateStr < today;
                  const isDueToday  = hasBalance && dueDateStr === today;
                  const hasEnrollment = !!d.classGroupName;
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', background: isOverdue ? 'rgba(220,38,38,0.03)' : undefined }}>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600 }}>{d.studentName}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11 }}>{d.studentAdmissionNo ?? d.demandNo}</div>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12 }}>
                        {hasEnrollment
                          ? <span style={{ color: '#475569' }}>{d.classGroupName}</span>
                          : <span style={{ color: '#b45309', background: '#fef3c7', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>⚠ No active enrollment</span>
                        }
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600 }}>{d.feeHeadName}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}>{d.feeHeadCode}</div>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12 }}>{d.installmentName}</td>
                       <td style={{ padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                         <span style={{ color: isOverdue ? '#b91c1c' : isDueToday ? '#b45309' : '#475569', fontWeight: (isOverdue || isDueToday) ? 600 : 400 }}>
                           {humanDate}
                         </span>
                       </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{fmt(d.payableAmount)}</td>
                      <td style={{ padding: '8px 10px', color: '#16a34a' }}>{fmt(d.paidAmount)}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: toNum(d.balanceAmount) > 0 ? '#b45309' : '#166534' }}>{fmt(d.balanceAmount)}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sp.bg, color: sp.color, width: 'fit-content' }}>
                            {d.status}
                          </span>
                          {isOverdue && (
                            <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#991b1b', width: 'fit-content' }}>
                              OVERDUE
                            </span>
                          )}
                          {isDueToday && (
                            <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', width: 'fit-content' }}>
                              DUE TODAY
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                          {perms.canCollect && (d.status === 'UNPAID' || d.status === 'PARTIAL') && (
                            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px', background: '#166634', borderColor: '#166634', whiteSpace: 'nowrap' }}
                              onClick={() => setCollectTarget({ studentId: d.studentId, studentName: d.studentName, demandId: d.id })}>
                              Collect
                            </button>
                          )}
                          <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                            title="Student ledger — coming soon"
                            onClick={() => toast.info('Student ledger', 'Ledger view is coming soon.')}>
                            Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination controls ──────────────────────────────────────── */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12, color: '#64748b' }}>
              <span>Rows per page:</span>
              {[25, 50, 100].map(n => (
                <button key={n} type="button"
                  className={pageSize === n ? 'btn' : 'btn secondary'}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => { setPageSize(n); setPage(0); }}>
                  {n}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>{firstItem}–{lastItem} of {totalElements.toLocaleString('en-IN')}</span>
              <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="fee-card-list">
            {visibleDemands.map(d => {
              const sp = DEMAND_STATUS_PILL[d.status] ?? { bg: '#f1f5f9', color: '#64748b' };
              const dueDateStr = formatJsonDate(d.dueDate);
              const humanDate  = fmtHumanDate(d.dueDate);
              const isOverdue  = dueDateStr < today && (d.status === 'UNPAID' || d.status === 'PARTIAL');
              const hasEnrollment = !!d.classGroupName;
              return (
                <div key={d.id} className="fee-card-item" style={{ borderLeftColor: isOverdue ? '#dc2626' : undefined }}>
                  <div className="fee-card-item__row">
                    <div>
                      <div style={{ fontWeight: 700 }}>{d.studentName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.feeHeadName} · {d.installmentName}</div>
                      {!hasEnrollment && (
                        <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', borderRadius: 4, padding: '1px 6px', marginTop: 2, display: 'inline-block', fontWeight: 600 }}>⚠ No active enrollment</div>
                      )}
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sp.bg, color: sp.color, whiteSpace: 'nowrap' }}>
                      {d.status}
                    </span>
                  </div>
                  <div className="fee-card-item__row">
                    <span className="fee-card-item__label">Due</span>
                    <span style={{ fontSize: 12, color: isOverdue ? '#b91c1c' : '#475569', fontWeight: isOverdue ? 600 : 400 }}>
                      {humanDate}
                    </span>
                  </div>
                  <div className="fee-card-item__row">
                    <span className="fee-card-item__label">Balance</span>
                    <span style={{ fontWeight: 700, color: toNum(d.balanceAmount) > 0 ? '#b45309' : '#166534' }}>{fmt(d.balanceAmount)}</span>
                  </div>
                  <div className="fee-card-item__actions">
                    {perms.canCollect && (d.status === 'UNPAID' || d.status === 'PARTIAL') && (
                      <button type="button" className="btn" style={{ fontSize: 12, background: '#166634', borderColor: '#166634' }}
                        onClick={() => setCollectTarget({ studentId: d.studentId, studentName: d.studentName, demandId: d.id })}>
                        Collect
                      </button>
                    )}
                    <button type="button" className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => toast.info('Student ledger', 'Ledger view is coming soon.')}>
                      Ledger
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {collectTarget && (
        <CollectPaymentModal
          studentId={collectTarget.studentId}
          studentName={collectTarget.studentName}
          preSelectDemandId={collectTarget.demandId}
          onClose={() => setCollectTarget(null)}
          onSuccess={(payment) => {
            setCollectTarget(null);
            setReceiptPayment(payment);
            qc.invalidateQueries({ queryKey: ['fee-demands-paged'] });
            qc.invalidateQueries({ queryKey: ['fee-demands-summary'] });
          }}
        />
      )}

      {receiptPayment && (
        <ReceiptSummaryModal payment={receiptPayment} onClose={() => setReceiptPayment(null)} />
      )}
    </div>
  );
}

// ─── TAB: Fee Heads ────────────────────────────────────────────────────────────

type HeadDraft = { code: string; name: string; description: string; feeType: FeeType; refundable: boolean; optional: boolean };
const EMPTY_HEAD: HeadDraft = { code: '', name: '', description: '', feeType: 'TUITION', refundable: false, optional: false };

function TabFeeHeads({ perms }: { perms: FeePermissions }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [draft, setDraft] = useState<HeadDraft>(EMPTY_HEAD);
  const [deactivateTarget, setDeactivateTarget] = useState<FeeHead | null>(null);
  const [err, setErr] = useState('');

  const headsQ = useQuery({
    queryKey: ['fee-heads'],
    queryFn: async () => (await api.get<SpringPage<FeeHead>>('/api/fees/heads?size=200&sort=name,asc')).data,
  });
  const heads = pageContent(headsQ.data);

  function openAdd() { setEditing(null); setDraft(EMPTY_HEAD); setErr(''); setShowForm(true); }
  function openEdit(h: FeeHead) {
    setEditing(h);
    setDraft({ code: h.code, name: h.name, description: h.description ?? '', feeType: h.feeType, refundable: h.refundable, optional: h.optional });
    setErr(''); setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.code.trim()) throw new Error('Code is required');
      if (!draft.name.trim()) throw new Error('Name is required');
      return editing
        ? (await api.put(`/api/fees/heads/${editing.id}`, draft)).data
        : (await api.post('/api/fees/heads', draft)).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fee-heads'] });
      toast.success(editing ? 'Fee head updated' : 'Fee head created');
      setShowForm(false);
    },
    onError: (e) => setErr(formatApiError(e)),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => (await api.post(`/api/fees/heads/${id}/deactivate`)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fee-heads'] });
      toast.success('Fee head deactivated');
      setDeactivateTarget(null);
    },
    onError: (e) => toast.error('Deactivate failed', formatApiError(e)),
  });

    return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><strong>Fee Heads</strong><span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>{heads.length} total</span></div>
        <div className="row" style={{ gap: 8 }}>
          {perms.viewOnly && <span className="fee-role-notice">👁 View-only access</span>}
          {perms.canEdit && <button type="button" className="btn" onClick={openAdd}>+ Add Fee Head</button>}
        </div>
      </div>

      {/* Helper text */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0369a1', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
        <span>Default fee heads are provided to help you start. You can edit, deactivate, or add custom fee heads.</span>
      </div>

      {showForm && perms.canEdit && (
        <div className="card stack" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{editing ? 'Edit Fee Head' : 'New Fee Head'}</strong>
            <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Close</button>
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="stack" style={{ flex: 1, minWidth: 130 }}>
              <label style={{ fontSize: 13 }}>Code *</label>
              <input value={draft.code} onChange={e => setDraft(d => ({ ...d, code: e.target.value.toUpperCase() }))} placeholder="TUI" maxLength={32} />
            </div>
            <div className="stack" style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 13 }}>Name *</label>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Tuition Fee" maxLength={128} />
            </div>
            <div className="stack" style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 13 }}>Type *</label>
              <SelectKeeper value={draft.feeType} onChange={v => setDraft(d => ({ ...d, feeType: v as FeeType }))}
                options={FEE_TYPES.map(t => ({ value: t, label: FEE_TYPE_LABELS[t] }))} />
            </div>
          </div>
          <div className="stack">
            <label style={{ fontSize: 13 }}>Description</label>
            <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Optional…" rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div className="row" style={{ gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" className="sms-checkbox" checked={draft.refundable} onChange={e => setDraft(d => ({ ...d, refundable: e.target.checked }))} />Refundable
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" className="sms-checkbox" checked={draft.optional} onChange={e => setDraft(d => ({ ...d, optional: e.target.checked }))} />Optional
            </label>
          </div>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <div className="row">
            <button type="button" className="btn" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create Fee Head'}
            </button>
            <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {headsQ.isLoading ? <div className="muted">Loading…</div> : headsQ.error ? (
        <div style={{ color: '#dc2626', fontSize: 13 }}>{formatApiError(headsQ.error)}</div>
      ) : heads.length === 0 ? (
          <div className="fee-empty-state">
          <div className="fee-empty-state__icon">🏷️</div>
          <div className="fee-empty-state__title">No fee heads configured</div>
          <div className="fee-empty-state__desc">
            Fee heads define what you charge — Tuition, Lab Fee, Transport, etc.<br />
            Default fee heads will be created automatically on first load. If none appear, create your first fee head to get started.
          </div>
          {perms.canEdit && <button type="button" className="btn" onClick={openAdd}>+ Create First Fee Head</button>}
        </div>
      ) : (
        <>
          <div className="fee-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  {['Code', 'Name', 'Type', 'Refundable', 'Optional', 'Status', ...(perms.canEdit ? ['Actions'] : [])].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heads.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{h.code}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div>{h.name}</div>
                      {h.description ? <div style={{ color: '#94a3b8', fontSize: 11 }}>{h.description}</div> : null}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{FEE_TYPE_LABELS[h.feeType]}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{h.refundable ? '✓' : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{h.optional ? '✓' : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: h.active ? '#dcfce7' : '#f1f5f9', color: h.active ? '#166534' : '#94a3b8' }}>
                        {h.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {perms.canEdit && (
                      <td style={{ padding: '8px 10px' }}>
                        <div className="row" style={{ gap: 6 }}>
                          <button type="button" className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(h)}>Edit</button>
                          {h.active && <button type="button" className="btn secondary" style={{ padding: '4px 10px', fontSize: 12, color: '#dc2626' }} onClick={() => setDeactivateTarget(h)}>Deactivate</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="fee-card-list">
            {heads.map(h => (
              <div key={h.id} className="fee-card-item">
                <div className="fee-card-item__row">
                  <div>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)', fontSize: 12 }}>{h.code}</div>
                    <div style={{ fontWeight: 600 }}>{h.name}</div>
                    {h.description && <div style={{ fontSize: 11, color: '#94a3b8' }}>{h.description}</div>}
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: h.active ? '#dcfce7' : '#f1f5f9', color: h.active ? '#166534' : '#94a3b8', whiteSpace: 'nowrap' }}>
                    {h.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
                  <span>{FEE_TYPE_LABELS[h.feeType]}</span>
                  {h.refundable && <span>↩ Refundable</span>}
                  {h.optional && <span>Optional</span>}
                </div>
                {perms.canEdit && (
                  <div className="fee-card-item__actions">
                    <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openEdit(h)}>Edit</button>
                    {h.active && <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px', color: '#dc2626' }} onClick={() => setDeactivateTarget(h)}>Deactivate</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deactivateTarget}
        title={`Deactivate "${deactivateTarget?.name}"?`}
        description="Inactive fee heads cannot be added to new fee plan items. This will be blocked if any student demands already reference this fee head."
        danger confirmLabel="Deactivate"
        onConfirm={() => { if (deactivateTarget) deactivateMutation.mutate(deactivateTarget.id); }}
        onClose={() => setDeactivateTarget(null)}
      />
    </div>
  );
}

// ─── Installment editor ──────────────────────────────────────────────────���─────

type InstDraft = { name: string; dueDate: string; amount: string; sequence: number };

// Suggested installment count per frequency
const INST_COUNT: Record<FeeFrequency, number> = {
  ONE_TIME: 1, YEARLY: 1, HALF_YEARLY: 2, QUARTERLY: 4, MONTHLY: 12, CUSTOM: 1,
};

const INST_NAME_FN: Record<FeeFrequency, (i: number) => string> = {
  ONE_TIME:    ()  => 'Full Payment',
  YEARLY:      ()  => 'Annual Payment',
  HALF_YEARLY: (i) => ['Half-yearly 1 (Apr–Sep)', 'Half-yearly 2 (Oct–Mar)'][i] ?? `Half ${i + 1}`,
  QUARTERLY:   (i) => ['Q1 (Apr–Jun)', 'Q2 (Jul–Sep)', 'Q3 (Oct–Dec)', 'Q4 (Jan–Mar)'][i] ?? `Q${i + 1}`,
  MONTHLY:     (i) => ['April','May','June','July','August','September','October','November','December','January','February','March'][i] + ' Installment',
  CUSTOM:      (i) => `Installment ${i + 1}`,
};

function buildDefaultInstRows(item: FeePlanItem): InstDraft[] {
  const amt  = typeof item.amount === 'string' ? parseFloat(item.amount) || 0 : item.amount || 0;
  const n    = INST_COUNT[item.frequency] ?? 1;
  const base = Math.floor((amt / n) * 100) / 100;
  const last = Math.round((amt - base * (n - 1)) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    name:     INST_NAME_FN[item.frequency]?.(i) ?? `Installment ${i + 1}`,
    dueDate:  '',
    amount:   String(i === n - 1 ? last : base),
    sequence: i + 1,
  }));
}

function InstallmentEditor({ item, planId, onDone }: { item: FeePlanItem; planId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<InstDraft[]>(() =>
    item.installments && item.installments.length > 0
      ? item.installments.map((inst, i) => ({ name: inst.name, dueDate: formatJsonDate(inst.dueDate), amount: String(inst.amount), sequence: inst.sequence || i + 1 }))
      : buildDefaultInstRows(item),
  );
  const [err, setErr] = useState('');

  const itemAmt = typeof item.amount === 'string' ? parseFloat(item.amount) || 0 : item.amount || 0;
  const rowTotal = rows.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0);
  const balanced = Math.abs(rowTotal - itemAmt) < 0.01;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const installments = rows.map((r, i) => ({ name: r.name, dueDate: r.dueDate, amount: parseFloat(r.amount), sequence: r.sequence || i + 1 }));
      return (await api.post(`/api/fees/plans/${planId}/items/${item.id}/installments`, { installments })).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fee-plan-detail', planId] });
      toast.success('Installments saved');
      onDone();
    },
    onError: (e) => setErr(formatApiError(e)),
  });

  return (
    <div className="card stack" style={{ margin: '8px 0', borderLeft: '4px solid #0ea5e9' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>Installments — {item.feeHeadName}</strong>
        <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onDone}>Close</button>
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        Total must equal {fmt(item.amount)}. Current: <span style={{ color: balanced ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{fmt(rowTotal)}</span>
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="stack" style={{ flex: 2, minWidth: 120 }}>
            {idx === 0 && <label style={{ fontSize: 11 }}>Name</label>}
            <input value={row.name} onChange={e => setRows(r => r.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} placeholder={`Instalment ${idx + 1}`} />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 130 }}>
            {idx === 0 && <label style={{ fontSize: 11 }}>Due Date</label>}
            <DateKeeper value={row.dueDate} onChange={v => setRows(r => r.map((x, i) => i === idx ? { ...x, dueDate: v } : x))} emptyLabel="Pick date" clearable />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 110 }}>
            {idx === 0 && <label style={{ fontSize: 11 }}>Amount (₹)</label>}
            <input type="number" min="0" step="0.01" value={row.amount} onChange={e => setRows(r => r.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} />
          </div>
          <button type="button" className="btn secondary" style={{ padding: '8px 10px', fontSize: 12, color: '#dc2626', flexShrink: 0 }} onClick={() => setRows(r => r.filter((_, i) => i !== idx).map((x, i) => ({ ...x, sequence: i + 1 })))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setRows(r => [...r, { name: `Instalment ${r.length + 1}`, dueDate: '', amount: '', sequence: r.length + 1 }])}>+ Add Row</button>
      </div>
      {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
      <div className="row">
        <button type="button" className="btn" disabled={saveMutation.isPending || !balanced} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Saving…' : 'Save Installments'}
        </button>
      </div>
    </div>
  );
}

// ─── Fee Rules Grouped View ─────────────────────────────────────────────────

interface FeeRulesGroupedProps {
  items: FeePlanItem[];
  classGroups: ClassGroup[];
  students: Student[];
  isEditable: boolean;
  installmentItem: FeePlanItem | null;
  setInstallmentItem: (it: FeePlanItem | null) => void;
  scheduleStatus: (it: FeePlanItem) => 'missing' | 'invalid' | 'ready';
  overrideBadge: (it: FeePlanItem) => string | null;
  openEditItem: (it: FeePlanItem) => void;
  setDeleteItemTarget: (it: FeePlanItem) => void;
}

function FeeRulesGrouped({ items, classGroups, students, isEditable, installmentItem, setInstallmentItem, scheduleStatus, overrideBadge, openEditItem, setDeleteItemTarget }: FeeRulesGroupedProps) {

  function renderRow(it: FeePlanItem) {
    const instCount = it.installments?.length ?? 0;
    const instTotal = sumInst(it.installments ?? []);
    const itAmt = typeof it.amount === 'string' ? parseFloat(it.amount) || 0 : it.amount || 0;
    const status = scheduleStatus(it);
    const isInstOpen = installmentItem?.id === it.id;
    const badge = overrideBadge(it);

    return (
      <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
        <td style={{ padding: '8px 10px' }}>
          <div style={{ fontWeight: 600 }}>{it.feeHeadName}</div>
          <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}>{it.feeHeadCode}</div>
          {badge && (
            <span style={{ display: 'inline-block', marginTop: 3, padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
              ↑ {badge}
            </span>
          )}
        </td>
        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{fmt(it.amount)}</td>
        <td style={{ padding: '8px 10px', fontSize: 12 }}>{FREQUENCY_LABELS[it.frequency]}</td>
        <td style={{ padding: '8px 10px' }}>
          {status === 'missing' && <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 600 }}>⚠ No schedule</span>}
          {status === 'invalid' && <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>⚠ Total {fmt(instTotal)}, expected {fmt(itAmt)}</span>}
          {status === 'ready' && <span style={{ color: '#16a34a', fontSize: 11 }}>✓ {instCount} installment{instCount !== 1 ? 's' : ''} · {fmt(instTotal)}</span>}
        </td>
        <td style={{ padding: '8px 10px' }}>
          <div className="row" style={{ gap: 5 }}>
            {isEditable && status === 'missing' && (
              <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px', background: '#dc2626', borderColor: '#dc2626' }} onClick={() => setInstallmentItem(isInstOpen ? null : it)}>
                {isInstOpen ? 'Close' : '📅 Create Schedule'}
              </button>
            )}
            {isEditable && status === 'invalid' && (
              <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px', background: '#d97706', borderColor: '#d97706' }} onClick={() => setInstallmentItem(isInstOpen ? null : it)}>
                {isInstOpen ? 'Close' : '⚠ Fix Schedule'}
              </button>
            )}
            {isEditable && status === 'ready' && (
              <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setInstallmentItem(isInstOpen ? null : it)}>
                {isInstOpen ? 'Close' : '📅 Edit Schedule'}
              </button>
            )}
            {!isEditable && status !== 'missing' && (
              <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setInstallmentItem(isInstOpen ? null : it)}>
                {isInstOpen ? 'Close' : '📅 View Schedule'}
              </button>
            )}
            {isEditable && (
              <>
                <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => openEditItem(it)}>✏ Edit</button>
                <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }} onClick={() => setDeleteItemTarget(it)}>🗑 Remove</button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function renderTable(groupItems: FeePlanItem[]) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
              {['Fee Head', 'Amount', 'Frequency', 'Schedule', 'Actions'].map(h => (
                <th key={h} style={{ padding: '7px 10px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{groupItems.map(it => renderRow(it))}</tbody>
        </table>
      </div>
    );
  }

  function renderGroup(title: string, groupItems: FeePlanItem[], helperText?: string) {
    if (!groupItems.length) return null;
    return (
      <div key={title} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>{groupItems.length} rule{groupItems.length !== 1 ? 's' : ''}</span>
          </div>
          {helperText && <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{helperText}</span>}
        </div>
        {renderTable(groupItems)}
      </div>
    );
  }

  const schoolItems   = items.filter(it => it.applicableScopeType === 'SCHOOL');
  const classItems    = items.filter(it => it.applicableScopeType === 'CLASS');
  const sectionItems  = items.filter(it => it.applicableScopeType === 'SECTION');
  const studentItems  = items.filter(it => it.applicableScopeType === 'STUDENT');

  // Group class items by gradeLevel
  const classGradeMap = new Map<string | number, FeePlanItem[]>();
  for (const it of classItems) {
    const cg = classGroups.find(c => c.id === it.applicableScopeId);
    const key = cg?.gradeLevel != null ? `Grade ${cg.gradeLevel}` : (cg?.displayName ?? `Group #${it.applicableScopeId}`);
    if (!classGradeMap.has(key)) classGradeMap.set(key, []);
    classGradeMap.get(key)!.push(it);
  }

  // Group section items by classGroup displayName
  const sectionGroupMap = new Map<string, FeePlanItem[]>();
  for (const it of sectionItems) {
    const cg = classGroups.find(c => c.id === it.applicableScopeId);
    const key = cg ? (cg.gradeLevel != null ? `Grade ${cg.gradeLevel} – ${cg.section ?? cg.displayName}` : cg.displayName) : `Section #${it.applicableScopeId}`;
    if (!sectionGroupMap.has(key)) sectionGroupMap.set(key, []);
    sectionGroupMap.get(key)!.push(it);
  }

  // Group student items by student name
  const studentGroupMap = new Map<string, FeePlanItem[]>();
  for (const it of studentItems) {
    const s = students.find(s => s.id === it.applicableScopeId);
    const key = s ? `${s.firstName} ${s.lastName ?? ''}`.trim() : `Student #${it.applicableScopeId}`;
    if (!studentGroupMap.has(key)) studentGroupMap.set(key, []);
    studentGroupMap.get(key)!.push(it);
  }

  const hasOverrides = classItems.length > 0 || sectionItems.length > 0 || studentItems.length > 0;

  return (
    <div className="stack" style={{ gap: 10 }}>
      {hasOverrides && (
        <div style={{ fontSize: 12, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 12px' }}>
          💡 More specific rules override broader rules for the same fee head. Different fee heads are always additive.
        </div>
      )}

      {/* School-wide */}
      {renderGroup('🏫 School-wide Fees', schoolItems, 'Applied to all students unless overridden')}

      {/* Class-wise */}
      {classItems.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#f8fafc', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>📚 Class-wise Fees</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>{classItems.length} rule{classItems.length !== 1 ? 's' : ''}</span>
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Overrides school-wide for same fee head</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {Array.from(classGradeMap.entries()).sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(([key, gradeItems]) => (
              <div key={String(key)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ padding: '6px 14px', background: '#fff', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9' }}>{String(key)}</div>
                {renderTable(gradeItems)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section overrides */}
      {sectionItems.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#f8fafc', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>🏷 Section Overrides</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>{sectionItems.length} rule{sectionItems.length !== 1 ? 's' : ''}</span>
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Overrides class/school for same fee head</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {Array.from(sectionGroupMap.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([key, sItems]) => (
              <div key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ padding: '6px 14px', background: '#fff', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9' }}>{key}</div>
                {renderTable(sItems)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student overrides */}
      {studentItems.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#f8fafc', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>👤 Student Overrides</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>{studentItems.length} rule{studentItems.length !== 1 ? 's' : ''}</span>
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Most specific — overrides all broader rules</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {Array.from(studentGroupMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, sItems]) => (
              <div key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ padding: '6px 14px', background: '#fff', fontSize: 12, fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9' }}>{key}</div>
                {renderTable(sItems)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fee Plan Detail ────────────────────────────────────────────────────────────

type ItemDraft = { feeHeadId: string; applicableScopeType: ApplicableScopeType; applicableScopeId: string; amount: string; frequency: FeeFrequency; mandatory: boolean };
const EMPTY_ITEM: ItemDraft = { feeHeadId: '', applicableScopeType: 'SCHOOL', applicableScopeId: '', amount: '', frequency: 'ONE_TIME', mandatory: true };

function FeePlanDetailView({ planId, onClose, schoolId }: { planId: number; onClose: () => void; schoolId: number | undefined }) {
  const qc = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<FeePlanItem | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft>({ ...EMPTY_ITEM, applicableScopeId: schoolId ? String(schoolId) : '' });
  const [itemErr, setItemErr] = useState('');
  const [installmentItem, setInstallmentItem] = useState<FeePlanItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<FeePlanItem | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Generate demands state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePreview, setGeneratePreview] = useState<DemandGenerationResult | null>(null);
  const [generateError, setGenerateError] = useState('');

  const detailQ = useQuery({
    queryKey: ['fee-plan-detail', planId],
    queryFn: async () => (await api.get<FeePlanDetail>(`/api/fees/plans/${planId}`)).data,
  });

  const headsQ = useQuery({
    queryKey: ['fee-heads'],
    queryFn: async () => (await api.get<SpringPage<FeeHead>>('/api/fees/heads?size=200&sort=name,asc')).data,
  });
  const activeHeads = pageContent(headsQ.data).filter(h => h.active);

  const classGroupsQ = useQuery({
    queryKey: ['class-groups-all'],
    queryFn: async () => (await api.get<SpringPage<ClassGroup> | ClassGroup[]>('/api/class-groups?size=500')).data,
  });
  const classGroups = pageContent(classGroupsQ.data);

  const studentsQ = useQuery({
    queryKey: ['students-list-fee'],
    queryFn: async () => (await api.get<SpringPage<Student> | Student[]>('/api/students?size=500')).data,
    enabled: itemDraft.applicableScopeType === 'STUDENT' ||
      (detailQ.data?.items ?? []).some(i => i.applicableScopeType === 'STUDENT'),
  });
  const students = pageContent(studentsQ.data);

  const plan = detailQ.data?.plan;
  const items = detailQ.data?.items ?? [];
  const isEditable = plan?.status === 'DRAFT';
  const hasItems = items.length > 0;

  // Schedule validity helpers
  function scheduleStatus(it: FeePlanItem): 'missing' | 'invalid' | 'ready' {
    const n = it.installments?.length ?? 0;
    if (n === 0) return 'missing';
    const itAmt = typeof it.amount === 'string' ? parseFloat(it.amount) || 0 : it.amount || 0;
    const instTotal = sumInst(it.installments ?? []);
    return Math.abs(instTotal - itAmt) < 0.01 ? 'ready' : 'invalid';
  }

  const missingScheduleItems = items.filter(it => scheduleStatus(it) === 'missing');
  const invalidScheduleItems = items.filter(it => scheduleStatus(it) === 'invalid');
  const allHaveValidSchedules = hasItems && missingScheduleItems.length === 0 && invalidScheduleItems.length === 0;
  const totalInstallments = items.reduce((sum, it) => sum + (it.installments?.length ?? 0), 0);

  // Resolve a human-readable label for an item's scope target
  function itemTargetLabel(it: FeePlanItem): string {
    if (it.applicableScopeType === 'SCHOOL') return 'all students';
    if (it.applicableScopeType === 'CLASS' || it.applicableScopeType === 'SECTION') {
      const cg = classGroups.find(c => c.id === it.applicableScopeId);
      if (cg) return it.applicableScopeType === 'CLASS' && cg.gradeLevel != null
        ? `Grade ${cg.gradeLevel}` : cg.displayName;
    }
    if (it.applicableScopeType === 'STUDENT') {
      const s = students.find(s => s.id === it.applicableScopeId);
      return s ? `${s.firstName} ${s.lastName ?? ''}`.trim() : `Student #${it.applicableScopeId}`;
    }
    return String(it.applicableScopeId);
  }

  function scopePriority(s: ApplicableScopeType): number {
    return ({ SCHOOL: 1, CLASS: 2, SECTION: 3, STUDENT: 4 } as Record<string, number>)[s] ?? 0;
  }

  function overrideBadge(it: FeePlanItem): string | null {
    if (it.applicableScopeType === 'SCHOOL') return null;
    const thisPriority = scopePriority(it.applicableScopeType);
    const overridden = items.filter(o =>
      o.id !== it.id && o.feeHeadId === it.feeHeadId && scopePriority(o.applicableScopeType) < thisPriority);
    if (!overridden.length) return null;
    const highest = [...overridden].sort((a, b) => scopePriority(b.applicableScopeType) - scopePriority(a.applicableScopeType))[0];
    return ({ SCHOOL: 'Overrides school-wide', CLASS: 'Overrides class fee', SECTION: 'Overrides section fee' } as Record<string, string>)[highest.applicableScopeType] ?? null;
  }

  // Real-time duplicate detection while filling in Add Item form
  const dupCheck = useMemo<string | null>(() => {
    if (!itemDraft.feeHeadId || !itemDraft.applicableScopeId) return null;
    const fhId = Number(itemDraft.feeHeadId);
    const scopeId = Number(itemDraft.applicableScopeId);
    const conflict = items.find(it =>
      it.feeHeadId === fhId &&
      it.applicableScopeType === itemDraft.applicableScopeType &&
      it.applicableScopeId === scopeId &&
      (!editingItem || it.id !== editingItem.id)
    );
    if (!conflict) return null;
    const fhName = activeHeads.find(h => h.id === fhId)?.name ?? 'This fee head';
    let targetLabel = String(scopeId);
    if (itemDraft.applicableScopeType === 'SCHOOL') {
      targetLabel = 'all students';
    } else if (itemDraft.applicableScopeType === 'CLASS' || itemDraft.applicableScopeType === 'SECTION') {
      const cg = classGroups.find(c => c.id === scopeId);
      if (cg) targetLabel = itemDraft.applicableScopeType === 'CLASS' && cg.gradeLevel != null
        ? `Grade ${cg.gradeLevel}` : cg.displayName;
    }
    return `${fhName} is already configured for ${targetLabel}. Edit the existing item or choose a different class/section.`;
  }, [itemDraft, items, editingItem, activeHeads, classGroups]);

  function scopeOptions(t: ApplicableScopeType) {
    if (t === 'SCHOOL') return schoolId ? [{ value: String(schoolId), label: 'All students (School-wide)' }] : [];
    if (t === 'CLASS') {
      // One entry per grade level — backend resolves ALL sections of that grade
      const gradeMap = new Map<number, ClassGroup>();
      const noGrade: ClassGroup[] = [];
      for (const cg of classGroups) {
        if (cg.gradeLevel != null) {
          if (!gradeMap.has(cg.gradeLevel)) gradeMap.set(cg.gradeLevel, cg);
        } else {
          noGrade.push(cg);
        }
      }
      const gradeEntries = Array.from(gradeMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([grade, cg]) => ({ value: String(cg.id), label: `Grade ${grade} (all sections)` }));
      return [...gradeEntries, ...noGrade.map(cg => ({ value: String(cg.id), label: cg.displayName }))];
    }
    if (t === 'SECTION') return classGroups.map(cg => ({ value: String(cg.id), label: cg.gradeLevel != null ? `Grade ${cg.gradeLevel} – ${cg.section ?? cg.displayName}` : cg.displayName }));
    return students.map(s => ({ value: String(s.id), label: `${s.firstName} ${s.lastName ?? ''}`.trim() + ` (${s.admissionNo})` }));
  }

  function resetItem() { setEditingItem(null); setItemDraft({ ...EMPTY_ITEM, applicableScopeId: schoolId ? String(schoolId) : '' }); setItemErr(''); setShowAddItem(false); }
  function openAddItem() { setEditingItem(null); setItemDraft({ ...EMPTY_ITEM, applicableScopeId: schoolId ? String(schoolId) : '' }); setItemErr(''); setShowAddItem(true); }
  function openEditItem(it: FeePlanItem) {
    setEditingItem(it);
    setItemDraft({ feeHeadId: String(it.feeHeadId), applicableScopeType: it.applicableScopeType, applicableScopeId: String(it.applicableScopeId), amount: String(it.amount), frequency: it.frequency, mandatory: it.mandatory });
    setItemErr(''); setShowAddItem(true);
  }

  const saveItemMut = useMutation<FeePlanItem, Error>({
    mutationFn: async () => {
      const body = { feeHeadId: Number(itemDraft.feeHeadId), applicableScopeType: itemDraft.applicableScopeType, applicableScopeId: Number(itemDraft.applicableScopeId), amount: parseFloat(itemDraft.amount), frequency: itemDraft.frequency, mandatory: itemDraft.mandatory };
      return editingItem
        ? (await api.put(`/api/fees/plans/${planId}/items/${editingItem.id}`, body)).data
        : (await api.post(`/api/fees/plans/${planId}/items`, body)).data;
    },
    onSuccess: async (savedItem) => {
      await qc.invalidateQueries({ queryKey: ['fee-plan-detail', planId] });
      const isNew = !editingItem;
      toast.success(isNew ? 'Item added — set up installments below' : 'Item updated');
      resetItem();
      if (isNew) setInstallmentItem(savedItem);
    },
    onError: (e) => setItemErr(formatApiError(e)),
  });

  const deleteItemMut = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/fees/plans/${planId}/items/${id}`)).data,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['fee-plan-detail', planId] }); toast.success('Item removed'); setDeleteItemTarget(null); },
    onError: (e) => toast.error('Delete failed', formatApiError(e)),
  });

  const publishMut = useMutation({
    mutationFn: async () => (await api.post(`/api/fees/plans/${planId}/publish`)).data,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['fee-plan-detail', planId] }); await qc.invalidateQueries({ queryKey: ['fee-plans'] }); toast.success('Fee plan published!'); setShowPublishConfirm(false); },
    onError: (e) => toast.error('Publish failed', formatApiError(e)),
  });

  const archiveMut = useMutation({
    mutationFn: async () => (await api.post(`/api/fees/plans/${planId}/archive`)).data,
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['fee-plan-detail', planId] }); await qc.invalidateQueries({ queryKey: ['fee-plans'] }); toast.success('Plan archived'); setShowArchiveConfirm(false); },
    onError: (e) => toast.error('Archive failed', formatApiError(e)),
  });

  // Generate demands mutations
  const dryRunMut = useMutation({
    mutationFn: async () => (await api.post<DemandGenerationResult>(`/api/fees/plans/${planId}/generate-demands`, { dryRun: true })).data,
    onSuccess: (data) => { setGeneratePreview(data); setGenerateError(''); },
    onError: (e) => setGenerateError(formatApiError(e)),
  });

  const generateMut = useMutation({
    mutationFn: async () => (await api.post<DemandGenerationResult>(`/api/fees/plans/${planId}/generate-demands`, { dryRun: false })).data,
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['fee-demands'] });
      toast.success(`Generated ${data.createdDemands} demand(s) successfully.`);
      setShowGenerateModal(false);
      setGeneratePreview(null);
    },
    onError: (e) => setGenerateError(formatApiError(e)),
  });

  function openGenerateModal() {
    setGeneratePreview(null);
    setGenerateError('');
    setShowGenerateModal(true);
    dryRunMut.mutate();
  }

  if (detailQ.isLoading) return <div className="muted" style={{ padding: 24 }}>Loading plan…</div>;
  if (detailQ.error || !plan) return <div style={{ color: '#dc2626', padding: 24 }}>{formatApiError(detailQ.error)}</div>;

  const s = STATUS_PILL[plan.status];

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Plan header */}
      <div className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>{plan.name}</h3>
              <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{plan.status}</span>
              {plan.status !== 'DRAFT' && (
                <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }}>🔒 Read-only</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {plan.academicYearLabel} · {items.length} item{items.length !== 1 ? 's' : ''} · Configured item total: <strong>{fmt(sumItems(items))}</strong>
              {plan.publishedAt ? ` · Published ${formatJsonDate(plan.publishedAt)}` : ''}
            </div>
            {/* Publish readiness indicator */}
            {plan.status === 'DRAFT' && hasItems && (
              allHaveValidSchedules ? (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                  ✓ Ready to publish · {items.length} item{items.length !== 1 ? 's' : ''} · {totalInstallments} installment{totalInstallments !== 1 ? 's' : ''} configured
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                  ✗ Cannot publish · {missingScheduleItems.length + invalidScheduleItems.length} item{(missingScheduleItems.length + invalidScheduleItems.length) !== 1 ? '(s)' : ''} missing or invalid schedule
                </div>
              )
            )}
          </div>
          {/* Header action buttons */}
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {/* Primary action */}
            {plan.status === 'DRAFT' && (
              <button type="button" className="btn"
                disabled={!hasItems || !allHaveValidSchedules}
                title={!hasItems ? 'Add items first' : !allHaveValidSchedules ? 'Fix schedules before publishing' : undefined}
                onClick={() => setShowPublishConfirm(true)}>
                🚀 Publish Plan
              </button>
            )}
            {plan.status === 'PUBLISHED' && (
              <button type="button" className="btn" style={{ background: 'linear-gradient(180deg,#059669,#047857)', borderColor: '#047857' }}
                onClick={openGenerateModal}>
                ⚡ Generate Student Dues
              </button>
            )}
            {/* Secondary: Back */}
            <button type="button" className="btn secondary" onClick={onClose}>← Back</button>
            {/* More menu */}
            {plan.status !== 'ARCHIVED' && (
              <div style={{ position: 'relative' }}>
                <button type="button" className="btn secondary" style={{ padding: '8px 10px' }}
                  onClick={() => setShowMoreMenu(v => !v)} title="More options">⋯</button>
                {showMoreMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowMoreMenu(false)} />
                    <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(15,23,42,0.1)', zIndex: 101, minWidth: 160, overflow: 'hidden' }}>
                      <button type="button" style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        onClick={() => { setShowMoreMenu(false); setShowArchiveConfirm(true); }}>
                        📦 Archive Plan
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {plan.status === 'DRAFT' && hasItems && missingScheduleItems.length > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>
            ⚠ Missing schedule: {missingScheduleItems.map(it => `${it.feeHeadName} · ${itemTargetLabel(it)}`).join(', ')}.
          </div>
        )}
        {plan.status === 'DRAFT' && hasItems && invalidScheduleItems.length > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fff7ed', color: '#92400e', fontSize: 12 }}>
            ⚠ Invalid schedule total: {invalidScheduleItems.map(it => `${it.feeHeadName} · ${itemTargetLabel(it)}`).join(', ')}.
          </div>
        )}
      </div>

      {/* Fee Rules section */}
      <div className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Fee Rules</strong>
            <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>{items.length} rule{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {!isEditable && plan.status !== 'DRAFT' && (
              <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                🔒 Plan is {plan.status.toLowerCase()} — rules are read-only
              </span>
            )}
            {isEditable && <button type="button" className="btn" style={{ fontSize: 13, padding: '6px 14px' }} onClick={openAddItem}>+ Add Rule</button>}
          </div>
        </div>

        {showAddItem && isEditable && (
          <div className="card stack" style={{ borderLeft: '4px solid var(--color-primary)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 13 }}>{editingItem ? 'Edit Fee Rule' : 'Add Fee Rule'}</strong>
              <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={resetItem}>Close</button>
            </div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="stack" style={{ flex: 2, minWidth: 200 }}>
                <label style={{ fontSize: 13 }}>Fee Head *</label>
                <SmartSelect value={itemDraft.feeHeadId} onChange={v => setItemDraft(d => ({ ...d, feeHeadId: v }))}
                  options={activeHeads.map(h => ({ value: String(h.id), label: h.name, meta: `${h.code} · ${FEE_TYPE_LABELS[h.feeType]}` }))}
                  placeholder="Select fee head…" searchable />
              </div>
              <div className="stack" style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 13 }}>Applies To *</label>
                <SelectKeeper value={itemDraft.applicableScopeType} onChange={v => {
                  const st = v as ApplicableScopeType;
                  setItemDraft(d => ({ ...d, applicableScopeType: st, applicableScopeId: st === 'SCHOOL' && schoolId ? String(schoolId) : '' }));
                }} options={[
                  { value: 'SCHOOL', label: 'School-wide (all students)' },
                  { value: 'CLASS', label: 'Class (all sections)' },
                  { value: 'SECTION', label: 'Section' },
                  { value: 'STUDENT', label: 'Individual Student' },
                ]} />
              </div>
              {itemDraft.applicableScopeType !== 'SCHOOL' && (
                <div className="stack" style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ fontSize: 13 }}>{itemDraft.applicableScopeType === 'STUDENT' ? 'Student' : 'Class / Section'} *</label>
                  <SmartSelect value={itemDraft.applicableScopeId} onChange={v => setItemDraft(d => ({ ...d, applicableScopeId: v }))}
                    options={scopeOptions(itemDraft.applicableScopeType)} placeholder="Select…" searchable />
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
              💡 For the same fee head, more specific rules override broader ones: <strong>School → Class → Section → Student</strong>. Different fee heads are always additive.
            </div>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="stack" style={{ flex: 1, minWidth: 130 }}>
                <label style={{ fontSize: 13 }}>Amount (₹) *</label>
                <input type="number" min="0.01" step="0.01" value={itemDraft.amount} onChange={e => setItemDraft(d => ({ ...d, amount: e.target.value }))} placeholder="5000" />
              </div>
              <div className="stack" style={{ flex: 1, minWidth: 150 }}>
                <label style={{ fontSize: 13 }}>Frequency</label>
                <SelectKeeper value={itemDraft.frequency} onChange={v => setItemDraft(d => ({ ...d, frequency: v as FeeFrequency }))}
                  options={FEE_FREQUENCIES.map(f => ({ value: f, label: FREQUENCY_LABELS[f] }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', paddingTop: 26 }}>
                <input type="checkbox" className="sms-checkbox" checked={itemDraft.mandatory} onChange={e => setItemDraft(d => ({ ...d, mandatory: e.target.checked }))} />Mandatory
              </label>
            </div>
            {(itemErr || dupCheck) && <div style={{ color: '#dc2626', fontSize: 13 }}>{dupCheck ?? itemErr}</div>}
            <div className="row">
              <button type="button" className="btn"
                disabled={saveItemMut.isPending || !itemDraft.feeHeadId || !itemDraft.amount || !itemDraft.applicableScopeId || !!dupCheck}
                onClick={() => saveItemMut.mutate()}>
                {saveItemMut.isPending ? 'Saving…' : editingItem ? 'Update' : 'Add Rule'}
              </button>
              <button type="button" className="btn secondary" onClick={resetItem}>Cancel</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No fee rules yet.{isEditable ? ' Add a rule above.' : ''}</div>
        ) : (
          <FeeRulesGrouped
            items={items}
            classGroups={classGroups}
            students={students}
            isEditable={isEditable}
            installmentItem={installmentItem}
            setInstallmentItem={setInstallmentItem}
            scheduleStatus={scheduleStatus}
            overrideBadge={overrideBadge}
            openEditItem={openEditItem}
            setDeleteItemTarget={setDeleteItemTarget}
          />
        )}

        {installmentItem && (
          <InstallmentEditor key={installmentItem.id} item={installmentItem} planId={planId} onDone={() => setInstallmentItem(null)} />
        )}
      </div>

      <ConfirmDialog open={!!deleteItemTarget}
        title={`Remove ${deleteItemTarget?.feeHeadName ?? 'rule'}${deleteItemTarget ? ` for ${itemTargetLabel(deleteItemTarget)}` : ''} from this draft plan?`}
        description="This will permanently remove the fee rule and all its installments from this plan."
        danger confirmLabel="Remove" onConfirm={() => { if (deleteItemTarget) deleteItemMut.mutate(deleteItemTarget.id); }} onClose={() => setDeleteItemTarget(null)} />

      {/* Publish confirmation modal */}
      {showPublishConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { if (!publishMut.isPending) setShowPublishConfirm(false); }}>
          <div className="card stack" style={{ maxWidth: 480, width: '100%', gap: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Publish fee plan?</h3>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{plan.name}</div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>Fee items and installment schedules will become <strong>read-only</strong>.</li>
              <li>Student dues can be generated after publishing.</li>
              <li>Future changes should be made through a <strong>revised fee plan</strong>.</li>
            </ul>
            {publishMut.isError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13 }}>
                {formatApiError(publishMut.error)}
              </div>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn" style={{ flex: 1 }}
                disabled={publishMut.isPending}
                onClick={() => publishMut.mutate()}>
                {publishMut.isPending ? 'Publishing…' : '🚀 Publish Plan'}
              </button>
              <button type="button" className="btn secondary" disabled={publishMut.isPending} onClick={() => setShowPublishConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={showArchiveConfirm} title={`Archive "${plan.name}"?`} description="Archived plans are read-only."
        confirmLabel="Archive" onConfirm={() => archiveMut.mutate()} onClose={() => setShowArchiveConfirm(false)} />

      {/* Generate Demands Modal */}
      {showGenerateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { if (!generateMut.isPending && !dryRunMut.isPending) { setShowGenerateModal(false); setGeneratePreview(null); } }}>
          <div className="card stack" style={{ maxWidth: 520, width: '100%', gap: 16 }} onClick={e => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>Generate Student Dues</strong>
              <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                disabled={generateMut.isPending}
                onClick={() => { setShowGenerateModal(false); setGeneratePreview(null); }}>✕ Close</button>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Plan: <strong>{plan.name}</strong> · {plan.academicYearLabel}</div>

            {dryRunMut.isPending && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>⏳</div>
                Computing preview…
              </div>
            )}

            {generateError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13 }}>
                {generateError}
              </div>
            )}

            {generatePreview && !dryRunMut.isPending && (
              <div className="stack" style={{ gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Applicable Students',  value: generatePreview.totalApplicableStudents },
                    { label: 'Demands to Create',    value: generatePreview.createdDemands },
                    { label: 'Already Exist (skip)', value: generatePreview.skippedExistingDemands },
                    { label: 'Total Amount',          value: fmt(generatePreview.totalAmountGenerated) },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{kpi.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {generatePreview.warnings.length > 0 && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⚠ Warnings</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#92400e' }}>
                      {generatePreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {generatePreview.overrideNotes && generatePreview.overrideNotes.length > 0 && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 6 }}>📊 Override Summary</div>
                    <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 6 }}>More specific rules override broader rules for the same fee head.</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#075985' }}>
                      {generatePreview.overrideNotes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}

                {generatePreview.createdDemands === 0 && generatePreview.skippedExistingDemands > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
                    ✓ All demands already exist — no new demands will be created.
                  </div>
                )}

                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn" style={{ flex: 1 }}
                    disabled={generateMut.isPending || generatePreview.createdDemands === 0}
                    onClick={() => { setGenerateError(''); generateMut.mutate(); }}>
                    {generateMut.isPending ? 'Generating…' : `Confirm — Create ${generatePreview.createdDemands} Demand(s)`}
                  </button>
                  <button type="button" className="btn secondary"
                    disabled={generateMut.isPending}
                    onClick={() => { setShowGenerateModal(false); setGeneratePreview(null); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Fee Plans ─────────────────────────────────────────────────────────────

type PlanDraft = { name: string; academicYearId: string; description: string };
const EMPTY_PLAN: PlanDraft = { name: '', academicYearId: '', description: '' };

function TabFeePlans({ schoolId, perms }: { schoolId: number | undefined; perms: FeePermissions }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_PLAN);
  const [err, setErr] = useState('');
  const [openPlanId, setOpenPlanId] = useState<number | null>(null);

  const plansQ = useQuery({
    queryKey: ['fee-plans'],
    queryFn: async () => (await api.get<SpringPage<FeePlan>>('/api/fees/plans?size=100')).data,
  });
  const plans = pageContent(plansQ.data);

  const academicYearsQ = useQuery({
    queryKey: ['academic-years-fee'],
    queryFn: async () => (await api.get<AcademicYear[]>('/api/academic-years')).data,
  });
  const academicYears = Array.isArray(academicYearsQ.data) ? academicYearsQ.data : [];

  const createMut = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error('Plan name is required');
      if (!draft.academicYearId) throw new Error('Academic year is required');
      return (await api.post<FeePlan>('/api/fees/plans', { name: draft.name, academicYearId: Number(draft.academicYearId), description: draft.description || undefined })).data;
    },
    onSuccess: async (newPlan) => {
      await qc.invalidateQueries({ queryKey: ['fee-plans'] });
      toast.success('Fee plan created'); setShowCreate(false); setDraft(EMPTY_PLAN); setOpenPlanId(newPlan.id);
    },
    onError: (e) => setErr(formatApiError(e)),
  });

  if (openPlanId !== null) {
    return <FeePlanDetailView planId={openPlanId} onClose={() => setOpenPlanId(null)} schoolId={schoolId} />;
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>Fee Plans</strong>
          <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>{plans.length} plans</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {perms.viewOnly && <span className="fee-role-notice">👁 View-only access</span>}
          {perms.canEdit && <button type="button" className="btn" onClick={() => { setShowCreate(true); setErr(''); setDraft(EMPTY_PLAN); }}>+ Create Plan</button>}
        </div>
      </div>

      {showCreate && perms.canEdit && (
        <div className="card stack" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>New Fee Plan</strong>
            <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>Close</button>
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="stack" style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 13 }}>Plan Name *</label>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Annual Fee 2026-2027" maxLength={128} />
            </div>
            <div className="stack" style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontSize: 13 }}>Academic Year *</label>
              <SelectKeeper value={draft.academicYearId} onChange={v => setDraft(d => ({ ...d, academicYearId: v }))}
                options={academicYears.map(y => ({ value: String(y.id), label: y.label }))}
                emptyValueLabel="Select year…" />
            </div>
          </div>
          <div className="stack">
            <label style={{ fontSize: 13 }}>Description</label>
            <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Optional…" rows={2} style={{ resize: 'vertical' }} />
          </div>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <div className="row">
            <button type="button" className="btn" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? 'Creating…' : 'Create Plan'}
            </button>
            <button type="button" className="btn secondary" onClick={() => { setShowCreate(false); setDraft(EMPTY_PLAN); }}>Cancel</button>
          </div>
        </div>
      )}

      {plansQ.isLoading ? (
        <div className="muted">Loading…</div>
      ) : plansQ.error ? (
        <div style={{ color: '#dc2626', fontSize: 13 }}>{formatApiError(plansQ.error)}</div>
      ) : plans.length === 0 ? (
        <div className="fee-empty-state">
          <div className="fee-empty-state__icon">📅</div>
          <div className="fee-empty-state__title">No fee plans created</div>
          <div className="fee-empty-state__desc">
            Fee plans group fee items for an academic year. Create a plan, add items with installment schedules, then publish to generate student dues.
          </div>
          {perms.canEdit && <button type="button" className="btn" onClick={() => { setShowCreate(true); setErr(''); setDraft(EMPTY_PLAN); }}>+ Create First Fee Plan</button>}
        </div>
      ) : (
        <>
          <div className="fee-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  {['Plan Name', 'Academic Year', 'Status', 'Published', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map(p => {
                  const ps = STATUS_PILL[p.status];
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <button type="button" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600, fontSize: 13, textDecoration: 'underline' }} onClick={() => setOpenPlanId(p.id)}>{p.name}</button>
                        {p.description ? <div style={{ color: '#94a3b8', fontSize: 11 }}>{p.description}</div> : null}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{p.academicYearLabel}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: ps.bg, color: ps.color }}>{p.status}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.publishedAt ? formatJsonDate(p.publishedAt) : '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{p.createdAt ? formatJsonDate(p.createdAt) : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setOpenPlanId(p.id)}>Open</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="fee-card-list">
            {plans.map(p => {
              const ps = STATUS_PILL[p.status];
              return (
                <div key={p.id} className="fee-card-item">
                  <div className="fee-card-item__row">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.description}</div>}
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.academicYearLabel}</div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: ps.bg, color: ps.color, whiteSpace: 'nowrap' }}>{p.status}</span>
                  </div>
                  {p.publishedAt && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>Published: {formatJsonDate(p.publishedAt)}</div>
                  )}
                  <div className="fee-card-item__actions">
                    <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setOpenPlanId(p.id)}>Open Plan</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── TAB: Collections ──────────────────────────────────────────────────────────

function TabCollections({ perms }: { perms: FeePermissions }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [studentSearch, setStudentSearch] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewPayment, setViewPayment] = useState<FeePaymentDTO | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FeePaymentDTO | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelErr, setCancelErr] = useState('');
  const [collectOpen, setCollectOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<FeePaymentDTO | null>(null);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams();
    if (paymentModeFilter) p.append('paymentMode', paymentModeFilter);
    if (fromDate) p.append('fromDate', fromDate);
    if (toDate) p.append('toDate', toDate);
    if (statusFilter) p.append('status', statusFilter);
    return p.toString();
  }, [paymentModeFilter, fromDate, toDate, statusFilter]);

  const paymentsQ = useQuery({
    queryKey: ['fee-payments', paymentModeFilter, fromDate, toDate, statusFilter],
    queryFn: async () => {
      const qs = buildQs();
      return (await api.get<FeePaymentDTO[]>(`/api/fees/payments${qs ? '?' + qs : ''}`)).data;
    },
  });

  const allPayments = paymentsQ.data ?? [];
  const filtered = studentSearch.trim()
    ? allPayments.filter(p => (p.studentName ?? '').toLowerCase().includes(studentSearch.toLowerCase()) || (p.receiptNo ?? '').toLowerCase().includes(studentSearch.toLowerCase()))
    : allPayments;

  // KPI calculations
  const todayPayments = allPayments.filter(p => p.paymentDate === today && p.status === 'SUCCESS');
  const totalToday = todayPayments.reduce((s, p) => s + toNum(p.amount), 0);
  const currentMonth = today.substring(0, 7);
  const monthPayments = allPayments.filter(p => p.paymentDate?.startsWith(currentMonth) && p.status === 'SUCCESS');
  const totalMonth = monthPayments.reduce((s, p) => s + toNum(p.amount), 0);

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      (await api.post<FeePaymentDTO>(`/api/fees/payments/${id}/cancel`, { cancelReason: reason })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fee-payments'] });
      await qc.invalidateQueries({ queryKey: ['fee-demands'] });
      toast.success('Payment cancelled');
      setCancelTarget(null);
      setCancelReason('');
      setCancelErr('');
    },
    onError: (e) => setCancelErr(formatApiError(e)),
  });

  return (
    <div className="stack">
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total Payments', value: String(allPayments.filter(p => p.status === 'SUCCESS').length), color: '#6366f1' },
          { label: 'Collected Today', value: fmtCompact(totalToday), sub: fmt(totalToday), color: '#16a34a' },
          { label: 'Collected This Month', value: fmtCompact(totalMonth), sub: fmt(totalMonth), color: '#0ea5e9' },
          { label: 'Cancelled', value: String(allPayments.filter(p => p.status === 'CANCELLED').length), color: '#94a3b8' },
        ].map(k => (
          <div key={k.label} className="card" style={{ borderTop: `3px solid ${k.color}`, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color, lineHeight: 1.3 }}>{k.value}</div>
            {'sub' in k && k.sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Actions row + Filters */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 12 }}>Search student / receipt no.</label>
            <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Type to search…" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 12 }}>Payment Mode</label>
            <SelectKeeper value={paymentModeFilter} onChange={setPaymentModeFilter}
              options={PAYMENT_MODES.map(m => ({ value: m, label: PAYMENT_MODE_LABELS[m] }))}
              emptyValueLabel="All modes" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 130 }}>
            <label style={{ fontSize: 12 }}>From Date</label>
            <DateKeeper value={fromDate} onChange={setFromDate} clearable emptyLabel="Any date" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 130 }}>
            <label style={{ fontSize: 12 }}>To Date</label>
            <DateKeeper value={toDate} onChange={setToDate} clearable emptyLabel="Any date" />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 130 }}>
            <label style={{ fontSize: 12 }}>Status</label>
            <SelectKeeper value={statusFilter} onChange={setStatusFilter}
              options={(['SUCCESS', 'PENDING', 'FAILED', 'CANCELLED'] as PaymentStatus[]).map(s => ({ value: s, label: s }))}
              emptyValueLabel="All" />
          </div>
          {(studentSearch || paymentModeFilter || fromDate || toDate || statusFilter) && (
            <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '8px 12px', alignSelf: 'flex-end' }}
              onClick={() => { setStudentSearch(''); setPaymentModeFilter(''); setFromDate(''); setToDate(''); setStatusFilter(''); }}>
              Clear
            </button>
          )}
          {perms.canCollect && (
            <button type="button" className="btn" style={{ alignSelf: 'flex-end', fontSize: 12, padding: '8px 14px' }}
              onClick={() => setCollectOpen(true)}>
              + Collect Payment
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {paymentsQ.isLoading ? (
        <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>Loading payments…</div>
      ) : paymentsQ.error ? (
        <div style={{ color: '#dc2626', fontSize: 13 }}>{formatApiError(paymentsQ.error)}</div>
      ) : filtered.length === 0 ? (
        allPayments.length === 0 ? (
          <div className="fee-empty-state">
            <div className="fee-empty-state__icon">💳</div>
            <div className="fee-empty-state__title">No payments recorded yet</div>
            <div className="fee-empty-state__desc">
              Collect your first payment from the Student Dues tab or use the Collect Payment button above.
            </div>
            {perms.canCollect && (
              <button type="button" className="btn" onClick={() => setCollectOpen(true)}>+ Collect First Payment</button>
            )}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No results match your filters.</div>
        )
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{filtered.length} payment{filtered.length !== 1 ? 's' : ''}</div>
          <div className="fee-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  {['Receipt No', 'Student', 'Amount', 'Mode', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const sp = PAYMENT_STATUS_PILL[p.status] ?? { bg: '#f1f5f9', color: '#94a3b8' };
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)' }}>{p.receiptNo}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600 }}>{p.studentName}</div>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{fmt(p.amount)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12 }}>{PAYMENT_MODE_LABELS[p.paymentMode as PaymentMode] ?? p.paymentMode}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#475569' }}>{p.paymentDate}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sp.bg, color: sp.color }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div className="row" style={{ gap: 5 }}>
                          <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => setViewPayment(p)}>👁 View</button>
                          {perms.canCollect && p.status === 'SUCCESS' && (
                            <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }}
                              onClick={() => { setCancelTarget(p); setCancelReason(''); setCancelErr(''); }}>✕ Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="fee-card-list">
            {filtered.map(p => {
              const sp = PAYMENT_STATUS_PILL[p.status] ?? { bg: '#f1f5f9', color: '#94a3b8' };
              return (
                <div key={p.id} className="fee-card-item">
                  <div className="fee-card-item__row">
                    <div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)', fontSize: 12 }}>{p.receiptNo}</div>
                      <div style={{ fontWeight: 600 }}>{p.studentName}</div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sp.bg, color: sp.color, whiteSpace: 'nowrap' }}>
                      {p.status}
                    </span>
                  </div>
                  <div className="fee-card-item__row">
                    <span className="fee-card-item__label">Amount</span>
                    <span style={{ fontWeight: 700 }}>{fmt(p.amount)}</span>
                  </div>
                  <div className="fee-card-item__row">
                    <span className="fee-card-item__label">Mode</span>
                    <span style={{ fontSize: 12 }}>{PAYMENT_MODE_LABELS[p.paymentMode as PaymentMode] ?? p.paymentMode}</span>
                  </div>
                  <div className="fee-card-item__row">
                    <span className="fee-card-item__label">Date</span>
                    <span style={{ fontSize: 12, color: '#475569' }}>{p.paymentDate}</span>
                  </div>
                  <div className="fee-card-item__actions">
                    <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setViewPayment(p)}>👁 View</button>
                    {perms.canCollect && p.status === 'SUCCESS' && (
                      <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px', color: '#dc2626' }}
                        onClick={() => { setCancelTarget(p); setCancelReason(''); setCancelErr(''); }}>✕ Cancel</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* View payment modal */}
      {viewPayment && <ReceiptSummaryModal payment={viewPayment} onClose={() => setViewPayment(null)} />}

      {/* Collect payment modal (generic — student search not preloaded) */}
      {collectOpen && (
        <CollectFromSearchModal
          onClose={() => setCollectOpen(false)}
          onSuccess={(payment) => {
            setCollectOpen(false);
            setReceiptPayment(payment);
            qc.invalidateQueries({ queryKey: ['fee-payments'] });
            qc.invalidateQueries({ queryKey: ['fee-demands'] });
          }}
        />
      )}

      {receiptPayment && <ReceiptSummaryModal payment={receiptPayment} onClose={() => setReceiptPayment(null)} />}

      {/* Cancel dialog */}
      {cancelTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { if (!cancelMutation.isPending) setCancelTarget(null); }}>
          <div className="card stack" style={{ maxWidth: 440, width: '100%', gap: 14 }} onClick={e => e.stopPropagation()}>
            <strong style={{ fontSize: 15 }}>Cancel Payment {cancelTarget.receiptNo}?</strong>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              This will reverse all allocations and restore the demand balances.
            </div>
            <div className="stack">
              <label style={{ fontSize: 12 }}>Cancel Reason *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                rows={3} placeholder="Reason for cancellation…" style={{ resize: 'vertical' }} />
            </div>
            {cancelErr && <div style={{ color: '#dc2626', fontSize: 13 }}>{cancelErr}</div>}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn" style={{ background: '#dc2626', borderColor: '#dc2626' }}
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                onClick={() => cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })}>
                {cancelMutation.isPending ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
              <button type="button" className="btn secondary" disabled={cancelMutation.isPending} onClick={() => setCancelTarget(null)}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Collect from search modal (used from Collections tab without pre-selected student) ───

function CollectFromSearchModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (p: FeePaymentDTO) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);

  const studentsQ = useQuery({
    queryKey: ['students-collect-search', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      return (await api.get<{ id: number; firstName: string; lastName?: string | null; admissionNo: string }[]>(
        `/api/students?search=${encodeURIComponent(search)}&size=20`
      )).data;
    },
    enabled: search.trim().length >= 2,
  });

  const students = Array.isArray(studentsQ.data) ? studentsQ.data : [];

  if (selected) {
    return (
      <CollectPaymentModal
        studentId={selected.id}
        studentName={selected.name}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div className="card stack" style={{ maxWidth: 480, width: '100%', gap: 14 }} onClick={e => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 15 }}>Select Student</strong>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div className="stack">
          <label style={{ fontSize: 12 }}>Search student by name or admission no.</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type at least 2 characters…" autoFocus />
        </div>
        {studentsQ.isLoading && <div className="muted" style={{ textAlign: 'center' }}>Searching…</div>}
        {students.length > 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {students.map(s => {
              const name = `${s.firstName} ${s.lastName ?? ''}`.trim();
              return (
                <button key={s.id} type="button"
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => setSelected({ id: s.id, name })}>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.admissionNo}</div>
                </button>
              );
            })}
          </div>
        )}
        {search.trim().length >= 2 && !studentsQ.isLoading && students.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No students found.</div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: Overview ─────────────────────────────────────────────────────────────

function TabOverview({ onGoToHeads, onGoToPlans, onGoToDues }: { onGoToHeads: () => void; onGoToPlans: () => void; onGoToDues: () => void }) {
  const [academicYearId, setAcademicYearId] = useState('');

  const academicYearsQ = useQuery({
    queryKey: ['academic-years-overview'],
    queryFn: async () => (await api.get<AcademicYear[]>('/api/academic-years')).data,
    staleTime: 300_000,
  });
  const academicYears = Array.isArray(academicYearsQ.data) ? academicYearsQ.data : [];

  const dashboardQ = useQuery({
    queryKey: ['fee-dashboard', academicYearId],
    queryFn: async () => {
      const qs = academicYearId ? `?academicYearId=${academicYearId}` : '';
      return (await api.get<FeeDashboard>(`/api/fees/dashboard${qs}`)).data;
    },
    staleTime: 30_000,
  });

  const headsQ = useQuery({ queryKey: ['fee-heads'], queryFn: async () => (await api.get<SpringPage<FeeHead>>('/api/fees/heads?size=200')).data, staleTime: 30_000 });
  const plansQ = useQuery({ queryKey: ['fee-plans'], queryFn: async () => (await api.get<SpringPage<FeePlan>>('/api/fees/plans?size=100')).data, staleTime: 30_000 });
  const heads = pageContent(headsQ.data);
  const plans = pageContent(plansQ.data);
  const activeHeads = heads.filter(h => h.active);
  const publishedPlans = plans.filter(p => p.status === 'PUBLISHED');
  const draftPlans = plans.filter(p => p.status === 'DRAFT');

  const d = dashboardQ.data;
  const loading = dashboardQ.isLoading;

  const kpis = [
    { label: 'Total Expected', value: loading ? '…' : fmtCompact(d?.totalExpected), color: '#6366f1', sub: loading ? '' : fmt(d?.totalExpected) },
    { label: 'Total Collected', value: loading ? '…' : fmtCompact(d?.totalCollected), color: '#16a34a', sub: loading ? '' : fmt(d?.totalCollected) },
    { label: 'Outstanding', value: loading ? '…' : fmtCompact(d?.totalOutstanding), color: '#dc2626', sub: loading ? '' : fmt(d?.totalOutstanding) },
    { label: 'Overdue', value: loading ? '…' : fmtCompact(d?.overdueAmount), color: '#b45309', sub: loading ? '' : fmt(d?.overdueAmount) },
    { label: 'Collection Rate', value: loading ? '…' : `${toNum(d?.collectionRate).toFixed(1)}%`, color: '#0ea5e9', sub: 'of expected' },
    { label: 'Students with Dues', value: loading ? '…' : String(d?.studentsWithDues ?? 0), color: '#7c3aed', sub: 'have balance > 0', onClick: onGoToDues },
  ];

  const configTiles = [
    { label: 'Active Fee Heads', value: headsQ.isLoading ? '…' : String(activeHeads.length), sub: `${heads.length} total`, onClick: onGoToHeads, color: '#6366f1' },
    { label: 'Total Plans', value: plansQ.isLoading ? '…' : String(plans.length), sub: `${publishedPlans.length} published`, onClick: onGoToPlans, color: '#0ea5e9' },
    { label: 'Draft Plans', value: plansQ.isLoading ? '…' : String(draftPlans.length), sub: 'pending publish', onClick: onGoToPlans, color: '#f59e0b' },
  ];

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Academic year filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Academic Year:</label>
        <SelectKeeper value={academicYearId} onChange={setAcademicYearId}
          options={academicYears.map(y => ({ value: String(y.id), label: y.label }))}
          emptyValueLabel="All years" />
        {dashboardQ.isRefetching && <span style={{ fontSize: 12, color: '#94a3b8' }}>Refreshing…</span>}
      </div>

      {/* KPI Cards */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Fee KPIs</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 12 }}>
          {kpis.map(k => (
            <div key={k.label} className="card" style={{ borderTop: `3px solid ${k.color}`, cursor: k.onClick ? 'pointer' : 'default' }} onClick={k.onClick}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.4 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Collection progress bar */}
      {d && toNum(d.totalExpected) > 0 && (
        <div className="card" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>Collection Progress</span>
            <span style={{ color: '#6366f1', fontWeight: 700 }}>{toNum(d.collectionRate).toFixed(1)}%</span>
          </div>
          <div style={{ height: 12, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, toNum(d.collectionRate))}%`, background: 'linear-gradient(90deg, #6366f1, #0ea5e9)', borderRadius: 6, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
            <span>Collected: {fmtCompact(d.totalCollected)}</span>
            <span>Expected: {fmtCompact(d.totalExpected)}</span>
          </div>
        </div>
      )}

      {/* Config summary */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Configuration</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 12 }}>
          {configTiles.map(t => (
            <div key={t.label} className="card" style={{ cursor: 'pointer', borderTop: `3px solid ${t.color}` }} onClick={t.onClick}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.color, lineHeight: 1.3 }}>{t.value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="card stack" style={{ gap: 10 }}>
        <strong>Getting Started</strong>
        <div style={{ fontSize: 13, color: '#64748b' }}>Follow these steps to set up fee management:</div>
        <ol style={{ margin: 0, paddingLeft: 20, color: '#475569', fontSize: 13, lineHeight: 2 }}>
          <li>Create <strong>Fee Heads</strong> — define what you charge (Tuition, Lab, Transport, etc.)</li>
          <li>Create a <strong>Fee Plan</strong> for an academic year (e.g. "Annual Fee 2025-26")</li>
          <li>Add <strong>fee items</strong> to the plan with amounts and scope (school-wide / class / student)</li>
          <li>Add <strong>installment schedule</strong> to each item with due dates</li>
          <li><strong>Publish</strong> the plan — then click <em>Generate Student Dues</em> to create demand records</li>
        </ol>
      </div>
    </div>
  );
}

// ─── TAB: Reports ──────────────────────────────────────────────────────────────

type ReportType = 'dailyCollection' | 'classOutstanding' | 'studentDues' | 'paymentMode' | 'receiptRegister';

const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: 'dailyCollection',  label: 'Daily Collection' },
  { key: 'classOutstanding', label: 'Class Outstanding' },
  { key: 'studentDues',      label: 'Student Dues' },
  { key: 'paymentMode',      label: 'Payment Mode' },
  { key: 'receiptRegister',  label: 'Receipt Register' },
];

const REPORT_URL: Record<ReportType, string> = {
  dailyCollection:  '/api/fees/reports/daily-collection',
  classOutstanding: '/api/fees/reports/class-outstanding',
  studentDues:      '/api/fees/reports/student-dues',
  paymentMode:      '/api/fees/reports/payment-mode',
  receiptRegister:  '/api/fees/reports/receipt-register',
};

function TabReports() {
  const [reportType, setReportType] = useState<ReportType>('dailyCollection');
  const [academicYearId, setAcademicYearId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [classGroupId, setClassGroupId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [exporting, setExporting] = useState(false);

  const academicYearsQ = useQuery({
    queryKey: ['academic-years-reports'],
    queryFn: async () => (await api.get<AcademicYear[]>('/api/academic-years')).data,
    staleTime: 300_000,
  });
  const academicYears = Array.isArray(academicYearsQ.data) ? academicYearsQ.data : [];

  const classGroupsQ = useQuery({
    queryKey: ['class-groups-reports'],
    queryFn: async () => (await api.get<SpringPage<ClassGroup> | ClassGroup[]>('/api/class-groups?size=500')).data,
    staleTime: 300_000,
  });
  const classGroups = pageContent(classGroupsQ.data);

  function buildQs(extra?: Record<string, string>) {
    const p = new URLSearchParams();
    if (academicYearId) p.append('academicYearId', academicYearId);
    if (fromDate) p.append('fromDate', fromDate);
    if (toDate) p.append('toDate', toDate);
    if (classGroupId) p.append('classGroupId', classGroupId);
    if (paymentMode) p.append('paymentMode', paymentMode);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.append(k, v));
    return p.toString() ? `?${p.toString()}` : '';
  }

  const reportQ = useQuery({
    queryKey: ['fee-report', reportType, academicYearId, fromDate, toDate, classGroupId, paymentMode],
    queryFn: async () => (await api.get<unknown[]>(REPORT_URL[reportType] + buildQs())).data,
    staleTime: 30_000,
  });
  const rows = reportQ.data ?? [];

  async function handleExport() {
    setExporting(true);
    try {
      const url = REPORT_URL[reportType] + buildQs({ export: 'true' });
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  function renderTable() {
    if (reportQ.isLoading) return <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading…</div>;
    if (reportQ.isError) return <div style={{ textAlign: 'center', padding: 24, color: '#dc2626' }}>Failed to load report.</div>;
    if (rows.length === 0) return <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No data for selected filters.</div>;

    const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 };
    const tdStyle: React.CSSProperties = { padding: '8px 12px' };

    switch (reportType) {
      case 'dailyCollection': {
        const data = rows as DailyCollectionRow[];
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {['Date', 'Payment Mode', 'Total Amount', 'Count'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{String(r.paymentDate)}</td>
                <td style={tdStyle}>{PAYMENT_MODE_LABELS[r.paymentMode as PaymentMode] ?? r.paymentMode}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#16a34a' }}>{fmt(r.totalAmount)}</td>
                <td style={{ ...tdStyle, color: '#64748b' }}>{r.paymentCount}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      }
      case 'classOutstanding': {
        const data = rows as ClassOutstandingRow[];
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {['Class', 'Section', 'Students', 'Demands', 'Payable', 'Paid', 'Outstanding'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.className}</td>
                <td style={{ ...tdStyle, color: '#64748b' }}>{r.section ?? '—'}</td>
                <td style={tdStyle}>{r.studentCount}</td>
                <td style={{ ...tdStyle, color: '#64748b' }}>{r.demandCount}</td>
                <td style={tdStyle}>{fmt(r.totalPayable)}</td>
                <td style={{ ...tdStyle, color: '#16a34a' }}>{fmt(r.totalPaid)}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626' }}>{fmt(r.totalOutstanding)}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      }
      case 'studentDues': {
        const data = rows as StudentDueRow[];
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {['Student', 'Admission No', 'Class', 'Payable', 'Paid', 'Balance'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.studentName}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>{r.admissionNo}</td>
                <td style={tdStyle}>{r.className ?? '—'}</td>
                <td style={tdStyle}>{fmt(r.totalPayable)}</td>
                <td style={{ ...tdStyle, color: '#16a34a' }}>{fmt(r.totalPaid)}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626' }}>{fmt(r.totalBalance)}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      }
      case 'paymentMode': {
        const data = rows as PaymentModeRow[];
        const total = data.reduce((s, r) => s + toNum(r.totalAmount), 0);
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {['Payment Mode', 'Total Amount', 'Count', '% Share'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{PAYMENT_MODE_LABELS[r.paymentMode as PaymentMode] ?? r.paymentMode}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#16a34a' }}>{fmt(r.totalAmount)}</td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>{r.paymentCount}</td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>{total > 0 ? `${(toNum(r.totalAmount) / total * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
              {data.length > 0 && (
                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 700 }}>
                  <td style={tdStyle}>Total</td>
                  <td style={{ ...tdStyle, color: '#16a34a' }}>{fmt(total)}</td>
                  <td style={tdStyle}>{data.reduce((s, r) => s + r.paymentCount, 0)}</td>
                  <td style={tdStyle}>100%</td>
                </tr>
              )}
            </tbody>
          </table>
        );
      }
      case 'receiptRegister': {
        const data = rows as ReceiptRegisterRow[];
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {['Receipt No', 'Date', 'Student', 'Class', 'Amount', 'Mode', 'Reference', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#6366f1' }}>{r.receiptNo}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{String(r.paymentDate)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.studentName}</td>
                <td style={{ ...tdStyle, color: '#64748b' }}>{r.className ?? '—'}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#16a34a' }}>{fmt(r.amount)}</td>
                <td style={tdStyle}>{PAYMENT_MODE_LABELS[r.paymentMode as PaymentMode] ?? r.paymentMode}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>{r.referenceNo ?? '—'}</td>
                <td style={tdStyle}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                    background: r.status === 'SUCCESS' ? '#dcfce7' : r.status === 'CANCELLED' ? '#f1f5f9' : '#fef3c7',
                    color: r.status === 'SUCCESS' ? '#166534' : r.status === 'CANCELLED' ? '#94a3b8' : '#92400e' }}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}</tbody>
          </table>
        );
      }
    }
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Report type selector */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {REPORT_TYPES.map(r => (
          <button key={r.key} type="button" onClick={() => setReportType(r.key)}
            style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: reportType === r.key ? '2px solid #6366f1' : '2px solid transparent', color: reportType === r.key ? '#6366f1' : '#64748b', fontWeight: reportType === r.key ? 700 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Academic Year</div>
            <SelectKeeper value={academicYearId} onChange={setAcademicYearId}
              options={academicYears.map(y => ({ value: String(y.id), label: y.label }))}
              emptyValueLabel="All years" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>From</div>
            <DateKeeper value={fromDate} onChange={setFromDate} clearable emptyLabel="Any date" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>To</div>
            <DateKeeper value={toDate} onChange={setToDate} clearable emptyLabel="Any date" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Class</div>
            <SelectKeeper value={classGroupId} onChange={setClassGroupId}
              options={classGroups.map(cg => ({ value: String(cg.id), label: cg.displayName }))}
              emptyValueLabel="All classes" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Payment Mode</div>
            <SelectKeeper value={paymentMode} onChange={setPaymentMode}
              options={PAYMENT_MODES.map(m => ({ value: m, label: PAYMENT_MODE_LABELS[m] }))}
              emptyValueLabel="All modes" />
          </div>
          <button type="button" onClick={handleExport} disabled={exporting || rows.length === 0}
            style={{ marginLeft: 'auto', padding: '6px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: exporting || rows.length === 0 ? 'not-allowed' : 'pointer', opacity: rows.length === 0 ? 0.5 : 1 }}>
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{REPORT_TYPES.find(r => r.key === reportType)?.label}</span>
          {!reportQ.isLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>}
        </div>
        {renderTable()}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function FeesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') ?? 'overview') as TabKey;
  const [tab, setTab] = useState<TabKey>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  function goToTab(t: TabKey) {
    setTab(t);
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', t);
    setSearchParams(sp, { replace: true });
  }

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ schoolId?: number; roles?: string[] }>('/user/me')).data,
    staleTime: 300_000,
  });
  const schoolId = meQ.data?.schoolId;
  const perms = derivePermissions(meQ.data?.roles ?? []);

  return (
    <div className="workspace-feature-page stack">
      <div>
        <h2 className="workspace-feature-page__title" style={{ marginBottom: 4 }}>Fee Management</h2>
        <p className="workspace-feature-page__lead" style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Set up fee heads, build fee plans, configure installment schedules, and publish for student demand generation.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => goToTab(t.key)}
            style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent', color: tab === t.key ? 'var(--color-primary)' : '#64748b', fontWeight: tab === t.key ? 700 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: 300 }}>
        {tab === 'overview' && <TabOverview onGoToHeads={() => goToTab('heads')} onGoToPlans={() => goToTab('plans')} onGoToDues={() => goToTab('dues')} />}
        {tab === 'heads' && <TabFeeHeads perms={perms} />}
        {tab === 'plans' && <TabFeePlans schoolId={schoolId} perms={perms} />}
        {tab === 'dues' && <TabStudentDues perms={perms} />}
        {tab === 'collections' && <TabCollections perms={perms} />}
        {tab === 'reports' && <TabReports />}
      </div>
    </div>
  );
}
