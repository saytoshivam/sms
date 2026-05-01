/** Shared between Setup wizard Step 1 and Operations Hub → Time slots (Basic info). */

export type AttendanceMode = 'DAILY' | 'LECTURE_WISE';

export type BasicTimeWindow = { startTime: string; endTime: string };

export type BasicSetupDraft = {
  academicYear: string;
  startMonth: number;
  workingDays: string[];
  attendanceMode: AttendanceMode;
  openWindows: BasicTimeWindow[];
  lectureDurationMinutes: number | '';
};

export type BasicInfoApiShape = {
  academicYear?: string;
  startMonth?: number;
  workingDays?: string[];
  attendanceMode?: AttendanceMode;
  openWindows?: BasicTimeWindow[] | null;
  schoolStartTime?: string;
  schoolEndTime?: string;
  lectureDurationMinutes?: number | null;
};

const WEEK_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export function canonicalizeWorkingDays(days: string[]): string[] {
  const s = new Set(days);
  return WEEK_ORDER.filter((d) => s.has(d));
}

export function academicYearSuggestedDefault(): string {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() + 1 <= 3 ? y - 1 : y;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function emptyBasicSetupDraft(): BasicSetupDraft {
  return {
    academicYear: academicYearSuggestedDefault(),
    startMonth: 4,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    attendanceMode: 'LECTURE_WISE',
    openWindows: [{ startTime: '09:00', endTime: '17:00' }],
    lectureDurationMinutes: 45,
  };
}

/** Map GET /api/v1/onboarding/basic-info → editor draft */
export function basicInfoApiToDraft(api: BasicInfoApiShape | null | undefined): BasicSetupDraft {
  const base = emptyBasicSetupDraft();
  if (!api) return base;
  const ow =
    Array.isArray(api.openWindows) && api.openWindows.length > 0
      ? api.openWindows
      : [{ startTime: api.schoolStartTime || '09:00', endTime: api.schoolEndTime || '17:00' }];
  return {
    academicYear: (api.academicYear?.trim()?.length ?? 0) ? (api.academicYear as string) : base.academicYear,
    startMonth: typeof api.startMonth === 'number' ? api.startMonth : base.startMonth,
    workingDays:
      Array.isArray(api.workingDays) && api.workingDays.length ? canonicalizeWorkingDays(api.workingDays) : base.workingDays,
    attendanceMode: api.attendanceMode === 'DAILY' || api.attendanceMode === 'LECTURE_WISE'
      ? api.attendanceMode
      : base.attendanceMode,
    openWindows: ow,
    lectureDurationMinutes:
      typeof api.lectureDurationMinutes === 'number' && Number.isFinite(api.lectureDurationMinutes)
        ? api.lectureDurationMinutes
        : 45,
  };
}

/** Body for PUT /api/v1/onboarding/basic-info (matches wizard semantics). */
export function draftToBasicInfoPutPayload(d: BasicSetupDraft): {
  academicYear: string;
  startMonth: number;
  workingDays: string[];
  attendanceMode: AttendanceMode;
  openWindows: BasicTimeWindow[];
  schoolStartTime: string;
  schoolEndTime: string;
  lectureDurationMinutes: number | null;
} {
  const first = d.openWindows[0];
  const last = d.openWindows[d.openWindows.length - 1];
  return {
    academicYear: d.academicYear.trim(),
    startMonth: d.startMonth,
    workingDays: d.workingDays,
    attendanceMode: d.attendanceMode,
    openWindows: d.openWindows,
    schoolStartTime: first?.startTime ?? '09:00',
    schoolEndTime: last?.endTime ?? '17:00',
    lectureDurationMinutes: d.lectureDurationMinutes === '' ? null : Number(d.lectureDurationMinutes),
  };
}

/** `null` if valid */
export function validateBasicSetupDraft(d: BasicSetupDraft): string | null {
  const y = d.academicYear.trim();
  if (y.length < 4) return 'Enter a valid academic year (at least 4 characters).';
  if (!d.workingDays.length) return 'Pick at least one working day.';
  if (d.openWindows.length === 0) return 'Add at least one school open window.';
  for (const w of d.openWindows) {
    if (!w.startTime || !w.endTime || w.startTime >= w.endTime) return 'Each open window needs an end time after start.';
  }
  if (d.lectureDurationMinutes === '') return 'Enter lecture duration (minutes).';
  const ld = Number(d.lectureDurationMinutes);
  if (!Number.isFinite(ld) || ld < 10 || ld > 240) return 'Lecture duration must be between 10 and 240 minutes.';
  return null;
}
