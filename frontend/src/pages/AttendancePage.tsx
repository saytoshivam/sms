import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { formatJsonDate, pageContent, pageTotalElements, type SpringPage } from '../lib/apiData';
import { DateKeeper } from '../components/DateKeeper';
import { SmartSelect } from '../components/SmartSelect';
import type { MeProfile } from '../modules/dashboards/SuperAdminDashboard';
import { hasSchoolLeadershipRole } from '../lib/roleGroups';
import { toast } from '../lib/toast';

type MarkStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

type Session = {
  id: number;
  date: string;
  lectureId?: number | null;
  locked?: boolean;
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
  locked: boolean;
  markingWindowOpenNow: boolean;
  students: { studentId: number; admissionNo: string; displayName: string; status: MarkStatus | null }[];
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeSheetStatus(raw: string | null | undefined): MarkStatus | null {
  if (raw === 'PRESENT' || raw === 'ABSENT' || raw === 'LATE' || raw === 'EXCUSED') return raw;
  return null;
}

export function AttendancePage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [classGroupId, setClassGroupId] = useState('');
  const [date, setDate] = useState(() => todayYmd());
  const [lectureId, setLectureId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, MarkStatus>>({});

  const hydrateFromUrl = useCallback(() => {
    const cg = params.get('classGroupId');
    const d = params.get('date');
    const lec = params.get('lectureId');
    if (cg) setClassGroupId(cg);
    if (d && d.length >= 10) setDate(d);
    if (lec !== null && lec !== '') setLectureId(lec);
  }, [params]);

  useEffect(() => {
    hydrateFromUrl();
  }, [hydrateFromUrl]);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeProfile>('/user/me')).data,
  });

  const mode = me.data?.schoolAttendanceMode ?? 'LECTURE_WISE';
  const lectureWise = mode === 'LECTURE_WISE';
  const isLeader = hasSchoolLeadershipRole(me.data?.roles ?? []);

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
    if (!sheet.data) return;
    const next: Record<number, MarkStatus> = {};
    for (const r of sheet.data.students) {
      const s = normalizeSheetStatus(r.status);
      next[r.studentId] = s ?? 'PRESENT';
    }
    setDraft(next);
  }, [sheet.data]);

  const pushUrl = useCallback(
    (next: { classGroupId?: string; date?: string; lectureId?: string | null }) => {
      const p = new URLSearchParams(params);
      if (next.classGroupId !== undefined) {
        if (next.classGroupId) p.set('classGroupId', next.classGroupId);
        else p.delete('classGroupId');
      }
      if (next.date !== undefined) {
        if (next.date) p.set('date', next.date);
        else p.delete('date');
      }
      if (next.lectureId !== undefined) {
        if (next.lectureId) p.set('lectureId', next.lectureId);
        else p.delete('lectureId');
      }
      setParams(p, { replace: true });
    },
    [params, setParams],
  );

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
      pushUrl({ classGroupId, date, lectureId: lectureWise ? lectureId : null });
    },
  });

  const saveMarks = useMutation({
    mutationFn: async ({ editReason }: { editReason?: string | null }) => {
      if (selectedSessionId == null) return;
      const body = Object.entries(draft).map(([studentId, status]) => ({
        studentId: Number(studentId),
        status,
      }));
      const q = editReason && editReason.trim().length > 0 ? `?editReason=${encodeURIComponent(editReason.trim())}` : '';
      await api.post(`/api/attendance/sessions/${selectedSessionId}/marks${q}`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['attendance-sheet', selectedSessionId] });
      toast.success('Saved', 'Attendance saved.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const submitAttendance = useMutation({
    mutationFn: async () => {
      if (selectedSessionId == null) return;
      await api.post(`/api/attendance/sessions/${selectedSessionId}/submit`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['attendance-sheet', selectedSessionId] });
      await qc.invalidateQueries({ queryKey: ['attendance-sessions'] });
      toast.success('Submitted', 'Attendance is locked.');
    },
    onError: (e) => toast.error('Submit failed', formatApiError(e)),
  });

  const groupList = pageContent(classGroups.data);
  const sessionList = pageContent(sessions.data);
  const lectureList = lecturesForDay.data ?? [];

  const canCreateSession =
    Boolean(classGroupId) &&
    date.length >= 10 &&
    (!lectureWise || (lectureId !== '' && !Number.isNaN(Number(lectureId))));

  const markedCount = Object.keys(draft).length;
  const rosterSize = sheet.data?.students.length ?? 0;
  const locked = sheet.data?.locked ?? false;
  const inWindow = sheet.data?.markingWindowOpenNow ?? true;

  const canEditDraft =
    selectedSessionId != null &&
    rosterSize > 0 &&
    markedCount === rosterSize &&
    !saveMarks.isPending &&
    ((locked && isLeader) || (!locked && (mode === 'DAILY' || inWindow || isLeader)));

  const canSubmitNow =
    selectedSessionId != null &&
    rosterSize > 0 &&
    !locked &&
    !submitAttendance.isPending &&
    (mode === 'DAILY' || inWindow || isLeader);

  const markAllPresent = () => {
    if (!sheet.data) return;
    const next: Record<number, MarkStatus> = {};
    for (const r of sheet.data.students) {
      next[r.studentId] = 'PRESENT';
    }
    setDraft(next);
  };

  const onSaveClick = () => {
    if (locked && isLeader) {
      const reason = window.prompt('Reason for editing locked attendance (required):');
      if (reason === null) return;
      if (reason.trim().length < 4) {
        toast.error('Reason required', 'Please enter at least a few characters.');
        return;
      }
      saveMarks.mutate({ editReason: reason });
      return;
    }
    saveMarks.mutate({});
  };

  return (
    <div className="attendance-staff-page">
      <header className="attendance-staff-head">
        <h1 className="attendance-staff-title">Attendance</h1>
        <p className="attendance-staff-lead">
          {lectureWise ? (
            <>
              Your school uses <strong>lecture-wise</strong> attendance: each published period has its own roll. Default is{' '}
              <strong>all present</strong> until you change it. <strong>Submit</strong> locks the sheet; late edits need a reason
              (school leaders) and are audited.
            </>
          ) : (
            <>
              Your school uses <strong>daily</strong> attendance: the class teacher records one roll per section per day. Default is{' '}
              <strong>all present</strong>. Submit locks the sheet.
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
                <SmartSelect
                  value={classGroupId}
                  onChange={(v) => {
                    setClassGroupId(v);
                    setLectureId('');
                    pushUrl({ classGroupId: v, lectureId: null });
                  }}
                  placeholder="Select…"
                  options={groupList.map((cg) => ({ value: String(cg.id), label: cg.displayName }))}
                />
                {classGroups.error ? (
                  <div className="attendance-field-error">{formatApiError(classGroups.error)}</div>
                ) : null}
              </div>
              <div className="stack lecture-schedule-field lecture-schedule-field--date">
                <label htmlFor="attendance-date">Date</label>
                <DateKeeper
                  id="attendance-date"
                  value={date}
                  onChange={(v) => {
                    setDate(v);
                    setLectureId('');
                    pushUrl({ date: v, lectureId: null });
                  }}
                />
              </div>
              {lectureWise ? (
                <div className="stack lecture-schedule-field lecture-schedule-field--grow" style={{ minWidth: 220 }}>
                  <label htmlFor="attendance-lecture">Lecture (period)</label>
                  <SmartSelect
                    id="attendance-lecture"
                    value={lectureId}
                    onChange={(v) => {
                      setLectureId(v);
                      pushUrl({ lectureId: v || null });
                    }}
                    placeholder="Select a lecture…"
                    disabled={!classGroupId || lecturesForDay.isLoading}
                    options={lectureList.map((row) => ({
                      value: String(row.id),
                      label: `${row.startTime?.slice(0, 5)}–${row.endTime?.slice(0, 5)} · ${row.subject}${row.teacherName ? ` · ${row.teacherName}` : ''}`,
                    }))}
                  />
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
                <button type="submit" className="btn student-attendance-primary-btn" disabled={createSession.isPending || !canCreateSession}>
                  {createSession.isPending ? 'Creating…' : 'Create / open session'}
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
                        {s.locked ? <span> · Locked</span> : null}
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
            {locked ? (
              <span className="student-tt-tag" title="Marks are frozen">
                Locked
              </span>
            ) : null}
            {lectureWise && sheet.data && !inWindow && !isLeader ? (
              <span className="student-tt-tag" title="Open during the lesson window plus grace period">
                Outside marking window
              </span>
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
                      · {markedCount} of {sheet.data.students.length} in draft
                    </span>
                  )}
                </p>
                {sheet.data.students.length === 0 ? null : (
                  <>
                    <div className="attendance-save-row row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <button type="button" className="btn" disabled={locked && !isLeader} onClick={markAllPresent}>
                        Mark all present
                      </button>
                    </div>
                    <div className="attendance-mark-list">
                      {sheet.data.students.map((row) => (
                        <div key={row.studentId} className="attendance-mark-row">
                          <div className="attendance-mark-row__who">
                            <div className="attendance-mark-row__name">{row.displayName}</div>
                            <div className="muted attendance-mark-row__adm">{row.admissionNo}</div>
                          </div>
                          <div className="attendance-mark-toggle" role="group" aria-label={`Attendance for ${row.displayName}`}>
                            {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                className={
                                  draft[row.studentId] === st
                                    ? `attendance-pill attendance-pill--${st === 'EXCUSED' ? 'excused' : st.toLowerCase()} attendance-pill--active`
                                    : `attendance-pill attendance-pill--${st === 'EXCUSED' ? 'excused' : st.toLowerCase()}`
                                }
                                disabled={locked && !isLeader}
                                onClick={() => setDraft((d) => ({ ...d, [row.studentId]: st }))}
                              >
                                {st === 'EXCUSED' ? 'Leave' : st.charAt(0) + st.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="attendance-save-row row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <button type="button" className="btn" disabled={!canEditDraft} onClick={onSaveClick}>
                        {saveMarks.isPending ? 'Saving…' : locked && isLeader ? 'Save override' : 'Save draft'}
                      </button>
                      <button type="button" className="btn student-attendance-primary-btn" disabled={!canSubmitNow} onClick={() => submitAttendance.mutate()}>
                        {submitAttendance.isPending ? 'Submitting…' : 'Submit & lock'}
                      </button>
                      {saveMarks.error ? (
                        <span className="attendance-field-error">{formatApiError(saveMarks.error)}</span>
                      ) : null}
                      {submitAttendance.error ? (
                        <span className="attendance-field-error">{formatApiError(submitAttendance.error)}</span>
                      ) : null}
                    </div>
                    {locked && !isLeader ? (
                      <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                        This roll is locked. Ask a school leader if a correction is required.
                      </p>
                    ) : null}
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
  return `Period · #${lectureId}`;
}
