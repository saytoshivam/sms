import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SmartSelect } from './SmartSelect';

export type StudentMarkRow = {
  subjectCode: string;
  subjectName: string;
  assessmentKey: string;
  assessmentTitle: string;
  maxScore: number;
  scoreObtained: number;
  scorePercent: number;
  assessedOn: string;
  termName: string | null;
};

const TERM_ALL = '__ALL__';
const TERM_UNTAGGED = '__NONE__';

type Props = {
  marks: StudentMarkRow[] | undefined;
  isLoading: boolean;
  error: unknown;
  title?: string;
  detailHref?: string;
  detailLabel?: string;
};

export function StudentMarksBoard({
  marks,
  isLoading,
  error,
  title = 'Marks · by subject',
  detailHref,
  detailLabel = 'Open full detail',
}: Props) {
  const [termKey, setTermKey] = useState<string>(TERM_ALL);

  const termOptions = useMemo(() => {
    const names = new Set<string>();
    let untagged = false;
    for (const m of marks ?? []) {
      if (m.termName) names.add(m.termName);
      else untagged = true;
    }
    return { named: [...names].sort((a, b) => a.localeCompare(b)), untagged };
  }, [marks]);

  const filteredMarks = useMemo(() => {
    const rows = marks ?? [];
    if (termKey === TERM_ALL) return rows;
    if (termKey === TERM_UNTAGGED) return rows.filter((m) => !m.termName);
    return rows.filter((m) => m.termName === termKey);
  }, [marks, termKey]);

  const marksBySubject = useMemo(() => {
    const map = new Map<string, { code: string; name: string; rows: StudentMarkRow[] }>();
    for (const m of filteredMarks) {
      const key = m.subjectCode || m.subjectName;
      const cur = map.get(key) ?? { code: m.subjectCode, name: m.subjectName, rows: [] as StudentMarkRow[] };
      cur.rows.push(m);
      map.set(key, cur);
    }
    for (const g of map.values()) {
      g.rows.sort((a, b) => b.assessedOn.localeCompare(a.assessedOn));
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredMarks]);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label htmlFor="student-marks-term" className="muted" style={{ margin: 0, fontSize: 12 }}>
            Term
          </label>
          <SmartSelect
            id="student-marks-term"
            value={termKey}
            onChange={setTermKey}
            disabled={isLoading || (marks ?? []).length === 0}
            options={[
              { value: TERM_ALL, label: 'All terms' },
              ...termOptions.named.map((t) => ({ value: t, label: t })),
              ...(termOptions.untagged ? [{ value: TERM_UNTAGGED, label: 'No term / general' }] : []),
            ]}
            style={{ minWidth: 180 }}
          />
          {detailHref ? (
            <Link className="btn secondary" style={{ fontSize: 13, padding: '6px 10px' }} to={detailHref}>
              {detailLabel}
            </Link>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="muted">Loading marks…</div>
      ) : error ? (
        <div style={{ color: '#b91c1c' }}>{String((error as any)?.response?.data ?? error)}</div>
      ) : marksBySubject.length === 0 ? (
        <div className="muted" style={{ fontSize: 14 }}>
          No marks for this selection yet.
        </div>
      ) : (
        <div className="perf-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {marksBySubject.map((g) => (
            <div key={g.code} className="subject-marks-cardboard">
              <h4>
                {g.name}
                <div className="muted" style={{ fontSize: 12, fontWeight: 400, marginTop: 2 }}>
                  {g.code}
                </div>
              </h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                {g.rows.map((m) => (
                  <li key={`${m.assessmentKey}-${m.assessedOn}`} style={{ marginBottom: 8 }}>
                    <div>
                      <strong>{m.assessmentTitle}</strong>
                      {m.termName && termKey === TERM_ALL ? (
                        <span className="muted" style={{ fontSize: 11 }}>
                          {' '}
                          · {m.termName}
                        </span>
                      ) : null}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {m.assessedOn} — {m.scoreObtained} / {m.maxScore} ({m.scorePercent.toFixed(1)}%)
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

