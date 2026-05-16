import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { pageContent } from '../../lib/springPageContent';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import { RowActionsMenu } from '../RowActionsMenu';
import { ConfirmDialog } from '../ConfirmDialog';
import { SmartSelect } from '../SmartSelect';
import {
  formatCompatibleRoomTypesList,
  parseRoomVenueType,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  schoolHasAnyCompatibleRoom,
} from '../../lib/roomVenueCompatibility';
import {
  parseSubjectVenueRequirement,
  SUBJECT_VENUE_LABELS,
  SUBJECT_VENUE_REQUIREMENTS,
} from '../../lib/subjectVenueRequirement';

type SubjectCatalogRow = {
  id: number;
  code: string;
  name: string;
  weeklyFrequency?: number | null;
  allocationVenueRequirement?: string | null;
  specializedVenueType?: string | null;
};

function normalizeSubjectCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function isValidSubjectCode(code: string) {
  return /^[A-Z0-9]{3,32}$/.test(code);
}

/** Saved subjects table + edit/delete flows (same as onboarding Subjects step) */
export function SavedSubjectsCatalogPanel({ readOnly = false }: { readOnly?: boolean }) {
  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const [subjectSearch, setSubjectSearch] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  const [subjectDeleteInfoCache, setSubjectDeleteInfoCache] = useState<
    Record<number, { canDelete: boolean; reasons: string[] }>
  >({});

  const [subjectDeleteModal, setSubjectDeleteModal] = useState<{
    open: boolean;
    subjectId: number | null;
    subjectName: string;
    subjectCode: string;
    canDelete: boolean;
    reasons: string[];
    busy: boolean;
  }>({ open: false, subjectId: null, subjectName: '', subjectCode: '', canDelete: true, reasons: [], busy: false });

  const [subjectEditModal, setSubjectEditModal] = useState<{
    open: boolean;
    subjectId: number | null;
    name: string;
    code: string;
    weeklyFrequency: number | null;
    allocationVenueRequirement: string;
    specializedVenueType: string;
    busy: boolean;
  }>({
    open: false,
    subjectId: null,
    name: '',
    code: '',
    weeklyFrequency: null,
    allocationVenueRequirement: 'STANDARD_CLASSROOM',
    specializedVenueType: '',
    busy: false,
  });

  const roomsForVenue = useQuery({
    queryKey: ['rooms-venue-check-catalog'],
    queryFn: async () => (await api.get<{ content?: Array<{ type?: string | null }> }>('/api/rooms?size=500')).data,
    staleTime: 120_000,
  });

  const subjectsCatalog = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () =>
      (await api.get('/api/subjects?size=1000&sort=name,asc')).data as SubjectCatalogRow[] | { content: SubjectCatalogRow[] },
  });

  const deleteAllSubjects = useMutation({
    mutationFn: async () => api.delete('/api/subjects/delete-all'),
    onSuccess: async () => {
      setDeleteAllOpen(false);
      recordChange({
        id: 'subjects:delete-all',
        scope: 'subjects',
        severity: 'hard',
        message: 'Deleted all subjects',
        refs: {},
      });
      await invalidate(['subjects']);
      toast.success('Deleted', 'All subjects were deleted.');
    },
    onError: (e) => toast.error('Delete failed', formatApiError(e)),
  });

  async function ensureSubjectDeleteInfo(subjectId: number) {
    if (subjectDeleteInfoCache[subjectId]) return subjectDeleteInfoCache[subjectId];
    const info = (await api.get<{ canDelete: boolean; reasons: string[] }>(`/api/subjects/${subjectId}/delete-info`)).data;
    setSubjectDeleteInfoCache((p) => ({ ...p, [subjectId]: info }));
    return info;
  }

  const saveSubjectEdit = useMemo(
    () =>
      async ({
        subjectId,
        name,
        code,
        weeklyFrequency,
        allocationVenueRequirement,
        specializedVenueType,
      }: {
        subjectId: number;
        name: string;
        code: string;
        weeklyFrequency: number | null;
        allocationVenueRequirement: string;
        specializedVenueType: string;
      }) => {
        const req = parseSubjectVenueRequirement(allocationVenueRequirement);
        await api.put(`/api/subjects/${subjectId}`, {
          name,
          code,
          weeklyFrequency,
          allocationVenueRequirement: req,
          specializedVenueType: req === 'SPECIALIZED_ROOM' ? specializedVenueType.trim() || null : null,
        });
      },
    [],
  );

  return (
    <>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        <input
          style={{ flex: '1 1 260px' }}
          value={subjectSearch}
          onChange={(e) => setSubjectSearch(e.target.value)}
          placeholder="Search subjects…"
        />
        <span className="muted" style={{ fontSize: 12 }}>
          Filters the saved list below
        </span>
      </div>

      <div className="stack" style={{ gap: 10, marginTop: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontWeight: 900 }}>Saved subjects</div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div className="muted" style={{ fontSize: 12 }}>
              {subjectsCatalog.isLoading ? 'Loading…' : `${pageContent(subjectsCatalog.data).length} subjects`}
            </div>
            {!readOnly && (
              <RowActionsMenu
                ariaLabel="Subjects catalog actions"
                actions={[
                  {
                    id: 'delete-all-subjects',
                    label: 'Delete all subjects',
                    danger: true,
                    onSelect: () => setDeleteAllOpen(true),
                  },
                ]}
              />
            )}
          </div>
        </div>

        {subjectsCatalog.isError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Couldn’t load saved subjects</div>
              <div className="sms-alert__msg">{formatApiError(subjectsCatalog.error)}</div>
            </div>
          </div>
        ) : null}

        {subjectsCatalog.isLoading ? (
          <div className="muted">Loading subjects…</div>
        ) : pageContent(subjectsCatalog.data).length === 0 ? (
          <div className="muted">No subjects saved yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>Subject</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    Room need
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    Freq/wk
                  </th>
                  {readOnly ? null : (
                    <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageContent(subjectsCatalog.data)
                  .slice()
                  .sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')))
                  .filter((s) => {
                    const q = subjectSearch.trim().toLowerCase();
                    if (!q) return true;
                    return String(s.name ?? '').toLowerCase().includes(q) || String(s.code ?? '').toLowerCase().includes(q);
                  })
                  .map((s) => (
                    <tr key={s.id}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ fontWeight: 800 }}>{s.name}</div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                        <span className="muted" style={{ fontWeight: 900 }}>
                          {s.code}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                        <span className="muted" style={{ fontWeight: 800, fontSize: 12 }}>
                          {SUBJECT_VENUE_LABELS[parseSubjectVenueRequirement(s.allocationVenueRequirement)]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)', textAlign: 'right' }}>
                        <span style={{ fontWeight: 900 }}>{s.weeklyFrequency ?? '—'}</span>
                      </td>
                      {readOnly ? null : (
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)', textAlign: 'right' }}>
                          <RowActionsMenu
                            ariaLabel={`Actions for ${s.name}`}
                            actions={[
                              {
                                id: 'edit',
                                label: 'Edit',
                                onSelect: () => {
                                  setSubjectEditModal({
                                    open: true,
                                    subjectId: s.id,
                                    name: s.name,
                                    code: s.code,
                                    weeklyFrequency: s.weeklyFrequency ?? null,
                                    allocationVenueRequirement: parseSubjectVenueRequirement(s.allocationVenueRequirement),
                                    specializedVenueType: s.specializedVenueType ?? '',
                                    busy: false,
                                  });
                                },
                              },
                              {
                                id: 'delete',
                                label: 'Delete',
                                danger: true,
                                disabled: subjectDeleteInfoCache[s.id]?.canDelete === false,
                                disabledReason: subjectDeleteInfoCache[s.id]?.reasons?.join(' ') || undefined,
                                onSelect: async () => {
                                  const info = await ensureSubjectDeleteInfo(s.id);
                                  setSubjectDeleteModal({
                                    open: true,
                                    subjectId: s.id,
                                    subjectName: s.name,
                                    subjectCode: s.code,
                                    canDelete: info.canDelete,
                                    reasons: info.reasons ?? [],
                                    busy: false,
                                  });
                                },
                              },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={subjectDeleteModal.open}
        title={`Delete ${subjectDeleteModal.subjectName || 'subject'}?`}
        description={`This will delete ${subjectDeleteModal.subjectCode} and remove it from academic structure and timetable references.`}
        danger
        confirmLabel={subjectDeleteModal.busy ? 'Deleting…' : 'Delete'}
        confirmDisabled={!subjectDeleteModal.canDelete || subjectDeleteModal.busy}
        onClose={() => setSubjectDeleteModal((p) => ({ ...p, open: false }))}
        onConfirm={async () => {
          if (!subjectDeleteModal.subjectId) return;
          if (!subjectDeleteModal.canDelete) return;
          setSubjectDeleteModal((p) => ({ ...p, busy: true }));
          try {
            await api.delete(`/api/subjects/${subjectDeleteModal.subjectId}`);
            setSubjectDeleteInfoCache((p) => {
              const next = { ...p };
              delete next[subjectDeleteModal.subjectId as number];
              return next;
            });
            recordChange({
              id: `subject:del:${subjectDeleteModal.subjectId}`,
              scope: 'subjects',
              severity: 'hard',
              message: `Deleted subject ${subjectDeleteModal.subjectCode}`,
              refs: { subjectIds: [subjectDeleteModal.subjectId] },
            });
            await invalidate(['subjects']);
            toast.success('Deleted', `${subjectDeleteModal.subjectCode} removed.`);
            setSubjectDeleteModal((p) => ({ ...p, open: false, busy: false }));
          } catch (e) {
            toast.error('Delete failed', formatApiError(e));
            setSubjectDeleteModal((p) => ({ ...p, busy: false }));
          }
        }}
      />

      <ConfirmDialog
        open={deleteAllOpen}
        title="Delete all subjects?"
        description="This removes all subjects in the catalog and clears related academic structure and timetable references."
        danger
        confirmLabel={deleteAllSubjects.isPending ? 'Deleting…' : 'Delete all'}
        confirmDisabled={deleteAllSubjects.isPending}
        onClose={() => (deleteAllSubjects.isPending ? null : setDeleteAllOpen(false))}
        onConfirm={async () => {
          await deleteAllSubjects.mutateAsync();
        }}
      />

      <ConfirmDialog
        open={subjectEditModal.open}
        title="Edit subject"
        description="Name and code are used across academic structure, staff teachables, and timetables. Code must stay unique in your school."
        confirmLabel={subjectEditModal.busy ? 'Saving…' : 'Save'}
        confirmDisabled={
          subjectEditModal.busy ||
          !subjectEditModal.name.trim() ||
          !isValidSubjectCode(normalizeSubjectCode(subjectEditModal.code)) ||
          !(
            subjectEditModal.weeklyFrequency == null ||
            (Number.isFinite(subjectEditModal.weeklyFrequency) && subjectEditModal.weeklyFrequency > 0)
          )
        }
        onClose={() =>
          setSubjectEditModal({
            open: false,
            subjectId: null,
            name: '',
            code: '',
            weeklyFrequency: null,
            allocationVenueRequirement: 'STANDARD_CLASSROOM',
            specializedVenueType: '',
            busy: false,
          })
        }
        onConfirm={async () => {
          if (!subjectEditModal.subjectId) return;
          const name = subjectEditModal.name.trim();
          const code = normalizeSubjectCode(subjectEditModal.code);
          if (!name || !isValidSubjectCode(code)) return;
          const prev = pageContent(subjectsCatalog.data).find((x) => x.id === subjectEditModal.subjectId);
          setSubjectEditModal((p) => ({ ...p, busy: true }));
          try {
            await saveSubjectEdit({
              subjectId: subjectEditModal.subjectId,
              name,
              code,
              weeklyFrequency: subjectEditModal.weeklyFrequency,
              allocationVenueRequirement: subjectEditModal.allocationVenueRequirement,
              specializedVenueType: subjectEditModal.specializedVenueType,
            });
            const freqChanged =
              prev != null && Number(prev.weeklyFrequency ?? 0) !== Number(subjectEditModal.weeklyFrequency ?? 0);
            recordChange({
              id: `subject:edit:${subjectEditModal.subjectId}`,
              scope: 'subjects',
              severity: freqChanged ? 'hard' : 'soft',
              message: freqChanged
                ? `Changed weekly frequency for ${code} (${prev?.weeklyFrequency ?? 0} → ${subjectEditModal.weeklyFrequency})`
                : `Updated subject ${code}`,
              refs: { subjectIds: [subjectEditModal.subjectId] },
            });
            await invalidate(['subjects', 'allocations']);
            toast.success('Saved', `${code} updated.`);
            setSubjectEditModal({
              open: false,
              subjectId: null,
              name: '',
              code: '',
              weeklyFrequency: null,
              allocationVenueRequirement: 'STANDARD_CLASSROOM',
              specializedVenueType: '',
              busy: false,
            });
          } catch (e) {
            toast.error('Update failed', formatApiError(e));
            setSubjectEditModal((p) => ({ ...p, busy: false }));
          }
        }}
      >
        <div className="stack" style={{ gap: 10 }}>
          {(() => {
            const req = parseSubjectVenueRequirement(subjectEditModal.allocationVenueRequirement);
            const spec =
              req === 'SPECIALIZED_ROOM'
                ? parseRoomVenueType(subjectEditModal.specializedVenueType || undefined)
                : null;
            const roomTypes = (roomsForVenue.data?.content ?? []).map((r) => r.type);
            const noCompat =
              req !== 'FLEXIBLE' && !schoolHasAnyCompatibleRoom(roomTypes, req, spec);
            return noCompat ? (
              <div
                className="sms-alert sms-alert--info"
                style={{ margin: 0, fontSize: 12 }}
                title="Configured via Subject Type (room allocation need) in Subject setup."
              >
                <div className="sms-alert__title">No compatible room yet</div>
                <div className="sms-alert__msg">
                  No room in this school matches types required for this subject (
                  {formatCompatibleRoomTypesList(req)}). Manual assignment may be needed. You can still save.
                </div>
              </div>
            ) : null;
          })()}
          <div className="stack" style={{ gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 800 }}>Name</label>
            <input
              value={subjectEditModal.name}
              onChange={(e) => setSubjectEditModal((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Mathematics"
            />
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 800 }}>Code</label>
            <input
              value={subjectEditModal.code}
              onChange={(e) => setSubjectEditModal((p) => ({ ...p, code: normalizeSubjectCode(e.target.value) }))}
              placeholder="MTH"
            />
            {!isValidSubjectCode(normalizeSubjectCode(subjectEditModal.code)) ? (
              <div style={{ fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>3–32 chars, uppercase A–Z and 0–9 only.</div>
            ) : null}
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 800 }}>Weekly frequency (optional)</label>
            <input
              type="number"
              min={1}
              max={40}
              value={subjectEditModal.weeklyFrequency ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setSubjectEditModal((p) => ({
                  ...p,
                  weeklyFrequency: v === '' ? null : Number(v),
                }));
              }}
              placeholder="Leave empty to keep server default"
            />
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 800 }}>Room allocation need</label>
            <SmartSelect
              value={subjectEditModal.allocationVenueRequirement}
              onChange={(v) =>
                setSubjectEditModal((p) => ({
                  ...p,
                  allocationVenueRequirement: v || 'STANDARD_CLASSROOM',
                  specializedVenueType: v === 'SPECIALIZED_ROOM' ? p.specializedVenueType : '',
                }))
              }
              options={SUBJECT_VENUE_REQUIREMENTS.map((k) => ({ value: k, label: SUBJECT_VENUE_LABELS[k] }))}
              ariaLabel="Subject venue requirement"
            />
            <div className="muted" style={{ fontSize: 11 }}>
              Timetable uses this with each room&apos;s type — not the subject name.
            </div>
          </div>
          {parseSubjectVenueRequirement(subjectEditModal.allocationVenueRequirement) === 'SPECIALIZED_ROOM' ? (
            <div className="stack" style={{ gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 800 }}>Specialized room type</label>
              <SmartSelect
                value={subjectEditModal.specializedVenueType || 'MULTIPURPOSE'}
                onChange={(v) => setSubjectEditModal((p) => ({ ...p, specializedVenueType: v || 'MULTIPURPOSE' }))}
                options={ROOM_TYPES.map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] }))}
                ariaLabel="Specialized room type"
              />
            </div>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
