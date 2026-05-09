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

/**
 * Where users land when opening `/app` index or post-login navigation.
 * School leaders and instructional staff hit the dashboard (distinct shells per persona).
 */
export function defaultAppHomePath(roles: string[]): '/app' | '/app/dashboard' {
  if (hasSchoolLeadershipRole(roles)) return '/app/dashboard';
  if (hasTeachingRole(roles) && !hasSchoolLeadershipRole(roles)) return '/app/dashboard';
  return '/app';
}
