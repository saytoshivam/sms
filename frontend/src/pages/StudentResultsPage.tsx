import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { StudentMarkRow } from '../components/StudentMarksBoard';
import { ResultGpaGauge } from '../components/ResultGpaGauge';
import {
  courseGradesForTerm,
  formatSemesterHeading,
  groupMarksByTerm,
  overallPerformanceGpa,
  tgpaFromCourses,
} from '../lib/studentGrades';

export function StudentResultsPage() {
  const q = useQuery({
    queryKey: ['student-marks'],
    queryFn: async () => (await api.get<StudentMarkRow[]>('/api/v1/student/me/marks')).data,
  });

  const termCards = useMemo(() => {
    const map = groupMarksByTerm(q.data ?? []);
    const out: {
      name: string;
      slug: string;
      courses: ReturnType<typeof courseGradesForTerm>;
      tgpa: number;
      heading: string;
    }[] = [];
    for (const [name, rows] of map.entries()) {
      const courses = courseGradesForTerm(rows);
      const tgpa = tgpaFromCourses(courses);
      out.push({
        name,
        slug: encodeURIComponent(name),
        courses,
        tgpa,
        heading: formatSemesterHeading(name),
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [q.data]);

  const overall = useMemo(
    () =>
      overallPerformanceGpa(termCards.map((t) => ({ tgpa: t.tgpa, courseCount: t.courses.length }))),
    [termCards],
  );

  return (
    <div className="res-page">
      <header className="res-topbar">
        <h1 className="res-topbar-title">Result</h1>
        <span style={{ width: 56 }} aria-hidden />
      </header>

      <div className="res-body">
        {q.isLoading ? (
          <div className="muted">Loading…</div>
        ) : q.error ? (
          <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error)}</div>
        ) : termCards.length === 0 ? (
          <div className="res-card-white res-pad">
            <p className="muted" style={{ margin: 0 }}>
              No graded assessments yet. Your school will publish marks here by term.
            </p>
            <Link to="/app/student/schedule" className="btn secondary" style={{ marginTop: 12, display: 'inline-block' }}>
              Schedule
            </Link>
          </div>
        ) : (
          <>
            <div className="res-hero-card">
              <ResultGpaGauge value={overall} max={4} size="lg" />
              <p className="res-hero-label">Overall Performance</p>
            </div>

            <ul className="res-sem-list">
              {termCards.map((t) => (
                <li key={t.name}>
                  <Link to={`/app/student/results/${t.slug}`} className="res-sem-card">
                    <div className="res-sem-bar">{t.heading}</div>
                    <div className="res-sem-body">
                      <ResultGpaGauge value={t.tgpa} max={4} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
