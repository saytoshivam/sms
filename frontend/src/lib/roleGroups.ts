/** Matches {@code com.myhaimi.sms.security.RoleNames} — school leadership workspace. */
export const SCHOOL_LEADERSHIP_ROLES = ['SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HOD'] as const;

/** Teacher + class teacher (instructional staff). */
export const TEACHING_ROLES = ['TEACHER', 'CLASS_TEACHER'] as const;

export function hasSchoolLeadershipRole(roles: string[]): boolean {
  return SCHOOL_LEADERSHIP_ROLES.some((r) => roles.includes(r));
}

export function hasTeachingRole(roles: string[]): boolean {
  return TEACHING_ROLES.some((r) => roles.includes(r));
}
