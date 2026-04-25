/**
 * Single source of truth for onboarding steps — keep in sync with
 * `/api/v1/onboarding` server expectations.
 */
export const REQUIRED_STEPS = [
  'BASIC_INFO',
  'CLASSES',
  'SUBJECTS',
  'STAFF',
  'ACADEMIC_STRUCTURE',
  'TIMETABLE',
  'STUDENTS',
] as const;

export const OPTIONAL_STEPS = ['ROOMS', 'FEES', 'NOTIFICATIONS', 'BRANDING'] as const;

export const WIZARD_STEPS = [
  { id: 'BASIC_INFO', title: 'Basic setup', optional: false },
  { id: 'CLASSES', title: 'Classes & sections', optional: false },
  { id: 'SUBJECTS', title: 'Subjects', optional: false },
  { id: 'ROOMS', title: 'Rooms', optional: true },
  { id: 'STAFF', title: 'Staff & roles', optional: false },
  { id: 'ACADEMIC_STRUCTURE', title: 'Academic structure', optional: false },
  { id: 'TIMETABLE', title: 'Timetable', optional: false },
  { id: 'STUDENTS', title: 'Students', optional: false },
  { id: 'FEES', title: 'Fees', optional: true },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

/** Map old server statuses to the closest step in the 9-step UI (for returning users). */
const LEGACY_ONBOARDING_STATUS: Record<string, WizardStepId> = {
  SUBJECT_CLASS_MAPPING: 'ACADEMIC_STRUCTURE',
  CLASS_DEFAULT_ROOMS: 'ACADEMIC_STRUCTURE',
  ROLES: 'STAFF',
  NOTIFICATIONS: 'FEES',
  BRANDING: 'FEES',
};

export function statusToStepIndex(status: string | undefined): number {
  if (!status) return 0;
  const mapped = LEGACY_ONBOARDING_STATUS[status] ?? (status as WizardStepId);
  const i = WIZARD_STEPS.findIndex((s) => s.id === mapped);
  return i >= 0 ? i : 0;
}

export function onboardingStepHref(stepId: string) {
  return `/app/onboarding?step=${encodeURIComponent(stepId)}`;
}

/**
 * First step not done in wizard order: required steps first, then optional.
 * Returns null when all steps are marked complete.
 */
export function firstIncompleteWizardStepId(completedSteps: string[] | undefined | null): string | null {
  const done = new Set(completedSteps ?? []);
  for (const s of WIZARD_STEPS) {
    if (done.has(s.id)) continue;
    if (!s.optional) return s.id;
  }
  for (const s of WIZARD_STEPS) {
    if (done.has(s.id)) continue;
    if (s.optional) return s.id;
  }
  return null;
}

/** Dashboard: which workspace category each step belongs to. */
export const DASHBOARD_WIZARD_BY_AREA = {
  SYSTEM_CONFIG: ['BASIC_INFO'] as const,
  ACADEMIC: ['CLASSES', 'SUBJECTS', 'ROOMS', 'ACADEMIC_STRUCTURE', 'TIMETABLE'] as const,
  USER_ACCESS: ['STAFF', 'STUDENTS'] as const,
  FEES_FINANCE: ['FEES'] as const,
} as const;

export const DASHBOARD_WIZARD_ICONS: Record<WizardStepId, string> = {
  BASIC_INFO: '🧭',
  CLASSES: '🧩',
  SUBJECTS: '📐',
  ROOMS: '🚪',
  STAFF: '👔',
  ACADEMIC_STRUCTURE: '🔗',
  TIMETABLE: '🗒️',
  STUDENTS: '✏️',
  FEES: '🧾',
};

export function setupWizardLabel(step: (typeof WIZARD_STEPS)[number]): string {
  return `Setup: ${step.title}`;
}
