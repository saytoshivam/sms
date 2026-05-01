import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { SmartSelect } from '../components/SmartSelect';

type ClassGroup = { id: number; displayName: string };
type Staff = { id: number; fullName: string; email?: string | null };

type SlotView = {
  id: number;
  classGroupDisplayName: string;
  staffId: number | null;
  staffName: string | null;
  teacherDisplayName: string | null;
  subject: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
  active: boolean;
};

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

export function TimetableRulesPage() {
  const qc = useQueryClient();
  const [classGroupId, setClassGroupId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [teacherDisplayName, setTeacherDisplayName] = useState('');
  const [subject, setSubject] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<string>('MONDAY');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');

  const slots = useQuery({
    queryKey: ['timetable-slots'],
    queryFn: async () => (await api.get<SlotView[]>('/api/v1/timetable/slots')).data,
  });
  const classGroups = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () => (await api.get<{ content: ClassGroup[] }>('/api/class-groups?size=200')).data,
  });
  const staff = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get<{ content: Staff[] }>('/api/staff?size=200')).data,
  });

  const createMut = useMutation({
    mutationFn: async () =>
      (
        await api.post('/api/v1/timetable/slots', {
          classGroupId: Number(classGroupId),
          staffId: staffId ? Number(staffId) : null,
          teacherDisplayName: teacherDisplayName.trim() || null,
          subject: subject.trim(),
          dayOfWeek,
          startTime,
          endTime,
          room: room.trim() || null,
          active: true,
        })
      ).data,
    onSuccess: async () => {
      setSubject('');
      setTeacherDisplayName('');
      setRoom('');
      await qc.invalidateQueries({ queryKey: ['timetable-slots'] });
      toast.success('Saved', 'Recurring slot added.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/v1/timetable/slots/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['timetable-slots'] });
      toast.success('Deleted', 'Recurring slot deleted.');
    },
    onError: (e) => toast.error('Delete failed', formatApiError(e)),
  });

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>Recurring timetable</h2>
      <p className="muted" style={{ margin: 0 }}>
        Define weekly subject blocks (day of week + time). These feed the teacher timetable together with one-off
        lectures created under Lectures.
      </p>

      <div className="card stack">
        <strong>Add slot</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <div className="row">
            <div style={{ flex: 1, minWidth: 200 }} className="stack">
              <label>Class group</label>
              <SmartSelect
                value={classGroupId}
                onChange={setClassGroupId}
                placeholder="Select…"
                options={(classGroups.data?.content ?? []).map((cg) => ({ value: String(cg.id), label: cg.displayName }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }} className="stack">
              <label>Subject teacher (staff)</label>
              <SmartSelect
                value={staffId}
                onChange={setStaffId}
                allowClear
                clearLabel="(optional)"
                placeholder="(optional)"
                options={(staff.data?.content ?? []).map((s) => ({ value: String(s.id), label: s.fullName }))}
              />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 200 }} className="stack">
              <label>Teacher display name (if no staff)</label>
              <input value={teacherDisplayName} onChange={(e) => setTeacherDisplayName(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }} className="stack">
              <label>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 160 }} className="stack">
              <label>Day of week</label>
              <SmartSelect
                value={dayOfWeek}
                onChange={setDayOfWeek}
                options={DAYS.map((d) => ({ value: d, label: d }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 120 }} className="stack">
              <label>Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div style={{ flex: 1, minWidth: 120 }} className="stack">
              <label>End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
            <div style={{ flex: 1, minWidth: 160 }} className="stack">
              <label>Room</label>
              <input value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>
          </div>
          {createMut.error ? (
            <div style={{ color: '#b91c1c' }}>{String((createMut.error as any)?.response?.data ?? createMut.error)}</div>
          ) : null}
          <button className="btn" disabled={createMut.isPending || !classGroupId || !subject}>
            {createMut.isPending ? 'Saving…' : 'Add recurring slot'}
          </button>
        </form>
      </div>

      <div className="card stack">
        <strong>Current rules</strong>
        {slots.isLoading ? (
          <div>Loading…</div>
        ) : slots.error ? (
          <div style={{ color: '#b91c1c' }}>{String((slots.error as any)?.response?.data ?? slots.error)}</div>
        ) : (
          <div className="stack">
            {(slots.data ?? []).map((s) => (
              <div key={s.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{s.subject}</strong>{' '}
                  <span className="muted">
                    · {s.dayOfWeek} {s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)} · {s.classGroupDisplayName}
                  </span>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {s.staffName ?? s.teacherDisplayName ?? '—'}
                    {s.room ? ` · ${s.room}` : ''}
                  </div>
                </div>
                <button type="button" className="btn secondary" disabled={delMut.isPending} onClick={() => delMut.mutate(s.id)}>
                  Remove
                </button>
              </div>
            ))}
            {(slots.data ?? []).length === 0 ? <div className="muted">No recurring slots yet.</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
