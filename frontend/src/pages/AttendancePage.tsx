import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { formatJsonDate, pageContent, pageTotalElements, type SpringPage } from '../lib/apiData';
import { DateKeeper } from '../components/DateKeeper';
import type { MeProfile } from '../modules/dashboards/SuperAdminDashboard';
import { toast } from '../lib/toast';

type Session = {
  id: number;
  date: string;
  lectureId?: number | null;
  classGroup?: { id: number; displayName: string } | null;
};
type ClassGroup = { id: number; displayName: string };
type LectureRow = { id: number; startTime: string; endTime: string; subject: string; teacherName: string | null };

type AttendanceSessionSheet = {
  sessionId: number;
  date: string;
  classGroupDisplayName: string;
  lectureId: number | null;
  lectureSummary: string | null;
  students: { studentId: number; admissionNo: string; displayName: string; status: 'PRESENT' | 'ABSENT' | null }[];
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AttendancePage() {
  const qc = useQueryClient();
  const [classGroupId, setClassGroupId] = useState('');
  const [date, setDate] = useState(() => todayYmd());
  const [lectureId, setLectureId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  /** studentId → PRESENT | ABSENT */
  const [draft, setDraft] = useState<Record<number, 'PRESENT' | 'ABSENT'>>({});

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeProfile>('/user/me')).data,
  });

  const mode = me.data?.schoolAttendanceMode ?? 'LECTURE_WISE';
  const lectureWise = mode === 'LECTURE_WISE';

  const sessionsParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('size', '100');
    p.set('sort', 'id,desc');
    if (classGroupId) p.set('classGroupId', classGroupId);
    if (date.length >= 10) p.set('date', date);
    return p.toString();
  }, [classGroupId, date]);

  const sessions = useQuery({
    queryKey: ['attendance-sessions', classGroupId, date],
    queryFn: async () =>
      (await api.get<SpringPage<Session> | Session[]>(`/api/attendance/sessions?${sessionsParams}`)).data,
  });

  const classGroups = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () =>
      (await api.get<SpringPage<ClassGroup> | ClassGroup[]>('/api/class-groups?size=200')).data,
  });

  const cgNum = classGroupId ? Number(classGroupId) : NaN;
  const lecturesForDay = useQuery({
    queryKey: ['lectures-by-class-date', cgNum, date],
    queryFn: async () =>
      (
        await api.get<LectureRow[]>(
          `/api/lectures/by-class-date?classGroupId=${cgNum}&date=${encodeURIComponent(date)}`,
        )
      ).data,
    enabled: lectureWise && Number.isFinite(cgNum) && date.length >= 10,
  });

  const sheet = useQuery({
    queryKey: ['attendance-sheet', selectedSessionId],
    queryFn: async () =>
      (await api.get<AttendanceSessionSheet>(`/api/attendance/sessions/${selectedSessionId}/sheet`)).data,
    enabled: selectedSessionId != null,
  });

  useEffect(() => {
    setLectureId('');
  }, [classGroupId, date, lectureWise]);

  useEffect(() => {
    if (!sheet.data) return;
    const next: Record<number, 'PRESENT' | 'ABSENT'> = {};
    for (const r of sheet.data.students) {
      if (r.status === 'PRESENT' || r.status === 'ABSENT') {
        next[r.studentId] = r.status;
      }
    }
    setDraft(next);
  }, [sheet.data]);

  const createSession = useMutation({
    mutationFn: async () => {
      const body: { classGroupId: number; date: string; lectureId?: number } = {
        classGroupId: Number(classGroupId),
        date,
      };
      if (lectureWise) {
        body.lectureId = Number(lectureId);
      }
      return (await api.post<Session>('/api/attendance/sessions', body)).data;
    },
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['attendance-sessions'] });
      setSelectedSessionId(created.id);
    },
  });

  const saveMarks = useMutation({
    mutationFn: async () => {
      if (selectedSessionId == null) return;
      const body = Object.entries(draft).map(([studentId, status]) => ({
        studentId: Number(studentId),
        status,
      }));
      await api.post(`/api/attendance/sessions/${selectedSessionId}/marks`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['attendance-sheet', selectedSessionId] });
      toast.success('Saved', 'Attendance saved.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const groupList = pageContent(classGroups.data);
  const sessionList = pageContent(sessions.data);
  const lectureList = lecturesForDay.data ?? [];

  const canSubmit =
    Boolean(classGroupId) &&
    date.length >= 10 &&
    (!lectureWise || (lectureId !== '' && !Number.isNaN(Number(lectureId))));

  const markedCount = Object.keys(draft).length;
  const rosterSize = sheet.data?.students.length ?? 0;
  const canSaveMarks = selectedSessionId != null && rosterSize > 0 && markedCount > 0 && !saveMarks.isPending;

  return (
    <div className="attendance-staff-page">
      <header className="attendance-staff-head">
        <h1 className="attendance-staff-title">Attendance</h1>
        <p className="attendance-staff-lead">
          {lectureWise ? (
            <>
              Open a session for a class period, then mark each student <strong>present</strong> or <strong>absent</strong>{' '}
              for that period. Only the teacher for that slot (or a school leader) can record it.
            </>
          ) : (
            <>
              Open a daily session for a class, then mark each student <strong>present</strong> or <strong>absent</strong> for
              the whole day.
            </>
          )}
        </p>
      </header>

      <section className="student-tt-section" aria-labelledby="attendance-open-label">
        <div className="student-tt-head">
          <span className="student-tt-title" id="attendance-open-label">
            Open a session
          </span>
          {me.data?.schoolName ? (
            <span className="student-tt-tag" title={me.data.schoolName}>
              {me.data.schoolName}
            </span>
          ) : null}
        </div>
        <div className="student-tt-body">
          <form
            className="stack attendance-open-form"
            onSubmit={(e) => {
              e.preventDefault();
              createSession.mutate();
            }}
          >
            <div className="lecture-schedule-form__row">
              <div className="stack lecture-schedule-field lecture-schedule-field--grow" style={{ minWidth: 200 }}>
                <label>Class group</label>
                <select value={classGroupId} onChange={(e) => setClassGroupId(e.target.value)}>
                  <option value="">Select…</option>
                  {groupList.map((cg) => (
                    <option key={cg.id} value={cg.id}>
                      {cg.displayName}
                    </option>
                  ))}
                </select>
                {classGroups.error ? (
                  <div className="attendance-field-error">{formatApiError(classGroups.error)}</div>
                ) : null}
              </div>
              <div className="stack lecture-schedule-field lecture-schedule-field--date">
                <label htmlFor="attendance-date">Date</label>
                <DateKeeper id="attendance-date" value={date} onChange={setDate} />
              </div>
              {lectureWise ? (
                <div className="stack lecture-schedule-field lecture-schedule-field--grow" style={{ minWidth: 220 }}>
                  <label htmlFor="attendance-lecture">Lecture (period)</label>
                  <select
                    id="attendance-lecture"
                    value={lectureId}
                    onChange={(e) => setLectureId(e.target.value)}
                    disabled={!classGroupId || lecturesForDay.isLoading}
                  >
                    <option value="">Select a lecture…</option>
                    {lectureList.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.startTime?.slice(0, 5)}–{row.endTime?.slice(0, 5)} · {row.subject}
                        {row.teacherName ? ` · ${row.teacherName}` : ''}
                      </option>
                    ))}
                  </select>
                  {lecturesForDay.error ? (
                    <div className="attendance-field-error">{formatApiError(lecturesForDay.error)}</div>
                  ) : null}
                  {lectureWise && classGroupId && !lecturesForDay.isLoading && lectureList.length === 0 ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      No lectures scheduled for this class on this date.
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div style={{ alignSelf: 'end' }}>
                <button type="submit" className="btn student-attendance-primary-btn" disabled={createSession.isPending || !canSubmit}>
                  {createSession.isPending ? 'Creating…' : 'Create session'}
                </button>
              </div>
            </div>
          </form>
          {createSession.error ? <div className="attendance-field-error">{formatApiError(createSession.error)}</div> : null}
        </div>
      </section>

      <section className="student-tt-section" aria-labelledby="attendance-sessions-label">
        <div className="student-tt-head">
          <span className="student-tt-title" id="attendance-sessions-label">
            Sessions
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            Filtered by class &amp; date when selected above · Total: {pageTotalElements(sessions.data)}
          </span>
        </div>
        <div className="student-tt-body">
          {sessions.isLoading ? (
            <div className="muted">Loading…</div>
          ) : sessions.error ? (
            <div className="attendance-field-error">{formatApiError(sessions.error)}</div>
          ) : sessionList.length === 0 ? (
            <div className="muted student-tt-empty">No sessions for this filter.</div>
          ) : (
            <ul className="attendance-session-list">
              {sessionList.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={
                      selectedSessionId === s.id ? 'attendance-session-row attendance-session-row--selected' : 'attendance-session-row'
                    }
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <span className="attendance-session-row__main">
                      <strong>{formatJsonDate(s.date as unknown)}</strong>
                      <span className="muted">
                        {' '}
                        · {s.classGroup?.displayName ?? 'Class'}
                        {s.lectureId != null ? (
                          <span> · {formatLectureHint(s.lectureId)}</span>
                        ) : (
                          <span> · Full day</span>
                        )}
                      </span>
                    </span>
                    <span className="attendance-session-row__id">#{s.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {selectedSessionId != null ? (
        <section className="student-tt-section" aria-labelledby="attendance-mark-label">
          <div className="student-tt-head">
            <span className="student-tt-title" id="attendance-mark-label">
              Mark attendance
            </span>
            {sheet.data?.lectureSummary ? (
              <span className="student-tt-tag" title={sheet.data.lectureSummary}>
                {sheet.data.lectureSummary}
              </span>
            ) : sheet.data && !sheet.data.lectureId ? (
              <span className="student-tt-tag">Full day</span>
            ) : null}
          </div>
          <div className="student-tt-body">
            {sheet.isLoading ? (
              <div className="muted">Loading roster…</div>
            ) : sheet.error ? (
              <div className="attendance-field-error">{formatApiError(sheet.error)}</div>
            ) : !sheet.data ? null : (
              <>
                <p className="muted attendance-mark-meta">
                  {sheet.data.classGroupDisplayName} · {formatJsonDate(sheet.data.date as unknown)}
                  {sheet.data.students.length === 0 ? (
                    <span> — no students in this class yet.</span>
                  ) : (
                    <span>
                      {' '}
                      · {markedCount} of {sheet.data.students.length} marked
                    </span>
                  )}
                </p>
                {sheet.data.students.length === 0 ? null : (
                  <>
                    <div className="attendance-mark-list">
                      {sheet.data.students.map((row) => (
                        <div key={row.studentId} className="attendance-mark-row">
                          <div className="attendance-mark-row__who">
                            <div className="attendance-mark-row__name">{row.displayName}</div>
                            <div className="muted attendance-mark-row__adm">{row.admissionNo}</div>
                          </div>
                          <div className="attendance-mark-toggle" role="group" aria-label={`Attendance for ${row.displayName}`}>
                            <button
                              type="button"
                              className={
                                draft[row.studentId] === 'PRESENT'
                                  ? 'attendance-pill attendance-pill--present attendance-pill--active'
                                  : 'attendance-pill attendance-pill--present'
                              }
                              onClick={() => setDraft((d) => ({ ...d, [row.studentId]: 'PRESENT' }))}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              className={
                                draft[row.studentId] === 'ABSENT'
                                  ? 'attendance-pill attendance-pill--absent attendance-pill--active'
                                  : 'attendance-pill attendance-pill--absent'
                              }
                              onClick={() => setDraft((d) => ({ ...d, [row.studentId]: 'ABSENT' }))}
                            >
                              Absent
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="attendance-save-row">
                      <button type="button" className="btn student-attendance-primary-btn" disabled={!canSaveMarks} onClick={() => saveMarks.mutate()}>
                        {saveMarks.isPending ? 'Saving…' : 'Save attendance'}
                      </button>
                      {saveMarks.error ? (
                        <span className="attendance-field-error">{formatApiError(saveMarks.error)}</span>
                      ) : null}
                      {saveMarks.isSuccess && !saveMarks.isPending ? null : null}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatLectureHint(lectureId: number) {
  return `Period · lecture #${lectureId}`;
}
