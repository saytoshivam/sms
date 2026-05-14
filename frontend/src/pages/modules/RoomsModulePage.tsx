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
import { SavedRoomsCatalogPanel } from '../../components/catalog/SavedRoomsCatalogPanel';
import { ROOM_TYPES, ROOM_TYPE_LABELS, type RoomVenueType } from '../../lib/roomVenueCompatibility';
import { pageContent } from '../../lib/springPageContent';

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

type BulkGenDraft = {
  building: string;
  floorNumber: number | '';
  floorName: string;
  type: RoomVenueType;
  labType: LabType | null;
  capacity: number | '';
  bulkStart: number | '';
  bulkEnd: number | '';
};

const EMPTY_BULK_GEN: BulkGenDraft = {
  building: '',
  floorNumber: '',
  floorName: '',
  type: 'STANDARD_CLASSROOM',
  labType: null,
  capacity: '',
  bulkStart: 101,
  bulkEnd: 110,
};

function isSchedulableLabType(t: RoomVenueType): boolean {
  return t === 'SCIENCE_LAB' || t === 'COMPUTER_LAB';
}

export function RoomsModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') ?? 'browse') as 'browse' | 'add' | 'generate';
  const [tab, setTab] = useState<'browse' | 'add' | 'generate'>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE);
  const [bulkGenDraft, setBulkGenDraft] = useState<BulkGenDraft>(EMPTY_BULK_GEN);

  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api.get<Page<Room>>('/api/rooms?size=1000&sort=building,asc')).data,
  });

  const roomsSaved = useQuery({
    queryKey: ['rooms-saved'],
    queryFn: async () => (await api.get<Page<Room>>('/api/rooms?page=0&size=500&sort=id,desc')).data,
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

  const generateRooms = useMutation({
    mutationFn: async (d: BulkGenDraft) => {
      if (!d.building.trim()) throw new Error('Building is required.');
      const start = Number(d.bulkStart);
      const end = Number(d.bulkEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Start and end room numbers are required.');
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      if (hi - lo > 199) throw new Error('Range too large. Keep the range to 200 rooms or fewer at once.');

      const savedList = pageContent(roomsSaved.data ?? null) as Room[];
      const savedKeys = new Set(
        savedList.map((r) => `${String(r.buildingName ?? r.building ?? '').trim().toLowerCase()}||${String(r.roomNumber ?? '').trim().toLowerCase()}`),
      );

      const building = d.building.trim();
      const floorNumber = d.floorNumber === '' ? null : Math.trunc(Number(d.floorNumber));
      const floorName = d.floorName.trim() || null;
      const floor = [floorNumber != null ? String(floorNumber) : '', floorName ?? ''].filter(Boolean).join(' / ') || null;
      const type = d.type;
      const labType = isSchedulableLabType(type) ? (d.labType ?? 'OTHER') : null;
      const capacity = d.capacity === '' ? null : Math.max(0, Math.trunc(Number(d.capacity)));

      let created = 0;
      let skipped = 0;
      const newIds: number[] = [];

      for (let n = lo; n <= hi; n++) {
        const roomNumber = String(n);
        const dupKey = `${building.toLowerCase()}||${roomNumber.toLowerCase()}`;
        if (savedKeys.has(dupKey)) {
          skipped++;
          continue;
        }
        const body = { building, roomNumber, type, labType, capacity, floorNumber, floorName, floor };
        try {
          const res = await api.post<Room>('/api/rooms', body);
          newIds.push(res.data.id);
          created++;
          savedKeys.add(dupKey);
        } catch {
          skipped++;
        }
      }

      return { created, skipped, newIds };
    },
    onSuccess: async ({ created, skipped, newIds }) => {
      if (created === 0 && skipped > 0) {
        toast.info('No new rooms', `All ${skipped} room(s) already exist.`);
      } else {
        toast.success('Rooms generated', `${created} created · ${skipped > 0 ? `${skipped} skipped` : 'none skipped'}`);
      }
      if (newIds.length) {
        recordChange({
          id: `rooms:bulk-gen:${newIds[0]}-${newIds.length}`,
          scope: 'rooms',
          severity: 'soft',
          message: `Bulk generated ${newIds.length} room(s)`,
          refs: { roomIds: newIds },
        });
      }
      await invalidate(['rooms']);
    },
    onError: (e) => toast.error('Could not generate rooms', formatApiError(e)),
  });

  const setTabUrl = (next: 'browse' | 'add' | 'generate') => {
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
      <Link to="/app/rooms/bulk-import" className="btn secondary">
        Bulk import
      </Link>
      <button type="button" className="btn secondary" onClick={() => setTabUrl('generate')}>
        🔢 Bulk generate
      </button>
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
        { id: 'generate', label: 'Bulk generate' },
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

      {tab === 'generate' ? (
        <BulkGenerateRoomsCard
          draft={bulkGenDraft}
          setDraft={setBulkGenDraft}
          busy={generateRooms.isPending}
          onGenerate={() => generateRooms.mutate(bulkGenDraft)}
        />
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

function BulkGenerateRoomsCard({
  draft,
  setDraft,
  busy,
  onGenerate,
}: {
  draft: BulkGenDraft;
  setDraft: (d: BulkGenDraft) => void;
  busy: boolean;
  onGenerate: () => void;
}) {
  const canGenerate =
    draft.building.trim() !== '' &&
    Number.isFinite(Number(draft.bulkStart)) &&
    Number.isFinite(Number(draft.bulkEnd));

  return (
    <div className="card stack" style={{ gap: 12, padding: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 14 }}>Bulk generate rooms by number range</div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Set the building, floor, type, and capacity — then specify a <strong>Start #</strong> and <strong>End #</strong>{' '}
        to generate a numbered sequence (e.g. 101–110). Already-existing rooms with the same building + number are skipped.
      </p>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Building *" flex="2 1 200px">
          <input
            value={draft.building}
            onChange={(e) => setDraft({ ...draft, building: e.target.value })}
            placeholder="Block A"
          />
        </Field>
        <Field label="Floor #" flex="0 0 110px">
          <input
            type="number"
            value={draft.floorNumber === '' ? '' : draft.floorNumber}
            onChange={(e) =>
              setDraft({ ...draft, floorNumber: e.target.value === '' ? '' : Math.trunc(Number(e.target.value)) })
            }
            placeholder="1"
          />
        </Field>
        <Field label="Floor name" flex="1 1 160px">
          <input
            value={draft.floorName}
            onChange={(e) => setDraft({ ...draft, floorName: e.target.value })}
            placeholder="Ground"
          />
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
            placeholder="40"
          />
        </Field>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Start # *" flex="0 0 140px">
          <input
            type="number"
            value={draft.bulkStart === '' ? '' : draft.bulkStart}
            onChange={(e) => setDraft({ ...draft, bulkStart: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder="101"
          />
        </Field>
        <Field label="End # *" flex="0 0 140px">
          <input
            type="number"
            value={draft.bulkEnd === '' ? '' : draft.bulkEnd}
            onChange={(e) => setDraft({ ...draft, bulkEnd: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder="110"
          />
        </Field>
        {Number.isFinite(Number(draft.bulkStart)) && Number.isFinite(Number(draft.bulkEnd)) ? (
          <div className="muted" style={{ fontSize: 12, fontWeight: 800, alignSelf: 'flex-end', paddingBottom: 6 }}>
            {Math.abs(Number(draft.bulkEnd) - Number(draft.bulkStart)) + 1} room(s) in range
          </div>
        ) : null}
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn"
          onClick={onGenerate}
          disabled={busy || !canGenerate}
        >
          {busy ? 'Generating…' : 'Generate rooms'}
        </button>
      </div>
    </div>
  );
}

