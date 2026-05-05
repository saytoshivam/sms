/** Mirrors {@code SubjectAllocationVenueRequirement} — never infer from subject name. */
export const SUBJECT_VENUE_REQUIREMENTS = [
  'STANDARD_CLASSROOM',
  'LAB_REQUIRED',
  'ACTIVITY_SPACE',
  'SPORTS_AREA',
  'SPECIALIZED_ROOM',
  'FLEXIBLE',
] as const;

export type SubjectVenueRequirement = (typeof SUBJECT_VENUE_REQUIREMENTS)[number];

export const SUBJECT_VENUE_LABELS: Record<SubjectVenueRequirement, string> = {
  STANDARD_CLASSROOM: 'Standard classroom',
  LAB_REQUIRED: 'Lab required',
  ACTIVITY_SPACE: 'Activity space',
  SPORTS_AREA: 'Sports area',
  SPECIALIZED_ROOM: 'Specialized room',
  FLEXIBLE: 'Flexible (any room)',
};

export function parseSubjectVenueRequirement(raw: string | null | undefined): SubjectVenueRequirement {
  if (!raw) return 'STANDARD_CLASSROOM';
  const u = String(raw).trim().toUpperCase();
  return (SUBJECT_VENUE_REQUIREMENTS as readonly string[]).includes(u) ? (u as SubjectVenueRequirement) : 'STANDARD_CLASSROOM';
}
