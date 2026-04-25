import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { FEATURE_ROLE_MATRIX, ROLE_PLAYBOOK_SECTIONS } from '../lib/rolePlaybook';

type MeProfile = { email: string; roles: string[] };
type SchoolUser = {
  userId: number;
  email: string;
  displayName: string;
  photoUrl: string | null;
  roles: string[];
};

function initialsFromName(displayName: string, email: string): string {
  const s = displayName.trim();
  if (s) {
    const parts = s.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
    return (a + b).toUpperCase() || email.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

type TenantCapabilities = {
  subscriptionFeatureCodes: string[];
  permissionsGranted: string[];
  permissionsEffective: string[];
};

/** Subset assignable by principal — keep in sync with {@code RoleNames.ASSIGNABLE_BY_PRINCIPAL}. */
const PRINCIPAL_ASSIGNABLE_ROLES = new Set([
  'VICE_PRINCIPAL',
  'HOD',
  'TEACHER',
  'CLASS_TEACHER',
  'LIBRARIAN',
  'ACCOUNTANT',
  'RECEPTIONIST',
  'TRANSPORT_MANAGER',
  'IT_SUPPORT',
  'COUNSELOR',
  'EXAM_COORDINATOR',
  'HOSTEL_WARDEN',
]);

/** Display labels for role codes (assignable by school owner). */
const ROLE_LABELS: Record<string, string> = {
  SCHOOL_ADMIN: 'School owner / admin',
  PRINCIPAL: 'Principal',
  VICE_PRINCIPAL: 'Vice principal',
  HOD: 'Head of department',
  TEACHER: 'Teacher',
  CLASS_TEACHER: 'Class teacher',
  STUDENT: 'Student',
  PARENT: 'Parent / guardian',
  LIBRARIAN: 'Librarian',
  ACCOUNTANT: 'Accountant',
  RECEPTIONIST: 'Receptionist',
  TRANSPORT_MANAGER: 'Transport manager',
  IT_SUPPORT: 'IT support',
  COUNSELOR: 'Counselor',
  EXAM_COORDINATOR: 'Exam coordinator',
  HOSTEL_WARDEN: 'Hostel warden',
};

export function UserAccessManagementPage() {
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ['me'], queryFn: async () => (await api.get<MeProfile>('/user/me')).data });
  const myRoles = me.data?.roles ?? [];
  const isSchoolOwner = myRoles.includes('SCHOOL_ADMIN');
  const isPrincipal = myRoles.includes('PRINCIPAL');
  const isVicePrincipal = myRoles.includes('VICE_PRINCIPAL');
  const canAssignRoles = isSchoolOwner || isPrincipal || isVicePrincipal;

  const users = useQuery({
    queryKey: ['school-management-users'],
    queryFn: async () => (await api.get<SchoolUser[]>('/api/v1/school/management/users')).data,
  });

  const assignableRoles = useQuery({
    queryKey: [
      'school-assignable-roles',
      isSchoolOwner ? 'owner' : isPrincipal ? 'principal' : 'vice',
    ],
    queryFn: async () => (await api.get<string[]>('/api/v1/school/management/assignable-roles')).data,
    enabled: canAssignRoles && me.isSuccess,
  });

  const capabilities = useQuery({
    queryKey: ['tenant-capabilities'],
    queryFn: async () => (await api.get<TenantCapabilities>('/api/v1/tenant/capabilities')).data,
    enabled: me.isSuccess,
  });

  // Table should not show student/parent accounts.
  const tableUsers = useMemo(() => {
    const list = users.data ?? [];
    return list.filter((u) => !u.roles.includes('STUDENT') && !u.roles.includes('PARENT'));
  }, [users.data]);

  // Separate "assign role" flow: search -> select user -> assign roles
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [roleDraft, setRoleDraft] = useState<string[]>([]);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const selectUserForRoleAssign = (id: number | '') => {
    setSelectedUserId(id);
    const u = (users.data ?? []).find((x) => x.userId === id);
    if (!u) {
      setRoleDraft([]);
      return;
    }
    if (isSchoolOwner) {
      setRoleDraft([...u.roles]);
    } else {
      const allowed =
        assignableRoles.data && assignableRoles.data.length > 0
          ? new Set(assignableRoles.data)
          : isPrincipal
            ? PRINCIPAL_ASSIGNABLE_ROLES
            : new Set<string>(['TEACHER', 'CLASS_TEACHER']);
      setRoleDraft(u.roles.filter((r) => allowed.has(r)));
    }
  };

  const eligibleForAssignment = useMemo(() => {
    const list = users.data ?? [];
    const q = searchEmail.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (u) => u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q),
        )
      : list;
    return filtered.filter((u) => {
      if (u.roles.includes('STUDENT') || u.roles.includes('PARENT')) return false;
      if (isSchoolOwner) return true;
      if ((isPrincipal || isVicePrincipal) && !isSchoolOwner) {
        return (
          !u.roles.includes('SCHOOL_ADMIN') &&
          !u.roles.includes('PRINCIPAL') &&
          !u.roles.includes('STUDENT') &&
          !u.roles.includes('PARENT')
        );
      }
      return false;
    });
  }, [users.data, searchEmail, isSchoolOwner, isPrincipal, isVicePrincipal]);

  const selectedUser = useMemo(() => {
    if (selectedUserId === '') return null;
    return (users.data ?? []).find((u) => u.userId === selectedUserId) ?? null;
  }, [users.data, selectedUserId]);

  const updateRoles = useMutation({
    mutationFn: async ({ userId, roles }: { userId: number; roles: string[]; editedEmail: string }) =>
      api.put(`/api/v1/school/management/users/${userId}/roles`, { roles }),
    onSuccess: async (_, vars) => {
      setSelectedUserId('');
      setRoleDraft([]);
      await qc.invalidateQueries({ queryKey: ['school-management-users'] });
      await qc.invalidateQueries({ queryKey: ['tenant-capabilities'] });
      const meEmail = me.data?.email?.toLowerCase();
      if (meEmail && vars.editedEmail.toLowerCase() === meEmail) {
        await qc.invalidateQueries({ queryKey: ['me'] });
      }
      toast.success('Saved', `Roles updated for ${vars.editedEmail}.`);
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  return (
    <div className="workspace-feature-page stack">
      <div className="workspace-hero">
        <div className="workspace-hero__top">
          <p className="workspace-hero__eyebrow">User & access management</p>
          <span className="workspace-hero__tag">Security</span>
        </div>
        <h1 className="workspace-hero__title">Users & roles</h1>
        <p className="workspace-hero__subtitle">
          Accounts linked to this school. The <strong>school owner</strong> (<code>SCHOOL_ADMIN</code>) controls
          ownership and leadership roles; the <strong>principal</strong> (<code>PRINCIPAL</code>) is the highest
          in-school authority for day-to-day operations and can assign staff roles (teachers, HOD, vice principal,
          etc.).
        </p>
      </div>

      <div className="workspace-panel">
        <h2 className="workspace-panel__title">Permission model</h2>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55 }}>
          Authorization is <strong>role → permissions</strong> (fine-grained codes on the server). Even if a role
          includes a permission, access is blocked when the school&apos;s <strong>subscription plan</strong> does not
          enable the related feature — same idea as: teacher can mark attendance, but attendance is off on the plan →
          blocked.
        </p>
        {capabilities.isLoading ? (
          <div className="muted">Loading your capabilities…</div>
        ) : capabilities.isError ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(capabilities.error)}</div>
        ) : capabilities.data ? (
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="workspace-metric-card" style={{ flex: '1 1 200px' }}>
              <span className="workspace-metric-card__label">Plan features enabled</span>
              <div className="workspace-metric-card__value">{capabilities.data.subscriptionFeatureCodes.length}</div>
            </div>
            <div className="workspace-metric-card" style={{ flex: '1 1 200px' }}>
              <span className="workspace-metric-card__label">Permissions (from roles)</span>
              <div className="workspace-metric-card__value">{capabilities.data.permissionsGranted.length}</div>
            </div>
            <div className="workspace-metric-card" style={{ flex: '1 1 200px' }}>
              <span className="workspace-metric-card__label">Effective (after plan)</span>
              <div className="workspace-metric-card__value">{capabilities.data.permissionsEffective.length}</div>
            </div>
          </div>
        ) : null}
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
          API: <code>GET /api/v1/tenant/capabilities</code> · Feature codes: <code>GET /api/v1/tenant/features</code>
        </p>
      </div>

      {isPrincipal ? (
        <div className="workspace-panel">
          <h2 className="workspace-panel__title">Principal — in-school authority</h2>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55 }}>
            Highest authority inside the school for operations. Some items below are roadmap; role assignment for
            staff is available in <strong>Assign roles</strong>.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.65 }}>
            <li>
              <strong>Academic</strong> — approve class structures; approve timetable; monitor teacher performance.
            </li>
            <li>
              <strong>Students</strong> — approve admissions; approve transfers / TC.
            </li>
            <li>
              <strong>Exams</strong> — approve exam schedules; view school-wide results.
            </li>
            <li>
              <strong>Attendance</strong> — view overall attendance trends.
            </li>
            <li>
              <strong>Finance</strong> — view fee reports; approve fee waivers.
            </li>
            <li>
              <strong>Admin</strong> — assign roles (HOD, teachers, operational staff); approve announcements.
            </li>
          </ul>
        </div>
      ) : null}

      <section className="student-tiles-section workspace-panel">
        <div className="student-tiles-head">
          <h2 className="workspace-panel__title" style={{ margin: 0 }}>
            Access & roles
          </h2>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5 }}>
            Staff and leadership roster in the same card style as the student dashboard. Students and parents are
            hidden here; name and photo come from linked staff (or student profile when applicable).
          </p>
        </div>
        {users.isLoading ? (
          <div className="muted">Loading users…</div>
        ) : users.isError ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(users.error)}</div>
        ) : (
          <div className="access-roster-grid">
            {tableUsers.map((u) => (
              <div key={u.userId} className="access-user-card">
                <div className="access-user-card__avatar" aria-hidden>
                  {u.photoUrl ? <img src={u.photoUrl} alt="" /> : <span>{initialsFromName(u.displayName, u.email)}</span>}
                </div>
                <div className="access-user-card__body">
                  <div className="access-user-card__name">{u.displayName}</div>
                  <div className="access-user-card__email muted">{u.email}</div>
                  <div className="access-user-card__roles">
                    {u.roles.map((r) => (
                      <span key={r} className="access-user-card__role-chip">
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="workspace-panel">
        <h2 className="workspace-panel__title">Assign roles</h2>
        {!canAssignRoles ? (
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Only <strong>school owner</strong> (<code>SCHOOL_ADMIN</code>), <strong>principal</strong> (
            <code>PRINCIPAL</code>), or <strong>vice principal</strong> (<code>VICE_PRINCIPAL</code>) can assign roles
            here (scope varies by role).
          </p>
        ) : (
          <>
            <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div className="stack" style={{ flex: '3 1 520px' }}>
                <label>Select user (search name or email)</label>
                <div className="select-keeper catalog-combobox">
                  <div className="catalog-combobox__field">
                    <input
                      type="text"
                      className="catalog-combobox__input"
                      role="combobox"
                      aria-expanded={assignPickerOpen}
                      aria-autocomplete="list"
                      placeholder="Name or email…"
                      autoComplete="off"
                      value={searchEmail}
                      onChange={(e) => {
                        setSearchEmail(e.target.value);
                        setAssignPickerOpen(true);
                      }}
                      onFocus={() => setAssignPickerOpen(true)}
                      onBlur={() => {
                        blurTimer.current = window.setTimeout(() => setAssignPickerOpen(false), 120);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setAssignPickerOpen(false);
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const first = eligibleForAssignment[0];
                          if (assignPickerOpen && first) {
                            selectUserForRoleAssign(first.userId);
                            setSearchEmail(`${first.displayName} — ${first.email}`);
                            setAssignPickerOpen(false);
                          }
                        }
                      }}
                    />
                    <span className="select-keeper__chev" aria-hidden>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                  {assignPickerOpen ? (
                    <ul className="select-keeper__menu" role="listbox">
                      {users.isLoading ? (
                        <li className="catalog-combobox__hint" role="status">
                          Loading users…
                        </li>
                      ) : eligibleForAssignment.length === 0 ? (
                        <li className="catalog-combobox__hint" role="status">
                          No matching users.
                        </li>
                      ) : (
                        eligibleForAssignment.slice(0, 30).map((u) => (
                          <li key={u.userId} role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={selectedUserId === u.userId}
                              className={
                                selectedUserId === u.userId
                                  ? 'select-keeper__option select-keeper__option--selected'
                                  : 'select-keeper__option'
                              }
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                if (blurTimer.current) clearTimeout(blurTimer.current);
                                selectUserForRoleAssign(u.userId);
                                setSearchEmail(`${u.displayName} — ${u.email}`);
                                setAssignPickerOpen(false);
                              }}
                            >
                              <span className="catalog-combobox__text">{u.displayName}</span>
                              <span className="catalog-combobox__meta">{u.email}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Search and select a user to assign roles.
                </div>
              </div>
            </div>

            {selectedUser ? (
              <div style={{ marginTop: 14 }}>
                <p className="muted" style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.45 }}>
                  Assign roles for <strong>{selectedUser.displayName}</strong> ({selectedUser.email}).
                  {isSchoolOwner ? (
                    <>
                      {' '}
                      You cannot remove the last school owner (<strong>SCHOOL_ADMIN</strong>) for this school.
                    </>
                  ) : isPrincipal ? (
                    <>
                      {' '}
                      As principal, you can assign operational and teaching roles only — not school owner or principal
                      accounts.
                    </>
                  ) : (
                    <>
                      {' '}
                      As vice principal, you can assign <strong>teacher</strong> and <strong>class teacher</strong> roles
                      only.
                    </>
                  )}
                </p>
                {assignableRoles.isLoading ? (
                  <div className="muted">Loading role list…</div>
                ) : assignableRoles.isError ? (
                  <div style={{ color: '#b91c1c' }}>{formatApiError(assignableRoles.error)}</div>
                ) : (
                  <div style={{ overflow: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                      {(assignableRoles.data ?? []).map((code) => {
                        const checked = roleDraft.includes(code);
                        return (
                          <label
                            key={code}
                            style={{
                              display: 'flex',
                              gap: 10,
                              alignItems: 'flex-start',
                              cursor: 'pointer',
                              padding: 10,
                              border: '1px solid rgba(148, 163, 184, 0.35)',
                              borderRadius: 12,
                              background: checked ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setRoleDraft((prev) => (checked ? prev.filter((r) => r !== code) : [...prev, code]));
                              }}
                            />
                            <span>
                              <strong style={{ fontSize: 14 }}>{ROLE_LABELS[code] ?? code}</strong>
                              <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                                {code}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="row" style={{ marginTop: 14, gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={updateRoles.isPending}
                    onClick={() => {
                      setSelectedUserId('');
                      setRoleDraft([]);
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={updateRoles.isPending || roleDraft.length === 0}
                    onClick={() => {
                      if (!selectedUser) return;
                      updateRoles.mutate({
                        userId: selectedUser.userId,
                        roles: roleDraft,
                        editedEmail: selectedUser.email,
                      });
                    }}
                  >
                    {updateRoles.isPending ? 'Saving…' : 'Save roles'}
                  </button>
                </div>
                {updateRoles.isError ? (
                  <div style={{ color: '#b91c1c', marginTop: 12, fontSize: 14 }}>
                    {formatApiError(updateRoles.error)}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
                Search and select a user to assign roles.
              </p>
            )}
          </>
        )}
      </div>

      <div className="workspace-panel">
        <h2 className="workspace-panel__title">Example feature → roles (illustrative)</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Typical roles</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROLE_MATRIX.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {row.roles}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="workspace-panel" style={{ cursor: 'pointer' }}>
        <summary className="workspace-panel__title" style={{ listStyle: 'none' }}>
          Role playbook (reference: vice principal → IT support)
        </summary>
        <div style={{ marginTop: 12 }} className="stack">
          {ROLE_PLAYBOOK_SECTIONS.map((sec) => (
            <div key={sec.id}>
              <strong style={{ fontSize: 15 }}>{sec.title}</strong>
              <span className="muted" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                {sec.tagline}
              </span>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
                {sec.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

