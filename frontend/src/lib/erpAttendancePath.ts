import { hasSchoolLeadershipRole } from './roleGroups';

/** Leadership daily monitor vs standard attendance capture. */
export function erpAttendancePath(roles: string[] | undefined, schoolAttendanceMode: 'DAILY' | 'LECTURE_WISE' | undefined): string {
  const leader = hasSchoolLeadershipRole(roles ?? []);
  const mode = schoolAttendanceMode ?? 'LECTURE_WISE';
  return leader && mode === 'DAILY' ? '/app/attendance/daily-monitor' : '/app/attendance';
}
