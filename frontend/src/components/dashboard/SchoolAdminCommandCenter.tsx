import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessagesSquare,
  Network,
  Palette,
  Presentation,
  Shield,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SchoolAdminDashboardShellProps } from './schoolAdmin/dashboardPersona';
import type { SchoolAdminOperationalSnapshot } from './schoolAdmin/useSchoolAdminOperationalData';
import { inr } from './schoolAdmin/useSchoolAdminOperationalData';
import { formatApiError } from '../../lib/errors';
import { withWorkspaceReadOnly } from '../../lib/workspaceViewMode';
import './schoolAdminCommandCenter.css';

function KpiShell({
  label,
  value,
  sub,
  trend,
  tone,
  live,
  tier = 3,
}: {
  label: string;
  value: string;
  sub: string;
  trend: string | null;
  tone: 'neutral' | 'crit' | 'warn' | 'ok' | 'info';
  live?: boolean;
  /** 1 = executive · 2 = operational · 3 = passive/supporting */
  tier?: 1 | 2 | 3;
}) {
  const toneClass =
    tone === 'crit' ? 'sacc-kpi--sev-crit' : tone === 'warn' ? 'sacc-kpi--sev-warn' : tone === 'ok' ? 'sacc-kpi--sev-ok' : tone === 'info' ? 'sacc-kpi--sev-info' : '';
  const tierCls = tier === 1 ? 'sacc-kpi--tier1' : tier === 2 ? 'sacc-kpi--tier2' : 'sacc-kpi--tier3';
  const trendCls =
    !trend
      ? ''
      : trend.startsWith('↓') || trend.includes('overdue')
        ? 'sacc-kpi-trend sacc-kpi-trend--down'
        : trend === 'Stable' || (trend.startsWith('↑') && !trend.includes('attention'))
          ? 'sacc-kpi-trend sacc-kpi-trend--up'
          : 'sacc-kpi-trend';
  return (
    <div className={`sacc-kpi ${toneClass} ${tierCls}`}>
      <div className="sacc-kpi-label">
        <span>{label}</span>
        {live ? (
          <span className="sacc-live-pill">
            <span className="sacc-live-dot" aria-hidden />
            Live
          </span>
        ) : null}
      </div>
      <div className="sacc-kpi-value">{value}</div>
      <div className="sacc-kpi-sub">{sub}</div>
      {trend ? <div className={trendCls}>{trend}</div> : null}
    </div>
  );
}

function ModLauncher({ to, Icon, label }: { to: string; Icon: LucideIcon; label: string }) {
  return (
    <Link className="sacc-launch" to={to}>
      <span className="sacc-launch__icon">
        <Icon size={18} strokeWidth={2} aria-hidden />
      </span>
      <span className="sacc-launch__label">{label}</span>
    </Link>
  );
}

export function SchoolAdminCommandCenter({
  profile: _profile,
  persona: _persona = 'default',
  op,
}: SchoolAdminDashboardShellProps & { op: SchoolAdminOperationalSnapshot }) {
  void _persona;
  void _profile;
  const {
    ymd,
    leader,
    mode,
    isSchoolAdmin,
    fees,
    dailyBoard,
    lectureGaps,
    tt,
    unassignedClassTeachers,
    dailyCounts,
    gaps,
    roomConflicts,
    missingTeacherAllocations,
    allocationCoveragePct,
    rosterTeachers,
    criticalAlertCount,
    attendancePctDisplay,
    timetableHealthDisplay,
    timetableSubline,
    feeCollectionSub,
    collectionRate,
    defaulterProxy,
    calendarFeed,
    recentActivity,
    attendanceMonitorHref,
    alertsSummary,
    operationalWidgets,
    operationalReadiness,
    freshnessSignals,
    todayAtSchool,
    pendingAttendanceTotal,
    activeSectionsCount: _activeSectionsCount,
  } = op;

  const pendingAttCount = mode === 'DAILY' ? dailyCounts.pending + dailyCounts.overdue : gaps.length;

  const attTone: 'neutral' | 'crit' | 'warn' | 'ok' | 'info' =
    mode === 'LECTURE_WISE' && gaps.length > 0 ? 'warn' : mode === 'DAILY' && dailyCounts.overdue > 0 ? 'crit' : 'ok';

  const ttTone: 'neutral' | 'crit' | 'warn' | 'ok' | 'info' =
    tt.conflicts.hard > 0 ? 'crit' : tt.conflicts.soft > 0 ? 'warn' : tt.versionStatus === 'PUBLISHED' ? 'ok' : 'info';

  const alertTone: 'neutral' | 'crit' | 'warn' | 'ok' | 'info' = criticalAlertCount > 0 ? 'crit' : 'ok';

  const feeTodayTone: 'neutral' | 'crit' | 'warn' | 'ok' | 'info' =
    fees.data && defaulterProxy > 0 ? 'warn' : 'info';

  const rosterTone: 'neutral' | 'crit' | 'warn' | 'ok' | 'info' =
    rosterTeachers != null && rosterTeachers > 0 ? 'ok' : 'warn';

  const collTone: 'neutral' | 'crit' | 'warn' | 'ok' | 'info' =
    collectionRate && fees.data && Number(collectionRate.replace('%', '')) >= 85 ? 'ok' : 'warn';

  const sortedActions = useMemo(() => {
    type A = {
      id: string;
      to: string;
      count: string | number;
      label: string;
      sub: string;
      sev: 'crit' | 'warn' | 'ok';
      priority: number;
    };
    const list: A[] = [
      {
        id: 'tt',
        to: '/app/timetable?scope=published',
        count: tt.conflicts.hard + tt.conflicts.soft,
        label: 'Timetable conflicts',
        sub: 'Hard blocks publish · soft advisory',
        sev: tt.conflicts.hard > 0 ? 'crit' : tt.conflicts.soft > 0 ? 'warn' : 'ok',
        priority: tt.conflicts.hard * 100 + tt.conflicts.soft * 10,
      },
      {
        id: 'att',
        to: attendanceMonitorHref,
        count: pendingAttCount,
        label: 'Pending attendance',
        sub:
          mode === 'DAILY'
            ? `${dailyCounts.pending} pending · ${dailyCounts.overdue} overdue`
            : `${gaps.length} lecture gap${gaps.length === 1 ? '' : 's'} · grace elapsed`,
        sev: pendingAttCount > 0 ? 'warn' : 'ok',
        priority: pendingAttCount > 0 ? 90 + pendingAttCount : 0,
      },
      {
        id: 'fee',
        to: '/app/fees',
        count: fees.data?.openInvoiceCount ?? '—',
        label: 'Overdue fees',
        sub: fees.data ? `${inr(fees.data.outstandingPending)} outstanding` : 'Receivables desk',
        sev: defaulterProxy > 0 ? 'warn' : 'ok',
        priority: defaulterProxy * 8,
      },
      {
        id: 'cg',
        to: '/app/classes-sections',
        count: unassignedClassTeachers,
        label: 'Unassigned classes',
        sub: 'Homeroom teacher missing',
        sev: unassignedClassTeachers > 0 ? 'warn' : 'ok',
        priority: unassignedClassTeachers * 15,
      },
      {
        id: 'sub',
        to: '/app/school/announcements/new',
        count: 0,
        label: 'Teacher substitutions',
        sub: 'Coordinate cover · auto-queue planned',
        sev: 'ok',
        priority: 1,
      },
    ];
    return list.sort((a, b) => b.priority - a.priority);
  }, [
    attendanceMonitorHref,
    tt.conflicts.hard,
    tt.conflicts.soft,
    pendingAttCount,
    mode,
    dailyCounts.pending,
    dailyCounts.overdue,
    gaps.length,
    fees.data,
    defaulterProxy,
    unassignedClassTeachers,
  ]);

  return (
    <div className="sacc erp-dash-grid">
      <nav className="sacc-quick-ops" aria-label="Operational shortcuts">
        <Link className="sacc-quick-ops__btn sacc-quick-ops__btn--key" to={attendanceMonitorHref}>
          Attendance
        </Link>
        <Link className="sacc-quick-ops__btn" to="/app/timetable?scope=published&tab=workspace">
          Publish timetable
        </Link>
        <Link className="sacc-quick-ops__btn" to="/app/school/announcements/new">
          Circular
        </Link>
        {isSchoolAdmin ? (
          <Link className="sacc-quick-ops__btn" to="/app/onboarding">
            Import
          </Link>
        ) : null}
        <Link className="sacc-quick-ops__btn" to="/app/fees">
          Fee receipt
        </Link>
      </nav>

      <section className="sacc-today-panel" aria-label="Today at school">
        <div className="sacc-today-panel__head">
          <span className="sacc-today-panel__title">
            {todayAtSchool.weekday} · <span className="sacc-today-panel__rhythm">{todayAtSchool.rhythm}</span>
          </span>
        </div>
        <ul className="sacc-today-panel__list">
          {todayAtSchool.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <div className={`sacc-alerts-strip ${criticalAlertCount > 0 ? 'sacc-alerts-strip--crit' : 'sacc-alerts-strip--ok'}`}>
        <AlertTriangle size={15} strokeWidth={2.25} aria-hidden />
        <div className="sacc-alerts-strip__body">
          <span className="sacc-alerts-strip__strong">{criticalAlertCount > 0 ? 'Attention needed' : 'Operational posture'}</span>
          <span className="sacc-alerts-strip__detail">
            {criticalAlertCount > 0
              ? alertsSummary || `${criticalAlertCount} weighted signal(s).`
              : 'Queues healthy · no blocking timetable conflicts or overdue daily boards.'}
          </span>
        </div>
        <span className="sacc-alerts-strip__count">{criticalAlertCount}</span>
      </div>

      <section className="sacc-action-center" aria-label="Action center">
        <div className="sacc-action-center__head">
          <div>
            <div className="sacc-action-center__eyebrow">Primary</div>
            <h2 className="sacc-action-center__title">Action center</h2>
            <p className="sacc-action-center__lede">Live queues · highest severity surfaces first</p>
          </div>
          <div className="sacc-action-center__stat">
            <span className="sacc-action-center__stat-k">Pending across queues</span>
            <span className="sacc-action-center__stat-v">{pendingAttendanceTotal + tt.conflicts.hard + tt.conflicts.soft + defaulterProxy}</span>
          </div>
        </div>
        <div className="sacc-action-grid sacc-action-grid--primary">
          {sortedActions.map((a) => {
            const faded = a.sev === 'ok' && a.priority <= 1;
            return (
              <Link
                key={a.id}
                className={`sacc-action sacc-action--sev-${a.sev} sacc-action--primary ${faded ? 'sacc-action--faded' : ''}`}
                to={a.to}
              >
                <span
                  className={`sacc-action-count ${
                    a.sev === 'crit' ? 'sacc-action-count--crit' : a.sev === 'warn' ? 'sacc-action-count--warn' : ''
                  }`}
                >
                  {a.count}
                </span>
                <div className="sacc-action-main">
                  <div className="sacc-action-label">{a.label}</div>
                  <div className="sacc-action-sub">{a.sub}</div>
                </div>
                <ChevronRight className="sacc-action-arrow" size={18} aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="sacc-cockpit-row">
        <section className="sacc-readiness" aria-label="Operational readiness">
          <div className="sacc-readiness__head">
            <span className="sacc-readiness__label">Operational readiness</span>
            <span
              className={`sacc-readiness__score ${operationalReadiness.score < 62 ? 'sacc-readiness__score--risk' : operationalReadiness.score < 80 ? 'sacc-readiness__score--warn' : ''}`}
            >
              {operationalReadiness.score}%
            </span>
          </div>
          <ul className="sacc-readiness__checks">
            {operationalReadiness.checks.map((c) => (
              <li key={c.text} className={c.ok ? 'sacc-readiness__check sacc-readiness__check--ok' : c.warn ? 'sacc-readiness__check sacc-readiness__check--warn' : 'sacc-readiness__check'}>
                <span className="sacc-readiness__mark" aria-hidden>
                  {c.ok ? '✓' : c.warn ? '⚠' : '—'}
                </span>
                {c.text}
              </li>
            ))}
          </ul>
        </section>
        <section className="sacc-freshness" aria-label="Live signals">
          <div className="sacc-freshness__title">Live context</div>
          <ul className="sacc-freshness__list">
            {freshnessSignals.map((s) => (
              <li
                key={s.key}
                className={
                  s.variant === 'warn' ? 'sacc-freshness__item sacc-freshness__item--warn' : s.variant === 'ok' ? 'sacc-freshness__item sacc-freshness__item--ok' : 'sacc-freshness__item'
                }
              >
                {s.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="sacc-section-title sacc-section-title--spaced">Executive signals</div>
      <div className="sacc-kpi-grid sacc-kpi-grid--tier1">
        <KpiShell
          tier={1}
          label="Attendance completion"
          value={attendancePctDisplay.value}
          sub={attendancePctDisplay.sub}
          trend={attendancePctDisplay.trend ?? null}
          tone={attTone}
          live={leader && mode === 'DAILY' && dailyCounts.pending > 0}
        />
        <KpiShell
          tier={1}
          label="Timetable health"
          value={timetableHealthDisplay}
          sub={timetableSubline}
          trend={tt.conflicts.hard + tt.conflicts.soft > 0 ? `${tt.conflicts.hard + tt.conflicts.soft} conflicts` : 'Synced'}
          tone={ttTone}
          live={tt.versionStatus === 'PUBLISHED'}
        />
        <KpiShell
          tier={1}
          label="Critical alerts"
          value={String(criticalAlertCount)}
          sub={criticalAlertCount > 0 ? 'Resolve blockers in action center' : 'No blockers'}
          trend={criticalAlertCount > 0 ? '↑ attention' : 'Stable'}
          tone={alertTone}
        />
      </div>

      <div className="sacc-section-title">Operational telemetry</div>
      <div className="sacc-kpi-grid sacc-kpi-grid--tier2">
        <KpiShell
          tier={2}
          label="Fee collection"
          value={fees.isLoading ? '…' : fees.data ? inr(fees.data.totalCollected) : '—'}
          sub={feeCollectionSub}
          trend={defaulterProxy > 0 ? `${defaulterProxy} invoice(s) open` : collectionRate ?? 'Rolling'}
          tone={feeTodayTone}
        />
        <KpiShell
          tier={2}
          label="Teaching roster"
          value={rosterTeachers == null ? (tt.setupLoading ? '…' : '—') : String(rosterTeachers)}
          sub={`Allocation ${allocationCoveragePct ?? '—'}%`}
          trend={missingTeacherAllocations > 0 ? `${missingTeacherAllocations} gaps` : 'Stable'}
          tone={rosterTone}
        />
        <KpiShell
          tier={2}
          label="Collection rate"
          value={fees.isLoading ? '…' : collectionRate ?? '—'}
          sub={fees.data ? `${inr(fees.data.totalInvoiced)} billed` : 'Fee summary'}
          trend="All-time billed vs collected"
          tone={collTone}
        />
      </div>

      <div className="sacc-section-title sacc-section-title--muted">Secondary signals · monitoring</div>
      <div className="erp-widget-strip erp-widget-strip--tier3">
        {operationalWidgets.map((w) => (
          <div
            key={w.id}
            className={`erp-widget erp-widget--quiet ${w.tone === 'crit' ? 'erp-widget--crit' : w.tone === 'warn' ? 'erp-widget--warn' : ''}`}
          >
            <div className="erp-widget__label">{w.label}</div>
            <div className="erp-widget__value">{w.value}</div>
            <div className="erp-widget__hint">{w.hint}</div>
          </div>
        ))}
      </div>

      <div className="sacc-cards-row sacc-cards-row--triple">
        <div className="sacc-card sacc-card--soft">
          <div className="sacc-card-head">
            <span className="sacc-card-title">Attendance monitor</span>
            <Link className="sacc-card-link" to={attendanceMonitorHref}>
              Open <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
          {mode === 'DAILY' && leader ? (
            <>
              <div className="sacc-mini-stats">
                <div className="sacc-mini-stat">
                  <div className="sacc-mini-val">{dailyBoard.isLoading ? '…' : dailyCounts.completed}</div>
                  <div className="sacc-mini-lbl">Completed</div>
                </div>
                <div className="sacc-mini-stat">
                  <div className="sacc-mini-val">{dailyBoard.isLoading ? '…' : dailyCounts.pending}</div>
                  <div className="sacc-mini-lbl">Pending</div>
                </div>
                <div className="sacc-mini-stat">
                  <div className="sacc-mini-val" style={{ color: dailyCounts.overdue > 0 ? '#b91c1c' : undefined }}>
                    {dailyBoard.isLoading ? '…' : dailyCounts.overdue}
                  </div>
                  <div className="sacc-mini-lbl">Overdue</div>
                </div>
              </div>
              <div className="sacc-progress">
                <div
                  className="sacc-progress-fill"
                  style={{
                    width: `${dailyCounts.pct != null ? dailyCounts.pct : 0}%`,
                    background:
                      dailyCounts.overdue > 0
                        ? 'linear-gradient(90deg, #f97316, #ea580c)'
                        : 'linear-gradient(90deg, #22c55e, #16a34a)',
                  }}
                />
              </div>
              {dailyBoard.error ? (
                <div style={{ color: '#b91c1c', fontSize: 11 }}>{formatApiError(dailyBoard.error)}</div>
              ) : null}
            </>
          ) : (
            <>
              <div className="sacc-mini-stats">
                <div className="sacc-mini-stat">
                  <div className="sacc-mini-val">{lectureGaps.isLoading ? '…' : gaps.length}</div>
                  <div className="sacc-mini-lbl">Gaps</div>
                </div>
                <div className="sacc-mini-stat">
                  <div className="sacc-mini-val" style={{ display: 'flex', justifyContent: 'center' }}>
                    {gaps.length === 0 ? (
                      <CheckCircle2 size={18} color="#15803d" aria-label="Clear" />
                    ) : (
                      <AlertTriangle size={18} color="#c2410c" aria-label="Attention" />
                    )}
                  </div>
                  <div className="sacc-mini-lbl">Signal</div>
                </div>
                <div className="sacc-mini-stat">
                  <div className="sacc-mini-val">{mode === 'LECTURE_WISE' ? 'L/W' : 'Daily'}</div>
                  <div className="sacc-mini-lbl">Mode</div>
                </div>
              </div>
              <div className="sacc-progress">
                <div
                  className="sacc-progress-fill"
                  style={{
                    width: gaps.length === 0 ? '100%' : `${Math.max(8, 100 - Math.min(100, gaps.length * 14))}%`,
                    background: gaps.length === 0 ? undefined : 'linear-gradient(90deg, #f97316, #ea580c)',
                  }}
                />
              </div>
              {lectureGaps.error ? (
                <div style={{ color: '#b91c1c', fontSize: 11 }}>{formatApiError(lectureGaps.error)}</div>
              ) : (
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 10 }}>
                  Period-level grace · unlock after each slot.
                </p>
              )}
            </>
          )}
          <div className="sacc-quick-actions">
            <Link className="sacc-pill-btn sacc-pill-btn--primary" to={attendanceMonitorHref}>
              Monitor
            </Link>
            <Link className="sacc-pill-btn" to={`/app/attendance?date=${encodeURIComponent(ymd)}`}>
              Capture marks
            </Link>
          </div>
        </div>

        <div className="sacc-card sacc-card--soft">
          <div className="sacc-card-head">
            <span className="sacc-card-title">Academic operations</span>
            <Link className="sacc-card-link" to="/app/timetable">
              Timetable <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Readiness</span>
            <span className="sacc-stat-v">{tt.setupLoading ? '…' : tt.status.label}</span>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Teacher allocation</span>
            <span className="sacc-stat-v">
              {tt.setupLoading ? '…' : allocationCoveragePct != null ? `${allocationCoveragePct}%` : '—'}
              {missingTeacherAllocations > 0 ? ` · ${missingTeacherAllocations} gaps` : ''}
            </span>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Room conflicts</span>
            <span className="sacc-stat-v">{roomConflicts}</span>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Coverage</span>
            <span className="sacc-stat-v">
              {tt.setup?.classGroups?.length ?? '—'} sections · {tt.entries.length} workspace rows
            </span>
          </div>
          <div className="sacc-quick-actions" style={{ marginTop: 6 }}>
            <Link className="sacc-pill-btn" to="/app/academic">
              Structure
            </Link>
            <Link className="sacc-pill-btn" to="/app/teachers">
              Teachers
            </Link>
          </div>
        </div>

        <div className={`sacc-card sacc-card--soft ${defaulterProxy > 0 ? 'sacc-card--elevate-warn' : ''}`}>
          <div className="sacc-card-head">
            <span className="sacc-card-title">Finance snapshot</span>
            <Link className="sacc-card-link" to="/app/fees">
              Desk <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Collected (posted)</span>
            <span className="sacc-stat-v">{fees.isLoading ? '…' : fees.data ? inr(fees.data.totalCollected) : '—'}</span>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Outstanding / due</span>
            <span className="sacc-stat-v">{fees.isLoading ? '…' : fees.data ? inr(fees.data.outstandingPending) : '—'}</span>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Open invoices</span>
            <span className="sacc-stat-v">{fees.data?.openInvoiceCount ?? '—'}</span>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Collection rate</span>
            <span className="sacc-stat-v">{fees.isLoading ? '…' : collectionRate ?? '—'}</span>
          </div>
          <div className="sacc-stat-row">
            <span className="sacc-stat-k">Invoice volume</span>
            <span className="sacc-stat-v">{fees.data?.invoiceCount ?? '—'} total · chase {defaulterProxy} overdue</span>
          </div>
          <div className="sacc-quick-actions" style={{ marginTop: 6 }}>
            <Link className="sacc-pill-btn sacc-pill-btn--primary" to="/app/fees">
              Record receipt
            </Link>
            <Link className="sacc-pill-btn" to="/app/fees">
              Aging view
            </Link>
          </div>
        </div>
      </div>

      <div className="sacc-cards-row sacc-cards-row--split">
        <div className="sacc-card sacc-card--soft">
          <div className="sacc-card-head">
            <span className="sacc-card-title">Operational calendar</span>
            <Link className="sacc-card-link" to="/app/lectures">
              Planner <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
          <div className="sacc-cal-feed">
            {calendarFeed.map((g, gi) => (
              <section key={`${g.groupLabel}-${gi}`} className="sacc-cal-group">
                <header className="sacc-cal-group__head">
                  <span className="sacc-cal-group__title">{g.groupLabel}</span>
                  <span className="sacc-cal-group__sub">{g.groupSub}</span>
                </header>
                <ul className="sacc-cal-group__events">
                  {g.events.map((ev) => (
                    <li key={`${ev.time}-${ev.title}`} className="sacc-cal-ev">
                      <span className="sacc-cal-ev__time">{ev.time}</span>
                      <div className="sacc-cal-ev__body">
                        <div className="sacc-cal-ev__title">{ev.title}</div>
                        <span className={`sacc-cal-type sacc-cal-type--${ev.chip.toLowerCase()}`}>{ev.chip}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="sacc-cal-foot">
            Sandbox feed on live weekdays · institutional calendar APIs will replace copy.
          </p>
        </div>

        <div className="sacc-card sacc-card--soft">
          <div className="sacc-card-head">
            <span className="sacc-card-title">Event stream</span>
            <span className="sacc-activity-live">Live feed</span>
          </div>
          <ul className="sacc-activity-list">
            {recentActivity.map((a) => (
              <li key={a.id} className="sacc-activity-item">
                <span
                  className={`sacc-activity-bar ${
                    a.tone === 'danger'
                      ? 'sacc-activity-bar--danger'
                      : a.tone === 'warning'
                        ? 'sacc-activity-bar--warning'
                        : a.tone === 'success'
                          ? 'sacc-activity-bar--success'
                          : a.tone === 'info'
                            ? 'sacc-activity-bar--info'
                            : 'sacc-activity-bar--neutral'
                  }`}
                  aria-hidden
                />
                <div className="sacc-activity-body">
                  <div className="sacc-activity-top">
                    {a.category ? <div className="sacc-activity-cat">{a.category}</div> : null}
                    <div className="sacc-activity-badges">
                      {a.severityLabel ? <span className="sacc-activity-sev">{a.severityLabel}</span> : null}
                      {a.timeBadge ? <span className="sacc-activity-time">{a.timeBadge}</span> : null}
                      {a.signalLive ? <span className="sacc-activity-pulse">Open window</span> : null}
                    </div>
                  </div>
                  <div className="sacc-activity-label">{a.label}</div>
                  <div className="sacc-activity-meta">{a.meta}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sacc-module-groups">
        <div className="sacc-section-title">Academics · app launcher</div>
        <p className="sacc-launch-hint">Dense shortcuts · primary workflows live above in Action center.</p>
        <div className="sacc-launch-grid">
          <ModLauncher to="/app/operations-hub" Icon={LayoutDashboard} label="Operations hub" />
          <ModLauncher to={attendanceMonitorHref} Icon={ClipboardCheck} label="Attendance" />
          <ModLauncher to={withWorkspaceReadOnly('/app/timetable?scope=published')} Icon={CalendarRange} label="Timetable" />
          <ModLauncher to={withWorkspaceReadOnly('/app/teachers')} Icon={GraduationCap} label="Teachers" />
          <ModLauncher to={withWorkspaceReadOnly('/app/fees')} Icon={Wallet} label="Fees" />
          <ModLauncher to={withWorkspaceReadOnly('/app/students')} Icon={Users} label="Students" />
          <ModLauncher to={withWorkspaceReadOnly('/app/academic')} Icon={Network} label="Structure" />
          <ModLauncher to={withWorkspaceReadOnly('/app/subjects')} Icon={BookOpen} label="Subjects" />
          <ModLauncher to={withWorkspaceReadOnly('/app/lectures')} Icon={Presentation} label="Lectures" />
        </div>

        <div className="sacc-section-title">System</div>
        <div className="sacc-launch-grid">
          <ModLauncher to="/app/school/management" Icon={Building2} label="School" />
          {isSchoolAdmin ? <ModLauncher to="/app/onboarding" Icon={Upload} label="Imports" /> : null}
          <ModLauncher to="/app/user-access" Icon={Shield} label="Access" />
          <ModLauncher to="/app/school-theme" Icon={Palette} label="Brand" />
        </div>

        <div className="sacc-section-title">Communication</div>
        <div className="sacc-launch-grid sacc-launch-grid--narrow">
          <ModLauncher to="/app/school/announcements/new" Icon={Megaphone} label="Circulars" />
          <ModLauncher to="/app/teacher/announcements/new" Icon={MessagesSquare} label="Class posts" />
        </div>

        <div className="sacc-section-title">Reports</div>
        <div className="sacc-launch-grid sacc-launch-grid--narrow">
          <ModLauncher to="/app/teacher/class-progress" Icon={LineChart} label="Class progress" />
        </div>
      </div>
    </div>
  );
}
