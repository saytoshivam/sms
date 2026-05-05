import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { pageContent } from '../../lib/springPageContent';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import { RowActionsMenu } from '../RowActionsMenu';
import { ConfirmDialog } from '../ConfirmDialog';
import { SmartSelect } from '../SmartSelect';
import { parseRoomVenueType, ROOM_TYPES, ROOM_TYPE_LABELS } from '../../lib/roomVenueCompatibility';

type RoomOption = {
  id: number;
  building?: string | null;
  buildingName?: string | null;
  floorName?: string | null;
  rawFloorNumber?: number | null;
  rawFloorName?: string | null;
  roomNumber: string;
  type?: string | null;
  capacity?: number | null;
  labType?: string | null;
  isSchedulable?: boolean;
};

type ClassDefaultRoomRow = {
  classGroupId: number;
  code: string;
  displayName: string;
  gradeLevel: number | null;
  section: string | null;
  defaultRoomId: number | null;
};

type DeleteInfo = { canDelete: boolean; reasons: string[] };

/** Same “Saved rooms” accordion + table as the onboarding Rooms step */
export function SavedRoomsCatalogPanel() {
  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const [savedRoomsExpandedBuildings, setSavedRoomsExpandedBuildings] = useState<Record<string, boolean>>({});
  const [savedRoomsExpandedFloors, setSavedRoomsExpandedFloors] = useState<Record<string, boolean>>({});
  const [roomDeleteInfoCache, setRoomDeleteInfoCache] = useState<Record<number, DeleteInfo>>({});
  const [savedRoomsTypeFilter, setSavedRoomsTypeFilter] = useState<string>('ALL');

  const [roomDeleteModal, setRoomDeleteModal] = useState<{
    open: boolean;
    roomId: number | null;
    building: string;
    floor: string;
    roomNumber: string;
    canDelete: boolean;
    reasons: string[];
    busy: boolean;
  }>({ open: false, roomId: null, building: '', floor: '', roomNumber: '', canDelete: true, reasons: [], busy: false });

  const [roomEdit, setRoomEdit] = useState<{
    roomId: number | null;
    type: string;
    labType: string;
    capacity: number | '';
    isSchedulable: boolean;
    busy: boolean;
  }>({ roomId: null, type: 'STANDARD_CLASSROOM', labType: 'PHYSICS', capacity: '', isSchedulable: true, busy: false });

  const roomsSaved = useQuery({
    queryKey: ['rooms-saved-onboarding'],
    queryFn: async () =>
      (await api.get('/api/rooms?page=0&size=500&sort=id,desc')).data as RoomOption[] | { content: RoomOption[] },
  });

  const classDefaultRoomsOnboarding = useQuery({
    queryKey: ['onboarding-class-default-rooms'],
    queryFn: async () => (await api.get<ClassDefaultRoomRow[]>('/api/v1/onboarding/class-default-rooms')).data,
  });

  async function ensureRoomDeleteInfo(roomId: number) {
    if (roomDeleteInfoCache[roomId]) return roomDeleteInfoCache[roomId];
    const info = (await api.get<DeleteInfo>(`/api/rooms/${roomId}/delete-info`)).data;
    setRoomDeleteInfoCache((p) => ({ ...p, [roomId]: info }));
    return info;
  }

  useEffect(() => {
    const rows = pageContent(roomsSaved.data);
    if (!rows.length) return;
    (async () => {
      for (const r of rows.slice(0, 80)) {
        if (!r?.id) continue;
        if (roomDeleteInfoCache[r.id]) continue;
        try {
          const info = (await api.get<DeleteInfo>(`/api/rooms/${r.id}/delete-info`)).data;
          setRoomDeleteInfoCache((p) => ({ ...p, [r.id]: info }));
        } catch {
          // ignore prefetch failures
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsSaved.data]);

  const typeFilterOptions = [{ value: 'ALL', label: 'All types' }, ...ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] }))];

  return (
    <>
      <div className="stack" style={{ gap: 10, marginTop: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontWeight: 900 }}>Saved rooms</div>
            <div style={{ minWidth: 200 }}>
              <SmartSelect
                value={savedRoomsTypeFilter}
                onChange={(v) => setSavedRoomsTypeFilter(v || 'ALL')}
                options={[...typeFilterOptions]}
                ariaLabel="Filter by room type"
              />
            </div>
            <button type="button" className="btn secondary" style={{ padding: '6px 10px' }} onClick={() => roomsSaved.refetch()}>
              Refresh
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {roomsSaved.isLoading ? 'Loading…' : `${pageContent(roomsSaved.data).length} room(s)`}
          </div>
        </div>

        {roomsSaved.isError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Couldn’t load saved rooms</div>
              <div className="sms-alert__msg">{formatApiError(roomsSaved.error)}</div>
            </div>
          </div>
        ) : null}

        {(() => {
          const rows = pageContent(roomsSaved.data)
            .slice()
            .filter((r) => {
              if (savedRoomsTypeFilter === 'ALL') return true;
              return parseRoomVenueType(r.type) === savedRoomsTypeFilter;
            })
            .sort((a, b) => {
              const ba = String(a.buildingName ?? a.building ?? '').localeCompare(String(b.buildingName ?? b.building ?? ''));
              if (ba !== 0) return ba;
              const fa = String(a.floorName ?? '');
              const fb = String(b.floorName ?? '');
              const fcmp = fa.localeCompare(fb);
              if (fcmp !== 0) return fcmp;
              return String(a.roomNumber ?? '').localeCompare(String(b.roomNumber ?? ''), undefined, { numeric: true });
            });

          if (rows.length === 0 && !roomsSaved.isLoading)
            return <div className="muted">No rooms saved yet.</div>;
          if (roomsSaved.isLoading) return <div className="muted">Loading rooms…</div>;

          const roomIdToAssigned = new Map<number, string[]>();
          for (const row of classDefaultRoomsOnboarding.data ?? []) {
            if (!row.defaultRoomId) continue;
            const label = row.code || row.displayName || `Class #${row.classGroupId}`;
            const arr = roomIdToAssigned.get(row.defaultRoomId) ?? [];
            arr.push(`${label} (Default)`);
            roomIdToAssigned.set(row.defaultRoomId, arr);
          }

          const grouped = new Map<string, Map<string, RoomOption[]>>();
          for (const r of rows) {
            const building = (r.buildingName ?? r.building ?? '—').trim() || '—';
            const floor = (r.floorName ?? '').trim() || 'No floor';
            const byFloor = grouped.get(building) ?? new Map<string, RoomOption[]>();
            const arr = byFloor.get(floor) ?? [];
            arr.push(r);
            byFloor.set(floor, arr);
            grouped.set(building, byFloor);
          }

          return (
            <div className="stack" style={{ gap: 12 }}>
              {Array.from(grouped.entries()).map(([building, byFloor]) => {
                const bOpen = savedRoomsExpandedBuildings[building] ?? true;
                return (
                  <div key={building} className="card stack" style={{ padding: 12, gap: 10 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="row" style={{ gap: 10 }}>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ padding: '7px 10px', borderRadius: 12 }}
                          onClick={() =>
                            setSavedRoomsExpandedBuildings((p) => ({
                              ...p,
                              [building]: !(p[building] ?? true),
                            }))
                          }
                        >
                          {bOpen ? 'Hide' : 'Show'}
                        </button>
                        <div style={{ fontWeight: 950 }}>{building}</div>
                      </div>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        {Array.from(byFloor.values()).reduce((acc, v) => acc + v.length, 0)} room(s)
                      </div>
                    </div>

                    {bOpen ? (
                      <>
                        {Array.from(byFloor.entries()).map(([floor, list]) => {
                          const k = `${building}::${floor}`;
                          const fOpen = savedRoomsExpandedFloors[k] ?? true;
                          return (
                            <div key={floor} className="stack" style={{ gap: 8, paddingLeft: 8 }}>
                              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="row" style={{ gap: 10 }}>
                                  <button
                                    type="button"
                                    className="btn secondary"
                                    style={{ padding: '6px 9px', borderRadius: 12 }}
                                    onClick={() =>
                                      setSavedRoomsExpandedFloors((p) => ({
                                        ...p,
                                        [k]: !(p[k] ?? true),
                                      }))
                                    }
                                  >
                                    {fOpen ? 'Hide' : 'Show'}
                                  </button>
                                  <div className="muted" style={{ fontWeight: 900 }}>
                                    {floor}
                                  </div>
                                </div>
                                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                                  {list.length} room(s)
                                </div>
                              </div>

                              {fOpen ? (
                                <div style={{ overflowX: 'auto' }}>
                                  <table className="data-table">
                                    <thead>
                                      <tr>
                                        <th>Room</th>
                                        <th>Type</th>
                                        <th>Capacity</th>
                                        <th>Usage</th>
                                        <th>Assigned to</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {list
                                        .sort((a, b) =>
                                          a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
                                        )
                                        .map((r) => (
                                          <tr key={r.id}>
                                            <td style={{ fontWeight: 900 }}>
                                              <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                                                <span style={{ width: 62 }}>{r.roomNumber}</span>
                                                {r.isSchedulable === false ? <span className="muted">(Not bookable)</span> : null}
                                              </span>
                                            </td>
                                            <td className="muted" style={{ fontWeight: 900 }}>
                                              {(() => {
                                                const t = parseRoomVenueType(r.type);
                                                if (!t) return '—';
                                                const labSuffix =
                                                  (t === 'SCIENCE_LAB' || t === 'COMPUTER_LAB') && r.labType
                                                    ? ` (${r.labType})`
                                                    : '';
                                                return (
                                                  <span style={{ whiteSpace: 'nowrap' }}>
                                                    {ROOM_TYPE_LABELS[t]}
                                                    {labSuffix}
                                                  </span>
                                                );
                                              })()}
                                            </td>
                                            <td>{r.capacity == null ? 'Not set' : r.capacity}</td>
                                            <td>
                                              {(() => {
                                                const rt = parseRoomVenueType(r.type);
                                                return rt === 'SCIENCE_LAB' || rt === 'COMPUTER_LAB';
                                              })() ? (
                                                <span style={{ fontWeight: 900, color: '#a16207' }}>Shared</span>
                                              ) : (
                                                <span className="muted" style={{ fontWeight: 900 }}>
                                                  Exclusive
                                                </span>
                                              )}
                                            </td>
                                            <td>
                                              {(() => {
                                                const assigned = roomIdToAssigned.get(r.id) ?? [];
                                                if (assigned.length) {
                                                  const head = assigned[0];
                                                  const more = assigned.length > 1 ? ` +${assigned.length - 1}` : '';
                                                  return (
                                                    <span title={assigned.join('\n')} style={{ fontWeight: 900 }}>
                                                      {head}
                                                      {more}
                                                    </span>
                                                  );
                                                }
                                                return <span className="muted">—</span>;
                                              })()}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              <RowActionsMenu
                                                ariaLabel={`Actions for room ${r.roomNumber}`}
                                                actions={[
                                                  {
                                                    id: 'edit',
                                                    label: 'Edit',
                                                    onSelect: () =>
                                                      setRoomEdit({
                                                        roomId: r.id,
                                                        type: parseRoomVenueType(String(r.type ?? '')) ?? 'STANDARD_CLASSROOM',
                                                        labType: String(r.labType ?? 'PHYSICS'),
                                                        capacity: typeof r.capacity === 'number' ? r.capacity : '',
                                                        isSchedulable: r.isSchedulable !== false,
                                                        busy: false,
                                                      }),
                                                  },
                                                  {
                                                    id: 'delete',
                                                    label: 'Delete',
                                                    danger: true,
                                                    disabled: roomDeleteInfoCache[r.id]?.canDelete === false,
                                                    disabledReason: roomDeleteInfoCache[r.id]?.reasons?.join(' ') || undefined,
                                                    onSelect: async () => {
                                                      const info = await ensureRoomDeleteInfo(r.id);
                                                      setRoomDeleteModal({
                                                        open: true,
                                                        roomId: r.id,
                                                        building: String(r.buildingName ?? r.building ?? ''),
                                                        floor: String(r.floorName ?? ''),
                                                        roomNumber: String(r.roomNumber ?? ''),
                                                        canDelete: info.canDelete,
                                                        reasons: info.reasons ?? [],
                                                        busy: false,
                                                      });
                                                    },
                                                  },
                                                ]}
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="muted" style={{ fontSize: 12 }}>
                                  Hidden
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Hidden
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      <ConfirmDialog
        open={roomDeleteModal.open}
        title="Delete room?"
        description={
          roomDeleteModal.roomId
            ? `This will delete ${roomDeleteModal.building}${roomDeleteModal.floor ? ` / ${roomDeleteModal.floor}` : ''} / ${roomDeleteModal.roomNumber}.`
            : undefined
        }
        details={
          roomDeleteModal.canDelete
            ? ['This room will be hidden from lists.']
            : ['This room cannot be deleted right now:', ...(roomDeleteModal.reasons.length ? roomDeleteModal.reasons : ['In use.'])]
        }
        danger
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmDisabled={!roomDeleteModal.canDelete || roomDeleteModal.busy}
        onClose={() => setRoomDeleteModal((p) => ({ ...p, open: false }))}
        onConfirm={async () => {
          if (!roomDeleteModal.roomId) return;
          if (!roomDeleteModal.canDelete) return;
          setRoomDeleteModal((p) => ({ ...p, busy: true }));
          try {
            await api.delete(`/api/rooms/${roomDeleteModal.roomId}`);
            setRoomDeleteInfoCache((p) => {
              const next = { ...p };
              delete next[roomDeleteModal.roomId as number];
              return next;
            });
            recordChange({
              id: `room:del:${roomDeleteModal.roomId}`,
              scope: 'rooms',
              severity: 'hard',
              message: `Deleted room ${roomDeleteModal.roomNumber}`,
              refs: { roomIds: [roomDeleteModal.roomId] },
            });
            await invalidate(['rooms']);
            toast.success('Deleted', `Room ${roomDeleteModal.roomNumber} removed.`);
            setRoomDeleteModal((p) => ({ ...p, open: false, busy: false }));
          } catch (e) {
            toast.error('Delete failed', formatApiError(e));
            setRoomDeleteModal((p) => ({ ...p, busy: false }));
          }
        }}
      />

      <ConfirmDialog
        open={roomEdit.roomId != null}
        title="Edit room"
        description={roomEdit.roomId != null ? 'Update room type, lab type, and capacity.' : undefined}
        details={['Changes apply immediately. Lab subtype applies when type is Science lab or Computer lab.']}
        confirmLabel={roomEdit.busy ? 'Saving…' : 'Save changes'}
        cancelLabel="Cancel"
        confirmDisabled={roomEdit.busy}
        onClose={() => setRoomEdit((p) => ({ ...p, roomId: null, busy: false }))}
        onConfirm={async () => {
          if (!roomEdit.roomId) return;
          const prevSnapshot = pageContent(roomsSaved.data).find((x) => x.id === roomEdit.roomId);
          setRoomEdit((p) => ({ ...p, busy: true }));
          try {
            await api.put(`/api/rooms/${roomEdit.roomId}`, {
              type: roomEdit.type,
              capacity: roomEdit.capacity === '' ? null : Number(roomEdit.capacity),
              labType:
                roomEdit.type === 'SCIENCE_LAB' || roomEdit.type === 'COMPUTER_LAB' ? roomEdit.labType : null,
              isSchedulable: roomEdit.isSchedulable,
            });
            const typeChanged =
              !!prevSnapshot && String(prevSnapshot.type ?? '').toUpperCase() !== String(roomEdit.type).toUpperCase();
            const prevSched = prevSnapshot ? prevSnapshot.isSchedulable !== false : true;
            const schedChanged = prevSnapshot != null && prevSched !== roomEdit.isSchedulable;
            recordChange({
              id: `room:edit:${roomEdit.roomId}`,
              scope: 'rooms',
              severity: typeChanged || schedChanged ? 'hard' : 'soft',
              message: 'Room updated from catalog.',
              refs: { roomIds: [roomEdit.roomId] },
            });
            await invalidate(['rooms']);
            toast.success('Saved', 'Room updated.');
            setRoomEdit((p) => ({ ...p, roomId: null, busy: false }));
          } catch (e) {
            toast.error('Save failed', formatApiError(e));
            setRoomEdit((p) => ({ ...p, busy: false }));
          }
        }}
      >
        <div className="stack" style={{ gap: 10 }}>
          <div className="stack">
            <label>Type</label>
            <SmartSelect
              value={roomEdit.type}
              onChange={(v) =>
                setRoomEdit((p) => ({
                  ...p,
                  type: v || 'STANDARD_CLASSROOM',
                  labType:
                    v === 'SCIENCE_LAB' || v === 'COMPUTER_LAB' ? (p.labType || 'OTHER') : p.labType,
                }))
              }
              options={ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] }))}
              ariaLabel="Room type"
            />
          </div>
          {roomEdit.type === 'SCIENCE_LAB' || roomEdit.type === 'COMPUTER_LAB' ? (
            <div className="stack">
              <label>Lab type</label>
              <SmartSelect
                value={roomEdit.labType}
                onChange={(v) => setRoomEdit((p) => ({ ...p, labType: v || 'OTHER' }))}
                options={[
                  { value: 'PHYSICS', label: 'Physics' },
                  { value: 'CHEMISTRY', label: 'Chemistry' },
                  { value: 'COMPUTER', label: 'Computer' },
                  { value: 'OTHER', label: 'Other' },
                ]}
                ariaLabel="Lab type"
              />
            </div>
          ) : null}
          <div className="stack">
            <label>Capacity</label>
            <input
              type="number"
              min={1}
              value={roomEdit.capacity}
              onChange={(e) => setRoomEdit((p) => ({ ...p, capacity: e.target.value === '' ? '' : Number(e.target.value) }))}
              placeholder="Not set"
            />
          </div>
          <label className="row" style={{ gap: 10, alignItems: 'center', fontWeight: 900 }}>
            <input
              className="sms-checkbox"
              type="checkbox"
              checked={roomEdit.isSchedulable}
              onChange={(e) => setRoomEdit((p) => ({ ...p, isSchedulable: e.target.checked }))}
            />
            Bookable in timetable
          </label>
        </div>
      </ConfirmDialog>
    </>
  );
}
