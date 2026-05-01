import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { formatJsonDate } from '../lib/apiData';
import { SmartSelect } from '../components/SmartSelect';

export type StudentProgressRow = {
  studentId: number;
  admissionNo: string;
  fullName: string;
  classGroupName: string;
  joinedOn: string;
  attendancePercentSinceJoin: number;
  averageScorePercentSinceJoin: number;
  marksCountSinceJoin: number;
};

export function ClassProgressPage() {
  const [classNameFilter, setClassNameFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const progress = useQuery({
    queryKey: ['teacher-class-progress'],
    queryFn: async () => (await api.get<StudentProgressRow[]>('/api/v1/teacher/students/progress')).data,
  });

  const classOptions = useMemo(() => {
    const names = new Set((progress.data ?? []).map((r) => r.classGroupName).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [progress.data]);

  const filteredRows = useMemo(() => {
    const list = progress.data ?? [];
    const needle = studentSearch.trim().toLowerCase();
    return list.filter((r) => {
      if (classNameFilter && r.classGroupName !== classNameFilter) return false;
      if (!needle) return true;
      return (
        r.fullName.toLowerCase().includes(needle) ||
        r.admissionNo.toLowerCase().includes(needle) ||
        r.classGroupName.toLowerCase().includes(needle)
      );
    });
  }, [progress.data, classNameFilter, studentSearch]);

  return (
    <div className="workspace-feature-page stack">
      <h2 className="workspace-feature-page__title">Class progress</h2>
      <p className="workspace-feature-page__lead">
        Attendance and scores are counted from each student’s enrollment date (when their profile was created in this
        school).
      </p>

      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px', minWidth: 160 }} className="stack">
            <label>Class name</label>
            <SmartSelect
              value={classNameFilter}
              onChange={setClassNameFilter}
              allowClear
              clearLabel="All classes"
              placeholder="All classes"
              options={classOptions.map((name) => ({ value: name, label: name }))}
            />
          </div>
          <div style={{ flex: '2 1 240px', minWidth: 200 }} className="stack">
            <label>Search student</label>
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Name or admission no."
            />
          </div>
          <div className="muted" style={{ fontSize: 13, paddingBottom: 4 }}>
            Showing {filteredRows.length} of {(progress.data ?? []).length}
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {progress.isLoading ? (
          <div>Loading…</div>
        ) : progress.error ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(progress.error)}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Joined</th>
                <th>Attendance</th>
                <th>Avg score</th>
                <th>Marks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.studentId}>
                  <td>
                    <strong>{r.fullName}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.admissionNo}
                    </div>
                  </td>
                  <td>{r.classGroupName}</td>
                  <td>{formatJsonDate(r.joinedOn as unknown)}</td>
                  <td>{r.attendancePercentSinceJoin.toFixed(1)}%</td>
                  <td>{r.averageScorePercentSinceJoin.toFixed(1)}%</td>
                  <td>{r.marksCountSinceJoin}</td>
                  <td>
                    <Link
                      className="btn secondary"
                      style={{ padding: '6px 10px', fontSize: 13 }}
                      to={`/app/students/${r.studentId}/performance?sinceJoin=true`}
                    >
                      Charts
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
