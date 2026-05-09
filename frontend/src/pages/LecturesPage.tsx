import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { draftOverlapsBusy, LectureDayTimeline, type TimelineBusyBlock } from '../components/LectureDayTimeline';
import { DateKeeper } from '../components/DateKeeper';
import { TimeKeeper } from '../components/TimeKeeper';
import { WorkspaceHero } from '../components/workspace/WorkspaceKit';
import { ClassGroupSearchCombobox, useClassGroupsCatalog } from '../components/ClassGroupSearchCombobox';
import { SubjectSearchCombobox } from '../components/SubjectSearchCombobox';
import type { MeProfile } from '../modules/dashboards/SuperAdminDashboard';
import { isWorkspaceReadOnly, WorkspaceReadOnlyRibbon } from '../lib/workspaceViewMode';

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function LecturesPage() {
  const [searchParams] = useSearchParams();
  const readOnly = isWorkspaceReadOnly(searchParams);

  const qc = useQueryClient();
  const [classGroupId, setClassGroupId] = useState('');
  const [date, setDate] = useState(() => todayYmd());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [room, setRoom] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);

  const cgNum = classGroupId ? Number(classGroupId) : NaN;

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeProfile>('/user/me')).data,
  });

  const classGroupsCatalog = useClassGroupsCatalog();

  const dayPreview = useQuery({
    queryKey: ['lectures-day-preview', cgNum, date],
    queryFn: async () => (await api.get<TimelineBusyBlock[]>(`/api/lectures/by-class-date?classGroupId=${cgNum}&date=${encodeURIComponent(date)}`)).data,
    enabled: Number.isFinite(cgNum) && date.length >= 10,
  });

  const draftConflict = useMemo(() => {
    if (!startTime || !endTime) return undefined;
    const busy = dayPreview.data ?? [];
    return draftOverlapsBusy(startTime, endTime, busy);
  }, [startTime, endTime, dayPreview.data]);

  const timesInvalid = useMemo(() => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const s = sh * 60 + (sm || 0);
    const e = eh * 60 + (em || 0);
    return s >= e;
  }, [startTime, endTime]);

  const needsPreview = Number.isFinite(cgNum) && date.length >= 10;
  const previewReady = !needsPreview || dayPreview.isSuccess;

  const staffDisplay = me.data?.linkedStaffDisplayName?.trim() ?? '';
  const bookingAsStaff = me.data?.linkedStaffId != null;

  const teacherRoleWithoutStaff = useMemo(() => {
    const roles = me.data?.roles ?? [];
    const isTeacherRole = roles.some((r) => r === 'TEACHER' || r === 'CLASS_TEACHER');
    return isTeacherRole && me.data?.linkedStaffId == null;
  }, [me.data]);

  useEffect(() => {
    if (bookingAsStaff && staffDisplay) {
      setTeacherName(staffDisplay);
    }
  }, [bookingAsStaff, staffDisplay]);

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/api/lectures', {
          classGroupId: Number(classGroupId),
          date,
          startTime,
          endTime,
          subject,
          teacherName: bookingAsStaff ? staffDisplay || null : teacherName || null,
          room: room || null,
        })
      ).data,
    onMutate: () => {
      setCreateSuccess(false);
    },
    onSuccess: async () => {
      setSubject('');
      setTeacherName('');
      setRoom('');
      setCreateSuccess(true);
      await qc.invalidateQueries({ queryKey: ['lectures-day-preview', cgNum, date] });
    },
  });

  useEffect(() => {
    if (!createSuccess) return;
    const t = window.setTimeout(() => setCreateSuccess(false), 8000);
    return () => window.clearTimeout(t);
  }, [createSuccess]);

  const canSubmit =
    Boolean(classGroupId) &&
    Boolean(date) &&
    Boolean(subject.trim()) &&
    !timesInvalid &&
    previewReady &&
    (needsPreview ? !draftConflict : true) &&
    !createMutation.isPending &&
    !teacherRoleWithoutStaff &&
    me.isSuccess;

  return (
    <div className="workspace-feature-page lecture-schedule-page stack">
      <WorkspaceHero
        eyebrow="Scheduling"
        title="Lectures"
        tag="One-off"
        subtitle={
          readOnly ? (
            <>Browse mode — lecture booking is locked. Use Operations hub → Lectures to schedule.</>
          ) : (
            <>
              Book a session for a class on a chosen day. The timeline shows what is already scheduled (busy blocks).
              If your login is linked to a staff profile, the lecture is always booked for you only.
            </>
          )
        }
      />
      {classGroupsCatalog.isError ? (
        <div className="lecture-schedule-alert">
          <strong>Could not load classes.</strong> {formatApiError(classGroupsCatalog.error)}
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
            School users: if you just updated the app, <strong>sign out and sign in again</strong> so your session
            includes your school. Platform-only accounts need a school-linked login to use this page.
          </p>
        </div>
      ) : null}
      {readOnly ? (
        <div className="card stack" style={{ padding: 16 }}>
          <WorkspaceReadOnlyRibbon title="Lectures — scheduling disabled here" />
        </div>
      ) : (
      <div className="workspace-panel lecture-schedule-panel">
        <form
          className="stack lecture-schedule-form theme-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            createMutation.mutate();
          }}
        >
          <div className="lecture-schedule-form__row">
            <div className="stack lecture-schedule-field lecture-schedule-field--grow">
              <label htmlFor="lecture-class-group">Class group</label>
              <ClassGroupSearchCombobox
                id="lecture-class-group"
                value={classGroupId}
                onChange={setClassGroupId}
                placeholder="Search or pick a class…"
              />
            </div>
            <div className="stack lecture-schedule-field lecture-schedule-field--date">
              <label htmlFor="lecture-date">Date</label>
              <DateKeeper id="lecture-date" value={date} onChange={setDate} />
            </div>
          </div>

          {Number.isFinite(cgNum) && date ? (
            <div className="lecture-day-preview">
              <div className="lecture-day-preview__head">
                <span className="lecture-day-preview__title">Day timeline</span>
                <span className="lecture-day-preview__hint">Hover a busy block for subject &amp; teacher</span>
              </div>
              <div className="lecture-day-preview__body">
                {dayPreview.isLoading ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Loading day schedule…
                  </div>
                ) : dayPreview.error ? (
                  <div style={{ color: '#b91c1c', fontSize: 13 }}>{formatApiError(dayPreview.error)}</div>
                ) : (
                  <LectureDayTimeline busy={dayPreview.data ?? []} draftStart={startTime} draftEnd={endTime} />
                )}
              </div>
            </div>
          ) : (
            <p className="muted lecture-schedule-placeholder">Choose a class and date to see the day timeline.</p>
          )}

          <div className="lecture-schedule-form__row lecture-schedule-form__row--times">
            <div className="stack lecture-schedule-field">
              <label htmlFor="lecture-start">Start</label>
              <TimeKeeper id="lecture-start" value={startTime} onChange={setStartTime} />
            </div>
            <div className="stack lecture-schedule-field">
              <label htmlFor="lecture-end">End</label>
              <TimeKeeper id="lecture-end" value={endTime} onChange={setEndTime} />
            </div>
            <div className="stack lecture-schedule-field lecture-schedule-field--grow">
              <label htmlFor="lecture-subject">Subject</label>
              <SubjectSearchCombobox
                id="lecture-subject"
                value={subject}
                onChange={setSubject}
                placeholder="Search or pick a subject…"
              />
            </div>
          </div>
          {teacherRoleWithoutStaff ? (
            <div className="lecture-schedule-alert">
              Your account has a teacher role but is not linked to a staff profile. Ask a school admin to link your
              login before you can schedule one-off lectures.
            </div>
          ) : null}
          <div className="lecture-schedule-form__row">
            <div className="stack lecture-schedule-field lecture-schedule-field--grow">
              <label htmlFor="lecture-teacher">{bookingAsStaff ? 'Teacher (you)' : 'Teacher (optional)'}</label>
              <input
                id="lecture-teacher"
                value={bookingAsStaff ? staffDisplay : teacherName}
                onChange={(e) => {
                  if (!bookingAsStaff) setTeacherName(e.target.value);
                }}
                readOnly={bookingAsStaff}
                placeholder={bookingAsStaff ? undefined : 'e.g. Rahul Verma'}
                title={bookingAsStaff ? 'One-off lectures use your linked staff name' : undefined}
              />
              {bookingAsStaff ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  Saved as your staff profile — cannot book for another teacher.
                </span>
              ) : null}
            </div>
            <div className="stack lecture-schedule-field lecture-schedule-field--grow">
              <label htmlFor="lecture-room">Room (optional)</label>
              <input id="lecture-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Lab 2" />
            </div>
          </div>

          {timesInvalid ? (
            <div className="lecture-schedule-alert">End time must be after start time.</div>
          ) : draftConflict ? (
            <div className="lecture-schedule-alert">
              This slot overlaps an existing lecture: <strong>{draftConflict.subject}</strong>
              {(draftConflict.teacherName ?? '').trim() ? (
                <>
                  {' '}
                  · <strong>{(draftConflict.teacherName ?? '').trim()}</strong>
                </>
              ) : null}{' '}
              ({draftConflict.startTime.slice(0, 5)}–{draftConflict.endTime.slice(0, 5)}). Choose a free time on the bar
              above.
            </div>
          ) : previewReady && needsPreview && !timesInvalid && startTime && endTime ? (
            <div className="lecture-schedule-alert lecture-schedule-alert--ok">
              This slot is free — no overlapping lecture for this class on this date.
            </div>
          ) : null}

          {createMutation.error ? (
            <div className="lecture-schedule-alert">{formatApiError(createMutation.error)}</div>
          ) : null}

          <div className="lecture-schedule-actions">
            <button type="submit" className="btn lecture-schedule-submit" disabled={!canSubmit}>
              {createMutation.isPending ? 'Creating…' : 'Create lecture'}
            </button>
          </div>
        </form>
      </div>
      )}
      {createSuccess
        ? createPortal(
            <div
              className="lecture-schedule-alert lecture-schedule-alert--created lecture-schedule-alert--toast"
              role="status"
              aria-live="polite"
            >
              <div className="lecture-schedule-alert__body">
                <strong>Lecture created.</strong>{' '}
                <span className="lecture-schedule-alert__sub">
                  It appears on the timeline above for this class and date.
                </span>
              </div>
              <button
                type="button"
                className="lecture-schedule-alert__dismiss"
                onClick={() => setCreateSuccess(false)}
              >
                Dismiss
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
