import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { pageContent } from '../../lib/springPageContent';
import { useApiTags } from '../../lib/apiTags';
import { RowActionsMenu } from '../RowActionsMenu';
import { ConfirmDialog } from '../ConfirmDialog';
import { MultiSelectKeeper } from '../MultiSelectKeeper';
import { SelectKeeper } from '../SelectKeeper';
import type { OnboardedStaffRow, StaffDeleteInfo, StaffDraft } from './onboardedStaffTypes';

type SubjectCatalogRow = { id: number; code: string; name: string; weeklyFrequency?: number | null };

type ClassGroupLite = { id: number; code?: string | null; gradeLevel?: number | null; section?: string | null; name?: string | null };

/**
 * “Onboarded staff” table + filters + edit/delete (same as onboarding Staff step).
 */
export function OnboardedStaffCatalogPanel() {
  const invalidate = useApiTags();

  const [staffTableSearch, setStaffTableSearch] = useState('');
  const [staffTableRoles, setStaffTableRoles] = useState<string[]>([]);
  const [staffTableLogin, setStaffTableLogin] = useState<'ALL' | 'HAS' | 'NONE'>('ALL');
  const [staffExpandedId, setStaffExpandedId] = useState<number | null>(null);

  const [staffDeleteInfoCache, setStaffDeleteInfoCache] = useState<Record<number, StaffDeleteInfo | undefined>>({});
  const [staffDeleteModal, setStaffDeleteModal] = useState<{
    open: boolean;
    staffId?: number;
    fullName?: string;
    email?: string;
  }>({ open: false });
  const [staffDeleteAllModal, setStaffDeleteAllModal] = useState<{ open: boolean; busy: boolean }>({ open: false, busy: false });

  const [staffEdit, setStaffEdit] = useState<{
    open: boolean;
    staffId?: number;
    draft?: StaffDraft;
  }>({ open: false });

  const staffCatalog = useQuery({
    queryKey: ['onboarding-staff-view'],
    queryFn: async () => (await api.get<OnboardedStaffRow[]>('/api/v1/onboarding/staff')).data,
  });

  const subjectsCatalog = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () =>
      (await api.get('/api/subjects?size=1000&sort=name,asc')).data as SubjectCatalogRow[] | { content: SubjectCatalogRow[] },
  });

  const classGroups = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () =>
      (await api.get('/api/class-groups?size=500')).data as ClassGroupLite[] | { content: ClassGroupLite[] },
  });

  const roleCatalog = useMemo(
    () => [
      { value: 'TEACHER', label: 'Teacher' },
      { value: 'HOD', label: 'HOD' },
      { value: 'ACCOUNTANT', label: 'Accountant' },
      { value: 'PRINCIPAL', label: 'Principal' },
      { value: 'VICE_PRINCIPAL', label: 'Vice principal' },
      { value: 'SCHOOL_ADMIN', label: 'School admin' },
    ],
    [],
  );

  const subjectSearchStringsByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const sub of pageContent(subjectsCatalog.data)) {
      const code = String(sub.code ?? '')
        .trim()
        .toLowerCase();
      if (!code) continue;
      m.set(code, `${sub.name} ${sub.code}`.toLowerCase());
    }
    return m;
  }, [subjectsCatalog.data]);

  async function ensureStaffDeleteInfo(staffId: number) {
    if (staffDeleteInfoCache[staffId]) return;
    const r = await api.get(`/api/v1/onboarding/staff/${staffId}/delete-info`);
    setStaffDeleteInfoCache((p) => ({ ...p, [staffId]: r.data as StaffDeleteInfo }));
  }

  const deleteStaff = useMutation({
    mutationFn: async (staffId: number) => {
      await api.delete(`/api/v1/onboarding/staff/${staffId}`);
    },
    onSuccess: async () => {
      setStaffDeleteModal({ open: false });
      setStaffDeleteInfoCache({});
      await invalidate(['staff']);
      toast.success('Deleted', 'Staff was deleted.');
    },
  });

  const deleteAllStaff = useMutation({
    mutationFn: async (rows: OnboardedStaffRow[]) => {
      const sorted = rows.slice().sort((a, b) => Number(a.staffId) - Number(b.staffId));
      let deleted = 0;
      let skipped = 0;
      const skippedNames: string[] = [];
      for (const r of sorted) {
        const id = Number(r.staffId);
        if (!Number.isFinite(id)) continue;
        try {
          const info = (await api.get<StaffDeleteInfo>(`/api/v1/onboarding/staff/${id}/delete-info`)).data;
          if (info?.canDelete === false) {
            skipped += 1;
            skippedNames.push(r.fullName || r.email || String(id));
            continue;
          }
          await api.delete(`/api/v1/onboarding/staff/${id}`);
          deleted += 1;
        } catch {
          skipped += 1;
          skippedNames.push(r.fullName || r.email || String(id));
        }
      }
      return { deleted, skipped, skippedNames: skippedNames.slice(0, 8) };
    },
    onMutate: () => setStaffDeleteAllModal((p) => ({ ...p, busy: true })),
    onSuccess: async () => {
      setStaffDeleteAllModal({ open: false, busy: false });
      setStaffDeleteInfoCache({});
      await invalidate(['staff']);
    },
    onError: () => setStaffDeleteAllModal((p) => ({ ...p, busy: false })),
  });

  const updateStaff = useMutation({
    mutationFn: async ({ staffId, body }: { staffId: number; body: StaffDraft }) => {
      const roles = (body.roles ?? []).map((r) => String(r).trim().toUpperCase()).filter(Boolean);
      const isTeacher = roles.includes('TEACHER');
      const r = await api.put(`/api/v1/onboarding/staff/${staffId}`, {
        fullName: body.fullName,
        email: body.email,
        phone: body.phone ?? '',
        employeeNo: body.employeeNo ?? '',
        designation: body.designation ?? '',
        roles,
        teachableSubjectIds: isTeacher ? body.teachableSubjectIds ?? [] : [],
        createLoginAccount: body.createLoginAccount ?? true,
        maxWeeklyLectureLoad: isTeacher ? body.maxWeeklyLectureLoad ?? null : null,
        preferredClassGroupIds: isTeacher ? body.preferredClassGroupIds ?? [] : [],
      });
      return r.data as { email: string; username: string; temporaryPassword: string; roles: string[] } | null;
    },
    onSuccess: async (cred) => {
      setStaffEdit({ open: false });
      await invalidate(['staff', 'allocations']);
      if (cred?.temporaryPassword) {
        toast.success('Login created', `Username: ${cred.username}`);
      } else {
        toast.success('Saved', 'Staff updated.');
      }
    },
  });

  return (
    <>
      <div className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900 }}>Onboarded staff</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {staffCatalog.isLoading ? 'Loading…' : `${pageContent(staffCatalog.data).length} staff`}
          </div>
        </div>
        {staffCatalog.isError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Couldn’t load staff</div>
              <div className="sms-alert__msg">{formatApiError(staffCatalog.error)}</div>
            </div>
          </div>
        ) : null}
        {staffCatalog.isLoading ? (
          <div className="muted">Loading staff…</div>
        ) : pageContent(staffCatalog.data).length === 0 ? (
          <div className="muted">No staff onboarded yet.</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <div
              className="row"
              style={{
                gap: 10,
                alignItems: 'flex-end',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(15,23,42,0.10)',
                background: 'rgba(255,255,255,0.70)',
              }}
            >
              <div className="stack" style={{ gap: 6, flex: '2 1 260px' }}>
                <label>Search</label>
                <input
                  value={staffTableSearch}
                  onChange={(e) => setStaffTableSearch(e.target.value)}
                  placeholder="Search name, email, phone, subject, role…"
                />
              </div>

              <div className="stack" style={{ gap: 6, flex: '1 1 280px' }}>
                <label>Roles</label>
                <MultiSelectKeeper
                  value={staffTableRoles}
                  onChange={setStaffTableRoles}
                  options={roleCatalog}
                  placeholder="All roles"
                  searchPlaceholder="Search roles…"
                />
              </div>

              <div className="stack" style={{ gap: 6, flex: '1 1 220px' }}>
                <label>Login</label>
                <SelectKeeper
                  value={staffTableLogin}
                  onChange={(v) => setStaffTableLogin((v as 'ALL' | 'HAS' | 'NONE') ?? 'ALL')}
                  options={[
                    { value: 'ALL', label: 'All' },
                    { value: 'HAS', label: 'Created' },
                    { value: 'NONE', label: 'No login' },
                  ]}
                />
              </div>

              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setStaffTableSearch('');
                  setStaffTableRoles([]);
                  setStaffTableLogin('ALL');
                }}
                disabled={!staffTableSearch && staffTableRoles.length === 0 && staffTableLogin === 'ALL'}
              >
                Reset
              </button>

              <RowActionsMenu
                actions={[
                  {
                    id: 'staff-delete-all',
                    label: 'Delete all staff',
                    danger: true,
                    onSelect: () => setStaffDeleteAllModal({ open: true, busy: false }),
                  },
                ]}
              />
            </div>

            {(() => {
              const filtered = (staffCatalog.data ?? [])
                .filter((s) => {
                  const q = staffTableSearch.trim().toLowerCase();
                  if (q) {
                    const subjectBits = (s.subjectCodes ?? []).map((code) => {
                      const k = String(code).trim().toLowerCase();
                      return subjectSearchStringsByCode.get(k) ?? k;
                    });
                    const hay = [
                      s.fullName,
                      s.email,
                      s.phone ?? '',
                      s.employeeNo ?? '',
                      s.designation ?? '',
                      ...(s.roles ?? []),
                      ...(s.subjectCodes ?? []),
                      ...subjectBits,
                    ]
                      .join(' ')
                      .toLowerCase();
                    if (!hay.includes(q)) return false;
                  }
                  if (staffTableRoles.length) {
                    const rs = s.roles ?? [];
                    if (!staffTableRoles.some((role) => rs.includes(role))) return false;
                  }
                  if (staffTableLogin === 'HAS' && !s.hasLoginAccount) return false;
                  if (staffTableLogin === 'NONE' && s.hasLoginAccount) return false;
                  return true;
                })
                .slice()
                .sort((a, b) => String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')));

              const openEdit = (s: OnboardedStaffRow) => {
                const subjectCatalog = pageContent(subjectsCatalog.data);
                setStaffEdit({
                  open: true,
                  staffId: s.staffId,
                  draft: {
                    fullName: s.fullName ?? '',
                    email: s.email ?? '',
                    phone: s.phone ?? '',
                    employeeNo: s.employeeNo ?? '',
                    designation: s.designation ?? '',
                    roles: s.roles ?? [],
                    teachableSubjectIds:
                      (s.subjectCodes ?? []).length
                        ? subjectCatalog.filter((sub) => (s.subjectCodes ?? []).includes(sub.code)).map((sub) => sub.id)
                        : [],
                    createLoginAccount: true,
                    maxWeeklyLectureLoad: s.maxWeeklyLectureLoad ?? null,
                    preferredClassGroupIds: s.preferredClassGroupIds ?? [],
                  },
                });
              };

              const actionMenu = (s: OnboardedStaffRow) => (
                <RowActionsMenu
                  actions={[
                    { id: `staff-${s.staffId}-edit`, label: 'Edit', onSelect: () => openEdit(s) },
                    {
                      id: `staff-${s.staffId}-reset-login`,
                      label: 'Reset login',
                      onSelect: () => toast.info('Login', 'Reset login is not supported yet.'),
                    },
                    {
                      id: `staff-${s.staffId}-assign`,
                      label: 'Assign subjects',
                      disabled: !(s.roles ?? []).includes('TEACHER'),
                      disabledReason: 'Only staff with TEACHER role can be assigned subjects.',
                      onSelect: () => openEdit(s),
                    },
                    {
                      id: `staff-${s.staffId}-delete`,
                      label: 'Delete',
                      danger: true,
                      onSelect: async () => {
                        await ensureStaffDeleteInfo(s.staffId);
                        setStaffDeleteModal({ open: true, staffId: s.staffId, fullName: s.fullName, email: s.email });
                      },
                    },
                  ]}
                />
              );

              const formatRoleLabel = (r: string) =>
                r
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase());
              const roleChip = (r: string) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-extrabold text-slate-800"
                >
                  {formatRoleLabel(r)}
                </span>
              );

              const statusBadge = (has: boolean) =>
                has ? (
                  <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-extrabold text-orange-700">
                    Created
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-extrabold text-slate-700">
                    No login
                  </span>
                );

              return (
                <div className="w-full">
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {filtered.map((s) => (
                      <div key={s.staffId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-black text-slate-900">{s.fullName}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                              <span className="font-extrabold text-slate-700">{s.designation ?? '—'}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-extrabold text-slate-700">{s.employeeNo ?? '—'}</span>
                            </div>
                          </div>
                          {actionMenu(s)}
                        </div>

                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-slate-500">Email</div>
                            <div className="min-w-0 text-right font-semibold text-slate-800 break-words">{s.email ?? '—'}</div>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-slate-500">Phone</div>
                            <div className="text-right font-semibold text-slate-800">{s.phone ?? '—'}</div>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-slate-500">Role</div>
                            <div className="text-right">
                              {(s.roles ?? []).length ? roleChip((s.roles ?? [])[0]!) : <span className="text-slate-500">—</span>}
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-slate-500">Subjects</div>
                            <div className="text-right font-semibold text-slate-800 break-words">
                              {(s.subjectCodes ?? []).length ? (s.subjectCodes ?? []).join(', ') : <span className="text-slate-500">—</span>}
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-slate-500">Login</div>
                            <div className="text-right">{statusBadge(!!s.hasLoginAccount)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block lg:hidden">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="max-h-[70vh] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-white">
                            <tr className="border-b border-slate-200">
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Role</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Phone</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Status</th>
                              <th className="w-12 px-3 py-3" />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((s, idx) => {
                              const open = staffExpandedId === s.staffId;
                              return (
                                <Fragment key={s.staffId}>
                                  <tr className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-100 hover:bg-orange-50/30`}>
                                    <td className="px-4 py-3">
                                      <button
                                        type="button"
                                        className="w-full text-left"
                                        onClick={() => setStaffExpandedId((p) => (p === s.staffId ? null : s.staffId))}
                                      >
                                        <div className="font-extrabold text-slate-900">{s.fullName}</div>
                                        <div className="mt-0.5 text-xs font-semibold text-slate-500">
                                          {s.employeeNo ?? '—'} • {s.designation ?? '—'}
                                        </div>
                                      </button>
                                    </td>
                                    <td className="px-4 py-3">
                                      {(s.roles ?? []).length ? roleChip((s.roles ?? [])[0]!) : <span className="text-slate-500">—</span>}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">{s.phone ?? '—'}</td>
                                    <td className="px-4 py-3">{statusBadge(!!s.hasLoginAccount)}</td>
                                    <td className="px-3 py-3 text-right">{actionMenu(s)}</td>
                                  </tr>
                                  {open ? (
                                    <tr className="bg-white">
                                      <td colSpan={5} className="px-4 pb-4">
                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div>
                                              <div className="text-xs font-black tracking-wide text-slate-500">Email</div>
                                              <div className="mt-1 break-words text-sm font-semibold text-slate-900">{s.email ?? '—'}</div>
                                            </div>
                                            <div>
                                              <div className="text-xs font-black tracking-wide text-slate-500">Employee #</div>
                                              <div className="mt-1 text-sm font-semibold text-slate-900">{s.employeeNo ?? '—'}</div>
                                            </div>
                                            <div>
                                              <div className="text-xs font-black tracking-wide text-slate-500">Designation</div>
                                              <div className="mt-1 text-sm font-semibold text-slate-900">{s.designation ?? '—'}</div>
                                            </div>
                                            <div>
                                              <div className="text-xs font-black tracking-wide text-slate-500">Subjects</div>
                                              <div className="mt-1 break-words text-sm font-semibold text-slate-900">
                                                {(s.subjectCodes ?? []).length ? (s.subjectCodes ?? []).join(', ') : '—'}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="max-h-[72vh] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-white">
                            <tr className="border-b border-slate-200">
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Phone</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Employee #</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Designation</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Roles</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Subjects</th>
                              <th className="px-4 py-3 text-left text-xs font-black tracking-wide text-slate-600">Login</th>
                              <th className="w-12 px-3 py-3" />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((s, idx) => (
                              <tr
                                key={s.staffId}
                                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-100 hover:bg-orange-50/30`}
                              >
                                <td className="px-4 py-3 font-extrabold text-slate-900">{s.fullName}</td>
                                <td className="px-4 py-3">
                                  <div className="max-w-[340px] break-words font-semibold text-slate-800">{s.email ?? '—'}</div>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-800">{s.phone ?? '—'}</td>
                                <td className="px-4 py-3 font-semibold text-slate-800">{s.employeeNo ?? '—'}</td>
                                <td className="px-4 py-3 font-semibold text-slate-800">{s.designation ?? '—'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    {(s.roles ?? []).length ? (s.roles ?? []).map((r) => roleChip(r)) : <span className="text-slate-500">—</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="max-w-[360px] break-words font-semibold text-slate-800">
                                    {(s.subjectCodes ?? []).length ? (s.subjectCodes ?? []).join(', ') : <span className="text-slate-500">—</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3">{statusBadge(!!s.hasLoginAccount)}</td>
                                <td className="px-3 py-3 text-right">{actionMenu(s)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filtered.length === 0 ? (
                          <div className="p-8 text-center text-sm font-semibold text-slate-600">No staff match your filters.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={staffDeleteModal.open}
        title="Delete staff?"
        description={
          staffDeleteModal.fullName
            ? `${staffDeleteModal.fullName}${staffDeleteModal.email ? ` (${staffDeleteModal.email})` : ''}`
            : 'This staff member will be marked as deleted and hidden from lists.'
        }
        confirmLabel={deleteStaff.isPending ? 'Deleting…' : 'Delete'}
        danger
        onConfirm={() => {
          const id = staffDeleteModal.staffId;
          if (!id) return;
          deleteStaff.mutate(id);
        }}
        onClose={() => setStaffDeleteModal({ open: false })}
        confirmDisabled={
          deleteStaff.isPending ||
          !staffDeleteModal.staffId ||
          (staffDeleteModal.staffId ? staffDeleteInfoCache[staffDeleteModal.staffId] : undefined)?.canDelete === false
        }
      >
        {(() => {
          const id = staffDeleteModal.staffId;
          if (!id) return null;
          const info = staffDeleteInfoCache[id];
          if (!info) return <div className="muted">Checking…</div>;
          if (info.canDelete) return <div className="muted">This staff will be hidden from lists.</div>;
          return (
            <div className="sms-alert sms-alert--warn">
              <div>
                <div className="sms-alert__title">Can’t delete yet</div>
                <div className="sms-alert__msg">
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {(info.reasons ?? []).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}
      </ConfirmDialog>

      <ConfirmDialog
        open={staffDeleteAllModal.open}
        title="Delete all staff?"
        description="This will delete all onboarded staff that are safe to delete. Staff linked to timetable/allocations may be skipped."
        confirmLabel={staffDeleteAllModal.busy ? 'Deleting…' : 'Delete all'}
        danger
        onConfirm={async () => {
          const rows = pageContent(staffCatalog.data);
          deleteAllStaff.mutate(rows);
        }}
        onClose={() => {
          if (staffDeleteAllModal.busy) return;
          setStaffDeleteAllModal({ open: false, busy: false });
        }}
        confirmDisabled={staffDeleteAllModal.busy || staffCatalog.isLoading || pageContent(staffCatalog.data).length === 0}
      >
        {(() => {
          if (staffDeleteAllModal.busy) return <div className="muted">Deleting…</div>;
          const n = pageContent(staffCatalog.data).length;
          return <div className="muted">About to process {n} staff record(s).</div>;
        })()}
        {deleteAllStaff.isSuccess ? (
          <div className="sms-alert sms-alert--success" style={{ marginTop: 10 }}>
            <div>
              <div className="sms-alert__title">Done</div>
              <div className="sms-alert__msg">
                Deleted {deleteAllStaff.data.deleted} · Skipped {deleteAllStaff.data.skipped}
                {deleteAllStaff.data.skippedNames.length ? ` (e.g. ${deleteAllStaff.data.skippedNames.join(', ')})` : ''}
              </div>
            </div>
          </div>
        ) : null}
        {deleteAllStaff.isError ? (
          <div className="sms-alert sms-alert--error" style={{ marginTop: 10 }}>
            <div>
              <div className="sms-alert__title">Delete all failed</div>
              <div className="sms-alert__msg">Please try again.</div>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={staffEdit.open}
        title="Edit staff"
        description="Update staff profile, roles, and teachable subjects."
        confirmLabel={updateStaff.isPending ? 'Saving…' : 'Save'}
        onConfirm={() => {
          if (!staffEdit.staffId || !staffEdit.draft) return;
          updateStaff.mutate({ staffId: staffEdit.staffId, body: staffEdit.draft });
        }}
        onClose={() => setStaffEdit({ open: false })}
        confirmDisabled={
          updateStaff.isPending ||
          !staffEdit.staffId ||
          !staffEdit.draft ||
          !String(staffEdit.draft.fullName ?? '').trim() ||
          !String(staffEdit.draft.email ?? '').trim() ||
          !String(staffEdit.draft.designation ?? '').trim() ||
          !(staffEdit.draft.roles ?? []).length ||
          ((staffEdit.draft.roles ?? []).includes('TEACHER') && !(staffEdit.draft.teachableSubjectIds ?? []).length)
        }
      >
        {staffEdit.draft ? (
          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <div className="stack" style={{ flex: '1 1 260px' }}>
                <label>Full Name</label>
                <input
                  value={staffEdit.draft.fullName}
                  onChange={(e) => setStaffEdit((p) => ({ ...p, draft: p.draft ? { ...p.draft, fullName: e.target.value } : p.draft }))}
                />
              </div>
              <div className="stack" style={{ flex: '1 1 260px' }}>
                <label>Email</label>
                <input
                  value={staffEdit.draft.email}
                  onChange={(e) => setStaffEdit((p) => ({ ...p, draft: p.draft ? { ...p.draft, email: e.target.value } : p.draft }))}
                />
              </div>
            </div>

            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <div className="stack" style={{ flex: '1 1 220px' }}>
                <label>Phone</label>
                <input
                  value={staffEdit.draft.phone ?? ''}
                  onChange={(e) => setStaffEdit((p) => ({ ...p, draft: p.draft ? { ...p.draft, phone: e.target.value } : p.draft }))}
                />
              </div>
              <div className="stack" style={{ flex: '1 1 220px' }}>
                <label>Employee #</label>
                <input
                  value={staffEdit.draft.employeeNo ?? ''}
                  onChange={(e) =>
                    setStaffEdit((p) => ({ ...p, draft: p.draft ? { ...p.draft, employeeNo: e.target.value } : p.draft }))
                  }
                />
              </div>
              <div className="stack" style={{ flex: '1 1 260px' }}>
                <label>Designation</label>
                <input
                  value={staffEdit.draft.designation ?? ''}
                  onChange={(e) =>
                    setStaffEdit((p) => ({ ...p, draft: p.draft ? { ...p.draft, designation: e.target.value } : p.draft }))
                  }
                />
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <label>Roles</label>
              <MultiSelectKeeper
                value={staffEdit.draft.roles ?? []}
                onChange={(roles) => setStaffEdit((p) => ({ ...p, draft: p.draft ? { ...p.draft, roles } : p.draft }))}
                options={roleCatalog}
                placeholder="Select roles…"
                searchPlaceholder="Search roles…"
              />
            </div>

            {(staffEdit.draft.roles ?? []).includes('TEACHER') ? (
              <div className="stack" style={{ gap: 8 }}>
                <label>Can Teach Subjects</label>
                <MultiSelectKeeper
                  value={(staffEdit.draft.teachableSubjectIds ?? []).map(String)}
                  onChange={(ids) =>
                    setStaffEdit((p) => ({
                      ...p,
                      draft: p.draft
                        ? { ...p.draft, teachableSubjectIds: ids.map((v) => Number(v)).filter((n) => Number.isFinite(n)) }
                        : p.draft,
                    }))
                  }
                  options={pageContent(subjectsCatalog.data).map((sub) => ({ value: String(sub.id), label: `${sub.code} — ${sub.name}` }))}
                  placeholder="Select subjects…"
                  searchPlaceholder="Search subjects…"
                />
              </div>
            ) : null}

            {(staffEdit.draft.roles ?? []).includes('TEACHER') ? (
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div className="stack" style={{ flex: '0 0 180px' }}>
                  <label>Max weekly teaching periods (optional)</label>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={staffEdit.draft.maxWeeklyLectureLoad != null ? String(staffEdit.draft.maxWeeklyLectureLoad) : ''}
                    onChange={(e) => {
                      const t = e.target.value.trim();
                      setStaffEdit((p) => ({
                        ...p,
                        draft: p.draft
                          ? {
                              ...p.draft,
                              maxWeeklyLectureLoad:
                                t && Number.isFinite(Number(t)) && Number(t) > 0 ? Math.floor(Number(t)) : null,
                            }
                          : p.draft,
                      }));
                    }}
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="stack" style={{ flex: '1 1 300px' }}>
                  <label>Preferred classes/sections (optional)</label>
                  <MultiSelectKeeper
                    value={(staffEdit.draft.preferredClassGroupIds ?? []).map(String)}
                    onChange={(ids) =>
                      setStaffEdit((p) => ({
                        ...p,
                        draft: p.draft
                          ? {
                              ...p.draft,
                              preferredClassGroupIds: ids.map((v) => Number(v)).filter((n) => Number.isFinite(n)),
                            }
                          : p.draft,
                      }))
                    }
                    options={pageContent(classGroups.data).map((c) => ({
                      value: String(c.id),
                      label: `${c.gradeLevel != null ? `Class ${c.gradeLevel} · ` : ''}${c.name ?? c.code ?? c.id}`,
                    }))}
                    placeholder="Smart assignment…"
                    searchPlaceholder="Search classes…"
                  />
                </div>
              </div>
            ) : null}

            <label className="row" style={{ gap: 10, alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="sms-checkbox"
                checked={Boolean(staffEdit.draft.createLoginAccount ?? true)}
                onChange={(e) =>
                  setStaffEdit((p) => ({
                    ...p,
                    draft: p.draft ? { ...p.draft, createLoginAccount: e.target.checked } : p.draft,
                  }))
                }
              />
              <span>Create login account (if missing)</span>
            </label>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
