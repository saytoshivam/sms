import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { pageContent, pageTotalElements, type SpringPage } from '../lib/apiData';
import { SchoolBusinessKpis } from '../components/SchoolBusinessKpis';
import { SmartSelect } from '../components/SmartSelect';

const ONLINE_FEES = 'fees.online_payments';

type Invoice = {
  id: number;
  amountDue: string;
  dueDate: string;
  status: string;
  student?: { id: number; firstName: string; lastName?: string | null; admissionNo: string } | null;
};

type Student = { id: number; firstName: string; lastName?: string | null; admissionNo: string };

export function FeesPage() {
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [dueDate, setDueDate] = useState('');

  const invoices = useQuery({
    queryKey: ['fee-invoices'],
    queryFn: async () =>
      (await api.get<SpringPage<Invoice> | Invoice[]>('/api/fees/invoices?size=50')).data,
  });

  const tenantFeatures = useQuery({
    queryKey: ['tenant-features'],
    queryFn: async () => (await api.get<{ features: string[] }>('/api/v1/tenant/features')).data,
  });

  const canPayOnline = (tenantFeatures.data?.features ?? []).includes(ONLINE_FEES);

  const students = useQuery({
    queryKey: ['students'],
    queryFn: async () => (await api.get<SpringPage<Student> | Student[]>('/api/students?size=200')).data,
  });

  const payOnline = useMutation({
    mutationFn: async (invoiceId: number) => {
      const idempotencyKey = crypto.randomUUID();
      const { data } = await api.post<{
        paymentId: number;
        gatewayOrderId: string;
        gatewayStatus: string;
        amount: string;
        invoiceStatus: string;
      }>(
        `/api/v1/fees/invoices/${invoiceId}/online-intent`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      await qc.invalidateQueries({ queryKey: ['fee-school-summary'] });
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () =>
      (
        await api.post('/api/fees/invoices', {
          studentId: Number(studentId),
          amountDue: Number(amountDue),
          dueDate,
        })
      ).data,
    onSuccess: async () => {
      setAmountDue('');
      setDueDate('');
      await qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      await qc.invalidateQueries({ queryKey: ['fee-school-summary'] });
    },
  });

  const studentOptions = pageContent(students.data);
  const invoiceRows = pageContent(invoices.data);

  return (
    <div className="workspace-feature-page stack">
      <h2 className="workspace-feature-page__title">Fees & invoices</h2>
      <p className="workspace-feature-page__lead">
        Create invoices, track collection, and (with the right plan) start online payment intents.
      </p>

      <div className="card stack" style={{ margin: 0 }}>
        <SchoolBusinessKpis compact />
      </div>

      <div className="card">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            createInvoice.mutate();
          }}
        >
          <div className="row">
            <div style={{ flex: 2, minWidth: 240 }} className="stack">
              <label>Student</label>
              <SmartSelect
                value={studentId}
                onChange={setStudentId}
                placeholder="Select…"
                options={studentOptions.map((s) => ({
                  value: String(s.id),
                  label: `${s.firstName} ${s.lastName ?? ''}`.trim(),
                  meta: s.admissionNo,
                }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }} className="stack">
              <label>Amount due</label>
              <input value={amountDue} onChange={(e) => setAmountDue(e.target.value)} placeholder="2500" />
            </div>
            <div style={{ flex: 1, minWidth: 180 }} className="stack">
              <label>Due date</label>
              <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="2026-04-30" />
            </div>
          </div>
          <button className="btn" disabled={createInvoice.isPending || !studentId || !amountDue || !dueDate}>
            {createInvoice.isPending ? 'Creating…' : 'Create invoice'}
          </button>
          {createInvoice.error ? (
            <div style={{ color: '#b91c1c' }}>{formatApiError(createInvoice.error)}</div>
          ) : null}
        </form>
      </div>

      <div className="card">
        {invoices.isLoading ? (
          <div>Loading…</div>
        ) : invoices.error ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(invoices.error)}</div>
        ) : (
          <div className="stack">
            <div className="muted" style={{ fontSize: 12 }}>
              Total: {pageTotalElements(invoices.data)}
              {canPayOnline ? (
                <span>
                  {' '}
                  • Online payments run inside this app. For local demos set{' '}
                  <code>sms.payments.demo-auto-complete=true</code> to auto-post the gateway webhook.
                </span>
              ) : (
                <span> • Online pay requires plan feature {ONLINE_FEES} (e.g. Premium).</span>
              )}
            </div>
            {invoiceRows.map((inv) => (
              <div key={inv.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>₹{inv.amountDue}</strong> <span className="muted">• due {inv.dueDate}</span>{' '}
                  <span className="muted">• {inv.status}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="muted">ID: {inv.id}</span>
                  {canPayOnline && (inv.status === 'DUE' || inv.status === 'PARTIAL') ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={payOnline.isPending}
                      onClick={() => payOnline.mutate(inv.id)}
                    >
                      {payOnline.isPending ? '…' : 'Pay online'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {payOnline.error ? (
              <div style={{ color: '#b91c1c', fontSize: 13 }}>{formatApiError(payOnline.error)}</div>
            ) : null}
            {payOnline.data ? (
              <div className="muted" style={{ fontSize: 13 }}>
                Started payment <strong>{payOnline.data.gatewayOrderId}</strong> — status {payOnline.data.gatewayStatus}
                , invoice {payOnline.data.invoiceStatus}.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
