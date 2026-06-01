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
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GradingSchemesManager } from './GradingSchemesManager';
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
  return s.assignmentLabel || 'Not assigned';
}

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

function readiness(components: AssessmentComponent[]): { ready: boolean; label: string } {
  const t = totalWeightage(components);
  const hasRuleIssue = components.some((c) => validateComponentRules(c).length > 0);
  if (components.length === 0) return { ready: false, label: 'Needs components' };
  if (t !== 100) return { ready: false, label: `Cannot publish: total weightage is ${t}% (must be 100%)` };
  if (hasRuleIssue) return { ready: false, label: 'Cannot publish: one or more component rules are invalid' };
  return { ready: true, label: 'Ready to publish' };
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

function calculationRuleLabel(c: AssessmentComponent): string {
  if (c.calculationRule === 'BEST_N_OF_M' && c.bestOfCount && c.totalAssessments) return `Best ${c.bestOfCount} of ${c.totalAssessments}`;
  if (c.calculationRule === 'SINGLE_ASSESSMENT') return 'Single Assessment';
  if (c.calculationRule === 'ATTENDANCE_PERCENTAGE') return 'Attendance Percentage';
  return toDisplayLabel(c.calculationRule);
}

function componentMaxMarksLabel(c: AssessmentComponent): string {
  if (c.maxMarks == null) return '—';
  const marks = `${c.maxMarks} marks`;
  return c.calculationRule === 'BEST_N_OF_M' || c.calculationRule === 'SUM' || c.calculationRule === 'AVERAGE'
    ? `${marks} each`
    : marks;
}

function componentStatusLabel(c: AssessmentComponent): string {
  if (Number(c.weightagePercent) <= 0) return 'Missing weightage';
  const issues = validateComponentRules(c);
  if (issues.length > 0) return 'Invalid rule';
  return 'Ready';
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
      const { state, level } = computeSchemeState(s);
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
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Step 4: Review</div>
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
  const ready = schemeReadiness(scheme);

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

  const cloneForRevise = useMutation({
    mutationFn: async () => (await api.post<AssessmentScheme>(`/api/exams/schemes/${scheme.id}/clone`)).data,
    onSuccess: async (created) => {
      toast.success('Scheme cloned', 'A draft copy has been created — you can now edit it.');
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

  const isReadOnly = scheme.status === 'PUBLISHED' || scheme.status === 'ARCHIVED';
  const statusLabel = scheme.status === 'DRAFT' ? 'Draft' : scheme.status === 'PUBLISHED' ? 'Published' : 'Archived';

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
              {(() => {
                const { state } = computeSchemeState(scheme);
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
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: sc.bg, color: sc.color }}>
                    {state}
                  </span>
                );
              })()}
              {(() => {
                const badge = getOverrideBadge(scheme);
                return badge ? (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#ede9fe', color: '#5b21b6' }}>
                    ↑ {badge}
                  </span>
                ) : null;
              })()}
              {isReadOnly && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#64748b' }}>
                  Read-only · Clone to revise
                </span>
              )}
              {scheme.status === 'DRAFT' && (
                <StatusChip
                  level={(scheme.assignments ?? []).some((a) => a.active) ? 'ok' : 'error'}
                  label={(scheme.assignments ?? []).some((a) => a.active) ? computeScopeLabel(scheme) : 'Needs assignment'}
                />
              )}
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

function academicYearDisplay(academicYears: AcademicYear[], academicYearId: number | null): string {
  if (academicYearId == null) return 'Effective Period: Always';
  const label = academicYears.find((y) => y.id === academicYearId)?.label;
  return label ? formatAcademicYear(label) : `Year ${academicYearId}`;
}

function gradingEffectivePeriodLabel(g: GradingScheme, academicYears: AcademicYear[]): string {
  const fromId = g.effectiveFromAcademicYearId ?? g.academicYearId ?? null;
  const toId = g.effectiveToAcademicYearId ?? g.academicYearId ?? null;
  if (fromId == null && toId == null) return 'Always';
  const from = fromId == null ? 'Beginning' : academicYearDisplay(academicYears, fromId);
  const to = toId == null ? 'No end' : academicYearDisplay(academicYears, toId);
  return fromId === toId ? from : `${from} → ${to}`;
}

function gradingScopeLabel(g: GradingScheme): string {
  return g.scope === 'CLASS_GROUP' ? 'Class Group' : 'School-wide';
}

function gradingAppliesToLabel(g: GradingScheme): string {
  return g.scope === 'CLASS_GROUP' ? (g.classGroupLabel ?? 'Selected class') : 'All classes';
}
function gradingBandLabel(grade: string): string {
  const labels: Record<string, string> = {
    A1: 'Outstanding',
    A2: 'Excellent',
    B1: 'Very Good',
    B2: 'Good',
    C1: 'Average',
    C2: 'Below Average',
    D: 'Pass',
    E: 'Fail',
    F: 'Fail',
  };
  return labels[grade.toUpperCase()] ?? toDisplayLabel(grade);
}
function gradingPassingPercent(g: GradingScheme): number | null {
  if (g.passingPercent != null && Number.isFinite(Number(g.passingPercent))) return Number(g.passingPercent);
  const bands = (g.bands ?? []).filter((b) => Number.isFinite(Number(b.minPercent)) && Number.isFinite(Number(b.maxPercent)));
  const explicitPass = bands.find((b) => b.grade.toUpperCase() === 'D');
  if (explicitPass) return Number(explicitPass.minPercent);
  const passBands = bands.filter((b) => !['E', 'F', 'FAIL'].includes(b.grade.toUpperCase()));
  if (passBands.length === 0) return null;
  return Math.min(...passBands.map((b) => Number(b.minPercent)));
}
function validateGradingScheme(g: GradingScheme): string[] {
  const issues: string[] = [];
  const bands = (g.bands ?? []).slice().sort((a, b) => Number(a.minPercent) - Number(b.minPercent));
  if (bands.length === 0) issues.push('At least one grade band is required.');
  const labels = new Set<string>();
  for (const band of bands) {
    if (labels.has(band.grade.toUpperCase())) issues.push(`Duplicate grade label: ${band.grade}`);
    labels.add(band.grade.toUpperCase());
    if (Number(band.minPercent) > Number(band.maxPercent)) issues.push(`${band.grade}: min percentage must be less than or equal to max percentage.`);
  }
  for (let i = 1; i < bands.length; i += 1) {
    const prev = bands[i - 1];
    const cur = bands[i];
    if (Number(cur.minPercent) <= Number(prev.maxPercent)) issues.push(`${prev.grade}/${cur.grade}: overlapping percentage ranges.`);
    if (Number(cur.minPercent) > Number(prev.maxPercent) + 1) issues.push(`${prev.grade}/${cur.grade}: missing percentage gap.`);
  }
  if (bands.length > 0) {
    if (Number(bands[0].minPercent) > 0) issues.push('Ranges must cover 0%.');
    if (Number(bands[bands.length - 1].maxPercent) < 100) issues.push('Ranges must cover 100%.');
  }
  if (gradingPassingPercent(g) == null) issues.push('Passing threshold is not configured.');
  return Array.from(new Set(issues));
}
function gradingState(g: GradingScheme): { label: 'Active' | 'Draft' | 'Has Conflicts'; level: StatusLevel } {
  if (validateGradingScheme(g).length > 0) return { label: 'Has Conflicts', level: 'error' };
  return g.active ? { label: 'Active', level: 'ok' } : { label: 'Draft', level: 'warn' };
}
function GradingPanel({
  gradingSchemes,
  academicYears,
  classGroups,
  onCreated,
}: {
  gradingSchemes: GradingScheme[];
  academicYears: AcademicYear[];
  classGroups: ClassGroup[];
  onCreated: () => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGradingId, setSelectedGradingId] = useState<number | null>(null);
  const [gradingName, setGradingName] = useState('Default Grading Scheme');
  const [gradingScope, setGradingScope] = useState<'SCHOOL' | 'CLASS_GROUP'>('SCHOOL');
  const [classGroupId, setClassGroupId] = useState('');
  const [passingPercent, setPassingPercent] = useState('33');
  const [defaultScheme, setDefaultScheme] = useState(true);
  const [effectiveFromAcademicYearId, setEffectiveFromAcademicYearId] = useState('');
  const [effectiveToAcademicYearId, setEffectiveToAcademicYearId] = useState('');
  const [draftBands, setDraftBands] = useState(() => DEFAULT_GRADING_BANDS.map((b, i) => ({ ...b, gradePoint: null as number | null, sequence: i + 1 })));
  const [gradingSearch, setGradingSearch] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterAcademicYearId, setFilterAcademicYearId] = useState('');
  const [filterState, setFilterState] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const createBasicGrading = useMutation({
    mutationFn: async () => {
      const payload = {
        name: gradingName.trim() || 'Default Grading Scheme',
        scope: gradingScope,
        classGroupId: gradingScope === 'CLASS_GROUP' && classGroupId ? Number(classGroupId) : null,
        defaultScheme,
        passingPercent: Number(passingPercent) || 33,
        effectiveFromAcademicYearId: effectiveFromAcademicYearId ? Number(effectiveFromAcademicYearId) : null,
        effectiveToAcademicYearId: effectiveToAcademicYearId ? Number(effectiveToAcademicYearId) : null,
        active: true,
        bands: draftBands.map((b, i) => ({ ...b, sequence: b.sequence ?? i + 1 })),
      };
      return (await api.post<GradingScheme>('/api/exams/grading-schemes', payload)).data;
    },
    onSuccess: async () => {
      toast.success('Grading scheme created');
      setCreateOpen(false);
      setGradingName('Default Grading Scheme');
      setGradingScope('SCHOOL');
      setClassGroupId('');
      setPassingPercent('33');
      setDefaultScheme(true);
      setEffectiveFromAcademicYearId('');
      setEffectiveToAcademicYearId('');
      setDraftBands(DEFAULT_GRADING_BANDS.map((b, i) => ({ ...b, gradePoint: null as number | null, sequence: i + 1 })));
      await onCreated();
    },
    onError: (e) => toast.error('Could not create grading scheme', formatApiError(e)),
  });
  const selectedGrading = gradingSchemes.find((g) => g.id === selectedGradingId) ?? null;
  if (selectedGrading) {
    return <GradingDetailCard scheme={selectedGrading} academicYears={academicYears} onBack={() => setSelectedGradingId(null)} />;
  }
  const total = gradingSchemes.length;
  const active = gradingSchemes.filter((g) => g.active).length;
  const drafts = gradingSchemes.filter((g) => !g.active).length;
  const conflicts = gradingSchemes.filter((g) => validateGradingScheme(g).length > 0).length;
  const filtered = gradingSchemes.filter((g) => {
    const q = gradingSearch.trim().toLowerCase();
    const state = gradingState(g).label;
    if (q && !g.name.toLowerCase().includes(q) && !gradingAppliesToLabel(g).toLowerCase().includes(q)) return false;
    if (filterScope && g.scope !== filterScope) return false;
    if (filterAcademicYearId) {
      const yearId = Number(filterAcademicYearId);
      const from = g.effectiveFromAcademicYearId ?? g.academicYearId ?? null;
      const to = g.effectiveToAcademicYearId ?? g.academicYearId ?? null;
      if (!((from == null || yearId >= from) && (to == null || yearId <= to))) return false;
    }
    if (filterState && state !== filterState) return false;
    return true;
  });
  const summaryCards = [
    { label: 'Total grading schemes', value: total, bg: '#eff6ff', color: '#1d4ed8' },
    { label: 'Active schemes', value: active, bg: '#d1fae5', color: '#065f46' },
    { label: 'Draft schemes', value: drafts, bg: '#fef3c7', color: '#92400e' },
    { label: 'Conflicts', value: conflicts, bg: conflicts > 0 ? '#fee2e2' : '#f1f5f9', color: conflicts > 0 ? '#991b1b' : '#475569' },
  ];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Grading Schemes</div>
            <div className="muted" style={{ marginTop: 5, fontSize: 13 }}>
              Create and manage grade bands used for result calculation.
            </div>
            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
              Grading schemes define grade bands used after weighted score calculation.
            </div>
          </div>
          <button type="button" className="btn" onClick={() => setCreateOpen((v) => !v)} disabled={createBasicGrading.isPending}>
            {createOpen ? 'Close form' : 'Create Grading Scheme'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {summaryCards.map((card) => (
          <div key={card.label} className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.08)', background: card.bg }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: card.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 950, color: card.color, marginTop: 4 }}>{card.value}</div>
          </div>
        ))}
      </div>
      {createOpen ? (
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div style={{ fontWeight: 900 }}>Create Grading Scheme</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Define reusable grade bands. Leave the effective period empty to apply across academic years.
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 10 }}>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scheme name</span>
              <input value={gradingName} onChange={(e) => setGradingName(e.target.value)} />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scope</span>
              <SmartSelect
                value={gradingScope}
                onChange={(v) => { setGradingScope((v || 'SCHOOL') as 'SCHOOL' | 'CLASS_GROUP'; if (v !== 'CLASS_GROUP') setClassGroupId(''); }}
                options={[{ value: 'SCHOOL', label: 'School-wide' }, { value: 'CLASS_GROUP', label: 'Class Group' }]}
                placeholder="Select scope"
              />
            </label>
            {gradingScope === 'CLASS_GROUP' ? (
              <label className="stack" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Applies to class</span>
                <SmartSelect
                  value={classGroupId}
                  onChange={setClassGroupId}
                  options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Grade ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
                  placeholder="Select class"
                  searchable
                />
              </label>
            ) : null}
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Passing percentage</span>
              <input type="number" min={0} max={100} step="0.01" value={passingPercent} onChange={(e) => setPassingPercent(e.target.value)} />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Effective From (optional)</span>
              <SmartSelect value={effectiveFromAcademicYearId} onChange={setEffectiveFromAcademicYearId} options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))} placeholder="Always" allowClear />
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Effective To (optional)</span>
              <SmartSelect value={effectiveToAcademicYearId} onChange={setEffectiveToAcademicYearId} options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))} placeholder="Always" allowClear />
            </label>
            <label className="row" style={{ gap: 8, alignItems: 'center', marginTop: 22 }}>
              <input type="checkbox" checked={defaultScheme} onChange={(e) => setDefaultScheme(e.target.checked)} />
              <span style={{ fontSize: 13 }}>Default scheme</span>
            </label>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Grade bands</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Grade', 'Min %', 'Max %', 'Grade Point'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 6 }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {draftBands.map((b, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 6px' }}>
                      <input value={b.grade} onChange={(e) => setDraftBands((rows) => rows.map((r, i) => i === idx ? { ...r, grade: e.target.value } : r))} style={{ width: 70 }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" value={b.minPercent} onChange={(e) => setDraftBands((rows) => rows.map((r, i) => i === idx ? { ...r, minPercent: Number(e.target.value) } : r))} style={{ width: 80 }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" value={b.maxPercent} onChange={(e) => setDraftBands((rows) => rows.map((r, i) => i === idx ? { ...r, maxPercent: Number(e.target.value) } : r))} style={{ width: 80 }} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input type="number" value={b.gradePoint ?? ''} onChange={(e) => setDraftBands((rows) => rows.map((r, i) => i === idx ? { ...r, gradePoint: e.target.value === '' ? null : Number(e.target.value) } : r))} style={{ width: 90 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="btn secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="btn" onClick={() => createBasicGrading.mutate()} disabled={createBasicGrading.isPending}>
              {createBasicGrading.isPending ? 'Creating…' : 'Create Grading Scheme'}
            </button>
          </div>
        </div>
      ) : null}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 12 }}>
          <input
            value={gradingSearch}
            onChange={(e) => setGradingSearch(e.target.value)}
            placeholder="Search grading scheme..."
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.2)', gridColumn: 'span 2' }}
          />
          <SmartSelect
            value={filterScope}
            onChange={setFilterScope}
            options={[{ value: 'SCHOOL', label: 'School-wide' }, { value: 'CLASS_GROUP', label: 'Class Group' }]}
            placeholder="All scopes"
            allowClear
          />
          <SmartSelect
            value={filterAcademicYearId}
            onChange={setFilterAcademicYearId}
            options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))}
            placeholder="All academic years"
            allowClear
          />
          <SmartSelect
            value={filterState}
            onChange={setFilterState}
            options={(['Active', 'Draft', 'Has Conflicts'].map((s) => ({ value: s, label: s }))}
            placeholder="All states"
            allowClear
          />
        </div>
        <div style={{ overflowX: 'auto' }} onClick={() => activeMenuId !== null && setActiveMenuId(null)}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                {['Scheme Name', 'Scope', 'Applies To', 'Effective Period', 'Bands', 'Passing %', 'State', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '8px 8px', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.03)' }}>
                <th style={{ padding: '8px 6px', fontWeight: 700 }}>Component name</th>
                <th style={{ padding: '8px 6px' }}>Type</th>
                <th style={{ padding: '8px 6px' }}>Weightage %</th>
                <th style={{ padding: '8px 6px' }}>Max Marks</th>
                <th style={{ padding: '8px 6px' }}>Calculation Rule</th>
                <th style={{ padding: '8px 6px' }}>Assessments Rule</th>
                <th style={{ padding: '8px 6px' }}>Seq</th>
                <th style={{ padding: '8px 6px' }}>Validity</th>
                {!isReadOnly && <th style={{ padding: '8px 6px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 16 }}>No grading schemes match the current filters.</td></tr>
              ) : filtered.map((g) => {
                const state = gradingState(g);
                const passing = gradingPassingPercent(g);
                const isMenuOpen = activeMenuId === g.id;
                return (
                  <tr key={g.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.07)', cursor: 'pointer' }} onClick={() => setSelectedGradingId(g.id)}>
                    <td style={{ padding: '9px 8px', fontWeight: 800 }}>{g.name}</td>
                    <td style={{ padding: '9px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{gradingScopeLabel(g)}</td>
                    <td style={{ padding: '9px 8px' }}>{gradingAppliesToLabel(g)}</td>
                    <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>{gradingEffectivePeriodLabel(g, academicYears)}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center' }}>{g.bands?.length ?? 0}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center' }}>{passing != null ? `${passing}%` : '—'}</td>
                    <td style={{ padding: '9px 8px' }}><StatusChip level={state.level} label={state.label} /></td>
                    <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setSelectedGradingId(g.id)}>View</button>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            title="More actions"
                            style={{ background: 'none', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: '#64748b' }}
                            onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : g.id); }}
                          >
                            ⋯
                          </button>
                          {isMenuOpen ? (
                            <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: '#fff', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 6, boxShadow: '0 4px 12px rgba(15,23,42,0.12)', minWidth: 160, padding: '4px 0' }}>
                              {['Edit', 'Clone', 'Archive', 'Set as Default'].map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  disabled
                                  title="Open the grading detail page to manage this scheme"
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 13, background: 'none', border: 'none', color: '#94a3b8', cursor: 'not-allowed' }}
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function GradingDetailCard({ scheme, academicYears, onBack }: { scheme: GradingScheme; academicYears: AcademicYear[]; onBack: () => void }) {
  const sortedBands = (scheme.bands ?? []).slice().sort((a, b) => b.maxPercent - a.maxPercent);
  const issues = validateGradingScheme(scheme);
  const passing = gradingPassingPercent(scheme);
  const state = gradingState(scheme);
  const effectivePeriod = gradingEffectivePeriodLabel(scheme, academicYears);
  const validationRows = [
    { label: 'No overlapping ranges', ok: !issues.some((i) => i.includes('overlapping')) },
    { label: 'No missing percentage gaps', ok: !issues.some((i) => i.includes('missing percentage gap')) },
    { label: 'Covers 0–100', ok: !issues.some((i) => i.includes('cover')) },
    { label: 'Passing threshold configured', ok: passing != null },
    { label: 'Grade labels are unique', ok: !issues.some((i) => i.includes('Duplicate grade label')) },
    { label: 'Min percentage is less than or equal to max percentage', ok: !issues.some((i) => i.includes('min percentage')) },
  ];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <button type="button" className="btn secondary" onClick={onBack} style={{ marginBottom: 10 }}>← Back to grading schemes</button>
            <h2 style={{ margin: 0, fontSize: 18 }}>{scheme.name}</h2>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              Effective Period: {effectivePeriod === 'Always' ? 'Always' : effectivePeriod}
              {' · '}Scope: {gradingScopeLabel(scheme)} · Applies To: {gradingAppliesToLabel(scheme)}
            </div>
            {effectivePeriod === 'Always' ? (
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>Applies across academic years.</div>
            ) : null}
            <div className="muted" style={{ marginTop: 5, fontSize: 12 }}>
              Used in result calculation after weighted scores are computed. The final percentage is mapped to these grade bands.
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <StatusChip level={state.level} label={state.label} />
              <StatusChip level={passing != null ? 'ok' : 'warn'} label={passing != null ? `Passing rule: ${passing}% and above` : 'Passing rule missing'} />
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 12, border: `1px solid ${issues.length ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}` }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Grade Bands</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)' }}>
                {['Grade', 'Min %', 'Max %', 'Label', 'Result'].map((h) => (
                  <th key={h} style={{ padding: '8px 6px' }}>{h}</th>
                ))}
              </tr>
              <tbody>
                {sortedBands.map((b) => {
                  const isPass = passing != null && b.maxPercent >= passing;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 800 }}>{b.grade}</td>
                      <td style={{ padding: '8px 6px' }}>{b.minPercent}</td>
                      <td style={{ padding: '8px 6px' }}>{b.maxPercent}</td>
                      <td style={{ padding: '8px 6px' }}>{gradingBandLabel(b.grade)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <StatusChip level={isPass ? 'ok' : 'error'} label={isPass ? 'Pass' : 'Fail'} />
                      </td>
                    </tr>
                  );
                })}
                {sortedBands.length === 0 ? (
                  <tr><td colSpan={5} className="muted" style={{ padding: 12 }}>No grade bands configured.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {validationRows.map((row) => (
            <div key={row.label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: row.ok ? '#16a34a' : '#dc2626', fontWeight: 900 }}>{row.ok ? '✓' : '!'}</span>
              <span>{row.label}</span>
            </div>
          ))}
        </div>
        {issues.length > 0 ? (
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#991b1b', fontSize: 12 }}>
            {issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : (
          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>All grade band validations passed.</div>
        )}
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

function resolveInstancesToGenerate(component: AssessmentComponent): number {
  const r = component.calculationRule;
  if (r === 'SINGLE_ASSESSMENT' || r === 'HIGHEST' || r === 'MANUAL') return 1;
  if (r === 'BEST_N_OF_M' || r === 'SUM' || r === 'AVERAGE') return component.totalAssessments ?? 1;
  return 1;
}

function defaultGeneratedName(component: AssessmentComponent, sequence: number): string {
  if (sequence <= 1 && component.calculationRule === 'SINGLE_ASSESSMENT') return component.name;
  return `${component.name} ${sequence}`;
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
  const [filterGrade, setFilterGrade] = useState('');
  const [filterClassGroupId, setFilterClassGroupId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [panelMode, setPanelMode] = useState<'none' | 'create' | 'bulk'>('none');
  const [editingInstance, setEditingInstance] = useState<AssessmentInstance | null>(null);

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

  const onRefresh = async () => { await qc.invalidateQueries({ queryKey: ['exam-assessments'] }); };

  const publishedSchemes = schemes.filter((s) => s.status === 'PUBLISHED');
  const STATUS_OPTIONS: AssessmentInstanceStatus[] = ['DRAFT', 'SCHEDULED', 'MARKS_ENTRY_OPEN', 'MARKS_SUBMITTED', 'LOCKED', 'PUBLISHED', 'CANCELLED'];

  // Summary counts (from unfiltered data)
  const allData = assessmentsQ.data ?? [];
  const draftCount = allData.filter((a) => a.status === 'DRAFT').length;
  const scheduledCount = allData.filter((a) => a.status === 'SCHEDULED').length;
  const activeCount = allData.filter((a) => ['MARKS_ENTRY_OPEN','MARKS_SUBMITTED','LOCKED','PUBLISHED'].includes(a.status)).length;
  const cancelledCount = allData.filter((a) => a.status === 'CANCELLED').length;

  // Grade options derived from classGroups
  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    classGroups.forEach((cg) => { if (cg.gradeLevel != null) set.add(cg.gradeLevel); });
    return [...set].sort((a, b) => a - b);
  }, [classGroups]);

  // Section options filtered by selected grade
  const sectionOptions = useMemo(() => {
    if (!filterGrade) return classGroups;
    return classGroups.filter((cg) => String(cg.gradeLevel) === filterGrade);
  }, [classGroups, filterGrade]);

  // Scheme options filtered by status toggle
  const filteredSchemeOptions = useMemo(() => {
    if (!filterSchemeStatus) return schemes;
    return schemes.filter((s) => s.status === filterSchemeStatus);
  }, [schemes, filterSchemeStatus]);

  // Row action menu
  const [menuRect, setMenuRect] = useState<{ id: number; rect: DOMRect } | null>(null);

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
              onClick={() => { setPanelMode(panelMode === 'bulk' ? 'none' : 'bulk'); setEditingInstance(null); }}
            >
              {panelMode === 'bulk' ? 'Close' : 'Generate from Scheme'}
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
            { label: 'Cancelled', value: cancelledCount, bg: cancelledCount > 0 ? '#fee2e2' : '#f1f5f9', color: cancelledCount > 0 ? '#991b1b' : '#475569' },
          ].map((c) => (
            <div key={c.label} style={{ background: c.bg, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: c.color, marginTop: 2 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

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
            <SmartSelect value={filterClassGroupId} onChange={setFilterClassGroupId}
              options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
              placeholder="All classes" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
            <SmartSelect value={filterSubjectId} onChange={setFilterSubjectId}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} � ${s.name}` : s.name }))}
              placeholder="All subjects" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Status</span>
            <SelectKeeper value={filterStatus} onChange={setFilterStatus}
              emptyValueLabel="All statuses"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: instanceStatusLabel(s) }))} />
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

      {panelMode === 'bulk' ? (
        <BulkGeneratePanel
          publishedSchemes={publishedSchemes}
          classGroups={classGroups}
          subjects={subjects}
          onSuccess={async () => { setPanelMode('none'); await onRefresh(); }}
          onCancel={() => setPanelMode('none')}
        />
      ) : null}

      {editingInstance != null ? (
        <EditAssessmentForm
          instance={editingInstance}
          classGroups={classGroups}
          subjects={subjects}
          rooms={roomsQ.data ?? []}
          onSuccess={async () => { setEditingInstance(null); await onRefresh(); }}
          onCancel={() => setEditingInstance(null)}
        />
      ) : null}

      {/* Assessments table */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        {assessmentsQ.isLoading ? (
          <div className="muted" style={{ padding: 12 }}>Loading…</div>
        ) : assessmentsQ.isError ? (
          <div style={{ color: '#b91c1c', padding: 12 }}>Failed to load assessments.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                  {['Assessment', 'Scheme', 'Component', 'Class / Section', 'Subject', 'Date & Time', 'Room', 'Max Marks', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '8px 6px', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessments.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 32, textAlign: 'center' }}>
                      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                        {allData.length === 0
                          ? 'No exams scheduled yet. Generate schedules from a published assessment scheme or schedule an assessment manually.'
                          : 'No assessments match the current filters.'}
                      </div>
                      {allData.length === 0 && (
                        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                          <button type="button" className="btn secondary" onClick={(e) => { e.stopPropagation(); setPanelMode('bulk'); setEditingInstance(null); }}>
                            Generate from Scheme
                          </button>
                          <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setPanelMode('create'); setEditingInstance(null); }}>
                            + Schedule Assessment
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : assessments.map((a) => {
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
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 700 }}>{a.name}</td>
                      <td style={{ padding: '8px 6px', color: '#475569', fontSize: 12 }}>{a.schemeName}</td>
                      <td style={{ padding: '8px 6px', fontSize: 12 }}>{a.componentName}</td>
                      <td style={{ padding: '8px 6px', fontSize: 12 }}>{a.classGroupLabel}</td>
                      <td style={{ padding: '8px 6px', fontSize: 12 }}>{a.subjectName}</td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {a.assessmentDate ? (
                          <div><div>{a.assessmentDate}</div>{timeStr && <div className="muted" style={{ fontSize: 11 }}>{timeStr}</div>}</div>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td style={{ padding: '8px 6px', fontSize: 12 }}>{a.roomLabel ?? <span className="muted">—</span>}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12 }}>{a.maxMarks}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <StatusChip level={instanceStatusLevel(a.status)} label={instanceStatusLabel(a.status)} />
                      </td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }}
                            onClick={() => { setEditingInstance(a); setPanelMode('none'); }}>
                            {canEdit ? 'Edit' : 'View'}
                          </button>
                          {hasMenu && (
                            <>
                              <button type="button"
                                style={{ background: 'none', border: '1.5px solid rgba(15,23,42,0.15)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: '#64748b' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                  setMenuRect((prev) => prev?.id === a.id ? null : { id: a.id, rect });
                                }}
                                title="More actions"
                              >⋯</button>
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────── Create Assessment Form ─────────────────────────────

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
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} � ${s.name}` : s.name }))}
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
          <button type="button" className="btn" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Creating…' : 'Create Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Edit Assessment Form ───────────────────────────────

type AssessmentEditForm = {
  name: string; classGroupId: string; subjectId: string;
  assessmentDate: string; startTime: string; endTime: string;
  roomId: string; maxMarks: string; sequence: string;
};

function EditAssessmentForm({
  instance, classGroups, subjects, rooms, onSuccess, onCancel,
}: {
  instance: AssessmentInstance;
  classGroups: ClassGroup[];
  subjects: SubjectLite[];
  rooms: RoomLite[];
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AssessmentEditForm>({
    name: instance.name,
    classGroupId: String(instance.classGroupId),
    subjectId: String(instance.subjectId),
    assessmentDate: instance.assessmentDate ?? '',
    startTime: instance.startTime ?? '',
    endTime: instance.endTime ?? '',
    roomId: instance.roomId != null ? String(instance.roomId) : '',
    maxMarks: String(instance.maxMarks),
    sequence: String(instance.sequence),
  });
  const set = <K extends keyof AssessmentEditForm>(k: K, v: AssessmentEditForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const roomOptions = rooms.map((r) => ({ value: String(r.id), label: `${r.buildingName ?? r.building} / ${r.roomNumber}` }));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name is required');
      if (!form.classGroupId) throw new Error('Select class');
      if (!form.subjectId) throw new Error('Select subject');
      if (!form.maxMarks || Number(form.maxMarks) <= 0) throw new Error('Max marks must be > 0');
      return (await api.put<AssessmentInstance>(`/api/exams/assessments/${instance.id}`, {
        name: form.name.trim(),
        classGroupId: Number(form.classGroupId),
        subjectId: Number(form.subjectId),
        assessmentDate: form.assessmentDate || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        roomId: form.roomId ? Number(form.roomId) : null,
        maxMarks: Number(form.maxMarks),
        sequence: Number(form.sequence) || 1,
      })).data;
    },
    onSuccess: async () => { toast.success('Assessment updated'); await onSuccess(); },
    onError: (e) => toast.error('Could not update', formatApiError(e)),
  });

  return (
    <div className="card" style={{ padding: 12, border: '2px solid rgba(234,88,12,0.3)' }}>
      <div style={{ fontWeight: 900, marginBottom: 2 }}>Edit: {instance.name}</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{instance.schemeName} · {instance.componentName}</div>
      <div className="stack" style={{ gap: 10 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Assessment name</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class / Section</span>
            <SmartSelect value={form.classGroupId} onChange={(v) => set('classGroupId', v)}
              options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
              placeholder="Select class…" searchable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
            <SmartSelect value={form.subjectId} onChange={(v) => set('subjectId', v)}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} � ${s.name}` : s.name }))}
              placeholder="Select subject…" searchable />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Max marks</span>
            <input type="number" min={0.01} step="0.01" value={form.maxMarks} onChange={(e) => set('maxMarks', e.target.value)} />
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

// ─────────────────────────────── Bulk Generate Panel ────────────────────────────────

type BulkPreviewRow = { componentName: string; classGroupLabel: string; subjectName: string; names: string[] };

function BulkGeneratePanel({
  publishedSchemes, classGroups, subjects, onSuccess, onCancel,
}: {
  publishedSchemes: AssessmentScheme[];
  classGroups: ClassGroup[];
  subjects: SubjectLite[];
  onSuccess: () => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'configure' | 'preview'>('configure');
  const [schemeId, setSchemeId] = useState('');
  const [selectedClassGroupIds, setSelectedClassGroupIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<BulkPreviewRow[]>([]);

  const selectedScheme = publishedSchemes.find((s) => String(s.id) === schemeId) ?? null;
  const nonAttendanceComponents = (selectedScheme?.components ?? []).filter((c) => c.calculationRule !== 'ATTENDANCE_PERCENTAGE');

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!schemeId || selectedClassGroupIds.length === 0 || selectedSubjectIds.length === 0)
        throw new Error('Fill in scheme, classes, and subjects');
      return (await api.post<AssessmentInstance[]>(`/api/exams/schemes/${schemeId}/generate-assessments`, {
        classGroupIds: selectedClassGroupIds.map(Number),
        subjectIds: selectedSubjectIds.map(Number),
        assessmentDates: [],
      })).data;
    },
    onSuccess: async (data) => {
      toast.success('Generated', `${data.length} assessment${data.length === 1 ? '' : 's'} created.`);
      await onSuccess();
    },
    onError: (e) => toast.error('Could not generate', formatApiError(e)),
  });

  function buildPreview() {
    if (!selectedScheme) return;
    const cgMap = new Map(classGroups.map((cg) => [String(cg.id), cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}`]));
    const sMap = new Map(subjects.map((s) => [String(s.id), s.name]));
    const rows: BulkPreviewRow[] = [];
    for (const comp of nonAttendanceComponents) {
      const count = resolveInstancesToGenerate(comp);
      for (const cgId of selectedClassGroupIds) {
        for (const sId of selectedSubjectIds) {
          const names: string[] = [];
          for (let i = 1; i <= count; i++) names.push(defaultGeneratedName(comp, i));
          rows.push({ componentName: comp.name, classGroupLabel: cgMap.get(cgId) ?? cgId, subjectName: sMap.get(sId) ?? sId, names });
        }
      }
    }
    setPreview(rows);
    setStep('preview');
  }

  return (
    <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Generate Assessments from Scheme</div>
      {step === 'configure' ? (
        <div className="stack" style={{ gap: 12 }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Published scheme</span>
            <SmartSelect value={schemeId} onChange={(v) => setSchemeId(v)}
              options={publishedSchemes.map((s) => ({ value: String(s.id), label: s.name, meta: s.academicYearLabel ?? undefined }))}
              placeholder="Select scheme…" allowClear searchable />
          </label>
          {selectedScheme && nonAttendanceComponents.length > 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>
              Will generate:{' '}
              <strong>{nonAttendanceComponents.map((c) => `${c.name} ×${resolveInstancesToGenerate(c)}`).join(', ')}</strong>
            </div>
          ) : null}
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class / Sections</span>
            <MultiSelectKeeper value={selectedClassGroupIds} onChange={setSelectedClassGroupIds}
              options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
              placeholder="Select classes…" />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subjects</span>
            <MultiSelectKeeper value={selectedSubjectIds} onChange={setSelectedSubjectIds}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} � ${s.name}` : s.name }))}
              placeholder="Select subjects…" />
          </label>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn"
              disabled={!schemeId || selectedClassGroupIds.length === 0 || selectedSubjectIds.length === 0}
              onClick={buildPreview}>
              Preview ({selectedClassGroupIds.length} × {selectedSubjectIds.length})
            </button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {preview.length} group{preview.length === 1 ? '' : 's'} to be created (existing skipped automatically)
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)', background: 'rgba(15,23,42,0.03)' }}>
                  {['Component', 'Class', 'Subject', 'Names'].map((h) => (
                    <th key={h} style={{ padding: '6px 8px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                    <td style={{ padding: '5px 8px' }}>{row.componentName}</td>
                    <td style={{ padding: '5px 8px' }}>{row.classGroupLabel}</td>
                    <td style={{ padding: '5px 8px' }}>{row.subjectName}</td>
                    <td style={{ padding: '5px 8px', color: '#64748b' }}>{row.names.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>All dates start as blank (DRAFT status).</div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn secondary" onClick={() => setStep('configure')}>Back</button>
            <button type="button" className="btn" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
              {generateMutation.isPending ? 'Generating…' : 'Confirm & Generate'}
            </button>
          </div>
        </div>
      )}
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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900 }}>Marks Entry</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Showing assessments where marks can be entered. Use "Open Marks" on the Schedule tab to enable marks entry for an assessment.
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn secondary"
              onClick={() => { setPanelMode(panelMode === 'bulk' ? 'none' : 'bulk'); setEditingInstance(null); }}
            >
              {panelMode === 'bulk' ? 'Close' : 'Generate from Scheme'}
            </button>
            <button type="button" className="btn"
              onClick={() => { setPanelMode(panelMode === 'create' ? 'none' : 'create'); setEditingInstance(null); }}
            >
              {panelMode === 'create' ? 'Close form' : '+ Schedule Assessment'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Class / Section</span>
            <SmartSelect value={filterClassGroupId} onChange={setFilterClassGroupId}
              options={classGroups.map((cg) => ({ value: String(cg.id), label: cg.displayName ?? `Class ${cg.gradeLevel ?? '-'} ${cg.section ?? ''}` }))}
              placeholder="All classes" allowClear searchable />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Subject</span>
            <SmartSelect value={filterSubjectId} onChange={setFilterSubjectId}
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} � ${s.name}` : s.name }))}
              placeholder="All subjects" allowClear searchable />
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
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Status</span>
            <SelectKeeper value={filterStatus} onChange={setFilterStatus}
              emptyValueLabel="All statuses"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: instanceStatusLabel(s) }))} />
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        {assessmentsQ.isLoading ? (
          <div className="muted" style={{ padding: 12 }}>Loading…</div>
        ) : assessmentsQ.isError ? (
          <div style={{ color: '#b91c1c', padding: 12 }}>Failed to load assessments.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                  {['Assessment', 'Component', 'Class / Section', 'Subject', 'Date', 'Max Marks', 'Status', 'Action'].map((h) => (
                    <th key={h} style={{ padding: '8px 6px', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700 }}>{a.name}</td>
                    <td style={{ padding: '8px 6px' }}>{a.componentName}</td>
                    <td style={{ padding: '8px 6px' }}>{a.classGroupLabel}</td>
                    <td style={{ padding: '8px 6px' }}>{a.subjectName}</td>
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{a.assessmentDate ?? '—'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12 }}>{a.maxMarks}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <StatusChip level={instanceStatusLevel(a.status)} label={instanceStatusLabel(a.status)} />
                    </td>
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                      {a.status === 'MARKS_ENTRY_OPEN' ? (
                        <button type="button" className="btn"
                          onClick={() => setEnteringInstanceId(a.id)}>
                          Enter Marks
                        </button>
                      ) : (a.status === 'MARKS_SUBMITTED' || a.status === 'LOCKED') ? (
                        <button type="button" className="btn secondary"
                          onClick={() => setEnteringInstanceId(a.id)}>
                          View Marks
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>Open marks entry first</span>
                      )}
                    </td>
                  </tr>
                ))}
                {assessments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 14, textAlign: 'center' }}>
                      {filterStatus === 'MARKS_ENTRY_OPEN'
                        ? 'No assessments with marks entry open. Open marks entry from the Exam Schedule tab.'
                        : 'No assessments found for the selected filters.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────── Marks Entry Sheet ──────────────────────────────

type MarkRow = {
  studentId: number;
  admissionNo: string;
  fullName: string;
  markId: number | null;
  marksObtained: string;
  absent: boolean;
  absentReason: string;
  remarks: string;
  status: MarkStatus | null;
};

function MarksEntrySheet({ instanceId, onClose }: { instanceId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [synced, setSynced] = useState(false);

  const sheetQ = useQuery({
    queryKey: ['marks-sheet', instanceId],
    queryFn: async () => (await api.get<MarksEntrySheetDTO>(`/api/exams/assessments/${instanceId}/marks-sheet`)).data,
  });

  // Sync sheet data into local editable rows once loaded
  useMemo(() => {
    if (!sheetQ.data || synced) return;
    setRows(
      sheetQ.data.rows.map((r) => ({
        studentId: r.studentId,
        admissionNo: r.admissionNo,
        fullName: r.fullName,
        markId: r.markId,
        marksObtained: r.marksObtained != null ? String(r.marksObtained) : '',
        absent: r.absent,
        absentReason: r.absentReason ?? '',
        remarks: r.remarks ?? '',
        status: r.status,
      })),
    );
    setSynced(true);
  }, [sheetQ.data, synced]);

  const setRow = (studentId: number, patch: Partial<MarkRow>) =>
    setRows((prev) => prev.map((r) => (r.studentId === studentId ? { ...r, ...patch } : r)));

  const buildPayload = () => ({
    rows: rows.map((r) => ({
      studentId: r.studentId,
      marksObtained: r.absent ? null : r.marksObtained.trim() === '' ? null : Number(r.marksObtained),
      absent: r.absent,
      absentReason: r.absentReason.trim() || null,
      remarks: r.remarks.trim() || null,
    })),
  });

  const draftMutation = useMutation({
    mutationFn: async () => (await api.post<MarksEntrySheetDTO>(`/api/exams/assessments/${instanceId}/marks/draft`, buildPayload())).data,
    onSuccess: async (data) => {
      toast.success('Draft saved');
      setRows(data.rows.map((r) => ({
        studentId: r.studentId, admissionNo: r.admissionNo, fullName: r.fullName,
        markId: r.markId, marksObtained: r.marksObtained != null ? String(r.marksObtained) : '',
        absent: r.absent, absentReason: r.absentReason ?? '', remarks: r.remarks ?? '', status: r.status,
      })));
      await qc.invalidateQueries({ queryKey: ['exam-assessments-marks'] });
    },
    onError: (e) => toast.error('Could not save draft', formatApiError(e)),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Validate before submitting
      for (const r of rows) {
        if (!r.absent && r.marksObtained.trim() === '') {
          throw new Error(`Marks required for ${r.fullName} (or mark as absent)`);
        }
        const maxM = sheetQ.data?.maxMarks ?? 0;
        const val = Number(r.marksObtained);
        if (!r.absent && r.marksObtained.trim() !== '' && val > maxM) {
          throw new Error(`Marks for ${r.fullName} exceed max (${maxM})`);
        }
      }
      return (await api.post<MarksEntrySheetDTO>(`/api/exams/assessments/${instanceId}/marks/submit`, buildPayload())).data;
    },
    onSuccess: async (data) => {
      toast.success('Marks submitted', 'Assessment marked as submitted.');
      setRows(data.rows.map((r) => ({
        studentId: r.studentId, admissionNo: r.admissionNo, fullName: r.fullName,
        markId: r.markId, marksObtained: r.marksObtained != null ? String(r.marksObtained) : '',
        absent: r.absent, absentReason: r.absentReason ?? '', remarks: r.remarks ?? '', status: r.status,
      })));
      await qc.invalidateQueries({ queryKey: ['exam-assessments-marks'] });
      await qc.invalidateQueries({ queryKey: ['exam-assessments'] });
    },
    onError: (e) => toast.error('Could not submit', formatApiError(e)),
  });

  const sheet = sheetQ.data;
  const isLocked = sheet?.assessmentStatus === 'LOCKED' || sheet?.assessmentStatus === 'PUBLISHED';
  const isSubmitted = sheet?.assessmentStatus === 'MARKS_SUBMITTED';
  const maxMarks = sheet?.maxMarks ?? 100;

  const submittedCount = rows.filter((r) => r.status === 'SUBMITTED' || r.status === 'LOCKED').length;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* Back + header */}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <button type="button" className="btn secondary" onClick={onClose} style={{ marginBottom: 8 }}>
              ← Back to list
            </button>
            {sheet ? (
              <>
                <h2 style={{ margin: 0, fontSize: 18 }}>{sheet.assessmentName}</h2>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {sheet.schemeName} · {sheet.componentName} · {sheet.classGroupLabel} · {sheet.subjectName}
                  {sheet.assessmentDate ? ` · ${sheet.assessmentDate}` : ''}
                  {' · '}Max: <strong>{sheet.maxMarks}</strong> marks
                </div>
                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <StatusChip level={instanceStatusLevel(sheet.assessmentStatus)} label={instanceStatusLabel(sheet.assessmentStatus)} />
                  <StatusChip level="idle" label={`${submittedCount} / ${rows.length} submitted`} />
                </div>
              </>
            ) : sheetQ.isLoading ? (
              <div className="muted">Loading sheet…</div>
            ) : (
              <div style={{ color: '#b91c1c' }}>Could not load sheet.</div>
            )}
          </div>
          {!isLocked && !isSubmitted && sheet ? (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn secondary"
                disabled={draftMutation.isPending || submitMutation.isPending}
                onClick={() => draftMutation.mutate()}>
                {draftMutation.isPending ? 'Saving…' : 'Save Draft'}
              </button>
              <button type="button" className="btn"
                disabled={draftMutation.isPending || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}>
                {submitMutation.isPending ? 'Submitting…' : 'Submit Marks'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Marks table */}
      {rows.length > 0 ? (
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)' }}>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>#</th>
                  <th style={{ padding: '8px 6px' }}>Adm. No</th>
                  <th style={{ padding: '8px 6px' }}>Student Name</th>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Marks / {maxMarks}</th>
                  <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Absent</th>
                  <th style={{ padding: '8px 6px' }}>Remarks</th>
                  <th style={{ padding: '8px 6px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const marksNum = row.marksObtained.trim() === '' ? null : Number(row.marksObtained);
                  const marksError = !row.absent && marksNum !== null && marksNum > maxMarks;
                  return (
                    <tr key={row.studentId} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                      <td style={{ padding: '6px 6px', color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ padding: '6px 6px', fontSize: 12, color: '#64748b' }}>{row.admissionNo}</td>
                      <td style={{ padding: '6px 6px', fontWeight: 700 }}>{row.fullName}</td>
                      <td style={{ padding: '6px 6px' }}>
                        <input
                          type="number"
                          min={0}
                          max={maxMarks}
                          step="0.01"
                          value={row.absent ? '' : row.marksObtained}
                          disabled={isLocked || row.absent}
                          onChange={(e) => setRow(row.studentId, { marksObtained: e.target.value })}
                          style={{
                            width: 80,
                            borderColor: marksError ? '#dc2626' : undefined,
                            background: row.absent ? '#f1f5f9' : undefined,
                          }}
                        />
                        {marksError ? (
                          <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>Exceeds max</div>
                        ) : null}
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        <label className="row" style={{ gap: 6, alignItems: 'center', cursor: isLocked ? 'default' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={row.absent}
                            disabled={isLocked}
                            onChange={(e) => setRow(row.studentId, {
                              absent: e.target.checked,
                              marksObtained: e.target.checked ? '' : row.marksObtained,
                            })}
                          />
                          <span style={{ fontSize: 12 }}>Absent</span>
                        </label>
                        {row.absent ? (
                          <input
                            type="text"
                            value={row.absentReason}
                            disabled={isLocked}
                            placeholder="Reason (optional)"
                            onChange={(e) => setRow(row.studentId, { absentReason: e.target.value })}
                            style={{ marginTop: 4, fontSize: 12, width: 140 }}
                          />
                        ) : null}
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        <input
                          type="text"
                          value={row.remarks}
                          disabled={isLocked}
                          placeholder="Optional remarks"
                          onChange={(e) => setRow(row.studentId, { remarks: e.target.value })}
                          style={{ fontSize: 12, width: 140 }}
                        />
                      </td>
                      <td style={{ padding: '6px 6px' }}>
                        {row.status ? (
                          <StatusChip level={markStatusLevel(row.status)} label={row.status} />
                        ) : (
                          <span className="muted" style={{ fontSize: 11 }}>Unsaved</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!isLocked && !isSubmitted ? (
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn secondary"
                disabled={draftMutation.isPending || submitMutation.isPending}
                onClick={() => draftMutation.mutate()}>
                {draftMutation.isPending ? 'Saving…' : 'Save Draft'}
              </button>
              <button type="button" className="btn"
                disabled={draftMutation.isPending || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}>
                {submitMutation.isPending ? 'Submitting…' : 'Submit Marks'}
              </button>
            </div>
          ) : null}
          {isLocked ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Marks are locked. Contact admin to reopen if needed.
            </div>
          ) : isSubmitted ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Marks have been submitted. Contact admin to reopen for corrections.
            </div>
          ) : null}
        </div>
      ) : sheetQ.isSuccess ? (
        <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div className="muted">No students found in this class group.</div>
        </div>
      ) : null}
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

// ─────────────────────────────── Results Panel ───────────────────────────────

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
  const [filterClassGroupId, setFilterClassGroupId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Preview mode: results fetched on demand but not persisted
  const [previewResults, setPreviewResults] = useState<StudentResultDTO[] | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const qc = useQueryClient();

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
                options={filteredSchemeOptions.map((s) => ({ value: String(s.id), label: s.name, meta: s.status === 'PUBLISHED' ? 'Published' : s.status === 'ARCHIVED' ? 'Archived' : 'Draft' }))}
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
              options={subjects.map((s) => ({ value: String(s.id), label: s.code ? `${s.code} � ${s.name}` : s.name }))}
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

