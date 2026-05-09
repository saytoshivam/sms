/** Row shape returned by GET /api/students (Spring Data page content). */
export type StudentListRow = {
  id: number;
  admissionNo: string;
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  classGroupId?: number | null;
  classGroupCode?: string | null;
  classGroupDisplayName?: string | null;
  classGroupGradeLevel?: number | null;
  classGroupSection?: string | null;
  rollNo?: string | null;
  primaryGuardianName?: string | null;
  primaryGuardianPhone?: string | null;
  documentVerifiedCount?: number;
  documentPendingCount?: number;
  status?: StudentLifecycleStatus | null;
};

export type StudentLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'ALUMNI';

export type SpringPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export const STUDENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'ALUMNI', label: 'Alumni' },
];

export function studentFullName(s: Pick<StudentListRow, 'firstName' | 'middleName' | 'lastName'>): string {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').trim();
}

export function classSectionLabel(s: StudentListRow): string {
  if (s.classGroupDisplayName) return s.classGroupDisplayName;
  const g = s.classGroupGradeLevel;
  const sec = s.classGroupSection;
  if (g != null && sec) return `Grade ${g} · ${sec}`;
  if (g != null) return `Grade ${g}`;
  return '—';
}
