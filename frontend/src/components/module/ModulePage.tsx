import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useImpactSummary } from '../../lib/impactStore';
import { ImpactPreviewPanel } from './ImpactPreviewPanel';

export type StatusLevel = 'ok' | 'warn' | 'error' | 'info' | 'idle';

export type ModuleTab = {
  id: string;
  label: string;
  /** Optional badge (e.g. count of issues). */
  badge?: number | string | null;
};

type Props = {
  title: string;
  /** Short caption under the title. */
  subtitle?: ReactNode;
  /** Top-right area: usually a small status chip + primary action. */
  status?: { level: StatusLevel; label: string; hint?: string };
  /**
   * Optional impact summary (changes that affect timetable).
   * If omitted, the module page auto-wires to the global impact store and
   * opens `ImpactPreviewPanel` on click. Pass `null` to suppress entirely.
   */
  impact?: { changes: number; hard: number; soft: number; onPreview?: () => void } | null;
  tabs?: ModuleTab[];
  activeTabId?: string;
  /**
   * If set, tabs are rendered as links to `${tabHrefBase}?tab=<id>` (URL state).
   * If omitted, tab state is purely visual.
   */
  tabHrefBase?: string;
  /** Right-aligned actions in the header (e.g. + Add new). */
  headerActions?: ReactNode;
  /** Content area. */
  children: ReactNode;
  /** Sticky bar shown only when the consumer has unsaved/queued changes. */
  changeBar?: ChangeBarProps | null;
};

export type ChangeBarProps = {
  message: string;
  busy?: boolean;
  /** Primary action (e.g. Save & queue regenerate). */
  primary?: { label: string; onClick: () => void; disabled?: boolean };
  /** Secondary action (e.g. Save). */
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
  /** Tertiary, usually destructive (e.g. Discard). */
  tertiary?: { label: string; onClick: () => void; disabled?: boolean };
};

const STATUS_STYLE: Record<StatusLevel, { bg: string; color: string; dot: string }> = {
  ok: { bg: 'rgba(22,163,74,0.10)', color: '#166534', dot: '#16a34a' },
  warn: { bg: 'rgba(234,179,8,0.14)', color: '#a16207', dot: '#ca8a04' },
  error: { bg: 'rgba(220,38,38,0.10)', color: '#b91c1c', dot: '#dc2626' },
  info: { bg: 'rgba(37,99,235,0.10)', color: '#1d4ed8', dot: '#2563eb' },
  idle: { bg: 'rgba(100,116,139,0.12)', color: '#475569', dot: '#64748b' },
};

export function StatusChip({ level, label, hint }: { level: StatusLevel; label: string; hint?: string }) {
  const s = STATUS_STYLE[level];
  return (
    <span
      title={hint}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
      {label}
    </span>
  );
}

export function ImpactPill({
  changes,
  hard,
  soft,
  onPreview,
}: {
  changes: number;
  hard: number;
  soft: number;
  onPreview?: () => void;
}) {
  const level: StatusLevel = hard > 0 ? 'error' : changes > 0 || soft > 0 ? 'warn' : 'ok';
  const label =
    changes === 0 && hard === 0 && soft === 0
      ? 'No timetable impact'
      : `Impact: ${changes} change${changes === 1 ? '' : 's'} · ${hard} hard · ${soft} soft`;
  const s = STATUS_STYLE[level];
  return (
    <button
      type="button"
      onClick={onPreview}
      disabled={!onPreview}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.dot}40`,
        cursor: onPreview ? 'pointer' : 'default',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
      {label}
    </button>
  );
}

export function ModulePage({
  title,
  subtitle,
  status,
  impact,
  tabs,
  activeTabId,
  tabHrefBase,
  headerActions,
  children,
  changeBar,
}: Props) {
  const location = useLocation();
  const [impactOpen, setImpactOpen] = useState(false);
  // Auto-wire to the global impact store when the consumer doesn't supply
  // their own impact prop. Passing `null` explicitly suppresses the pill.
  const globalImpact = useImpactSummary();
  const resolvedImpact =
    impact === null
      ? null
      : impact === undefined
        ? {
            changes: globalImpact.total,
            hard: globalImpact.hard,
            soft: globalImpact.soft,
            onPreview: () => setImpactOpen(true),
          }
        : impact;

  const buildTabHref = (tabId: string) => {
    if (!tabHrefBase) return location.pathname;
    const u = new URL(window.location.origin + tabHrefBase);
    u.searchParams.set('tab', tabId);
    return u.pathname + u.search;
  };

  return (
    <div className="stack" style={{ gap: 14, paddingBottom: changeBar ? 96 : 0 }}>
      <header
        className="card stack"
        style={{
          gap: 10,
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(15,23,42,0.10)',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 950, color: '#0f172a' }}>{title}</h1>
              {status ? <StatusChip {...status} /> : null}
              {resolvedImpact ? <ImpactPill {...resolvedImpact} /> : null}
            </div>
            {subtitle ? (
              <div className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                {subtitle}
              </div>
            ) : null}
          </div>
          {headerActions ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {headerActions}
            </div>
          ) : null}
        </div>

        {tabs && tabs.length ? (
          <nav
            role="tablist"
            aria-label={`${title} sections`}
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              borderTop: '1px solid rgba(15,23,42,0.08)',
              paddingTop: 10,
              marginTop: 4,
            }}
          >
            {tabs.map((t) => {
              const isActive = t.id === activeTabId;
              const inner = (
                <span
                  className="row"
                  style={{
                    gap: 8,
                    alignItems: 'center',
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 900,
                    color: isActive ? '#7c2d12' : '#475569',
                    background: isActive ? 'rgba(255,247,237,0.95)' : 'transparent',
                    border: isActive ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                  }}
                >
                  {t.label}
                  {t.badge != null && t.badge !== 0 && t.badge !== '' ? (
                    <span
                      style={{
                        padding: '1px 7px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 950,
                        background: isActive ? 'rgba(249,115,22,0.18)' : 'rgba(15,23,42,0.08)',
                        color: isActive ? '#7c2d12' : '#0f172a',
                      }}
                    >
                      {t.badge}
                    </span>
                  ) : null}
                </span>
              );
              return tabHrefBase ? (
                <Link key={t.id} to={buildTabHref(t.id)} role="tab" aria-selected={isActive} style={{ textDecoration: 'none' }}>
                  {inner}
                </Link>
              ) : (
                <span key={t.id} role="tab" aria-selected={isActive}>
                  {inner}
                </span>
              );
            })}
          </nav>
        ) : null}
      </header>

      <main>{children}</main>

      {changeBar ? <StickyChangeBar {...changeBar} /> : null}

      {/* Auto-wired impact panel; only mounts when the consumer didn't supply its own onPreview. */}
      {impact === undefined ? (
        <ImpactPreviewPanel open={impactOpen} onClose={() => setImpactOpen(false)} />
      ) : null}
    </div>
  );
}

function StickyChangeBar({ message, busy, primary, secondary, tertiary }: ChangeBarProps) {
  return (
    <div
      role="region"
      aria-label="Pending changes"
      style={{
        position: 'sticky',
        bottom: 12,
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        background: 'rgba(15,23,42,0.95)',
        color: '#fff',
        boxShadow: '0 12px 28px rgba(15,23,42,0.32)',
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ minWidth: 0, fontWeight: 800, fontSize: 13 }}>
        {busy ? 'Saving…' : message}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {tertiary ? (
          <button type="button" className="btn secondary" disabled={tertiary.disabled || busy} onClick={tertiary.onClick}>
            {tertiary.label}
          </button>
        ) : null}
        {secondary ? (
          <button type="button" className="btn secondary" disabled={secondary.disabled || busy} onClick={secondary.onClick}>
            {secondary.label}
          </button>
        ) : null}
        {primary ? (
          <button type="button" className="btn" disabled={primary.disabled || busy} onClick={primary.onClick}>
            {primary.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
