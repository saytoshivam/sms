import './studentsWorkspace.css';

/** One metric chip for the roster landing row. Real total or placeholder for future APIs. */

export type RosterMetric = {
  id: string;
  title: string;
  caption?: string;
  /** When undefined, renders em dash — reserved for forthcoming reporting APIs. */
  value: number | null;
  tone?: 'default' | 'accent' | 'warn';
  onClick?: () => void;
};

type Props = {
  metrics: readonly RosterMetric[];
  loading?: boolean;
};

export function StudentModuleSummaryCards({ metrics, loading }: Props) {
  return (
    <div className="sw-metrics" role="region" aria-label="Roster overview">
      {metrics.map((m) => {
        const clickable = !!m.onClick && !loading && m.value !== null && m.value > 0;
        return (
          <div
            key={m.id}
            className={[
              'sw-metric-card',
              m.tone === 'accent' ? 'sw-metric-card--accent' : '',
              m.tone === 'warn' && m.value ? 'sw-metric-card--warn' : '',
              clickable ? 'sw-metric-card--clickable' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? m.onClick : undefined}
            onKeyDown={clickable ? (e) => e.key === 'Enter' && m.onClick?.() : undefined}
            title={clickable ? `Filter by: ${m.title}` : undefined}
          >
            <div className="sw-metric-title">{m.title}</div>
            <div className={`sw-metric-value${loading ? ' sw-metric-value--pulse' : ''}`}>
              {loading ? '' : m.value == null ? '—' : m.value.toLocaleString()}
            </div>
            {m.caption ? <div className="sw-metric-caption">{m.caption}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
