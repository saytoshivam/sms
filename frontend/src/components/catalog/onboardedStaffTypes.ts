/** Staff roster row from onboarding API */
export type OnboardedStaffRow = {
  staffId: number;
  fullName: string;
  email: string;
  phone: string | null;
  employeeNo: string | null;
  designation: string | null;
  roles: string[];
  subjectCodes: string[];
  hasLoginAccount: boolean;
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[];
};

export type StaffDraft = {
  fullName: string;
  email: string;
  phone?: string | null;
  employeeNo?: string | null;
  designation?: string | null;
  roles: string[];
  teachableSubjectIds?: number[];
  createLoginAccount?: boolean;
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[];
};

export type StaffDeleteInfo = { canDelete: boolean; reasons: string[] };
