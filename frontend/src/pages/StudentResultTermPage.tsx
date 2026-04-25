import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { StudentMarkRow } from '../components/StudentMarksBoard';
import {
  courseGradesForTerm,
  formatSemesterHeading,
  groupMarksByTerm,
  tgpaFromCourses,
} from '../lib/studentGrades';

export function StudentResultTermPage() {
  const { termSlug } = useParams();
  const termName = useMemo(() => {
    try {
      return decodeURIComponent(termSlug ?? '');
    } catch {
      return '';
    }
  }, [termSlug]);

  const q = useQuery({
    queryKey: ['student-marks'],
    queryFn: async () => (await api.get<StudentMarkRow[]>('/api/v1/student/me/marks')).data,
  });

  const detail = useMemo(() => {
    const map = groupMarksByTerm(q.data ?? []);
    const rows = map.get(termName);
    if (!rows || rows.length === 0) return null;
    const courses = courseGradesForTerm(rows);
    const tgpa = tgpaFromCourses(courses);
    return { courses, tgpa, heading: formatSemesterHeading(termName) };
  }, [q.data, termName]);

  return (
    <div className="res-page">
      <header className="res-topbar">
        <Link to="/app/student/results" className="res-topbar-back">
          ← Back
        </Link>
        <h1 className="res-topbar-title">Result</h1>
        <span style={{ width: 56 }} aria-hidden />
      </header>

      <div className="res-body">
        {q.isLoading ? (
          <div className="muted">Loading…</div>
        ) : q.error ? (
          <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error)}</div>
        ) : !detail ? (
          <div className="res-card-white res-pad">
            <p className="muted" style={{ margin: 0 }}>
              This term has no marks, or the link is invalid.
            </p>
            <Link to="/app/student/results" className="btn secondary" style={{ marginTop: 12, display: 'inline-block' }}>
              All results
            </Link>
          </div>
        ) : (
          <div className="res-card-white res-detail-card">
            <div className="res-detail-head">
              <span>Grades info.</span>
              <span className="res-info-icon" title="Grades combine your assessments for this term; letter grades map to a 4-point scale for TGPA.">
                ⓘ
              </span>
            </div>
            <div className="res-detail-summary">
              <span className="res-accent-strong">{detail.heading}</span>
              <span className="res-accent-strong">TGPA : {detail.tgpa.toFixed(2)}</span>
            </div>
            <div className="res-table-head">
              <span>Course</span>
              <span>Grade</span>
            </div>
            <ul className="res-course-list">
              {detail.courses.map((c) => (
                <li key={c.subjectCode} className="res-course-row">
                  <div className="res-course-title">
                    {c.subjectCode} :: {c.subjectName.toUpperCase()}
                  </div>
                  <div className="res-course-grade-col">
                    <span className={c.letter.pass ? 'res-grade-pill res-grade-pill--pass' : 'res-grade-pill res-grade-pill--fail'}>
                      {c.letter.letter}
                    </span>
                    <span className={c.letter.pass ? 'res-grade-status res-grade-status--pass' : 'res-grade-status res-grade-status--fail'}>
                      {c.letter.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
