import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '../../lib/toast';
import './adminDailyAttendanceDashboard.css';

export type AdminDailySectionRow = {
  classGroupId: number;
  displayName: string;
  classTeacherName: string;
  submittedLocked: boolean;
  sessionId: number | null;
  cutoffMissedPending: boolean;
  gradeLevel: number | null;
  sectionLabel: string | null;
  lockedAt: string | null;
  classTeacherEmail: string | null;
};

export type AdminDailyBoardPayload = {
  dailyCutoffLocalTime: string | number[] | null;
  sections: AdminDailySectionRow[];
};

type StatusFilter = 'all' | 'pending' | 'overdue' | 'completed';

function rowStatus(s: AdminDailySectionRow): RowStatus {
  if (s.submittedLocked) return 'completed';
  if (s.cutoffMissedPending) return 'overdue';
  return 'pending';
}

function parseCutoffParts(raw: AdminDailyBoardPayload['dailyCutoffLocalTime']): { h: number; m: number; sec: number } | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const p = raw.split(':').map((x) => Number(x));
    if (p.length >= 2 && p.every((n) => Number.isFinite(n))) {
      return { h: p[0], m: p[1], sec: p[2] ?? 0 };
    }
    return null;
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    return { h: Number(raw[0]), m: Number(raw[1]), sec: Number(raw[2]) ?? 0 };
  }
  return null;
}

function setTodayTime(d: Date, parts: { h: number; m: number; sec: number }) {
  const x = new Date(d);
  x.setHours(parts.h, parts.m, parts.sec, 0);
  return x;
}

function formatDurationMs(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function timeRemainingUntilCutoff(cutoffParts: { h: number; m: number; sec: number } | null): string | null {
  if (!cutoffParts) return null;
  const now = new Date();
  const end = setTodayTime(now, cutoffParts);
  if (end.getTime() <= now.getTime()) return null;
  return formatDurationMs(end.getTime() - now.getTime());
}

function minutesPastCutoff(cutoffParts: { h: number; m: number; sec: number } | null): string {
  if (!cutoffParts) return '—';
  const now = new Date();
  const cut = setTodayTime(now, cutoffParts);
  if (now.getTime() <= cut.getTime()) return '—';
  return formatDurationMs(now.getTime() - cut.getTime());
}

/** Sort: grade ascending (nulls last), then display name. */
function sortOperational(a: AdminDailySectionRow, b: AdminDailySectionRow): number {
  const ga = a.gradeLevel ?? 999;
  const gb = b.gradeLevel ?? 999;
  if (ga !== gb) return ga - gb;
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

function attendanceUrl(ymd: string, classGroupId: number) {
  const q = new URLSearchParams();
  q.set('date', ymd);
  q.set('classGroupId', String(classGroupId));
  return `/app/attendance?${q.toString()}`;
}

function averageSubmissionClock(rows: AdminDailySectionRow[]): string | null {
  const withTime = rows.filter((s) => s.submittedLocked && s.lockedAt);
  if (withTime.length === 0) return null;
  let sumMin = 0;
  for (const s of withTime) {
    const d = new Date(s.lockedAt!);
    sumMin += d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }
  const avg = sumMin / withTime.length;
  const h = Math.floor(avg / 60) % 24;
  const m = Math.round(avg % 60);
  const dt = new Date();
  dt.setHours(h, m, 0, 0);
  return `${dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} avg`;
}

export function AdminDailyAttendanceDashboard({
  ymd,
  data,
  isLoading,
  errorText,
  variant = 'default',
}: {
  ymd: string;
  data: AdminDailyBoardPayload | undefined;
  isLoading: boolean;
  errorText: string | null;
  variant?: 'default' | 'page';
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');

  const cutoffParts = useMemo(() => parseCutoffParts(data?.dailyCutoffLocalTime ?? null), [data?.dailyCutoffLocalTime]);

  const filteredSections = useMemo(() => {
    const list = data?.sections ?? [];
    if (gradeFilter === 'all') return list;
    return list.filter((s) => s.gradeLevel === gradeFilter);
  }, [data?.sections, gradeFilter]);

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    for (const s of data?.sections ?? []) {
      if (s.gradeLevel != null) set.add(s.gradeLevel);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [data?.sections]);

  const kpis = useMemo(() => {
    const sections = filteredSections;
    const total = sections.length;
    let completed = 0;
    let pending = 0;
    let overdue = 0;
    for (const s of sections) {
      const st = rowStatus(s);
      if (st === 'completed') completed += 1;
      else if (st === 'overdue') overdue += 1;
      else pending += 1;
    }
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    const avgSubmit = averageSubmissionClock(sections);
    return { total, completed, pending, overdue, pct, avgSubmit };
  }, [filteredSections]);

  const grouped = useMemo(() => {
    const sections = filteredSections;
    const overdue = sections.filter((s) => rowStatus(s) === 'overdue').sort(sortOperational);
    const pending = sections.filter((s) => rowStatus(s) === 'pending').sort(sortOperational);
    const completed = sections.filter((s) => rowStatus(s) === 'completed').sort(sortOperational);
    return { overdue, pending, completed };
  }, [filteredSections]);

  const activity = useMemo(() => {
    const done = (data?.sections ?? []).filter((s) => s.submittedLocked && s.lockedAt);
    done.sort((a, b) => new Date(b.lockedAt!).getTime() - new Date(a.lockedAt!).getTime());
    return done.slice(0, 25);
  }, [data?.sections]);

  const showGroup = (key: RowStatus) => {
    if (statusFilter === 'all') return true;
    return statusFilter === key;
  };

  const notifyTeacher = (s: AdminDailySectionRow) => {
    const subject = encodeURIComponent(`Daily attendance: ${s.displayName}`);
    const body = encodeURIComponent(`Please submit today's attendance for ${s.displayName} (${ymd}).`);
    if (s.classTeacherEmail) {
      window.location.href = `mailto:${encodeURIComponent(s.classTeacherEmail)}?subject=${subject}&body=${body}`;
      return;
    }
    const text = `Reminder: submit daily attendance for ${s.displayName} (${ymd}). Class teacher: ${s.classTeacherName}.`;
    void navigator.clipboard.writeText(text).then(
      () => toast.info('Reminder copied', 'No teacher email on file — paste into WhatsApp or your SMS tool.'),
      () => toast.error('Could not copy', 'Share this reminder manually.'),
    );
  };

  const notifyAllPending = () => {
    const rows = grouped.pending;
    if (rows.length === 0) return;
    const emails = [...new Set(rows.map((r) => r.classTeacherEmail).filter(Boolean) as string[])];
    const subject = encodeURIComponent(`Daily attendance pending sections — ${ymd}`);
    const body = encodeURIComponent(
      rows.map((r) => `• ${r.displayName} — ${r.classTeacherName}`).join('\n'),
    );
    if (emails.length > 0) {
      window.location.href = `mailto:${emails.map(encodeURIComponent).join(',')}?subject=${subject}&body=${body}`;
      return;
    }
    const text = `Pending daily attendance (${ymd}):\n${rows.map((r) => `• ${r.displayName} — ${r.classTeacherName}`).join('\n')}`;
    void navigator.clipboard.writeText(text).then(
      () =>
        toast.info(
          'List copied',
          'No teacher emails on file — paste into your messaging channel.',
        ),
      () => toast.error('Could not copy'),
    );
  };

  if (isLoading) {
    return <p className="muted adad-muted">Loading attendance compliance…</p>;
  }
  if (errorText) {
    return (
      <p style={{ color: '#b91c1c', fontSize: 14, fontWeight: 700 }}>
        {errorText}
      </p>
    );
  }
  if (!data) {
    return null;
  }

  const consoleLink = (
    <Link to={`/app/attendance?date=${encodeURIComponent(ymd)}`} className="adad-console-link">
      Open Attendance Console →
    </Link>
  );

  const metaLine = (
    <span className="adad-meta-inline">
      Today ({ymd}) · Homeroom sections ·{' '}
      {cutoffParts ? (
        <>
          Cutoff {`${cutoffParts.h.toString().padStart(2, '0')}:${cutoffParts.m.toString().padStart(2, '0')}`} local
        </>
      ) : (
        <span className="adad-meta-badge">Flexible submission window</span>
      )}
    </span>
  );

  return (
    <div className="adad">
      {variant === 'page' ? (
        <div className="adad-head-row">
          <p className="adad-muted adad-meta-p" style={{ margin: 0 }}>
            {metaLine}
          </p>
          {consoleLink}
        </div>
      ) : (
        <div className="adad-head-row">
          <div>
            <div className="adad-title">Daily attendance monitor</div>
            <p className="adad-muted adad-meta-p" style={{ margin: '4px 0 0' }}>
              {metaLine}
            </p>
          </div>
          {consoleLink}
        </div>
      )}

      <div className="adad-layout">
        <div className="adad-main adad-main-col">
          <div className="adad-kpi-row">
            <div className="adad-kpi">
              <div className="adad-kpi-value">{kpis.total}</div>
              <div className="adad-kpi-label">Sections today</div>
            </div>
            <div className="adad-kpi">
              <div className="adad-kpi-value adad-kpi-value--green">{kpis.completed}</div>
              <div className="adad-kpi-label">Completed</div>
            </div>
            <div className="adad-kpi">
              <div className="adad-kpi-value adad-kpi-value--amber">{kpis.pending}</div>
              <div className="adad-kpi-label">Pending</div>
            </div>
            <div className="adad-kpi">
              <div className="adad-kpi-value adad-kpi-value--red">{kpis.overdue}</div>
              <div className="adad-kpi-label">Overdue</div>
            </div>
            <div className="adad-kpi">
              <div className="adad-kpi-value adad-kpi-dense">{kpis.avgSubmit ?? '—'}</div>
              <div className="adad-kpi-label">Avg submit time</div>
            </div>
          </div>

          <div className="adad-progress-block">
            <div className="adad-progress-head">
              <span className="adad-progress-title">Submission progress</span>
              <span className="adad-muted adad-progress-count">
                {kpis.completed} / {kpis.total} submitted
              </span>
            </div>
            <div className="adad-progress-bar-wrap" role="progressbar" aria-valuenow={kpis.pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="adad-progress-bar-fill" style={{ width: `${kpis.pct}%` }} />
            </div>
          </div>

          <div className="adad-toolbar adad-toolbar--compact">
            <div className="adad-toolbar-filters">
              {(['all', 'pending', 'overdue', 'completed'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`adad-chip${statusFilter === k ? ' adad-chip--active' : ''}`}
                  onClick={() => setStatusFilter(k)}
                >
                  {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              ))}
              {gradeOptions.length > 0 ? (
                <select
                  className="adad-select adad-select--compact"
                  aria-label="Filter by grade"
                  value={gradeFilter === 'all' ? '' : String(gradeFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setGradeFilter(v === '' ? 'all' : Number(v));
                  }}
                >
                  <option value="">All grades</option>
                  {gradeOptions.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>

          {showGroup('overdue') ? (
            <section
              className={`adad-group adad-group--overdue${grouped.overdue.length > 0 ? ' adad-group--sticky' : ''}`}
            >
              <div className="adad-group-head">
                <span>Overdue ({grouped.overdue.length})</span>
                <span className="adad-group-head-sub">Past cutoff · action required</span>
              </div>
              <div className="adad-group-body">
                {grouped.overdue.length === 0 ? (
                  <div className="adad-empty">No overdue sections in this filter.</div>
                ) : (
                  grouped.overdue.map((s) => (
                    <div key={s.classGroupId} className="adad-row">
                      <div className="adad-row-main">
                        <div className="adad-row-title">{s.displayName}</div>
                        <div className="adad-row-teacher">{s.classTeacherName}</div>
                        <div className="adad-row-chips">
                          <span className="adad-chip-status adad-chip-status--bad">Overdue</span>
                          {cutoffParts ? (
                            <span className="adad-chip-status adad-chip-status--muted">~{minutesPastCutoff(cutoffParts)} past cutoff</span>
                          ) : (
                            <span className="adad-chip-status adad-chip-status--muted">Awaiting submission</span>
                          )}
                        </div>
                      </div>
                      <div className="adad-row-actions">
                        <Link to={attendanceUrl(ymd, s.classGroupId)} className="adad-btn adad-btn--primary adad-btn--cta">
                          Open attendance
                        </Link>
                        <details className="adad-more">
                          <summary className="adad-more-trigger" aria-label="More actions">
                            ⋯
                          </summary>
                          <div className="adad-more-menu">
                            <button type="button" className="adad-more-item" onClick={() => notifyTeacher(s)}>
                              Notify teacher
                            </button>
                            <Link to={attendanceUrl(ymd, s.classGroupId)} className="adad-more-item">
                              Mark on behalf
                            </Link>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {showGroup('pending') ? (
            <section className="adad-group adad-group--pending">
              <div className="adad-group-head">
                <span>Pending ({grouped.pending.length})</span>
                <span className="adad-group-head-sub">Not submitted yet</span>
              </div>
              {grouped.pending.length > 0 ? (
                <div className="adad-bulk-bar">
                  <button type="button" className="adad-btn adad-btn--bulk" onClick={notifyAllPending}>
                    Notify all pending ({grouped.pending.length})
                  </button>
                </div>
              ) : null}
              <div className="adad-group-body">
                {grouped.pending.length === 0 ? (
                  <div className="adad-empty">No pending sections in this filter.</div>
                ) : (
                  grouped.pending.map((s) => {
                    const remain = timeRemainingUntilCutoff(cutoffParts);
                    return (
                      <div key={s.classGroupId} className="adad-row">
                        <div className="adad-row-main">
                          <div className="adad-row-title">{s.displayName}</div>
                          <div className="adad-row-teacher">{s.classTeacherName}</div>
                          <div className="adad-row-chips">
                            <span className="adad-chip-status adad-chip-status--warn">Pending</span>
                            <span className="adad-chip-status adad-chip-status--muted">Awaiting teacher</span>
                            {remain ? (
                              <span className="adad-chip-status adad-chip-status--neutral">{remain} left</span>
                            ) : cutoffParts ? (
                              <span className="adad-chip-status adad-chip-status--neutral">Within window</span>
                            ) : (
                              <span className="adad-chip-status adad-chip-status--neutral">Flexible window</span>
                            )}
                          </div>
                        </div>
                        <div className="adad-row-actions">
                          <Link to={attendanceUrl(ymd, s.classGroupId)} className="adad-btn adad-btn--primary adad-btn--cta">
                            Open attendance
                          </Link>
                          <details className="adad-more">
                            <summary className="adad-more-trigger" aria-label="More actions">
                              ⋯
                            </summary>
                            <div className="adad-more-menu">
                              <button type="button" className="adad-more-item" onClick={() => notifyTeacher(s)}>
                                Notify teacher
                              </button>
                              <Link to={attendanceUrl(ymd, s.classGroupId)} className="adad-more-item">
                                Mark on behalf
                              </Link>
                            </div>
                          </details>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          {showGroup('completed') ? (
            <details className="adad-group adad-group--completed">
              <summary className="adad-group-head adad-group-summary">
                <span>
                  Completed ({grouped.completed.length}) — expand
                </span>
              </summary>
              <div className="adad-group-body">
                {grouped.completed.length === 0 ? (
                  <div className="adad-empty">No completed sections in this filter.</div>
                ) : (
                  grouped.completed.map((s) => (
                    <div key={s.classGroupId} className="adad-row">
                      <div className="adad-row-main">
                        <div className="adad-row-title">{s.displayName}</div>
                        <div className="adad-row-teacher">{s.classTeacherName}</div>
                        <div className="adad-row-chips">
                          <span className="adad-chip-status adad-chip-status--ok">Done</span>
                          {s.lockedAt ? (
                            <span className="adad-chip-status adad-chip-status--muted">
                              {new Date(s.lockedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="adad-row-actions">
                        <Link to={attendanceUrl(ymd, s.classGroupId)} className="adad-btn adad-btn--cta-secondary">
                          View
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          ) : null}
        </div>

        <aside className="adad-feed">
          <h3>Recent activity</h3>
          {activity.length === 0 ? (
            <p className="adad-feed-empty">Attendance submissions will appear here as class teachers submit.</p>
          ) : (
            <ul>
              {activity.map((s) => {
                const t = s.lockedAt ? new Date(s.lockedAt) : null;
                const timeStr = t ? t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—';
                return (
                  <li key={`${s.classGroupId}-${s.lockedAt}`}>
                    <time>{timeStr}</time>
                    {' — '}
                    <strong>{s.displayName}</strong> submitted
                    {s.classTeacherName && s.classTeacherName !== '—' ? (
                      <>
                        {' '}
                        · <span className="adad-feed-teacher">{s.classTeacherName}</span>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
