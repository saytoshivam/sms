import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ModulePage, StatusChip, type StatusLevel } from '../../components/module/ModulePage';
import { api } from '../../lib/api';
import { pageContent, type SpringPage } from '../../lib/springPageContent';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';

type TabId = 'overview' | 'schemes' | 'grading' | 'schedule' | 'marks' | 'results';
const TABS: TabId[] = ['overview', 'schemes', 'grading', 'schedule', 'marks', 'results'];

type ScopeType = 'SCHOOL' | 'CLASS' | 'SECTION' | 'SUBJECT';
type SchemeStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type ComponentType =
  | 'CONTINUOUS_ASSESSMENT'
  | 'MID_TERM'
  | 'END_TERM'
  | 'PRACTICAL'
  | 'PROJECT'
  | 'ASSIGNMENT'
  | 'ATTENDANCE'
  | 'NOTEBOOK'
  | 'VIVA'
  | 'OTHER';
type CalculationRule =
  | 'SINGLE_ASSESSMENT'
  | 'SUM'
  | 'AVERAGE'
  | 'BEST_N_OF_M'
  | 'HIGHEST'
  | 'MANUAL'
  | 'ATTENDANCE_PERCENTAGE';

type AssessmentComponent = {
  id: number;
  schemeId: number;
  name: string;
  componentType: ComponentType;
  weightagePercent: number;
  maxMarks: number | null;
  calculationRule: CalculationRule;
  totalAssessments: number | null;
  bestOfCount: number | null;
  sequence: number;
  mandatory: boolean;
};

type AssessmentScheme = {
  id: number;
  schoolId: number;
  academicYearId: number;
  academicYearLabel: string | null;
  name: string;
  description: string | null;
  applicableScopeType: ScopeType;
  applicableScopeId: number | null;
  status: SchemeStatus;
  versionNo: number | null;
  components: AssessmentComponent[];
};

type ClassGroup = {
  id: number;
  gradeLevel: number | null;
  section: string | null;
  displayName: string | null;
};

type SubjectLite = { id: number; name: string; code?: string | null };
type AcademicYear = { id: number; name: string; isCurrent?: boolean };

type GradingBand = {
  id: number;
  grade: string;
  minPercent: number;
  maxPercent: number;
  sequence: number;
};

type GradingScheme = {
  id: number;
  name: string;
  academicYearId: number | null;
  active: boolean;
  bands: GradingBand[];
};

type SchemeForm = {
  name: string;
  academicYearId: string;
  description: string;
  applicableScopeType: ScopeType;
  classGrade: string;
  sectionClassGroupId: string;
  subjectId: string;
};

type ComponentForm = {
  name: string;
  componentType: ComponentType;
  weightagePercent: string;
  maxMarks: string;
  calculationRule: CalculationRule;
  totalAssessments: string;
  bestOfCount: string;
  mandatory: boolean;
  sequence: string;
};

type ComponentPreset = {
  label: string;
  components: Array<{
    name: string;
    componentType: ComponentType;
    weightagePercent: number;
    maxMarks: number | null;
    calculationRule: CalculationRule;
    totalAssessments: number | null;
    bestOfCount: number | null;
    mandatory: boolean;
    sequence: number;
  }>;
};

const COMPONENT_TYPES: ComponentType[] = [
  'CONTINUOUS_ASSESSMENT',
  'MID_TERM',
  'END_TERM',
  'PRACTICAL',
  'PROJECT',
  'ASSIGNMENT',
  'ATTENDANCE',
  'NOTEBOOK',
  'VIVA',
  'OTHER',
];

const CALCULATION_RULES: CalculationRule[] = [
  'SINGLE_ASSESSMENT',
  'SUM',
  'AVERAGE',
  'BEST_N_OF_M',
  'HIGHEST',
  'MANUAL',
  'ATTENDANCE_PERCENTAGE',
];

const PRESETS: ComponentPreset[] = [
  {
    label: 'CA + Mid Term + End Term + Attendance',
    components: [
      {
        name: 'CA',
        componentType: 'CONTINUOUS_ASSESSMENT',
        weightagePercent: 30,
        maxMarks: 20,
        calculationRule: 'BEST_N_OF_M',
        totalAssessments: 3,
        bestOfCount: 2,
        mandatory: true,
        sequence: 1,
      },
      {
        name: 'Mid Term',
        componentType: 'MID_TERM',
        weightagePercent: 20,
        maxMarks: 100,
        calculationRule: 'SINGLE_ASSESSMENT',
        totalAssessments: 1,
        bestOfCount: null,
        mandatory: true,
        sequence: 2,
      },
      {
        name: 'End Term',
        componentType: 'END_TERM',
        weightagePercent: 45,
        maxMarks: 100,
        calculationRule: 'SINGLE_ASSESSMENT',
        totalAssessments: 1,
        bestOfCount: null,
        mandatory: true,
        sequence: 3,
      },
      {
        name: 'Attendance',
        componentType: 'ATTENDANCE',
        weightagePercent: 5,
        maxMarks: null,
        calculationRule: 'ATTENDANCE_PERCENTAGE',
        totalAssessments: null,
        bestOfCount: null,
        mandatory: false,
        sequence: 4,
      },
    ],
  },
  {
    label: 'Term Only',
    components: [
      {
        name: 'Mid Term',
        componentType: 'MID_TERM',
        weightagePercent: 40,
        maxMarks: 100,
        calculationRule: 'SINGLE_ASSESSMENT',
        totalAssessments: 1,
        bestOfCount: null,
        mandatory: true,
        sequence: 1,
      },
      {
        name: 'End Term',
        componentType: 'END_TERM',
        weightagePercent: 60,
        maxMarks: 100,
        calculationRule: 'SINGLE_ASSESSMENT',
        totalAssessments: 1,
        bestOfCount: null,
        mandatory: true,
        sequence: 2,
      },
    ],
  },
  {
    label: 'Practical Subject',
    components: [
      {
        name: 'Theory',
        componentType: 'END_TERM',
        weightagePercent: 50,
        maxMarks: 100,
        calculationRule: 'SINGLE_ASSESSMENT',
        totalAssessments: 1,
        bestOfCount: null,
        mandatory: true,
        sequence: 1,
      },
      {
        name: 'Practical',
        componentType: 'PRACTICAL',
        weightagePercent: 30,
        maxMarks: 50,
        calculationRule: 'SINGLE_ASSESSMENT',
        totalAssessments: 1,
        bestOfCount: null,
        mandatory: true,
        sequence: 2,
      },
      {
        name: 'Project',
        componentType: 'PROJECT',
        weightagePercent: 20,
        maxMarks: 25,
        calculationRule: 'SINGLE_ASSESSMENT',
        totalAssessments: 1,
        bestOfCount: null,
        mandatory: false,
        sequence: 3,
      },
    ],
  },
];

const DEFAULT_GRADING_BANDS = [
  { grade: 'A1', minPercent: 91, maxPercent: 100, sequence: 1 },
  { grade: 'A2', minPercent: 81, maxPercent: 90, sequence: 2 },
  { grade: 'B1', minPercent: 71, maxPercent: 80, sequence: 3 },
  { grade: 'B2', minPercent: 61, maxPercent: 70, sequence: 4 },
  { grade: 'C1', minPercent: 51, maxPercent: 60, sequence: 5 },
  { grade: 'C2', minPercent: 41, maxPercent: 50, sequence: 6 },
  { grade: 'D', minPercent: 33, maxPercent: 40, sequence: 7 },
  { grade: 'E', minPercent: 0, maxPercent: 32, sequence: 8 },
];

function scopeLabel(s: AssessmentScheme): string {
  if (s.applicableScopeType === 'SCHOOL') return 'School-wide';
  if (s.applicableScopeType === 'CLASS') return `Class ${s.applicableScopeId ?? '-'}`;
  if (s.applicableScopeType === 'SECTION') return `Section ${s.applicableScopeId ?? '-'}`;
  return `Subject ${s.applicableScopeId ?? '-'}`;
}

function toDisplayLabel(v: string): string {
  return v
    .toLowerCase()
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function totalWeightage(components: AssessmentComponent[]): number {
  return components.reduce((sum, c) => sum + Number(c.weightagePercent || 0), 0);
}

function validateComponentRules(c: AssessmentComponent): string[] {
  const issues: string[] = [];
  if (Number(c.weightagePercent) <= 0) issues.push('Weightage must be > 0');
  if (c.calculationRule === 'BEST_N_OF_M') {
    if (!c.totalAssessments || c.totalAssessments <= 0) issues.push('Total assessments is required');
    if (!c.bestOfCount || c.bestOfCount <= 0) issues.push('Best-of count is required');
    if (c.totalAssessments != null && c.bestOfCount != null && c.bestOfCount > c.totalAssessments) {
      issues.push('Best-of cannot exceed total assessments');
    }
  }
  return issues;
}

function readiness(components: AssessmentComponent[]): { ready: boolean; label: string } {
  const t = totalWeightage(components);
  const hasRuleIssue = components.some((c) => validateComponentRules(c).length > 0);
  if (t !== 100) return { ready: false, label: `Cannot publish: total weightage is ${t}% (must be 100%)` };
  if (hasRuleIssue) return { ready: false, label: 'Cannot publish: one or more component rules are invalid' };
  return { ready: true, label: 'Ready to publish' };
}

function createEmptyComponent(sequence: number): ComponentForm {
  return {
    name: '',
    componentType: 'CONTINUOUS_ASSESSMENT',
    weightagePercent: '',
    maxMarks: '',
    calculationRule: 'SINGLE_ASSESSMENT',
    totalAssessments: '1',
    bestOfCount: '',
    mandatory: true,
    sequence: String(sequence),
  };
}

export function ExaminationsModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const tabParam = searchParams.get('tab') as TabId | null;
  const tab: TabId = TABS.includes(tabParam as TabId) ? (tabParam as TabId) : 'overview';

  const selectedSchemeId = Number(searchParams.get('schemeId') || 0) || null;

  const schemesQ = useQuery({
    queryKey: ['exam-schemes'],
    queryFn: async () => (await api.get<AssessmentScheme[]>('/api/exams/schemes')).data,
  });

  const selectedSchemeQ = useQuery({
    queryKey: ['exam-scheme-detail', selectedSchemeId],
    enabled: selectedSchemeId != null,
    queryFn: async () => (await api.get<AssessmentScheme>(`/api/exams/schemes/${selectedSchemeId}`)).data,
  });

  const classGroupsQ = useQuery({
    queryKey: ['class-groups-exams'],
    queryFn: async () =>
      (await api.get<SpringPage<ClassGroup> | ClassGroup[]>('/api/class-groups?size=500&sort=gradeLevel,asc')).data,
  });

  const subjectsQ = useQuery({
    queryKey: ['subjects-exams'],
    queryFn: async () => (await api.get<SpringPage<SubjectLite> | SubjectLite[]>('/api/subjects?size=1000&sort=name,asc')).data,
  });

  const academicYearsQ = useQuery({
    queryKey: ['academic-years-exams'],
    queryFn: async () => (await api.get<AcademicYear[]>('/api/academic-years')).data,
  });

  const gradingQ = useQuery({
    queryKey: ['grading-schemes'],
    queryFn: async () => (await api.get<GradingScheme[]>('/api/exams/grading-schemes')).data,
  });

  const classGroups = pageContent(classGroupsQ.data ?? null);
  const subjects = pageContent(subjectsQ.data ?? null);
  const schemes = schemesQ.data ?? [];
  const selectedScheme = selectedSchemeQ.data ?? schemes.find((s) => s.id === selectedSchemeId) ?? null;

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    classGroups.forEach((c) => {
      if (typeof c.gradeLevel === 'number') set.add(c.gradeLevel);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [classGroups]);

  const headerActions = (
    <Link to="/app/operations-hub" className="btn secondary">
      Back to hub
    </Link>
  );

  const status: { level: StatusLevel; label: string } = useMemo(() => {
    if (schemesQ.isLoading) return { level: 'idle', label: 'Loading' };
    if (schemesQ.isError) return { level: 'error', label: 'Load failed' };
    if (schemes.length === 0) return { level: 'idle', label: 'No schemes' };
    const drafts = schemes.filter((s) => s.status === 'DRAFT').length;
    return { level: drafts > 0 ? 'warn' : 'ok', label: `${schemes.length} scheme${schemes.length === 1 ? '' : 's'}` };
  }, [schemesQ.isLoading, schemesQ.isError, schemes]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'schemes', label: 'Assessment Schemes', badge: schemes.length || null },
    { id: 'grading', label: 'Grading', badge: (gradingQ.data?.length ?? 0) || null },
    { id: 'schedule', label: 'Exam Schedule' },
    { id: 'marks', label: 'Marks Entry' },
    { id: 'results', label: 'Results' },
  ];

  return (
    <ModulePage
      title="Examinations"
      subtitle="Configure assessment schemes and grading. Scheduling, marks entry, and results stay disabled until the scheme workflow is in place."
      status={status}
      headerActions={headerActions}
      tabs={tabs}
      activeTabId={tab}
      tabHrefBase="/app/examinations"
      impact={null}
    >
      {tab === 'overview' ? (
        <OverviewPanel schemeCount={schemes.length} gradingCount={gradingQ.data?.length ?? 0} />
      ) : null}

      {tab === 'schemes' ? (
        <AssessmentSchemesPanel
          schemes={schemes}
          selectedScheme={selectedScheme}
          selectedSchemeLoading={selectedSchemeQ.isLoading}
          classGroups={classGroups}
          gradeOptions={gradeOptions}
          subjects={subjects}
          academicYears={academicYearsQ.data ?? []}
          onOpenScheme={(schemeId) => {
            const next = new URLSearchParams(searchParams);
            next.set('tab', 'schemes');
            next.set('schemeId', String(schemeId));
            setSearchParams(next);
          }}
          onCloseScheme={() => {
            const next = new URLSearchParams(searchParams);
            next.set('tab', 'schemes');
            next.delete('schemeId');
            setSearchParams(next);
          }}
          onRefresh={async () => {
            await qc.invalidateQueries({ queryKey: ['exam-schemes'] });
            if (selectedSchemeId != null) {
              await qc.invalidateQueries({ queryKey: ['exam-scheme-detail', selectedSchemeId] });
            }
          }}
        />
      ) : null}

      {tab === 'grading' ? (
        <GradingPanel
          gradingSchemes={gradingQ.data ?? []}
          academicYears={academicYearsQ.data ?? []}
          onCreated={async () => {
            await qc.invalidateQueries({ queryKey: ['grading-schemes'] });
          }}
        />
      ) : null}

      {tab === 'schedule' ? <PlaceholderCard text="Create assessment schedule after publishing a scheme." /> : null}
      {tab === 'marks' ? <PlaceholderCard text="Marks entry will be available after assessments are scheduled." /> : null}
      {tab === 'results' ? <PlaceholderCard text="Results will be generated after marks are submitted and locked." /> : null}
    </ModulePage>
  );
}

function OverviewPanel({ schemeCount, gradingCount }: { schemeCount: number; gradingCount: number }) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>What you can do now</div>
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Create assessment schemes, define components and weightages, validate readiness, and publish. Configure grading schemes used for result bands.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Assessment schemes</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{schemeCount}</div>
        </div>
        <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Grading schemes</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{gradingCount}</div>
        </div>
      </div>
    </div>
  );
}

function AssessmentSchemesPanel({
  schemes,
  selectedScheme,
  selectedSchemeLoading,
  classGroups,
  gradeOptions,
  subjects,
  academicYears,
  onOpenScheme,
  onCloseScheme,
  onRefresh,
}: {
  schemes: AssessmentScheme[];
  selectedScheme: AssessmentScheme | null;
  selectedSchemeLoading: boolean;
  classGroups: ClassGroup[];
  gradeOptions: number[];
  subjects: SubjectLite[];
  academicYears: AcademicYear[];
  onOpenScheme: (schemeId: number) => void;
  onCloseScheme: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<SchemeForm>({
    name: '',
    academicYearId: String(academicYears.find((y) => y.isCurrent)?.id ?? academicYears[0]?.id ?? ''),
    description: '',
    applicableScopeType: 'SCHOOL',
    classGrade: '',
    sectionClassGroupId: '',
    subjectId: '',
  });

  const createScheme = useMutation({
    mutationFn: async () => {
      const academicYearId = Number(form.academicYearId);
      if (!Number.isFinite(academicYearId) || academicYearId <= 0) throw new Error('Select an academic year.');

      let applicableScopeId: number | null = null;
      if (form.applicableScopeType === 'CLASS') {
        applicableScopeId = Number(form.classGrade) || null;
      } else if (form.applicableScopeType === 'SECTION') {
        applicableScopeId = Number(form.sectionClassGroupId) || null;
      } else if (form.applicableScopeType === 'SUBJECT') {
        applicableScopeId = Number(form.subjectId) || null;
      }

      if (form.applicableScopeType !== 'SCHOOL' && !applicableScopeId) {
        throw new Error('Select a valid scope target.');
      }

      return (
        await api.post<AssessmentScheme>('/api/exams/schemes', {
          academicYearId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          applicableScopeType: form.applicableScopeType,
          applicableScopeId,
        })
      ).data;
    },
    onSuccess: async (created) => {
      toast.success('Scheme created', 'You can now add assessment components.');
      setCreateOpen(false);
      setForm((prev) => ({ ...prev, name: '', description: '' }));
      await onRefresh();
      onOpenScheme(created.id);
    },
    onError: (e) => toast.error('Could not create scheme', formatApiError(e)),
  });

  const publishScheme = useMutation({
    mutationFn: async (schemeId: number) => (await api.post<AssessmentScheme>(`/api/exams/schemes/${schemeId}/publish`)).data,
    onSuccess: async () => {
      toast.success('Scheme published', 'The scheme is now locked for use.');
      await onRefresh();
    },
    onError: (e) => toast.error('Could not publish scheme', formatApiError(e)),
  });

  const cloneScheme = useMutation({
    mutationFn: async (schemeId: number) => (await api.post<AssessmentScheme>(`/api/exams/schemes/${schemeId}/clone`)).data,
    onSuccess: async (created) => {
      toast.success('Scheme cloned', 'A draft copy has been created.');
      await onRefresh();
      onOpenScheme(created.id);
    },
    onError: (e) => toast.error('Could not clone scheme', formatApiError(e)),
  });

  const archiveScheme = useMutation({
    mutationFn: async (schemeId: number) => (await api.post<AssessmentScheme>(`/api/exams/schemes/${schemeId}/archive`)).data,
    onSuccess: async () => {
      toast.success('Scheme archived', 'This scheme is now retired.');
      await onRefresh();
    },
    onError: (e) => toast.error('Could not archive scheme', formatApiError(e)),
  });

  const sectionClassOptions = classGroups.filter((g) => {
    const grade = Number(form.classGrade);
    if (!Number.isFinite(grade) || grade <= 0) return true;
    return g.gradeLevel === grade;
  });

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900 }}>Assessment Schemes</div>
          <button type="button" className="btn" onClick={() => setCreateOpen((v) => !v)}>
            {createOpen ? 'Close form' : 'Create Scheme'}
          </button>
        </div>

        {createOpen ? (
          <div className="stack" style={{ gap: 10, marginTop: 12 }}>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <label className="stack" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Name</span>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Academic year</span>
                <select
                  value={form.academicYearId}
                  onChange={(e) => setForm((p) => ({ ...p, academicYearId: e.target.value }))}
                >
                  <option value="">Select</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </label>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label className="stack" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Applicable scope</span>
                <select
                  value={form.applicableScopeType}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      applicableScopeType: e.target.value as ScopeType,
                      classGrade: '',
                      sectionClassGroupId: '',
                      subjectId: '',
                    }))
                  }
                >
                  <option value="SCHOOL">SCHOOL</option>
                  <option value="CLASS">CLASS</option>
                  <option value="SECTION">SECTION</option>
                  <option value="SUBJECT">SUBJECT</option>
                </select>
              </label>

              {form.applicableScopeType === 'CLASS' ? (
                <label className="stack" style={{ gap: 6 }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class</span>
                  <select
                    value={form.classGrade}
                    onChange={(e) => setForm((p) => ({ ...p, classGrade: e.target.value }))}
                  >
                    <option value="">Select class</option>
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.applicableScopeType === 'SECTION' ? (
                <>
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class</span>
                    <select
                      value={form.classGrade}
                      onChange={(e) => setForm((p) => ({ ...p, classGrade: e.target.value, sectionClassGroupId: '' }))}
                    >
                      <option value="">All classes</option>
                      {gradeOptions.map((g) => (
                        <option key={g} value={g}>
                          Grade {g}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Section</span>
                    <select
                      value={form.sectionClassGroupId}
                      onChange={(e) => setForm((p) => ({ ...p, sectionClassGroupId: e.target.value }))}
                    >
                      <option value="">Select section</option>
                      {sectionClassOptions.map((cg) => (
                        <option key={cg.id} value={cg.id}>
                          {cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              {form.applicableScopeType === 'SUBJECT' ? (
                <label className="stack" style={{ gap: 6 }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
                  <select value={form.subjectId} onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}>
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.code ? ` (${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                disabled={createScheme.isPending || !form.name.trim()}
                onClick={() => createScheme.mutate()}
              >
                {createScheme.isPending ? 'Creating...' : 'Create Scheme'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!selectedScheme ? (
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)' }}>
                  <th style={{ padding: '8px 6px' }}>Scheme name</th>
                  <th style={{ padding: '8px 6px' }}>Academic year</th>
                  <th style={{ padding: '8px 6px' }}>Scope</th>
                  <th style={{ padding: '8px 6px' }}>Status</th>
                  <th style={{ padding: '8px 6px' }}>Components</th>
                  <th style={{ padding: '8px 6px' }}>Total weightage</th>
                  <th style={{ padding: '8px 6px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((s) => {
                  const total = totalWeightage(s.components ?? []);
                  const canPublish = s.status === 'DRAFT' && readiness(s.components ?? []).ready;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>{s.name}</td>
                      <td style={{ padding: '8px 6px' }}>{s.academicYearLabel ?? `Year ${s.academicYearId}`}</td>
                      <td style={{ padding: '8px 6px' }}>{scopeLabel(s)}</td>
                      <td style={{ padding: '8px 6px' }}>{s.status}</td>
                      <td style={{ padding: '8px 6px' }}>{s.components?.length ?? 0}</td>
                      <td style={{ padding: '8px 6px' }}>{total}%</td>
                      <td style={{ padding: '8px 6px' }}>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className="btn secondary" onClick={() => onOpenScheme(s.id)}>
                            Open
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={!canPublish || publishScheme.isPending}
                            onClick={() => publishScheme.mutate(s.id)}
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={cloneScheme.isPending}
                            onClick={() => cloneScheme.mutate(s.id)}
                          >
                            Clone
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={s.status === 'ARCHIVED' || archiveScheme.isPending}
                            onClick={() => archiveScheme.mutate(s.id)}
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {schemes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 14 }} className="muted">
                      No schemes created yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <SchemeDetailCard
          scheme={selectedScheme}
          loading={selectedSchemeLoading}
          onClose={onCloseScheme}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function SchemeDetailCard({
  scheme,
  loading,
  onClose,
  onRefresh,
}: {
  scheme: AssessmentScheme;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const total = totalWeightage(scheme.components ?? []);
  const ready = readiness(scheme.components ?? []);

  const [editingComponentId, setEditingComponentId] = useState<number | null>(null);
  const [componentForm, setComponentForm] = useState<ComponentForm>(() =>
    createEmptyComponent((scheme.components?.length ?? 0) + 1),
  );
  const [presetIndex, setPresetIndex] = useState('');

  const saveComponent = useMutation({
    mutationFn: async () => {
      const payload = buildComponentPayload(componentForm, scheme.components ?? [], editingComponentId);
      if (editingComponentId == null) {
        return (
          await api.post<AssessmentScheme>(`/api/exams/schemes/${scheme.id}/components`, payload)
        ).data;
      }
      return (
        await api.put<AssessmentScheme>(`/api/exams/schemes/${scheme.id}/components/${editingComponentId}`, payload)
      ).data;
    },
    onSuccess: async () => {
      toast.success(editingComponentId == null ? 'Component added' : 'Component updated');
      setEditingComponentId(null);
      setComponentForm(createEmptyComponent((scheme.components?.length ?? 0) + 1));
      await onRefresh();
    },
    onError: (e) => toast.error('Could not save component', formatApiError(e)),
  });

  const removeComponent = useMutation({
    mutationFn: async (componentId: number) => {
      await api.delete(`/api/exams/schemes/${scheme.id}/components/${componentId}`);
    },
    onSuccess: async () => {
      toast.success('Component removed');
      await onRefresh();
    },
    onError: (e) => toast.error('Could not remove component', formatApiError(e)),
  });

  const publishScheme = useMutation({
    mutationFn: async () => (await api.post<AssessmentScheme>(`/api/exams/schemes/${scheme.id}/publish`)).data,
    onSuccess: async () => {
      toast.success('Scheme published');
      await onRefresh();
    },
    onError: (e) => toast.error('Could not publish scheme', formatApiError(e)),
  });

  const applyPreset = useMutation({
    mutationFn: async (preset: ComponentPreset) => {
      const current = scheme.components ?? [];
      const presetTotal = preset.components.reduce((sum, c) => sum + c.weightagePercent, 0);
      if (total + presetTotal > 100) {
        throw new Error(`Preset exceeds total weightage limit. Current ${total}%, preset ${presetTotal}%`);
      }
      for (const p of preset.components) {
        await api.post(`/api/exams/schemes/${scheme.id}/components`, {
          ...p,
          sequence: p.sequence + current.length,
        });
      }
    },
    onSuccess: async () => {
      toast.success('Preset applied');
      setPresetIndex('');
      await onRefresh();
    },
    onError: (e) => toast.error('Could not apply preset', formatApiError(e)),
  });

  const onEditRow = (c: AssessmentComponent) => {
    setEditingComponentId(c.id);
    setComponentForm({
      name: c.name,
      componentType: c.componentType,
      weightagePercent: String(c.weightagePercent),
      maxMarks: c.maxMarks == null ? '' : String(c.maxMarks),
      calculationRule: c.calculationRule,
      totalAssessments: c.totalAssessments == null ? '' : String(c.totalAssessments),
      bestOfCount: c.bestOfCount == null ? '' : String(c.bestOfCount),
      mandatory: c.mandatory,
      sequence: String(c.sequence),
    });
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{scheme.name}</h2>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              {scheme.academicYearLabel ?? `Year ${scheme.academicYearId}`} · {scheme.applicableScopeType} · Total weightage: {total}%
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <StatusChip level={scheme.status === 'DRAFT' ? 'warn' : scheme.status === 'PUBLISHED' ? 'ok' : 'idle'} label={scheme.status} />
              <StatusChip level={ready.ready ? 'ok' : 'error'} label={ready.label} />
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn secondary" onClick={onClose}>
              Back to list
            </button>
            <button
              type="button"
              className="btn"
              disabled={scheme.status !== 'DRAFT' || !ready.ready || publishScheme.isPending}
              onClick={() => publishScheme.mutate()}
            >
              {publishScheme.isPending ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900 }}>Components</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <select value={presetIndex} onChange={(e) => setPresetIndex(e.target.value)}>
              <option value="">Use common pattern</option>
              {PRESETS.map((p, i) => (
                <option key={p.label} value={String(i)}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn secondary"
              disabled={scheme.status !== 'DRAFT' || presetIndex === '' || applyPreset.isPending}
              onClick={() => {
                const idx = Number(presetIndex);
                if (!Number.isFinite(idx) || !PRESETS[idx]) return;
                applyPreset.mutate(PRESETS[idx]);
              }}
            >
              {applyPreset.isPending ? 'Applying...' : 'Apply preset'}
            </button>
          </div>
        </div>

        {loading ? <div className="muted" style={{ marginTop: 10 }}>Loading scheme details...</div> : null}

        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.12)', textAlign: 'left' }}>
                <th style={{ padding: '8px 6px' }}>Component name</th>
                <th style={{ padding: '8px 6px' }}>Type</th>
                <th style={{ padding: '8px 6px' }}>Weightage %</th>
                <th style={{ padding: '8px 6px' }}>Max Marks</th>
                <th style={{ padding: '8px 6px' }}>Calculation Rule</th>
                <th style={{ padding: '8px 6px' }}>Assessments Rule</th>
                <th style={{ padding: '8px 6px' }}>Sequence</th>
                <th style={{ padding: '8px 6px' }}>Status</th>
                <th style={{ padding: '8px 6px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(scheme.components ?? [])
                .slice()
                .sort((a, b) => a.sequence - b.sequence)
                .map((c) => {
                  const issues = validateComponentRules(c);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>{c.name}</td>
                      <td style={{ padding: '8px 6px' }}>{toDisplayLabel(c.componentType)}</td>
                      <td style={{ padding: '8px 6px' }}>{c.weightagePercent}%</td>
                      <td style={{ padding: '8px 6px' }}>{c.maxMarks == null ? '-' : `${c.maxMarks} marks each`}</td>
                      <td style={{ padding: '8px 6px' }}>{toDisplayLabel(c.calculationRule)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {c.calculationRule === 'BEST_N_OF_M' && c.bestOfCount && c.totalAssessments
                          ? `Best ${c.bestOfCount} of ${c.totalAssessments}`
                          : c.calculationRule === 'SINGLE_ASSESSMENT'
                            ? 'Single assessment'
                            : '-'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>Seq {c.sequence}</td>
                      <td style={{ padding: '8px 6px' }}>{issues.length === 0 ? 'Ready' : issues.join(', ')}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={scheme.status !== 'DRAFT'}
                            onClick={() => onEditRow(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={scheme.status !== 'DRAFT' || removeComponent.isPending}
                            onClick={() => removeComponent.mutate(c.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {(scheme.components?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={9} className="muted" style={{ padding: 12 }}>
                    No components added yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>{editingComponentId == null ? 'Add component' : 'Edit component'}</div>
        <ComponentFormPanel
          form={componentForm}
          setForm={setComponentForm}
          currentComponents={scheme.components ?? []}
          editingComponentId={editingComponentId}
          disabled={scheme.status !== 'DRAFT' || saveComponent.isPending}
          onSave={() => saveComponent.mutate()}
          onCancel={() => {
            setEditingComponentId(null);
            setComponentForm(createEmptyComponent((scheme.components?.length ?? 0) + 1));
          }}
          saveLabel={editingComponentId == null ? 'Add component' : 'Update component'}
        />
      </div>
    </div>
  );
}

function buildComponentPayload(
  form: ComponentForm,
  currentComponents: AssessmentComponent[],
  editingComponentId: number | null,
): Record<string, unknown> {
  const weightagePercent = Number(form.weightagePercent);
  const maxMarks = form.maxMarks.trim() === '' ? null : Number(form.maxMarks);
  const sequence = Number(form.sequence);
  const totalAssessmentsRaw = form.totalAssessments.trim() === '' ? null : Number(form.totalAssessments);
  const bestOfCountRaw = form.bestOfCount.trim() === '' ? null : Number(form.bestOfCount);

  if (!form.name.trim()) throw new Error('Component name is required.');
  if (!Number.isFinite(weightagePercent) || weightagePercent <= 0) throw new Error('Weightage must be greater than 0.');
  if (!Number.isFinite(sequence) || sequence <= 0) throw new Error('Sequence must be a positive number.');

  const replacedWeight =
    editingComponentId == null
      ? 0
      : Number(currentComponents.find((c) => c.id === editingComponentId)?.weightagePercent ?? 0);
  const totalWithoutEdited = totalWeightage(currentComponents) - replacedWeight;
  if (totalWithoutEdited + weightagePercent > 100) {
    throw new Error('Total scheme weightage cannot exceed 100%.');
  }

  let totalAssessments = totalAssessmentsRaw;
  let bestOfCount = bestOfCountRaw;

  if (form.calculationRule === 'SINGLE_ASSESSMENT') {
    totalAssessments = 1;
    bestOfCount = null;
  }

  if (form.calculationRule === 'ATTENDANCE_PERCENTAGE') {
    totalAssessments = null;
    bestOfCount = null;
  }

  if (form.calculationRule === 'BEST_N_OF_M') {
    if (totalAssessments == null || totalAssessments <= 0) throw new Error('Total assessments is required.');
    if (bestOfCount == null || bestOfCount <= 0) throw new Error('Best-of count is required.');
    if (bestOfCount > totalAssessments) throw new Error('Best-of count cannot exceed total assessments.');
  }

  return {
    name: form.name.trim(),
    componentType: form.componentType,
    weightagePercent,
    maxMarks: form.calculationRule === 'ATTENDANCE_PERCENTAGE' ? null : maxMarks,
    calculationRule: form.calculationRule,
    totalAssessments,
    bestOfCount,
    sequence,
    mandatory: form.mandatory,
  };
}

function ComponentFormPanel({
  form,
  setForm,
  currentComponents,
  editingComponentId,
  disabled,
  onSave,
  onCancel,
  saveLabel,
}: {
  form: ComponentForm;
  setForm: (next: ComponentForm | ((prev: ComponentForm) => ComponentForm)) => void;
  currentComponents: AssessmentComponent[];
  editingComponentId: number | null;
  disabled: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const showBestFields = form.calculationRule === 'BEST_N_OF_M';
  const showMaxMarks = form.calculationRule !== 'ATTENDANCE_PERCENTAGE';
  const showAssessments = form.calculationRule !== 'ATTENDANCE_PERCENTAGE';

  const replacedWeight =
    editingComponentId == null
      ? 0
      : Number(currentComponents.find((c) => c.id === editingComponentId)?.weightagePercent ?? 0);
  const currentTotal = totalWeightage(currentComponents) - replacedWeight;
  const nextWeight = Number(form.weightagePercent || 0);
  const projectedTotal = currentTotal + (Number.isFinite(nextWeight) ? nextWeight : 0);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Name</span>
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} disabled={disabled} />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Component type</span>
          <select
            value={form.componentType}
            onChange={(e) => setForm((p) => ({ ...p, componentType: e.target.value as ComponentType }))}
            disabled={disabled}
          >
            {COMPONENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {toDisplayLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Weightage %</span>
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={form.weightagePercent}
            onChange={(e) => setForm((p) => ({ ...p, weightagePercent: e.target.value }))}
            disabled={disabled}
          />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Calculation rule</span>
          <select
            value={form.calculationRule}
            onChange={(e) => {
              const nextRule = e.target.value as CalculationRule;
              setForm((p) => ({
                ...p,
                calculationRule: nextRule,
                totalAssessments: nextRule === 'SINGLE_ASSESSMENT' ? '1' : p.totalAssessments,
              }));
            }}
            disabled={disabled}
          >
            {CALCULATION_RULES.map((r) => (
              <option key={r} value={r}>
                {toDisplayLabel(r)}
              </option>
            ))}
          </select>
        </label>

        {showMaxMarks ? (
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Max marks</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.maxMarks}
              onChange={(e) => setForm((p) => ({ ...p, maxMarks: e.target.value }))}
              disabled={disabled}
            />
          </label>
        ) : null}

        {showAssessments ? (
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Total assessments</span>
            <input
              type="number"
              min={1}
              value={form.totalAssessments}
              onChange={(e) => setForm((p) => ({ ...p, totalAssessments: e.target.value }))}
              disabled={disabled || form.calculationRule === 'SINGLE_ASSESSMENT'}
            />
          </label>
        ) : null}

        {showBestFields ? (
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Best of count</span>
            <input
              type="number"
              min={1}
              value={form.bestOfCount}
              onChange={(e) => setForm((p) => ({ ...p, bestOfCount: e.target.value }))}
              disabled={disabled}
            />
          </label>
        ) : null}

        <label className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Sequence</span>
          <input
            type="number"
            min={1}
            value={form.sequence}
            onChange={(e) => setForm((p) => ({ ...p, sequence: e.target.value }))}
            disabled={disabled}
          />
        </label>
      </div>

      <label className="row" style={{ gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={form.mandatory}
          onChange={(e) => setForm((p) => ({ ...p, mandatory: e.target.checked }))}
          disabled={disabled}
        />
        <span style={{ fontSize: 13 }}>Mandatory component</span>
      </label>

      <div className="muted" style={{ fontSize: 12 }}>
        Projected total weightage: <strong style={{ color: projectedTotal > 100 ? '#b91c1c' : '#0f172a' }}>{projectedTotal}%</strong>
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {editingComponentId != null ? (
          <button type="button" className="btn secondary" onClick={onCancel} disabled={disabled}>
            Cancel edit
          </button>
        ) : null}
        <button type="button" className="btn" onClick={onSave} disabled={disabled}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function GradingPanel({
  gradingSchemes,
  academicYears,
  onCreated,
}: {
  gradingSchemes: GradingScheme[];
  academicYears: AcademicYear[];
  onCreated: () => Promise<void>;
}) {
  const [gradingName, setGradingName] = useState('Default grading scheme');
  const [academicYearId, setAcademicYearId] = useState<string>('');

  const createBasicGrading = useMutation({
    mutationFn: async () => {
      const resolvedYearId = academicYearId.trim() ? Number(academicYearId) : null;
      const payload = {
        name: gradingName.trim() || 'Default grading scheme',
        academicYearId: resolvedYearId,
        active: true,
        bands: DEFAULT_GRADING_BANDS,
      };
      return (await api.post<GradingScheme>('/api/exams/grading-schemes', payload)).data;
    },
    onSuccess: async () => {
      toast.success('Grading scheme created');
      await onCreated();
    },
    onError: (e) => toast.error('Could not create grading scheme', formatApiError(e)),
  });

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ fontWeight: 900 }}>Grading schemes</div>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Existing grading schemes are listed below. Editing support can be added once update APIs are available.
        </div>
      </div>

      {gradingSchemes.map((g) => (
        <div key={g.id} className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 900 }}>{g.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>Academic year id: {g.academicYearId ?? '-'}</div>
            </div>
            <StatusChip level={g.active ? 'ok' : 'idle'} label={g.active ? 'Active' : 'Inactive'} />
          </div>

          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)' }}>
                  <th style={{ padding: '8px 6px' }}>Grade</th>
                  <th style={{ padding: '8px 6px' }}>Range</th>
                </tr>
              </thead>
              <tbody>
                {(g.bands ?? [])
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>{b.grade}</td>
                      <td style={{ padding: '8px 6px' }}>
                        {b.minPercent}-{b.maxPercent}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ fontWeight: 900 }}>Create basic grading scheme</div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          A1 (91-100), A2 (81-90), B1 (71-80), B2 (61-70), C1 (51-60), C2 (41-50), D (33-40), E (0-32)
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 10 }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scheme name</span>
            <input value={gradingName} onChange={(e) => setGradingName(e.target.value)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Academic year (optional)</span>
            <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              <option value="">Not set</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => createBasicGrading.mutate()}
            disabled={createBasicGrading.isPending}
          >
            {createBasicGrading.isPending ? 'Creating...' : 'Create grading scheme'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceholderCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 16, border: '1px solid rgba(15,23,42,0.1)' }}>
      <div className="muted" style={{ fontSize: 14 }}>
        {text}
      </div>
    </div>
  );
}

