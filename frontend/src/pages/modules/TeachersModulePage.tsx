import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { ModulePage, type StatusLevel } from '../../components/module/ModulePage';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import { onboardingStepHref } from '../../lib/onboardingWizardMeta';
import { OnboardedStaffCatalogPanel } from '../../components/catalog/OnboardedStaffCatalogPanel';
import {
  buildEffectiveAllocRows,
  type ClassSubjectConfigRow,
  type SectionSubjectOverrideRow,
} from '../../lib/academicStructureUtils';

type StaffView = {
  staffId: number;
  fullName: string;
  email: string;
  phone: string;
  employeeNo: string | null;
  designation: string;
  roles: string[];
  subjectCodes: string[];
  hasLoginAccount: boolean;
  maxWeeklyLectureLoad: number | null;
  preferredClassGroupIds: number[];
};

type StaffUpdateBody = {
  fullName: string;
  email: string;
  phone: string;
  employeeNo: string | null;
  designation: string;
  roles: string[];
  teachableSubjectIds: number[];
  createLoginAccount: boolean;
  maxWeeklyLectureLoad: number | null;
  preferredClassGroupIds: number[];
};

type SubjectRow = { id: number; code: string; name: string };
type Page<T> = { content: T[]; totalElements?: number };

type ClassGroup = {
  classGroupId: number;
  gradeLevel: number | null;
  code?: string;
  displayName?: string;
  section?: string | null;
};

type AcademicStructure = {
  classGroups: ClassGroup[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  allocations: {
    classGroupId: number;
    subjectId: number;
    weeklyFrequency: number;
    staffId: number | null;
    roomId: number | null;
  }[];
};

const ROLE_CHOICES = ['TEACHER', 'HOD', 'VICE_PRINCIPAL', 'PRINCIPAL', 'ACCOUNTANT', 'CLERK'] as const;

type EditDraft = {
  fullName: string;
  email: string;
  phone: string;
  employeeNo: string;
  designation: string;
  roles: Set<string>;
  teachableSubjectIds: Set<number>;
  maxWeeklyLectureLoad: number | '';
  createLoginAccount: boolean;
};

type CreateDraft = EditDraft;

const EMPTY_CREATE: CreateDraft = {
  fullName: '',
  email: '',
  phone: '',
  employeeNo: '',
  designation: 'Teacher',
  roles: new Set(['TEACHER']),
  teachableSubjectIds: new Set(),
  maxWeeklyLectureLoad: '',
  createLoginAccount: true,
};

export function TeachersModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') ?? 'browse') as 'browse' | 'add';
  const [tab, setTab] = useState<'browse' | 'add'>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE);

  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const staff = useQuery({
    queryKey: ['onboarding-staff-view'],
    queryFn: async () => (await api.get<StaffView[]>('/api/v1/onboarding/staff')).data,
  });

  const subjects = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () => (await api.get<Page<SubjectRow>>('/api/subjects?size=1000&sort=name,asc')).data,
    staleTime: 60_000,
  });

  const academic = useQuery({
    queryKey: ['onboarding-academic-structure'],
    queryFn: async () => (await api.get<AcademicStructure>('/api/v1/onboarding/academic-structure')).data,
    staleTime: 60_000,
  });

  const subjectsList = useMemo(() => subjects.data?.content ?? [], [subjects.data]);

  const list: StaffView[] = staff.data ?? [];

  const effectiveAllocs = useMemo(() => {
    const d = academic.data;
    if (!d) return [];
    if ((d.classSubjectConfigs?.length ?? 0) > 0) {
      return buildEffectiveAllocRows(d.classGroups, d.classSubjectConfigs, d.sectionSubjectOverrides);
    }
    return (d.allocations ?? []).map((a) => ({
      classGroupId: a.classGroupId,
      subjectId: a.subjectId,
      weeklyFrequency: a.weeklyFrequency,
      staffId: a.staffId ?? null,
      roomId: a.roomId ?? null,
    }));
  }, [academic.data]);

  const usageByStaff = useMemo(() => {
    const m = new Map<number, { sections: number; periods: number }>();
    for (const a of effectiveAllocs) {
      if (a.staffId == null) continue;
      const cur = m.get(a.staffId) ?? { sections: 0, periods: 0 };
      cur.sections += 1;
      cur.periods += a.weeklyFrequency > 0 ? a.weeklyFrequency : 0;
      m.set(a.staffId, cur);
    }
    return m;
  }, [effectiveAllocs]);

  const status: { level: StatusLevel; label: string } = useMemo(() => {
    if (staff.isLoading) return { level: 'idle', label: 'Loading' };
    if (staff.isError) return { level: 'error', label: 'Load failed' };
    if (list.length === 0) return { level: 'idle', label: 'Empty' };
    const overload = list.filter((t) => {
      const u = usageByStaff.get(t.staffId);
      const cap = t.maxWeeklyLectureLoad ?? 0;
      return cap > 0 && u && u.periods > cap;
    }).length;
    if (overload > 0)
      return { level: 'warn', label: `${overload} over capacity` };
    return { level: 'ok', label: `${list.length} staff` };
  }, [staff.isLoading, staff.isError, list, usageByStaff]);

  const buildBody = (d: EditDraft, fallbackEmployeeNo: string | null = null): StaffUpdateBody => ({
    fullName: d.fullName.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    employeeNo: d.employeeNo.trim() || fallbackEmployeeNo,
    designation: d.designation.trim(),
    roles: Array.from(d.roles),
    teachableSubjectIds: Array.from(d.teachableSubjectIds),
    createLoginAccount: d.createLoginAccount,
    maxWeeklyLectureLoad:
      d.maxWeeklyLectureLoad === '' ? null : Math.max(0, Math.trunc(Number(d.maxWeeklyLectureLoad))),
    preferredClassGroupIds: [],
  });

  const validateDraft = (d: EditDraft): string | null => {
    if (!d.fullName.trim()) return 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'Email looks invalid.';
    if (!d.phone.trim()) return 'Phone is required.';
    if (!d.designation.trim()) return 'Designation is required.';
    if (d.roles.size === 0) return 'Pick at least one role.';
    return null;
  };

  const createOne = useMutation({
    mutationFn: async (d: CreateDraft) => {
      const err = validateDraft(d);
      if (err) throw new Error(err);
      const body = [{ ...buildBody(d) }];
      return (await api.post<{ staffCreated: number; usersCreated: number }>('/api/v1/onboarding/staff', body)).data;
    },
    onSuccess: async () => {
      toast.success('Teacher added');
      setCreateDraft(EMPTY_CREATE);
      recordChange({
        id: `staff:add:${Date.now()}`,
        scope: 'staff',
        severity: 'soft',
        message: `Added a teacher`,
      });
      await invalidate(['staff']);
    },
    onError: (e) => toast.error('Could not add teacher', formatApiError(e)),
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
        + Add teacher
      </button>
    </>
  );

  return (
    <ModulePage
      title="Teachers"
      subtitle="Roster from onboarding API — same onboarded staff browser as the setup wizard (search, filters, edit, CSV note)."
      status={status}
      headerActions={headerActions}
      tabs={[
        { id: 'browse', label: 'Browse', badge: list.length || null },
        { id: 'add', label: 'Add new' },
      ]}
      activeTabId={tab}
      tabHrefBase="/app/teachers"
    >
      {tab === 'add' ? (
        <AddTeacherCard
          draft={createDraft}
          setDraft={setCreateDraft}
          subjects={subjectsList}
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
          <div style={{ fontWeight: 950, marginBottom: 4 }}>Bulk CSV & batch staff</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            Staff CSV and bulk flows stay in the setup wizard.{' '}
            <Link to={onboardingStepHref('STAFF')} style={{ fontWeight: 900, color: 'var(--color-primary, #ea580c)' }}>
              Open wizard — Staff step
            </Link>
            .
          </div>
        </div>
      ) : null}

      {tab === 'browse' ? (
        <div className="card stack" style={{ gap: 12, padding: 12, marginTop: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
          <OnboardedStaffCatalogPanel />
        </div>
      ) : null}
    </ModulePage>
  );
}

function AddTeacherCard({
  draft,
  setDraft,
  subjects,
  busy,
  onSave,
}: {
  draft: CreateDraft;
  setDraft: (d: CreateDraft) => void;
  subjects: SubjectRow[];
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <div className="card stack" style={{ gap: 12, padding: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 14 }}>Add a teacher</div>
      <CommonTeacherFields draft={draft} setDraft={setDraft} subjects={subjects} />
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onSave} disabled={busy}>
          {busy ? 'Adding…' : 'Add teacher'}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        After saving, you can assign this teacher to sections from <Link to="/app/academic">Academic structure</Link>.
      </div>
    </div>
  );
}

function CommonTeacherFields({
  draft,
  setDraft,
  subjects,
}: {
  draft: EditDraft;
  setDraft: (d: EditDraft) => void;
  subjects: SubjectRow[];
}) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Full name" flex="2 1 240px">
          <input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
        </Field>
        <Field label="Email" flex="2 1 220px">
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </Field>
        <Field label="Phone" flex="1 1 160px">
          <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        </Field>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Field label="Designation" flex="2 1 200px">
          <input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} />
        </Field>
        <Field label="Employee no (optional)" flex="1 1 180px">
          <input value={draft.employeeNo} onChange={(e) => setDraft({ ...draft, employeeNo: e.target.value })} />
        </Field>
        <Field label="Max weekly periods" flex="0 0 170px">
          <input
            type="number"
            min={0}
            max={60}
            value={draft.maxWeeklyLectureLoad === '' ? '' : draft.maxWeeklyLectureLoad}
            onChange={(e) =>
              setDraft({
                ...draft,
                maxWeeklyLectureLoad: e.target.value === '' ? '' : Math.max(0, Math.trunc(Number(e.target.value))),
              })
            }
          />
        </Field>
      </div>
      <Field label="Roles">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {ROLE_CHOICES.map((r) => {
            const on = draft.roles.has(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  const next = new Set(draft.roles);
                  if (on) next.delete(r);
                  else next.add(r);
                  setDraft({ ...draft, roles: next });
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: on ? '1px solid #f97316' : '1px solid rgba(15,23,42,0.18)',
                  background: on ? 'rgba(249,115,22,0.15)' : '#fff',
                  color: on ? '#7c2d12' : '#475569',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label={`Teachable subjects (${draft.teachableSubjectIds.size})`}>
        <div
          className="row"
          style={{
            gap: 6,
            flexWrap: 'wrap',
            maxHeight: 200,
            overflowY: 'auto',
            padding: 6,
            border: '1px solid rgba(15,23,42,0.10)',
            borderRadius: 8,
          }}
        >
          {subjects.length === 0 ? (
            <span className="muted" style={{ fontSize: 12 }}>
              No subjects yet. Add subjects in the <Link to="/app/subjects">Subjects</Link> module first.
            </span>
          ) : (
            subjects.map((s) => {
              const on = draft.teachableSubjectIds.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(draft.teachableSubjectIds);
                    if (on) next.delete(s.id);
                    else next.add(s.id);
                    setDraft({ ...draft, teachableSubjectIds: next });
                  }}
                  title={s.name}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: on ? '1px solid #16a34a' : '1px solid rgba(15,23,42,0.18)',
                    background: on ? 'rgba(22,163,74,0.12)' : '#fff',
                    color: on ? '#166534' : '#475569',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {s.code}
                </button>
              );
            })
          )}
        </div>
      </Field>
      <label className="row" style={{ gap: 8, alignItems: 'center', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={draft.createLoginAccount}
          onChange={(e) => setDraft({ ...draft, createLoginAccount: e.target.checked })}
        />
        <span>Create / keep login account</span>
      </label>
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
