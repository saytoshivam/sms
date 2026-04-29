import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { WorkspaceHero } from '../components/workspace/WorkspaceKit';
import { ClassGroupSearchCombobox } from '../components/ClassGroupSearchCombobox';
import { OptionSearchCombobox } from '../components/OptionSearchCombobox';

type TimeSlot = { id: number; startTime: string; endTime: string; slotOrder: number; isBreak: boolean };
type Version = { id: number; status: string; version: number };
type Entry = {
  id: number;
  classGroupId: number;
  dayOfWeek: string;
  timeSlotId: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  staffId: number;
  staffName: string;
  roomId: number | null;
  roomLabel: string | null;
};

type Subject = { id: number; code: string; name: string };
type Staff = { id: number; fullName: string };
type Room = { id: number; building: string; roomNumber: string; type: string };
type SpringPage<T> = { content: T[] };
type OnboardingBasicInfo = {
  schoolStartTime: string;
  schoolEndTime: string;
  openWindows?: { startTime: string; endTime: string }[];
  lectureDurationMinutes: number;
};
type AutoFillResult = {
  placedCount: number;
  skippedFilledCount: number;
  skippedConflictCount: number;
  skippedNoAllocationCount: number;
  warnings?: string[];
};

const DAYS: { key: string; label: string }[] = [
  { key: 'MONDAY', label: 'Mon' },
  { key: 'TUESDAY', label: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wed' },
  { key: 'THURSDAY', label: 'Thu' },
  { key: 'FRIDAY', label: 'Fri' },
  { key: 'SATURDAY', label: 'Sat' },
];

function pageContent<T>(d: SpringPage<T> | T[] | undefined | null): T[] {
  if (!d) return [];
  return Array.isArray(d) ? d : d.content ?? [];
}

function hhmmToMinutes(v: string): number | null {
  const m = String(v ?? '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToHHMM(total: number): string {
  const t = Math.max(0, Math.min(24 * 60, Math.floor(total)));
  const hh = String(Math.floor(t / 60)).padStart(2, '0');
  const mm = String(t % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function TimetableGridV2Page() {
  const qc = useQueryClient();
  const [classGroupId, setClassGroupId] = useState('');
  const [copyFromClassGroupId, setCopyFromClassGroupId] = useState('');
  const [editingCell, setEditingCell] = useState<{ day: string; timeSlotId: number } | null>(null);
  const [editSubjectId, setEditSubjectId] = useState<string>('');
  const [editStaffId, setEditStaffId] = useState<string>('');
  const [editRoomId, setEditRoomId] = useState<string>('');

  const slots = useQuery({
    queryKey: ['ttv2-time-slots'],
    queryFn: async () => (await api.get<TimeSlot[]>('/api/v2/timetable/time-slots')).data,
  });

  const basicInfo = useQuery({
    queryKey: ['onboarding-basic-info-lite'],
    queryFn: async () => (await api.get<OnboardingBasicInfo>('/api/v1/onboarding/basic-info')).data,
    retry: false,
  });

  const ensureDraft = useMutation({
    mutationFn: async () => (await api.post<Version>('/api/v2/timetable/versions/draft')).data,
  });

  const versionId = ensureDraft.data?.id;

  const generateSlotsFromOnboarding = useMutation({
    mutationFn: async () => {
      // Replace existing slots so old "09:00–17:00" doesn't linger.
      await api.delete('/api/v2/timetable/time-slots');

      const info = basicInfo.data;
      if (!info) throw new Error('No onboarding timings found. Complete School onboarding → Basic setup first.');

      const duration = Number(info.lectureDurationMinutes);
      if (!Number.isFinite(duration) || duration < 10) {
        throw new Error('Invalid onboarding timings. Please re-save Basic setup (open timings + lecture duration).');
      }

      const windows = (info.openWindows ?? []).length
        ? (info.openWindows ?? [])
        : [{ startTime: info.schoolStartTime, endTime: info.schoolEndTime }];

      // Create consecutive slots within each open window, no gaps.
      let order = 1;
      for (const w of windows) {
        const startMin = hhmmToMinutes(w.startTime);
        const endMin = hhmmToMinutes(w.endTime);
        if (startMin == null || endMin == null || startMin >= endMin) continue;
        let cursor = startMin;
        while (cursor + duration <= endMin) {
          const startTime = minutesToHHMM(cursor);
          const endTime = minutesToHHMM(cursor + duration);
          // eslint-disable-next-line no-await-in-loop
          await api.post('/api/v2/timetable/time-slots', {
            startTime,
            endTime,
            slotOrder: order,
            isBreak: false,
          });
          cursor += duration;
          order += 1;
        }
      }
      if (order === 1) {
        throw new Error('No slots could be generated within the open timings. Check your duration and timings.');
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ttv2-time-slots'] });
      toast.success('Slots created', 'Time slots were generated from onboarding.');
    },
    onError: (e) => toast.error('Create failed', formatApiError(e)),
  });

  const autoFill = useMutation({
    mutationFn: async (mode: 'FILL_EMPTY' | 'REPLACE') => {
      if (!versionId) throw new Error('Draft version not ready yet.');
      if (!classGroupId) throw new Error('Select a class first.');
      return (
        await api.post<AutoFillResult>('/api/v2/timetable/entries/auto-fill', {
          timetableVersionId: Number(versionId),
          classGroupId: Number(classGroupId),
          mode,
        })
      ).data;
    },
    onSuccess: async (d) => {
      await qc.invalidateQueries({ queryKey: ['ttv2-entries', versionId, classGroupId] });
      const msg = `Placed ${d.placedCount} · Conflicts ${d.skippedConflictCount} · Already filled ${d.skippedFilledCount}`;
      toast.success('Auto-generated', msg);
      const w = (d.warnings ?? []).filter(Boolean);
      if (w.length) toast.info('Note', w.join(' '));
    },
    onError: (e) => toast.error('Auto-generate failed', formatApiError(e)),
  });

  const subjects = useQuery({
    queryKey: ['subjects-for-class', classGroupId],
    enabled: Boolean(classGroupId),
    queryFn: async () => (await api.get<Subject[]>(`/api/subjects/for-class-group?classGroupId=${encodeURIComponent(classGroupId)}`)).data,
  });

  const staff = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get<SpringPage<Staff> | Staff[]>('/api/staff?size=500')).data,
  });

  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api.get<SpringPage<Room> | Room[]>('/api/rooms?size=500')).data,
  });

  const entries = useQuery({
    queryKey: ['ttv2-entries', versionId, classGroupId],
    enabled: Boolean(versionId && classGroupId),
    queryFn: async () =>
      (
        await api.get<Entry[]>(
          `/api/v2/timetable/entries?timetableVersionId=${encodeURIComponent(String(versionId))}&classGroupId=${encodeURIComponent(
            classGroupId,
          )}`,
        )
      ).data,
  });

  const entryByKey = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries.data ?? []) {
      m.set(`${e.dayOfWeek}__${e.timeSlotId}`, e);
    }
    return m;
  }, [entries.data]);

  const upsert = useMutation({
    mutationFn: async (body: {
      dayOfWeek: string;
      timeSlotId: number;
      subjectId: number;
      staffId: number;
      roomId: number | null;
    }) => {
      if (!versionId) throw new Error('Missing draft version');
      if (!classGroupId) throw new Error('Select a class');
      return (
        await api.put<Entry>('/api/v2/timetable/entries', {
          timetableVersionId: versionId,
          classGroupId: Number(classGroupId),
          ...body,
        })
      ).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ttv2-entries'] });
      toast.success('Saved', 'Timetable entry saved.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const clearCell = useMutation({
    mutationFn: async (body: { dayOfWeek: string; timeSlotId: number }) => {
      if (!versionId) throw new Error('Missing draft version');
      if (!classGroupId) throw new Error('Select a class');
      await api.delete('/api/v2/timetable/entries', {
        params: {
          timetableVersionId: versionId,
          classGroupId: Number(classGroupId),
          dayOfWeek: body.dayOfWeek,
          timeSlotId: body.timeSlotId,
        },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ttv2-entries'] });
      toast.success('Cleared', 'Cell cleared.');
    },
    onError: (e) => toast.error('Clear failed', formatApiError(e)),
  });

  const subjectOptions = (subjects.data ?? []).map((s) => ({ value: String(s.id), label: s.name, meta: s.code }));
  const staffOptions = pageContent(staff.data).map((s) => ({ value: String(s.id), label: s.fullName }));
  const roomOptions = pageContent(rooms.data).map((r) => ({ value: String(r.id), label: `${r.building} ${r.roomNumber} (${r.type})` }));

  return (
    <div className="workspace-feature-page stack">
      <WorkspaceHero
        eyebrow="Timetable"
        title="Timetable grid (v2)"
        tag={ensureDraft.data ? `v${ensureDraft.data.version}` : 'Draft'}
        subtitle={
          <>
            Spreadsheet-style editor with <strong>hard conflict validation</strong>. Drafts can be reviewed and published
            next.
          </>
        }
      />

      <div className="card stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div className="stack" style={{ flex: '1 1 320px' }}>
            <label>Class</label>
            <ClassGroupSearchCombobox value={classGroupId} onChange={setClassGroupId} placeholder="Search class (e.g. 10-A)…" />
          </div>
          <div className="stack" style={{ flex: '1 1 320px' }}>
            <label>Copy from class (optional)</label>
            <ClassGroupSearchCombobox
              value={copyFromClassGroupId}
              onChange={setCopyFromClassGroupId}
              placeholder="Pick source class (e.g. 10-B)…"
            />
          </div>
          <div className="stack" style={{ flex: '0 0 auto' }}>
            <label>Draft version</label>
            <button type="button" className="btn secondary" onClick={() => ensureDraft.mutate()} disabled={ensureDraft.isPending}>
              {ensureDraft.isPending ? 'Loading…' : ensureDraft.data ? `Using v${ensureDraft.data.version}` : 'Create / load draft'}
            </button>
          </div>
        </div>

        {ensureDraft.isError ? <div style={{ color: '#b91c1c' }}>{formatApiError(ensureDraft.error)}</div> : null}
        {entries.isError ? <div style={{ color: '#b91c1c' }}>{formatApiError(entries.error)}</div> : null}
        {slots.isError ? <div style={{ color: '#b91c1c' }}>{formatApiError(slots.error)}</div> : null}

        {versionId && classGroupId ? (
          <div className="stack" style={{ gap: 12 }}>
            {(slots.data ?? []).length === 0 ? (
              <div className="workspace-placeholder">
                <strong>No time slots yet</strong>
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5 }}>
                  The grid needs time slots. Create them once, then the timetable becomes clickable.
                </p>
                <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={generateSlotsFromOnboarding.isPending}
                    onClick={() => generateSlotsFromOnboarding.mutate()}
                  >
                    {generateSlotsFromOnboarding.isPending ? 'Creating…' : 'Generate slots from onboarding'}
                  </button>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Uses Basic setup open timings + lecture duration.
                  </span>
                </div>
              </div>
            ) : null}

            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn secondary"
                disabled={!versionId || !classGroupId || autoFill.isPending}
                onClick={() => autoFill.mutate('FILL_EMPTY')}
              >
                {autoFill.isPending ? 'Auto-generating…' : 'Auto-generate (fill empty)'}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={!versionId || !classGroupId || autoFill.isPending}
                onClick={() => autoFill.mutate('REPLACE')}
                title="Clears this class timetable in the current draft and fills again"
              >
                Auto-generate (replace)
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={!entries.data?.length || !slots.data}
                onClick={async () => {
                  if (!slots.data) return;
                  const src = 'MONDAY';
                  const slotList = slots.data.slice().filter((s) => !s.isBreak).sort((a, b) => a.slotOrder - b.slotOrder);
                  for (const s of slotList) {
                    const e = entryByKey.get(`${src}__${s.id}`);
                    if (!e) continue;
                    for (const d of DAYS.map((x) => x.key).filter((x) => x !== src)) {
                      try {
                        // eslint-disable-next-line no-await-in-loop
                        await upsert.mutateAsync({
                          dayOfWeek: d,
                          timeSlotId: s.id,
                          subjectId: e.subjectId,
                          staffId: e.staffId,
                          roomId: e.roomId,
                        });
                      } catch {
                        // toast already shown
                      }
                    }
                  }
                  toast.success('Copied', 'Copied Monday to all days (conflicts skipped).');
                }}
              >
                Copy Monday → all days
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={!copyFromClassGroupId || !versionId}
                onClick={async () => {
                  if (!versionId || !copyFromClassGroupId) return;
                  const srcEntries = (
                    await api.get<Entry[]>(
                      `/api/v2/timetable/entries?timetableVersionId=${encodeURIComponent(String(versionId))}&classGroupId=${encodeURIComponent(
                        copyFromClassGroupId,
                      )}`,
                    )
                  ).data;
                  for (const e of srcEntries) {
                    try {
                      // eslint-disable-next-line no-await-in-loop
                      await upsert.mutateAsync({
                        dayOfWeek: e.dayOfWeek,
                        timeSlotId: e.timeSlotId,
                        subjectId: e.subjectId,
                        staffId: e.staffId,
                        roomId: e.roomId,
                      });
                    } catch {
                      // toast already shown
                    }
                  }
                  toast.success('Copied', 'Copied source class into this class (conflicts skipped).');
                }}
              >
                Copy class → this class
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                Tip: click any cell to edit. Conflicts are validated on save.
              </span>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <div style={{ fontWeight: 800 }}>Grid</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Click a cell to edit like Excel.
              </div>
              <div style={{ overflowX: 'auto', opacity: (slots.data ?? []).length === 0 ? 0.45 : 1, pointerEvents: (slots.data ?? []).length === 0 ? 'none' : 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                        Slot
                      </th>
                      {DAYS.map((d) => (
                        <th
                          key={d.key}
                          style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}
                        >
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(slots.data ?? [])
                      .slice()
                      .sort((a, b) => a.slotOrder - b.slotOrder)
                      .map((s) => (
                        <tr key={s.id}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                            <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                              {String(s.slotOrder).padStart(2, '0')} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                            </div>
                            {s.isBreak ? <div className="muted" style={{ fontSize: 12 }}>Break</div> : null}
                          </td>
                          {DAYS.map((d) => {
                            const e = entryByKey.get(`${d.key}__${s.id}`);
                            const color = e ? `hsl(${(e.subjectId * 47) % 360} 80% 92%)` : 'transparent';
                            return (
                              <td key={d.key} style={{ padding: 0, borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                                {s.isBreak ? (
                                  <div style={{ padding: '10px 12px' }} className="muted">
                                    —
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCell({ day: d.key, timeSlotId: s.id });
                                      setEditSubjectId(e ? String(e.subjectId) : '');
                                      setEditStaffId(e ? String(e.staffId) : '');
                                      setEditRoomId(e?.roomId ? String(e.roomId) : '');
                                    }}
                                    className="btn secondary"
                                    style={{
                                      width: '100%',
                                      borderRadius: 0,
                                      border: 'none',
                                      background: e ? color : 'transparent',
                                      textAlign: 'left',
                                      padding: '10px 12px',
                                      minHeight: 64,
                                    }}
                                  >
                                    {e ? (
                                      <div className="stack" style={{ gap: 4 }}>
                                        <div style={{ fontWeight: 900 }}>{e.subjectName}</div>
                                        <div className="muted" style={{ fontSize: 12 }}>{e.staffName}</div>
                                        {e.roomLabel ? <div className="muted" style={{ fontSize: 12 }}>{e.roomLabel}</div> : null}
                                      </div>
                                    ) : (
                                      <span className="muted">—</span>
                                    )}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="muted">Pick a class and load a draft version to start editing the grid.</div>
        )}
      </div>

      {editingCell ? (
        <div
          role="dialog"
          aria-modal="true"
          className="card stack"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 20000,
            boxShadow: '0 20px 60px rgba(15,23,42,0.22)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ fontWeight: 900 }}>
              Edit cell
              <div className="muted" style={{ fontSize: 12 }}>
                {editingCell.day} · Slot {editingCell.timeSlotId}
              </div>
            </div>
            <button type="button" className="btn secondary" onClick={() => setEditingCell(null)}>
              Close
            </button>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="stack">
              <label>Subject</label>
              <OptionSearchCombobox
                value={editSubjectId}
                onChange={setEditSubjectId}
                options={subjectOptions}
                placeholder="Search subject…"
                emptyLabel="Select…"
              />
            </div>
            <div className="stack">
              <label>Teacher</label>
              <OptionSearchCombobox
                value={editStaffId}
                onChange={setEditStaffId}
                options={staffOptions.map((s) => ({ value: s.value, label: s.label }))}
                placeholder="Search teacher…"
                emptyLabel="Select…"
              />
            </div>
            <div className="stack">
              <label>Room (optional)</label>
              <OptionSearchCombobox
                value={editRoomId}
                onChange={setEditRoomId}
                options={roomOptions.map((r) => ({ value: r.value, label: r.label }))}
                placeholder="Search room…"
                emptyLabel="(none)"
              />
            </div>
          </div>
          {(upsert.isError || clearCell.isError) ? (
            <div style={{ color: '#b91c1c', fontSize: 13 }}>
              {formatApiError((upsert.error as any) ?? (clearCell.error as any))}
            </div>
          ) : null}
          <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn secondary"
              disabled={clearCell.isPending}
              onClick={async () => {
                await clearCell.mutateAsync({ dayOfWeek: editingCell.day, timeSlotId: editingCell.timeSlotId });
                setEditingCell(null);
              }}
            >
              {clearCell.isPending ? 'Clearing…' : 'Clear cell'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={upsert.isPending || !editSubjectId || !editStaffId}
              onClick={async () => {
                await upsert.mutateAsync({
                  dayOfWeek: editingCell.day,
                  timeSlotId: editingCell.timeSlotId,
                  subjectId: Number(editSubjectId),
                  staffId: Number(editStaffId),
                  roomId: editRoomId ? Number(editRoomId) : null,
                });
                setEditingCell(null);
              }}
            >
              {upsert.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

