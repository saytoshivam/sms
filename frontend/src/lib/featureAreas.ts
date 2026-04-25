/**
 * Product feature taxonomy — all modules roll up to one of these areas.
 * (Used for navigation grouping, future entitlements, and docs.)
 */
export const FeatureArea = {
  USER_ACCESS: 'User & Access Management',
  ACADEMIC: 'Academic Management',
  ATTENDANCE: 'Attendance',
  EXAMS_RESULTS: 'Exams & Results',
  FEES_FINANCE: 'Fees & Finance',
  COMMUNICATION: 'Communication',
  LIBRARY: 'Library',
  TRANSPORT: 'Transport',
  REPORTS_ANALYTICS: 'Reports & Analytics',
  /** Owner / board: analytics, subscription intent, budgets, branding, access visibility. */
  SCHOOL_OWNER: 'School Owner & Management',
  SYSTEM_CONFIG: 'System Configuration',
} as const;

export type FeatureAreaId = keyof typeof FeatureArea;
