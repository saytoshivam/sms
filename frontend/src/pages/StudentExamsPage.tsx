import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type StudentExamCard = {
  layout: string;
  headerLeft: string | null;
  headerTitle: string;
  headerSession: string | null;
  headerFormat: string | null;
  subjectNameCaps: string;
  examDate: string;
  startTime: string;
  endTime: string;
  room: string;
};

function formatExamDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatClock(iso: string) {
  if (!iso) return '';
  return iso.length >= 5 ? iso.slice(0, 5) : iso;
}

export function StudentExamsPage() {
  const q = useQuery({
    queryKey: ['student-exams'],
    queryFn: async () => (await api.get<StudentExamCard[]>('/api/v1/student/me/exams')).data,
  });

  return (
    <div className="exam-page">
      <header className="exam-topbar">
        <h1 className="exam-topbar-title">Exams Available</h1>
      </header>

      <div className="exam-body">
        {q.isLoading ? (
          <div className="exam-muted">Loading…</div>
        ) : q.error ? (
          <div className="exam-err">{String((q.error as any)?.response?.data ?? q.error)}</div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="exam-card exam-card--empty">
            <p className="exam-muted" style={{ margin: 0 }}>
              No published exams yet. When your school schedules papers, they will appear here.
            </p>
          </div>
        ) : (
          <ul className="exam-list">
            {(q.data ?? []).map((ex, i) => (
              <li key={`${ex.examDate}-${ex.headerTitle}-${i}`} className="exam-card">
                <div className={`exam-card-head ${ex.layout === 'COMBINED' ? 'exam-card-head--combined' : ''}`}>
                  {ex.layout === 'COMBINED' ? (
                    <div className="exam-head-combined">{ex.headerTitle}</div>
                  ) : (
                    <>
                      <span className="exam-head-code">{ex.headerLeft}</span>
                      <div className="exam-head-right">
                        <div className="exam-head-title">{ex.headerTitle}</div>
                        {ex.headerSession ? <div className="exam-head-session">{ex.headerSession}</div> : null}
                        {ex.headerFormat ? <div className="exam-head-format">{ex.headerFormat}</div> : null}
                      </div>
                    </>
                  )}
                </div>
                <div className="exam-card-body">
                  {ex.subjectNameCaps?.trim() ? (
                    <div className="exam-subject-caps">{ex.subjectNameCaps}</div>
                  ) : null}
                  <div className="exam-row-datetime">
                    <span className="exam-date-badge">Exam Date: {formatExamDate(ex.examDate)}</span>
                    <span className="exam-room">Room No : {ex.room}</span>
                  </div>
                  <div className="exam-row-time">
                    <span className="exam-clock" aria-hidden>
                      🕐
                    </span>
                    <span className="exam-time-text">
                      Exam Time {formatClock(ex.startTime)}–{formatClock(ex.endTime)} (Reporting Time 30 mins before the
                      start of exam)
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
