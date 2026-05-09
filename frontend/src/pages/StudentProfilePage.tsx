import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SelectKeeper } from '../components/SelectKeeper';
import { DateKeeper } from '../components/DateKeeper';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import type { StudentLifecycleStatus } from '../components/students/studentListTypes';

type GuardianBrief = {
  name: string;
  phone?: string | null;
  primaryGuardian?: boolean;
};

export type StudentProfilePayload = {
  id: number;
  admissionNo: string;
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  photoUrl?: string | null;
  status?: StudentLifecycleStatus | null;
  phone?: string | null;
  address?: string | null;
  classGroupId?: number | null;
  classGroupDisplayName?: string | null;
  guardians?: GuardianBrief[];
};

function seedEditorFromProfile(p: StudentProfilePayload, setters: {
  setFirstName: (v: string) => void;
  setMiddleName: (v: string) => void;
  setLastName: (v: string) => void;
  setDob: (v: string) => void;
  setGender: (v: string) => void;
  setBloodGroup: (v: string) => void;
  setPhotoUrl: (v: string) => void;
  setStatus: (v: StudentLifecycleStatus | '') => void;
}) {
  const { setFirstName, setMiddleName, setLastName, setDob, setGender, setBloodGroup, setPhotoUrl, setStatus } = setters;
  setFirstName(p.firstName ?? '');
  setMiddleName(p.middleName ?? '');
  setLastName(p.lastName ?? '');
  setDob(p.dateOfBirth ?? '');
  setGender(p.gender ?? '');
  setBloodGroup(p.bloodGroup ?? '');
  setPhotoUrl(p.photoUrl ?? '');
  setStatus((p.status as StudentLifecycleStatus) ?? '');
}

export function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = Number(studentId);
  const qc = useQueryClient();
  const editing = searchParams.get('edit') === '1';

  const profile = useQuery({
    queryKey: ['student-profile', id],
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => (await api.get<StudentProfilePayload>(`/api/students/${id}`)).data,
  });

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [status, setStatus] = useState<StudentLifecycleStatus | ''>('');

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    seedEditorFromProfile(p, {
      setFirstName,
      setMiddleName,
      setLastName,
      setDob,
      setGender,
      setBloodGroup,
      setPhotoUrl,
      setStatus,
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () =>
      (
        await api.put<StudentProfilePayload>(`/api/students/${id}`, {
          firstName: firstName.trim(),
          middleName: middleName.trim() || null,
          lastName: lastName.trim() || null,
          dateOfBirth: dob || null,
          gender: gender.trim() || null,
          bloodGroup: bloodGroup.trim() || null,
          photoUrl: photoUrl.trim() || null,
          ...(status ? { status } : {}),
        })
      ).data,
    onSuccess: async (updated) => {
      qc.setQueryData(['student-profile', id], updated);
      seedEditorFromProfile(updated, {
        setFirstName,
        setMiddleName,
        setLastName,
        setDob,
        setGender,
        setBloodGroup,
        setPhotoUrl,
        setStatus,
      });
      await qc.invalidateQueries({ queryKey: ['students'], exact: false });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      });
    },
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="workspace-feature-page stack">
        <p>Invalid student.</p>
        <Link className="btn secondary" to="/app/students">
          Back to students
        </Link>
      </div>
    );
  }

  const displayName =
    profile.data ?
      [profile.data.firstName, profile.data.middleName, profile.data.lastName].filter(Boolean).join(' ')
    : 'Student';

  return (
    <div className="workspace-feature-page stack">
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <Link className="muted" style={{ fontSize: 13, fontWeight: 600 }} to="/app/students">
            ← Students
          </Link>
          <h2 className="workspace-feature-page__title" style={{ marginTop: 6 }}>
            {displayName}
          </h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Admission {profile.data?.admissionNo ?? '…'}
            {profile.data?.classGroupDisplayName ? ` · ${profile.data.classGroupDisplayName}` : null}
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn secondary" to={`/app/students/${id}/performance`}>
            Performance
          </Link>
          {editing ?
            <>
              <button
                type="button"
                className="btn secondary"
                disabled={save.isPending}
                onClick={() => {
                  if (profile.data)
                    seedEditorFromProfile(profile.data, {
                      setFirstName,
                      setMiddleName,
                      setLastName,
                      setDob,
                      setGender,
                      setBloodGroup,
                      setPhotoUrl,
                      setStatus,
                    });
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('edit');
                    return next;
                  });
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn" disabled={save.isPending || !firstName.trim()} onClick={() => save.mutate()}>
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </>
          : <button
              type="button"
              className="btn"
              onClick={() =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('edit', '1');
                  return next;
                })
              }
            >
              Edit
            </button>
          }
        </div>
      </div>

      {profile.isLoading ?
        <div>Loading…</div>
      : null}
      {profile.error ?
        <div className="card" style={{ color: '#991b1b' }}>
          {formatApiError(profile.error)}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn secondary" onClick={() => profile.refetch()}>
              Retry
            </button>
          </div>
        </div>
      : null}

      {profile.data ?
        <>
          {!editing ?
            <div className="card stack" style={{ gap: 14 }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
                {profile.data.photoUrl ?
                  <img
                    src={profile.data.photoUrl}
                    alt=""
                    style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover' }}
                  />
                : null}
                <div className="stack" style={{ gap: 8 }}>
                  <div>
                    <strong>Status</strong> {profile.data.status ?? '—'}
                  </div>
                  <div>
                    <strong>Date of birth</strong> {profile.data.dateOfBirth ?? '—'}
                  </div>
                  <div>
                    <strong>Gender</strong> {profile.data.gender ?? '—'}
                  </div>
                </div>
              </div>
              {(profile.data.guardians?.length ?? 0) > 0 ?
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Guardians</div>
                  <ul className="stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>
                    {profile.data.guardians!.map((g, i) => (
                      <li key={i}>
                        {g.name}
                        {g.primaryGuardian ? ' (primary)' : ''} · {g.phone ?? '—'}
                      </li>
                    ))}
                  </ul>
                </div>
              : null}
            </div>
          : <div className="card stack">
              <label>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />

              <label>Middle name</label>
              <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />

              <label>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />

              <label htmlFor="student-edit-dob">Date of birth</label>
              <DateKeeper id="student-edit-dob" value={dob ?? ''} onChange={(v) => setDob(v)} emptyLabel="Not set" clearable />

              <label>Gender</label>
              <input value={gender} onChange={(e) => setGender(e.target.value)} />

              <label>Blood group</label>
              <input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} />

              <label>Photo URL</label>
              <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />

              <label htmlFor="student-edit-status">Status</label>
              <SelectKeeper
                id="student-edit-status"
                value={status}
                onChange={(v) => setStatus(v as StudentLifecycleStatus | '')}
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE' },
                  { value: 'INACTIVE', label: 'INACTIVE' },
                  { value: 'TRANSFERRED', label: 'TRANSFERRED' },
                  { value: 'ALUMNI', label: 'ALUMNI' },
                ]}
                emptyValueLabel="Unchanged"
              />

              {save.error ?
                <div style={{ color: '#b91c1c', fontSize: 13 }}>
                  {formatApiError(save.error)}
                </div>
              : null}
            </div>
          }
        </>
      : null}
    </div>
  );
}
