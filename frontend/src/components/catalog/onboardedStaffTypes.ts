/** Staff roster row — matches StaffSummaryDTO from GET /api/staff */
export type OnboardedStaffRow = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  employeeNo: string | null;
  designation: string | null;
  staffType?: string | null;
  roles: string[];
  teachableSubjectCodes: string[];
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
  staffType?: string | null;
  roles: string[];
  teachableSubjectIds?: number[];
  createLoginAccount?: boolean;
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[];
};

export type StaffDeleteInfo = { canDelete: boolean; reasons: string[] };
