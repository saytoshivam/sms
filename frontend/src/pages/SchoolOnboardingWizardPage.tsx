import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { WorkspaceHero } from '../components/workspace/WorkspaceKit';
import { SelectKeeper } from '../components/SelectKeeper';
import { DateKeeper } from '../components/DateKeeper';
import { MultiSelectKeeper } from '../components/MultiSelectKeeper';
import { ClassGroupSearchCombobox } from '../components/ClassGroupSearchCombobox';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SavedRoomsCatalogPanel } from '../components/catalog/SavedRoomsCatalogPanel';
import { SavedSubjectsCatalogPanel } from '../components/catalog/SavedSubjectsCatalogPanel';
import { SavedClassesSectionsCatalogPanel } from '../components/catalog/SavedClassesSectionsCatalogPanel';
import { OnboardedStaffCatalogPanel } from '../components/catalog/OnboardedStaffCatalogPanel';
import { AcademicStructureSetupStep } from '../components/AcademicStructureSetupStep';
import Step7TimetableWorkspace from '../components/Step7TimetableWorkspace';
import type { ClassSubjectConfigRow, SectionSubjectOverrideRow } from '../lib/academicStructureUtils';
import { buildEffectiveAllocRows } from '../lib/academicStructureUtils';
import type { AssignmentSlotMeta } from '../lib/academicStructureSmartAssign';
import {
  OPTIONAL_STEPS,
  REQUIRED_STEPS,
  WIZARD_STEPS,
  statusToStepIndex,
} from '../lib/onboardingWizardMeta';
import {
  basicInfoApiToDraft,
  draftToBasicInfoPutPayload,
  emptyBasicSetupDraft,
  validateBasicSetupDraft,
  type BasicSetupDraft,
} from '../lib/schoolBasicSetup';
import { SchoolBasicSetupForm } from '../components/setup/SchoolBasicSetupForm';
import { pageContent, type SpringPage } from '../lib/springPageContent';

/** Local-only draft for academic step (server still requires a complete save to continue onboarding). */
const ACADEMIC_LOCAL_DRAFT_KEY = 'sms-onboarding-academic-structure-v1';

/** Stable while academic query is loading — prevents child effects keyed off `subjects` from thrashing. */
const EMPTY_ACADEMIC_SUBJECTS: Array<{ id: number; code: string; name: string; weeklyFrequency: number | null }> = [];

type Progress = { onboardingStatus: string; completedSteps: string[] };
type BasicInfo = {
  academicYear: string;
  startMonth: number;
  workingDays: string[];
  attendanceMode: 'DAILY' | 'LECTURE_WISE';
  openWindows?: { startTime: string; endTime: string }[];
  schoolStartTime: string;
  schoolEndTime: string;
  lectureDurationMinutes: number;
};
type SubjectDraft = {
  name: string;
  code: string;
  weeklyFrequency: number;
};

type RoomDraft = {
  building: string;
  floorNumber?: number | null;
  floorName?: string | null;
  roomNumber: string;
  type: 'CLASSROOM' | 'LAB' | 'LIBRARY' | 'AUDITORIUM' | 'SPORTS_ROOM' | 'STAFF_ROOM' | 'OFFICE' | 'OTHER';
  labType?: 'PHYSICS' | 'CHEMISTRY' | 'COMPUTER' | 'OTHER' | null;
  capacity: number | null;
};

type StaffDraft = {
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

type StaffManualField = 'fullName' | 'email' | 'phone' | 'employeeNo' | 'designation' | 'roles' | 'subjects';

type FeeClassRow = { classGroupId: number; label: string; totalAmount: number | '' };
type FeeInstallmentRow = { label: string; dueDateIso: string; percent: number | '' };
type FeesSetup = {
  classFees: { classGroupId: number; totalAmount: number }[];
  installments: { label: string; dueDateIso: string; percent: number }[];
  lateFeeRule?: { graceDays?: number | null; lateFeePerDay?: number | null } | null;
};

type ClassGroupLite = { id: number; code?: string | null; gradeLevel?: number | null; section?: string | null; name?: string | null };
type SubjectCatalogRow = { id: number; code: string; name: string; weeklyFrequency?: number | null };
type ClassDefaultRoomRow = {
  classGroupId: number;
  code: string;
  displayName: string;
  gradeLevel: number | null;
  section: string | null;
  defaultRoomId: number | null;
};
type RoomOption = {
  id: number;
  building?: string | null;
  buildingName?: string | null;
  floorName?: string | null;
  rawFloorNumber?: number | null;
  rawFloorName?: string | null;
  roomNumber: string;
  type?: string | null;
  capacity?: number | null;
  labType?: string | null;
  isSchedulable?: boolean;
};

type DeleteInfo = { canDelete: boolean; reasons: string[] };

type GradeSectionsRow = { gradeLevel: number; sectionsText: string };

type StudentDraft = {
  admissionNo: string;
  firstName: string;
  lastName?: string | null;
  classGroupId?: number | null;
  classGroupCode?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
};

function percentCompleted(completed: string[]) {
  const set = new Set(completed);
  let done = 0;
  for (const s of REQUIRED_STEPS) if (set.has(s)) done += 1;
  return Math.round((100 * done) / REQUIRED_STEPS.length);
}

function downloadTemplate(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseSubjectsCsv(text: string): SubjectDraft[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headerLine = lines[0].toLowerCase();
  const hasHeader = headerLine.includes('code') && (headerLine.includes('name') || headerLine.includes('subject'));
  const start = hasHeader ? 1 : 0;
  const headerCols = hasHeader ? lines[0].split(',').map((c) => c.trim().toLowerCase()) : [];
  const colIndex = (names: string[]) => {
    for (const n of names) {
      const i = headerCols.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const out: SubjectDraft[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    let name: string;
    let code: string;
    let weeklyFrequencyRaw: string;
    if (hasHeader) {
      const inName = colIndex(['name', 'subjectname', 'subject']);
      const inCode = colIndex(['code', 'subjectcode']);
      const inWf = colIndex(['weeklyfrequency', 'weekly_frequency', 'frequency', 'freq', 'periodsperweek', 'periods_per_week']);
      name = (inName >= 0 ? cols[inName] : cols[0]) ?? '';
      code = (inCode >= 0 ? cols[inCode] : cols[1]) ?? '';
      weeklyFrequencyRaw = (inWf >= 0 ? cols[inWf] : cols[2]) ?? '';
    } else {
      name = cols[0] ?? '';
      code = cols[1] ?? '';
      weeklyFrequencyRaw = cols[2] ?? '';
    }
    if (!name || !code) continue;
    const n = weeklyFrequencyRaw ? Number(String(weeklyFrequencyRaw).trim()) : NaN;
    const weeklyFrequency = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 4;
    out.push({ name, code: code.toUpperCase(), weeklyFrequency });
  }
  return out;
}

function suggestSubjectCode(name: string): string {
  const cleaned = String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ').filter(Boolean);
  const ensureMin3 = (raw: string) => {
    const base = String(raw ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 32);
    if (base.length >= 3) return base;
    // pad to 3 chars for short names like "IT" -> "IT0"
    return (base + '000').slice(0, 3);
  };
  if (words.length === 1) return ensureMin3(words[0].slice(0, 6));
  // Social Studies -> SST, Computer Science -> CSC
  const initials = words.map((w) => w[0]).join('');
  if (initials.length >= 3) return ensureMin3(initials.slice(0, 4));
  return ensureMin3((words[0].slice(0, 2) + words[1].slice(0, 2)).slice(0, 4));
}

function normalizeSubjectCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function isValidSubjectCode(code: string) {
  return /^[A-Z0-9]{3,32}$/.test(code);
}

function parseRoomsCsv(text: string): RoomDraft[] {
  const rawLines = text
    .replace(/^\uFEFF/, '') // strip BOM (common in Excel exports)
    .split(/\r?\n/);
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headerLineRaw = lines[0] ?? '';
  const headerLine = headerLineRaw.toLowerCase();
  const hasHeader = headerLine.includes('building') && headerLine.includes('room');
  const start = hasHeader ? 1 : 0;

  const detectDelimiter = (s: string) => {
    const comma = (s.match(/,/g) ?? []).length;
    const semi = (s.match(/;/g) ?? []).length;
    const tab = (s.match(/\t/g) ?? []).length;
    if (semi > comma && semi >= tab) return ';';
    if (tab > comma && tab > semi) return '\t';
    return ',';
  };
  const delim = detectDelimiter(headerLineRaw);

  const splitCsvRow = (row: string) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]!;
      if (ch === '"') {
        const next = row[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === delim) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headerCols = hasHeader ? splitCsvRow(lines[0]).map((c) => c.trim().toLowerCase()) : [];
  const colIndex = (names: string[]) => {
    for (const n of names) {
      const i = headerCols.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const out: RoomDraft[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    let building: string;
    let floor: string;
    let floorNumber: number | null = null;
    let floorName: string | null = null;
    let roomNumber: string;
    let typeStr: string;
    let capRaw: string | undefined;
    let labTypeStr: string | undefined;

    if (hasHeader) {
      const inBuilding = colIndex(['building', 'building_name', 'buildingname', 'block', 'block_name', 'blockname']);
      const inFloor = colIndex(['floor']); // legacy single floor column (e.g. "1 / Ground")
      const inFloorNo = colIndex(['floor_number', 'floornumber', 'floorno', 'floor_num', 'floor#']);
      const inFloorName = colIndex(['floor_name', 'floorname', 'floorlabel', 'floor_label']);
      const inRoom = colIndex(['room', 'room_number', 'roomnumber', 'room_no', 'roomno']);
      const inType = colIndex(['type']);
      const inCap = colIndex(['capacity']);
      const inLabType = colIndex(['labtype', 'lab_type']);
      building = (inBuilding >= 0 ? cols[inBuilding] : cols[0]) ?? '';
      floor = (inFloor >= 0 ? cols[inFloor] : '') ?? '';
      const nRaw = inFloorNo >= 0 ? cols[inFloorNo] : '';
      const n = nRaw ? Number(String(nRaw).trim()) : NaN;
      if (Number.isFinite(n) && n >= 0) floorNumber = Math.floor(n);
      const fnRaw = inFloorName >= 0 ? cols[inFloorName] : '';
      floorName = fnRaw ? String(fnRaw).trim() : null;
      roomNumber = (inRoom >= 0 ? cols[inRoom] : cols[2]) ?? '';
      typeStr = (inType >= 0 ? cols[inType] : cols[3]) ?? 'CLASSROOM';
      capRaw = inCap >= 0 ? cols[inCap] : cols[4];
      labTypeStr = inLabType >= 0 ? cols[inLabType] : cols[5];
    } else {
      building = cols[0] ?? '';
      floor = cols[1] ?? '';
      roomNumber = cols[2] ?? '';
      typeStr = cols[3] ?? 'CLASSROOM';
      capRaw = cols[4];
      labTypeStr = cols[5];
    }

    if (!building || !roomNumber) continue;
    const typeNorm = String(typeStr).trim().toUpperCase().replace(/\s+/g, '_');
    const type = ([
      'CLASSROOM',
      'LAB',
      'LIBRARY',
      'AUDITORIUM',
      'SPORTS_ROOM',
      'STAFF_ROOM',
      'OFFICE',
      'OTHER',
    ] as const).includes(typeNorm as any)
      ? (typeNorm as RoomDraft['type'])
      : 'OTHER';

    let capacity: number | null = null;
    const cap = Number.parseInt(String(capRaw ?? ''), 10);
    if (Number.isFinite(cap) && cap > 0) capacity = cap;

    const labNorm = String(labTypeStr ?? '').trim().toUpperCase();
    const labType =
      type === 'LAB'
        ? (['PHYSICS', 'CHEMISTRY', 'COMPUTER', 'OTHER'] as const).includes(labNorm as any)
          ? (labNorm as NonNullable<RoomDraft['labType']>)
          : 'OTHER'
        : null;

    // Best-effort parse legacy floor "1 / Ground" into number + name if not explicitly provided
    const floorLegacy = String(floor ?? '').trim();
    if (floorLegacy && floorNumber == null && floorName == null) {
      const m = floorLegacy.match(/^\s*(\d{1,3})\s*(?:[/-]\s*)?(.*)\s*$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) floorNumber = n;
        const rest = String(m[2] ?? '').trim();
        floorName = rest ? rest : null;
      } else {
        floorName = floorLegacy;
      }
    }

    out.push({
      building: building.trim(),
      floorNumber,
      floorName,
      roomNumber: roomNumber.trim(),
      type,
      labType,
      capacity,
    });
  }
  return out;
}

export function SchoolOnboardingWizardPage() {
  const qc = useQueryClient();
  const [fromGrade, setFromGrade] = useState(1);
  const [toGrade, setToGrade] = useState(12);
  const [sectionsText, setSectionsText] = useState('A,B');
  const [usePerGradeSections, setUsePerGradeSections] = useState(false);
  const [gradeSectionsRows, setGradeSectionsRows] = useState<GradeSectionsRow[]>([
    { gradeLevel: 1, sectionsText: 'A,B' },
  ]);
  const [defaultCapacity, setDefaultCapacity] = useState<number | ''>('');
  const [classesResult, setClassesResult] = useState<{ createdCount: number; skippedExistingCount: number } | null>(
    null,
  );
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectWeeklyFrequency, setSubjectWeeklyFrequency] = useState<number | ''>(4);
  const [subjectsQueueSearch, setSubjectsQueueSearch] = useState('');
  const [subjectsCsvName, setSubjectsCsvName] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectDraft[]>([]);
  const subjectsCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [academicAllocRows, setAcademicAllocRows] = useState<
    { classGroupId: number; subjectId: number; staffId: number | null; weeklyFrequency: number; roomId: number | null }[]
  >([]);
  const [classSubjectConfigs, setClassSubjectConfigs] = useState<ClassSubjectConfigRow[]>([]);
  const [sectionSubjectOverrides, setSectionSubjectOverrides] = useState<SectionSubjectOverrideRow[]>([]);
  const [assignmentSlotMeta, setAssignmentSlotMeta] = useState<Record<string, AssignmentSlotMeta>>({});
  const [subjectsResult, setSubjectsResult] = useState<{ createdCount: number; skippedExistingCount: number } | null>(
    null,
  );
  const [roomBuilding, setRoomBuilding] = useState('');
  const [roomFloorNumber, setRoomFloorNumber] = useState<number | ''>('');
  const [roomFloorName, setRoomFloorName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState<RoomDraft['type']>('CLASSROOM');
  const [roomLabType, setRoomLabType] = useState<NonNullable<RoomDraft['labType']>>('PHYSICS');
  const [roomCapacity, setRoomCapacity] = useState<number | ''>('');
  const [roomsCsvName, setRoomsCsvName] = useState<string | null>(null);
  const roomsCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [roomsSelectedKeys, setRoomsSelectedKeys] = useState<Record<string, boolean>>({});
  const [bulkStart, setBulkStart] = useState<number | ''>(101);
  const [bulkEnd, setBulkEnd] = useState<number | ''>(110);
  const [roomsFilter, setRoomsFilter] = useState('');
  const [rooms, setRooms] = useState<RoomDraft[]>([]);
  const [roomsResult, setRoomsResult] = useState<{ createdCount: number; skippedExistingCount: number } | null>(null);
  /** classGroupId → room id string, or '' for no default */
  const [defaultRoomByClassId, setDefaultRoomByClassId] = useState<Record<number, string>>({});
  /** After server + local draft is applied, debounced localStorage sync is safe to run. */
  const [academicLocalAutosaveReady, setAcademicLocalAutosaveReady] = useState(false);

  const [staffFullName, setStaffFullName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmployeeNo, setStaffEmployeeNo] = useState('');
  const [staffDesignation, setStaffDesignation] = useState('');
  const [staffRoles, setStaffRoles] = useState<string[]>(['TEACHER']);
  const [staffTeachablePicks, setStaffTeachablePicks] = useState<string[]>([]);
  const [staffCreateLogin, setStaffCreateLogin] = useState(true);
  const [staffMaxWeeklyLoad, setStaffMaxWeeklyLoad] = useState<string>('');
  const [staffPreferredClassGroupIds, setStaffPreferredClassGroupIds] = useState<string[]>([]);
  const [staffTouched, setStaffTouched] = useState<Record<StaffManualField, boolean>>({
    fullName: false,
    email: false,
    phone: false,
    employeeNo: false,
    designation: false,
    roles: false,
    subjects: false,
  });
  const staffEmployeeNoTrim = staffEmployeeNo.trim();
  const [staffCsvName, setStaffCsvName] = useState<string | null>(null);
  const staffCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [staffRows, setStaffRows] = useState<StaffDraft[]>([]);
  const [staffResult, setStaffResult] = useState<{
    staffCreated: number;
    usersCreated: number;
    skippedExistingCount: number;
    credentials: { email: string; username: string; temporaryPassword: string; roles: string[] }[];
  } | null>(null);
  const [feesRows, setFeesRows] = useState<FeeClassRow[]>([]);
  const [feesCsvName, setFeesCsvName] = useState<string | null>(null);
  const feesCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [feesCopyFromGrade, setFeesCopyFromGrade] = useState<string>('');
  const [feesExpandedGrades, setFeesExpandedGrades] = useState<Record<string, boolean>>({});
  const [feePreviewGrade, setFeePreviewGrade] = useState<string>('');
  const [installments, setInstallments] = useState<FeeInstallmentRow[]>([
    { label: 'Term 1', dueDateIso: '', percent: 50 },
    { label: 'Term 2', dueDateIso: '', percent: 50 },
  ]);
  const [graceDays, setGraceDays] = useState<number | ''>(7);
  const [lateFeePerDay, setLateFeePerDay] = useState<number | ''>(0);
  const [feesSaved, setFeesSaved] = useState(false);
  const [basicSaveSuccess, setBasicSaveSuccess] = useState(false);
  const [academicSaveSuccess, setAcademicSaveSuccess] = useState(false);
  const [timetableAutoGenInfo, setTimetableAutoGenInfo] = useState<{ n: number } | null>(null);
  const [studentAdmissionNo, setStudentAdmissionNo] = useState('');
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentClassGroupId, setStudentClassGroupId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('Parent');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [studentsCsvName, setStudentsCsvName] = useState<string | null>(null);
  const studentsCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [studentRows, setStudentRows] = useState<StudentDraft[]>([]);
  const [studentsResult, setStudentsResult] = useState<{
    studentsCreated: number;
    guardiansCreated: number;
    skippedExistingCount: number;
  } | null>(null);

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const wizardStepInitedRef = useRef(false);
  const [searchParams] = useSearchParams();
  const idxOf = useMemo(() => {
    const m: Record<string, number> = {};
    for (let i = 0; i < WIZARD_STEPS.length; i++) m[WIZARD_STEPS[i]!.id] = i;
    return m;
  }, []);

  const progress = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => (await api.get<Progress>('/api/v1/onboarding/progress')).data,
  });

  // Deep link from dashboard: /app/onboarding?step=ACADEMIC_STRUCTURE
  useEffect(() => {
    const raw = searchParams.get('step');
    if (!raw) return;
    const stepIdRaw = raw.toUpperCase();
    const stepId = stepIdRaw === 'SUBJECT_CLASS_MAPPING' ? 'ACADEMIC_STRUCTURE' : stepIdRaw;
    const idx = WIZARD_STEPS.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    setActiveStepIndex(idx);
    wizardStepInitedRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!progress.isSuccess || !progress.data || wizardStepInitedRef.current) return;
    wizardStepInitedRef.current = true;
    setActiveStepIndex(statusToStepIndex(progress.data.onboardingStatus));
  }, [progress.isSuccess, progress.data]);

  const classGroups = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () => (await api.get<SpringPage<ClassGroupLite> | ClassGroupLite[]>('/api/class-groups?size=500')).data,
  });

  const feesSetup = useQuery({
    queryKey: ['onboarding-fees'],
    queryFn: async () => {
      const res = await api.get<FeesSetup>('/api/v1/onboarding/fees', { validateStatus: () => true });
      if (res.status === 204) return null;
      return res.data;
    },
  });

  const basicInfo = useQuery({
    queryKey: ['onboarding-basic-info'],
    queryFn: async () => {
      const res = await api.get<BasicInfo>('/api/v1/onboarding/basic-info', { validateStatus: () => true });
      if (res.status === 204) return null;
      return res.data;
    },
  });

  const [basicDraft, setBasicDraft] = useState<BasicSetupDraft>(() => emptyBasicSetupDraft());

  const subjectsCatalog = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () => (await api.get<SpringPage<SubjectCatalogRow> | SubjectCatalogRow[]>('/api/subjects?size=500')).data,
    enabled: [idxOf.SUBJECTS, idxOf.STAFF, idxOf.ACADEMIC_STRUCTURE].includes(activeStepIndex),
  });

  type AcademicStructurePayload = {
    subjects: { id: number; code: string; name: string; weeklyFrequency: number | null }[];
    staff: {
      id: number;
      fullName: string;
      email: string;
      teachableSubjectIds: number[];
      roleNames: string[];
      maxWeeklyLectureLoad?: number | null;
      preferredClassGroupIds?: number[];
    }[];
    classGroups: ClassDefaultRoomRow[];
    allocations: { id: number; classGroupId: number; subjectId: number; staffId: number | null; weeklyFrequency: number; roomId: number | null }[];
    classSubjectConfigs?: {
      gradeLevel: number;
      subjectId: number;
      defaultPeriodsPerWeek: number;
      defaultTeacherId: number | null;
      defaultRoomId: number | null;
    }[];
    sectionSubjectOverrides?: {
      classGroupId: number;
      subjectId: number;
      periodsPerWeek: number | null;
      teacherId: number | null;
      roomId: number | null;
    }[];
    assignmentSlotMeta?: { classGroupId: number; subjectId: number; source: string; locked: boolean }[];
  };

  const academicStructureQuery = useQuery({
    queryKey: ['onboarding-academic-structure'],
    queryFn: async () => {
      const data = (await api.get<AcademicStructurePayload>('/api/v1/onboarding/academic-structure')).data;
      // Backend previously serialized this block as "id" instead of classGroupId, which broke per-section state (all keys undefined).
      const classGroups = (data.classGroups ?? []).map((cg) => {
        const raw = cg as ClassDefaultRoomRow & { id?: number };
        const g = raw.classGroupId ?? raw.id;
        if (g == null || !Number.isFinite(Number(g))) return { ...raw, classGroupId: raw.classGroupId };
        return { ...raw, classGroupId: Number(g) };
      });
      return { ...data, classGroups };
    },
    enabled: activeStepIndex === idxOf.ACADEMIC_STRUCTURE,
  });

  const roomsForClassDefaults = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => (await api.get<SpringPage<RoomOption> | RoomOption[]>('/api/rooms?size=500')).data,
    enabled: activeStepIndex === idxOf.ACADEMIC_STRUCTURE,
  });

  const roomsSaved = useQuery({
    queryKey: ['rooms-saved-onboarding'],
    queryFn: async () =>
      (
        await api.get<SpringPage<RoomOption> | RoomOption[]>(
          '/api/rooms?page=0&size=500&sort=id,desc',
        )
      ).data,
    enabled: activeStepIndex === 3,
  });

  const classDefaultRoomSelectOptions = useMemo(() => {
    const rooms = pageContent(roomsForClassDefaults.data);
    const opts = rooms
      .filter((r) => (r as any).isSchedulable !== false)
      .slice()
      .sort((a, b) => {
        const ba = String(a.buildingName ?? a.building ?? '').localeCompare(String(b.buildingName ?? b.building ?? ''));
        if (ba !== 0) return ba;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      })
      .map((r) => ({
        value: String(r.id),
        label: `${String(r.buildingName ?? r.building ?? '').trim()} ${r.roomNumber}${r.type ? ` · ${r.type}` : ''}`.trim(),
      }));
    return [{ value: '', label: 'No default room' }, ...opts];
  }, [roomsForClassDefaults.data]);

  const classDefaultRoomUsage = useMemo(() => {
    const rows = academicStructureQuery.data?.classGroups ?? [];
    const usage = new Map<string, number>();
    for (const r of rows) {
      const v = defaultRoomByClassId[r.classGroupId] ?? '';
      if (!v) continue;
      usage.set(v, (usage.get(v) ?? 0) + 1);
    }
    return usage;
  }, [academicStructureQuery.data?.classGroups, defaultRoomByClassId]);

  const classDefaultRoomHasConflicts = useMemo(() => {
    for (const [, c] of classDefaultRoomUsage.entries()) if (c > 1) return true;
    return false;
  }, [classDefaultRoomUsage]);

  const autoAssignDefaultRooms = () => {
    const classes = (academicStructureQuery.data?.classGroups ?? []).slice();
    const rooms = pageContent(roomsForClassDefaults.data).slice();
    if (classes.length === 0 || rooms.length === 0) return;

    const isClassroom = (r: RoomOption) => String(r.type ?? '').toUpperCase() === 'CLASSROOM';
    const numericPrefix = (s: string) => {
      const m = String(s ?? '').trim().match(/^(\d{1,4})/);
      return m ? Number(m[1]) : null;
    };

    const sortedRooms = rooms
      .filter((r) => isClassroom(r))
      .sort((a, b) => {
        const ba = String(a.buildingName ?? a.building ?? '').localeCompare(String(b.buildingName ?? b.building ?? ''));
        if (ba !== 0) return ba;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      });

    const next = { ...defaultRoomByClassId };
    const used = new Set(Object.values(next).filter(Boolean));

    // 1) Smart suggestion: match roomNumber prefix with grade (e.g. 6xx for Grade 6).
    for (const cg of classes) {
      if (next[cg.classGroupId]) continue;
      const grade = cg.gradeLevel;
      if (typeof grade !== 'number' || !Number.isFinite(grade)) continue;
      const picked = sortedRooms.find((r) => {
        const n = numericPrefix(r.roomNumber);
        if (n == null) return false;
        if (Math.floor(n / 100) !== grade) return false;
        const idStr = String(r.id);
        return !used.has(idStr);
      });
      if (picked) {
        next[cg.classGroupId] = String(picked.id);
        used.add(String(picked.id));
      }
    }

    // 2) Fallback: assign unused classrooms first, then round-robin so every section gets a homeroom when any classroom exists.
    let rr = 0;
    for (const cg of classes) {
      if (next[cg.classGroupId]) continue;
      if (sortedRooms.length === 0) break;
      const unused = sortedRooms.find((r) => !used.has(String(r.id)));
      const picked = unused ?? sortedRooms[rr % sortedRooms.length];
      rr += 1;
      next[cg.classGroupId] = String(picked.id);
      used.add(String(picked.id));
    }

    setDefaultRoomByClassId(next);
    toast.success('Auto-assigned', 'Assigned default rooms. Review conflicts/exceptions and adjust if needed.');
  };

  // Hydrate draft when server data loads
  useEffect(() => {
    const d = basicInfo.data;
    if (!d) return;
    setBasicDraft(basicInfoApiToDraft(d));
  }, [basicInfo.data]);

  // Hydrate fees draft when catalogs + server data load
  useEffect(() => {
    const groups = pageContent(classGroups.data);
    if (groups.length === 0) return;

    const existing = feesSetup.data;
    const byId = new Map(existing?.classFees?.map((r) => [r.classGroupId, r.totalAmount]) ?? []);

    const labelFor = (g: ClassGroupLite) => {
      if (g.code) return g.code;
      if (g.gradeLevel != null && g.section) return `Grade ${g.gradeLevel}-${g.section}`;
      return g.name ?? `Class #${g.id}`;
    };

    setFeesRows((prev) => {
      // don't clobber user edits once they started typing
      if (prev.length > 0) return prev;
      return groups.map((g) => ({
        classGroupId: g.id,
        label: labelFor(g),
        totalAmount: byId.has(g.id) ? (byId.get(g.id) as number) : '',
      }));
    });

    if (existing?.installments?.length) {
      setInstallments(
        existing.installments.map((i) => ({
          label: i.label ?? 'Installment',
          dueDateIso: i.dueDateIso ?? '',
          percent: typeof i.percent === 'number' ? i.percent : '',
        })),
      );
    }
    if (existing?.lateFeeRule) {
      const g = existing.lateFeeRule.graceDays;
      const p = existing.lateFeeRule.lateFeePerDay;
      if (typeof g === 'number') setGraceDays(g);
      if (typeof p === 'number') setLateFeePerDay(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classGroups.data, feesSetup.data]);

  const saveBasic = useMutation({
    mutationFn: async () => api.put('/api/v1/onboarding/basic-info', draftToBasicInfoPutPayload(basicDraft)),
    onMutate: () => {
      setBasicSaveSuccess(false);
    },
    onSuccess: async () => {
      setBasicSaveSuccess(true);
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['onboarding-basic-info'] });
    },
    onError: () => {
      setBasicSaveSuccess(false);
    },
  });

  const generateClasses = useMutation({
    mutationFn: async () => {
      const sections = sectionsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const gradeSections = usePerGradeSections
        ? gradeSectionsRows
            .map((r) => ({
              gradeLevel: Number(r.gradeLevel),
              sections: r.sectionsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }))
            .filter((r) => Number.isFinite(r.gradeLevel) && r.sections.length > 0)
        : null;
      return (
        await api.post<{ createdCount: number; createdCodes: string[]; skippedExistingCount: number }>(
          '/api/v1/onboarding/classes/generate',
          {
            fromGrade,
            toGrade,
            sections,
            gradeSections,
            defaultCapacity: defaultCapacity === '' ? null : defaultCapacity,
          },
        )
      ).data;
    },
    onSuccess: async (data) => {
      setClassesResult({ createdCount: data.createdCount, skippedExistingCount: data.skippedExistingCount });
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['class-groups-catalog'] });
      await qc.invalidateQueries({ queryKey: ['class-groups'] });
    },
  });

  const saveSubjects = useMutation({
    mutationFn: async () => {
      if (subjects.length === 0) {
        throw new Error('Add at least one subject.');
      }
      // Client-side validation (server validates too)
      const seen = new Set<string>();
      for (const s of subjects) {
        const code = normalizeSubjectCode(s.code);
        if (!isValidSubjectCode(code)) {
          throw new Error('Subject code must be uppercase A–Z/0–9 only (no spaces), 3–32 chars.');
        }
        if (!Number.isFinite(s.weeklyFrequency) || s.weeklyFrequency <= 0) {
          throw new Error(`weeklyFrequency must be positive for subject ${code}`);
        }
        if (seen.has(code)) throw new Error(`Duplicate subject code in queue: ${code}`);
        seen.add(code);
      }
      return (
        await api.post<{
          createdCount: number;
          skippedExistingCount: number;
          mappingsCreated: number;
          createdSubjectCodes: string[];
        }>(
          '/api/v1/onboarding/subjects',
          subjects.map((s) => ({
            name: s.name,
            code: normalizeSubjectCode(s.code),
            weeklyFrequency: Math.trunc(Number(s.weeklyFrequency)),
          })),
        )
      ).data;
    },
    onMutate: () => {
      setSubjectsResult(null);
    },
    onSuccess: async (data) => {
      setSubjectsResult({ createdCount: data.createdCount, skippedExistingCount: data.skippedExistingCount });
      setSubjects([]);
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['subjects-catalog'] });
      // Ensure the saved list refreshes immediately even if it was previously disabled.
      await qc.refetchQueries({ queryKey: ['subjects-catalog'] });
    },
  });

  const saveRooms = useMutation({
    mutationFn: async () => {
      if (rooms.length === 0) throw new Error('Add at least one room.');
      const floorLabel = (r: RoomDraft) => {
        const n = r.floorNumber == null ? '' : String(r.floorNumber);
        const nm = String(r.floorName ?? '').trim();
        const joined = [n, nm].filter(Boolean).join(' / ').trim();
        return joined || null;
      };
      return (
        await api.post<{ createdCount: number; skippedExistingCount: number; createdKeys: string[] }>(
          '/api/v1/onboarding/rooms',
          rooms.map((r) => ({
            building: r.building,
            floor: floorLabel(r),
            floorNumber: r.floorNumber == null ? null : r.floorNumber,
            floorName: String(r.floorName ?? '').trim() || null,
            roomNumber: r.roomNumber,
            type: r.type,
            capacity: r.capacity,
            labType: r.type === 'LAB' ? (r.labType ?? 'OTHER') : null,
          })),
        )
      ).data;
    },
    onMutate: () => {
      setRoomsResult(null);
    },
    onSuccess: async (data) => {
      setRoomsResult({ createdCount: data.createdCount, skippedExistingCount: data.skippedExistingCount });
      setRooms([]);
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['rooms-saved-onboarding'] });
      await qc.invalidateQueries({ queryKey: ['onboarding-class-default-rooms'] });
      await qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });

  const skipRoomsOnboarding = useMutation({
    mutationFn: async () => api.post('/api/v1/onboarding/rooms/skip', {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      toast.info('Rooms skipped', 'You can add rooms later from school management.');
    },
    onError: (e) => toast.error('Skip failed', formatApiError(e)),
  });

  const saveAcademicStructure = useMutation({
    mutationFn: async () => {
      const cgs = academicStructureQuery.data?.classGroups ?? [];
      if (cgs.length === 0) throw new Error('No class groups found. Generate classes first.');
      const defaultRooms = cgs.map((r) => {
        const raw = defaultRoomByClassId[r.classGroupId];
        const rid = raw && String(raw).trim() !== '' ? Number(raw) : NaN;
        return { classGroupId: r.classGroupId, roomId: Number.isFinite(rid) ? rid : null };
      });
      const assignmentSlotMetaList = Object.entries(assignmentSlotMeta).map(([k, v]) => {
        const [a, b] = k.split(':');
        return {
          classGroupId: Number(a),
          subjectId: Number(b),
          source: v.source,
          locked: v.locked,
        };
      });
      await api.put('/api/v1/onboarding/academic-structure', {
        classSubjectConfigs,
        sectionSubjectOverrides,
        defaultRooms,
        assignmentSlotMeta: assignmentSlotMetaList,
      });
    },
    onMutate: () => {
      setAcademicSaveSuccess(false);
    },
    onSuccess: async () => {
      setAcademicSaveSuccess(true);
      try {
        localStorage.removeItem(ACADEMIC_LOCAL_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['onboarding-academic-structure'] });
      await qc.invalidateQueries({ queryKey: ['class-groups'] });
      await qc.invalidateQueries({ queryKey: ['subjects-catalog'] });
    },
    onError: () => {
      setAcademicSaveSuccess(false);
    },
  });

  const autoGenTimetable = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/api/timetable/generate', {
          schoolId: null,
          academicYearId: null,
          replaceExisting: true,
        })
      ).data;
    },
    onMutate: () => {
      setTimetableAutoGenInfo(null);
    },
    onSuccess: async (data) => {
      const placed = (data as { stats?: { placedCount?: number } }).stats?.placedCount ?? null;
      setTimetableAutoGenInfo({ n: placed == null ? 0 : Number(placed) });
      await qc.invalidateQueries({ queryKey: ['timetable-v2'] });
    },
  });

  const completeTimetableStep = useMutation({
    mutationFn: async () => api.post('/api/v1/onboarding/timetable/complete', {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      setActiveStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
    },
  });

  useEffect(() => {
    if (activeStepIndex !== 5) {
      setAcademicLocalAutosaveReady(false);
      return;
    }
    const d = academicStructureQuery.data;
    if (!d) {
      setAcademicLocalAutosaveReady(false);
      return;
    }
    // Prefer new template model if present; otherwise fall back to existing allocations.
    setClassSubjectConfigs(d.classSubjectConfigs ?? []);
    setSectionSubjectOverrides(d.sectionSubjectOverrides ?? []);
    if (d.assignmentSlotMeta?.length) {
      const rec: Record<string, AssignmentSlotMeta> = {};
      for (const x of d.assignmentSlotMeta) {
        if (!x) continue;
        const sk = `${x.classGroupId}:${x.subjectId}`;
        const src = x.source;
        if (src === 'auto' || src === 'manual' || src === 'rebalanced') {
          rec[sk] = { source: src, locked: x.locked };
        }
      }
      setAssignmentSlotMeta(rec);
    } else {
      setAssignmentSlotMeta({});
    }
    if ((d.classSubjectConfigs?.length ?? 0) > 0) {
      setAcademicAllocRows(
        buildEffectiveAllocRows(d.classGroups ?? [], d.classSubjectConfigs ?? [], d.sectionSubjectOverrides ?? []),
      );
    } else {
      setAcademicAllocRows(
        d.allocations.map((a) => ({
          classGroupId: a.classGroupId,
          subjectId: a.subjectId,
          staffId: a.staffId ?? null,
          weeklyFrequency: a.weeklyFrequency,
          roomId: a.roomId ?? null,
        })),
      );
    }
    setDefaultRoomByClassId((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<number, string> = {};
      for (const r of d.classGroups) {
        next[r.classGroupId] = r.defaultRoomId != null ? String(r.defaultRoomId) : '';
      }
      return next;
    });
    try {
      const raw = localStorage.getItem(ACADEMIC_LOCAL_DRAFT_KEY);
      if (raw) {
        const local = JSON.parse(raw) as {
          academicAllocRows?: { classGroupId: number; subjectId: number; staffId: number | null; weeklyFrequency: number; roomId: number | null }[];
          classSubjectConfigs?: ClassSubjectConfigRow[];
          sectionSubjectOverrides?: SectionSubjectOverrideRow[];
          defaultRoomByClassId?: Record<number, string>;
          assignmentSlotMeta?: Record<string, AssignmentSlotMeta>;
        };
        if (Array.isArray(local.academicAllocRows) && local.academicAllocRows.length > 0) {
          setAcademicAllocRows(local.academicAllocRows.map((x) => ({ ...x, staffId: x.staffId ?? null })));
        }
        if (Array.isArray(local.classSubjectConfigs) && local.classSubjectConfigs.length > 0) {
          setClassSubjectConfigs(local.classSubjectConfigs);
        }
        if (Array.isArray(local.sectionSubjectOverrides) && local.sectionSubjectOverrides.length > 0) {
          setSectionSubjectOverrides(local.sectionSubjectOverrides);
        }
        if (local.defaultRoomByClassId && typeof local.defaultRoomByClassId === 'object') {
          setDefaultRoomByClassId((prev) => ({ ...prev, ...local.defaultRoomByClassId }));
        }
      }
    } catch {
      /* ignore corrupt draft */
    }
    setAcademicLocalAutosaveReady(true);
  }, [activeStepIndex, academicStructureQuery.data]);

  /** Autosave partial academic mapping to this browser (debounced) while the step is open. */
  useEffect(() => {
    if (!academicLocalAutosaveReady || activeStepIndex !== 5) return;
    const hasAllocations = academicAllocRows.length > 0;
    const hasDefaultRooms = Object.values(defaultRoomByClassId).some((v) => String(v).trim() !== '');
    if (!hasAllocations && !hasDefaultRooms) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          ACADEMIC_LOCAL_DRAFT_KEY,
          JSON.stringify({
            savedAt: Date.now(),
            academicAllocRows,
            classSubjectConfigs,
            sectionSubjectOverrides,
            defaultRoomByClassId,
            assignmentSlotMeta,
          }),
        );
      } catch {
        /* quota / private mode */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [academicLocalAutosaveReady, activeStepIndex, academicAllocRows, classSubjectConfigs, sectionSubjectOverrides, defaultRoomByClassId, assignmentSlotMeta]);

  const roleCatalog = useMemo(
    () => [
      { value: 'TEACHER', label: 'Teacher' },
      { value: 'HOD', label: 'HOD' },
      { value: 'ACCOUNTANT', label: 'Accountant' },
      { value: 'PRINCIPAL', label: 'Principal' },
      { value: 'VICE_PRINCIPAL', label: 'Vice principal' },
      { value: 'SCHOOL_ADMIN', label: 'School admin' },
    ],
    [],
  );

  const staffManual = useMemo(() => {
    const isTeacher = staffRoles.includes('TEACHER');

    const fullName = staffFullName.trim();
    const email = staffEmail.trim();
    const phone = staffPhone.trim();
    const employeeNo = staffEmployeeNo.trim();
    const designation = staffDesignation.trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneDigits = phone.replace(/[^\d]/g, '');

    const errors: Partial<Record<StaffManualField, string>> = {};

    if (staffTouched.fullName) {
      if (!fullName) errors.fullName = 'Full name is required.';
    }
    if (staffTouched.email) {
      if (!email) errors.email = 'Email is required.';
      else if (!emailOk) errors.email = 'Enter a valid email address.';
    }
    if (staffTouched.phone) {
      if (!phone) errors.phone = 'Phone is required.';
      else if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = 'Use 10–15 digits (country codes allowed).';
    }
    if (employeeNo) {
      if (employeeNo.length < 2 || employeeNo.length > 32) errors.employeeNo = 'Employee number should be 2–32 characters.';
      else if (!/^[A-Za-z0-9._-]+$/.test(employeeNo)) errors.employeeNo = 'Use letters, numbers, dot, dash, or underscore only.';
    }
    if (staffTouched.designation) {
      if (!designation) errors.designation = 'Designation is required.';
    }
    if (staffTouched.roles) {
      if (!staffRoles.length) errors.roles = 'Select at least one role.';
    }
    if (isTeacher && staffTouched.subjects) {
      if (!staffTeachablePicks.length) errors.subjects = 'Teachers must have at least one teachable subject.';
    }

    const allTouchedBase =
      staffTouched.fullName &&
      staffTouched.email &&
      staffTouched.phone &&
      staffTouched.designation &&
      staffTouched.roles;
    const allTouched = allTouchedBase && (!isTeacher || staffTouched.subjects);

    const ready = allTouched && Object.keys(errors).length === 0;
    return { ready, errors, isTeacher, allTouched };
  }, [
    staffDesignation,
    staffEmail,
    staffEmployeeNo,
    staffFullName,
    staffPhone,
    staffRoles,
    staffTouched.designation,
    staffTouched.email,
    staffTouched.employeeNo,
    staffTouched.fullName,
    staffTouched.phone,
    staffTouched.roles,
    staffTouched.subjects,
    staffTeachablePicks,
  ]);

  // Staff manual entry uses "touched" gating. Browser autofill can populate values without firing blur/change,
  // which leaves touched=false and keeps "Add staff" disabled. This effect reconciles touched flags once values exist.
  useEffect(() => {
    if (activeStepIndex !== 4) return;

    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setStaffTouched((prev) => {
        const next = { ...prev };
        if (!prev.fullName && staffFullName.trim()) next.fullName = true;
        if (!prev.email && staffEmail.trim()) next.email = true;
        if (!prev.phone && staffPhone.trim()) next.phone = true;
        if (!prev.designation && staffDesignation.trim()) next.designation = true;
        if (!prev.roles && staffRoles.length) next.roles = true;
        if (staffRoles.includes('TEACHER')) {
          if (!prev.subjects && staffTeachablePicks.length) next.subjects = true;
        } else {
          next.subjects = false;
        }
        return next;
      });
      if (i >= 25) window.clearInterval(id);
    }, 80);

    return () => window.clearInterval(id);
  }, [
    activeStepIndex,
    staffDesignation,
    staffEmail,
    staffFullName,
    staffPhone,
    staffRoles,
    staffTeachablePicks,
  ]);

  const parseFeesCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const headerLine = lines[0].toLowerCase();
    const hasHeader = headerLine.includes('class') || headerLine.includes('grade');
    const start = hasHeader ? 1 : 0;
    const headerCols = hasHeader ? lines[0].split(',').map((c) => c.trim().toLowerCase()) : [];
    const colIndex = (names: string[]) => {
      for (const n of names) {
        const i = headerCols.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };

    const gradeCol = hasHeader ? colIndex(['class', 'grade', 'gradelevel']) : 0;
    const out: { gradeLevel: number; total: number }[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const gradeRaw = cols[gradeCol] ?? '';
      const grade = Number.parseInt(String(gradeRaw).replace(/[^\d]/g, ''), 10);
      if (!Number.isFinite(grade) || grade < 1) continue;

      // Sum all numeric component columns except grade/class column (tuition/transport/etc).
      let sum = 0;
      for (let c = 0; c < cols.length; c++) {
        if (c === gradeCol) continue;
        const n = Number.parseInt(String(cols[c] ?? '').replace(/[^\d]/g, ''), 10);
        if (Number.isFinite(n) && n > 0) sum += n;
      }
      if (sum <= 0) continue;
      out.push({ gradeLevel: grade, total: sum });
    }
    return out;
  };

  const saveStaff = useMutation({
    mutationFn: async () => {
      if (staffRows.length === 0) throw new Error('Add at least one staff row.');
      const body = staffRows.map((r) => ({
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        employeeNo: r.employeeNo,
        designation: r.designation,
        roles: r.roles,
        teachableSubjectIds: r.teachableSubjectIds ?? [],
        createLoginAccount: r.createLoginAccount ?? true,
        maxWeeklyLectureLoad: r.maxWeeklyLectureLoad ?? null,
        preferredClassGroupIds: r.preferredClassGroupIds ?? [],
      }));
      return (
        await api.post<{
          staffCreated: number;
          usersCreated: number;
          skippedExistingCount: number;
          credentials: { email: string; username: string; temporaryPassword: string; roles: string[] }[];
        }>('/api/v1/onboarding/staff', body)
      ).data;
    },
    onMutate: () => {
      setStaffResult(null);
    },
    onSuccess: async (data) => {
      setStaffResult(data);
      setStaffRows([]);
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['onboarding-staff-view'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const saveFees = useMutation({
    mutationFn: async () => {
      const classFees = feesRows
        .filter((r) => r.totalAmount !== '' && Number(r.totalAmount) > 0)
        .map((r) => ({ classGroupId: r.classGroupId, totalAmount: Number(r.totalAmount) }));
      if (classFees.length === 0) throw new Error('Enter total fee for at least one class.');

      const inst = installments
        .filter((i) => i.label.trim() && i.dueDateIso.trim() && i.percent !== '' && Number(i.percent) > 0)
        .map((i) => ({ label: i.label.trim(), dueDateIso: i.dueDateIso.trim(), percent: Number(i.percent) }));
      if (inst.length === 0) throw new Error('Add at least one installment (label, due date, percent).');
      const sum = inst.reduce((a, b) => a + (b.percent ?? 0), 0);
      if (sum !== 100) throw new Error(`Installment percents must sum to 100 (got ${sum}).`);

      await api.put('/api/v1/onboarding/fees', {
        classFees,
        installments: inst,
        lateFeeRule: {
          graceDays: graceDays === '' ? null : Number(graceDays),
          lateFeePerDay: lateFeePerDay === '' ? null : Number(lateFeePerDay),
        },
      });
    },
    onMutate: () => {
      setFeesSaved(false);
    },
    onSuccess: async () => {
      setFeesSaved(true);
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['onboarding-fees'] });
    },
  });

  const saveStudents = useMutation({
    mutationFn: async () => {
      if (studentRows.length === 0) throw new Error('Add at least one student row.');
      return (
        await api.post<{
          studentsCreated: number;
          guardiansCreated: number;
          skippedExistingCount: number;
        }>('/api/v1/onboarding/students', studentRows)
      ).data;
    },
    onMutate: () => {
      setStudentsResult(null);
    },
    onSuccess: async (data) => {
      setStudentsResult(data);
      setStudentRows([]);
      await qc.invalidateQueries({ queryKey: ['onboarding-progress'] });
      await qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const pct = percentCompleted(progress.data?.completedSteps ?? []);
  const currentWizardStep = WIZARD_STEPS[activeStepIndex] ?? WIZARD_STEPS[0];
  const wizardJourneyPct = Math.round(((activeStepIndex + 1) / WIZARD_STEPS.length) * 100);

  const goNextStep = () => setActiveStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  const goPrevStep = () => setActiveStepIndex((i) => Math.max(i - 1, 0));
  const goToStep = (index: number) => {
    if (!Number.isFinite(index)) return;
    setActiveStepIndex(Math.max(0, Math.min(Math.floor(index), WIZARD_STEPS.length - 1)));
  };

  const jumpToStepOptions = WIZARD_STEPS.map((s, i) => ({
    value: String(i),
    label: `${i + 1}. ${s.title}${s.optional ? ' · optional' : ''}`,
  }));

  const canSave = validateBasicSetupDraft(basicDraft) === null && !saveBasic.isPending;

  return (
    <div className="workspace-feature-page stack">
      <WorkspaceHero
        eyebrow="School onboarding"
        title="Setup wizard"
        tag={`${pct}% · ${activeStepIndex + 1}/${WIZARD_STEPS.length}`}
        subtitle={
          <>
            Complete the critical steps to get your school <strong>operational</strong>. Use the step bar,{' '}
            <strong>Jump to step</strong>, or <strong>Next</strong> / <strong>Back</strong> — then{' '}
            <strong>Save</strong> where shown to record your work.
          </>
        }
      />

      <div className="card stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Progress</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Required: {REQUIRED_STEPS.length} steps · Optional: {OPTIONAL_STEPS.length} steps
            </div>
            <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>
              {currentWizardStep.title}
              {currentWizardStep.optional ? (
                <span className="muted" style={{ fontWeight: 600, fontSize: 13, marginLeft: 8 }}>
                  Optional
                </span>
              ) : null}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Step {activeStepIndex + 1} of {WIZARD_STEPS.length}
              {progress.data?.onboardingStatus === currentWizardStep.id ? (
                <span style={{ marginLeft: 8 }}>· Current (server)</span>
              ) : null}
            </div>
          </div>
          <div style={{ minWidth: 240, flex: '1 1 280px', maxWidth: 440 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: '0.02em' }}>
              Required milestones
            </div>
            <div
              aria-label="Required onboarding progress"
              style={{
                height: 10,
                borderRadius: 999,
                background: 'rgba(15,23,42,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #fb923c, #ea580c)',
                }}
              />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {progress.isLoading ? 'Loading…' : `${pct}% of required setup completed`}
            </div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, margin: '14px 0 6px', letterSpacing: '0.02em' }}>
              Wizard position — click a segment to jump
            </div>
            <div
              role="group"
              aria-label="Wizard steps, click to jump"
              style={{
                minHeight: 28,
                borderRadius: 999,
                background: 'rgba(15,23,42,0.06)',
                display: 'flex',
                gap: 3,
                padding: 3,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {WIZARD_STEPS.map((step, i) => {
                const active = i === activeStepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    aria-label={`Step ${i + 1}: ${step.title}${step.optional ? ', optional' : ''}`}
                    aria-current={active ? 'step' : undefined}
                    title={`${i + 1}. ${step.title}`}
                    onClick={() => goToStep(i)}
                    className="onboarding-wizard-segment"
                    style={{
                      flex: '1 1 12px',
                      minWidth: 8,
                      height: 22,
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      padding: 0,
                      background:
                        i < activeStepIndex
                          ? 'linear-gradient(90deg, #fb923c, #ea580c)'
                          : active
                            ? 'linear-gradient(90deg, #fdba74, #fb923c)'
                            : 'rgba(15,23,42,0.08)',
                      boxShadow: active ? '0 0 0 2px rgba(234, 88, 12, 0.45)' : undefined,
                    }}
                  />
                );
              })}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {wizardJourneyPct}% through wizard steps
            </div>
            <div className="stack" style={{ gap: 6, marginTop: 12, maxWidth: 440 }}>
              <label htmlFor="onboarding-jump-step" className="muted" style={{ fontSize: 11, fontWeight: 700 }}>
                Jump to step
              </label>
              <SelectKeeper
                id="onboarding-jump-step"
                value={String(activeStepIndex)}
                onChange={(v) => goToStep(Number(v))}
                options={jumpToStepOptions}
              />
            </div>
          </div>
        </div>

        {progress.isError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Couldn’t load progress</div>
              <div className="sms-alert__msg">{formatApiError(progress.error)}</div>
            </div>
          </div>
        ) : null}
      </div>

      {activeStepIndex === 0 ? (
      <div className="card stack" style={{ gap: 14 }}>
        <div className="workspace-panel__head">
          <h2 className="workspace-panel__title">Step 1 — Basic setup</h2>
          <span className="workspace-hero__tag">Required</span>
        </div>

        {basicInfo.isError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Couldn’t load basic info</div>
              <div className="sms-alert__msg">{formatApiError(basicInfo.error)}</div>
            </div>
          </div>
        ) : null}

        <SchoolBasicSetupForm value={basicDraft} onChange={setBasicDraft} />

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button type="button" className="btn" disabled={!canSave} onClick={() => saveBasic.mutate()}>
            {saveBasic.isPending ? 'Saving…' : 'Save'}
          </button>
          {basicSaveSuccess && !saveBasic.isError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Saved</div>
                <div className="sms-alert__msg">Basic school setup is updated.</div>
              </div>
            </div>
          ) : null}
          {saveBasic.isError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Save failed</div>
                <div className="sms-alert__msg">{formatApiError(saveBasic.error)}</div>
              </div>
            </div>
          ) : null}
        </div>

      </div>
      ) : null}

      {activeStepIndex === 1 ? (
      <div className="card stack" style={{ gap: 14 }}>
        <div className="workspace-panel__head">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <h2 className="workspace-panel__title">Step 2 — Classes & sections</h2>
              <span className="workspace-hero__tag">Required</span>
            </div>
          </div>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          Generate section groups like <strong>10-A</strong>, <strong>10-B</strong>… This is idempotent: existing class
          groups are skipped.
        </p>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="stack" style={{ flex: '1 1 180px' }}>
            <label>From grade</label>
            <input
              type="number"
              min={1}
              max={12}
              value={fromGrade}
              onChange={(e) => setFromGrade(Number(e.target.value))}
            />
          </div>
          <div className="stack" style={{ flex: '1 1 180px' }}>
            <label>To grade</label>
            <input
              type="number"
              min={1}
              max={12}
              value={toGrade}
              onChange={(e) => setToGrade(Number(e.target.value))}
            />
          </div>
          <div className="stack" style={{ flex: '2 1 260px' }}>
            <label>Sections mode</label>
            <div className="onboarding-pill-group" role="group" aria-label="Sections mode">
              <button
                type="button"
                className="onboarding-pill"
                aria-pressed={!usePerGradeSections}
                onClick={() => setUsePerGradeSections(false)}
              >
                <span className="onboarding-pill__dot" aria-hidden />
                Same for all grades
              </button>
              <button
                type="button"
                className="onboarding-pill"
                aria-pressed={usePerGradeSections}
                onClick={() => setUsePerGradeSections(true)}
              >
                <span className="onboarding-pill__dot" aria-hidden />
                Different per grade
              </button>
            </div>
            <p className="onboarding-inline-help">Use “Different per grade” when Grade 11 has A–D but Grade 1 only has A–B.</p>
          </div>
          <div className="stack" style={{ flex: '1 1 200px' }}>
            <label>Default capacity (optional)</label>
            <input
              type="number"
              min={1}
              value={defaultCapacity}
              onChange={(e) => {
                const v = e.target.value;
                setDefaultCapacity(v === '' ? '' : Number(v));
              }}
              placeholder="40"
            />
          </div>
        </div>

        {!usePerGradeSections ? (
          <div className="stack" style={{ gap: 8 }}>
            <label>Sections (comma-separated)</label>
            <input value={sectionsText} onChange={(e) => setSectionsText(e.target.value)} placeholder="A,B,C" />
            <p className="onboarding-inline-help">Applies to all grades in the selected range.</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Per-grade sections</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Add only the grades you run. Grades without rows will be skipped.
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {gradeSectionsRows.map((r, idx) => (
                <div key={idx} className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="stack" style={{ flex: '0 0 140px' }}>
                    <label>Grade</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={r.gradeLevel}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setGradeSectionsRows((p) => p.map((x, j) => (j === idx ? { ...x, gradeLevel: v } : x)));
                      }}
                    />
                  </div>
                  <div className="stack" style={{ flex: '2 1 260px' }}>
                    <label>Sections (comma-separated)</label>
                    <input
                      value={r.sectionsText}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGradeSectionsRows((p) => p.map((x, j) => (j === idx ? { ...x, sectionsText: v } : x)));
                      }}
                      placeholder="A,B,C"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setGradeSectionsRows((p) => p.filter((_, j) => j !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setGradeSectionsRows((p) => [...p, { gradeLevel: fromGrade, sectionsText: 'A' }])}
              >
                Add grade row
              </button>
            </div>
          </div>
        )}

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button
            type="button"
            className="btn"
            disabled={generateClasses.isPending || !Number.isFinite(fromGrade) || !Number.isFinite(toGrade)}
            onClick={() => generateClasses.mutate()}
          >
            {generateClasses.isPending ? 'Generating…' : 'Generate classes'}
          </button>
          {classesResult && !generateClasses.isError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Classes generated</div>
                <div className="sms-alert__msg">
                  Created {classesResult.createdCount} · Skipped {classesResult.skippedExistingCount} existing
                </div>
              </div>
            </div>
          ) : null}
          {generateClasses.isError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Generate failed</div>
                <div className="sms-alert__msg">{formatApiError(generateClasses.error)}</div>
              </div>
            </div>
          ) : null}
        </div>



        <SavedClassesSectionsCatalogPanel />



      </div>
      ) : null}

      {activeStepIndex === 2 ? (
      <div className="card stack" style={{ gap: 14 }}>
        <div className="workspace-panel__head">
          <h2 className="workspace-panel__title">Step 3 — Subjects</h2>
          <span className="workspace-hero__tag">Required</span>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          Define what subjects exist in your school. You’ll set class-specific periods/week and teachers in the{' '}
          <strong>Academic structure</strong> step.
        </p>

        <div className="workspace-placeholder">
          <strong>Bulk upload (CSV)</strong>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Header recommended. Columns: <code>name</code>, <code>code</code>, <code>weeklyFrequency</code>. One subject per row.
          </p>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="onboarding-file">
            <label className="onboarding-file__btn">
              Upload subjects CSV
              <input
                className="onboarding-file__input"
                type="file"
                accept=".csv,text/csv"
                ref={subjectsCsvInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setSubjectsCsvName(file.name);
                  const text = await file.text();
                  const parsed = parseSubjectsCsv(text);
                  if (parsed.length) {
                    setSubjects((p) => [...p, ...parsed]);
                    setSubjectsResult(null);
                  }
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <span className="onboarding-file__name" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span>{subjectsCsvName ?? 'No file selected'}</span>
              {subjectsCsvName ? (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '4px 10px', fontSize: 12, lineHeight: 1 }}
                  onClick={() => {
                    setSubjectsCsvName(null);
                    if (subjectsCsvInputRef.current) subjectsCsvInputRef.current.value = '';
                    setSubjects([]);
                    setSubjectsResult(null);
                  }}
                  aria-label="Clear selected CSV"
                  title="Clear selected CSV"
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              downloadTemplate(
                'subjects-template.csv',
                ['name,code,weeklyFrequency', 'Mathematics,MTH,4', 'English,ENG,5'].join('\n') + '\n',
              )
            }
          >
            Download template
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            Parsed rows append to the queue below
          </span>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="sms-form-field" style={{ flex: '2 1 240px' }}>
            <label>Subject name</label>
            <input
              value={subjectName}
              onChange={(e) => {
                const v = e.target.value;
                setSubjectName(v);
                // auto-suggest code only when user hasn't typed a custom code yet
                if (!subjectCode.trim()) setSubjectCode(suggestSubjectCode(v));
              }}
              placeholder="Mathematics"
            />
            <div className="sms-form-field__messages" aria-hidden="true" />
          </div>
          <div className="sms-form-field" style={{ flex: '1 1 180px' }}>
            <label>Code</label>
            <input
              value={subjectCode}
              onChange={(e) => setSubjectCode(normalizeSubjectCode(e.target.value))}
              placeholder="MTH"
            />
            <div className="sms-form-field__messages" aria-live="polite">
              {!subjectCode.trim() ? (
                'Tip: code auto-suggests from the name (edit anytime).'
              ) : !isValidSubjectCode(normalizeSubjectCode(subjectCode)) ? (
                <span style={{ color: '#b91c1c' }}>Code must be 3–32 chars, uppercase A–Z/0–9 only.</span>
              ) : null}
            </div>
          </div>
          <div className="sms-form-field" style={{ flex: '0 0 170px' }}>
            <label>Frequency (per week)</label>
            <input
              type="number"
              min={1}
              max={40}
              value={subjectWeeklyFrequency}
              onChange={(e) => setSubjectWeeklyFrequency(e.target.value === '' ? '' : Math.trunc(Number(e.target.value)))}
              placeholder="4"
            />
            <div className="sms-form-field__messages">Used as a default hint for timetable.</div>
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn secondary"
            disabled={
              !subjectName.trim() ||
              !normalizeSubjectCode(subjectCode) ||
              !isValidSubjectCode(normalizeSubjectCode(subjectCode)) ||
              !(Number.isFinite(Number(subjectWeeklyFrequency)) && Number(subjectWeeklyFrequency) > 0)
            }
            onClick={() => {
              const wf = Math.trunc(Number(subjectWeeklyFrequency));
              const draft: SubjectDraft = {
                name: subjectName.trim(),
                code: normalizeSubjectCode(subjectCode),
                weeklyFrequency: Number.isFinite(wf) && wf > 0 ? wf : 4,
              };
              setSubjects((prev) => [...prev, draft]);
              setSubjectName('');
              setSubjectCode('');
              setSubjectWeeklyFrequency(4);
              setSubjectsResult(null);
            }}
          >
            Add subject
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            {subjects.length} queued
          </span>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ flex: '1 1 260px' }}
            value={subjectsQueueSearch}
            onChange={(e) => setSubjectsQueueSearch(e.target.value)}
            placeholder="Filter queued subjects…"
          />
        </div>

        {subjects.length > 0 ? (
          <div className="stack" style={{ gap: 8 }}>
            {subjects
              .map((s, idx) => ({ s, idx }))
              .filter(({ s }) => {
                const q = subjectsQueueSearch.trim().toLowerCase();
                if (!q) return true;
                return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
              })
              .map(({ s, idx }) => (
              <div
                key={`${s.code}-${idx}`}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(15,23,42,0.10)',
                  background: 'rgba(255,255,255,0.9)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      style={{ minWidth: 220 }}
                      value={s.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSubjects((p) => p.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                      }}
                    />
                    <input
                      style={{ width: 140 }}
                      value={s.code}
                      onChange={(e) => {
                        const v = normalizeSubjectCode(e.target.value);
                        setSubjects((p) => p.map((x, i) => (i === idx ? { ...x, code: v } : x)));
                      }}
                    />
                    <input
                      type="number"
                      min={1}
                      max={40}
                      style={{ width: 160 }}
                      value={s.weeklyFrequency ?? 4}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const v = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 4;
                        setSubjects((p) => p.map((x, i) => (i === idx ? { ...x, weeklyFrequency: v } : x)));
                      }}
                      placeholder="freq/wk"
                      title="Default frequency hint (periods per week)"
                    />
                    {!isValidSubjectCode(s.code) ? (
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c' }}>Invalid code</span>
                    ) : null}
                    {(!Number.isFinite(s.weeklyFrequency) || s.weeklyFrequency <= 0) ? (
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c' }}>Invalid frequency</span>
                    ) : null}
                  </div>
                </div>
                <button type="button" className="btn secondary" onClick={() => setSubjects((p) => p.filter((_, i) => i !== idx))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Add at least one subject (manually or via CSV) to continue.</div>
        )}

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button type="button" className="btn" disabled={saveSubjects.isPending || subjects.length === 0} onClick={() => saveSubjects.mutate()}>
            {saveSubjects.isPending ? 'Saving…' : 'Save subjects'}
          </button>
          {subjectsResult && !saveSubjects.isError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Subjects saved</div>
                <div className="sms-alert__msg">
                  Created {subjectsResult.createdCount} · Skipped {subjectsResult.skippedExistingCount} existing
                </div>
              </div>
            </div>
          ) : null}
          {saveSubjects.isError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Save failed</div>
                <div className="sms-alert__msg">{formatApiError(saveSubjects.error)}</div>
              </div>
            </div>
          ) : null}
        </div>



        <div className="stack" style={{ gap: 10, marginTop: 12 }}>
          <SavedSubjectsCatalogPanel />
        </div>

      </div>
      ) : null}


      {activeStepIndex === 3 ? (
      <div className="card stack" style={{ gap: 14 }}>
        <div className="workspace-panel__head">
          <h2 className="workspace-panel__title">Step 4 — Rooms / infrastructure</h2>
          <span className="workspace-hero__tag">Optional</span>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          Schools think in blocks and floors. Add rooms in bulk, grouped by building → floor. You can skip and return anytime.
        </p>

        <div className="workspace-placeholder">
          <strong>CSV import</strong>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Header recommended. Columns: <code>building</code>, <code>floorNumber</code>, <code>floorName</code>, <code>room</code>,{' '}
            <code>type</code>, <code>capacity</code>, <code>labType</code>. (Legacy <code>floor</code> still works.)
          </p>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="onboarding-file">
            <label className="onboarding-file__btn">
              Upload rooms CSV
              <input
                className="onboarding-file__input"
                type="file"
                accept=".csv,text/csv"
                ref={roomsCsvInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setRoomsCsvName(file.name);
                  const text = await file.text();
                  const parsed = parseRoomsCsv(text);
                  if (parsed.length) {
                    setRooms((p) => [...p, ...parsed]);
                    setRoomsResult(null);
                  }
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <span className="onboarding-file__name" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span>{roomsCsvName ?? 'No file selected'}</span>
              {roomsCsvName ? (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '4px 10px', fontSize: 12, lineHeight: 1 }}
                  onClick={() => {
                    setRoomsCsvName(null);
                    if (roomsCsvInputRef.current) roomsCsvInputRef.current.value = '';
                    setRooms([]);
                    setRoomsResult(null);
                  }}
                  aria-label="Clear selected CSV"
                  title="Clear selected CSV"
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              downloadTemplate(
                'rooms-template.csv',
                [
                  'building,floorNumber,floorName,room,type,capacity,labType',
                  'Block A,1,Ground,101,CLASSROOM,40,',
                  'Block B,0,Lab Wing,LAB-1,LAB,30,PHYSICS',
                ].join(
                  '\n',
                ) + '\n',
              )
            }
          >
            Download template
          </button>
          <input
            style={{ flex: '1 1 220px' }}
            value={roomsFilter}
            onChange={(e) => setRoomsFilter(e.target.value)}
            placeholder="Filter queued rooms… (Block A / 101 / Lab)"
          />
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ flex: '1 1 220px' }}>
            <label>Building</label>
            <input value={roomBuilding} onChange={(e) => setRoomBuilding(e.target.value)} placeholder="Block A" />
          </div>
          <div className="stack" style={{ flex: '1 1 180px' }}>
            <label>Floor number (optional)</label>
            <input
              type="number"
              min={0}
              value={roomFloorNumber}
              onChange={(e) => setRoomFloorNumber(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="1"
            />
          </div>
          <div className="stack" style={{ flex: '1 1 180px' }}>
            <label>Floor name (optional)</label>
            <input value={roomFloorName} onChange={(e) => setRoomFloorName(e.target.value)} placeholder="Ground" />
          </div>
          <div className="stack" style={{ flex: '1 1 180px' }}>
            <label>Type</label>
            <SelectKeeper
              value={roomType}
              onChange={(v) => setRoomType((v || 'CLASSROOM') as RoomDraft['type'])}
              options={[
                { value: 'CLASSROOM', label: 'Classroom' },
                { value: 'LAB', label: 'Lab' },
                { value: 'SPORTS_ROOM', label: 'Sports' },
                { value: 'AUDITORIUM', label: 'Auditorium' },
                { value: 'LIBRARY', label: 'Library' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
          </div>
          {roomType === 'LAB' ? (
            <div className="stack" style={{ flex: '1 1 200px' }}>
              <label>Lab type</label>
              <SelectKeeper
                value={roomLabType}
                onChange={(v) => setRoomLabType((v || 'PHYSICS') as any)}
                options={[
                  { value: 'PHYSICS', label: 'Physics' },
                  { value: 'CHEMISTRY', label: 'Chemistry' },
                  { value: 'COMPUTER', label: 'Computer' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </div>
          ) : null}
          <div className="stack" style={{ flex: '0 0 200px' }}>
            <label>Capacity (optional)</label>
            <input
              type="number"
              min={1}
              value={roomCapacity}
              onChange={(e) => setRoomCapacity(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="40"
            />
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ flex: '0 0 160px' }}>
            <label>Room # (one room)</label>
            <input
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. 101"
              inputMode="text"
              autoComplete="off"
            />
          </div>
          <div className="stack" style={{ flex: '0 0 160px' }}>
            <label>Start # (range)</label>
            <input type="number" value={bulkStart} onChange={(e) => setBulkStart(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div className="stack" style={{ flex: '0 0 160px' }}>
            <label>End # (range)</label>
            <input type="number" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <button
            type="button"
            className="btn secondary"
            disabled={!roomBuilding.trim() || !Number.isFinite(Number(bulkStart)) || !Number.isFinite(Number(bulkEnd))}
            onClick={() => {
              const start = Number(bulkStart);
              const end = Number(bulkEnd);
              const lo = Math.min(start, end);
              const hi = Math.max(start, end);
              const building = roomBuilding.trim();
              const floorNumber = roomFloorNumber === '' ? null : roomFloorNumber;
              const floorName = roomFloorName.trim() || null;
              const type = roomType;
              const labType = type === 'LAB' ? roomLabType : null;
              const capacity = roomCapacity === '' ? null : roomCapacity;

              const next: RoomDraft[] = [];
              for (let n = lo; n <= hi; n++) {
                next.push({ building, floorNumber, floorName, roomNumber: String(n), type, labType, capacity });
              }
              const floorLabel = (r: RoomDraft) => {
                const nn = r.floorNumber == null ? '' : String(r.floorNumber);
                const nm = String(r.floorName ?? '').trim();
                const joined = [nn, nm].filter(Boolean).join(' / ').trim();
                return joined || '';
              };
              const keyOf = (r: RoomDraft) =>
                `${r.building.trim().toLowerCase()}|${floorLabel(r).trim().toLowerCase()}|${r.roomNumber.trim().toLowerCase()}`;
              const existing = new Set(rooms.map(keyOf));
              const saved = new Set(
                pageContent(roomsSaved.data).map((r) => `${String(r.buildingName ?? r.building ?? '').trim().toLowerCase()}||${String(r.roomNumber ?? '').trim().toLowerCase()}`),
              );
              const toAdd: RoomDraft[] = [];
              let skippedDup = 0;
              for (const r of next) {
                const k = keyOf(r);
                const legacySavedKey = `${r.building.trim().toLowerCase()}||${r.roomNumber.trim().toLowerCase()}`;
                if (existing.has(k) || saved.has(legacySavedKey)) {
                  skippedDup += 1;
                  continue;
                }
                existing.add(k);
                toAdd.push(r);
              }
              if (skippedDup > 0) toast.info('Skipped duplicates', `${skippedDup} room(s) already exist in this building.`);
              setRooms((p) => [...p, ...toAdd]);
              setRoomsResult(null);
            }}
          >
            Generate rooms
          </button>

          <button
            type="button"
            className="btn secondary"
            disabled={!roomBuilding.trim() || !roomNumber.trim()}
            onClick={() => {
              const d: RoomDraft = {
                building: roomBuilding.trim(),
                floorNumber: roomFloorNumber === '' ? null : roomFloorNumber,
                floorName: roomFloorName.trim() || null,
                roomNumber: roomNumber.trim(),
                type: roomType,
                labType: roomType === 'LAB' ? roomLabType : null,
                capacity: roomCapacity === '' ? null : roomCapacity,
              };
              const floorLabel = (r: RoomDraft) => {
                const nn = r.floorNumber == null ? '' : String(r.floorNumber);
                const nm = String(r.floorName ?? '').trim();
                const joined = [nn, nm].filter(Boolean).join(' / ').trim();
                return joined || '';
              };
              const keyOf = (r: RoomDraft) =>
                `${r.building.trim().toLowerCase()}|${floorLabel(r).trim().toLowerCase()}|${r.roomNumber.trim().toLowerCase()}`;
              const dupInQueue = rooms.some((x) => keyOf(x) === keyOf(d));
              const dupInSaved = pageContent(roomsSaved.data).some(
                (r) =>
                  String(r.buildingName ?? r.building ?? '').trim().toLowerCase() === d.building.trim().toLowerCase() &&
                  String(r.roomNumber ?? '').trim().toLowerCase() === d.roomNumber.trim().toLowerCase(),
              );
              if (dupInQueue || dupInSaved) {
                toast.error('Duplicate room', `${d.building} ${d.roomNumber} already exists.`);
                return;
              }
              setRooms((prev) => [...prev, d]);
              setRoomNumber('');
              setRoomsResult(null);
            }}
          >
            Add single room
          </button>
        </div>

        {(() => {
          const q = roomsFilter.trim().toLowerCase();
          const floorLabel = (r: RoomDraft) => {
            const n = r.floorNumber == null ? '' : String(r.floorNumber);
            const nm = String(r.floorName ?? '').trim();
            const joined = [n, nm].filter(Boolean).join(' / ').trim();
            return joined || '';
          };
          const filtered = rooms
            .map((r, idx) => ({ r, idx }))
            .filter(({ r }) => {
              if (!q) return true;
              return (
                r.building.toLowerCase().includes(q) ||
                floorLabel(r).toLowerCase().includes(q) ||
                r.roomNumber.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q) ||
                String(r.labType ?? '').toLowerCase().includes(q)
              );
            });

          const keyOf = (r: RoomDraft) =>
            `${r.building.trim().toLowerCase()}|${floorLabel(r).trim().toLowerCase()}|${r.roomNumber.trim().toLowerCase()}`;
          const counts = new Map<string, number>();
          for (const { r } of filtered) counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + 1);

          const grouped = new Map<string, Map<string, { r: RoomDraft; idx: number; dup: boolean }[]>>();
          for (const { r, idx } of filtered) {
            const b = r.building.trim() || '—';
            const f = floorLabel(r).trim() || 'No floor';
            const byFloor = grouped.get(b) ?? new Map();
            const arr = byFloor.get(f) ?? [];
            arr.push({ r, idx, dup: (counts.get(keyOf(r)) ?? 0) > 1 });
            byFloor.set(f, arr);
            grouped.set(b, byFloor);
          }

          const selectedIdxs = Object.entries(roomsSelectedKeys)
            .filter(([, v]) => v)
            .map(([k]) => Number(k))
            .filter((n) => Number.isFinite(n));

          const allVisibleIdxs = filtered.map((x) => x.idx);
          const allVisibleSelected = allVisibleIdxs.length > 0 && allVisibleIdxs.every((i) => roomsSelectedKeys[String(i)]);

          const applyBulkType = (type: RoomDraft['type'], labType: RoomDraft['labType']) => {
            setRooms((p) =>
              p.map((x, i) => {
                if (!roomsSelectedKeys[String(i)]) return x;
                return { ...x, type, labType: type === 'LAB' ? (labType ?? 'OTHER') : null };
              }),
            );
          };
          const applyBulkCapacity = (capacity: number | null) => {
            setRooms((p) => p.map((x, i) => (roomsSelectedKeys[String(i)] ? { ...x, capacity } : x)));
          };

          return rooms.length > 0 ? (
            <div className="stack" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="row" style={{ gap: 10, alignItems: 'center', fontWeight: 800 }}>
                  <input
                    className="sms-checkbox"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setRoomsSelectedKeys((prev) => {
                        const next = { ...prev };
                        for (const i of allVisibleIdxs) next[String(i)] = on;
                        return next;
                      });
                    }}
                  />
                  Select all (visible)
                </label>
                <span className="muted" style={{ fontSize: 13 }}>
                  {selectedIdxs.length} selected · {rooms.length} queued
                </span>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={selectedIdxs.length === 0}
                  onClick={() => {
                    setRooms((p) => p.filter((_, i) => !roomsSelectedKeys[String(i)]));
                    setRoomsSelectedKeys({});
                    setRoomsResult(null);
                  }}
                >
                  Delete selected
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={selectedIdxs.length === 0}
                  onClick={() => applyBulkType(roomType, roomType === 'LAB' ? roomLabType : null)}
                >
                  Set type for selected
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={selectedIdxs.length === 0}
                  onClick={() => applyBulkCapacity(roomCapacity === '' ? null : roomCapacity)}
                >
                  Set capacity for selected
                </button>
              </div>

              {Array.from(grouped.entries()).map(([building, byFloor]) => (
                <div key={building} className="stack" style={{ gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{building}</div>
                  {Array.from(byFloor.entries()).map(([floor, rows]) => (
                    <div key={floor} className="stack" style={{ gap: 8, paddingLeft: 10 }}>
                      <div className="muted" style={{ fontWeight: 900 }}>
                        {floor}
                      </div>
                      {rows
                        .sort((a, b) => a.r.roomNumber.localeCompare(b.r.roomNumber, undefined, { numeric: true }))
                        .map(({ r, idx, dup }) => (
                          <div key={`${idx}-${r.roomNumber}`} className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              className="sms-checkbox"
                              type="checkbox"
                              checked={Boolean(roomsSelectedKeys[String(idx)])}
                              onChange={(e) => setRoomsSelectedKeys((p) => ({ ...p, [String(idx)]: e.target.checked }))}
                            />
                            <div style={{ width: 72, fontWeight: 900 }}>{r.roomNumber}</div>
                            <div style={{ width: 210 }}>
                              <SelectKeeper
                                value={r.type}
                                onChange={(v) => {
                                  const type = (v || 'CLASSROOM') as RoomDraft['type'];
                                  setRooms((p) =>
                                    p.map((x, i) =>
                                      i === idx ? { ...x, type, labType: type === 'LAB' ? (x.labType ?? 'OTHER') : null } : x,
                                    ),
                                  );
                                }}
                                options={[
                                  { value: 'CLASSROOM', label: 'Classroom' },
                                  { value: 'LAB', label: 'Lab' },
                                  { value: 'LIBRARY', label: 'Library' },
                                  { value: 'AUDITORIUM', label: 'Auditorium' },
                                  { value: 'SPORTS_ROOM', label: 'Sports room' },
                                  { value: 'STAFF_ROOM', label: 'Staff room' },
                                  { value: 'OFFICE', label: 'Office' },
                                  { value: 'OTHER', label: 'Other' },
                                ]}
                              />
                            </div>
                            {r.type === 'LAB' ? (
                              <div style={{ width: 190 }}>
                                <SelectKeeper
                                  value={r.labType ?? 'OTHER'}
                                  onChange={(v) => {
                                    const labType = (v || 'OTHER') as NonNullable<RoomDraft['labType']>;
                                    setRooms((p) => p.map((x, i) => (i === idx ? { ...x, labType } : x)));
                                  }}
                                  options={[
                                    { value: 'PHYSICS', label: 'Physics' },
                                    { value: 'CHEMISTRY', label: 'Chemistry' },
                                    { value: 'COMPUTER', label: 'Computer' },
                                    { value: 'OTHER', label: 'Other' },
                                  ]}
                                />
                              </div>
                            ) : null}
                            <div className="stack" style={{ width: 150 }}>
                              <label style={{ fontSize: 11 }}>Capacity</label>
                              <input
                                type="number"
                                min={1}
                                value={r.capacity ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? null : Number(e.target.value);
                                  setRooms((p) => p.map((x, i) => (i === idx ? { ...x, capacity: v } : x)));
                                }}
                                placeholder="Not set"
                              />
                            </div>
                            {dup ? (
                              <span style={{ fontSize: 12, fontWeight: 900, color: '#b91c1c' }}>Duplicate</span>
                            ) : null}
                            <button type="button" className="btn secondary" onClick={() => setRooms((p) => p.filter((_, i) => i !== idx))}>
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No rooms queued (optional).</div>
          );
        })()}

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button
            type="button"
            className="btn"
            disabled={saveRooms.isPending || rooms.length === 0}
            onClick={() => saveRooms.mutate()}
          >
            {saveRooms.isPending ? 'Saving…' : 'Save rooms'}
          </button>
          {roomsResult && !saveRooms.isError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Rooms saved</div>
                <div className="sms-alert__msg">
                  Created {roomsResult.createdCount} · Skipped {roomsResult.skippedExistingCount} existing
                </div>
              </div>
            </div>
          ) : null}
          {saveRooms.isError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Save failed</div>
                <div className="sms-alert__msg">{formatApiError(saveRooms.error)}</div>
              </div>
            </div>
          ) : null}
        </div>



        <SavedRoomsCatalogPanel />



      </div>
      ) : null}

      {activeStepIndex === idxOf.ACADEMIC_STRUCTURE ? (
        <AcademicStructureSetupStep
          classGroups={academicStructureQuery.data?.classGroups ?? []}
          subjects={academicStructureQuery.data?.subjects ?? EMPTY_ACADEMIC_SUBJECTS}
          staff={(academicStructureQuery.data?.staff ?? []).map((s) => ({ ...s, roleNames: s.roleNames ?? [] }))}
          rooms={roomsForClassDefaults.data}
          allocRows={academicAllocRows}
          setAllocRows={setAcademicAllocRows}
          classSubjectConfigs={classSubjectConfigs}
          setClassSubjectConfigs={setClassSubjectConfigs}
          sectionSubjectOverrides={sectionSubjectOverrides}
          setSectionSubjectOverrides={setSectionSubjectOverrides}
          defaultRoomByClassId={defaultRoomByClassId}
          setDefaultRoomByClassId={setDefaultRoomByClassId}
          classDefaultRoomSelectOptions={classDefaultRoomSelectOptions}
          classDefaultRoomUsage={classDefaultRoomUsage}
          classDefaultRoomHasConflicts={classDefaultRoomHasConflicts}
          autoAssignDefaultRooms={autoAssignDefaultRooms}
          defaultRoomsLoading={roomsForClassDefaults.isLoading}
          basicInfo={basicInfo.data ?? null}
          isLoading={academicStructureQuery.isLoading}
          isError={academicStructureQuery.isError}
          error={academicStructureQuery.error}
          roomsError={roomsForClassDefaults.isError ? roomsForClassDefaults.error : null}
          onSave={() => saveAcademicStructure.mutateAsync()}
          savePending={saveAcademicStructure.isPending}
          saveError={saveAcademicStructure.isError ? saveAcademicStructure.error : null}
          formatError={formatApiError}
          assignmentMeta={assignmentSlotMeta}
          setAssignmentMeta={setAssignmentSlotMeta}
          saveSuccess={academicSaveSuccess}
        />
      ) : null}


      {activeStepIndex === idxOf.STAFF ? (
      <div className="card stack" style={{ gap: 14 }}>
        <div className="workspace-panel__head">
          <h2 className="workspace-panel__title">Step 5 — Staff onboarding</h2>
          <span className="workspace-hero__tag">Required</span>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          Add staff profiles and create their logins. You can paste rows manually or upload a CSV.
        </p>

        <div className="workspace-placeholder">
          <strong>CSV format</strong>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Header recommended. Columns: <code>fullName</code>, <code>email</code>, <code>phone</code>,{' '}
              <code>employeeNo</code>, <code>designation</code>, <code>roles</code> (comma-separated role codes),{' '}
              <code>subjects</code> (comma-separated subject codes, teachers only), <code>createLoginAccount</code> (true/false).
          </p>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="sms-form-field" style={{ flex: '2 1 240px' }}>
            <label>Full name</label>
            <input
              value={staffFullName}
              onChange={(e) => setStaffFullName(e.target.value)}
              onBlur={() => setStaffTouched((p) => ({ ...p, fullName: true }))}
              placeholder="Rahul Verma"
            />
            <div className="sms-form-field__error" aria-live="polite">
              {staffTouched.fullName && staffManual.errors.fullName ? staffManual.errors.fullName : '\u00a0'}
            </div>
          </div>
          <div className="sms-form-field" style={{ flex: '2 1 240px' }}>
            <label>Email</label>
            <input
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              onBlur={() => setStaffTouched((p) => ({ ...p, email: true }))}
              placeholder="teacher1@school.com"
            />
            <div className="sms-form-field__error" aria-live="polite">
              {staffTouched.email && staffManual.errors.email ? staffManual.errors.email : '\u00a0'}
            </div>
          </div>
          <div className="sms-form-field" style={{ flex: '1 1 160px' }}>
            <label>Phone</label>
            <input
              value={staffPhone}
              onChange={(e) => setStaffPhone(e.target.value)}
              onBlur={() => setStaffTouched((p) => ({ ...p, phone: true }))}
              placeholder="9876543210"
            />
            <div className="sms-form-field__error" aria-live="polite">
              {staffTouched.phone && staffManual.errors.phone ? staffManual.errors.phone : '\u00a0'}
            </div>
          </div>
          <div className="sms-form-field" style={{ flex: '1 1 160px' }}>
            <label>Employee No (optional)</label>
            <input
              value={staffEmployeeNo}
              onChange={(e) => setStaffEmployeeNo(e.target.value)}
              onBlur={() => setStaffTouched((p) => ({ ...p, employeeNo: true }))}
              placeholder="EMP001"
            />
            <div className="sms-form-field__error" aria-live="polite">
              {staffEmployeeNoTrim && staffManual.errors.employeeNo ? staffManual.errors.employeeNo : '\u00a0'}
            </div>
          </div>
          <div className="sms-form-field" style={{ flex: '1 1 180px' }}>
            <label>Designation</label>
            <input
              value={staffDesignation}
              onChange={(e) => setStaffDesignation(e.target.value)}
              onBlur={() => setStaffTouched((p) => ({ ...p, designation: true }))}
              placeholder="Teacher"
            />
            <div className="sms-form-field__error" aria-live="polite">
              {staffTouched.designation && staffManual.errors.designation ? staffManual.errors.designation : '\u00a0'}
            </div>
          </div>
          <div className="sms-form-field" style={{ flex: '2 1 320px' }}>
            <label>Roles</label>
            <MultiSelectKeeper
              value={staffRoles}
              onChange={(v) => {
                setStaffRoles(v);
                setStaffTouched((p) => {
                  if (!v.includes('TEACHER')) {
                    return { ...p, roles: true, subjects: false };
                  }
                  return { ...p, roles: true };
                });
                if (!v.includes('TEACHER')) {
                  setStaffTeachablePicks([]);
                }
              }}
              options={roleCatalog}
              placeholder="Select roles…"
              searchPlaceholder="Search roles…"
            />
            <div className="sms-form-field__error" aria-live="polite">
              {staffTouched.roles && staffManual.errors.roles ? staffManual.errors.roles : '\u00a0'}
            </div>
          </div>
          {staffRoles.includes('TEACHER') ? (
            <div className="sms-form-field" style={{ flex: '1 1 100%', minWidth: 280 }}>
              <label>Can teach subjects</label>
              <MultiSelectKeeper
                value={staffTeachablePicks}
                onChange={(v) => {
                  setStaffTeachablePicks(v);
                  setStaffTouched((p) => ({ ...p, subjects: true }));
                }}
                options={pageContent(subjectsCatalog.data).map((s) => ({
                  value: String(s.id),
                  label: `${s.name} (${s.code})`,
                }))}
                placeholder="Select at least 1 subject"
                searchPlaceholder="Search subjects…"
              />
              <div className="sms-form-field__messages" aria-live="polite">
                {!staffTouched.subjects
                  ? 'Open and pick subjects — “Add staff” enables after you finish the fields.'
                  : staffManual.errors.subjects
                    ? <span style={{ color: '#b91c1c' }}>{staffManual.errors.subjects}</span>
                    : '\u00a0'}
              </div>
            </div>
          ) : null}
        </div>
        {staffRoles.includes('TEACHER') ? (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="sms-form-field" style={{ minWidth: 160, flex: '0 0 auto' }}>
              <label>Max weekly teaching periods (optional)</label>
              <input
                type="number"
                min={1}
                max={80}
                value={staffMaxWeeklyLoad}
                onChange={(e) => setStaffMaxWeeklyLoad(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
            <div className="sms-form-field" style={{ minWidth: 280, flex: '1 1 280px' }}>
              <label>Preferred classes/sections (optional)</label>
              <MultiSelectKeeper
                value={staffPreferredClassGroupIds}
                onChange={setStaffPreferredClassGroupIds}
                options={pageContent(classGroups.data)
                  .map((c) => ({
                    value: String(c.id),
                    label: `${(c.gradeLevel != null ? `Class ${c.gradeLevel} · ` : '')}${c.name ?? c.code ?? c.id}`,
                  }))
                  .filter((o) => o.value)}
                placeholder="For smart assignment preference…"
                searchPlaceholder="Search classes…"
              />
            </div>
          </div>
        ) : null}

        <div
          className="row"
          style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
        >
          <label className="row" style={{ gap: 10, alignItems: 'center', fontWeight: 900, cursor: 'pointer' }}>
            <input className="sms-checkbox" type="checkbox" checked={staffCreateLogin} onChange={(e) => setStaffCreateLogin(e.target.checked)} />
            Create login account
          </label>
          <button
            type="button"
            className="btn secondary"
            disabled={!staffManual.ready}
            onClick={() => {
              const roles = staffRoles.map((r) => r.trim().toUpperCase()).filter(Boolean);
              const isTeacher = roles.includes('TEACHER');
              const teachableSubjectIds = staffTeachablePicks.map((x) => Number(x)).filter((n) => Number.isFinite(n));
              const ml = staffMaxWeeklyLoad.trim();
              const maxWeeklyLectureLoad =
                ml && Number.isFinite(Number(ml)) && Number(ml) > 0 ? Math.floor(Number(ml)) : null;
              const preferredClassGroupIds = staffPreferredClassGroupIds
                .map((x) => Number(x))
                .filter((n) => Number.isFinite(n));
              const row: StaffDraft = {
                fullName: staffFullName.trim(),
                email: staffEmail.trim(),
                phone: staffPhone.trim() || null,
                employeeNo: staffEmployeeNo.trim() || null,
                designation: staffDesignation.trim() || null,
                roles: roles.length ? roles : ['TEACHER'],
                teachableSubjectIds: isTeacher && teachableSubjectIds.length ? teachableSubjectIds : undefined,
                createLoginAccount: staffCreateLogin,
                maxWeeklyLectureLoad: isTeacher ? maxWeeklyLectureLoad : null,
                preferredClassGroupIds: isTeacher && preferredClassGroupIds.length ? preferredClassGroupIds : undefined,
              };
              setStaffRows((p) => [...p, row]);
              setStaffFullName('');
              setStaffEmail('');
              setStaffPhone('');
              setStaffEmployeeNo('');
              setStaffDesignation('');
              setStaffRoles(['TEACHER']);
              setStaffTeachablePicks([]);
              setStaffCreateLogin(true);
              setStaffMaxWeeklyLoad('');
              setStaffPreferredClassGroupIds([]);
              setStaffResult(null);
              setStaffTouched({
                fullName: false,
                email: false,
                phone: false,
                employeeNo: false,
                designation: false,
                roles: false,
                subjects: false,
              });
            }}
          >
            Add staff
          </button>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="onboarding-file">
            <label className="onboarding-file__btn">
              Upload CSV
              <input
                className="onboarding-file__input"
                type="file"
                accept=".csv,text/csv"
                ref={staffCsvInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setStaffCsvName(file.name);
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                  if (lines.length === 0) return;
                  const header = lines[0].toLowerCase();
                  const hasHeader = header.includes('email') && header.includes('fullname');
                  const start = hasHeader ? 1 : 0;
                  const parsed: StaffDraft[] = [];
                  const subjectsByCode = new Map<string, number>();
                  for (const s of pageContent(subjectsCatalog.data)) {
                    subjectsByCode.set(String(s.code ?? '').trim().toUpperCase(), Number(s.id));
                  }
                  for (let i = start; i < lines.length; i++) {
                    const cols = lines[i].split(',').map((c) => c.trim());
                    if (cols.length < 2) continue;
                    const [fullName, email, phone, employeeNo, designation, rolesRaw, subjectsRaw, createLoginRaw] = cols;
                    const roles = (rolesRaw ?? '')
                      .split('|')
                      .join(',')
                      .split(';')
                      .join(',')
                      .split(',')
                      .map((r) => r.trim().toUpperCase())
                      .filter(Boolean);
                    const subjects = (subjectsRaw ?? '')
                      .split('|')
                      .join(',')
                      .split(';')
                      .join(',')
                      .split(',')
                      .map((s) => s.trim().toUpperCase())
                      .filter(Boolean);
                    const teachableSubjectIds = subjects
                      .map((c) => subjectsByCode.get(c))
                      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
                    const createLoginAccount =
                      String(createLoginRaw ?? '')
                        .trim()
                        .toLowerCase() === 'false'
                        ? false
                        : true;
                    if (!fullName || !email) continue;
                    parsed.push({
                      fullName,
                      email,
                      phone: phone || null,
                      employeeNo: employeeNo || null,
                      designation: designation || null,
                      roles: roles.length ? roles : ['TEACHER'],
                      teachableSubjectIds: roles.includes('TEACHER') && teachableSubjectIds.length ? teachableSubjectIds : undefined,
                      createLoginAccount,
                    });
                  }
                  if (parsed.length) {
                    setStaffRows((p) => [...p, ...parsed]);
                    setStaffResult(null);
                  }
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <span className="onboarding-file__name" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span>{staffCsvName ?? 'No file selected'}</span>
              {staffCsvName ? (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '4px 10px', fontSize: 12, lineHeight: 1 }}
                  onClick={() => {
                    setStaffCsvName(null);
                    if (staffCsvInputRef.current) staffCsvInputRef.current.value = '';
                    setStaffRows([]);
                    setStaffResult(null);
                  }}
                  aria-label="Clear selected CSV"
                  title="Clear selected CSV"
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              downloadTemplate(
                'staff-template.csv',
                [
                  'fullName,email,phone,employeeNo,designation,roles,subjects,createLoginAccount',
                  'Rahul Verma,teacher1@school.com,9876543210,EMP001,Physics Teacher,TEACHER,PHY|MTH,true',
                  'Asha Singh,hod1@school.com,9876543211,EMP002,HOD,HOD|TEACHER,PHY,true',
                  'Suresh Kumar,accountant@school.com,9876543212,EMP003,Accountant,ACCOUNTANT,,false',
                ].join('\n') + '\n',
              )
            }
          >
            Download template
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            {staffRows.length} queued
          </span>
        </div>

        {staffRows.length > 0 ? (
          <div className="stack" style={{ gap: 8 }}>
            {staffRows.map((r, idx) => (
              <div
                key={`${r.email}-${idx}`}
                className="onboarding-item-row"
              >
                <div style={{ minWidth: 0 }}>
                  <div className="onboarding-item-row__title">
                    {r.fullName} <span className="muted">({r.email})</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.designation ?? '—'} · {r.roles.join(', ')}
                  </div>
                </div>
                <button type="button" className="btn secondary" onClick={() => setStaffRows((p) => p.filter((_, i) => i !== idx))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Add or upload at least one staff row to continue.</div>
        )}

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button type="button" className="btn" disabled={saveStaff.isPending || staffRows.length === 0} onClick={() => saveStaff.mutate()}>
            {saveStaff.isPending ? 'Creating accounts…' : 'Create staff accounts'}
          </button>
          {staffResult && !saveStaff.isError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Staff saved</div>
                <div className="sms-alert__msg">
                  Created {staffResult.usersCreated} login(s) · Skipped {staffResult.skippedExistingCount} existing
                </div>
              </div>
            </div>
          ) : null}
          {saveStaff.isError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Save failed</div>
                <div className="sms-alert__msg">{formatApiError(saveStaff.error)}</div>
              </div>
            </div>
          ) : null}
        </div>

        {staffResult ? (
          <div className="workspace-placeholder">
            <strong>Login credentials (copy now)</strong>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5 }}>
              These temporary passwords are shown once. Share securely with your staff (email integration comes next).
            </p>
            <div className="stack" style={{ gap: 8 }}>
              {staffResult.credentials.map((c) => (
                <div key={c.email} className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{c.email}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      username: {c.username} · roles: {c.roles.join(', ')}
                    </div>
                  </div>
                  <code style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(15,23,42,0.06)' }}>
                    {c.temporaryPassword}
                  </code>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <OnboardedStaffCatalogPanel />

      </div>
      ) : null}

      {activeStepIndex === 8 ? (
      <div className="card stack" style={{ gap: 14 }}>
        <div className="workspace-panel__head">
          <h2 className="workspace-panel__title">Step 9 — Fees structure</h2>
          <span className="workspace-hero__tag">Optional</span>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          Set class-level total fee (applies to all sections by default), then split into installments. You can optionally override per section.
        </p>

        {classGroups.isError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Couldn’t load classes</div>
              <div className="sms-alert__msg">{formatApiError(classGroups.error)}</div>
            </div>
          </div>
        ) : null}
        {feesSetup.isError ? (
          <div className="sms-alert sms-alert--error">
            <div>
              <div className="sms-alert__title">Couldn’t load fees setup</div>
              <div className="sms-alert__msg">{formatApiError(feesSetup.error)}</div>
            </div>
          </div>
        ) : null}

        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 900 }}>Step 1/2 — Fee amount (by class)</div>
              <div className="muted" style={{ fontSize: 12 }}>
                One input per class (Grade). This applies to all sections unless you expand overrides.
              </div>
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <SelectKeeper
                value={feesCopyFromGrade}
                onChange={setFeesCopyFromGrade}
                options={[
                  { value: '', label: 'Copy from class…' },
                  ...Array.from(
                    new Set(
                      pageContent(classGroups.data)
                        .map((g) => g.gradeLevel)
                        .filter((x): x is number => typeof x === 'number' && Number.isFinite(x)),
                    ),
                  )
                    .sort((a, b) => a - b)
                    .map((g) => ({ value: String(g), label: `Class ${g}` })),
                ]}
              />
              <button
                type="button"
                className="btn secondary"
                disabled={!feesCopyFromGrade}
                onClick={() => {
                  const from = Number(feesCopyFromGrade);
                  const groups = pageContent(classGroups.data);
                  const sourceIds = new Set(groups.filter((x) => x.gradeLevel === from).map((x) => x.id));
                  const sourceRows = feesRows.filter((r) => sourceIds.has(r.classGroupId));
                  const sourceVal = sourceRows.length ? sourceRows[0].totalAmount : '';
                  if (sourceVal === '') return;
                  setFeesRows((p) => p.map((x) => ({ ...x, totalAmount: sourceVal })));
                  setFeesSaved(false);
                  toast.success('Copied', `Applied Class ${from} fee to all classes.`);
                }}
              >
                Apply to all classes
              </button>
            </div>
          </div>

          <div className="workspace-placeholder">
            <strong>CSV import</strong>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              Format example: <code>class,tuition,transport</code> then <code>6,20000,5000</code>. All numeric columns are summed into the class total.
            </p>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="onboarding-file">
              <label className="onboarding-file__btn">
                Upload fees CSV
                <input
                  className="onboarding-file__input"
                  type="file"
                  accept=".csv,text/csv"
                  ref={feesCsvInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFeesCsvName(file.name);
                    const text = await file.text();
                    const parsed = parseFeesCsv(text);
                    if (!parsed.length) return;
                    const groups = pageContent(classGroups.data);
                    setFeesRows((prev) => {
                      const next = [...prev];
                      for (const row of parsed) {
                        const ids = groups.filter((g) => g.gradeLevel === row.gradeLevel).map((g) => g.id);
                        for (const id of ids) {
                          const idx = next.findIndex((x) => x.classGroupId === id);
                          if (idx >= 0) next[idx] = { ...next[idx], totalAmount: row.total };
                        }
                      }
                      return next;
                    });
                    setFeesSaved(false);
                    toast.success('Imported', `Imported fees for ${parsed.length} class(es).`);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <span className="onboarding-file__name" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <span>{feesCsvName ?? 'No file selected'}</span>
                {feesCsvName ? (
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: '4px 10px', fontSize: 12, lineHeight: 1 }}
                    onClick={() => {
                      setFeesCsvName(null);
                      if (feesCsvInputRef.current) feesCsvInputRef.current.value = '';
                      setFeesRows((prev) => prev.map((x) => ({ ...x, totalAmount: '' })));
                      setFeesSaved(false);
                      setFeePreviewGrade('');
                    }}
                    aria-label="Clear selected CSV"
                    title="Clear selected CSV"
                  >
                    ✕
                  </button>
                ) : null}
              </span>
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                downloadTemplate(
                  'fees-template.csv',
                  ['class,tuition,transport', '6,20000,5000', '7,22000,6000'].join('\n') + '\n',
                )
              }
            >
              Download template
            </button>
          </div>

          {(() => {
            const groups = pageContent(classGroups.data);
            const byId = new Map(groups.map((g) => [g.id, g]));
            const grades = Array.from(
              new Set(groups.map((g) => g.gradeLevel).filter((x): x is number => typeof x === 'number' && Number.isFinite(x))),
            ).sort((a, b) => a - b);

            if (!feesRows.length) {
              return <div className="muted">{classGroups.isLoading ? 'Loading classes…' : 'No classes found yet. Complete Step 2 first.'}</div>;
            }

            const gradeTotals = (grade: number) => {
              const ids = new Set(groups.filter((g) => g.gradeLevel === grade).map((g) => g.id));
              const rows = feesRows.filter((r) => ids.has(r.classGroupId));
              const vals = Array.from(new Set(rows.map((r) => r.totalAmount).filter((v) => v !== '')));
              const same = vals.length <= 1;
              return { rows, same, value: same ? (vals[0] ?? '') : '' };
            };

            const setGradeTotal = (grade: number, v: number | '') => {
              const ids = new Set(groups.filter((g) => g.gradeLevel === grade).map((g) => g.id));
              setFeesRows((p) => p.map((x) => (ids.has(x.classGroupId) ? { ...x, totalAmount: v } : x)));
              setFeesSaved(false);
            };

            return (
              <div className="stack" style={{ gap: 10 }}>
                {grades.map((grade) => {
                  const meta = gradeTotals(grade);
                  const expanded = Boolean(feesExpandedGrades[String(grade)]);
                  return (
                    <div
                      key={grade}
                      className="stack"
                      style={{ gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(15,23,42,0.10)' }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ fontWeight: 900 }}>
                          Class {grade}{' '}
                          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                            → all sections
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => setFeesExpandedGrades((p) => ({ ...p, [String(grade)]: !expanded }))}
                        >
                          {expanded ? 'Hide overrides' : 'Override sections'}
                        </button>
                      </div>

                      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="stack" style={{ flex: '0 0 260px' }}>
                          <label>Total amount (Class {grade})</label>
                          <input
                            type="number"
                            min={0}
                            value={meta.value}
                            onChange={(e) => {
                              const v = e.target.value === '' ? '' : Number(e.target.value);
                              setGradeTotal(grade, v);
                            }}
                            placeholder={meta.same ? 'e.g. 27000' : 'Mixed (expand overrides)'}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={meta.value === ''}
                          onClick={() => {
                            if (meta.value === '') return;
                            setFeesRows((p) =>
                              p.map((x) => ({
                                ...x,
                                totalAmount: meta.value === '' ? '' : Number(meta.value),
                              })),
                            );
                            setFeesSaved(false);
                            toast.success('Copied', `Copied Class ${grade} value to all classes.`);
                          }}
                        >
                          Copy value to all
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={meta.value === ''}
                          onClick={() => {
                            if (meta.value === '') return;
                            setFeePreviewGrade(String(grade));
                          }}
                        >
                          Preview
                        </button>
                      </div>

                      {expanded ? (
                        <div className="stack" style={{ gap: 8 }}>
                          <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                            Optional overrides per section
                          </div>
                          {meta.rows.map((r) => {
                            const g = byId.get(r.classGroupId);
                            const label = g?.code ?? r.label;
                            return (
                              <div key={r.classGroupId} className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ flex: '1 1 240px', fontWeight: 800 }}>{label}</div>
                                <div className="stack" style={{ flex: '0 0 220px' }}>
                                  <label>Total amount</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={r.totalAmount}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? '' : Number(e.target.value);
                                      setFeesRows((p) => p.map((x) => (x.classGroupId === r.classGroupId ? { ...x, totalAmount: v } : x)));
                                      setFeesSaved(false);
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div className="stack" style={{ gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Step 3 — Installments</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Percent split must sum to 100. Amount per installment is calculated from the class total.
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {installments.map((i, idx) => (
              <div key={idx} className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="stack" style={{ flex: '2 1 220px' }}>
                  <label>Label</label>
                  <input
                    value={i.label}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInstallments((p) => p.map((x, j) => (j === idx ? { ...x, label: v } : x)));
                      setFeesSaved(false);
                    }}
                    placeholder="Term 1"
                  />
                </div>
                <div className="stack" style={{ flex: '1 1 200px' }}>
                  <label>Due date</label>
                  <DateKeeper
                    id={`onboarding-fee-due-${idx}`}
                    value={i.dueDateIso || new Date().toISOString().slice(0, 10)}
                    onChange={(v) => {
                      setInstallments((p) => p.map((x, j) => (j === idx ? { ...x, dueDateIso: v } : x)));
                      setFeesSaved(false);
                    }}
                  />
                </div>
                <div className="stack" style={{ flex: '0 0 160px' }}>
                  <label>Percent</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={i.percent}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Number(e.target.value);
                      setInstallments((p) => p.map((x, j) => (j === idx ? { ...x, percent: v } : x)));
                      setFeesSaved(false);
                    }}
                    placeholder="50"
                  />
                </div>
                <button type="button" className="btn secondary" onClick={() => setInstallments((p) => p.filter((_, j) => j !== idx))}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setInstallments((p) => [...p, { label: `Installment ${p.length + 1}`, dueDateIso: '', percent: '' }]);
                setFeesSaved(false);
              }}
            >
              Add installment
            </button>
            <div className="muted" style={{ fontSize: 12 }}>
              Percent sum: {installments.reduce((a, b) => a + (b.percent === '' ? 0 : Number(b.percent)), 0)}
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ flex: '0 0 200px' }}>
            <label>Grace days</label>
            <input
              type="number"
              min={0}
              value={graceDays}
              onChange={(e) => {
                setGraceDays(e.target.value === '' ? '' : Number(e.target.value));
                setFeesSaved(false);
              }}
              placeholder="7"
            />
          </div>
          <div className="stack" style={{ flex: '0 0 240px' }}>
            <label>Late fee per day</label>
            <input
              type="number"
              min={0}
              value={lateFeePerDay}
              onChange={(e) => {
                setLateFeePerDay(e.target.value === '' ? '' : Number(e.target.value));
                setFeesSaved(false);
              }}
              placeholder="0"
            />
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button type="button" className="btn" disabled={saveFees.isPending || feesRows.length === 0} onClick={() => saveFees.mutate()}>
            {saveFees.isPending ? 'Saving…' : 'Save fees'}
          </button>
          {feesSaved && !saveFees.isError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Fees saved</div>
                <div className="sms-alert__msg">Fee structure is updated for your classes.</div>
              </div>
            </div>
          ) : null}
          {saveFees.isError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Save failed</div>
                <div className="sms-alert__msg">{formatApiError(saveFees.error)}</div>
              </div>
            </div>
          ) : null}
        </div>

        {feePreviewGrade ? (
          <div className="workspace-placeholder">
            <strong>Preview (student view) — Class {feePreviewGrade}</strong>
            {(() => {
              const grade = Number(feePreviewGrade);
              const groups = pageContent(classGroups.data);
              const ids = new Set(groups.filter((g) => g.gradeLevel === grade).map((g) => g.id));
              const rows = feesRows.filter((r) => ids.has(r.classGroupId));
              const total = typeof rows[0]?.totalAmount === 'number' ? rows[0].totalAmount : 0;
              const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
              return (
                <div className="stack" style={{ gap: 8 }}>
                  <div style={{ fontWeight: 900 }}>Total: {fmt(total)}</div>
                  <div style={{ fontWeight: 900 }}>Installments</div>
                  {installments
                    .filter((i) => i.percent !== '' && Number(i.percent) > 0)
                    .map((i, idx) => {
                      const pct = Number(i.percent);
                      const amount = (total * pct) / 100;
                      const due = i.dueDateIso ? new Date(i.dueDateIso).toLocaleDateString() : '—';
                      return (
                        <div key={idx} className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 800 }}>
                            {i.label} <span className="muted">({pct}%)</span>
                            <div className="muted" style={{ fontSize: 12 }}>
                              Due: {due}
                            </div>
                          </div>
                          <div style={{ fontWeight: 900 }}>{fmt(amount)}</div>
                        </div>
                      );
                    })}
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn secondary" onClick={() => setFeePreviewGrade('')}>
                      Close preview
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}

      </div>
      ) : null}

      {activeStepIndex === 7 ? (
      <div className="card stack" style={{ gap: 14 }}>
        <div className="workspace-panel__head">
          <h2 className="workspace-panel__title">Step 8 — Students onboarding</h2>
          <span className="workspace-hero__tag">Required</span>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          Add students now (or later). CSV upload is best for bulk admission.
        </p>

        <div className="workspace-placeholder">
          <strong>CSV format</strong>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Header recommended. Columns: <code>admissionNo</code>, <code>firstName</code>, <code>lastName</code>,{' '}
            <code>classGroupCode</code> (like <code>10-A</code>) or <code>classGroupId</code>, <code>guardianName</code>,{' '}
            <code>guardianRelation</code>, <code>guardianPhone</code>, <code>guardianEmail</code>.
          </p>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ flex: '1 1 170px' }}>
            <label>Admission no</label>
            <input
              value={studentAdmissionNo}
              onChange={(e) => setStudentAdmissionNo(e.target.value)}
              placeholder="ADM-001"
            />
          </div>
          <div className="stack" style={{ flex: '2 1 220px' }}>
            <label>First name</label>
            <input value={studentFirstName} onChange={(e) => setStudentFirstName(e.target.value)} placeholder="Aarav" />
          </div>
          <div className="stack" style={{ flex: '2 1 220px' }}>
            <label>Last name</label>
            <input value={studentLastName} onChange={(e) => setStudentLastName(e.target.value)} placeholder="Sharma" />
          </div>
          <div className="stack" style={{ flex: '2 1 280px' }}>
            <label>Class &amp; section</label>
            <ClassGroupSearchCombobox value={studentClassGroupId} onChange={setStudentClassGroupId} />
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ flex: '2 1 220px' }}>
            <label>Parent / guardian name</label>
            <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Parent name" />
          </div>
          <div className="stack" style={{ flex: '1 1 170px' }}>
            <label>Relation</label>
            <input value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)} placeholder="Parent" />
          </div>
          <div className="stack" style={{ flex: '1 1 170px' }}>
            <label>Phone</label>
            <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="9876543210" />
          </div>
          <div className="stack" style={{ flex: '2 1 240px' }}>
            <label>Email</label>
            <input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="parent@email.com" />
          </div>
          <button
            type="button"
            className="btn secondary"
            disabled={!studentAdmissionNo.trim() || !studentFirstName.trim()}
            onClick={() => {
              const row: StudentDraft = {
                admissionNo: studentAdmissionNo.trim(),
                firstName: studentFirstName.trim(),
                lastName: studentLastName.trim() || null,
                classGroupId: studentClassGroupId ? Number(studentClassGroupId) : null,
                guardianName: guardianName.trim() || null,
                guardianRelation: guardianRelation.trim() || null,
                guardianPhone: guardianPhone.trim() || null,
                guardianEmail: guardianEmail.trim() || null,
              };
              setStudentRows((p) => [...p, row]);
              setStudentAdmissionNo('');
              setStudentFirstName('');
              setStudentLastName('');
              setStudentClassGroupId('');
              setGuardianName('');
              setGuardianRelation('Parent');
              setGuardianPhone('');
              setGuardianEmail('');
              setStudentsResult(null);
            }}
          >
            Add student
          </button>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="onboarding-file">
            <label className="onboarding-file__btn">
              Upload CSV
              <input
                className="onboarding-file__input"
                type="file"
                accept=".csv,text/csv"
                ref={studentsCsvInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setStudentsCsvName(file.name);
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                  if (lines.length === 0) return;

                  const header = lines[0].toLowerCase();
                  const hasHeader = header.includes('admission') && header.includes('firstname');
                  const start = hasHeader ? 1 : 0;
                  const parsed: StudentDraft[] = [];

                  for (let i = start; i < lines.length; i++) {
                    const cols = lines[i].split(',').map((c) => c.trim());
                    if (cols.length < 2) continue;
                    const [
                      admissionNo,
                      firstName,
                      lastName,
                      classGroupCodeOrId,
                      guardianName,
                      guardianRelation,
                      guardianPhone,
                      guardianEmail,
                    ] = cols;
                    if (!admissionNo || !firstName) continue;
                    const isId = classGroupCodeOrId && /^[0-9]+$/.test(classGroupCodeOrId);
                    parsed.push({
                      admissionNo,
                      firstName,
                      lastName: lastName || null,
                      classGroupId: isId ? Number(classGroupCodeOrId) : null,
                      classGroupCode: isId ? null : (classGroupCodeOrId || null),
                      guardianName: guardianName || null,
                      guardianRelation: guardianRelation || null,
                      guardianPhone: guardianPhone || null,
                      guardianEmail: guardianEmail || null,
                    });
                  }

                  if (parsed.length) {
                    setStudentRows((p) => [...p, ...parsed]);
                    setStudentsResult(null);
                  }
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <span className="onboarding-file__name" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span>{studentsCsvName ?? 'No file selected'}</span>
              {studentsCsvName ? (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '4px 10px', fontSize: 12, lineHeight: 1 }}
                  onClick={() => {
                    setStudentsCsvName(null);
                    if (studentsCsvInputRef.current) studentsCsvInputRef.current.value = '';
                    setStudentRows([]);
                    setStudentsResult(null);
                  }}
                  aria-label="Clear selected CSV"
                  title="Clear selected CSV"
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              downloadTemplate(
                'students-template.csv',
                [
                  'admissionNo,firstName,lastName,classGroupCode,guardianName,guardianRelation,guardianPhone,guardianEmail',
                  'ADM-001,Aarav,Sharma,6-A,Rahul Sharma,Parent,9876543210,parent1@email.com',
                  'ADM-002,Diya,Singh,6-B,Asha Singh,Parent,9876543211,parent2@email.com',
                ].join('\n') + '\n',
              )
            }
          >
            Download template
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            {studentRows.length} queued
          </span>
        </div>

        {studentRows.length > 0 ? (
          <div className="stack" style={{ gap: 8 }}>
            {studentRows.map((r, idx) => (
              <div key={`${r.admissionNo}-${idx}`} className="onboarding-item-row">
                <div style={{ minWidth: 0 }}>
                  <div className="onboarding-item-row__title">
                    {r.firstName} {r.lastName ?? ''} <span className="muted">({r.admissionNo})</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {r.guardianName ? `Guardian: ${r.guardianName}` : '—'}
                  </div>
                </div>
                <button type="button" className="btn secondary" onClick={() => setStudentRows((p) => p.filter((_, i) => i !== idx))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Add or upload at least one student row (optional).</div>
        )}

        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button type="button" className="btn" disabled={saveStudents.isPending || studentRows.length === 0} onClick={() => saveStudents.mutate()}>
            {saveStudents.isPending ? 'Saving…' : 'Save students'}
          </button>
          {studentsResult && !saveStudents.isError ? (
            <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Students saved</div>
                <div className="sms-alert__msg">
                  Created {studentsResult.studentsCreated} · Guardians {studentsResult.guardiansCreated} · Skipped{' '}
                  {studentsResult.skippedExistingCount}
                </div>
              </div>
            </div>
          ) : null}
          {saveStudents.isError ? (
            <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
              <div>
                <div className="sms-alert__title">Save failed</div>
                <div className="sms-alert__msg">{formatApiError(saveStudents.error)}</div>
              </div>
            </div>
          ) : null}
        </div>

      </div>
      ) : null}

      {activeStepIndex === idxOf.TIMETABLE ? (
        <Step7TimetableWorkspace
          onAutoGenerateDraft={() => autoGenTimetable.mutateAsync()}
          autoGeneratePending={autoGenTimetable.isPending}
          autoGenerateErrorText={autoGenTimetable.isError ? formatApiError(autoGenTimetable.error) : null}
          timetableAutoGenCount={timetableAutoGenInfo?.n ?? null}
          workingDays={basicInfo.data?.workingDays ?? basicDraft.workingDays}
          onOpenEditor={() => {
            window.location.href = '/app/timetable/grid';
          }}
          onCompleteStep={() => completeTimetableStep.mutate()}
          completePending={completeTimetableStep.isPending}
        />
      ) : null}

      <div
        className="card row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          position: 'sticky',
          bottom: 12,
          zIndex: 2,
          boxShadow: '0 -8px 24px rgba(15,23,42,0.06)',
        }}
      >
        <button type="button" className="btn secondary" disabled={activeStepIndex === 0} onClick={goPrevStep}>
          Back
        </button>
        <div className="muted" style={{ fontSize: 13, textAlign: 'center', flex: '1 1 200px' }}>
          <span style={{ fontWeight: 700 }}>{currentWizardStep.title}</span>
          <span style={{ margin: '0 8px' }}>·</span>
          {activeStepIndex + 1} / {WIZARD_STEPS.length}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {currentWizardStep.optional ? (
            <button
              type="button"
              className="btn secondary"
              disabled={currentWizardStep.id === 'ROOMS' && skipRoomsOnboarding.isPending}
              onClick={() => {
                if (currentWizardStep.id === 'ROOMS') {
                  skipRoomsOnboarding.mutate(undefined, {
                    onSuccess: () => goNextStep(),
                  });
                } else {
                  goNextStep();
                }
              }}
            >
              {currentWizardStep.id === 'ROOMS' && skipRoomsOnboarding.isPending ? 'Skipping…' : 'Skip'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            disabled={activeStepIndex >= WIZARD_STEPS.length - 1}
            onClick={goNextStep}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

