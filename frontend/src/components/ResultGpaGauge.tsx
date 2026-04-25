/** Circular gauge: value and max on same scale (e.g. TGPA 0–4). */
export function ResultGpaGauge({
  value,
  max = 4,
  size = 'lg',
  centerText,
}: {
  value: number;
  max?: number;
  size?: 'lg' | 'sm';
  /** Overrides numeric text in the center of the gauge. */
  centerText?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const deg = Math.round((pct / 100) * 360);
  const dim = size === 'lg' ? 120 : 88;
  const inner = size === 'lg' ? 86 : 64;
  const fontSize = size === 'lg' ? 28 : 20;
  const numeric =
    value >= max - 0.04 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return (
    <div className="res-gauge" style={{ width: dim, height: dim }}>
      <div
        className="res-gauge-ring"
        style={{
          width: dim,
          height: dim,
          background: `conic-gradient(#dc2626 ${deg}deg, #e5e7eb 0deg)`,
        }}
      />
      <div
        className="res-gauge-inner"
        style={{
          width: inner,
          height: inner,
          fontSize,
        }}
      >
        {centerText ?? numeric}
      </div>
    </div>
  );
}
