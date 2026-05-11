/**
 * Staff / Teacher Onboarding Readiness Dashboard
 *
 * Consumes GET /api/staff/readiness
 * Shows summary KPI cards + six issue queues with actionable rows.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReadinessSummary = {
  totalStaff: number;
  activeTeachers: number;
  timetableEligibleTeachers: number;
  teachersMissingSubjects: number;
  staffMissingLogin: number;
  staffDocumentsPending: number;
  overloadedTeachers: number;
};

type ReadinessIssue = {
  staffId: number;
  staffName: string;
  employeeNo: string | null;
  issue: string;
  impact: string;
  actions: string[];
};

type ReadinessDashboard = {
  summary: ReadinessSummary;
  missingSubjects: ReadinessIssue[];
  missingLogin: ReadinessIssue[];
  missingDocuments: ReadinessIssue[];
  missingJoiningDate: ReadinessIssue[];
  overCapacity: ReadinessIssue[];
  notTimetableEligible: ReadinessIssue[];
};

// ─── Action labels ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  OPEN_PROFILE:             'Open Profile',
  ASSIGN_SUBJECTS:          'Assign Subjects',
  CREATE_LOGIN:             'Create Login',
  SET_LOAD:                 'Set Load',
  MARK_DOCUMENTS_COLLECTED: 'Mark Collected',
};

// ─── Small helpers ────────────────────────────────────────────────────────────

const BASE_BADGE: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 999,
  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
};

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  const c = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#9333ea','#0284c7'];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: size * 0.38, userSelect: 'none' }}>
      {initials(name)}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string;
  value: number;
  color?: string;
  bg?: string;
  icon?: string;
  alert?: boolean;
};

function KpiCard({ label, value, color, bg, icon, alert }: KpiCardProps) {
  return (
    <div style={{
      background: bg ?? 'rgba(15,23,42,0.025)',
      border: `1px solid ${alert && value > 0 ? 'rgba(220,38,38,0.25)' : 'rgba(15,23,42,0.07)'}`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {icon && <div style={{ fontSize: 20 }}>{icon}</div>}
      <div style={{ fontSize: 26, fontWeight: 900, color: color ?? 'rgba(15,23,42,0.82)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.45)',
        textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

// ── Queue section ─────────────────────────────────────────────────────────────

type QueueProps = {
  title: string;
  icon: string;
  color: string;
  issues: ReadinessIssue[];
  onActionClick?: (staffId: number, action: string) => void;
};

function QueueSection({ title, icon, color, issues, onActionClick }: QueueProps) {
  const [expanded, setExpanded] = useState(true);

  if (issues.length === 0) return null;

  return (
    <div style={{
      border: '1px solid rgba(15,23,42,0.08)',
      borderRadius: 14, overflow: 'hidden',
      background: '#fff',
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 14, color: 'rgba(15,23,42,0.85)' }}>
          {title}
        </span>
        <span style={{
          ...BASE_BADGE,
          background: `${color}18`,
          color,
          fontSize: 12,
          fontWeight: 900,
        }}>{issues.length}</span>
        <span style={{ fontSize: 13, color: 'rgba(15,23,42,0.35)', marginLeft: 4 }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <>
          {/* Column headers — desktop only */}
          <div className="readiness-queue-header" style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2.5fr 2.5fr auto',
            gap: 0,
            padding: '6px 16px',
            borderTop: '1px solid rgba(15,23,42,0.06)',
            background: 'rgba(248,250,252,0.8)',
          }}>
            {['Staff', 'Issue', 'Impact', 'Actions'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(15,23,42,0.38)',
                textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 8px' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {issues.map((issue, i) => (
            <div key={issue.staffId} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 2.5fr 2.5fr auto',
              gap: 0,
              padding: '12px 16px',
              borderTop: '1px solid rgba(15,23,42,0.055)',
              background: i % 2 === 1 ? 'rgba(248,250,252,0.5)' : undefined,
              alignItems: 'center',
            }}
            className="readiness-issue-row"
            >
              {/* Staff */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 0' }}>
                <Avatar name={issue.staffName} size={32} />
                <div style={{ minWidth: 0 }}>
                  <Link
                    to={`/app/teachers/${issue.staffId}`}
                    style={{ fontWeight: 700, fontSize: 13, color: 'rgba(15,23,42,0.85)', textDecoration: 'none' }}
                  >
                    {issue.staffName}
                  </Link>
                  {issue.employeeNo && (
                    <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
                      {issue.employeeNo}
                    </div>
                  )}
                </div>
              </div>

              {/* Issue */}
              <div style={{ padding: '0 8px', fontSize: 13, color: 'rgba(15,23,42,0.75)', fontWeight: 500 }}>
                {issue.issue}
              </div>

              {/* Impact */}
              <div style={{ padding: '0 8px', fontSize: 12, color: 'rgba(15,23,42,0.45)', fontStyle: 'italic' }}>
                {issue.impact}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {issue.actions.map(action => (
                  action === 'OPEN_PROFILE' ? (
                    <Link
                      key={action}
                      to={`/app/teachers/${issue.staffId}`}
                      style={{
                        padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.65)',
                        textDecoration: 'none', border: '1px solid rgba(15,23,42,0.1)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View Profile
                    </Link>
                  ) : (
                    <button
                      key={action}
                      type="button"
                      onClick={() => onActionClick?.(issue.staffId, action)}
                      style={{
                        padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: `${color}14`, color,
                        border: `1px solid ${color}30`,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {ACTION_LABELS[action] ?? action}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}

          {/* Mobile card list (hidden on desktop via CSS) */}
          <div className="readiness-mobile-cards" style={{ display: 'none' }}>
            {issues.map(issue => (
              <div key={`m-${issue.staffId}`} style={{
                padding: '14px 16px',
                borderTop: '1px solid rgba(15,23,42,0.07)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Avatar name={issue.staffName} size={36} />
                  <div>
                    <Link
                      to={`/app/teachers/${issue.staffId}`}
                      style={{ fontWeight: 700, fontSize: 14, color: 'rgba(15,23,42,0.85)', textDecoration: 'none' }}
                    >
                      {issue.staffName}
                    </Link>
                    {issue.employeeNo && (
                      <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>{issue.employeeNo}</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.75)', marginBottom: 4 }}>{issue.issue}</div>
                <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.45)', fontStyle: 'italic', marginBottom: 10 }}>{issue.impact}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {issue.actions.map(action => (
                    action === 'OPEN_PROFILE' ? (
                      <Link
                        key={action}
                        to={`/app/teachers/${issue.staffId}`}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.65)',
                          textDecoration: 'none', border: '1px solid rgba(15,23,42,0.1)',
                        }}
                      >
                        View Profile
                      </Link>
                    ) : (
                      <button
                        key={action}
                        type="button"
                        onClick={() => onActionClick?.(issue.staffId, action)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: `${color}14`, color,
                          border: `1px solid ${color}30`,
                          cursor: 'pointer',
                        }}
                      >
                        {ACTION_LABELS[action] ?? action}
                      </button>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StaffReadinessDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery<ReadinessDashboard>({
    queryKey: ['staff-readiness'],
    queryFn: async () => (await api.get<ReadinessDashboard>('/api/staff/readiness')).data,
    staleTime: 30_000,
  });

  const handleActionClick = (staffId: number, action: string) => {
    // Navigate to profile — the profile page handles the rest
    // For actions like ASSIGN_SUBJECTS, CREATE_LOGIN, SET_LOAD we deep-link into the correct tab
    const tabMap: Record<string, string> = {
      ASSIGN_SUBJECTS:          'academics',
      CREATE_LOGIN:             'access',
      SET_LOAD:                 'academics',
      MARK_DOCUMENTS_COLLECTED: 'documents',
    };
    const tab = tabMap[action];
    const url = `/app/teachers/${staffId}${tab ? `?tab=${tab}` : ''}`;
    window.location.href = url;
  };

  // ── Loading / error ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(15,23,42,0.4)' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
        <div style={{ fontWeight: 700 }}>Computing readiness…</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: '24px 16px', color: '#b91c1c', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div>⚠ Failed to load readiness data.</div>
        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)' }}>{formatApiError(error)}</div>
        <button type="button" onClick={() => refetch()}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)', background: '#fff', cursor: 'pointer', marginTop: 4 }}>
          Retry
        </button>
      </div>
    );
  }

  const s = data.summary;

  const allIssueCount =
    data.missingSubjects.length +
    data.missingLogin.length +
    data.missingDocuments.length +
    data.missingJoiningDate.length +
    data.overCapacity.length +
    data.notTimetableEligible.length;

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Section title ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(15,23,42,0.85)', letterSpacing: '-0.01em' }}>
            Onboarding Readiness
          </div>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', marginTop: 2 }}>
            {allIssueCount === 0
              ? '✅ All staff are operationally ready'
              : `${allIssueCount} issue${allIssueCount === 1 ? '' : 's'} need attention before staff are fully operational`}
          </div>
        </div>
        <button type="button" onClick={() => refetch()}
          style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.13)', background: 'rgba(15,23,42,0.03)', color: 'rgba(15,23,42,0.55)', cursor: 'pointer', fontWeight: 600 }}>
          ↻ Refresh
        </button>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        <KpiCard label="Total Staff"          value={s.totalStaff}                 icon="👥" color="rgba(15,23,42,0.8)" />
        <KpiCard label="Active Teachers"       value={s.activeTeachers}             icon="🎓" color="#1e40af" bg="rgba(37,99,235,0.04)" />
        <KpiCard label="Timetable Eligible"    value={s.timetableEligibleTeachers}  icon="📅" color="#065f46" bg="rgba(5,150,105,0.04)" />
        <KpiCard label="Missing Subjects"      value={s.teachersMissingSubjects}    icon="📚" color={s.teachersMissingSubjects  > 0 ? '#b45309' : '#166534'} alert />
        <KpiCard label="Missing Login"         value={s.staffMissingLogin}          icon="🔐" color={s.staffMissingLogin         > 0 ? '#b45309' : '#166534'} alert />
        <KpiCard label="Docs Pending"          value={s.staffDocumentsPending}      icon="📋" color={s.staffDocumentsPending      > 0 ? '#b45309' : '#166534'} alert />
        <KpiCard label="Overloaded Teachers"   value={s.overloadedTeachers}         icon="⚠️"  color={s.overloadedTeachers         > 0 ? '#b91c1c' : '#166534'} alert />
      </div>

      {/* ── All-clear state ───────────────────────────────────────────────── */}
      {allIssueCount === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          background: 'rgba(5,150,105,0.04)',
          border: '1px solid rgba(5,150,105,0.15)',
          borderRadius: 14,
          color: '#065f46',
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>All staff are operationally ready</div>
          <div style={{ fontSize: 13, marginTop: 6, color: '#047857' }}>
            Every teacher has subjects, login access, and documents in order.
          </div>
        </div>
      )}

      {/* ── Readiness queues ──────────────────────────────────────────────── */}
      {allIssueCount > 0 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <QueueSection
            title="Missing Teachable Subjects"
            icon="📚"
            color="#b45309"
            issues={data.missingSubjects}
            onActionClick={handleActionClick}
          />
          <QueueSection
            title="Missing Login Account"
            icon="🔐"
            color="#1d4ed8"
            issues={data.missingLogin}
            onActionClick={handleActionClick}
          />
          <QueueSection
            title="Documents Pending Collection"
            icon="📋"
            color="#7c3aed"
            issues={data.missingDocuments}
            onActionClick={handleActionClick}
          />
          <QueueSection
            title="Missing Joining Date"
            icon="📆"
            color="#0e7490"
            issues={data.missingJoiningDate}
            onActionClick={handleActionClick}
          />
          <QueueSection
            title="Over Capacity"
            icon="⚠️"
            color="#dc2626"
            issues={data.overCapacity}
            onActionClick={handleActionClick}
          />
          <QueueSection
            title="Not Timetable Eligible"
            icon="🚫"
            color="#9333ea"
            issues={data.notTimetableEligible}
            onActionClick={handleActionClick}
          />
        </div>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .readiness-queue-header { display: none !important; }
          .readiness-issue-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            display: none !important;
          }
          .readiness-mobile-cards { display: block !important; }
        }
      `}</style>
    </div>
  );
}

