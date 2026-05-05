import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { ModulePage, type StatusLevel } from '../../components/module/ModulePage';
import { SmartSelect } from '../../components/SmartSelect';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import { onboardingStepHref } from '../../lib/onboardingWizardMeta';
import { SavedRoomsCatalogPanel } from '../../components/catalog/SavedRoomsCatalogPanel';
import { ROOM_TYPES, ROOM_TYPE_LABELS, type RoomVenueType } from '../../lib/roomVenueCompatibility';

type LabType = 'PHYSICS' | 'CHEMISTRY' | 'COMPUTER' | 'OTHER';

const LAB_TYPES: LabType[] = ['PHYSICS', 'CHEMISTRY', 'COMPUTER', 'OTHER'];

type Room = {
  id: number;
  building: string;
  buildingName?: string;
  roomNumber: string;
  type: string;
  labType: LabType | null;
  capacity: number | null;
  floorNumber: number | null;
  floorName: string | null;
  rawFloorNumber?: number | null;
  rawFloorName?: string | null;
  isSchedulable?: boolean;
};

type Page<T> = { content: T[]; totalElements?: number };

type CreateDraft = {
  building: string;
  roomNumber: string;
  type: RoomVenueType;
  labType: LabType | null;
  capacity: number | '';
  floorNumber: number | '';
  floorName: string;
};

const EMPTY_CREATE: CreateDraft = {
  building: '',
  roomNumber: '',
  type: 'STANDARD_CLASSROOM',
  labType: null,
  capacity: '',
  floorNumber: '',
  floorName: '',
};

export function RoomsModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') ?? 'browse') as 'browse' | 'add';
  const [tab, setTab] = useState<'browse' | 'add'>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE);

  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api.get<Page<Room>>('/api/rooms?size=1000&sort=building,asc')).data,
  });

  const list: Room[] = useMemo(() => rooms.data?.content ?? [], [rooms.data]);

  const status: { level: StatusLevel; label: string } = useMemo(() => {
    if (rooms.isLoading) return { level: 'idle', label: 'Loading' };
    if (rooms.isError) return { level: 'error', label: 'Load failed' };
    if (list.length === 0) return { level: 'idle', label: 'Empty' };
    return { level: 'ok', label: `${list.length} room${list.length === 1 ? '' : 's'}` };
  }, [rooms.isLoading, rooms.isError, list.length]);

  const createOne = useMutation({
    mutationFn: async (d: CreateDraft) => {
      if (!d.building.trim()) throw new Error('Building is required.');
      if (!d.roomNumber.trim()) throw new Error('Room number is required.');
      const body = {
        building: d.building.trim(),
        roomNumber: d.roomNumber.trim(),
        type: d.type,
        labType: d.type === 'SCIENCE_LAB' || d.type === 'COMPUTER_LAB' ? (d.labType ?? 'OTHER') : null,
        capacity: d.capacity === '' ? null : Math.max(0, Math.trunc(Number(d.capacity))),
        floorNumber: d.floorNumber === '' ? null : Math.trunc(Number(d.floorNumber)),
        floorName: d.floorName.trim() || null,
        floor:
          [d.floorNumber === '' ? '' : String(d.floorNumber), d.floorName.trim()].filter(Boolean).join(' / ') || null,
      };
      return (await api.post<Room>('/api/rooms', body)).data;
    },
    onSuccess: async (r) => {
      toast.success('Room added', `${r.buildingName ?? r.building} — ${r.roomNumber}`);
      setCreateDraft(EMPTY_CREATE);
      recordChange({
        id: `room:add:${r.id}`,
        scope: 'rooms',
        severity: 'soft',
        message: `Added room ${r.buildingName ?? r.building} ${r.roomNumber}`,
        refs: { roomIds: [r.id] },
      });
      await invalidate(['rooms']);
    },
    onError: (e) => toast.error('Could not add room', formatApiError(e)),
  });

  const setTabUrl = (next: 'browse' | 'add') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'browse') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const headerActions = (
    <>
      <Link to="/app" className="btn secondary">
        Back to hub
      </Link>
      <button type="button" className="btn" onClick={() => setTabUrl('add')}>
        + Add room
      </button>
    </>
  );

  return (
    <ModulePage
      title="Rooms"
      subtitle="Physical spaces available for scheduling. Type, capacity and schedulable flag affect timetable placement."
      status={status}
      headerActions={headerActions}
      tabs={[
        { id: 'browse', label: 'Browse', badge: list.length || null },
        { id: 'add', label: 'Add new' },
      ]}
      activeTabId={tab}
      tabHrefBase="/app/rooms"
    >
      {tab === 'add' ? (
        <AddRoomCard
          draft={createDraft}
          setDraft={setCreateDraft}
          busy={createOne.isPending}
          onSave={() => createOne.mutate(createDraft)}
        />
      ) : null}

      {tab === 'browse' ? (
        <div
          className="card"
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: '1px solid rgba(37,99,235,0.22)',
            background: 'rgba(239,246,255,0.75)',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 950, marginBottom: 4 }}>Bulk CSV, ranges & floor blocks</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            Rooms CSV, bulk room-number ranges, and onboarding batch tools are still in the wizard.{' '}
            <Link to={onboardingStepHref('ROOMS')} style={{ fontWeight: 900, color: 'var(--color-primary, #ea580c)' }}>
              Open wizard — Rooms step
            </Link>
            .
          </div>
        </div>
      ) : null}

      {tab === 'browse' ? (
        <div className="card stack" style={{ gap: 12, padding: 12, marginTop: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
          <SavedRoomsCatalogPanel />
        </div>
      ) : null}
    </ModulePage>
  );
}

function AddRoomCard({
  draft,
  setDraft,
  busy,
  onSave,
}: {
  draft: CreateDraft;
  setDraft: (d: CreateDraft) => void;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <div className="card stack" style={{ gap: 12, padding: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 14 }}>Add a room</div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Building" flex="2 1 200px">
          <input value={draft.building} onChange={(e) => setDraft({ ...draft, building: e.target.value })} placeholder="Main block" />
        </Field>
        <Field label="Room number" flex="1 1 140px">
          <input value={draft.roomNumber} onChange={(e) => setDraft({ ...draft, roomNumber: e.target.value })} placeholder="101" />
        </Field>
        <Field label="Floor #" flex="0 0 110px">
          <input
            type="number"
            value={draft.floorNumber === '' ? '' : draft.floorNumber}
            onChange={(e) =>
              setDraft({ ...draft, floorNumber: e.target.value === '' ? '' : Math.trunc(Number(e.target.value)) })
            }
          />
        </Field>
        <Field label="Floor name" flex="1 1 160px">
          <input value={draft.floorName} onChange={(e) => setDraft({ ...draft, floorName: e.target.value })} placeholder="Ground" />
        </Field>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Type" flex="1 1 200px">
          <SmartSelect
            value={draft.type}
            onChange={(v) =>
              setDraft({
                ...draft,
                type: v as RoomVenueType,
                labType:
                  v === 'SCIENCE_LAB' || v === 'COMPUTER_LAB' ? (draft.labType ?? 'OTHER') : null,
              })
            }
            options={ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] }))}
          />
        </Field>
        {draft.type === 'SCIENCE_LAB' || draft.type === 'COMPUTER_LAB' ? (
          <Field label="Lab type" flex="1 1 160px">
            <SmartSelect
              value={draft.labType ?? 'OTHER'}
              onChange={(v) => setDraft({ ...draft, labType: v as LabType })}
              options={LAB_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Field>
        ) : null}
        <Field label="Capacity" flex="0 0 130px">
          <input
            type="number"
            min={0}
            max={500}
            value={draft.capacity === '' ? '' : draft.capacity}
            onChange={(e) =>
              setDraft({ ...draft, capacity: e.target.value === '' ? '' : Math.max(0, Math.trunc(Number(e.target.value))) })
            }
          />
        </Field>
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onSave} disabled={busy || !draft.building.trim() || !draft.roomNumber.trim()}>
          {busy ? 'Adding…' : 'Add room'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, flex, children }: { label: string; flex?: string; children: ReactNode }) {
  return (
    <label className="stack" style={{ gap: 6, flex: flex ?? '1 1 200px' }}>
      <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
