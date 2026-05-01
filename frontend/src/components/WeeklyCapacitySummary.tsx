/**
 * Shared weekly capacity copy used when mapping subjects (class defaults + section overrides).
 */
export type WeeklyCapacitySummaryProps = {
  slotsPerWeek: number | null;
  periodsScheduled: number;
  variant: 'class_defaults' | 'section_override';
  /** When slots cannot be computed (basic info incomplete). */
  missingHint: string;
};

export function WeeklyCapacitySummary({
  slotsPerWeek,
  periodsScheduled,
  variant,
  missingHint,
}: WeeklyCapacitySummaryProps) {
  if (slotsPerWeek != null) {
    const free = slotsPerWeek - periodsScheduled;
    const capacityScopeLabel = variant === 'class_defaults' ? 'each section' : 'this section';
    const periodsLabel = variant === 'class_defaults' ? 'Selected subjects total' : 'Enabled subjects total';
    const periodsFootnote =
      variant === 'class_defaults' ? '(from each subject\'s frequency)' : null;

    return (
      <>
        <div className="muted" style={{ fontWeight: 800 }}>
          Weekly capacity ({capacityScopeLabel}):{' '}
          <span style={{ color: '#0f172a', fontWeight: 950 }}>~{slotsPerWeek}</span> teachable slots
        </div>
        <div className="muted" style={{ fontWeight: 800, marginTop: 4 }}>
          {periodsLabel}:{' '}
          <span style={{ color: '#0f172a', fontWeight: 950 }}>{periodsScheduled}</span>
          {' '}periods/week
          {periodsFootnote ? (
            <>
              {' '}
              <span className="muted" style={{ fontWeight: 700 }}>
                {periodsFootnote}
              </span>
            </>
          ) : null}
        </div>
        <div
          style={{
            marginTop: 8,
            fontWeight: 950,
            color: free < 0 ? '#b45309' : free === 0 ? '#a16207' : '#166534',
          }}
        >
          {free < 0 ? (
            variant === 'class_defaults' ? (
              <>
                Over capacity by <strong>{Math.abs(free)}</strong> — remove subjects or lower weekly frequency on the Subjects
                step.
              </>
            ) : (
              <>
                Over capacity by <strong>{Math.abs(free)}</strong> — turn off subjects or lower frequencies (Subjects step /
                class defaults).
              </>
            )
          ) : (
            <>
              Free slots: <strong>{free}</strong> of {slotsPerWeek} remaining this week
            </>
          )}
        </div>
      </>
    );
  }

  return <div className="muted" style={{ fontWeight: 800 }}>{missingHint}</div>;
}
