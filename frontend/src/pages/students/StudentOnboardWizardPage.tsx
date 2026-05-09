import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SelectKeeper } from '../../components/SelectKeeper';
import { DateKeeper } from '../../components/DateKeeper';
import { useClassGroupsCatalog, type ClassGroupRow } from '../../components/ClassGroupSearchCombobox';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { formatApiError } from '../../lib/errors';
import { isWorkspaceReadOnly, WorkspaceReadOnlyRibbon } from '../../lib/workspaceViewMode';
import type { StudentProfilePayload } from '../StudentProfilePage';
import {
  STEP_DEF,
  ADMISSION_CATEGORY_OPTIONS,
  emptyGuardian,
  defaultDraft,
  type StudentOnboardingDraft,
  type AdmissionCategory,
} from './studentOnboardTypes';
import {
  studentBasicsErrors,
  placementErrors,
  guardiansErrors,
  allRequiredErrors,
  missingAdmissionLabels,
  errorsForAdmissionStep,
} from './studentOnboardValidation';
import { saveOnboardingDraft, loadOnboardingDraft, clearOnboardingDraft } from './studentOnboardDraftStorage';
import { buildStudentOnboardPayload } from './buildStudentOnboardPayload';
import './studentOnboardWizard.css';

type AcademicYearApi = {
  id: number;
  label: string;
  startsOn: string;
  endsOn: string;
};

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

function fieldErr(errors: Record<string, string>, key: string) {
  const m = errors[key];
  return m ? <div className="stw-err">{m}</div> : null;
}

function uniqCompleted(prev: number[], step: number) {
  if (prev.includes(step)) return prev;
  return [...prev, step].sort((a, b) => a - b);
}

export function StudentOnboardWizardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const readOnly = isWorkspaceReadOnly(searchParams);
  const qc = useQueryClient();

  const [draft, setDraft] = useState<StudentOnboardingDraft>(() => loadOnboardingDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const stepIndex = draft.stepIndex;

  const academicYears = useQuery({
    queryKey: ['academic-years-school'],
    queryFn: async () => (await api.get<AcademicYearApi[]>('/api/academic-years')).data,
    staleTime: 60_000,
  });

  const classCatalog = useClassGroupsCatalog();

  useEffect(() => {
    const t = window.setTimeout(() => saveOnboardingDraft(draft), 450);
    return () => window.clearTimeout(t);
  }, [draft]);

  const ayOptions = useMemo(
    () =>
      (academicYears.data ?? []).map((y) => ({
        value: String(y.id),
        label: `${y.label}`,
      })),
    [academicYears.data],
  );

  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of classCatalog.data?.content ?? []) {
      if (row.gradeLevel != null) set.add(String(row.gradeLevel));
    }
    return [...set].sort((a, b) => Number(a) - Number(b)).map((g) => ({ value: g, label: `Class ${g}` }));
  }, [classCatalog.data?.content]);

  const rawSectionCandidates = useMemo(() => {
    const g = draft.enrollment.gradeLevel.trim();
    const rows = classCatalog.data?.content ?? [];
    const set = new Set<string>();
    for (const r of rows) {
      if (!g || String(r.gradeLevel ?? '') !== g) continue;
      const s = r.section?.trim();
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s }));
  }, [classCatalog.data?.content, draft.enrollment.gradeLevel]);

  const matchingGroups = useMemo(() => {
    const g = draft.enrollment.gradeLevel.trim();
    const sec = draft.enrollment.section.trim();
    const rows = classCatalog.data?.content ?? [];
    if (!g) return [] as ClassGroupRow[];
    return rows.filter((r) => {
      if (String(r.gradeLevel ?? '') !== g) return false;
      if (!sec) return true;
      return (r.section?.trim() ?? '').toLowerCase() === sec.toLowerCase();
    });
  }, [classCatalog.data?.content, draft.enrollment.gradeLevel, draft.enrollment.section]);

  useEffect(() => {
    const soleId = matchingGroups.length === 1 ? String(matchingGroups[0]!.id) : null;
    setDraft((prev) => {
      let classGroupId = prev.enrollment.classGroupId;
      if (soleId) classGroupId = soleId;
      else if (matchingGroups.length > 0) {
        const cur = prev.enrollment.classGroupId.trim();
        const ok = cur && matchingGroups.some((m) => String(m.id) === cur);
        if (!ok) classGroupId = '';
      } else classGroupId = '';

      if (classGroupId === prev.enrollment.classGroupId) return prev;
      return { ...prev, enrollment: { ...prev.enrollment, classGroupId } };
    });
  }, [matchingGroups]);

  const cgOptions = useMemo(
    () =>
      matchingGroups.map((r) => ({
        value: String(r.id),
        label: r.displayName + (r.code ? ` (${r.code})` : ''),
      })),
    [matchingGroups],
  );

  const admissionTypeOpts = useMemo(
    () => ADMISSION_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const completedMax =
    draft.completedSteps.length === 0 ? 0 : Math.max(...draft.completedSteps);
  const farthestVisited = Math.max(stepIndex, completedMax, 0);

  const validateCurrent = useCallback(() => {
    let e: Record<string, string> = {};
    if (stepIndex === 0) e = { ...studentBasicsErrors(draft.student) };
    else if (stepIndex === 1) e = { ...placementErrors(draft.enrollment, rawSectionCandidates, matchingGroups) };
    else if (stepIndex === 2) e = { ...guardiansErrors(draft.guardians) };
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [draft, stepIndex, rawSectionCandidates, matchingGroups]);

  const missingLabels = useMemo(
    () => missingAdmissionLabels(draft, rawSectionCandidates, matchingGroups),
    [draft, rawSectionCandidates, matchingGroups],
  );

  const stepIssueFlags = useMemo(
    () =>
      STEP_DEF.map(
        (_, i) => Object.keys(errorsForAdmissionStep(i, draft, rawSectionCandidates, matchingGroups)).length > 0,
      ),
    [draft, rawSectionCandidates, matchingGroups],
  );

  const displayStudentName =
    [draft.student.firstName, draft.student.middleName, draft.student.lastName].filter((x) => String(x ?? '').trim()).join(' ').trim() ||
    'Student name';

  const primaryGx = draft.guardians.find((g) => g.primaryGuardian) ?? draft.guardians[0];

  const goNext = () => {
    if (!validateCurrent()) return;
    setDraft((d) => ({
      ...d,
      stepIndex: Math.min(d.stepIndex + 1, STEP_DEF.length - 1),
      completedSteps: uniqCompleted(d.completedSteps, d.stepIndex),
    }));
    setErrors({});
  };

  const goPrev = () => {
    setDraft((d) => ({
      ...d,
      stepIndex: Math.max(0, d.stepIndex - 1),
    }));
    setErrors({});
  };

  const setPrimaryIx = (ix: number) => {
    setDraft((d) => ({
      ...d,
      guardians: d.guardians.map((g, i) => ({ ...g, primaryGuardian: i === ix })),
    }));
  };

  const addGuardian = () => {
    setDraft((d) => ({
      ...d,
      guardians: [...d.guardians, emptyGuardian(false)],
    }));
  };

  const removeGuardian = (ix: number) => {
    setDraft((d) => {
      if (d.guardians.length <= 1) return d;
      const next = d.guardians.filter((_, i) => i !== ix);
      if (!next.some((g) => g.primaryGuardian)) next[0] = { ...next[0]!, primaryGuardian: true };
      return { ...d, guardians: next };
    });
  };

  const previewPayload = useMemo(() => buildStudentOnboardPayload(draft), [draft]);

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.post<StudentProfilePayload>('/api/students', body)).data,
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['students'], exact: false });
      clearOnboardingDraft();
      toast.success(
        'Student onboarded',
        `${created.firstName} ${created.lastName ?? ''} · Admission ${created.admissionNo}`,
      );
      navigate(`/app/students/${created.id}`);
    },
    onError: (err: unknown) => {
      toast.error('Could not create student', formatApiError(err));
    },
  });

  const submitReview = () => {
    const e = allRequiredErrors(draft, rawSectionCandidates, matchingGroups);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error('Check required fields', 'Complete required steps before submitting.');
      return;
    }
    createMutation.mutate(buildStudentOnboardPayload(draft));
  };

  const cgLabel =
    cgOptions.find((o) => o.value === draft.enrollment.classGroupId)?.label ??
    matchingGroups.find((r) => String(r.id) === draft.enrollment.classGroupId)?.displayName;

  const ayLabel = ayOptions.find((o) => o.value === draft.enrollment.academicYearId)?.label ?? '—';

  const placementPreview =
    cgLabel ??
    (draft.enrollment.gradeLevel.trim()
      ? `Class ${draft.enrollment.gradeLevel}${draft.enrollment.section.trim() ? ` · Section ${draft.enrollment.section.trim()}` : ''}`
      : null);

  const guardianPreviewName =
    primaryGx?.name.trim() ? primaryGx.name.trim() : stepIssueFlags[2] ? 'Incomplete' : '—';

  const guardianPreviewDetail = primaryGx?.name.trim()
    ? [primaryGx.relation.trim() || 'Relation', primaryGx.phone.trim() ? primaryGx.phone.trim() : 'Phone missing'].join(' · ')
    : 'Name, relation, and phone unlock this profile.';

  const initials = (
    `${draft.student.firstName?.slice(0, 1) ?? ''}${draft.student.lastName?.slice(0, 1) ?? ''}`.trim() || '?'
  ).toUpperCase();

  const saveDraftManual = () => {
    saveOnboardingDraft(draft);
    toast.success('Draft saved', 'Progress is saved on this device.');
  };

  /** Shared live summary panel (desktop rail + mobile sheet). */
  const liveSummary = (
    <>
      <p className="stw-sum-eyebrow">Student preview</p>
      <h3 className="stw-sum-name">{displayStudentName}</h3>
      <p className="stw-sum-meta">
        <span className="stw-sum-label">Admission no</span>
        <span className="stw-sum-value">{draft.student.admissionNo.trim() || '—'}</span>
      </p>
      <dl className="stw-sum-dl">
        <div className="stw-sum-row">
          <dt>Placement</dt>
          <dd>{placementPreview ?? 'Not selected'}</dd>
        </div>
        <div className="stw-sum-row">
          <dt>Academic year</dt>
          <dd>{draft.enrollment.academicYearId.trim() ? ayLabel : '—'}</dd>
        </div>
        <div className="stw-sum-row">
          <dt>Primary guardian</dt>
          <dd>
            <span className={!primaryGx?.name.trim() ? 'stw-sum-warn' : undefined}>{guardianPreviewName}</span>
            <div className="stw-sum-sub">{guardianPreviewDetail}</div>
          </dd>
        </div>
      </dl>

      <div className="stw-sum-check">
        <p className="stw-sum-check-title">Required before submit</p>
        {missingLabels.length === 0 ?
          <p className="stw-sum-ok">All required items are covered.</p>
        : <ul className="stw-sum-missing-list">
            {missingLabels.slice(0, 8).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>}
        {missingLabels.length > 8 ? (
          <p className="stw-sum-more muted">…and more — completing earlier steps clears this list.</p>
        ) : null}
      </div>
    </>
  );

  const jumpToStep = (i: number) => {
    setDraft((d) => ({ ...d, stepIndex: i }));
    setErrors({});
  };

  const verticalStepCls = (i: number) => {
    const cur = i === stepIndex;
    const issue = !!(stepIssueFlags[i] ?? false);
    const passed = draft.completedSteps.includes(i);
    return ['stw-rail-step', cur ? ' stw-rail-step--current' : '', passed && !cur && !issue ? ' stw-rail-step--done' : '', issue ? ' stw-rail-step--warn' : '']
      .filter(Boolean)
      .join(' ')
      .trim();
  };

  const stepRailHint = (i: number): string => {
    if (i <= 2) return 'Required fields';
    if (i <= 5) return 'Optional';
    return 'Finalize';
  };

  const stepRailGlyph = (i: number) => {
    const issue = stepIssueFlags[i] ?? false;
    const passed = draft.completedSteps.includes(i);
    if (issue) return '!';
    if (passed && i !== stepIndex) return '✓';
    return String(i + 1);
  };

  const progressPct = Math.round(((stepIndex + 1) / STEP_DEF.length) * 100);

  return (
    <div className="workspace-feature-page stw-shell">
      <div className="stw-shell-head">
        <nav className="stw-crumb muted">
          <Link to="/app/students">Students</Link>
          <span className="stw-crumb-sep" aria-hidden="true">
            /
          </span>
          <span>New admission</span>
        </nav>
        <div className="stw-shell-head-inner">
          <div>
            <p className="stw-shell-eyebrow">Guided onboarding</p>
            <h1 className="stw-shell-title">Add student admission</h1>
            <p className="stw-shell-lead muted">Step-by-step placement and guardian capture for your roster.</p>
          </div>
        </div>
      </div>

      {readOnly ? <WorkspaceReadOnlyRibbon title="Add student — browse only mode" /> : null}

      <section className="stw-mobile-bar" aria-label="Admission progress">
        <div className="stw-mobile-bar-top">
          <div className="stw-progress-track" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEP_DEF.length}>
            <span className="stw-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <button
            type="button"
            className="btn secondary stw-preview-toggle"
            onClick={() => setMobilePreviewOpen((o) => !o)}
            aria-expanded={mobilePreviewOpen}
          >
            {mobilePreviewOpen ? 'Hide preview' : 'Preview'}
          </button>
        </div>
        <p className="stw-mobile-bar-meta muted">
          Step {stepIndex + 1} of {STEP_DEF.length} · {STEP_DEF[stepIndex]!.title}
        </p>
      </section>

      <div className="stw-workspace-grid">
        <aside className="stw-sidebar stw-sidebar--rail" aria-label="Admission steps">
          <div className="stw-sidebar-title muted">Admission steps</div>
          <ul className="stw-rail-list">
            {STEP_DEF.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={readOnly || i > farthestVisited}
                  className={`${verticalStepCls(i)}`}
                  onClick={() => jumpToStep(i)}
                >
                  <span className="stw-rail-glyph">{stepRailGlyph(i)}</span>
                  <span className="stw-rail-label">
                    <span className="stw-rail-title">{s.title}</span>
                    <span className="stw-rail-sub muted">{stepRailHint(i)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="stw-main">
          <div className="stw-panel stw-main-card">
        {stepIndex === 0 ?
          <div className="stw-step-body">
            <h2 className="stw-step-title">Learner identity</h2>
            <p className="stw-step-lead muted">Legal name as it should appear across reports and transcripts.</p>
            <div className="stw-step1-shell">
              <div className="stw-step1-fields">
                <fieldset className="stw-fieldset">
                  <legend className="stw-fieldset-legend">Required identity</legend>
                  <div className="stw-fields stw-fields--tight">
                    <div className="stw-field-span2">
                      <label htmlFor="stw-admission">
                        Admission no <span className="stw-req">*</span>
                      </label>
                      <input
                        id="stw-admission"
                        disabled={readOnly}
                        autoComplete="off"
                        value={draft.student.admissionNo}
                        onChange={(ev) =>
                          setDraft((d) => ({ ...d, student: { ...d.student, admissionNo: ev.target.value } }))
                        }
                      />
                      {fieldErr(errors, 'admissionNo')}
                    </div>
                    <div>
                      <label htmlFor="stw-first">
                        First name <span className="stw-req">*</span>
                      </label>
                      <input
                        id="stw-first"
                        disabled={readOnly}
                        value={draft.student.firstName}
                        onChange={(ev) =>
                          setDraft((d) => ({ ...d, student: { ...d.student, firstName: ev.target.value } }))
                        }
                      />
                      {fieldErr(errors, 'firstName')}
                    </div>
                    <div>
                      <label htmlFor="stw-last">
                        Last name <span className="stw-req">*</span>
                      </label>
                      <input
                        id="stw-last"
                        disabled={readOnly}
                        value={draft.student.lastName}
                        onChange={(ev) =>
                          setDraft((d) => ({ ...d, student: { ...d.student, lastName: ev.target.value } }))
                        }
                      />
                      {fieldErr(errors, 'lastName')}
                    </div>
                  </div>
                </fieldset>
                <fieldset className="stw-fieldset stw-fieldset--soft">
                  <legend className="stw-fieldset-legend">Optional personal details</legend>
                  <div className="stw-fields stw-fields--tight">
                    <div className="stw-field-span2">
                      <label htmlFor="stw-middle">Middle name</label>
                      <input
                        id="stw-middle"
                        disabled={readOnly}
                        value={draft.student.middleName}
                        onChange={(ev) =>
                          setDraft((d) => ({ ...d, student: { ...d.student, middleName: ev.target.value } }))
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="stw-dob">Date of birth</label>
                      <DateKeeper
                        id="stw-dob"
                        disabled={readOnly}
                        emptyLabel="Not set — optional"
                        clearable
                        value={draft.student.dateOfBirth}
                        onChange={(ymd) => setDraft((d) => ({ ...d, student: { ...d.student, dateOfBirth: ymd } }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="stw-gender">Gender</label>
                      <SelectKeeper
                        id="stw-gender"
                        disabled={readOnly}
                        value={draft.student.gender}
                        onChange={(v) =>
                          setDraft((d) => ({
                            ...d,
                            student: { ...d.student, gender: v },
                          }))
                        }
                        options={GENDER_OPTIONS}
                        emptyValueLabel="Not specified"
                      />
                    </div>
                    <div>
                      <label htmlFor="stw-blood">Blood group</label>
                      <input
                        id="stw-blood"
                        disabled={readOnly}
                        value={draft.student.bloodGroup}
                        placeholder="e.g. B+"
                        onChange={(ev) =>
                          setDraft((d) => ({
                            ...d,
                            student: { ...d.student, bloodGroup: ev.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </fieldset>
              </div>
              <aside className="stw-photo-rail" aria-label="Portrait">
                <div className="stw-photo-chip" aria-hidden="true">
                  <span>{initials}</span>
                </div>
                <p className="stw-photo-rail-caption">Photo can be added after profile creation.</p>
              </aside>
            </div>
          </div>
        : null}

        {stepIndex === 1 ?
          <>
            <h2 className="stw-step-title">Academic placement</h2>
            <p className="stw-step-lead muted">Select the timetable class · roll numbers must stay unique in that group.</p>
            <div className="stw-fields">
              <div className="stw-field-span2">
                <label htmlFor="stw-year">Academic year</label>
                <SelectKeeper
                  id="stw-year"
                  disabled={readOnly || academicYears.isLoading}
                  value={draft.enrollment.academicYearId}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, enrollment: { ...d.enrollment, academicYearId: v } }))
                  }
                  options={ayOptions}
                  emptyValueLabel="Select academic year…"
                  searchable={ayOptions.length > 8}
                />
                {fieldErr(errors, 'academicYearId')}
              </div>
              <div>
                <label htmlFor="stw-grade">Class (grade)</label>
                <SelectKeeper
                  id="stw-grade"
                  disabled={readOnly || classCatalog.isLoading}
                  value={draft.enrollment.gradeLevel}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      enrollment: { ...d.enrollment, gradeLevel: v, section: '', classGroupId: '' },
                    }))
                  }
                  options={gradeOptions}
                  emptyValueLabel="Select class…"
                  searchable={gradeOptions.length > 12}
                />
                {fieldErr(errors, 'gradeLevel')}
              </div>
              <div>
                <label htmlFor="stw-section">Section</label>
                <SelectKeeper
                  id="stw-section"
                  disabled={readOnly || !draft.enrollment.gradeLevel.trim() || rawSectionCandidates.length === 0}
                  value={draft.enrollment.section}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      enrollment: { ...d.enrollment, section: v, classGroupId: '' },
                    }))
                  }
                  options={rawSectionCandidates}
                  emptyValueLabel={rawSectionCandidates.length === 0 ? 'N/A · no labelled sections' : 'Select section…'}
                  searchable={rawSectionCandidates.length > 14}
                />
                {fieldErr(errors, 'section')}
              </div>
              {draft.enrollment.gradeLevel.trim() ?
                <div className="stw-field-span2">
                  <label htmlFor="stw-classgroup">Timetable class group</label>
                  {matchingGroups.length === 0 ?
                    <div className="stw-banner">
                      No class-section rows exist for this choice. Finish “Classes &amp; sections” first.
                    </div>
                  : matchingGroups.length === 1 ?
                    <div className="muted" style={{ fontSize: 14 }}>
                      Selected:{' '}
                      <strong>{cgLabel}</strong>
                    </div>
                  : <SelectKeeper
                      id="stw-classgroup"
                      disabled={readOnly || cgOptions.length === 0}
                      value={draft.enrollment.classGroupId}
                      onChange={(v) =>
                        setDraft((d) => ({ ...d, enrollment: { ...d.enrollment, classGroupId: v } }))
                      }
                      options={cgOptions}
                      emptyValueLabel="Pick one group…"
                      searchable
                    />
                  }
                  {fieldErr(errors, 'classGroupId')}
                </div>
              : null}

              <div>
                <label htmlFor="stw-roll">Roll no</label>
                <input
                  id="stw-roll"
                  disabled={readOnly}
                  value={draft.enrollment.rollNo}
                  placeholder="Optional"
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      enrollment: { ...d.enrollment, rollNo: ev.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="stw-admdate">Admission date</label>
                <DateKeeper
                  id="stw-admdate"
                  disabled={readOnly}
                  emptyLabel="Not set — optional"
                  clearable
                  value={draft.enrollment.admissionDate}
                  onChange={(ymd) =>
                    setDraft((d) => ({
                      ...d,
                      enrollment: { ...d.enrollment, admissionDate: ymd },
                    }))
                  }
                />
              </div>
              <div>
                <label htmlFor="stw-join">Joining date</label>
                <DateKeeper
                  id="stw-join"
                  disabled={readOnly}
                  emptyLabel="Not set — optional"
                  clearable
                  value={draft.enrollment.joiningDate}
                  onChange={(ymd) =>
                    setDraft((d) => ({
                      ...d,
                      enrollment: { ...d.enrollment, joiningDate: ymd },
                    }))
                  }
                />
              </div>
              <div className="stw-field-span2">
                <label htmlFor="stw-admtype">Admission type</label>
                <SelectKeeper
                  id="stw-admtype"
                  disabled={readOnly}
                  value={draft.enrollment.admissionCategory}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      enrollment: {
                        ...d.enrollment,
                        admissionCategory: v as AdmissionCategory | '',
                      },
                    }))
                  }
                  options={admissionTypeOpts}
                  emptyValueLabel="Optional"
                />
              </div>
            </div>
          </>
        : null}

        {stepIndex === 2 ?
          <>
            <h2 className="stw-step-title">Guardians & custody</h2>
            <p className="stw-step-lead muted">
              Capture the primary contact · mark exactly one caregiver as primary for notices and pickups.
            </p>
            {fieldErr(errors, 'guardians')}
            {draft.guardians.map((g, ix) => (
              <div key={`g-${ix}`} className="stw-guardian-card">
                <div className="stw-guardian-head">
                  <strong>Guardian {ix + 1}</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" className="btn secondary" disabled={readOnly || g.primaryGuardian} onClick={() => setPrimaryIx(ix)}>
                      Make primary
                    </button>
                    {g.primaryGuardian ?
                      <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
                        Primary
                      </span>
                    : null}
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={readOnly || draft.guardians.length <= 1}
                      onClick={() => removeGuardian(ix)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="stw-fields">
                  <div>
                    <label>Full name</label>
                    <input
                      disabled={readOnly}
                      value={g.name}
                      onChange={(ev) =>
                        setDraft((d) => {
                          const next = [...d.guardians];
                          next[ix] = { ...next[ix]!, name: ev.target.value };
                          return { ...d, guardians: next };
                        })
                      }
                    />
                    {fieldErr(errors, `guardian_${ix}_name`)}
                  </div>
                  <div>
                    <label>Relation</label>
                    <input
                      disabled={readOnly}
                      value={g.relation}
                      onChange={(ev) =>
                        setDraft((d) => {
                          const next = [...d.guardians];
                          next[ix] = { ...next[ix]!, relation: ev.target.value };
                          return { ...d, guardians: next };
                        })
                      }
                    />
                    {fieldErr(errors, `guardian_${ix}_relation`)}
                  </div>
                  <div>
                    <label>Phone</label>
                    <input
                      disabled={readOnly}
                      value={g.phone}
                      onChange={(ev) =>
                        setDraft((d) => {
                          const next = [...d.guardians];
                          next[ix] = { ...next[ix]!, phone: ev.target.value };
                          return { ...d, guardians: next };
                        })
                      }
                    />
                    {fieldErr(errors, `guardian_${ix}_phone`)}
                  </div>
                  <div>
                    <label>Email</label>
                    <input
                      disabled={readOnly}
                      type="email"
                      value={g.email}
                      onChange={(ev) =>
                        setDraft((d) => {
                          const next = [...d.guardians];
                          next[ix] = { ...next[ix]!, email: ev.target.value };
                          return { ...d, guardians: next };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label>Occupation</label>
                    <input
                      disabled={readOnly}
                      value={g.occupation}
                      onChange={(ev) =>
                        setDraft((d) => {
                          const next = [...d.guardians];
                          next[ix] = { ...next[ix]!, occupation: ev.target.value };
                          return { ...d, guardians: next };
                        })
                      }
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <label style={{ textTransform: 'none', letterSpacing: 0 }}>
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={g.canLogin}
                        onChange={(ev) =>
                          setDraft((d) => {
                            const next = [...d.guardians];
                            next[ix] = { ...next[ix]!, canLogin: ev.target.checked };
                            return { ...d, guardians: next };
                          })
                        }
                      />{' '}
                      May receive a login invitation later
                    </label>
                    <label style={{ textTransform: 'none', letterSpacing: 0 }}>
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={g.receivesNotifications}
                        onChange={(ev) =>
                          setDraft((d) => {
                            const next = [...d.guardians];
                            next[ix] = { ...next[ix]!, receivesNotifications: ev.target.checked };
                            return { ...d, guardians: next };
                          })
                        }
                      />{' '}
                      Receives notifications
                    </label>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="btn secondary" disabled={readOnly} onClick={addGuardian}>
              + Add another guardian
            </button>
          </>
        : null}

        {stepIndex === 3 ?
          <>
            <h2 className="stw-step-title">Address &amp; wellness</h2>
            <p className="stw-step-lead muted">
              Residence merges into profile · also copied to the{' '}
              <strong>primary</strong> guardian for communications.
            </p>
            <h3 className="stw-subhead">Residential address</h3>
            <div className="stw-fields">
              <div className="stw-field-span2">
                <label>Address line 1</label>
                <input
                  disabled={readOnly}
                  value={draft.residence.addressLine1}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      residence: { ...d.residence, addressLine1: ev.target.value },
                    }))
                  }
                />
              </div>
              <div className="stw-field-span2">
                <label>Address line 2</label>
                <input
                  disabled={readOnly}
                  value={draft.residence.addressLine2}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      residence: { ...d.residence, addressLine2: ev.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label>City</label>
                <input
                  disabled={readOnly}
                  value={draft.residence.city}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      residence: { ...d.residence, city: ev.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label>State</label>
                <input
                  disabled={readOnly}
                  value={draft.residence.state}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      residence: { ...d.residence, state: ev.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label>Pincode</label>
                <input
                  disabled={readOnly}
                  value={draft.residence.pincode}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      residence: { ...d.residence, pincode: ev.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <h3 className="stw-subhead">Medical &amp; emergency</h3>
            <div className="stw-fields">
              <div className="stw-field-span2">
                <label>Allergies</label>
                <textarea
                  disabled={readOnly}
                  value={draft.medical.allergies}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      medical: { ...d.medical, allergies: ev.target.value },
                    }))
                  }
                />
              </div>
              <div className="stw-field-span2">
                <label>Medical conditions</label>
                <textarea
                  disabled={readOnly}
                  value={draft.medical.medicalConditions}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      medical: { ...d.medical, medicalConditions: ev.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label>Emergency contact name</label>
                <input
                  disabled={readOnly}
                  value={draft.medical.emergencyContactName}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      medical: { ...d.medical, emergencyContactName: ev.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label>Emergency contact phone</label>
                <input
                  disabled={readOnly}
                  value={draft.medical.emergencyContactPhone}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      medical: { ...d.medical, emergencyContactPhone: ev.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <label>Doctor contact</label>
                <input
                  disabled={readOnly}
                  value={draft.medical.doctorContact}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      medical: { ...d.medical, doctorContact: ev.target.value },
                    }))
                  }
                />
              </div>
              <div className="stw-field-span2">
                <label>Medication notes</label>
                <textarea
                  disabled={readOnly}
                  value={draft.medical.medicationNotes}
                  onChange={(ev) =>
                    setDraft((d) => ({
                      ...d,
                      medical: { ...d.medical, medicationNotes: ev.target.value },
                    }))
                  }
                />
              </div>
            </div>
          </>
        : null}

        {stepIndex === 4 ?
          <>
            <h2 className="stw-step-title">Supporting documents</h2>
            <p className="stw-step-lead muted">
              Families often bring these originals at admission — checklist what you still need face-to-face.
            </p>
            <p className="stw-docs-note muted">Document upload can be completed after student profile creation.</p>
            <ul className="stw-chip-list">
              {[
                'Birth Certificate',
                'Aadhaar Card',
                'Transfer Certificate',
                'Previous Marksheet',
                'Parent ID Proof',
                'Address Proof',
              ].map((doc) => (
                <li key={doc} className="stw-chip stw-chip--doc">
                  <span className="stw-chip-dot" aria-hidden="true">
                    ●
                  </span>
                  <span className="stw-chip-name">{doc}</span>
                  <span className="stw-chip-hint muted">Pending</span>
                </li>
              ))}
            </ul>
          </>
        : null}

        {stepIndex === 5 ?
          <>
            <h2 className="stw-step-title">Portal access planning</h2>
            <p className="stw-step-lead muted">Reserve these choices now — provisioning follows your ICT policy rollout.</p>
            <label className="stw-soft-option">
              <input type="checkbox" disabled aria-disabled="true" />
              <span>Create student portal login when available</span>
            </label>
            <label className="stw-soft-option">
              <input type="checkbox" disabled aria-disabled="true" />
              <span>Create parent portal login when available</span>
            </label>
          </>
        : null}

        {stepIndex === 6 ?
          <>
            <h2 className="stw-step-title">Review admission</h2>
            <p className="stw-step-lead muted">Ensure leadership records match what guardians signed off offline.</p>
            {missingLabels.length ?
              <div className="stw-banner stw-banner--issue">
                {missingLabels.length} required item(s) outstanding — revisit the flagged steps via the navigator.
              </div>
            : null}
            <div className="stw-review-grid">
              <div className="stw-review-row">
                <div className="stw-review-key">Student</div>
                <div className="stw-review-val">
                  {[draft.student.firstName, draft.student.middleName, draft.student.lastName].filter(Boolean).join(' ')}{' '}
                  · Admission {draft.student.admissionNo || '—'}
                  <div>{fieldErr(errors, 'admissionNo')}</div>
                  <div>{fieldErr(errors, 'firstName')}</div>
                  <div>{fieldErr(errors, 'lastName')}</div>
                </div>
              </div>
              <div className="stw-review-row">
                <div className="stw-review-key">Academic year</div>
                <div className="stw-review-val">
                  {ayLabel}
                  {fieldErr(errors, 'academicYearId')}
                </div>
              </div>
              <div className="stw-review-row">
                <div className="stw-review-key">Class group</div>
                <div className="stw-review-val">
                  {cgLabel ?? draft.enrollment.classGroupId ?? '—'}
                  {fieldErr(errors, 'classGroupId')}
                  {fieldErr(errors, 'gradeLevel')}
                  {fieldErr(errors, 'section')}
                </div>
              </div>
              <div className="stw-review-row">
                <div className="stw-review-key">Roll / Admission type</div>
                <div className="stw-review-val">
                  {[draft.enrollment.rollNo || 'Roll —', admissionTypeOpts.find((o) => o.value === draft.enrollment.admissionCategory)?.label ?? draft.enrollment.admissionCategory ?? 'Unset']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <div className="stw-review-row">
                <div className="stw-review-key">Guardians</div>
                <div className="stw-review-val">
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {draft.guardians.map((g, ix) => (
                      <li key={ix}>
                        {g.name || '—'} ({g.primaryGuardian ? 'primary · ' : ''}
                        {g.relation}) — {g.phone || '—'}
                      </li>
                    ))}
                  </ul>
                  {draft.guardians.map((_, ix) => (
                    <div key={`ge-${ix}`}>
                      {fieldErr(errors, `guardian_${ix}_name`)}
                      {fieldErr(errors, `guardian_${ix}_relation`)}
                      {fieldErr(errors, `guardian_${ix}_phone`)}
                    </div>
                  ))}
                  {fieldErr(errors, 'guardians')}
                </div>
              </div>
              <div className="stw-review-row">
                <div className="stw-review-key">Residence summary</div>
                <div className="stw-review-val">
                  {[draft.residence.addressLine1, draft.residence.addressLine2, [draft.residence.city, draft.residence.state].filter(Boolean).join(', '), draft.residence.pincode]
                    .filter((x) => String(x ?? '').trim())
                    .join(' · ') || '—'}
                </div>
              </div>
            </div>
            <details className="stw-debug-details">
              <summary>Technical payload (support)</summary>
              <pre className="stw-debug-pre">{JSON.stringify(previewPayload, null, 2)}</pre>
            </details>
          </>
        : null}

            <footer className="stw-footer">
              <div className="stw-footer-row">
                <button type="button" className="btn secondary" disabled={stepIndex === 0 || readOnly} onClick={goPrev}>
                  Back
                </button>
                <div className="stw-footer-spacer" />
                <button type="button" className="btn secondary" disabled={readOnly} onClick={saveDraftManual}>
                  Save draft
                </button>
                {stepIndex < STEP_DEF.length - 1 ?
                  <button type="button" className="btn" disabled={readOnly} onClick={goNext}>
                    Continue
                  </button>
                : <button
                    type="button"
                    className="btn"
                    disabled={readOnly || createMutation.isPending || academicYears.isLoading || classCatalog.isLoading}
                    onClick={submitReview}
                  >
                    {createMutation.isPending ? 'Creating…' : 'Submit enrollment'}
                  </button>}
              </div>
              <div className="stw-footer-discard muted">
                <button
                  type="button"
                  className="stw-link-danger"
                  disabled={readOnly}
                  onClick={() => {
                    clearOnboardingDraft();
                    setDraft(defaultDraft());
                    setErrors({});
                  }}
                >
                  Discard draft
                </button>
                <span className="stw-draft-hint">Progress is saved on this device.</span>
              </div>
            </footer>
          </div>
        </main>

        <aside className="stw-live-rail muted-border" aria-label="Admission preview">
          <div className="stw-live-inner">{liveSummary}</div>
        </aside>

        <div className={`stw-live-sheet${mobilePreviewOpen ? ' is-open' : ''}`}>
          <div className="stw-live-sheet-inner muted-border">{liveSummary}</div>
        </div>
      </div>
    </div>
  );
}
