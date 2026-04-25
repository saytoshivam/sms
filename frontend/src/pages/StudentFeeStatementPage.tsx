import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Line = {
  entryDate: string;
  amount: string | number;
  drCr: 'DR' | 'CR';
  description: string;
  balanceAfter: string | number;
};

type FeeStatement = {
  financialYears: string[];
  lines: Line[];
};

function fmtDateYmd(ymd: string) {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
}

function fmtMoney(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (Number.isNaN(n)) return String(v);
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export function StudentFeeStatementPage() {
  const [fy, setFy] = useState<string>('');

  const data = useQuery({
    queryKey: ['student-fee-statement', fy],
    queryFn: async () => {
      const q = fy ? `?financialYear=${encodeURIComponent(fy)}` : '';
      return (await api.get<FeeStatement>(`/api/v1/student/me/fee-statement${q}`)).data;
    },
  });

  const yearOptions = useMemo(() => data.data?.financialYears ?? [], [data.data?.financialYears]);

  return (
    <div className="fee-statement-page">
      <header className="fee-st-header">
        <Link to="/app" className="fee-st-back">
          ← Back
        </Link>
        <h1 className="fee-st-title">Fee Statement</h1>
      </header>

      <div className="fee-st-body">
        <label className="fee-st-fy-label" htmlFor="fy-select">
          Financial Year
        </label>
        <select
          id="fy-select"
          className="fee-st-fy-select"
          value={fy}
          onChange={(e) => setFy(e.target.value)}
          disabled={data.isLoading}
        >
          <option value="">All years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {data.isLoading ? (
          <div className="muted" style={{ marginTop: 16 }}>
            Loading…
          </div>
        ) : data.error ? (
          <div style={{ color: '#b91c1c', marginTop: 16 }}>{String((data.error as any)?.response?.data ?? data.error)}</div>
        ) : (data.data?.lines ?? []).length === 0 ? (
          <div className="muted fee-st-empty">No fee transactions yet.</div>
        ) : (
          <ul className="fee-st-list">
            {(data.data?.lines ?? []).map((row, idx) => (
              <li key={`${row.entryDate}-${idx}-${row.drCr}-${row.description.slice(0, 20)}`} className="fee-st-card">
                <div className="fee-st-card-top">
                  <div className="fee-st-bal">
                    Bal:{fmtMoney(row.balanceAfter)} ON {fmtDateYmd(row.entryDate)}
                  </div>
                  <div className="fee-st-amt">{fmtMoney(row.amount)}</div>
                </div>
                <div className="fee-st-card-bottom">
                  <div className="fee-st-desc">{row.description}</div>
                  <div className={row.drCr === 'DR' ? 'fee-st-drcr fee-st-dr' : 'fee-st-drcr fee-st-cr'}>{row.drCr}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
