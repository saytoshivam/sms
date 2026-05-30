import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type StudentPortalResultComponentDTO = {
  id: number | null;
  componentName: string;
  calculationRule: string;
  rawScore: number | null;
  rawMax: number | null;
  weightedScore: number | null;
  weightagePercent: number | null;
  calculationDetailsJson: string | null;
};

type StudentPortalResultDTO = {
  id: number | null;
  schemeName: string;
  academicYearLabel: string;
  subjectName: string;
  subjectCode: string | null;
  classGroupLabel: string;
  totalWeightedScore: number | null;
  percentage: number | null;
  grade: string | null;
  status: string;
  generatedAt: string | null;
  publishedAt: string | null;
  components: StudentPortalResultComponentDTO[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

type CalcDetail = {
  instanceName?: string;
  score?: number;
  max?: number;
  dropped?: boolean;
  note?: string;
};

function parseCalcDetails(json: string | null): CalcDetail[] {
  if (!json) return [];
  try {
    const p = JSON.parse(json);
    return Array.isArray(p) ? (p as CalcDetail[]) : [];
  } catch {
    return [];
  }
}

function calcRuleLabel(rule: string): string {
  return rule.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function gradeColor(grade: string | null): string {
  if (!grade) return '#6b7280';
  const g = grade.toUpperCase();
  if (g.startsWith('A')) return '#059669';
  if (g.startsWith('B')) return '#2563eb';
  if (g.startsWith('C')) return '#d97706';
  if (g.startsWith('D')) return '#dc2626';
  return '#6b7280';
}

// ── Component detail ────────────────────────────────────────────────────────

function ComponentBreakdown({ comp }: { comp: StudentPortalResultComponentDTO }) {
  const details = parseCalcDetails(comp.calculationDetailsJson);
  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid rgba(15,23,42,0.09)',
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{comp.componentName}</span>
          <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b', background: '#e2e8f0', borderRadius: 4, padding: '1px 6px' }}>
            {calcRuleLabel(comp.calculationRule)}
          </span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>
            {comp.weightedScore != null ? comp.weightedScore.toFixed(2) : '\u2014'}
          </span>
          {comp.weightagePercent != null ? (
            <span style={{ fontSize: 11, color: '#64748b' }}>/{comp.weightagePercent}</span>
          ) : null}
        </div>
      </div>

      {details.length > 0 ? (
        <div style={{ paddingLeft: 4 }}>
          {details.map((d, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: d.dropped ? '#94a3b8' : '#334155', textDecoration: d.dropped ? 'line-through' : undefined }}>
                {d.instanceName ?? `Entry ${i + 1}`}
                {typeof d.score === 'number' && typeof d.max === 'number'
                  ? ` \u2014 ${d.score}/${d.max}`
                  : typeof d.score === 'number' ? ` \u2014 ${d.score}` : ''}
              </span>
              {d.dropped ? (
                <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>dropped</span>
              ) : null}
              {d.note ? <span style={{ fontSize: 11, color: '#94a3b8' }}>{d.note}</span> : null}
            </div>
          ))}
        </div>
      ) : comp.rawScore != null && comp.rawMax != null ? (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Raw score: {comp.rawScore}/{comp.rawMax}
        </div>
      ) : null}
    </div>
  );
}

// ── Subject result card ───────────────────────────────────────────────────────

function SubjectResultCard({ result }: { result: StudentPortalResultDTO }) {
  const [expanded, setExpanded] = useState(false);
  const gc = gradeColor(result.grade);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid rgba(15,23,42,0.1)',
      overflow: 'hidden',
      marginBottom: 12,
      boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
    }}>
      {/* Subject header */}
      <div
        style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {result.subjectName}
            {result.subjectCode ? (
              <span style={{ fontWeight: 400, fontSize: 12, color: '#64748b', marginLeft: 6 }}>({result.subjectCode})</span>
            ) : null}
          </div>
          {result.totalWeightedScore != null ? (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              Total: <strong>{result.totalWeightedScore.toFixed(2)}</strong>
              {result.percentage != null ? (
                <span style={{ marginLeft: 8 }}>({result.percentage.toFixed(1)}%)</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {result.grade ? (
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: gc + '18',
              border: `2px solid ${gc}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 16, color: gc,
            }}>
              {result.grade}
            </div>
          ) : null}
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{expanded ? '\u25b2' : '\u25bc'}</span>
        </div>
      </div>

      {/* Component breakdown */}
      {expanded && result.components.length > 0 ? (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Component Breakdown
          </div>
          {result.components.map((c, i) => <ComponentBreakdown key={i} comp={c} />)}

          {/* Summary row */}
          <div style={{
            display: 'flex', gap: 16, paddingTop: 10, borderTop: '1px solid rgba(15,23,42,0.08)',
            flexWrap: 'wrap', fontSize: 13,
          }}>
            <span><span style={{ color: '#64748b' }}>Total: </span><strong>{result.totalWeightedScore?.toFixed(2) ?? '\u2014'}</strong></span>
            {result.percentage != null ? (
              <span><span style={{ color: '#64748b' }}>Percentage: </span><strong style={{ color: '#2563eb' }}>{result.percentage.toFixed(1)}%</strong></span>
            ) : null}
            {result.grade ? (
              <span><span style={{ color: '#64748b' }}>Grade: </span><strong style={{ color: gc }}>{result.grade}</strong></span>
            ) : null}
            {result.publishedAt ? (
              <span style={{ color: '#94a3b8', fontSize: 11 }}>
                Published: {new Date(result.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function StudentResultsPage() {
  const q = useQuery({
    queryKey: ['student-results-v2'],
    queryFn: async () => (await api.get<StudentPortalResultDTO[]>('/api/v1/student/me/results')).data,
  });

  // Group by "academicYearLabel — schemeName"
  const schemeGroups = useMemo(() => {
    const results = q.data ?? [];
    const map = new Map<string, { key: string; academicYearLabel: string; schemeName: string; results: StudentPortalResultDTO[] }>();
    for (const r of results) {
      const key = `${r.academicYearLabel} \u2014 ${r.schemeName}`;
      if (!map.has(key)) {
        map.set(key, { key, academicYearLabel: r.academicYearLabel, schemeName: r.schemeName, results: [] });
      }
      map.get(key)!.results.push(r);
    }
    return Array.from(map.values());
  }, [q.data]);

  return (
    <div className="res-page">
      <header className="res-topbar">
        <h1 className="res-topbar-title">My Results</h1>
      </header>

      <div className="res-body">
        {q.isLoading ? (
          <div className="muted" style={{ padding: 8 }}>Loading\u2026</div>
        ) : q.isError ? (
          <div style={{ color: '#b91c1c', fontSize: 14 }}>
            {String((q.error as { response?: { data?: unknown } })?.response?.data ?? q.error)}
          </div>
        ) : schemeGroups.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>\uD83D\uDCCB</div>
            <p style={{ margin: 0, fontSize: 15, color: '#374151', fontWeight: 600 }}>No published results yet.</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
              Your school will publish results here after examinations are completed and reviewed.
            </p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 24 }}>
            {schemeGroups.map((group) => (
              <div key={group.key}>
                {/* Scheme header */}
                <div style={{
                  background: 'linear-gradient(95deg, #1e293b 0%, #334155 100%)',
                  borderRadius: '10px 10px 0 0',
                  padding: '10px 14px',
                  marginBottom: 0,
                }}>
                  <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 15 }}>{group.schemeName}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{group.academicYearLabel}</div>
                </div>

                {/* Summary chips */}
                <div style={{
                  background: '#f8fafc',
                  borderLeft: '1px solid rgba(15,23,42,0.1)',
                  borderRight: '1px solid rgba(15,23,42,0.1)',
                  padding: '8px 14px',
                  display: 'flex', gap: 10, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>
                    {group.results.length} subject{group.results.length === 1 ? '' : 's'}
                  </span>
                  {group.results.filter((r) => r.grade).map((r) => (
                    <span key={r.id ?? r.subjectName} style={{
                      fontSize: 12,
                      background: gradeColor(r.grade) + '18',
                      color: gradeColor(r.grade),
                      borderRadius: 4,
                      padding: '1px 7px',
                      fontWeight: 700,
                    }}>
                      {r.subjectName}: {r.grade}
                    </span>
                  ))}
                </div>

                {/* Subject cards */}
                <div style={{
                  border: '1px solid rgba(15,23,42,0.1)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  overflow: 'hidden',
                  padding: 12,
                  background: '#fff',
                }}>
                  {group.results.map((r) => <SubjectResultCard key={r.id ?? r.subjectName} result={r} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
