import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { StudentMarkRow } from '../components/StudentMarksBoard';
import { marksPair, termAccordionTitle, weightagePair } from '../lib/viewMarksFormat';

function termKey(m: StudentMarkRow) {
  return (m.termName && m.termName.trim()) || 'Term 1';
}

export function StudentViewMarksPage() {
  const q = useQuery({
    queryKey: ['student-marks'],
    queryFn: async () => (await api.get<StudentMarkRow[]>('/api/v1/student/me/marks')).data,
  });

  const termKeys = useMemo(() => {
    const s = new Set<string>();
    for (const m of q.data ?? []) s.add(termKey(m));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [q.data]);

  const [openTerms, setOpenTerms] = useState<Set<string>>(new Set());
  const [backlogOpen, setBacklogOpen] = useState(false);

  useEffect(() => {
    if (!q.data?.length) return;
    setOpenTerms((prev) => {
      if (prev.size > 0) return prev;
      const first = termKeys[0];
      return first ? new Set([first]) : prev;
    });
  }, [q.data, termKeys]);

  const byTermAndSubject = useMemo(() => {
    const out = new Map<string, Map<string, StudentMarkRow[]>>();
    for (const m of q.data ?? []) {
      const tk = termKey(m);
      const sk = m.subjectCode || m.subjectName;
      const termMap = out.get(tk) ?? new Map<string, StudentMarkRow[]>();
      const list = termMap.get(sk) ?? [];
      list.push(m);
      termMap.set(sk, list);
      out.set(tk, termMap);
    }
    for (const subMap of out.values()) {
      for (const list of subMap.values()) {
        list.sort((a, b) => b.assessedOn.localeCompare(a.assessedOn));
      }
    }
    return out;
  }, [q.data]);

  const toggleTerm = (tk: string) => {
    setOpenTerms((prev) => {
      const next = new Set(prev);
      if (next.has(tk)) next.delete(tk);
      else next.add(tk);
      return next;
    });
  };

  return (
    <div className="vm-page">
      <header className="vm-topbar">
        <Link to="/app" className="vm-topbar-back">
          ← Back
        </Link>
        <h1 className="vm-topbar-title">View Marks</h1>
        <span style={{ width: 56 }} aria-hidden />
      </header>

      <div className="vm-body">
        <div className="vm-actions">
          <Link to="/app/student/schedule" className="btn secondary">
            Schedule
          </Link>
          <Link to="/app/student/results" className="btn secondary">
            Result & TGPA
          </Link>
        </div>

        {q.isLoading ? (
          <div className="vm-muted">Loading…</div>
        ) : q.error ? (
          <div className="vm-err">{String((q.error as any)?.response?.data ?? q.error)}</div>
        ) : termKeys.length === 0 ? (
          <div className="vm-empty">
            <p className="vm-muted" style={{ margin: 0 }}>
              No marks published yet.
            </p>
          </div>
        ) : (
          <ul className="vm-accordion">
            {termKeys.map((tk) => {
              const open = openTerms.has(tk);
              const subMap = byTermAndSubject.get(tk) ?? new Map();
              const subjects = [...subMap.entries()].sort((a, b) => a[1][0].subjectName.localeCompare(b[1][0].subjectName));
              return (
                <li key={tk} className="vm-term-block">
                  <button type="button" className="vm-term-bar" onClick={() => toggleTerm(tk)} aria-expanded={open}>
                    <span className="vm-term-bar-label">{termAccordionTitle(tk)}</span>
                    <span className="vm-term-chevron" aria-hidden>
                      {open ? '⌃' : '⌄'}
                    </span>
                  </button>
                  {open ? (
                    <div className="vm-term-panel">
                      {subjects.map(([sk, rows]) => {
                        const sample = rows[0];
                        return (
                          <section key={sk} className="vm-course">
                            <div className="vm-course-head">
                              {sample.subjectName.toUpperCase()} ( {sample.subjectCode} )
                            </div>
                            <table className="vm-table">
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th className="vm-th-num">Marks</th>
                                  <th className="vm-th-num">Weightage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r: StudentMarkRow, i: number) => (
                                  <tr key={`${r.assessmentKey}-${r.assessedOn}`}>
                                    <td>{r.assessmentTitle}</td>
                                    <td className="vm-td-num">{marksPair(r.scoreObtained, r.maxScore)}</td>
                                    <td className="vm-td-num">{weightagePair(r.scoreObtained, r.maxScore, i)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </section>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
            <li className="vm-term-block">
              <button
                type="button"
                className="vm-term-bar vm-term-bar--muted"
                onClick={() => setBacklogOpen((o) => !o)}
                aria-expanded={backlogOpen}
              >
                <span className="vm-term-bar-label">12526B - (Reappear/Backlog)</span>
                <span className="vm-term-chevron" aria-hidden>
                  {backlogOpen ? '⌃' : '⌄'}
                </span>
              </button>
              {backlogOpen ? (
                <div className="vm-term-panel vm-term-panel--empty">
                  <p className="vm-muted" style={{ margin: 0 }}>
                    No backlog or reappear marks are linked to this profile yet.
                  </p>
                </div>
              ) : null}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
