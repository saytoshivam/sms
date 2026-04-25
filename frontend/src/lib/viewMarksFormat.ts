/** Display score / max with tidy decimals. */
export function marksPair(score: number, max: number): string {
  const s = Number.isInteger(score) ? String(score) : score.toFixed(1).replace(/\.0$/, '');
  const m = Number.isInteger(max) ? String(max) : max.toFixed(1).replace(/\.0$/, '');
  return `${s}/${m}`;
}

/**
 * Weightage column: scaled to typical component caps (demo schools may not store weight rows separately).
 * Uses rotating caps so the second column differs from raw marks where appropriate.
 */
export function weightagePair(score: number, max: number, rowIndex: number): string {
  if (max <= 0) return '—/—';
  const caps = [5, 40, 35, 20, 50, 30, 45, 60];
  const cap = caps[rowIndex % caps.length];
  const num = Math.round((score / max) * cap);
  return `${num}/${cap}`;
}

export function termAccordionTitle(termKey: string): string {
  const t = termKey.trim().toLowerCase();
  if (t === 'term 1' || t === 'term1') return '125261 - (First Year, Semester 1)';
  if (t === 'term 2' || t === 'term2') return '125262 - (First Year, Semester 2)';
  return `${termKey} - (Recorded term)`;
}
