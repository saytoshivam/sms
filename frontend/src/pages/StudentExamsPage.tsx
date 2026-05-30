import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type StudentExamDTO = {
  id: number;
  assessmentName: string;
  componentName: string;
  componentType: string;
  schemeName: string;
  subjectName: string;
  subjectCode: string | null;
  classGroupLabel: string;
  academicYearLabel: string;
  assessmentDate: string | null;
  startTime: string | null;
  endTime: string | null;
  roomLabel: string | null;
  maxMarks: number;
  status: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return '';
  return end ? `${start} \u2013 ${end}` : start;
}

type StatusInfo = { label: string; bg: string; color: string };
function statusInfo(s: string): StatusInfo {
  switch (s) {
    case 'SCHEDULED':        return { label: 'Scheduled',    bg: '#dbeafe', color: '#1d4ed8' };
    case 'MARKS_ENTRY_OPEN': return { label: 'Marks Open',   bg: '#fef9c3', color: '#854d0e' };
    case 'MARKS_SUBMITTED':  return { label: 'Submitted',    bg: '#ede9fe', color: '#5b21b6' };
    case 'LOCKED':           return { label: 'Locked',       bg: '#dcfce7', color: '#15803d' };
    case 'PUBLISHED':        return { label: 'Published',    bg: '#d1fae5', color: '#065f46' };
    default:                 return { label: s,              bg: '#f1f5f9', color: '#475569' };
  }
}

function componentTypeLabel(t: string): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ────────────────────────────────────────────────────────────────

export function StudentExamsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ['student-exams-v2'],
    queryFn: async () => (await api.get<StudentExamDTO[]>('/api/v1/student/me/exams')).data,
  });

  const exams = q.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = exams.filter((e) => !e.assessmentDate || e.assessmentDate >= today);
  const past     = exams.filter((e) =>  e.assessmentDate != null && e.assessmentDate < today);

  function ExamCard({ ex }: { ex: StudentExamDTO }) {
    const si = statusInfo(ex.status);
    const isExpanded = expandedId === ex.id;
    return (
      <li className="exam-card">
        <div
          className="exam-card-head"
          style={{ cursor: 'pointer', background: 'linear-gradient(95deg, #1e293b 0%, #334155 100%)' }}
          onClick={() => setExpandedId(isExpanded ? null : ex.id)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f8fafc', marginBottom: 2 }}>
              {ex.subjectName}
              {ex.subjectCode ? <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, color: '#94a3b8' }}>({ex.subjectCode})</span> : null}
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>
              {ex.assessmentName}
              <span style={{ margin: '0 6px', color: '#475569' }}>\u00b7</span>
              {componentTypeLabel(ex.componentType)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <span style={{ background: si.bg, color: si.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              {si.label}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{isExpanded ? '\u25b2' : '\u25bc'}</span>
          </div>
        </div>

        <div className="exam-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 13 }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Date</div>
              <div style={{ fontWeight: 700, marginTop: 1 }}>{formatDate(ex.assessmentDate)}</div>
            </div>
            {ex.startTime ? (
              <div>
                <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Time</div>
                <div style={{ fontWeight: 700, marginTop: 1 }}>{formatTimeRange(ex.startTime, ex.endTime)}</div>
              </div>
            ) : null}
            <div>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Max Marks</div>
              <div style={{ fontWeight: 700, marginTop: 1 }}>{ex.maxMarks}</div>
            </div>
            {ex.roomLabel ? (
              <div>
                <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Room</div>
                <div style={{ fontWeight: 700, marginTop: 1 }}>{ex.roomLabel}</div>
              </div>
            ) : null}
          </div>

          {isExpanded ? (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(15,23,42,0.1)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12 }}><span style={{ color: '#64748b', fontWeight: 600 }}>Scheme: </span>{ex.schemeName}</div>
              <div style={{ fontSize: 12 }}><span style={{ color: '#64748b', fontWeight: 600 }}>Component: </span>{ex.componentName}</div>
              <div style={{ fontSize: 12 }}><span style={{ color: '#64748b', fontWeight: 600 }}>Academic Year: </span>{ex.academicYearLabel}</div>
              <div style={{ fontSize: 12 }}><span style={{ color: '#64748b', fontWeight: 600 }}>Class: </span>{ex.classGroupLabel}</div>
              {ex.startTime ? (
                <div style={{ fontSize: 12, marginTop: 4, color: '#475569' }}>
                  \uD83D\uDD50 Report 30 minutes before the start of the exam.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div className="exam-page">
      <header className="exam-topbar">
        <h1 className="exam-topbar-title">Exams &amp; Assessments</h1>
      </header>

      <div className="exam-body">
        {q.isLoading ? (
          <div className="exam-muted">Loading\u2026</div>
        ) : q.isError ? (
          <div className="exam-err">
            {String((q.error as { response?: { data?: unknown } })?.response?.data ?? q.error)}
          </div>
        ) : exams.length === 0 ? (
          <div className="exam-card exam-card--empty">
            <p className="exam-muted" style={{ margin: 0 }}>
              No assessments scheduled yet. When your school schedules exams, they will appear here.
            </p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <>
                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  Upcoming ({upcoming.length})
                </div>
                <ul className="exam-list" style={{ marginBottom: 20 }}>
                  {upcoming.map((ex) => <ExamCard key={ex.id} ex={ex} />)}
                </ul>
              </>
            ) : null}
            {past.length > 0 ? (
              <>
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  Past ({past.length})
                </div>
                <ul className="exam-list">
                  {past.map((ex) => <ExamCard key={ex.id} ex={ex} />)}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
