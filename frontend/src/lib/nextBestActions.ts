import { firstIncompleteWizardStepId, REQUIRED_STEPS } from './onboardingWizardMeta';
import type { ImpactSummary } from './impactStore';
import type { StatusLevel } from '../components/module/ModulePage';

/**
 * Pure function: given the current readiness signals + uncommitted impact,
 * derive a stable, prioritised list of "next best actions" the user should
 * take. No fetching here — callers pass already-fetched values.
 *
 * The Operations Hub uses this; module pages can also call it to render their
 * own contextual prompt (e.g. "regen needed in Timetable" inside Subjects).
 */
export type Nba = {
  id: string;
  level: StatusLevel;
  title: string;
  detail?: string;
  to: string;
  cta: string;
  priority: number;
};

export type ReadinessSignal = {
  level: StatusLevel;
  /** One-line headline, e.g. "12 sections · 0 issues". */
  primary: string;
  secondary?: string;
};

export type NextBestActionInput = {
  completedSteps: string[];
  impact: ImpactSummary;
  /** True when the timetable is published and considered authoritative. */
  hasPublishedTimetable?: boolean;
  /** Live conflict counts in the current draft. */
  timetableConflicts?: { hard: number; soft: number };
  /** True if the system has a draft (or published) timetable with at least one entry. */
  hasTimetableEntries?: boolean;
  signals: {
    academic: ReadinessSignal;
    subjects: ReadinessSignal;
    teachers: ReadinessSignal;
    rooms: ReadinessSignal;
    time: ReadinessSignal;
  };
};

/** Stable scoring constants — adjust here, not at call sites. */
const PRI_TIMETABLE_HARD_CONFLICTS = 1300;
const PRI_TIMETABLE_SOFT_CONFLICTS = 350;
const PRI_HARD_BREAKAGE = 1100;
const PRI_SECTION_ISSUES = 1000;
const PRI_TIME_INCOMPLETE = 700;
const PRI_SETUP_BLOCKER = 600;
const PRI_ACADEMIC_WARN = 500;
const PRI_TEACHER_WARN = 400;
const PRI_REGEN_AFTER_IMPACT = 300;
const PRI_TIMETABLE_FIRST_GEN = 250;
const PRI_TIMETABLE_OPEN = 100;

export function computeNextBestActions(input: NextBestActionInput): Nba[] {
  const out: Nba[] = [];
  const completedDone = REQUIRED_STEPS.filter((s) => input.completedSteps.includes(s)).length;
  const setupComplete = completedDone === REQUIRED_STEPS.length;

  // Setup blockers
  const firstMissing = firstIncompleteWizardStepId(input.completedSteps);
  if (firstMissing) {
    out.push({
      id: `setup-${firstMissing}`,
      level: 'warn',
      title: `Finish setup: ${firstMissing.replace(/_/g, ' ').toLowerCase()}`,
      detail: `${completedDone}/${REQUIRED_STEPS.length} required steps complete`,
      to: '/app/operations-hub',
      cta: 'Open checklist',
      priority: PRI_SETUP_BLOCKER,
    });
  }

  // Hard breakages first
  if (input.signals.subjects.level === 'error') {
    out.push({
      id: 'subjects-orphan',
      level: 'error',
      title: input.signals.subjects.secondary ?? 'Fix subject references',
      detail: 'Allocations point to subjects that no longer exist.',
      to: '/app/subjects',
      cta: 'Open Subjects',
      priority: PRI_HARD_BREAKAGE,
    });
  }
  if (input.signals.academic.level === 'error') {
    out.push({
      id: 'academic-issues',
      level: 'error',
      title: 'Sections need fixing',
      detail: input.signals.academic.secondary,
      to: '/app/academic',
      cta: 'Open Academic structure',
      priority: PRI_SECTION_ISSUES,
    });
  } else if (input.signals.academic.level === 'warn') {
    out.push({
      id: 'academic-warn',
      level: 'warn',
      title: 'Map remaining sections',
      detail: input.signals.academic.secondary,
      to: '/app/academic',
      cta: 'Open Academic structure',
      priority: PRI_ACADEMIC_WARN,
    });
  }

  // Resource warnings
  if (input.signals.teachers.level === 'warn') {
    out.push({
      id: 'teachers-overload',
      level: 'warn',
      title: 'Some teachers are over weekly load',
      detail: input.signals.teachers.secondary,
      to: '/app/teachers',
      cta: 'Open Teachers',
      priority: PRI_TEACHER_WARN,
    });
  }
  if (input.signals.time.level !== 'ok' && input.signals.time.level !== 'idle') {
    out.push({
      id: 'time-incomplete',
      level: 'warn',
      title: 'Set working hours and period length',
      detail: input.signals.time.secondary,
      to: '/app/time',
      cta: 'Open Time slots',
      priority: PRI_TIME_INCOMPLETE,
    });
  }

  // First-priority: live hard conflicts in the current draft block publish.
  const hardConflicts = input.timetableConflicts?.hard ?? 0;
  const softConflicts = input.timetableConflicts?.soft ?? 0;
  if (setupComplete && hardConflicts > 0) {
    out.push({
      id: 'timetable-hard-conflicts',
      level: 'error',
      title: `Resolve ${hardConflicts} hard conflict${hardConflicts === 1 ? '' : 's'}`,
      detail: 'Publish is blocked until these are fixed. Auto-fix or regenerate from the Conflicts tab.',
      to: '/app/timetable?tab=conflicts',
      cta: 'Open Conflicts',
      priority: PRI_TIMETABLE_HARD_CONFLICTS,
    });
  }

  // Regeneration prompt: pending impact and setup is otherwise OK.
  if (setupComplete && input.impact.total > 0) {
    out.push({
      id: 'timetable-regen',
      level: input.impact.hard > 0 ? 'error' : 'warn',
      title:
        input.impact.hard > 0
          ? `Regenerate to apply ${input.impact.hard} hard change${input.impact.hard === 1 ? '' : 's'}`
          : `Regenerate timetable — ${input.impact.total} change${input.impact.total === 1 ? '' : 's'} since last publish`,
      detail: 'Setup has changed; the engine needs to re-plan.',
      to: '/app/timetable',
      cta: 'Open Timetable',
      priority: PRI_REGEN_AFTER_IMPACT + (input.impact.hard > 0 ? 800 : 0),
    });
  }

  // First-time generation: setup is ready but no entries / not published yet.
  if (
    setupComplete &&
    input.impact.total === 0 &&
    hardConflicts === 0 &&
    (input.hasTimetableEntries === false || input.hasPublishedTimetable === false)
  ) {
    const firstRun = input.hasTimetableEntries === false;
    out.push({
      id: 'timetable-first-gen',
      level: 'info',
      title: firstRun ? 'Generate the first timetable' : 'Publish the current draft',
      detail: firstRun
        ? 'Setup looks complete — kick off the engine.'
        : 'Draft has no conflicts and is ready to publish.',
      to: '/app/timetable',
      cta: 'Open Timetable',
      priority: PRI_TIMETABLE_FIRST_GEN,
    });
  }

  // Soft conflicts in the draft — advisory.
  if (setupComplete && hardConflicts === 0 && softConflicts > 0) {
    out.push({
      id: 'timetable-soft-conflicts',
      level: 'warn',
      title: `Review ${softConflicts} soft conflict${softConflicts === 1 ? '' : 's'}`,
      detail: 'Publish is allowed but quality could be improved.',
      to: '/app/timetable?tab=conflicts',
      cta: 'Open Conflicts',
      priority: PRI_TIMETABLE_SOFT_CONFLICTS,
    });
  }

  // Idle state — nudge to open the workspace.
  if (setupComplete && out.length === 0) {
    out.push({
      id: 'timetable-open',
      level: 'info',
      title: 'Review the timetable',
      detail: 'Everything looks healthy — open the workspace to review or tweak.',
      to: '/app/timetable',
      cta: 'Open Timetable',
      priority: PRI_TIMETABLE_OPEN,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
