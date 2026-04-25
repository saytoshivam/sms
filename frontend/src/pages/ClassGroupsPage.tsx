import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { pageContent, pageTotalElements, type SpringPage } from '../lib/apiData';
import type { MeProfile } from '../modules/dashboards/SuperAdminDashboard';

type ClassGroup = {
  id: number;
  code: string;
  displayName: string;
  classTeacherStaffId?: number | null;
  classTeacherDisplayName?: string | null;
};

type StaffRow = { id: number; fullName: string; employeeNo: string };

export function ClassGroupsPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeProfile>('/user/me')).data,
  });

  const canAssignClassTeacher = (me.data?.roles ?? []).some((r) => ['SCHOOL_ADMIN', 'PRINCIPAL'].includes(r));

  const { data, isLoading, error } = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () => (await api.get<SpringPage<ClassGroup> | ClassGroup[]>('/api/class-groups?size=50')).data,
  });

  const staff = useQuery({
    queryKey: ['staff-list-class-groups'],
    queryFn: async () => (await api.get<SpringPage<StaffRow> | StaffRow[]>('/api/staff?size=200')).data,
    enabled: canAssignClassTeacher,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post<ClassGroup>('/api/class-groups', { code, displayName })).data,
    onSuccess: async () => {
      setCode('');
      setDisplayName('');
      await qc.invalidateQueries({ queryKey: ['class-groups'] });
    },
  });

  const assignTeacherMutation = useMutation({
    mutationFn: async ({ id, staffId }: { id: number; staffId: number | null }) =>
      (await api.put<ClassGroup>(`/api/class-groups/${id}/class-teacher`, { staffId })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['class-groups'] });
    },
  });

  const staffList = pageContent(staff.data);

  return (
    <div className="workspace-feature-page stack">
      <h2 className="workspace-feature-page__title">Class groups</h2>
      <p className="workspace-feature-page__lead">
        Create sections (e.g. Grade 10-A) so students, attendance, and fees stay organized.
        {canAssignClassTeacher ? (
          <>
            {' '}
            Assign a <strong>class teacher</strong> for each section when the school uses <em>daily</em> attendance.
          </>
        ) : null}
      </p>

      <div className="card">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }} className="stack">
            <label>Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="10-A" />
          </div>
          <div style={{ flex: 2, minWidth: 220 }} className="stack">
            <label>Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Grade 10 - A" />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
        {createMutation.error ? (
          <div style={{ color: '#b91c1c', marginTop: 8 }}>{formatApiError(createMutation.error)}</div>
        ) : null}
      </div>

      <div className="card">
        {isLoading ? (
          <div>Loading…</div>
        ) : error ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(error)}</div>
        ) : (
          <div className="stack">
            <div className="muted" style={{ fontSize: 12 }}>
              Total: {pageTotalElements(data)}
            </div>
            <div className="stack">
              {pageContent(data).map((cg) => (
                <div
                  key={cg.id}
                  className="row"
                  style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
                >
                  <div>
                    <strong>{cg.displayName}</strong> <span className="muted">({cg.code})</span>
                  </div>
                  {canAssignClassTeacher ? (
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <label className="muted" style={{ fontSize: 12 }}>
                        Class teacher
                      </label>
                      <select
                        value={cg.classTeacherStaffId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          assignTeacherMutation.mutate({
                            id: cg.id,
                            staffId: v === '' ? null : Number(v),
                          });
                        }}
                        disabled={assignTeacherMutation.isPending || staff.isLoading}
                        style={{ minWidth: 200 }}
                      >
                        <option value="">— None —</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fullName} ({s.employeeNo})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 13 }}>
                      {cg.classTeacherDisplayName ? <>Class teacher: {cg.classTeacherDisplayName}</> : '—'}
                    </div>
                  )}
                  <div className="muted">ID: {cg.id}</div>
                </div>
              ))}
            </div>
            {assignTeacherMutation.error ? (
              <div style={{ color: '#b91c1c', marginTop: 8 }}>{formatApiError(assignTeacherMutation.error)}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
