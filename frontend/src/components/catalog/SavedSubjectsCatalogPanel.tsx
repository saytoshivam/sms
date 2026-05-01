import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { pageContent } from '../../lib/springPageContent';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import { RowActionsMenu } from '../RowActionsMenu';
import { ConfirmDialog } from '../ConfirmDialog';

type SubjectCatalogRow = { id: number; code: string; name: string; weeklyFrequency?: number | null };

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
export function SavedSubjectsCatalogPanel() {
  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const [subjectSearch, setSubjectSearch] = useState('');

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
    busy: boolean;
  }>({ open: false, subjectId: null, name: '', code: '', weeklyFrequency: null, busy: false });

  const subjectsCatalog = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () =>
      (await api.get('/api/subjects?size=1000&sort=name,asc')).data as SubjectCatalogRow[] | { content: SubjectCatalogRow[] },
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
      }: {
        subjectId: number;
        name: string;
        code: string;
        weeklyFrequency: number | null;
      }) => {
        await api.put(`/api/subjects/${subjectId}`, { name, code, weeklyFrequency });
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
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900 }}>Saved subjects</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {subjectsCatalog.isLoading ? 'Loading…' : `${pageContent(subjectsCatalog.data).length} subjects`}
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
                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    Freq/wk
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>Actions</th>
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
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)', textAlign: 'right' }}>
                        <span style={{ fontWeight: 900 }}>{s.weeklyFrequency ?? '—'}</span>
                      </td>
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
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={subjectDeleteModal.open}
        title="Delete subject?"
        description={
          subjectDeleteModal.subjectId
            ? `This will delete ${subjectDeleteModal.subjectName} (${subjectDeleteModal.subjectCode}).`
            : undefined
        }
        details={
          subjectDeleteModal.canDelete
            ? ['This may affect academic structure and timetable.']
            : [
                'This subject cannot be deleted right now:',
                ...(subjectDeleteModal.reasons.length ? subjectDeleteModal.reasons : ['Used in classes/timetable.']),
              ]
        }
        danger
        confirmLabel="Delete"
        cancelLabel="Cancel"
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
        open={subjectEditModal.open}
        title="Edit subject"
        description="Name and code are used across academic structure, staff teachables, and timetables. Code must stay unique in your school."
        confirmLabel="Save"
        cancelLabel="Cancel"
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
          setSubjectEditModal({ open: false, subjectId: null, name: '', code: '', weeklyFrequency: null, busy: false })
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
            setSubjectEditModal({ open: false, subjectId: null, name: '', code: '', weeklyFrequency: null, busy: false });
          } catch (e) {
            toast.error('Update failed', formatApiError(e));
            setSubjectEditModal((p) => ({ ...p, busy: false }));
          }
        }}
      >
        <div className="stack" style={{ gap: 10 }}>
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
        </div>
      </ConfirmDialog>
    </>
  );
}
