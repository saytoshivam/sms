import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ModulePage, StatusChip, type StatusLevel } from '../../components/module/ModulePage';
import { SmartSelect } from '../../components/SmartSelect';
import { SelectKeeper } from '../../components/SelectKeeper';
import { MultiSelectKeeper } from '../../components/MultiSelectKeeper';
import { DateKeeper } from '../../components/DateKeeper';
import { TimeKeeper } from '../../components/TimeKeeper';
import { GradingSchemesManager } from './GradingSchemesManager';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { api } from '../../lib/api';
import { pageContent, type SpringPage } from '../../lib/springPageContent';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';

type TabId = 'overview' | 'schemes' | 'grading' | 'schedule' | 'marks' | 'results';
const TABS: TabId[] = ['overview', 'schemes', 'grading', 'schedule', 'marks', 'results'];

type ScopeType = 'SCHOOL' | 'CLASS' | 'SECTION' | 'SUBJECT' | 'CLASS_SUBJECT' | 'SECTION_SUBJECT';
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

type SchedulingMode = 'CENTRALIZED' | 'DELEGATED' | 'HYBRID';

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
  requiresScheduling: boolean;
  marksEntryRequired: boolean;
  schedulingMode: SchedulingMode;
};

type AssessmentScheme = {
  id: number;
  schoolId: number;
  academicYearId: number;
  academicYearLabel: string | null;
  name: string;
  description: string | null;
  status: SchemeStatus;
  versionNo: number | null;
  assignedClassCount?: number | null;
  assignedSubjectCount?: number | null;
  assignmentLabel?: string | null;
  assignments?: AssessmentSchemeAssignment[];
  components: AssessmentComponent[];
};

type AssessmentSchemeAssignment = {
  id: number;
  scopeType: ScopeType;
  classGroupId: number | null;
  classGroupLabel: string | null;
  gradeLevel: number | null;
  subjectId: number | null;
  subjectName: string | null;
  subjectCode: string | null;
  active: boolean;
};

type ClassGroup = {
  id: number;
  gradeLevel: number | null;
  section: string | null;
  displayName: string | null;
};

type SubjectLite = { id: number; name: string; code?: string | null };
type AcademicYear = { id: number; label: string };

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
  effectiveFromAcademicYearId?: number | null;
  effectiveToAcademicYearId?: number | null;
  scope?: 'SCHOOL' | 'CLASS_GROUP' | string | null;
  classGroupId?: number | null;
  classGroupLabel?: string | null;
  defaultScheme?: boolean;
  passingPercent?: number | string | null;
  active: boolean;
  bands: GradingBand[];
};

type AssessmentInstanceStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'MARKS_ENTRY_OPEN'
  | 'MARKS_SUBMITTED'
  | 'LOCKED'
  | 'PUBLISHED'
  | 'CANCELLED';

type AssessmentInstance = {
  id: number;
  schoolId: number;
  academicYearId: number;
  academicYearLabel: string | null;
  schemeId: number;
  schemeName: string;
  componentId: number;
  componentName: string;
  componentType: string;
  name: string;
  subjectId: number;
  subjectName: string;
  classGroupId: number;
  classGroupLabel: string;
  assessmentDate: string | null;
  startTime: string | null;
  endTime: string | null;
  roomId: number | null;
  roomLabel: string | null;
  maxMarks: number;
  status: AssessmentInstanceStatus;
  sequence: number;
  scheduleGroupId: string | null;
  instructions: string | null;
  createdAt: string;
  updatedAt: string;
};

type RoomLite = { id: number; building: string; roomNumber: string; buildingName?: string };

type MarkStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

type MarksEntryRowDTO = {
  studentId: number;
  admissionNo: string;
  fullName: string;
  markId: number | null;
  marksObtained: number | null;
  absent: boolean;
  absentReason: string | null;
  remarks: string | null;
  status: MarkStatus | null;
};

type MarksEntrySheetDTO = {
  assessmentInstanceId: number;
  assessmentName: string;
  componentName: string;
  schemeName: string;
  classGroupLabel: string;
  subjectName: string;
  assessmentDate: string | null;
  maxMarks: number;
  assessmentStatus: AssessmentInstanceStatus;
  rows: MarksEntryRowDTO[];
};

type ResultStatus = 'GENERATED' | 'LOCKED' | 'PUBLISHED';

type StudentResultComponentDTO = {
  id: number | null;
  assessmentComponentId: number;
  componentName: string;
  calculationRule: string;
  rawScore: number | null;
  rawMax: number | null;
  weightedScore: number | null;
  weightagePercent: number | null;
  calculationDetailsJson: string | null;
};

type StudentResultDTO = {
  id: number | null;
  schoolId: number;
  academicYearId: number;
  academicYearLabel: string | null;
  studentId: number;
  studentName: string;
  admissionNo: string | null;
  classGroupId: number;
  classGroupName: string | null;
  schemeId: number;
  schemeName: string;
  subjectId: number;
  subjectName: string;
  totalWeightedScore: number | null;
  percentage: number | null;
  grade: string | null;
  status: ResultStatus | null;
  generatedAt: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  components: StudentResultComponentDTO[];
};

type SchemeForm = {
  name: string;
  academicYearId: string;
  description: string;
  applicableScopeType: ScopeType;
  /** Grade-level filter helper (SECTION scope only, not persisted). */
  classGradeFilter: string;
  /** Selected class-group IDs for SECTION scope (multi). */
  sectionClassGroupIds: string[];
  /** Selected grade levels for CLASS scope (multi). */
  classGrades: string[];
  /** Selected subject IDs for SUBJECT scope (multi). */
  subjectIds: string[];
  step: 1 | 2 | 3 | 4;
  draftComponents: ComponentForm[];
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



function computeScopeLabel(s: AssessmentScheme): string {
  const active = (s.assignments ?? []).filter((a) => a.active);
  if (active.length === 0) return s.assignmentLabel || 'Not assigned';
  const first = active[0];
  if (first.scopeType === 'SCHOOL') return 'School-wide';
  const gradeNumbers = [...new Set(
    active
      .filter((a) => a.scopeType === 'CLASS' || a.scopeType === 'SECTION')
      .map((a) => a.gradeLevel)
      .filter((g): g is number => g != null),
  )].sort((a, b) => a - b);

  // Build subject label: "Name (CODE)" when code is available
  const subjectAssignments = active.filter(
    (a) => (a.scopeType === 'SUBJECT' || a.scopeType === 'CLASS_SUBJECT' || a.scopeType === 'SECTION_SUBJECT') && a.subjectName,
  );
  const uniqueSubjectLabels = [...new Map(
    subjectAssignments.map((a) => [
      a.subjectId,
      a.subjectCode ? `${a.subjectName} (${a.subjectCode})` : a.subjectName!,
    ]),
  ).values()];

  const gradeLabel = gradeNumbers.length > 0 ? gradeSelectionLabel(gradeNumbers) : null;
  const subjectLabel = uniqueSubjectLabels.join(', ');
  if (uniqueSubjectLabels.length === 1 && gradeLabel) return `${uniqueSubjectLabels[0]} · ${gradeLabel}`;
  if (uniqueSubjectLabels.length > 1 && gradeLabel) return `${subjectLabel} · ${gradeLabel}`;
  if (uniqueSubjectLabels.length === 1) return uniqueSubjectLabels[0];
  if (uniqueSubjectLabels.length > 1) return subjectLabel;
  if (active.length === 1 && active[0].scopeType === 'SECTION') return active[0].classGroupLabel ?? gradeLabel ?? 'Section';
  return gradeLabel ?? s.assignmentLabel ?? 'Not assigned';
}

function getScopeCategory(s: AssessmentScheme): string {
  const active = (s.assignments ?? []).filter((a) => a.active);
  if (active.length === 0) return 'Unassigned';
  const types = new Set(active.map((a) => a.scopeType));
  if (types.has('SCHOOL')) return 'School-wide';
  if (types.has('CLASS_SUBJECT') || types.has('SECTION_SUBJECT')) return 'Class + Subject Override';
  if (types.has('SUBJECT')) return 'Subject Override';
  if (types.has('SECTION')) return 'Class Section';
  if (types.has('CLASS')) return 'Class Group';
  return 'Custom';
}

function getOverridePriority(s: AssessmentScheme): number {
  const active = (s.assignments ?? []).filter((a) => a.active);
  if (active.length === 0) return 0;
  const types = new Set(active.map((a) => a.scopeType));
  if (types.has('CLASS_SUBJECT') || types.has('SECTION_SUBJECT')) return 5;
  if (types.has('SUBJECT')) return 4;
  if (types.has('SECTION')) return 3;
  if (types.has('CLASS')) return 2;
  if (types.has('SCHOOL')) return 1;
  return 0;
}

function getOverrideBadge(s: AssessmentScheme): string | null {
  const p = getOverridePriority(s);
  if (p <= 1) return null;
  if (p === 2) return 'Overrides school-wide';
  if (p === 3) return 'Overrides grade scheme';
  return 'Highest priority';
}

type SchemeState = 'Needs Setup' | 'Draft' | 'Ready to Publish' | 'Published' | 'Archived' | 'Has Conflicts';

function computeSchemeState(s: AssessmentScheme): { state: SchemeState; level: StatusLevel } {
  if (s.status === 'ARCHIVED') return { state: 'Archived', level: 'idle' };
  if (s.status === 'PUBLISHED') return { state: 'Published', level: 'ok' };
  const components = s.components ?? [];
  const total = totalWeightage(components);
  const hasRuleIssue = components.some((c) => validateComponentRules(c).length > 0);
  if (components.length === 0) return { state: 'Needs Setup', level: 'warn' };
  if (!(s.assignments ?? []).some((a) => a.active)) return { state: 'Needs Setup', level: 'warn' };
  if (hasRuleIssue || total !== 100) return { state: 'Has Conflicts', level: 'error' };
  return { state: 'Ready to Publish', level: 'ok' };
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

function schemeReadiness(s: AssessmentScheme): { ready: boolean; label: string; level: StatusLevel } {
  if (s.status === 'ARCHIVED') return { ready: false, label: 'Archived / Read-only', level: 'idle' };
  if (s.status === 'PUBLISHED') return { ready: true, label: 'Published', level: 'ok' };
  const components = s.components ?? [];
  if (components.length === 0) return { ready: false, label: 'Needs components', level: 'warn' };
  if (!(s.assignments ?? []).some((a) => a.active)) return { ready: false, label: 'Needs assignment', level: 'warn' };
  const t = totalWeightage(components);
  if (t !== 100) return { ready: false, label: 'Weightage incomplete', level: 'warn' };
  if (components.some((c) => validateComponentRules(c).length > 0)) return { ready: false, label: 'Invalid rule', level: 'error' };
  return { ready: true, label: 'Ready to publish', level: 'ok' };
}

function formatAcademicYear(label: string | null | undefined): string {
  const raw = (label ?? '2026-2027').trim();
  const match = raw.match(/(\d{4})\D+(\d{2}|\d{4})/);
  if (!match) return raw.replace(/-/g, '–');
  const start = match[1];
  const end = match[2].length === 2 ? `${start.slice(0, 2)}${match[2]}` : match[2];
  return `${start}–${end}`;
}

function gradeSelectionLabel(grades: number[]): string {
  const clean = Array.from(new Set(grades.filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
  if (clean.length === 0) return '';
  if (clean.length === 1) return `Grade ${clean[0]}`;
  const contiguous = clean.every((grade, index) => index === 0 || grade === clean[index - 1] + 1);
  return contiguous ? `Grades ${clean[0]}–${clean[clean.length - 1]}` : `Grades ${clean.join(', ')}`;
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
    { id: 'schedule', label: 'Exam Schedule', hint: 'Complete and publish valid assessment schemes first.' },
    { id: 'marks', label: 'Marks Entry', hint: 'Create and publish exam schedule first.' },
    { id: 'results', label: 'Results', hint: 'Finalize marks entry first.' },
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
        <OverviewPanel schemes={schemes} gradingCount={gradingQ.data?.length ?? 0} />
      ) : null}

      {tab === 'schemes' ? (
        <AssessmentSchemesPanel
          schemes={schemes}
          selectedScheme={selectedScheme}
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
        <GradingSchemesManager
          gradingSchemes={gradingQ.data ?? []}
          academicYears={academicYearsQ.data ?? []}
          classGroups={classGroups}
          onChanged={async () => {
            await qc.invalidateQueries({ queryKey: ['grading-schemes'] });
          }}
        />
      ) : null}

      {tab === 'schedule' ? (
        <ExamSchedulePanel
          schemes={schemes}
          classGroups={classGroups}
          subjects={subjects}
          academicYears={academicYearsQ.data ?? []}
        />
      ) : null}
      {tab === 'marks' ? (
        <MarksEntryPanel
          classGroups={classGroups}
          subjects={subjects}
          schemes={schemes}
        />
      ) : null}
      {tab === 'results' ? (
        <ResultsPanel
          schemes={schemes}
          classGroups={classGroups}
          subjects={subjects}
          academicYears={academicYearsQ.data ?? []}
        />
      ) : null}
    </ModulePage>
  );
}

function OverviewPanel({ schemes, gradingCount }: { schemes: AssessmentScheme[]; gradingCount: number }) {
  const totalSchemes = schemes.length;
  const archivedCount = schemes.filter((s) => s.status === 'ARCHIVED').length;
  const activeCount = schemes.filter((s) => s.status !== 'ARCHIVED').length;
  const draftCount = schemes.filter((s) => s.status === 'DRAFT').length;
  const subjectOverrideCount = schemes.filter((s) => getOverridePriority(s) >= 4).length;
  const conflictCount = schemes.filter((s) => computeSchemeState(s).state === 'Has Conflicts').length;
  const validPublishedCount = schemes.filter((s) =>
    s.status === 'PUBLISHED' &&
    (s.components?.length ?? 0) > 0 &&
    totalWeightage(s.components ?? []) === 100 &&
    (s.assignments ?? []).some((a) => a.active),
  ).length;
  const hasValidPublishedSchemes = validPublishedCount > 0;
  const hasGrading = gradingCount > 0;

  const scheduleState = hasValidPublishedSchemes ? 'Ready' : 'Locked';
  const nextTitle = hasValidPublishedSchemes
    ? 'Review coverage and readiness before creating exam schedules.'
    : 'Create and publish at least one valid assessment scheme to unlock scheduling.';
  const nextHelper = !hasValidPublishedSchemes
    ? 'A valid scheme needs active assignments, at least one component, and 100% total weightage.'
    : !hasGrading
      ? 'Schemes are ready. Configure grading next so result bands are available later.'
      : 'Your foundation is ready. Review coverage before schedule generation.';

  const workflowSteps: Array<{ label: string; status: 'Completed' | 'In progress' | 'Locked' | 'Not started'; helper: string; href: string }> = [
    {
      label: 'Assessment Schemes',
      status: hasValidPublishedSchemes ? 'Completed' : totalSchemes > 0 ? 'In progress' : 'Not started',
      helper: hasValidPublishedSchemes ? `${validPublishedCount} valid published scheme${validPublishedCount === 1 ? '' : 's'} available.` : 'Create and publish valid assessment schemes.',
      href: '/app/examinations?tab=schemes',
    },
    {
      label: 'Grading',
      status: hasGrading ? 'Completed' : totalSchemes > 0 ? 'In progress' : 'Not started',
      helper: hasGrading ? `${gradingCount} grading scheme${gradingCount === 1 ? '' : 's'} configured.` : 'Configure result bands and grade calculation.',
      href: '/app/examinations?tab=grading',
    },
    {
      label: 'Exam Schedule',
      status: hasValidPublishedSchemes ? 'Not started' : 'Locked',
      helper: hasValidPublishedSchemes ? 'Ready to create schedules.' : 'Complete and publish valid assessment schemes first.',
      href: '/app/examinations?tab=schedule',
    },
    {
      label: 'Marks Entry',
      status: 'Locked',
      helper: 'Create and publish exam schedule first.',
      href: '/app/examinations?tab=marks',
    },
    {
      label: 'Results',
      status: 'Locked',
      helper: 'Finalize marks entry first.',
      href: '/app/examinations?tab=results',
    },
  ];

  const statusStyle = (status: string): { bg: string; color: string; icon: string } => {
    if (status === 'Completed') return { bg: '#d1fae5', color: '#065f46', icon: '✓' };
    if (status === 'In progress') return { bg: '#dbeafe', color: '#1d4ed8', icon: '●' };
    if (status === 'Locked') return { bg: '#f1f5f9', color: '#64748b', icon: '🔒' };
    return { bg: '#f8fafc', color: '#475569', icon: '○' };
  };

  const moduleCards = [
    {
      title: 'Assessment Schemes',
      value: totalSchemes,
      status: `${activeCount} active · ${draftCount} drafts · ${archivedCount} archived · ${conflictCount} conflicts`,
      helper: `${subjectOverrideCount} subject override${subjectOverrideCount === 1 ? '' : 's'} configured. Published valid schemes unlock scheduling.`,
      level: conflictCount > 0 ? 'error' : hasValidPublishedSchemes ? 'ok' : totalSchemes > 0 ? 'warn' : 'idle',
      href: '/app/examinations?tab=schemes',
    },
    {
      title: 'Grading Schemes',
      value: gradingCount,
      status: gradingCount > 0 ? 'Configured' : 'Not configured',
      helper: 'Used for result bands and grade calculation.',
      level: gradingCount > 0 ? 'ok' : 'warn',
      href: '/app/examinations?tab=grading',
    },
    {
      title: 'Exam Schedule',
      value: scheduleState === 'Locked' ? '🔒' : 'Ready',
      status: scheduleState,
      helper: hasValidPublishedSchemes ? 'Valid published schemes are available for schedule creation.' : 'Complete and publish valid assessment schemes first.',
      level: hasValidPublishedSchemes ? 'ok' : 'idle',
      href: '/app/examinations?tab=schedule',
    },
    {
      title: 'Marks Entry',
      value: '🔒',
      status: 'Locked',
      helper: 'Unlocks after exam schedule is published.',
      level: 'idle',
      href: '/app/examinations?tab=marks',
    },
    {
      title: 'Results',
      value: '🔒',
      status: 'Locked',
      helper: 'Unlocks after marks are finalized.',
      level: 'idle',
      href: '/app/examinations?tab=results',
    },
  ] as const;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 16, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ fontWeight: 950, fontSize: 15 }}>Module status</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>
              Assessment schemes drive schedule creation. Grading supports result calculation, while schedule, marks, and results unlock in sequence.
            </div>
          </div>
          <StatusChip
            level={hasValidPublishedSchemes ? 'ok' : totalSchemes > 0 ? 'warn' : 'idle'}
            label={hasValidPublishedSchemes ? 'Foundation ready' : totalSchemes > 0 ? 'Setup in progress' : 'Not started'}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 16, border: '1px solid rgba(37,99,235,0.18)', background: 'linear-gradient(135deg, rgba(239,246,255,0.9), rgba(255,255,255,1))' }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recommended next step</div>
            <div style={{ fontSize: 18, fontWeight: 950, marginTop: 4 }}>{nextTitle}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>{nextHelper}</div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {hasValidPublishedSchemes ? (
              <>
                <Link to="/app/examinations?tab=schemes" className="btn">Review Assessment Schemes</Link>
                <Link to="/app/examinations?tab=grading" className="btn secondary">Configure Grading</Link>
              </>
            ) : (
              <Link to="/app/examinations?tab=schemes" className="btn">Create Assessment Scheme</Link>
            )}
          </div>
        </div>
      </div>

      {totalSchemes === 0 ? (
        <div className="card" style={{ padding: 16, border: '1px dashed rgba(249,115,22,0.35)', background: 'rgba(255,247,237,0.7)' }}>
          <div style={{ fontWeight: 900 }}>Create your first assessment scheme</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>
            Start with a school-wide or grade-level scheme, add components until total weightage is 100%, then publish it to unlock scheduling.
          </div>
          <Link to="/app/examinations?tab=schemes" className="btn" style={{ marginTop: 10, display: 'inline-flex' }}>Create Assessment Scheme</Link>
        </div>
      ) : !hasGrading ? (
        <div className="card" style={{ padding: 14, border: '1px solid rgba(234,179,8,0.22)', background: 'rgba(254,243,199,0.35)' }}>
          <div style={{ fontWeight: 900 }}>Grading is not configured yet</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Add grading bands now so result generation can calculate grades consistently later.
          </div>
          <Link to="/app/examinations?tab=grading" className="btn secondary" style={{ marginTop: 10, display: 'inline-flex' }}>Configure Grading</Link>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {moduleCards.map((card) => (
          <Link key={card.title} to={card.href} className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)', textDecoration: 'none', color: 'inherit', opacity: card.status === 'Locked' ? 0.78 : 1 }} title={card.helper}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{card.title}</div>
              <StatusChip level={card.level} label={card.status} />
            </div>
            <div style={{ fontSize: typeof card.value === 'number' ? 28 : 22, fontWeight: 950, marginTop: 8 }}>{card.value}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{card.helper}</div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: 16, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ fontWeight: 950, marginBottom: 12 }}>Workflow progress</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {workflowSteps.map((step, index) => {
            const s = statusStyle(step.status);
            return (
              <Link key={step.label} to={step.href} style={{ textDecoration: 'none', color: 'inherit' }} title={step.helper}>
                <div style={{ border: '1px solid rgba(15,23,42,0.1)', borderRadius: 10, padding: 12, background: step.status === 'Locked' ? '#f8fafc' : '#fff', height: '100%' }}>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: s.bg, color: s.color, fontSize: 12, fontWeight: 900 }}>
                      {s.icon}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800 }}>Step {index + 1}</span>
                  </div>
                  <div style={{ fontWeight: 900, marginTop: 8 }}>{step.label}</div>
                  <div style={{ display: 'inline-flex', marginTop: 6, fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.color }}>
                    {step.status}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 7, lineHeight: 1.4 }}>{step.helper}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AssessmentSchemesPanel({
  schemes,
  selectedScheme,
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
  classGroups: ClassGroup[];
  gradeOptions: number[];
  subjects: SubjectLite[];
  academicYears: AcademicYear[];
  onOpenScheme: (schemeId: number) => void;
  onCloseScheme: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [schemeSearch, setSchemeSearch] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterAcademicYearFilter, setFilterAcademicYearFilter] = useState('');
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState('0');
  const [form, setForm] = useState<SchemeForm>({
    name: '',
    academicYearId: String(academicYears[0]?.id ?? ''),
    description: '',
    applicableScopeType: 'SCHOOL',
    classGradeFilter: '',
    sectionClassGroupIds: [],
    classGrades: [],
    subjectIds: [],
    step: 1,
    draftComponents: [],
  });

  const createScheme = useMutation({
    mutationFn: async () => {
      const academicYearId = Number(form.academicYearId);
      if (!Number.isFinite(academicYearId) || academicYearId <= 0)
        throw new Error('Select an academic year.');
      if (form.draftComponents.length === 0)
        throw new Error('Add components or apply a preset before creating this scheme.');

      type AssignmentPayload = { scopeType: ScopeType; classGroupId?: number; subjectId?: number };
      let assignments: AssignmentPayload[] = [];

      if (form.applicableScopeType === 'SCHOOL') {
        assignments = [{ scopeType: 'SCHOOL' }];
      } else if (form.applicableScopeType === 'CLASS') {
        if (form.classGrades.length === 0) throw new Error('Select at least one class.');
        const selectedGrades = new Set(form.classGrades.map(Number));
        assignments = classGroups
          .filter((cg) => cg.gradeLevel != null && selectedGrades.has(cg.gradeLevel))
          .map((cg) => ({ scopeType: 'CLASS', classGroupId: cg.id }));
        if (assignments.length === 0) throw new Error('No sections found for selected classes.');
      } else if (form.applicableScopeType === 'SECTION') {
        if (form.sectionClassGroupIds.length === 0) throw new Error('Select at least one section.');
        assignments = form.sectionClassGroupIds.map((id) => ({ scopeType: 'SECTION', classGroupId: Number(id) }));
      } else if (form.applicableScopeType === 'SUBJECT') {
        if (form.subjectIds.length === 0) throw new Error('Select at least one subject.');
        assignments = form.subjectIds.map((id) => ({ scopeType: 'SUBJECT', subjectId: Number(id) }));
      }

      const components = form.draftComponents.map((c) => ({
        name: c.name.trim(),
        componentType: c.componentType,
        weightagePercent: Number(c.weightagePercent),
        maxMarks: c.maxMarks == null ? '' : String(c.maxMarks),
        calculationRule: c.calculationRule,
        totalAssessments: c.totalAssessments == null ? '' : String(c.totalAssessments),
        bestOfCount: c.bestOfCount == null ? '' : String(c.bestOfCount),
        mandatory: c.mandatory,
        sequence: String(c.sequence),
      }));

      return (await api.post<AssessmentScheme>('/api/exams/schemes', {
        academicYearId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        assignments,
        components,
      })).data;
    },
    onSuccess: async (created) => {
      toast.success('Scheme created', 'One reusable scheme was created with assignments.');
      setCreateOpen(false);
      setForm((prev) => ({ ...prev, name: '', description: '', step: 1, draftComponents: [] }));
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
    const grade = Number(form.classGradeFilter);
    if (!Number.isFinite(grade) || grade <= 0) return true;
    return g.gradeLevel === grade;
  });

  const activeSchemes = schemes.filter((s) => s.status !== 'ARCHIVED');
  const archivedSchemes = schemes.filter((s) => s.status === 'ARCHIVED');

  function renderSchemeRows(rows: AssessmentScheme[], isArchived: boolean) {
    return rows.map((s) => {
      const { state } = computeSchemeState(s);
      const total = totalWeightage(s.components ?? []);
      const overrideBadge = getOverrideBadge(s);
      const scopeCategory = getScopeCategory(s);
      const appliesTo = computeScopeLabel(s);
      const isMenuOpen = activeMenuId === s.id;

      const stateColors: Record<SchemeState, { bg: string; color: string }> = {
        'Needs Setup':     { bg: '#fef3c7', color: '#92400e' },
        'Draft':           { bg: '#f1f5f9', color: '#475569' },
        'Ready to Publish':{ bg: '#dbeafe', color: '#1d4ed8' },
        'Published':       { bg: '#d1fae5', color: '#065f46' },
        'Archived':        { bg: '#f1f5f9', color: '#64748b' },
        'Has Conflicts':   { bg: '#fee2e2', color: '#991b1b' },
      };
      const sc = stateColors[state];

      return (
        <tr
          key={s.id}
          style={{ borderBottom: '1px solid rgba(15,23,42,0.07)', opacity: isArchived ? 0.75 : 1, cursor: 'pointer' }}
          onClick={() => onOpenScheme(s.id)}
        >
          {/* Scheme Name */}
          <td style={{ padding: '9px 8px' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
            {overrideBadge && (
              <div style={{ fontSize: 10, marginTop: 2, color: '#7c3aed', fontWeight: 600 }}>
                ↑ {overrideBadge}
              </div>
            )}
          </td>
          {/* Scope */}
          <td style={{ padding: '9px 8px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
            {scopeCategory}
          </td>
          {/* Applies To */}
          <td style={{ padding: '9px 8px', fontSize: 12, maxWidth: 160 }}>
            <span title={appliesTo} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {appliesTo}
            </span>
          </td>
          {/* Components */}
          <td style={{ padding: '9px 8px', fontSize: 12, textAlign: 'center' }}>
            {s.components?.length ?? 0}
          </td>
          {/* Total Weightage */}
          <td style={{ padding: '9px 8px', fontSize: 12, textAlign: 'center' }}>
            <span style={{ color: total === 100 ? '#065f46' : total > 0 ? '#b45309' : '#94a3b8', fontWeight: total === 100 ? 700 : 400 }}>
              {total > 0 ? `${total}%` : '—'}
            </span>
          </td>
          {/* State */}
          <td style={{ padding: '9px 8px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', background: sc.bg, color: sc.color }}>
              {state}
            </span>
          </td>
          {/* Actions */}
          <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={() => onOpenScheme(s.id)}
              >
                {s.status === 'DRAFT' ? 'Open' : 'View'}
              </button>
              {/* 3-dot overflow menu */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: '#64748b' }}
                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : s.id); }}
                  title="More actions"
                >
                  ⋯
                </button>
                {isMenuOpen && (
                  <div
                    style={{
                      position: 'absolute', right: 0, top: '110%', zIndex: 50,
                      background: '#fff', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(15,23,42,0.12)', minWidth: 140, padding: '4px 0',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.status === 'DRAFT' && computeSchemeState(s).state === 'Ready to Publish' && (
                      <button
                        type="button"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}
                        disabled={publishScheme.isPending}
                        onClick={() => { publishScheme.mutate(s.id); setActiveMenuId(null); }}
                      >
                        ✓ Publish
                      </button>
                    )}
                    <button
                      type="button"
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
                      disabled={cloneScheme.isPending}
                      onClick={() => { cloneScheme.mutate(s.id); setActiveMenuId(null); }}
                    >
                      ⎘ Clone
                    </button>
                    {!isArchived && (
                      <button
                        type="button"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#b45309' }}
                        disabled={archiveScheme.isPending}
                        onClick={() => { archiveScheme.mutate(s.id); setActiveMenuId(null); }}
                      >
                        ▾ Archive
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      );
    });
  }

  function suggestSchemeName(): string {
    if (form.applicableScopeType === 'SCHOOL') return 'School-wide Default Scheme';
    if (form.applicableScopeType === 'SUBJECT') {
      if (form.subjectIds.length === 1) {
        const subject = subjects.find((s) => String(s.id) === form.subjectIds[0]);
        return `${subject?.name ?? 'Subject'} Override Scheme`;
      }
      if (form.subjectIds.length > 1) return `${form.subjectIds.length} Subjects Override Scheme`;
    }
    const grades = form.applicableScopeType === 'CLASS'
      ? form.classGrades.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
      : form.sectionClassGroupIds
        .map((id) => classGroups.find((cg) => String(cg.id) === id)?.gradeLevel)
        .filter((n): n is number => typeof n === 'number')
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .sort((a, b) => a - b);
    const gradeLabel = gradeSelectionLabel(grades);
    if (gradeLabel) return `${gradeLabel} Evaluation Scheme`;
    return 'Evaluation Scheme';
  }

  function presetToFormComponents(preset: ComponentPreset): ComponentForm[] {
    return preset.components.map((c) => ({
      name: c.name,
      componentType: c.componentType,
      weightagePercent: String(c.weightagePercent),
      maxMarks: c.maxMarks == null ? '' : String(c.maxMarks),
      calculationRule: c.calculationRule,
      totalAssessments: c.totalAssessments == null ? '' : String(c.totalAssessments),
      bestOfCount: c.bestOfCount == null ? '' : String(c.bestOfCount),
      mandatory: c.mandatory,
      sequence: String(c.sequence),
    }));
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 900 }}>Assessment Schemes</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              Create reusable assessment patterns and assign them to school, classes, sections, or subject overrides. More specific schemes override broader ones.
            </div>
          </div>
          <button type="button" className="btn" onClick={() => setCreateOpen((v) => !v)}>
            {createOpen ? 'Close form' : 'Create Scheme'}
          </button>
        </div>

        {createOpen ? (
          <div className="stack" style={{ gap: 10, marginTop: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Step 1: Basic Details</div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <label className="stack" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Name</span>
                <div className="row" style={{ gap: 6 }}>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
                  <button type="button" className="btn secondary" onClick={() => setForm((p) => ({ ...p, name: suggestSchemeName() }))}>Suggest</button>
                </div>
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Academic year</span>
                <SmartSelect
                  value={form.academicYearId}
                  onChange={(v) => setForm((p) => ({ ...p, academicYearId: v }))}
                  options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))}
                  placeholder="Select academic year…"
                  allowClear
                  clearLabel="— Not set —"
                />
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

            <div className="card" style={{ padding: 12, border: '1px dashed rgba(15,23,42,0.18)' }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>Step 2: Components</div>
                  <div className="muted" style={{ fontSize: 12 }}>Use a preset or add components manually before assigning the scheme.</div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <SelectKeeper
                    value={selectedPresetIndex}
                    onChange={setSelectedPresetIndex}
                    options={PRESETS.map((p, index) => ({
                      value: String(index),
                      label: `${p.label} (${p.components.length} components)`,
                    }))}
                  />
                  <button type="button" className="btn secondary"
                    onClick={() => {
                      const preset = PRESETS[Number(selectedPresetIndex)] ?? PRESETS[0];
                      setForm((p) => ({ ...p, draftComponents: presetToFormComponents(preset) }));
                    }}>
                    Apply preset
                  </button>
                  <button type="button" className="btn secondary"
                    onClick={() => setForm((p) => ({ ...p, draftComponents: [...p.draftComponents, createEmptyComponent(p.draftComponents.length + 1)] }))}>
                    Add component
                  </button>
                </div>
              </div>
              {PRESETS[Number(selectedPresetIndex)] ? (
                <div style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Preset preview: {PRESETS[Number(selectedPresetIndex)].label}</div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {PRESETS[Number(selectedPresetIndex)].components.map((c) => (
                      <span key={`${c.name}-${c.sequence}`} style={{ fontSize: 12, background: '#fff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 999, padding: '4px 8px' }}>
                        <strong>{c.name}</strong>: {c.weightagePercent}%{c.calculationRule === 'BEST_N_OF_M' && c.bestOfCount && c.totalAssessments ? `, Best ${c.bestOfCount} of ${c.totalAssessments}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {form.draftComponents.length === 0 ? (
                <div style={{ color: '#b45309', fontSize: 12 }}>Add components or apply a preset before creating this scheme.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr>{['Name', 'Type', 'Weight %', 'Rule', 'Max', 'Best/Total', ''].map((h) => <th key={h} style={{ padding: 6, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {form.draftComponents.map((c, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: 4 }}><input value={c.name} onChange={(e) => setForm((p) => ({ ...p, draftComponents: p.draftComponents.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) }))} style={{ minWidth: 120 }} /></td>
                          <td style={{ padding: 4 }}><SelectKeeper value={c.componentType} onChange={(v) => setForm((p) => ({ ...p, draftComponents: p.draftComponents.map((x, i) => i === idx ? { ...x, componentType: v as ComponentType } : x) }))} options={COMPONENT_TYPES.map((t) => ({ value: t, label: toDisplayLabel(t) }))} /></td>
                          <td style={{ padding: 4 }}><input type="number" value={c.weightagePercent} onChange={(e) => setForm((p) => ({ ...p, draftComponents: p.draftComponents.map((x, i) => i === idx ? { ...x, weightagePercent: e.target.value } : x) }))} style={{ width: 70 }} /></td>
                          <td style={{ padding: 4 }}><SelectKeeper value={c.calculationRule} onChange={(v) => setForm((p) => ({ ...p, draftComponents: p.draftComponents.map((x, i) => i === idx ? { ...x, calculationRule: v as CalculationRule } : x) }))} options={CALCULATION_RULES.map((r) => ({ value: r, label: toDisplayLabel(r) }))} /></td>
                          <td style={{ padding: 4 }}><input type="number" value={c.maxMarks} onChange={(e) => setForm((p) => ({ ...p, draftComponents: p.draftComponents.map((x, i) => i === idx ? { ...x, maxMarks: e.target.value } : x) }))} style={{ width: 70 }} /></td>
                          <td style={{ padding: 4 }}><input placeholder="best" value={c.bestOfCount} onChange={(e) => setForm((p) => ({ ...p, draftComponents: p.draftComponents.map((x, i) => i === idx ? { ...x, bestOfCount: e.target.value } : x) }))} style={{ width: 50 }} /> / <input placeholder="total" value={c.totalAssessments} onChange={(e) => setForm((p) => ({ ...p, draftComponents: p.draftComponents.map((x, i) => i === idx ? { ...x, totalAssessments: e.target.value } : x) }))} style={{ width: 50 }} /></td>
                          <td style={{ padding: 4 }}><button type="button" className="btn secondary" onClick={() => setForm((p) => ({ ...p, draftComponents: p.draftComponents.filter((_, i) => i !== idx) }))}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Total weightage: {form.draftComponents.reduce((sum, c) => sum + Number(c.weightagePercent || 0), 0)}%</div>
                </div>
              )}
            </div>

            <div style={{ fontWeight: 800, fontSize: 13 }}>Step 3: Assignments</div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label className="stack" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Applicable scope</span>
                <SelectKeeper
                  value={form.applicableScopeType}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      applicableScopeType: v as ScopeType,
                      classGradeFilter: '',
                      sectionClassGroupIds: [],
                      classGrades: [],
                      subjectIds: [],
                    }))
                  }
                  options={[
                    { value: 'SCHOOL', label: 'School-wide' },
                    { value: 'CLASS', label: 'Class' },
                    { value: 'SECTION', label: 'Section' },
                    { value: 'SUBJECT', label: 'Subject' },
                  ]}
                />
              </label>

              {form.applicableScopeType === 'CLASS' ? (
                <label className="stack" style={{ gap: 6 }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Classes</span>
                  <MultiSelectKeeper
                    value={form.classGrades}
                    onChange={(v) => setForm((p) => ({ ...p, classGrades: v }))}
                    options={gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
                    placeholder="Select classes…"
                  />
                </label>
              ) : null}

              {form.applicableScopeType === 'SECTION' ? (
                <>
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Filter by class</span>
                    <SelectKeeper
                      value={form.classGradeFilter}
                      onChange={(v) => setForm((p) => ({ ...p, classGradeFilter: v, sectionClassGroupIds: [] }))}
                      emptyValueLabel="All classes"
                      options={gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
                    />
                  </label>
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Sections</span>
                    <MultiSelectKeeper
                      value={form.sectionClassGroupIds}
                      onChange={(v) => setForm((p) => ({ ...p, sectionClassGroupIds: v }))}
                      options={sectionClassOptions.map((cg) => ({
                        value: String(cg.id),
                        label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}`,
                      }))}
                      placeholder="Select sections…"
                    />
                  </label>
                </>
              ) : null}

              {form.applicableScopeType === 'SUBJECT' ? (
                <label className="stack" style={{ gap: 6 }}>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subjects</span>
                  <MultiSelectKeeper
                    value={form.subjectIds}
                    onChange={(v) => setForm((p) => ({ ...p, subjectIds: v }))}
                    options={subjects.map((s) => ({
                      value: String(s.id),
                      label: s.code ? `${s.code} – ${s.name}` : s.name,
                    }))}
                    placeholder="Select subjects…"
                  />
                </label>
              ) : null}
            </div>

            <div className="card" style={{ padding: 12, border: '1px dashed rgba(15,23,42,0.18)' }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Step 4: Review</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {(() => {
                  const componentCount = form.draftComponents.length;
                  const total = form.draftComponents.reduce((sum, c) => sum + Number(c.weightagePercent || 0), 0);
                  const assignmentCount = form.applicableScopeType === 'SCHOOL' ? 1 :
                    form.applicableScopeType === 'CLASS' ? classGroups.filter((cg) => cg.gradeLevel != null && form.classGrades.map(Number).includes(cg.gradeLevel)).length :
                    form.applicableScopeType === 'SECTION' ? form.sectionClassGroupIds.length : form.subjectIds.length;
                  const issues = [
                    componentCount === 0 ? 'Missing components' : null,
                    assignmentCount === 0 ? 'Missing assignments' : null,
                    componentCount > 0 && total !== 100 ? 'Weightage must equal 100%' : null,
                  ].filter(Boolean).join(' · ');
                  return `${form.name.trim() || suggestSchemeName()} · ${formatAcademicYear(academicYears.find((y) => String(y.id) === form.academicYearId)?.label)} · ${componentCount} component${componentCount === 1 ? '' : 's'} · ${assignmentCount} assignment${assignmentCount === 1 ? '' : 's'} · ${total}% weightage${issues ? ` · ${issues}` : ' · Ready to create'}`;
                })()}
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
              {(() => {
                const count =
                  form.applicableScopeType === 'CLASS' ? classGroups.filter((cg) => cg.gradeLevel != null && form.classGrades.map(Number).includes(cg.gradeLevel)).length :
                  form.applicableScopeType === 'SECTION' ? form.sectionClassGroupIds.length :
                  form.applicableScopeType === 'SUBJECT' ? form.subjectIds.length : 0;
                return count > 1 ? (
                  <span className="muted" style={{ fontSize: 12 }}>
                    Will create 1 reusable scheme with {count} assignments
                  </span>
                ) : null;
              })()}
              <button
                type="button"
                className="btn"
                disabled={createScheme.isPending || !form.name.trim() || form.draftComponents.length === 0}
                onClick={() => createScheme.mutate()}
              >
                {createScheme.isPending ? 'Creating…' : 'Create Scheme'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!selectedScheme ? (
        <>
        {/* ── Summary Cards ── */}
        {schemes.length > 0 && (() => {
          const active = schemes.filter((s) => s.status !== 'ARCHIVED').length;
          const drafts = schemes.filter((s) => s.status === 'DRAFT').length;
          const subjectOverrides = schemes.filter((s) => getOverridePriority(s) >= 4).length;
          const archived = schemes.filter((s) => s.status === 'ARCHIVED').length;
          const conflicts = schemes.filter((s) => computeSchemeState(s).state === 'Has Conflicts').length;
          const cards = [
            { label: 'Active', value: active, color: '#065f46', bg: '#d1fae5' },
            { label: 'Drafts', value: drafts, color: '#92400e', bg: '#fef3c7' },
            { label: 'Subject Overrides', value: subjectOverrides, color: '#4338ca', bg: '#ede9fe' },
            { label: 'Archived', value: archived, color: '#475569', bg: '#f1f5f9' },
            { label: 'Conflicts', value: conflicts, color: conflicts > 0 ? '#991b1b' : '#475569', bg: conflicts > 0 ? '#fee2e2' : '#f1f5f9' },
          ];
          return (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
              {cards.map((c) => (
                <div key={c.label} style={{ background: c.bg, borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c.color, marginTop: 2 }}>{c.value}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Active Schemes ── */}
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
          {/* Search + Filters */}
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 12 }}>
            <input
              value={schemeSearch}
              onChange={(e) => setSchemeSearch(e.target.value)}
              placeholder="Search scheme, class, subject…"
              style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.2)', gridColumn: 'span 2' }}
            />
            <SmartSelect
              value={filterScope}
              onChange={setFilterScope}
              options={['School-wide','Class Group','Class Section','Subject Override','Class + Subject Override','Unassigned'].map((v) => ({ value: v, label: v }))}
              placeholder="All scopes"
              allowClear
            />
            <SmartSelect
              value={filterAcademicYearFilter}
              onChange={setFilterAcademicYearFilter}
              options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))}
              placeholder="All years"
              allowClear
            />
            <SmartSelect
              value={filterState}
              onChange={setFilterState}
              options={(['Needs Setup','Ready to Publish','Published','Has Conflicts'] as SchemeState[]).map((v) => ({ value: v, label: v }))}
              placeholder="All states"
              allowClear
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }} onClick={() => activeMenuId !== null && setActiveMenuId(null)}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: 12 }}>Scheme Name</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>Scope</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>Applies To</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>Components</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>Weightage</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: 12 }}>State</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, fontSize: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const q = schemeSearch.trim().toLowerCase();
                  const filtered = activeSchemes.filter((s) => {
                    if (q && !s.name.toLowerCase().includes(q) && !computeScopeLabel(s).toLowerCase().includes(q)) return false;
                    if (filterScope && getScopeCategory(s) !== filterScope) return false;
                    if (filterAcademicYearFilter && String(s.academicYearId) !== filterAcademicYearFilter) return false;
                    if (filterState && computeSchemeState(s).state !== filterState) return false;
                    return true;
                  });
                  if (filtered.length === 0) return (
                    <tr><td colSpan={7} style={{ padding: 16 }} className="muted">
                      {activeSchemes.length === 0 ? 'No active schemes yet. Create your first scheme above.' : 'No schemes match the current filters.'}
                    </td></tr>
                  );
                  return renderSchemeRows(filtered, false);
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Archived (collapsible) ── */}
        {archivedSchemes.length > 0 && (
          <div className="card" style={{ padding: 0, border: '1px solid rgba(15,23,42,0.1)', overflow: 'hidden' }}>
            <button
              type="button"
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(15,23,42,0.03)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              onClick={() => setArchivedExpanded((v) => !v)}
            >
              <span style={{ fontWeight: 700, fontSize: 13, color: '#64748b' }}>
                Archived Assessment Schemes ({archivedSchemes.length})
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{archivedExpanded ? '▲ Collapse' : '▼ Expand'}</span>
            </button>
            {archivedExpanded && (
              <div style={{ overflowX: 'auto', padding: '0 0 8px' }} onClick={() => activeMenuId !== null && setActiveMenuId(null)}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                      <th style={{ padding: '7px 8px', fontWeight: 700, fontSize: 11 }}>Scheme Name</th>
                      <th style={{ padding: '7px 8px', fontWeight: 700, fontSize: 11 }}>Scope</th>
                      <th style={{ padding: '7px 8px', fontWeight: 700, fontSize: 11 }}>Applies To</th>
                      <th style={{ padding: '7px 8px', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>Components</th>
                      <th style={{ padding: '7px 8px', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>Weightage</th>
                      <th style={{ padding: '7px 8px', fontWeight: 700, fontSize: 11 }}>State</th>
                      <th style={{ padding: '7px 8px', fontWeight: 700, fontSize: 11 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>{renderSchemeRows(archivedSchemes, true)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </>
      ) : (
        <SchemeDetailCard
          scheme={selectedScheme}
          onClose={onCloseScheme}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function SchemeDetailCard({
  scheme,
  onClose,
  onRefresh,
}: {
  scheme: AssessmentScheme;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const total = totalWeightage(scheme.components ?? []);
  const ready = schemeReadiness(scheme);
  const { state: schemeState, level: schemeLevel } = computeSchemeState(scheme);

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

  const publishScheme = useMutation({
    mutationFn: async () => (await api.post<AssessmentScheme>(`/api/exams/schemes/${scheme.id}/publish`)).data,
    onSuccess: async () => {
      toast.success('Scheme published');
      await onRefresh();
    },
    onError: (e) => toast.error('Could not publish scheme', formatApiError(e)),
  });

  const cloneForRevise = useMutation({
    mutationFn: async () => (await api.post<AssessmentScheme>(`/api/exams/schemes/${scheme.id}/clone`)).data,
    onSuccess: async (_created) => {
      await onRefresh();
      onClose();
    },
    onError: (e) => toast.error('Could not clone scheme', formatApiError(e)),
  });

  const applyPreset = useMutation({
    mutationFn: async (preset: ComponentPreset) => {
      const current = scheme.components ?? [];
      for (const c of current) {
        await api.delete(`/api/exams/schemes/${scheme.id}/components/${c.id}`);
      }
      for (const p of preset.components) {
        await api.post(`/api/exams/schemes/${scheme.id}/components`, {
          ...p,
          sequence: p.sequence,
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

  const isReadOnly = scheme.status === 'PUBLISHED' || scheme.status === 'ARCHIVED';

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{scheme.name}</h2>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              {scheme.academicYearLabel ?? `Year ${scheme.academicYearId}`} · {computeScopeLabel(scheme)} · Total weightage: {total}%
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <StatusChip level={schemeLevel} label={schemeState} />
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn secondary" onClick={onClose}>
              Back to list
            </button>
            {isReadOnly ? (
              <button
                type="button"
                className="btn secondary"
                disabled={cloneForRevise.isPending}
                onClick={() => cloneForRevise.mutate()}
              >
                {cloneForRevise.isPending ? 'Cloning…' : 'Clone to revise'}
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={!ready.ready || publishScheme.isPending}
                onClick={() => publishScheme.mutate()}
              >
                {publishScheme.isPending ? 'Publishing...' : 'Publish'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Components</div>
        {!isReadOnly ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(scheme.components?.length ?? 0) > 0 ? <span className="muted" style={{ fontSize: 12 }}>More actions:</span> : null}
            <SelectKeeper
              value={presetIndex}
              onChange={(v) => setPresetIndex(v)}
              emptyValueLabel={(scheme.components?.length ?? 0) === 0 ? 'Choose preset…' : 'Apply preset / Replace components…'}
              options={PRESETS.map((p, i) => ({ value: String(i), label: p.label }))}
            />
            <button
              type="button"
              className={(scheme.components?.length ?? 0) === 0 ? 'btn' : 'btn secondary'}
              disabled={presetIndex === '' || applyPreset.isPending}
              onClick={() => {
                const idx = Number(presetIndex);
                if (!Number.isFinite(idx) || !PRESETS[idx]) return;
                if ((scheme.components?.length ?? 0) > 0 && !window.confirm('This will replace existing components. Continue?')) return;
                applyPreset.mutate(PRESETS[idx]);
              }}
            >
              {applyPreset.isPending ? 'Applying...' : (scheme.components?.length ?? 0) === 0 ? 'Apply preset' : 'Replace components'}
            </button>
          </div>
        ) : null}
      </div>

      {!isReadOnly ? (
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>{editingComponentId == null ? 'Add Component' : 'Edit Component'}</div>
          <ComponentFormPanel
            form={componentForm}
            setForm={setComponentForm}
            currentComponents={scheme.components ?? []}
            editingComponentId={editingComponentId}
            disabled={saveComponent.isPending}
            onSave={() => saveComponent.mutate()}
            onCancel={() => {
              setEditingComponentId(null);
              setComponentForm(createEmptyComponent((scheme.components?.length ?? 0) + 1));
            }}
            saveLabel={editingComponentId == null ? 'Add Component' : 'Update Component'}
          />
        </div>
      ) : null}
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
          <SelectKeeper
            value={form.componentType}
            onChange={(v) => setForm((p) => ({ ...p, componentType: v as ComponentType }))}
            disabled={disabled}
            options={COMPONENT_TYPES.map((t) => ({ value: t, label: toDisplayLabel(t) }))}
          />
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
          <SelectKeeper
            value={form.calculationRule}
            onChange={(v) => {
              const nextRule = v as CalculationRule;
              setForm((p) => ({
                ...p,
                calculationRule: nextRule,
                totalAssessments: nextRule === 'SINGLE_ASSESSMENT' ? '1' : p.totalAssessments,
              }));
            }}
            disabled={disabled}
            options={CALCULATION_RULES.map((r) => ({ value: r, label: toDisplayLabel(r) }))}
          />
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

// ─────────────────────────── Instance status helpers ────────────────────────

function instanceStatusLevel(status: AssessmentInstanceStatus): StatusLevel {
  switch (status) {
    case 'DRAFT': return 'idle';
    case 'SCHEDULED': return 'info';
    case 'MARKS_ENTRY_OPEN': return 'warn';
    case 'MARKS_SUBMITTED': return 'warn';
    case 'LOCKED': return 'ok';
    case 'PUBLISHED': return 'ok';
    case 'CANCELLED': return 'error';
  }
}

function instanceStatusLabel(status: AssessmentInstanceStatus): string {
  switch (status) {
    case 'DRAFT': return 'Draft';
    case 'SCHEDULED': return 'Scheduled';
    case 'MARKS_ENTRY_OPEN': return 'Marks Open';
    case 'MARKS_SUBMITTED': return 'Submitted';
    case 'LOCKED': return 'Locked';
    case 'PUBLISHED': return 'Published';
    case 'CANCELLED': return 'Cancelled';
  }
}

function menuItemStyle(color?: string): React.CSSProperties {
  return {
    display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13,
    background: 'none', border: 'none', cursor: 'pointer',
    color: color ?? '#0f172a', whiteSpace: 'nowrap',
  };
}

// ─────────────────────���───────── Exam Schedule Panel ────────────────────────────────

function ExamSchedulePanel({
  schemes,
  classGroups,
  subjects,
  academicYears,
}: {
  schemes: AssessmentScheme[];
  classGroups: ClassGroup[];
  subjects: SubjectLite[];
  academicYears: AcademicYear[];
}) {
  const qc = useQueryClient();

  const [filterAcademicYearId, setFilterAcademicYearId] = useState('');
  const [filterSchemeStatus, setFilterSchemeStatus] = useState<'' | 'PUBLISHED' | 'ARCHIVED'>('');
  const [filterSchemeId, setFilterSchemeId] = useState('');
  const [filterClassGroupId, setFilterClassGroupId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [panelMode, setPanelMode] = useState<'none' | 'create' | 'generate'>('none');
  const [editingInstance, setEditingInstance] = useState<AssessmentInstance | null>(null);
  const [viewMode, setViewMode] = useState<'class' | 'flat'>('class');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [lastGenerateResult, setLastGenerateResult] = useState<ExamScheduleGenerateResponse | null>(null);

  const serverQs = useMemo(() => {
    const p = new URLSearchParams();
    if (filterAcademicYearId) p.set('academicYearId', filterAcademicYearId);
    if (filterSchemeId) p.set('schemeId', filterSchemeId);
    if (filterClassGroupId) p.set('classGroupId', filterClassGroupId);
    if (filterSubjectId) p.set('subjectId', filterSubjectId);
    return p.toString();
  }, [filterAcademicYearId, filterSchemeId, filterClassGroupId, filterSubjectId]);

  const assessmentsQ = useQuery({
    queryKey: ['exam-assessments', filterAcademicYearId, filterSchemeId, filterClassGroupId, filterSubjectId],
    queryFn: async () => (await api.get<AssessmentInstance[]>(`/api/exams/assessments?${serverQs}`)).data,
  });

  const roomsQ = useQuery({
    queryKey: ['rooms-exams'],
    enabled: panelMode === 'create' || editingInstance != null,
    queryFn: async () => pageContent((await api.get<SpringPage<RoomLite> | RoomLite[]>('/api/rooms?size=500')).data),
  });

  const assessments = useMemo(() => {
    let list = assessmentsQ.data ?? [];
    if (filterStatus) list = list.filter((a) => a.status === filterStatus);
    if (filterDateFrom) list = list.filter((a) => !!a.assessmentDate && a.assessmentDate >= filterDateFrom);
    if (filterDateTo) list = list.filter((a) => !!a.assessmentDate && a.assessmentDate <= filterDateTo);
    return list;
  }, [assessmentsQ.data, filterStatus, filterDateFrom, filterDateTo]);

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => (await api.post<AssessmentInstance>(`/api/exams/assessments/${id}/cancel`)).data,
    onSuccess: async () => { toast.success('Assessment cancelled'); await qc.invalidateQueries({ queryKey: ['exam-assessments'] }); },
    onError: (e) => toast.error('Could not cancel', formatApiError(e)),
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => (await api.post<AssessmentInstance>(`/api/exams/assessments/${id}/publish`)).data,
    onSuccess: async () => { toast.success('Assessment scheduled/published'); await qc.invalidateQueries({ queryKey: ['exam-assessments'] }); },
    onError: (e) => toast.error('Could not publish', formatApiError(e)),
  });

  const cloneMutation = useMutation({
    mutationFn: async (id: number) => (await api.post<AssessmentInstance>(`/api/exams/assessments/${id}/clone`)).data,
    onSuccess: async () => { toast.success('Assessment cloned as draft'); await qc.invalidateQueries({ queryKey: ['exam-assessments'] }); },
    onError: (e) => toast.error('Could not clone', formatApiError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/exams/assessments/${id}`),
    onSuccess: async () => { toast.success('Draft deleted'); await qc.invalidateQueries({ queryKey: ['exam-assessments'] }); },
    onError: (e) => toast.error('Could not delete', formatApiError(e)),
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 0) throw new Error('No draft assessments to publish');
      return (await api.post<ExamBulkPublishResult>('/api/exams/schedule/bulk-publish', { assessmentIds: ids })).data;
    },
    onSuccess: async (data) => {
      toast.success(
        'Bulk publish complete',
        `${data.publishedCount} scheduled.${data.failedCount > 0 ? ` ${data.failedCount} failed (missing date/time/marks).` : ''}`,
      );
      await qc.invalidateQueries({ queryKey: ['exam-assessments'] });
    },
    onError: (e) => toast.error('Bulk publish failed', formatApiError(e)),
  });

  const onRefresh = async () => { await qc.invalidateQueries({ queryKey: ['exam-assessments'] }); };

  const allData = assessmentsQ.data ?? [];
  const draftCount = allData.filter((a) => a.status === 'DRAFT').length;
  const scheduledCount = allData.filter((a) => a.status === 'SCHEDULED').length;
  const activeCount = allData.filter((a) => ['MARKS_ENTRY_OPEN','MARKS_SUBMITTED','LOCKED','PUBLISHED'].includes(a.status)).length;
  const cancelledCount = allData.filter((a) => a.status === 'CANCELLED').length;
  const missingDateCount = assessments.filter((a) => !a.assessmentDate && a.status !== 'CANCELLED').length;

  const draftIdsInView = assessments.filter((a) => a.status === 'DRAFT').map((a) => a.id);

  const STATUS_OPTIONS: AssessmentInstanceStatus[] = ['DRAFT', 'SCHEDULED', 'MARKS_ENTRY_OPEN', 'MARKS_SUBMITTED', 'LOCKED', 'PUBLISHED', 'CANCELLED'];
  const publishedSchemes = schemes.filter((s) => s.status === 'PUBLISHED');

  const filteredSchemeOptions = useMemo(() => {
    if (!filterSchemeStatus) return schemes;
    return schemes.filter((s) => s.status === filterSchemeStatus);
  }, [schemes, filterSchemeStatus]);

  // Build a classGroupId → ClassGroup lookup for grade resolution
  const classGroupById = useMemo(() => {
    const m = new Map<number, ClassGroup>();
    for (const cg of classGroups) m.set(cg.id, cg);
    return m;
  }, [classGroups]);

  type GradeSection = { classGroupId: number; sectionLabel: string; items: AssessmentInstance[] };
  type GradeEntry = {
    gradeKey: string;
    gradeLabel: string;
    gradeLevel: number | null;
    sections: GradeSection[];
    allItems: AssessmentInstance[];
  };

  // Class-wise grouping: grade-level → sections → items
  const classwiseGroups = useMemo((): GradeEntry[] => {
    // Build per-section data
    const sectionMap = new Map<number, GradeSection>();
    for (const a of assessments) {
      if (!sectionMap.has(a.classGroupId)) {
        sectionMap.set(a.classGroupId, { classGroupId: a.classGroupId, sectionLabel: a.classGroupLabel, items: [] });
      }
      sectionMap.get(a.classGroupId)!.items.push(a);
    }
    // Group sections by grade level
    const gradeMap = new Map<string, GradeEntry>();
    for (const [classGroupId, section] of sectionMap.entries()) {
      const cg = classGroupById.get(classGroupId);
      const gradeLevel = cg?.gradeLevel ?? null;
      const gradeKey = gradeLevel != null ? `g:${gradeLevel}` : `g:${classGroupId}`;
      const gradeLabel = gradeLevel != null ? `Class ${gradeLevel}` : (cg?.displayName ?? section.sectionLabel);
      if (!gradeMap.has(gradeKey)) {
        gradeMap.set(gradeKey, { gradeKey, gradeLabel, gradeLevel, sections: [], allItems: [] });
      }
      const grade = gradeMap.get(gradeKey)!;
      grade.sections.push(section);
      grade.allItems.push(...section.items);
    }
    // Sort sections within each grade by label
    for (const grade of gradeMap.values()) {
      grade.sections.sort((a, b) => a.sectionLabel.localeCompare(b.sectionLabel));
    }
    // Sort grades by level
    return Array.from(gradeMap.values()).sort((a, b) => {
      if (a.gradeLevel != null && b.gradeLevel != null) return a.gradeLevel - b.gradeLevel;
      if (a.gradeLevel != null) return -1;
      if (b.gradeLevel != null) return 1;
      return a.gradeLabel.localeCompare(b.gradeLabel);
    });
  }, [assessments, classGroupById]);

  const toggleKey = (key: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const keys = new Set<string>();
    for (const grade of classwiseGroups) {
      keys.add(grade.gradeKey);
      for (const s of grade.sections) keys.add(`s:${s.classGroupId}`);
    }
    setExpandedClasses(keys);
  };
  const collapseAll = () => setExpandedClasses(new Set());

  const [menuRect, setMenuRect] = useState<{ id: number; rect: DOMRect } | null>(null);

  const renderInstanceRow = (a: AssessmentInstance) => {
    const isDraft = a.status === 'DRAFT';
    const isScheduled = a.status === 'SCHEDULED';
    const isActive = ['MARKS_ENTRY_OPEN','MARKS_SUBMITTED','LOCKED','PUBLISHED'].includes(a.status);
    const isCancelled = a.status === 'CANCELLED';
    const canEdit = isDraft || isScheduled;
    const canPublish = isDraft;
    const canCancel = isDraft || isScheduled;
    const canClone = isScheduled || isActive || isCancelled;
    const canDelete = isDraft || isCancelled;
    const hasMenu = canPublish || canClone || canCancel || canDelete;
    const timeStr = a.startTime ? (a.endTime ? `${a.startTime.slice(0,5)}–${a.endTime.slice(0,5)}` : a.startTime.slice(0,5)) : '';
    const isMenuOpen = menuRect?.id === a.id;
    return (
      <tr key={a.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: !a.assessmentDate && a.status !== 'CANCELLED' ? 'rgba(251,191,36,0.05)' : undefined }}>
        <td style={{ padding: '7px 8px', fontWeight: 700, fontSize: 13 }}>{a.name}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, color: '#475569' }}>{a.componentName}</td>
        <td style={{ padding: '7px 8px', fontSize: 12, color: '#475569' }}>{a.schemeName}</td>
        <td style={{ padding: '7px 8px', fontSize: 12 }}>{a.subjectName}</td>
        <td style={{ padding: '7px 8px', whiteSpace: 'nowrap', fontSize: 12 }}>
          {a.assessmentDate ? (
            <div><div>{a.assessmentDate}</div>{timeStr && <div className="muted" style={{ fontSize: 11 }}>{timeStr}</div>}</div>
          ) : <span style={{ color: '#f59e0b', fontWeight: 700 }}>Missing</span>}
        </td>
        <td style={{ padding: '7px 8px', fontSize: 12 }}>{a.roomLabel ?? <span className="muted">—</span>}</td>
        <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 12 }}>{a.maxMarks > 0 ? a.maxMarks : <span style={{ color: '#f59e0b' }}>—</span>}</td>
        <td style={{ padding: '7px 8px' }}>
          <StatusChip level={instanceStatusLevel(a.status)} label={instanceStatusLabel(a.status)} />
        </td>
        <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => { setEditingInstance(a); setPanelMode('none'); }}>
              {canEdit ? 'Edit' : 'View'}
            </button>
            {hasMenu && (
              <>
                <button type="button"
                  style={{ background: 'none', border: '1.5px solid rgba(15,23,42,0.15)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: '#64748b' }}
                  onClick={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setMenuRect((prev) => prev?.id === a.id ? null : { id: a.id, rect }); }}
                  title="More actions">⋯</button>
                {isMenuOpen && createPortal(
                  <div style={{ position: 'fixed', top: Math.max(8, menuRect!.rect.bottom + 6), right: Math.max(8, window.innerWidth - menuRect!.rect.right), zIndex: 9999, background: '#fff', border: '1.5px solid rgba(15,23,42,0.12)', borderRadius: 10, boxShadow: '0 8px 30px rgba(15,23,42,0.14)', padding: '4px 0', minWidth: 172 }}>
                    {canPublish && <button type="button" style={menuItemStyle('#065f46')} disabled={publishMutation.isPending} onClick={() => { publishMutation.mutate(a.id); setMenuRect(null); }}>✓ Publish / Schedule</button>}
                    {canClone && <button type="button" style={menuItemStyle()} disabled={cloneMutation.isPending} onClick={() => { cloneMutation.mutate(a.id); setMenuRect(null); }}>⎘ Clone as Draft</button>}
                    {canCancel && <button type="button" style={menuItemStyle('#b45309')} disabled={cancelMutation.isPending} onClick={() => { cancelMutation.mutate(a.id); setMenuRect(null); }}>✕ Cancel</button>}
                    {canDelete && <button type="button" style={menuItemStyle('#b91c1c')} disabled={deleteMutation.isPending} onClick={() => { deleteMutation.mutate(a.id); setMenuRect(null); }}>🗑 Delete Draft</button>}
                  </div>,
                  document.body
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* Header */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900 }}>Exam Schedule</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              Schedule exams from published assessment schemes or create manually.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => { setPanelMode(panelMode === 'generate' ? 'none' : 'generate'); setEditingInstance(null); setLastGenerateResult(null); }}
            >
              {panelMode === 'generate' ? 'Close' : 'Generate from Scheme'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => { setPanelMode(panelMode === 'create' ? 'none' : 'create'); setEditingInstance(null); }}
            >
              {panelMode === 'create' ? 'Close form' : '+ Schedule Assessment'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {allData.length > 0 && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
          {[
            { label: 'Total', value: allData.length, bg: '#eff6ff', color: '#1d4ed8' },
            { label: 'Drafts', value: draftCount, bg: '#fef3c7', color: '#92400e' },
            { label: 'Scheduled', value: scheduledCount, bg: '#d1fae5', color: '#065f46' },
            { label: 'In Progress', value: activeCount, bg: '#ede9fe', color: '#4338ca' },
            { label: 'Missing Dates', value: missingDateCount, bg: missingDateCount > 0 ? '#fff7ed' : '#f1f5f9', color: missingDateCount > 0 ? '#c2410c' : '#475569' },
            { label: 'Cancelled', value: cancelledCount, bg: cancelledCount > 0 ? '#fee2e2' : '#f1f5f9', color: cancelledCount > 0 ? '#991b1b' : '#475569' },
          ].map((c) => (
            <div key={c.label} style={{ background: c.bg, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: c.color, marginTop: 2 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Inline panels */}
      {panelMode === 'create' && editingInstance == null ? (
        <CreateAssessmentForm
          publishedSchemes={publishedSchemes}
          classGroups={classGroups}
          subjects={subjects}
          rooms={roomsQ.data ?? []}
          onSuccess={async () => { setPanelMode('none'); await onRefresh(); }}
          onCancel={() => setPanelMode('none')}
        />
      ) : null}

      {panelMode === 'generate' ? (
        <GenerateFromSchemePanel
          academicYears={academicYears}
          onSuccess={async (result) => {
            setLastGenerateResult(result);
            setPanelMode('none');
            await onRefresh();
          }}
          onCancel={() => setPanelMode('none')}
        />
      ) : null}

      {/* Last generation result summary */}
      {lastGenerateResult != null && panelMode === 'none' && (
        <div className="card" style={{ padding: 12, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.04)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#065f46' }}>
                ✓ Draft schedule generated — {lastGenerateResult.generatedCount} exam{lastGenerateResult.generatedCount === 1 ? '' : 's'} created
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Skipped (already existed): {lastGenerateResult.skippedCount} ·
                Missing scheme: {lastGenerateResult.missingSchemeCount} ·
                Not schedulable: {lastGenerateResult.notSchedulableCount}
                {lastGenerateResult.scheduleGroupId ? ` · Group: ${lastGenerateResult.scheduleGroupId}` : ''}
              </div>
              {lastGenerateResult.warnings.length > 0 && (
                <ul style={{ margin: '6px 0 0 0', padding: '0 0 0 16px', fontSize: 11, color: '#c2410c' }}>
                  {lastGenerateResult.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                  {lastGenerateResult.warnings.length > 5 && <li>…and {lastGenerateResult.warnings.length - 5} more</li>}
                </ul>
              )}
            </div>
            <button type="button" className="btn secondary" style={{ fontSize: 12 }}
              onClick={() => setLastGenerateResult(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {editingInstance != null ? (
        <EditAssessmentForm
          instance={editingInstance}
          rooms={roomsQ.data ?? []}
          onSuccess={async () => { setEditingInstance(null); await onRefresh(); }}
          onCancel={() => setEditingInstance(null)}
        />
      ) : null}

      {/* Filters */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Academic year</span>
            <SmartSelect value={filterAcademicYearId} onChange={setFilterAcademicYearId}
              options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))}
              placeholder="All years" allowClear />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scheme</span>
            <div className="stack" style={{ gap: 4 }}>
              <div className="row" style={{ gap: 4 }}>
                {(['', 'PUBLISHED', 'ARCHIVED'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setFilterSchemeStatus(v); setFilterSchemeId(''); }}
                    style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(15,23,42,0.2)', cursor: 'pointer',
                      background: filterSchemeStatus === v ? '#0f172a' : 'transparent',
                      color: filterSchemeStatus === v ? '#fff' : 'inherit',
                      fontWeight: filterSchemeStatus === v ? 700 : 400,
                    }}
                  >
                    {v === '' ? 'All' : v === 'PUBLISHED' ? 'Published' : 'Archived'}
                  </button>
                ))}
              </div>
              <SmartSelect value={filterSchemeId} onChange={setFilterSchemeId}
                options={filteredSchemeOptions.map((s) => ({ value: String(s.id), label: s.name, meta: s.status === 'PUBLISHED' ? 'Published' : s.status === 'ARCHIVED' ? 'Archived' : 'Draft' }))}
                placeholder="All schemes" allowClear searchable />
            </div>
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class / Section</span>
            <SmartSelect
              value={filterClassGroupId}
              onChange={setFilterClassGroupId}
              options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
              placeholder="All classes" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
            <SmartSelect
              value={filterSubjectId}
              onChange={setFilterSubjectId}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} – ${s.name}` : s.name }))}
              placeholder="All subjects"
              allowClear
              searchable
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Status</span>
            <SelectKeeper
              value={filterStatus}
              onChange={setFilterStatus}
              emptyValueLabel="All statuses"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: instanceStatusLabel(s) }))}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>From date</span>
            <DateKeeper value={filterDateFrom} onChange={setFilterDateFrom} emptyLabel="Any" clearable />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>To date</span>
            <DateKeeper value={filterDateTo} onChange={setFilterDateTo} emptyLabel="Any" clearable />
          </label>
        </div>
      </div>

      {/* View mode toggle + bulk actions */}
      {allData.length > 0 && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="row" style={{ gap: 4 }}>
            {(['class', 'flat'] as const).map((m) => (
              <button key={m} type="button"
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.2)', cursor: 'pointer', background: viewMode === m ? '#0f172a' : 'transparent', color: viewMode === m ? '#fff' : '#0f172a', fontWeight: viewMode === m ? 700 : 400 }}
                onClick={() => setViewMode(m)}>
                {m === 'class' ? 'Class View' : 'Flat Table'}
              </button>
            ))}
          </div>
          {viewMode === 'class' && (
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={expandAll}>Expand All</button>
              <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={collapseAll}>Collapse All</button>
            </div>
          )}
          {draftIdsInView.length > 0 && (
            <button
              type="button"
              className="btn"
              style={{ fontSize: 11, padding: '3px 12px', background: '#065f46', color: '#fff' }}
              disabled={bulkPublishMutation.isPending}
              onClick={() => bulkPublishMutation.mutate(draftIdsInView)}
              title={`Publish all ${draftIdsInView.length} draft exam${draftIdsInView.length === 1 ? '' : 's'} in current view (must have date, time, and max marks)`}
            >
              {bulkPublishMutation.isPending ? 'Publishing…' : `Publish Schedule (${draftIdsInView.length} draft${draftIdsInView.length === 1 ? '' : 's'})`}
            </button>
          )}
          <span className="muted" style={{ fontSize: 12 }}>{assessments.length} assessment{assessments.length === 1 ? '' : 's'}</span>
        </div>
      )}

      {/* Schedule content */}
      {assessmentsQ.isLoading ? (
        <div className="muted" style={{ padding: 16 }}>Loading…</div>
      ) : assessmentsQ.isError ? (
        <div style={{ color: '#b91c1c', padding: 16 }}>Failed to load assessments.</div>
      ) : assessments.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
            {allData.length === 0
              ? 'No exams scheduled yet. Generate schedules from published assessment schemes or schedule an assessment manually.'
              : 'No assessments match the current filters.'}
          </div>
          {allData.length === 0 && (
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button type="button" className="btn secondary" onClick={(e) => { e.stopPropagation(); setPanelMode('generate'); setEditingInstance(null); }}>
                Generate from Scheme
              </button>
              <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setPanelMode('create'); setEditingInstance(null); }}>
                + Schedule Assessment
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'flat' ? (
        /* ── Flat table view ── */
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                  {['Assessment', 'Component', 'Scheme', 'Subject', 'Date & Time', 'Room', 'Max Marks', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '8px 8px', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{assessments.map(renderInstanceRow)}</tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Class-wise grouped view (grade → section → component → subject) ── */
        <div className="stack" style={{ gap: 8 }}>
          <div className="muted" style={{ fontSize: 11, padding: '2px 0' }}>
            Schedules are generated from published assessment schemes. Class, section, and subject overrides are applied automatically.
          </div>
          {classwiseGroups.map((grade) => {
            const isGradeExpanded = expandedClasses.has(grade.gradeKey);
            const allItems = grade.allItems;
            const missingDates = allItems.filter((a) => !a.assessmentDate && a.status !== 'CANCELLED').length;
            const draftItems = allItems.filter((a) => a.status === 'DRAFT').length;
            const scheduledItems = allItems.filter((a) => a.status === 'SCHEDULED').length;
            const subjectCount = new Set(allItems.map((a) => a.subjectId)).size;
            const sectionCount = grade.sections.length;
            return (
              <div key={grade.gradeKey} className="card" style={{ border: '1px solid rgba(15,23,42,0.1)', padding: 0, overflow: 'hidden' }}>
                {/* Grade summary row */}
                <button type="button"
                  style={{ width: '100%', background: isGradeExpanded ? 'rgba(15,23,42,0.04)' : '#fff', border: 'none', cursor: 'pointer', padding: '12px 14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
                  onClick={() => toggleKey(grade.gradeKey)}>
                  <span style={{ fontSize: 16 }}>{isGradeExpanded ? '▾' : '▸'}</span>
                  <span style={{ fontWeight: 900, fontSize: 15, flex: 1 }}>{grade.gradeLabel}</span>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
                    <span>{sectionCount} section{sectionCount === 1 ? '' : 's'}</span>
                    <span>{subjectCount} subject{subjectCount === 1 ? '' : 's'}</span>
                    <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{allItems.length} exam{allItems.length === 1 ? '' : 's'}</span>
                    {missingDates > 0 && <span style={{ fontWeight: 700, color: '#c2410c' }}>{missingDates} missing date{missingDates === 1 ? '' : 's'}</span>}
                    {draftItems > 0 && <StatusChip level="warn" label={`${draftItems} draft`} />}
                    {scheduledItems > 0 && <StatusChip level="ok" label={`${scheduledItems} scheduled`} />}
                  </div>
                </button>
                {isGradeExpanded && (
                  <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                    {grade.sections.map((section) => {
                      const isSectionExpanded = expandedClasses.has(`s:${section.classGroupId}`);
                      const sItems = section.items;
                      const sMissing = sItems.filter((a) => !a.assessmentDate && a.status !== 'CANCELLED').length;
                      const byComponent = new Map<string, { componentName: string; schemeName: string; items: AssessmentInstance[] }>();
                      for (const a of sItems) {
                        const key = `${a.componentId}`;
                        if (!byComponent.has(key)) byComponent.set(key, { componentName: a.componentName, schemeName: a.schemeName, items: [] });
                        byComponent.get(key)!.items.push(a);
                      }
                      return (
                        <div key={section.classGroupId} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                          {/* Section header */}
                          <button type="button"
                            style={{ width: '100%', background: isSectionExpanded ? 'rgba(15,23,42,0.03)' : 'transparent', border: 'none', cursor: 'pointer', padding: '8px 14px 8px 28px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                            onClick={() => toggleKey(`s:${section.classGroupId}`)}>
                            <span style={{ fontSize: 14 }}>{isSectionExpanded ? '▾' : '▸'}</span>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{section.sectionLabel}</span>
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
                              <span>{sItems.length} exam{sItems.length === 1 ? '' : 's'}</span>
                              {sMissing > 0 && <span style={{ color: '#c2410c', fontWeight: 600 }}>{sMissing} missing date{sMissing === 1 ? '' : 's'}</span>}
                            </div>
                          </button>
                          {isSectionExpanded && (
                            <div style={{ borderTop: '1px solid rgba(15,23,42,0.05)', padding: '0 0 8px' }}>
                              {Array.from(byComponent.entries()).map(([compKey, compGroup]) => (
                                <div key={compKey} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', marginBottom: 0 }}>
                                  <div style={{ padding: '8px 28px 4px', background: 'rgba(15,23,42,0.02)' }}>
                                    <span style={{ fontWeight: 800, fontSize: 12 }}>{compGroup.componentName}</span>
                                    <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>Scheme: {compGroup.schemeName}</span>
                                  </div>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.08)', background: 'rgba(15,23,42,0.01)' }}>
                                          {['Assessment', 'Subject', 'Date & Time', 'Room', 'Max Marks', 'Status', 'Actions'].map((h) => (
                                            <th key={h} style={{ padding: '5px 8px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
                                          ))}
                                        </tr>
                                        <tbody>{compGroup.items.map(renderInstanceRow)}</tbody>
                                      </thead>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Create Assessment Form ────────────────────────────

type AssessmentCreateForm = {
  schemeId: string; componentId: string; classGroupId: string; subjectId: string;
  name: string; assessmentDate: string; startTime: string; endTime: string;
  roomId: string; maxMarks: string; sequence: string;
};

function emptyCreateForm(): AssessmentCreateForm {
  return { schemeId: '', componentId: '', classGroupId: '', subjectId: '', name: '', assessmentDate: '', startTime: '', endTime: '', roomId: '', maxMarks: '', sequence: '1' };
}

function CreateAssessmentForm({
  publishedSchemes, classGroups, subjects, rooms, onSuccess, onCancel,
}: {
  publishedSchemes: AssessmentScheme[];
  classGroups: ClassGroup[];
  subjects: SubjectLite[];
  rooms: RoomLite[];
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AssessmentCreateForm>(emptyCreateForm);
  const set = <K extends keyof AssessmentCreateForm>(k: K, v: AssessmentCreateForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const selectedScheme = publishedSchemes.find((s) => String(s.id) === form.schemeId) ?? null;
  const availableComponents = (selectedScheme?.components ?? []).filter((c) => c.calculationRule !== 'ATTENDANCE_PERCENTAGE');
  const selectedComponent = availableComponents.find((c) => String(c.id) === form.componentId) ?? null;

  const roomOptions = rooms.map((r) => ({ value: String(r.id), label: `${r.buildingName ?? r.building} / ${r.roomNumber}` }));

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.schemeId || !form.componentId) throw new Error('Select scheme and component');
      if (!form.classGroupId) throw new Error('Select class / section');
      if (!form.subjectId) throw new Error('Select subject');
      if (!form.name.trim()) throw new Error('Assessment name is required');
      if (!form.maxMarks || Number(form.maxMarks) <= 0) throw new Error('Max marks must be > 0');
      return (await api.post<AssessmentInstance>('/api/exams/assessments', {
        schemeId: Number(form.schemeId),
        componentId: Number(form.componentId),
        classGroupId: Number(form.classGroupId),
        subjectId: Number(form.subjectId),
        name: form.name.trim(),
        assessmentDate: form.assessmentDate || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        roomId: form.roomId ? Number(form.roomId) : null,
        maxMarks: Number(form.maxMarks),
        sequence: Number(form.sequence) || 1,
      })).data;
    },
    onSuccess: async () => { toast.success('Assessment created'); setForm(emptyCreateForm()); await onSuccess(); },
    onError: (e) => toast.error('Could not create', formatApiError(e)),
  });

  return (
    <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Create Assessment</div>
      <div className="stack" style={{ gap: 10 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scheme (published)</span>
            <SmartSelect value={form.schemeId}
              onChange={(v) => setForm((p) => ({ ...p, schemeId: v, componentId: '', name: '', maxMarks: '' }))}
              options={publishedSchemes.map((s) => ({ value: String(s.id), label: s.name, meta: s.academicYearLabel ?? undefined }))}
              placeholder="Select scheme…" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Component</span>
            <SmartSelect value={form.componentId}
              onChange={(v) => {
                const comp = availableComponents.find((c) => String(c.id) === v);
                setForm((p) => ({
                  ...p, componentId: v,
                  maxMarks: comp?.maxMarks != null ? String(comp.maxMarks) : p.maxMarks,
                  name: comp?.calculationRule === 'SINGLE_ASSESSMENT' ? comp.name : p.name,
                }));
              }}
              options={availableComponents.map((c) => ({ value: String(c.id), label: c.name, meta: toDisplayLabel(c.componentType) }))}
              placeholder={form.schemeId ? 'Select component…' : 'Select scheme first'}
              disabled={!form.schemeId} allowClear />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class / Section</span>
            <SmartSelect value={form.classGroupId} onChange={(v) => set('classGroupId', v)}
              options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
              placeholder="Select class…" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
            <SmartSelect value={form.subjectId} onChange={(v) => set('subjectId', v)}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} – ${s.name}` : s.name }))}
              placeholder="Select subject…" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Assessment name</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder={selectedComponent ? selectedComponent.name : 'e.g. CA 1'} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Max marks</span>
            <input type="number" min={0.01} step="0.01" value={form.maxMarks}
              onChange={(e) => set('maxMarks', e.target.value)}
              placeholder={selectedComponent?.maxMarks != null ? String(selectedComponent.maxMarks) : '100'} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date (optional)</span>
            <DateKeeper value={form.assessmentDate} onChange={(v) => set('assessmentDate', v)} emptyLabel="Not set" clearable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Start time</span>
            <TimeKeeper value={form.startTime} onChange={(v) => set('startTime', v)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>End time</span>
            <TimeKeeper value={form.endTime} onChange={(v) => set('endTime', v)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Room (optional)</span>
            <SmartSelect value={form.roomId} onChange={(v) => set('roomId', v)}
              options={roomOptions} placeholder="No room" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Sequence</span>
            <input type="number" min={1} value={form.sequence} onChange={(e) => set('sequence', e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Creating…' : 'Create Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Edit Assessment Form ───────────────────────────────

type AssessmentEditForm = {
  name: string;
  assessmentDate: string; startTime: string; endTime: string;
  roomId: string; maxMarks: string; sequence: string; instructions: string;
};

function EditAssessmentForm({
  instance, rooms, onSuccess, onCancel,
}: {
  instance: AssessmentInstance;
  rooms: RoomLite[];
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AssessmentEditForm>({
    name: instance.name,
    assessmentDate: instance.assessmentDate ?? '',
    startTime: instance.startTime ?? '',
    endTime: instance.endTime ?? '',
    roomId: instance.roomId != null ? String(instance.roomId) : '',
    maxMarks: String(instance.maxMarks),
    sequence: String(instance.sequence),
    instructions: instance.instructions ?? '',
  });
  const set = <K extends keyof AssessmentEditForm>(k: K, v: AssessmentEditForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const roomOptions = rooms.map((r) => ({ value: String(r.id), label: `${r.buildingName ?? r.building} / ${r.roomNumber}` }));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!form.maxMarks || Number(form.maxMarks) <= 0) throw new Error('Max marks must be > 0');
      return (await api.put<AssessmentInstance>(`/api/exams/assessments/${instance.id}`, {
        name: form.name.trim() || instance.name,
        classGroupId: instance.classGroupId,
        subjectId: instance.subjectId,
        assessmentDate: form.assessmentDate || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        roomId: form.roomId ? Number(form.roomId) : null,
        maxMarks: Number(form.maxMarks),
        sequence: Number(form.sequence) || 1,
        instructions: form.instructions || null,
      })).data;
    },
    onSuccess: async () => { toast.success('Assessment updated'); await onSuccess(); },
    onError: (e) => toast.error('Could not update', formatApiError(e)),
  });

  return (
    <div className="card" style={{ padding: 12, border: '2px solid rgba(234,88,12,0.3)' }}>
      <div style={{ fontWeight: 900, marginBottom: 2 }}>Edit Assessment</div>
      {/* Read-only context info */}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 10, padding: '8px 10px', background: 'rgba(15,23,42,0.03)', borderRadius: 6 }}>
        <div><span className="muted" style={{ fontSize: 11, display: 'block', fontWeight: 700 }}>Class / Section</span><span style={{ fontSize: 13, fontWeight: 600 }}>{instance.classGroupLabel}</span></div>
        <div><span className="muted" style={{ fontSize: 11, display: 'block', fontWeight: 700 }}>Subject</span><span style={{ fontSize: 13, fontWeight: 600 }}>{instance.subjectName}</span></div>
        <div><span className="muted" style={{ fontSize: 11, display: 'block', fontWeight: 700 }}>Scheme</span><span style={{ fontSize: 12, color: '#475569' }}>{instance.schemeName}</span></div>
        <div><span className="muted" style={{ fontSize: 11, display: 'block', fontWeight: 700 }}>Component</span><span style={{ fontSize: 12, color: '#475569' }}>{instance.componentName}</span></div>
      </div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 10, fontStyle: 'italic' }}>
        Schedules are generated from published assessment schemes. Class, section, subject, and component are resolved automatically and cannot be changed.
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Assessment name</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Max marks *</span>
            <input type="number" min={0.01} step="0.01" value={form.maxMarks}
              onChange={(e) => set('maxMarks', e.target.value)}
              placeholder="100" />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date</span>
            <DateKeeper value={form.assessmentDate} onChange={(v) => set('assessmentDate', v)} emptyLabel="Not set" clearable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Start time</span>
            <TimeKeeper value={form.startTime} onChange={(v) => set('startTime', v)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>End time</span>
            <TimeKeeper value={form.endTime} onChange={(v) => set('endTime', v)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Room (optional)</span>
            <SmartSelect value={form.roomId} onChange={(v) => set('roomId', v)}
              options={roomOptions} placeholder="No room" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Sequence</span>
            <input type="number" min={1} value={form.sequence} onChange={(e) => set('sequence', e.target.value)} />
          </label>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Instructions (optional)</span>
          <textarea value={form.instructions} onChange={(e) => set('instructions', e.target.value)}
            rows={2} placeholder="Any special instructions for this exam…"
            style={{ resize: 'vertical', fontSize: 13 }} />
        </label>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Generate-from-Scheme Types ──────────────────────

type GenerateFromSchemeForm = {
  academicYearId: string;
  scheduleName: string;
  dateWindowFrom: string;
  dateWindowTo: string;
  defaultStartTime: string;
  defaultEndTime: string;
  roomStrategy: 'LEAVE_BLANK' | 'USE_HOMEROOM';
  dateStrategy: 'LEAVE_BLANK' | 'AUTO_DISTRIBUTE' | 'SAME_SUBJECT_DATE';
};

type ExamScheduleGenerateResponse = {
  scheduleGroupId: string;
  generatedCount: number;
  skippedCount: number;
  missingSchemeCount: number;
  notSchedulableCount: number;
  warnings: string[];
  instances: AssessmentInstance[];
};

type ExamBulkPublishResult = {
  publishedCount: number;
  failedCount: number;
  errors: string[];
  published: AssessmentInstance[];
};

// ─────────────────────────────── Legacy candidate types (kept for future) ────

type SmartGenForm = {
  academicYearId: string;
  componentType: string;
  coverageMode: 'ALL_APPLICABLE' | 'SELECTED';
  selectedClassSectionIds: string[];
  subjectMode: 'ALL_MAPPED' | 'SELECTED';
  selectedSubjectIds: string[];
  dateWindowFrom: string;
  dateWindowTo: string;
  defaultStartTime: string;
  defaultEndTime: string;
  roomStrategy: 'LEAVE_BLANK';
  maxMarksStrategy: 'USE_COMPONENT' | 'MANUAL';
  manualMaxMarks: string;
  dateDistributionMode: 'LEAVE_BLANK' | 'AUTO_DISTRIBUTE' | 'SAME_SUBJECT_DATE';
};

type ScheduleCandidate = {
  classGroupId: number;
  classGroupLabel: string;
  subjectId: number;
  subjectName: string;
  schemeId: number | null;
  schemeName: string | null;
  componentId: number | null;
  componentName: string | null;
  componentType: string | null;
  assessmentDate: string | null;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  maxMarks: number | null;
  validationStatus: 'OK' | 'NO_SCHEME' | 'NO_COMPONENT' | 'MISSING_MAX_MARKS';
  validationMessage: string | null;
  sequence: number;
};

type EditableCandidate = ScheduleCandidate & {
  _key: string;
  editDate: string;
  editStartTime: string;
  editEndTime: string;
  editMaxMarks: string;
  editRoomId: string;
  editName: string;
  selected: boolean;
};

function emptySmartGenForm(): SmartGenForm {
  return {
    academicYearId: '',
    componentType: '',
    coverageMode: 'ALL_APPLICABLE',
    selectedClassSectionIds: [],
    subjectMode: 'ALL_MAPPED',
    selectedSubjectIds: [],
    dateWindowFrom: '',
    dateWindowTo: '',
    defaultStartTime: '',
    defaultEndTime: '',
    roomStrategy: 'LEAVE_BLANK',
    maxMarksStrategy: 'USE_COMPONENT',
    manualMaxMarks: '',
    dateDistributionMode: 'LEAVE_BLANK',
  };
}

function candidateToEditable(c: ScheduleCandidate, idx: number): EditableCandidate {
  return {
    ...c,
    _key: `${c.classGroupId}-${c.subjectId}-${c.componentId}-${c.sequence}-${idx}`,
    editDate: c.assessmentDate ?? '',
    editStartTime: c.defaultStartTime ?? '',
    editEndTime: c.defaultEndTime ?? '',
    editMaxMarks: c.maxMarks != null ? String(c.maxMarks) : '',
    editRoomId: '',
    editName: c.componentName
      ? (c.sequence > 1 ? `${c.componentName} ${c.sequence}` : c.componentName)
      : '',
    selected: c.validationStatus === 'OK',
  };
}

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  CONTINUOUS_ASSESSMENT: 'Continuous Assessment (CA)',
  MID_TERM: 'Mid Term',
  END_TERM: 'End Term',
  PRACTICAL: 'Practical',
  PROJECT: 'Project',
  ASSIGNMENT: 'Assignment',
  ATTENDANCE: 'Attendance',
  NOTEBOOK: 'Notebook',
  VIVA: 'Viva',
  OTHER: 'Other',
};

// ─────────────────────────────── Generate from Scheme Panel ──────────────────

/**
 * The primary "Generate from Scheme" panel.
 * Admin only provides scheduling-level inputs.
 * The backend automatically resolves scheme/component/class/section/subject via the
 * override hierarchy (Section+Subject > Class+Subject > Section > Class > School-wide).
 */
function GenerateFromSchemePanel({
  academicYears,
  onSuccess,
  onCancel,
}: {
  academicYears: AcademicYear[];
  onSuccess: (result: ExamScheduleGenerateResponse) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<GenerateFromSchemeForm>({
    academicYearId: '',
    scheduleName: '',
    dateWindowFrom: '',
    dateWindowTo: '',
    defaultStartTime: '',
    defaultEndTime: '',
    roomStrategy: 'LEAVE_BLANK',
    dateStrategy: 'LEAVE_BLANK',
  });
  const setF = <K extends keyof GenerateFromSchemeForm>(k: K, v: GenerateFromSchemeForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!form.academicYearId) throw new Error('Select an academic year');
      if (!form.scheduleName.trim()) throw new Error('Schedule name is required');
      return (await api.post<ExamScheduleGenerateResponse>('/api/exams/schedule/generate-from-schemes', {
        academicYearId: Number(form.academicYearId),
        scheduleName: form.scheduleName.trim(),
        dateWindowFrom: form.dateWindowFrom || null,
        dateWindowTo: form.dateWindowTo || null,
        defaultStartTime: form.defaultStartTime || null,
        defaultEndTime: form.defaultEndTime || null,
        roomStrategy: form.roomStrategy,
        dateStrategy: form.dateStrategy,
      })).data;
    },
    onSuccess: (data) => {
      toast.success(
        'Draft schedule generated',
        `${data.generatedCount} exam${data.generatedCount === 1 ? '' : 's'} created as drafts.` +
          (data.missingSchemeCount > 0 ? ` ${data.missingSchemeCount} class/subject combinations had no published scheme.` : '') +
          (data.skippedCount > 0 ? ` ${data.skippedCount} already existed and were skipped.` : ''),
      );
      onSuccess(data);
    },
    onError: (e) => toast.error('Generation failed', formatApiError(e)),
  });

  return (
    <div className="card" style={{ padding: 16, border: '1px solid rgba(15,23,42,0.12)' }}>
      <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>Generate from Scheme</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
        Schedules are generated from published assessment schemes. Class, section, and subject overrides are applied automatically.
        Only components where <em>requiresScheduling = true</em> will be scheduled (attendance and calculated components are skipped).
      </div>

      <div className="stack" style={{ gap: 14 }}>
        {/* Academic Year + Schedule Name */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Academic Year *</span>
            <SmartSelect
              value={form.academicYearId}
              onChange={(v) => setF('academicYearId', v)}
              options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))}
              placeholder="Select academic year…"
              allowClear
            />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Schedule Name *</span>
            <input
              value={form.scheduleName}
              onChange={(e) => setF('scheduleName', e.target.value)}
              placeholder="e.g. Mid Term 2025-26"
            />
          </label>
        </div>

        {/* Date window */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date Window — From (optional)</span>
            <DateKeeper value={form.dateWindowFrom} onChange={(v) => setF('dateWindowFrom', v)} emptyLabel="Not set" clearable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date Window — To (optional)</span>
            <DateKeeper value={form.dateWindowTo} onChange={(v) => setF('dateWindowTo', v)} emptyLabel="Not set" clearable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Default Start Time (optional)</span>
            <TimeKeeper value={form.defaultStartTime} onChange={(v) => setF('defaultStartTime', v)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Default End Time (optional)</span>
            <TimeKeeper value={form.defaultEndTime} onChange={(v) => setF('defaultEndTime', v)} />
          </label>
        </div>

        {/* Room Strategy */}
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Room Strategy</span>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
            {([
              ['LEAVE_BLANK', 'Leave blank – assign rooms later'],
              ['USE_HOMEROOM', 'Use class homeroom if configured'],
            ] as const).map(([v, lbl]) => (
              <label key={v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" checked={form.roomStrategy === v} onChange={() => setF('roomStrategy', v)} />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        {/* Date Strategy */}
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date Strategy</span>
          <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
            {([
              ['LEAVE_BLANK', 'Leave dates blank – assign manually'],
              ['AUTO_DISTRIBUTE', 'Auto-distribute across date window'],
              ['SAME_SUBJECT_DATE', 'Same date per subject across all sections'],
            ] as const).map(([v, lbl]) => (
              <label key={v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" checked={form.dateStrategy === v} onChange={() => setF('dateStrategy', v)} />
                {lbl}
              </label>
            ))}
          </div>
          {form.dateStrategy !== 'LEAVE_BLANK' && (!form.dateWindowFrom || !form.dateWindowTo) && (
            <div style={{ color: '#c2410c', fontSize: 12 }}>
              ⚠ Set a date window above to use this strategy.
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? 'Generating…' : 'Generate Draft Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Smart Generate Panel (legacy, kept for candidate preview) ─────

function SmartGeneratePanel({
  academicYears,
  classGroups,
  subjects,
  rooms,
  onSuccess,
  onCancel,
}: {
  academicYears: AcademicYear[];
  classGroups: ClassGroup[];
  subjects: SubjectLite[];
  rooms: RoomLite[];
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'configure' | 'preview'>('configure');
  const [form, setForm] = useState<SmartGenForm>(emptySmartGenForm);
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [bulkDate, setBulkDate] = useState('');
  const [showBulkDatePicker, setShowBulkDatePicker] = useState(false);
  const setF = <K extends keyof SmartGenForm>(k: K, v: SmartGenForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const roomOptions = rooms.map((r) => ({ value: String(r.id), label: `${r.buildingName ?? r.building} / ${r.roomNumber}` }));

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!form.academicYearId) throw new Error('Select an academic year');
      if (!form.componentType) throw new Error('Select a component type');
      if (form.coverageMode === 'SELECTED' && form.selectedClassSectionIds.length === 0)
        throw new Error('Select at least one class/section');
      if (form.subjectMode === 'SELECTED' && form.selectedSubjectIds.length === 0)
        throw new Error('Select at least one subject');
      if (form.maxMarksStrategy === 'MANUAL' && (!form.manualMaxMarks || Number(form.manualMaxMarks) <= 0))
        throw new Error('Enter a valid max marks value');
      return (await api.post<ScheduleCandidate[]>('/api/exams/schedule/generate-candidates', {
        academicYearId: Number(form.academicYearId),
        componentType: form.componentType,
        coverageMode: form.coverageMode,
        selectedClassSectionIds: form.coverageMode === 'SELECTED' ? form.selectedClassSectionIds.map(Number) : null,
        subjectMode: form.subjectMode,
        selectedSubjectIds: form.subjectMode === 'SELECTED' ? form.selectedSubjectIds.map(Number) : null,
        dateWindowFrom: form.dateWindowFrom || null,
        dateWindowTo: form.dateWindowTo || null,
        defaultStartTime: form.defaultStartTime || null,
        defaultEndTime: form.defaultEndTime || null,
        roomStrategy: form.roomStrategy,
        maxMarksStrategy: form.maxMarksStrategy,
        manualMaxMarks: form.maxMarksStrategy === 'MANUAL' ? Number(form.manualMaxMarks) : null,
        dateDistributionMode: form.dateDistributionMode,
      })).data;
    },
    onSuccess: (data) => {
      setCandidates(data.map((c, i) => candidateToEditable(c, i)));
      setStep('preview');
    },
    onError: (e) => toast.error('Preview failed', formatApiError(e)),
  });

  const saveDraftsMutation = useMutation({
    mutationFn: async (rows: EditableCandidate[]) => {
      const valid = rows.filter((r) => r.selected && r.validationStatus === 'OK');
      if (valid.length === 0) throw new Error('No valid candidates selected');
      return (await api.post<AssessmentInstance[]>('/api/exams/schedule/bulk-save-drafts', {
        candidates: valid.map((r) => ({
          classGroupId: r.classGroupId,
          subjectId: r.subjectId,
          schemeId: r.schemeId,
          componentId: r.componentId,
          name: r.editName || r.componentName || 'Assessment',
          assessmentDate: r.editDate || null,
          startTime: r.editStartTime || null,
          endTime: r.editEndTime || null,
          roomId: r.editRoomId ? Number(r.editRoomId) : null,
          maxMarks: r.editMaxMarks ? Number(r.editMaxMarks) : null,
          sequence: r.sequence,
        })),
      })).data;
    },
    onSuccess: async (data) => {
      toast.success('Saved', `${data.length} draft assessment${data.length === 1 ? '' : 's'} created.`);
      await onSuccess();
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const updateCandidate = (key: string, patch: Partial<EditableCandidate>) => {
    setCandidates((prev) => prev.map((c) => (c._key === key ? { ...c, ...patch } : c)));
  };

  const toggleSelectAll = () => {
    const validKeys = new Set(candidates.filter((c) => c.validationStatus === 'OK').map((c) => c._key));
    const allSelected = candidates.filter((c) => validKeys.has(c._key)).every((c) => c.selected);
    setCandidates((prev) => prev.map((c) => validKeys.has(c._key) ? { ...c, selected: !allSelected } : c));
  };

  const applyBulkDate = () => {
    if (!bulkDate) return;
    setCandidates((prev) => prev.map((c) => c.selected && c.validationStatus === 'OK' ? { ...c, editDate: bulkDate } : c));
    setShowBulkDatePicker(false);
    setBulkDate('');
  };

  const selectedCount = candidates.filter((c) => c.selected && c.validationStatus === 'OK').length;
  const validCount = candidates.filter((c) => c.validationStatus === 'OK').length;
  const issueCount = candidates.filter((c) => c.validationStatus !== 'OK').length;

  if (step === 'configure') {
    return (
      <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.12)' }}>
        <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>Generate Exam Schedule</div>
        <div className="stack" style={{ gap: 14 }}>
          {/* Row 1: Academic year + Component type */}
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Academic Year *</span>
              <SmartSelect value={form.academicYearId} onChange={(v) => setF('academicYearId', v)}
                options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))}
                placeholder="Select academic year…" allowClear />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Component Type *</span>
              <SmartSelect value={form.componentType} onChange={(v) => setF('componentType', v)}
                options={Object.entries(COMPONENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                placeholder="Select component type…" allowClear />
            </label>
          </div>

          {/* Coverage */}
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Coverage</span>
            <div className="row" style={{ gap: 14 }}>
              {(['ALL_APPLICABLE', 'SELECTED'] as const).map((v) => (
                <label key={v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={form.coverageMode === v}
                    onChange={() => setF('coverageMode', v)} />
                  {v === 'ALL_APPLICABLE' ? 'All applicable classes/sections' : 'Limit to selected classes/sections'}
                </label>
              ))}
            </div>
            {form.coverageMode === 'SELECTED' && (
              <MultiSelectKeeper value={form.selectedClassSectionIds} onChange={(v) => setF('selectedClassSectionIds', v)}
                options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
                placeholder="Select classes/sections…" />
            )}
          </div>

          {/* Subject mode */}
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subjects</span>
            <div className="row" style={{ gap: 14 }}>
              {(['ALL_MAPPED', 'SELECTED'] as const).map((v) => (
                <label key={v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={form.subjectMode === v}
                    onChange={() => setF('subjectMode', v)} />
                  {v === 'ALL_MAPPED' ? 'All mapped subjects (from Academic Structure)' : 'Limit to selected subjects'}
                </label>
              ))}
            </div>
            {form.subjectMode === 'SELECTED' && (
              <MultiSelectKeeper value={form.selectedSubjectIds} onChange={(v) => setF('selectedSubjectIds', v)}
                options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} ${s.name}` : s.name }))}
                placeholder="Select subjects…" />
            )}
          </div>

          {/* Date window */}
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date window — From</span>
              <DateKeeper value={form.dateWindowFrom} onChange={(v) => setF('dateWindowFrom', v)} emptyLabel="Not set" clearable />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date window — To</span>
              <DateKeeper value={form.dateWindowTo} onChange={(v) => setF('dateWindowTo', v)} emptyLabel="Not set" clearable />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Default start time</span>
              <TimeKeeper value={form.defaultStartTime} onChange={(v) => setF('defaultStartTime', v)} />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Default end time</span>
              <TimeKeeper value={form.defaultEndTime} onChange={(v) => setF('defaultEndTime', v)} />
            </label>
          </div>

          {/* Max marks strategy */}
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Max Marks</span>
            <div className="row" style={{ gap: 14 }}>
              {(['USE_COMPONENT', 'MANUAL'] as const).map((v) => (
                <label key={v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={form.maxMarksStrategy === v} onChange={() => setF('maxMarksStrategy', v)} />
                  {v === 'USE_COMPONENT' ? 'Use component max marks' : 'Enter manually'}
                </label>
              ))}
            </div>
            {form.maxMarksStrategy === 'MANUAL' && (
              <input type="number" min={1} step="0.5" value={form.manualMaxMarks}
                onChange={(e) => setF('manualMaxMarks', e.target.value)}
                placeholder="e.g. 100" style={{ maxWidth: 160 }} />
            )}
          </div>

          {/* Date distribution */}
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Date Distribution</span>
            <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
              {([
                ['LEAVE_BLANK', 'Leave dates blank'],
                ['AUTO_DISTRIBUTE', 'Auto-distribute across date range'],
                ['SAME_SUBJECT_DATE', 'Same date per subject across sections'],
              ] as const).map(([v, lbl]) => (
                <label key={v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" checked={form.dateDistributionMode === v} onChange={() => setF('dateDistributionMode', v)} />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          <div className="muted" style={{ fontSize: 11 }}>
            The backend will automatically resolve the applicable published assessment scheme for each class/section–subject combination
            using the override hierarchy (Section+Subject &gt; Class+Subject &gt; Section &gt; Class &gt; School-wide).
          </div>

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn" disabled={previewMutation.isPending}
              onClick={() => previewMutation.mutate()}>
              {previewMutation.isPending ? 'Building preview…' : 'Preview Schedule →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.12)' }}>
        <div className="stack" style={{ gap: 10 }}>
          {/* Preview header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14 }}>
                Preview: {validCount} ready, {issueCount} with issues
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Review and edit before saving as drafts. Rows with issues will be skipped.
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn secondary" style={{ fontSize: 12 }} onClick={toggleSelectAll}>
                {candidates.filter((c) => c.validationStatus === 'OK').every((c) => c.selected) ? 'Deselect all' : 'Select all'}
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: 12 }}
                  disabled={selectedCount === 0}
                  onClick={() => setShowBulkDatePicker((v) => !v)}
                >
                  Set date for selected ({selectedCount})
                </button>
                {showBulkDatePicker && (
                  <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: '#fff', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 8, boxShadow: '0 4px 16px rgba(15,23,42,0.14)', padding: 12, minWidth: 200 }}>
                    <DateKeeper value={bulkDate} onChange={setBulkDate} emptyLabel="Select date" clearable />
                    <button type="button" className="btn" style={{ marginTop: 8, width: '100%', fontSize: 12 }} onClick={applyBulkDate} disabled={!bulkDate}>Apply to selected</button>
                  </div>
                )}
              </div>
              <button type="button" className="btn secondary" onClick={() => setStep('configure')}>← Back</button>
            </div>
          </div>

          {/* Candidates table */}
          <div style={{ overflowX: 'auto', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)', background: 'rgba(15,23,42,0.03)' }}>
                  <th style={{ padding: '6px 8px' }}>✓</th>
                  <th style={{ padding: '6px 8px', minWidth: 120 }}>Name</th>
                  <th style={{ padding: '6px 8px', minWidth: 100 }}>Class / Section</th>
                  <th style={{ padding: '6px 8px', minWidth: 100 }}>Subject</th>
                  <th style={{ padding: '6px 8px', minWidth: 100 }}>Scheme → Component</th>
                  <th style={{ padding: '6px 8px', minWidth: 110 }}>Date</th>
                  <th style={{ padding: '6px 8px', minWidth: 90 }}>Start–End Time</th>
                  <th style={{ padding: '6px 8px', minWidth: 120 }}>Room</th>
                  <th style={{ padding: '6px 8px', minWidth: 80 }}>Max Marks</th>
                  <th style={{ padding: '6px 8px', minWidth: 80 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const isOk = c.validationStatus === 'OK';
                  return (
                    <tr key={c._key} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: isOk ? undefined : 'rgba(220,38,38,0.04)' }}>
                      <td style={{ padding: '5px 8px' }}>
                        {isOk ? (
                          <input type="checkbox" checked={c.selected}
                            onChange={(e) => updateCandidate(c._key, { selected: e.target.checked })} />
                        ) : <span style={{ color: '#dc2626', fontSize: 13 }}>✗</span>}
                      </td>
                      <td style={{ padding: '5px 4px', minWidth: 120 }}>
                        {isOk ? (
                          <input value={c.editName} onChange={(e) => updateCandidate(c._key, { editName: e.target.value })}
                            style={{ width: '100%', fontSize: 12 }} />
                        ) : <span className="muted">{c.componentName ?? '—'}</span>}
                      </td>
                      <td style={{ padding: '5px 8px', fontSize: 12 }}>{c.classGroupLabel}</td>
                      <td style={{ padding: '5px 8px', fontSize: 12 }}>{c.subjectName}</td>
                      <td style={{ padding: '5px 8px', fontSize: 11, color: '#64748b' }}>
                        {c.schemeName ? (
                          <span>{c.schemeName}<br /><span style={{ fontWeight: 600, color: '#334155' }}>{c.componentName}</span></span>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: '5px 4px', minWidth: 110 }}>
                        {isOk ? (
                          <DateKeeper value={c.editDate} onChange={(v) => updateCandidate(c._key, { editDate: v })} emptyLabel="No date" clearable />
                        ) : <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: '5px 4px', minWidth: 90, whiteSpace: 'nowrap' }}>
                        {isOk ? (
                          <span className="muted" style={{ fontSize: 11 }}>
                            {c.editStartTime || '—'}{c.editEndTime ? `–${c.editEndTime}` : ''}
                          </span>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: '5px 4px', minWidth: 120 }}>
                        {isOk ? (
                          <SmartSelect value={c.editRoomId} onChange={(v) => updateCandidate(c._key, { editRoomId: v })}
                            options={roomOptions} placeholder="No room" allowClear searchable />
                        ) : <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: '5px 4px', minWidth: 80 }}>
                        {isOk ? (
                          <input type="number" min={0.01} step="0.5" value={c.editMaxMarks}
                            onChange={(e) => updateCandidate(c._key, { editMaxMarks: e.target.value })}
                            style={{ width: 70, fontSize: 12 }} />
                        ) : <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: '5px 8px' }}>
                        {isOk
                          ? <StatusChip level="ok" label="Ready" />
                          : <StatusChip level="error" label={c.validationStatus === 'NO_SCHEME' ? 'No Scheme' : c.validationStatus === 'NO_COMPONENT' ? 'No Component' : 'Missing Marks'} />}
                        {!isOk && c.validationMessage && (
                          <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>{c.validationMessage}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {issueCount > 0 && (
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Rows with issues cannot be saved. Resolve them in Assessment Schemes (publish applicable scheme or add the component type) and regenerate.
            </div>
          )}

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn"
              disabled={saveDraftsMutation.isPending || selectedCount === 0}
              onClick={() => saveDraftsMutation.mutate(candidates)}>
              {saveDraftsMutation.isPending ? 'Saving…' : `Save ${selectedCount} as Draft${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
    </div>
  );
}

// ─────────────────────────────── Marks Entry Panel ──────────────────────────────

function markStatusLevel(s: MarkStatus | null): StatusLevel {
  if (s === 'LOCKED') return 'ok';
  if (s === 'SUBMITTED') return 'info';
  return 'idle';
}

function MarksEntryPanel({
  classGroups,
  subjects,
  schemes,
}: {
  classGroups: ClassGroup[];
  subjects: SubjectLite[];
  schemes: AssessmentScheme[];
}) {
  const [filterClassGroupId, setFilterClassGroupId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterSchemeId, setFilterSchemeId] = useState('');
  const [filterStatus, setFilterStatus] = useState('MARKS_ENTRY_OPEN');
  const [enteringInstanceId, setEnteringInstanceId] = useState<number | null>(null);

  // Check if any published (SCHEDULED or beyond) assessments exist — gate for Marks Entry
  const publishedCheckQ = useQuery({
    queryKey: ['exam-assessments-published-check'],
    queryFn: async () =>
      (await api.get<AssessmentInstance[]>('/api/exams/assessments')).data,
    staleTime: 30_000,
  });
  const hasPublishedSchedule = (publishedCheckQ.data ?? []).some(
    (a) => ['SCHEDULED', 'MARKS_ENTRY_OPEN', 'MARKS_SUBMITTED', 'LOCKED', 'PUBLISHED'].includes(a.status),
  );

  const serverQs = useMemo(() => {
    const p = new URLSearchParams();
    if (filterClassGroupId) p.set('classGroupId', filterClassGroupId);
    if (filterSubjectId) p.set('subjectId', filterSubjectId);
    if (filterSchemeId) p.set('schemeId', filterSchemeId);
    return p.toString();
  }, [filterClassGroupId, filterSubjectId, filterSchemeId]);

  const assessmentsQ = useQuery({
    queryKey: ['exam-assessments-marks', filterClassGroupId, filterSubjectId, filterSchemeId],
    queryFn: async () => (await api.get<AssessmentInstance[]>(`/api/exams/assessments?${serverQs}`)).data,
  });

  const assessments = useMemo(() => {
    const list = assessmentsQ.data ?? [];
    if (!filterStatus) return list;
    return list.filter((a) => a.status === filterStatus);
  }, [assessmentsQ.data, filterStatus]);

  const STATUS_OPTIONS: AssessmentInstanceStatus[] = ['DRAFT', 'SCHEDULED', 'MARKS_ENTRY_OPEN', 'MARKS_SUBMITTED', 'LOCKED', 'PUBLISHED', 'CANCELLED'];

  if (enteringInstanceId != null) {
    return (
      <MarksEntrySheet
        instanceId={enteringInstanceId}
        onClose={() => setEnteringInstanceId(null)}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* Header */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div>
          <div style={{ fontWeight: 900 }}>Marks Entry</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Showing assessments where marks can be entered. Use "Publish / Schedule" on the Schedule tab to unlock marks entry.
          </div>
        </div>
      </div>

      {/* Dependency gate: no published schedule yet */}
      {!publishedCheckQ.isLoading && !hasPublishedSchedule && (
        <div className="card" style={{ padding: 16, border: '1.5px solid rgba(245,158,11,0.4)', background: 'rgba(254,243,199,0.5)', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>🔒 Marks Entry is locked</div>
          <div style={{ fontSize: 13, color: '#78350f' }}>
            No published exam schedules found. Go to the <strong>Exam Schedule</strong> tab, assign dates/times, and publish at least one schedule to unlock marks entry.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class / Section</span>
            <SmartSelect
              value={filterClassGroupId}
              onChange={setFilterClassGroupId}
              options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
              placeholder="All classes" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
            <SmartSelect
              value={filterSubjectId}
              onChange={setFilterSubjectId}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} – ${s.name}` : s.name }))}
              placeholder="All subjects" allowClear searchable
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scheme</span>
            <SmartSelect
              value={filterSchemeId}
              onChange={setFilterSchemeId}
              options={schemes.map((s) => ({ value: String(s.id), label: s.name }))}
              placeholder="All schemes" allowClear searchable
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Status</span>
            <SelectKeeper
              value={filterStatus}
              onChange={setFilterStatus}
              emptyValueLabel="All statuses"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: instanceStatusLabel(s) }))}
            />
          </label>
        </div>
      </div>

      {/* Assessments table */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        {assessmentsQ.isLoading ? (
          <div className="muted" style={{ padding: 12 }}>Loading…</div>
        ) : assessmentsQ.isError ? (
          <div style={{ color: '#b91c1c', padding: 12 }}>Failed to load assessments.</div>
        ) : assessments.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>
            No assessments found with the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                  {['Assessment', 'Scheme / Component', 'Class', 'Subject', 'Date', 'Max Marks', 'Status', 'Action'].map((h) => (
                    <th key={h} style={{ padding: '8px 6px', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700 }}>{a.name}</td>
                    <td style={{ padding: '8px 6px', fontSize: 12, color: '#475569' }}>
                      {a.schemeName}<br /><span style={{ fontWeight: 600, color: '#334155' }}>{a.componentName}</span>
                    </td>
                    <td style={{ padding: '8px 6px', fontSize: 12 }}>{a.classGroupLabel}</td>
                    <td style={{ padding: '8px 6px', fontSize: 12 }}>{a.subjectName}</td>
                    <td style={{ padding: '8px 6px', fontSize: 12 }}>{a.assessmentDate ?? <span className="muted">—</span>}</td>
                    <td style={{ padding: '8px 6px', fontSize: 12, textAlign: 'right' }}>{a.maxMarks}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <StatusChip level={instanceStatusLevel(a.status)} label={instanceStatusLabel(a.status)} />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 11, padding: '3px 10px' }}
                        onClick={() => setEnteringInstanceId(a.id)}
                      >
                        Enter Marks
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────── Marks Entry Sheet ──────────────────────────────

function MarksEntrySheet({ instanceId, onClose }: { instanceId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [localRows, setLocalRows] = useState<MarksEntryRowDTO[] | null>(null);

  const sheetQ = useQuery({
    queryKey: ['marks-sheet', instanceId],
    queryFn: async () => (await api.get<MarksEntrySheetDTO>(`/api/exams/marks/${instanceId}/sheet`)).data,
  });

  const rows = localRows ?? sheetQ.data?.rows ?? [];
  const sheet = sheetQ.data;

  const updateRow = (studentId: number, patch: Partial<MarksEntryRowDTO>) => {
    setLocalRows((prev) => (prev ?? sheetQ.data?.rows ?? []).map((r) => r.studentId === studentId ? { ...r, ...patch } : r));
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => (await api.post<MarksEntrySheetDTO>(`/api/exams/marks/${instanceId}/save-draft`, { rows })).data,
    onSuccess: async (data) => { setLocalRows(data.rows); toast.success('Draft saved'); await qc.invalidateQueries({ queryKey: ['marks-sheet', instanceId] }); },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const submitMutation = useMutation({
    mutationFn: async () => (await api.post<MarksEntrySheetDTO>(`/api/exams/marks/${instanceId}/submit`, { rows })).data,
    onSuccess: async (data) => { setLocalRows(data.rows); toast.success('Marks submitted'); await qc.invalidateQueries({ queryKey: ['marks-sheet', instanceId] }); },
    onError: (e) => toast.error('Submit failed', formatApiError(e)),
  });

  const lockMutation = useMutation({
    mutationFn: async () => (await api.post<MarksEntrySheetDTO>(`/api/exams/marks/${instanceId}/lock`)).data,
    onSuccess: async (data) => { setLocalRows(data.rows); toast.success('Marks locked'); await qc.invalidateQueries({ queryKey: ['marks-sheet', instanceId] }); },
    onError: (e) => toast.error('Lock failed', formatApiError(e)),
  });

  const isLocked = sheet?.assessmentStatus === 'LOCKED' || sheet?.assessmentStatus === 'PUBLISHED';
  const canSubmit = sheet?.assessmentStatus === 'MARKS_ENTRY_OPEN';
  const canLock = sheet?.assessmentStatus === 'MARKS_SUBMITTED';

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <button type="button" className="btn secondary" onClick={onClose} style={{ marginBottom: 8 }}>← Back</button>
            <div style={{ fontWeight: 900 }}>{sheet?.assessmentName ?? 'Marks Entry'}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              {sheet?.schemeName} · {sheet?.componentName} · {sheet?.classGroupLabel} · {sheet?.subjectName} · Max: {sheet?.maxMarks}
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn secondary" disabled={isLocked || saveDraftMutation.isPending} onClick={() => saveDraftMutation.mutate()}>
              {saveDraftMutation.isPending ? 'Saving…' : 'Save Draft'}
            </button>
            {canSubmit && (
              <button type="button" className="btn secondary" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                {submitMutation.isPending ? 'Submitting…' : 'Submit Marks'}
              </button>
            )}
            {canLock && (
              <button type="button" className="btn" disabled={lockMutation.isPending} onClick={() => lockMutation.mutate()}>
                {lockMutation.isPending ? 'Locking…' : 'Lock Marks'}
              </button>
            )}
          </div>
        </div>
      </div>

      {sheetQ.isLoading ? (
        <div className="muted" style={{ padding: 16 }}>Loading marks sheet…</div>
      ) : sheetQ.isError ? (
        <div style={{ color: '#b91c1c', padding: 16 }}>Failed to load marks sheet.</div>
      ) : (
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                <th style={{ padding: '8px 6px' }}>#</th>
                <th style={{ padding: '8px 6px' }}>Student</th>
                <th style={{ padding: '8px 6px' }}>Roll No</th>
                <th style={{ padding: '8px 6px' }}>Marks</th>
                <th style={{ padding: '8px 6px' }}>Absent</th>
                <th style={{ padding: '8px 6px' }}>Remarks</th>
                <th style={{ padding: '8px 6px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.studentId} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                  <td style={{ padding: '6px 6px', color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ padding: '6px 6px', fontWeight: 600 }}>{r.fullName}</td>
                  <td style={{ padding: '6px 6px', fontSize: 12, color: '#64748b' }}>{r.admissionNo}</td>
                  <td style={{ padding: '6px 4px', minWidth: 80 }}>
                    <input
                      type="number"
                      min={0}
                      max={sheet?.maxMarks}
                      step="0.5"
                      disabled={isLocked || r.absent}
                      value={r.marksObtained ?? ''}
                      onChange={(e) => updateRow(r.studentId, { marksObtained: e.target.value === '' ? null : Number(e.target.value) })}
                      style={{ width: 70, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: '6px 6px' }}>
                    <input
                      type="checkbox"
                      checked={r.absent}
                      disabled={isLocked}
                      onChange={(e) => updateRow(r.studentId, { absent: e.target.checked, marksObtained: e.target.checked ? null : r.marksObtained })}
                    />
                  </td>
                  <td style={{ padding: '6px 4px', minWidth: 120 }}>
                    <input
                      value={r.remarks ?? ''}
                      disabled={isLocked}
                      onChange={(e) => updateRow(r.studentId, { remarks: e.target.value || null })}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: '6px 6px' }}>
                    <StatusChip level={markStatusLevel(r.status)} label={r.status ?? 'Not entered'} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Result Status Helpers ───────────────────────

function resultStatusLevel(s: ResultStatus | null): StatusLevel {
  if (s === 'PUBLISHED') return 'ok';
  if (s === 'LOCKED') return 'info';
  if (s === 'GENERATED') return 'warn';
  return 'idle';
}

function resultStatusLabel(s: ResultStatus | null): string {
  if (s === 'PUBLISHED') return 'Published';
  if (s === 'LOCKED') return 'Locked';
  if (s === 'GENERATED') return 'Generated';
  return 'Unknown';
}

// ─────────────────────────────── Result Calculation Details ───────────────────

type CalcDetail = {
  instanceName?: string;
  score?: number;
  max?: number;
  dropped?: boolean;
  note?: string;
};

function parseCalcDetails(json: string | null): CalcDetail[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as CalcDetail[];
    return [];
  } catch {
    return [];
  }
}

function ComponentDetailBlock({ comp }: { comp: StudentResultComponentDTO }) {
  const details = parseCalcDetails(comp.calculationDetailsJson);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#1e293b' }}>
        {comp.componentName}
        <span className="muted" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
          ({comp.calculationRule?.replace(/_/g, ' ')})
        </span>
      </div>
      {details.length > 0 ? (
        <div style={{ paddingLeft: 12 }}>
          {details.map((d, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: d.dropped ? '#94a3b8' : '#1e293b', textDecoration: d.dropped ? 'line-through' : undefined }}>
                {d.instanceName ?? `Entry ${i + 1}`}
                {typeof d.score === 'number' && typeof d.max === 'number'
                  ? ` ${d.score}/${d.max}`
                  : typeof d.score === 'number' ? ` ${d.score}` : ''}
              </span>
              {d.dropped ? (
                <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>dropped</span>
              ) : null}
              {d.note ? <span className="muted" style={{ fontSize: 11 }}>{d.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ fontSize: 12, marginTop: 4, color: '#64748b' }}>
        Weighted: <strong style={{ color: '#1e293b' }}>
          {comp.weightedScore != null ? comp.weightedScore.toFixed(2) : '—'}
          {comp.weightagePercent != null ? `/${comp.weightagePercent}` : ''}
        </strong>
        {comp.rawScore != null && comp.rawMax != null ? (
          <span className="muted" style={{ marginLeft: 8 }}>Raw: {comp.rawScore}/{comp.rawMax}</span>
        ) : null}
      </div>
    </div>
  );
}

// ──��──────────────────────────── Results Panel ───────────────────────────────

function ResultsPanel({
  schemes,
  classGroups,
  subjects,
  academicYears,
}: {
  schemes: AssessmentScheme[];
  classGroups: ClassGroup[];
  subjects: SubjectLite[];
  academicYears: AcademicYear[];
}) {
  const [filterAcademicYearId, setFilterAcademicYearId] = useState('');
  const [filterSchemeId, setFilterSchemeId] = useState('');
  const [filterSchemeStatus, setFilterSchemeStatus] = useState<'' | 'PUBLISHED' | 'ARCHIVED'>('');
  const [filterClassGroupId, setFilterClassGroupId] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Preview mode: results fetched on demand but not persisted
  const [previewResults, setPreviewResults] = useState<StudentResultDTO[] | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const qc = useQueryClient();

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    classGroups.forEach((cg) => { if (cg.gradeLevel != null) set.add(cg.gradeLevel); });
    return [...set].sort((a, b) => a - b);
  }, [classGroups]);

  const sectionOptions = useMemo(() => {
    if (!filterGrade) return classGroups;
    return classGroups.filter((cg) => String(cg.gradeLevel) === filterGrade);
  }, [classGroups, filterGrade]);

  const filteredSchemeOptions = useMemo(() => {
    if (!filterSchemeStatus) return schemes;
    return schemes.filter((s) => s.status === filterSchemeStatus);
  }, [schemes, filterSchemeStatus]);

  // Persisted results query
  const resultsQ = useQuery({
    queryKey: ['exam-results', filterClassGroupId, filterSchemeId, filterSubjectId, filterStatus],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filterClassGroupId) p.set('classGroupId', filterClassGroupId);
      if (filterSchemeId) p.set('schemeId', filterSchemeId);
      if (filterSubjectId) p.set('subjectId', filterSubjectId);
      if (filterStatus) p.set('status', filterStatus);
      return (await api.get<StudentResultDTO[]>(`/api/exams/results?${p.toString()}`)).data;
    },
  });

  // Display: if we have a fresh preview, show that; otherwise show persisted
  const displayResults = previewResults ?? resultsQ.data ?? [];

  // Derive dynamic component columns from the first result's components (or from selected scheme)
  const componentColumns: string[] = useMemo(() => {
    if (displayResults.length > 0) {
      return displayResults[0].components.map((c) => c.componentName);
    }
    const scheme = schemes.find((s) => String(s.id) === filterSchemeId);
    if (scheme) return scheme.components.map((c) => c.name);
    return [];
  }, [displayResults, schemes, filterSchemeId]);

  const canAct = filterSchemeId && filterClassGroupId && filterSubjectId;

  // ── Mutations ────────────────────────────────────────────────────────────────

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!canAct) throw new Error('Select scheme, class/section, and subject first.');
      return (await api.post<StudentResultDTO[]>('/api/exams/results/preview', {
        classGroupId: Number(filterClassGroupId),
        schemeId: Number(filterSchemeId),
        subjectId: Number(filterSubjectId),
      })).data;
    },
    onSuccess: (data) => {
      setPreviewResults(data);
      toast.success('Preview ready', `${data.length} student result${data.length === 1 ? '' : 's'} calculated (not saved).`);
    },
    onError: (e) => toast.error('Preview failed', formatApiError(e)),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!canAct) throw new Error('Select scheme, class/section, and subject first.');
      return (await api.post<StudentResultDTO[]>('/api/exams/results/generate', {
        classGroupId: Number(filterClassGroupId),
        schemeId: Number(filterSchemeId),
        subjectId: Number(filterSubjectId),
      })).data;
    },
    onSuccess: async (data) => {
      setPreviewResults(null);
      toast.success('Generated', `${data.length} result${data.length === 1 ? '' : 's'} saved.`);
      await qc.invalidateQueries({ queryKey: ['exam-results'] });
    },
    onError: (e) => toast.error('Generate failed', formatApiError(e)),
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!canAct) throw new Error('Select scheme, class/section, and subject first.');
      return (await api.post<StudentResultDTO[]>('/api/exams/results/lock', {
        classGroupId: Number(filterClassGroupId),
        schemeId: Number(filterSchemeId),
        subjectId: Number(filterSubjectId),
      })).data;
    },
    onSuccess: async (data) => {
      setPreviewResults(null);
      toast.success('Locked', `${data.length} result${data.length === 1 ? '' : 's'} locked.`);
      await qc.invalidateQueries({ queryKey: ['exam-results'] });
    },
    onError: (e) => toast.error('Lock failed', formatApiError(e)),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!canAct) throw new Error('Select scheme, class/section, and subject first.');
      return (await api.post<StudentResultDTO[]>('/api/exams/results/publish', {
        classGroupId: Number(filterClassGroupId),
        schemeId: Number(filterSchemeId),
        subjectId: Number(filterSubjectId),
      })).data;
    },
    onSuccess: async (data) => {
      setPreviewResults(null);
      setShowPublishConfirm(false);
      toast.success('Published', `${data.length} result${data.length === 1 ? '' : 's'} published and visible to students/parents.`);
      await qc.invalidateQueries({ queryKey: ['exam-results'] });
    },
    onError: (e) => {
      setShowPublishConfirm(false);
      toast.error('Publish failed', formatApiError(e));
    },
  });

  const isActing =
    previewMutation.isPending ||
    generateMutation.isPending ||
    lockMutation.isPending ||
    publishMutation.isPending;

  const RESULT_STATUS_OPTIONS: ResultStatus[] = ['GENERATED', 'LOCKED', 'PUBLISHED'];

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* Publish Confirmation Dialog */}
      <ConfirmDialog
        open={showPublishConfirm}
        title="Publish Results?"
        description="After publishing, results will be visible to students/parents and cannot be edited directly."
        confirmLabel={publishMutation.isPending ? 'Publishing…' : 'Publish Results'}
        confirmDisabled={publishMutation.isPending}
        onConfirm={() => publishMutation.mutate()}
        onClose={() => setShowPublishConfirm(false)}
      />

      {/* Header */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900 }}>Results</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Preview, generate, lock, and publish student results. Select scheme + class + subject to act.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn secondary"
              disabled={!canAct || isActing}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? 'Previewing…' : 'Preview Results'}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={!canAct || isActing}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? 'Generating…' : 'Generate Results'}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={!canAct || isActing}
              onClick={() => lockMutation.mutate()}
            >
              {lockMutation.isPending ? 'Locking…' : 'Lock Results'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canAct || isActing}
              onClick={() => setShowPublishConfirm(true)}
            >
              Publish Results
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Academic Year</span>
            <SmartSelect
              value={filterAcademicYearId}
              onChange={setFilterAcademicYearId}
              options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))}
              placeholder="All years"
              allowClear
              searchable
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scheme</span>
            <div className="stack" style={{ gap: 4 }}>
              <div className="row" style={{ gap: 4 }}>
                {(['', 'PUBLISHED', 'ARCHIVED'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setFilterSchemeStatus(v); setFilterSchemeId(''); }}
                    style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(15,23,42,0.2)', cursor: 'pointer',
                      background: filterSchemeStatus === v ? '#0f172a' : 'transparent',
                      color: filterSchemeStatus === v ? '#fff' : 'inherit',
                      fontWeight: filterSchemeStatus === v ? 700 : 400,
                    }}
                  >
                    {v === '' ? 'All' : v === 'PUBLISHED' ? 'Published' : 'Archived'}
                  </button>
                ))}
              </div>
              <SmartSelect value={filterSchemeId} onChange={setFilterSchemeId}
                options={filteredSchemeOptions.map((s) => ({ value: String(s.id), label: s.name, meta: s.status }))}
                placeholder="All schemes" allowClear searchable />
            </div>
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class / Sections</span>
            <SmartSelect
              value={filterGrade}
              onChange={(v) => { setFilterGrade(v); setFilterClassGroupId(''); }}
              options={gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
              placeholder="All classes" allowClear />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Section</span>
            <SmartSelect
              value={filterClassGroupId}
              onChange={setFilterClassGroupId}
              options={sectionOptions.map((cg) => ({ value: String(cg.id), label: cg.section ?? cg.displayName ?? `Grade ${cg.gradeLevel}` }))}
              placeholder={filterGrade ? 'All sections' : 'Select class first'} allowClear />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
            <SmartSelect
              value={filterSubjectId}
              onChange={(v) => { setFilterSubjectId(v); setPreviewResults(null); }}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} – ${s.name}` : s.name }))}
              placeholder="All subjects"
              allowClear
              searchable
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Status</span>
            <SelectKeeper
              value={filterStatus}
              onChange={setFilterStatus}
              emptyValueLabel="All statuses"
              options={RESULT_STATUS_OPTIONS.map((s) => ({ value: s, label: resultStatusLabel(s) }))}
            />
          </label>
        </div>
      </div>

      {/* Preview notice */}
      {previewResults != null ? (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'space-between',
        }}>
          <span>
            <strong>Preview mode</strong> — these {previewResults.length} result{previewResults.length === 1 ? '' : 's'} are not saved yet. Click <em>Generate Results</em> to persist.
          </span>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setPreviewResults(null)}>
            Clear Preview
          </button>
        </div>
      ) : null}

      {/* Results Table */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        {resultsQ.isLoading && previewResults == null ? (
          <div className="muted" style={{ padding: 12 }}>Loading…</div>
        ) : resultsQ.isError && previewResults == null ? (
          <div style={{ color: '#b91c1c', padding: 12 }}>Failed to load results.</div>
        ) : displayResults.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>
            No results found. Select scheme + class + subject, then click <strong>Preview Results</strong> or <strong>Generate Results</strong>.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Student</th>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Roll No</th>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Subject</th>
                  {componentColumns.map((col) => (
                    <th key={col} style={{ padding: '8px 6px', whiteSpace: 'nowrap', color: '#475569' }}>{col}</th>
                  ))}
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>%</th>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Grade</th>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayResults.map((r) => {
                  const isExpanded = expandedStudentId === r.studentId;
                  return (
                    <>
                      <tr
                        key={`${r.studentId}-${r.subjectId}`}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid rgba(15,23,42,0.08)',
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(15,23,42,0.03)' : undefined,
                        }}
                        onClick={() => setExpandedStudentId(isExpanded ? null : r.studentId)}
                      >
                        <td style={{ padding: '8px 6px', fontWeight: 700 }}>
                          <span style={{ marginRight: 6, fontSize: 11, color: '#64748b' }}>{isExpanded ? '▲' : '▶'}</span>
                          {r.studentName}
                        </td>
                        <td style={{ padding: '8px 6px', color: '#64748b', fontSize: 12 }}>{r.admissionNo ?? '—'}</td>
                        <td style={{ padding: '8px 6px' }}>{r.subjectName}</td>
                        {componentColumns.map((col) => {
                          const comp = r.components.find((c) => c.componentName === col);
                          return (
                            <td key={col} style={{ padding: '8px 6px' }}>
                              {comp ? (
                                <span style={{ color: '#1e293b' }}>
                                  {comp.weightedScore != null ? comp.weightedScore.toFixed(1) : '—'}
                                  {comp.weightagePercent != null ? (
                                    <span className="muted" style={{ fontSize: 11 }}>/{comp.weightagePercent}</span>
                                  ) : null}
                                </span>
                              ) : <span className="muted">—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: '8px 6px', fontWeight: 700 }}>
                          {r.totalWeightedScore != null ? r.totalWeightedScore.toFixed(2) : '—'}
                        </td>
                        <td style={{ padding: '8px 6px', fontWeight: 700, color: '#2563eb' }}>
                          {r.percentage != null ? `${r.percentage.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          {r.grade ? (
                            <span style={{
                              display: 'inline-block',
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontWeight: 700,
                              fontSize: 13,
                            }}>
                              {r.grade}
                            </span>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <StatusChip level={resultStatusLevel(r.status)} label={resultStatusLabel(r.status)} />
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${r.studentId}-${r.subjectId}-detail`} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                          <td colSpan={4 + componentColumns.length} style={{ padding: '10px 14px 14px 32px', background: 'rgba(15,23,42,0.02)' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>
                              Component Calculation Details — {r.studentName}
                            </div>
                            {r.components.length === 0 ? (
                              <div className="muted" style={{ fontSize: 12 }}>No component details available.</div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                                {r.components.map((comp) => (
                                  <div
                                    key={comp.assessmentComponentId}
                                    style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6, padding: '10px 12px' }}
                                  >
                                    <ComponentDetailBlock comp={comp} />
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 13 }}>
                              <span>
                                <span className="muted" style={{ fontSize: 11 }}>
                                  <span className="muted">Total: </span>
                                  <strong>{r.totalWeightedScore != null ? r.totalWeightedScore.toFixed(2) : '—'}</strong>
                                </span>
                              </span>
                              <span>
                                <span className="muted" style={{ fontSize: 11 }}>
                                  <span className="muted">Percentage: </span>
                                  <strong style={{ color: '#2563eb' }}>{r.percentage != null ? `${r.percentage.toFixed(1)}%` : '—'}</strong>
                                </span>
                              </span>
                              <span>
                                <span className="muted" style={{ fontSize: 11 }}>
                                  <span className="muted">Grade: </span>
                                  <strong>{r.grade ?? '—'}</strong>
                                </span>
                              </span>
                              {r.generatedAt ? (
                                <span className="muted" style={{ fontSize: 11 }}>
                                  Generated: {new Date(r.generatedAt).toLocaleDateString()}
                                </span>
                              ) : null}
                              {r.publishedAt ? (
                                <span className="muted" style={{ fontSize: 11 }}>
                                  Published: {new Date(r.publishedAt).toLocaleDateString()}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

