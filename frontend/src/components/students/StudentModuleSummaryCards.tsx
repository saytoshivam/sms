import './studentsWorkspace.css';

/** One metric chip for the roster landing row. Real total or placeholder for future APIs. */

export type RosterMetric = {
  id: string;
  title: string;
  caption?: string;
  /** When undefined, renders em dash — reserved for forthcoming reporting APIs. */
  value: number | null;
  tone?: 'default' | 'accent' | 'warn';
};

type Props = {
  metrics: readonly RosterMetric[];
  loading?: boolean;
};

export function StudentModuleSummaryCards({ metrics, loading }: Props) {
  return (
    <div className="sw-metrics" role="region" aria-label="Roster overview">
      {metrics.map((m) => (
        <div
          key={m.id}
          className={`sw-metric-card${m.tone === 'accent' ? ' sw-metric-card--accent' : ''}${
            m.tone === 'warn' ? ' sw-metric-card--warn' : ''
          }`}
        >
          <div className="sw-metric-title">{m.title}</div>
          <div className={`sw-metric-value${loading ? ' sw-metric-value--pulse' : ''}`}>
            {loading ? '' : m.value == null ? '—' : m.value.toLocaleString()}
          </div>
          {m.caption ? <div className="sw-metric-caption">{m.caption}</div> : null}
        </div>
      ))}
    </div>
  );
}
