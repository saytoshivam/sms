import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { ModulePage, type StatusLevel } from '../../components/module/ModulePage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SchoolBasicSetupForm } from '../../components/setup/SchoolBasicSetupForm';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import {
  basicInfoApiToDraft,
  draftToBasicInfoPutPayload,
  emptyBasicSetupDraft,
  validateBasicSetupDraft,
  type BasicSetupDraft,
  type BasicInfoApiShape,
} from '../../lib/schoolBasicSetup';

type TimeSlotView = {
  id: number;
  startTime: string;
  endTime: string;
  slotOrder: number;
  isBreak: boolean;
};

type SlotDraft = {
  startTime: string;
  endTime: string;
  slotOrder: number;
  isBreak: boolean;
};

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeHHmm(s: string): string {
  const v = String(s ?? '').trim();
  if (!v) return v;
  // Accept "9:5" → "09:05"
  const m = v.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) {
    const h = m[1].padStart(2, '0');
    const min = m[2].padStart(2, '0');
    return `${h}:${min}`;
  }
  return v;
}

function toMinutes(hhmm: string): number {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

function compareTime(a: string, b: string): number {
  return toMinutes(a) - toMinutes(b);
}

export function TimeModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') ?? 'basic') as 'basic' | 'slots';
  const [tab, setTab] = useState<'basic' | 'slots'>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  // ---- queries ----
  const basic = useQuery({
    queryKey: ['onboarding-basic-info'],
    queryFn: async () => {
      const res = await api.get<BasicInfoApiShape | ''>('/api/v1/onboarding/basic-info');
      return res.data || null;
    },
  });

  const slots = useQuery({
    queryKey: ['ttv2-time-slots'],
    queryFn: async () => (await api.get<TimeSlotView[]>('/api/v2/timetable/time-slots')).data,
  });

  // ---- derived status ----
  const status: { level: StatusLevel; label: string; hint?: string } = useMemo(() => {
    if (basic.isLoading || slots.isLoading) return { level: 'idle', label: 'Loading' };
    if (basic.isError || slots.isError) return { level: 'error', label: 'Load failed' };
    const b = basic.data;
    const s = slots.data ?? [];
    if (!b || !b.workingDays?.length) return { level: 'idle', label: 'Not configured' };
    if (s.length === 0) return { level: 'warn', label: 'No time slots' };
    return { level: 'ok', label: `${s.length} slot${s.length === 1 ? '' : 's'} · ${b.workingDays.length} day${b.workingDays.length === 1 ? '' : 's'}` };
  }, [basic.isLoading, basic.isError, basic.data, slots.isLoading, slots.isError, slots.data]);

  const setTabUrl = (next: 'basic' | 'slots') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'basic') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  return (
    <ModulePage
      title="Time slots"
      subtitle="School hours, working days and the period grid the timetable engine uses. Changes here invalidate the current timetable."
      status={status}
      headerActions={
        <Link to="/app" className="btn secondary">
          Back to hub
        </Link>
      }
      tabs={[
        { id: 'basic', label: 'Basic info' },
        { id: 'slots', label: 'Slots', badge: slots.data?.length ?? null },
      ]}
      activeTabId={tab}
      tabHrefBase="/app/time"
    >
      {tab === 'basic' ? (
        <BasicInfoEditor
          initial={basic.data ?? null}
          isLoading={basic.isLoading}
          onSaved={(prev, next) => {
            const prevD = basicInfoApiToDraft(prev);
            const nextD: BasicSetupDraft = {
              academicYear: next.academicYear,
              startMonth: next.startMonth,
              workingDays: next.workingDays,
              attendanceMode: next.attendanceMode,
              openWindows: next.openWindows,
              lectureDurationMinutes: next.lectureDurationMinutes ?? '',
            };
            const slotShapeChanged =
              prev == null ||
              prevD.lectureDurationMinutes !== nextD.lectureDurationMinutes ||
              JSON.stringify(prevD.openWindows) !== JSON.stringify(nextD.openWindows) ||
              JSON.stringify(prevD.workingDays) !== JSON.stringify(nextD.workingDays);
            recordChange({
              id: `time:basic:${Date.now()}`,
              scope: 'time',
              severity: slotShapeChanged ? 'hard' : 'soft',
              message: slotShapeChanged
                ? 'School hours / working days / lecture duration changed'
                : 'Basic info updated',
            });
          }}
          invalidate={invalidate}
        />
      ) : (
        <SlotsEditor
          slots={slots.data ?? []}
          isLoading={slots.isLoading}
          onChanged={(message) => {
            recordChange({
              id: `time:slots:${Date.now()}`,
              scope: 'time',
              severity: 'hard',
              message,
            });
          }}
          invalidate={invalidate}
        />
      )}
    </ModulePage>
  );
}

// ----------------------------------------------------------------------------
// BasicInfoEditor — shared form with Setup wizard Step 1
// ----------------------------------------------------------------------------

function BasicInfoEditor({
  initial,
  isLoading,
  onSaved,
  invalidate,
}: {
  initial: BasicInfoApiShape | null;
  isLoading: boolean;
  onSaved: (prev: BasicInfoApiShape | null, next: ReturnType<typeof draftToBasicInfoPutPayload>) => void;
  invalidate: ReturnType<typeof useApiTags>;
}) {
  const [draft, setDraft] = useState<BasicSetupDraft>(() => emptyBasicSetupDraft());

  useEffect(() => {
    setDraft(basicInfoApiToDraft(initial));
  }, [initial]);

  const baseline = useMemo(() => basicInfoApiToDraft(initial), [initial]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline]);

  const saveBasic = useMutation({
    mutationFn: async (d: BasicSetupDraft) => {
      const err = validateBasicSetupDraft(d);
      if (err) throw new Error(err);
      const payload = draftToBasicInfoPutPayload(d);
      await api.put('/api/v1/onboarding/basic-info', payload);
      return payload;
    },
    onSuccess: async (saved) => {
      toast.success('Basic info saved');
      onSaved(initial, saved);
      await invalidate(['time']);
    },
    onError: (e) => toast.error('Could not save', formatApiError(e)),
  });

  if (isLoading) {
    return <div className="muted" style={{ fontSize: 13 }}>Loading basic info…</div>;
  }

  return (
    <div className="card stack" style={{ gap: 14, padding: 14, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 14 }}>Basic setup</div>
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
        Same fields as <strong>Setup wizard → Step 1</strong>. Open windows and lecture length drive how period slots are generated.
      </p>
      <SchoolBasicSetupForm value={draft} onChange={setDraft} />
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setDraft(baseline)}
          disabled={!dirty || saveBasic.isPending}
        >
          Discard changes
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => saveBasic.mutate(draft)}
          disabled={!dirty || saveBasic.isPending}
        >
          {saveBasic.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        Saving here does not change the slot grid automatically. After basic info changes, open the{' '}
        <Link to="/app/time?tab=slots">Slots</Link> tab and click <em>Regenerate from basic info</em> if you want the engine
        to rebuild slots.
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// SlotsEditor
// ----------------------------------------------------------------------------

function SlotsEditor({
  slots,
  isLoading,
  onChanged,
  invalidate,
}: {
  slots: TimeSlotView[];
  isLoading: boolean;
  onChanged: (message: string) => void;
  invalidate: ReturnType<typeof useApiTags>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<SlotDraft | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<SlotDraft>({
    startTime: '09:00',
    endTime: '09:45',
    slotOrder: 0,
    isBreak: false,
  });
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const sorted = useMemo(() => [...slots].sort((a, b) => a.slotOrder - b.slotOrder || compareTime(a.startTime, b.startTime)), [slots]);

  const overlaps = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const aS = toMinutes(a.startTime);
        const aE = toMinutes(a.endTime);
        const bS = toMinutes(b.startTime);
        const bE = toMinutes(b.endTime);
        if (aS < bE && bS < aE) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    }
    return set;
  }, [sorted]);

  const validateDraft = (d: SlotDraft) => {
    if (!HHMM_RE.test(d.startTime)) return 'Start time must be HH:mm.';
    if (!HHMM_RE.test(d.endTime)) return 'End time must be HH:mm.';
    if (compareTime(d.startTime, d.endTime) >= 0) return 'Start must be before end.';
    if (!Number.isFinite(d.slotOrder) || d.slotOrder < 0) return 'Slot order must be >= 0.';
    return null;
  };

  const createSlot = useMutation({
    mutationFn: async (d: SlotDraft) => {
      const err = validateDraft(d);
      if (err) throw new Error(err);
      return (await api.post<TimeSlotView>('/api/v2/timetable/time-slots', d)).data;
    },
    onSuccess: async (s) => {
      toast.success('Slot added', `#${s.slotOrder} ${s.startTime}–${s.endTime}`);
      setCreateOpen(false);
      setCreateDraft({ ...createDraft, slotOrder: createDraft.slotOrder + 1 });
      onChanged(`Added slot #${s.slotOrder} ${s.startTime}-${s.endTime}`);
      await invalidate(['time']);
    },
    onError: (e) => toast.error('Could not add slot', formatApiError(e)),
  });

  const updateSlot = useMutation({
    mutationFn: async (vars: { id: number; draft: SlotDraft }) => {
      const err = validateDraft(vars.draft);
      if (err) throw new Error(err);
      return (await api.put<TimeSlotView>(`/api/v2/timetable/time-slots/${vars.id}`, vars.draft)).data;
    },
    onSuccess: async (s) => {
      toast.success('Slot updated');
      setEditingId(null);
      setEditDraft(null);
      onChanged(`Updated slot #${s.slotOrder} ${s.startTime}-${s.endTime}`);
      await invalidate(['time']);
    },
    onError: (e) => toast.error('Could not save slot', formatApiError(e)),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      await api.delete('/api/v2/timetable/time-slots');
    },
    onSuccess: async () => {
      toast.success('All slots cleared');
      setConfirmClear(false);
      onChanged(`Cleared all time slots`);
      await invalidate(['time']);
    },
    onError: (e) => toast.error('Could not clear slots', formatApiError(e)),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      return (await api.post<TimeSlotView[]>('/api/v2/timetable/time-slots/generate-from-onboarding', {})).data;
    },
    onSuccess: async (next) => {
      toast.success('Slots regenerated', `${next.length} slot${next.length === 1 ? '' : 's'} created.`);
      setConfirmRegen(false);
      onChanged(`Regenerated ${next.length} slot${next.length === 1 ? '' : 's'} from basic info`);
      await invalidate(['time']);
    },
    onError: (e) => toast.error('Could not regenerate slots', formatApiError(e)),
  });

  if (isLoading) {
    return <div className="muted" style={{ fontSize: 13 }}>Loading slots…</div>;
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div
        className="card stack"
        style={{ gap: 12, padding: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}
      >
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 950, fontSize: 14 }}>Period grid</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setConfirmRegen(true)}
              disabled={regenerate.isPending}
            >
              Regenerate from basic info
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setConfirmClear(true)}
              disabled={clearAll.isPending || sorted.length === 0}
              style={{ color: '#b91c1c' }}
            >
              Clear all
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const nextOrder =
                  sorted.length === 0 ? 1 : Math.max(...sorted.map((s) => s.slotOrder)) + 1;
                const last = sorted[sorted.length - 1];
                setCreateDraft({
                  startTime: last?.endTime ?? '09:00',
                  endTime: last ? addMinutes(last.endTime, 45) : '09:45',
                  slotOrder: nextOrder,
                  isBreak: false,
                });
                setCreateOpen(true);
              }}
            >
              + Add slot
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            No slots yet. Use <em>Regenerate from basic info</em> to auto-build the grid, or add slots manually.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right' }}>#</th>
                  <th style={{ textAlign: 'left' }}>Start</th>
                  <th style={{ textAlign: 'left' }}>End</th>
                  <th style={{ textAlign: 'right' }}>Duration</th>
                  <th style={{ textAlign: 'left' }}>Type</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const dur = toMinutes(s.endTime) - toMinutes(s.startTime);
                  const conflict = overlaps.has(s.id);
                  return (
                    <tr key={s.id} style={conflict ? { background: 'rgba(220,38,38,0.06)' } : undefined}>
                      <td style={{ textAlign: 'right', fontWeight: 900 }}>{s.slotOrder}</td>
                      <td>{s.startTime}</td>
                      <td>{s.endTime}</td>
                      <td style={{ textAlign: 'right' }}>{dur > 0 ? `${dur} min` : '—'}</td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            background: s.isBreak ? 'rgba(234,179,8,0.18)' : 'rgba(37,99,235,0.10)',
                            color: s.isBreak ? '#7c2d12' : '#1d4ed8',
                          }}
                        >
                          {s.isBreak ? 'Break' : 'Lecture'}
                        </span>
                        {conflict ? (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: '#b91c1c' }}>
                            Overlaps
                          </span>
                        ) : null}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            setEditingId(s.id);
                            setEditDraft({
                              startTime: s.startTime,
                              endTime: s.endTime,
                              slotOrder: s.slotOrder,
                              isBreak: s.isBreak,
                            });
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {overlaps.size > 0 ? (
          <div className="sms-alert sms-alert--error" style={{ margin: 0 }}>
            <div>
              <div className="sms-alert__title">Overlapping slots</div>
              <div className="sms-alert__msg">
                Two or more slots overlap. The timetable engine cannot place lectures reliably until you fix the overlaps.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={createOpen}
        title="Add time slot"
        confirmLabel={createSlot.isPending ? 'Adding…' : 'Add'}
        confirmDisabled={createSlot.isPending}
        onConfirm={() => createSlot.mutate(createDraft)}
        onClose={() => setCreateOpen(false)}
      >
        <SlotFormFields draft={createDraft} setDraft={setCreateDraft} />
      </ConfirmDialog>

      <ConfirmDialog
        open={editingId != null && editDraft != null}
        title="Edit time slot"
        confirmLabel={updateSlot.isPending ? 'Saving…' : 'Save'}
        confirmDisabled={updateSlot.isPending}
        onConfirm={() => editingId != null && editDraft && updateSlot.mutate({ id: editingId, draft: editDraft })}
        onClose={() => {
          setEditingId(null);
          setEditDraft(null);
        }}
      >
        {editDraft ? <SlotFormFields draft={editDraft} setDraft={setEditDraft} /> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate slots from basic info?"
        description="This rebuilds the period grid from the current school start/end and lecture duration. Any custom slots will be replaced and the timetable will be invalidated."
        confirmLabel={regenerate.isPending ? 'Working…' : 'Regenerate'}
        confirmDisabled={regenerate.isPending}
        danger
        onConfirm={() => regenerate.mutate()}
        onClose={() => setConfirmRegen(false)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear all time slots?"
        description="This deletes every slot in the period grid. Existing timetable entries that depend on these slots will also be cleared."
        confirmLabel={clearAll.isPending ? 'Clearing…' : 'Clear all'}
        confirmDisabled={clearAll.isPending}
        danger
        onConfirm={() => clearAll.mutate()}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}

function SlotFormFields({
  draft,
  setDraft,
}: {
  draft: SlotDraft;
  setDraft: (d: SlotDraft) => void;
}) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Slot order" flex="0 0 110px">
          <input
            type="number"
            min={0}
            value={draft.slotOrder}
            onChange={(e) => setDraft({ ...draft, slotOrder: Math.max(0, Math.trunc(Number(e.target.value || 0))) })}
          />
        </Field>
        <Field label="Start" flex="0 0 130px">
          <input
            type="time"
            value={draft.startTime}
            onChange={(e) => setDraft({ ...draft, startTime: normalizeHHmm(e.target.value) })}
          />
        </Field>
        <Field label="End" flex="0 0 130px">
          <input
            type="time"
            value={draft.endTime}
            onChange={(e) => setDraft({ ...draft, endTime: normalizeHHmm(e.target.value) })}
          />
        </Field>
      </div>
      <label className="row" style={{ gap: 8, alignItems: 'center', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={draft.isBreak}
          onChange={(e) => setDraft({ ...draft, isBreak: e.target.checked })}
        />
        <span>This slot is a break (no lectures placed here)</span>
      </label>
    </div>
  );
}

function Field({ label, flex, children }: { label: string; flex?: string; children: React.ReactNode }) {
  return (
    <label className="stack" style={{ gap: 6, flex: flex ?? '1 1 200px' }}>
      <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{label}</span>
      {children}
    </label>
  );
}

function addMinutes(hhmm: string, minutes: number): string {
  const total = toMinutes(hhmm);
  if (total < 0) return hhmm;
  const next = total + Math.max(0, Math.trunc(minutes));
  const h = Math.floor(next / 60) % 24;
  const m = next % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
