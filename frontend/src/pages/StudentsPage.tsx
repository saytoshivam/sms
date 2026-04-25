import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { ClassGroupSearchCombobox } from '../components/ClassGroupSearchCombobox';

type Student = {
  id: number;
  admissionNo: string;
  firstName: string;
  lastName: string | null;
  classGroupId: number | null;
  classGroupDisplayName: string | null;
  photoUrl?: string | null;
};

type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export function StudentsPage() {
  const qc = useQueryClient();
  const [admissionNo, setAdmissionNo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classGroupId, setClassGroupId] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState('');

  const students = useQuery({
    queryKey: ['students'],
    queryFn: async () => (await api.get<Page<Student>>('/api/students?size=50')).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<Student>('/api/students', {
          admissionNo,
          firstName,
          lastName: lastName || null,
          classGroupId: classGroupId ? Number(classGroupId) : null,
          photoUrl: photoUrl.trim() || null,
        })
      ).data,
    onSuccess: async () => {
      setAdmissionNo('');
      setFirstName('');
      setLastName('');
      setClassGroupId('');
      setPhotoUrl('');
      await qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  return (
    <div className="workspace-feature-page stack">
      <h2 className="workspace-feature-page__title">Students</h2>
      <p className="workspace-feature-page__lead">
        Add learners, assign them to class groups, and open performance charts per student.
      </p>

      <div className="card">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="row">
            <div style={{ flex: 1, minWidth: 160 }} className="stack">
              <label>Admission no</label>
              <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }} className="stack">
              <label>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }} className="stack">
              <label>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 240 }} className="stack">
              <label>Class group</label>
              <ClassGroupSearchCombobox value={classGroupId} onChange={setClassGroupId} placeholder="Search class (e.g. 6-EMERALD)…" />
            </div>
            <div style={{ flex: 2, minWidth: 200 }} className="stack">
              <label>Photo URL (optional)</label>
              <input
                type="url"
                placeholder="https://… portrait for student portal"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
              />
            </div>
            <div style={{ alignSelf: 'end' }}>
              <button className="btn" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create student'}
              </button>
            </div>
          </div>
          {createMutation.error ? (
            <div style={{ color: '#b91c1c' }}>{String((createMutation.error as any)?.response?.data ?? 'Error')}</div>
          ) : null}
        </form>
      </div>

      <div className="card">
        {students.isLoading ? (
          <div>Loading…</div>
        ) : students.error ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(students.error)}</div>
        ) : (
          <div className="stack">
            <div className="muted" style={{ fontSize: 12 }}>
              Total: {students.data?.totalElements ?? 0}
            </div>
            <div className="stack">
              {(students.data?.content ?? []).map((s) => (
                <div key={s.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>
                      {s.firstName} {s.lastName ?? ''}
                    </strong>{' '}
                    <span className="muted">• {s.admissionNo}</span>
                    {s.classGroupDisplayName ? <span className="muted"> • {s.classGroupDisplayName}</span> : null}
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <Link className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} to={`/app/students/${s.id}/performance`}>
                      Charts
                    </Link>
                    <span className="muted">ID: {s.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

