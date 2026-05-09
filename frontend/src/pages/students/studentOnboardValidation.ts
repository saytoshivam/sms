import type { ClassGroupRow } from '../../components/ClassGroupSearchCombobox';
import type { GuardianDraft, StudentOnboardingDraft } from './studentOnboardTypes';

export function studentBasicsErrors(student: StudentOnboardingDraft['student']): Record<string, string> {
  const e: Record<string, string> = {};
  if (!student.admissionNo.trim()) e.admissionNo = 'Admission number is required.';
  if (!student.firstName.trim()) e.firstName = 'First name is required.';
  if (!student.lastName.trim()) e.lastName = 'Last name is required.';
  return e;
}

export function placementErrors(
  enrollment: StudentOnboardingDraft['enrollment'],
  rawSectionCandidates: readonly { value: string }[],
  matchingGroups: readonly ClassGroupRow[],
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!enrollment.academicYearId.trim()) e.academicYearId = 'Academic year is required.';
  if (!enrollment.gradeLevel.trim()) e.gradeLevel = 'Class / grade is required.';
  if (rawSectionCandidates.length > 0 && !enrollment.section.trim()) {
    e.section = 'Section is required for this grade.';
  }
  const g = enrollment.gradeLevel.trim();
  if (g && matchingGroups.length === 0) {
    e.classGroupId = 'No class group exists for this selection. Add it under Classes & sections.';
  }
  const cg = enrollment.classGroupId.trim();
  const okCg = cg && matchingGroups.some((m) => String(m.id) === cg);
  if (matchingGroups.length > 0 && !okCg) {
    e.classGroupId = 'Choose the timetable class group.';
  }
  return e;
}

export function guardiansErrors(guardians: GuardianDraft[]): Record<string, string> {
  const e: Record<string, string> = {};
  let primary = 0;
  guardians.forEach((g, ix) => {
    if (!g.name.trim()) e[`guardian_${ix}_name`] = 'Name is required.';
    if (!g.relation.trim()) e[`guardian_${ix}_relation`] = 'Relation is required.';
    if (!g.phone.trim()) e[`guardian_${ix}_phone`] = 'Phone is required.';
    if (g.primaryGuardian) primary++;
  });
  if (primary !== 1) e.guardians = 'Exactly one guardian must be marked primary.';
  return e;
}

/** Full checklist for submit — steps 1–7. */
export function allRequiredErrors(
  d: StudentOnboardingDraft,
  rawSections: readonly { value: string }[],
  groups: ClassGroupRow[],
) {
  return {
    ...studentBasicsErrors(d.student),
    ...placementErrors(d.enrollment, rawSections, groups),
    ...guardiansErrors(d.guardians),
  };
}

/** Human-readable items for summary panel — ordered. */
export function missingAdmissionLabels(
  d: StudentOnboardingDraft,
  rawSections: readonly { value: string }[],
  groups: ClassGroupRow[],
): string[] {
  const labels: string[] = [];
  if (!d.student.admissionNo.trim()) labels.push('Admission number');
  if (!d.student.firstName.trim()) labels.push('First name');
  if (!d.student.lastName.trim()) labels.push('Last name');
  if (!d.enrollment.academicYearId.trim()) labels.push('Academic year');
  if (!d.enrollment.gradeLevel.trim()) labels.push('Class / grade');
  if (rawSections.length > 0 && !d.enrollment.section.trim()) labels.push('Section');
  const g = d.enrollment.gradeLevel.trim();
  if (g && groups.length === 0) labels.push('Class group (configure Classes & sections)');
  const cg = d.enrollment.classGroupId.trim();
  const okCg = cg && groups.some((m) => String(m.id) === cg);
  if (groups.length > 0 && !okCg) labels.push('Timetable class group');
  if (!d.guardians.some((x) => x.primaryGuardian)) labels.push('Primary guardian');
  d.guardians.forEach((gr, ix) => {
    if (!gr.name.trim()) labels.push(`Guardian ${ix + 1} name`);
    if (!gr.relation.trim()) labels.push(`Guardian ${ix + 1} relation`);
    if (!gr.phone.trim()) labels.push(`Guardian ${ix + 1} phone`);
  });
  let prim = 0;
  for (const gr of d.guardians) {
    if (gr.primaryGuardian) prim++;
  }
  if (prim !== 1) labels.push('Mark exactly one primary guardian');

  const seen = new Set<string>();
  return labels.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
}

export function errorsForAdmissionStep(
  stepIndex: number,
  d: StudentOnboardingDraft,
  rawSections: readonly { value: string }[],
  groups: ClassGroupRow[],
): Record<string, string> {
  if (stepIndex === 0) return studentBasicsErrors(d.student);
  if (stepIndex === 1) return placementErrors(d.enrollment, rawSections, groups);
  if (stepIndex === 2) return guardiansErrors(d.guardians);
  return {};
}
