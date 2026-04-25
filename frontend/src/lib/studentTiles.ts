export type StudentTileId =
  | 'announcements'
  | 'timetable'
  | 'attendance'
  | 'marks'
  | 'exams'
  | 'academics'
  | 'performance'
  | 'fees'
  | 'assignments';

export type StudentTileDef = {
  id: StudentTileId;
  label: string;
  icon: string;
  path: string;
  /** When true, tile can be removed from the grid (still re-addable from “Add tiles”). */
  removable: boolean;
};

export const STUDENT_TILE_CATALOG: StudentTileDef[] = [
  { id: 'announcements', label: 'Announce', icon: '📣', path: '/app/student/announcements', removable: true },
  { id: 'timetable', label: "Today's classes", icon: '📅', path: '/app', removable: true },
  { id: 'attendance', label: 'Attendance', icon: '✓', path: '/app/student/attendance', removable: false },
  { id: 'marks', label: 'Results', icon: '📊', path: '/app/student/results', removable: false },
  { id: 'exams', label: 'Exams', icon: '📋', path: '/app/student/exams', removable: false },
  { id: 'academics', label: 'Schedule', icon: '📚', path: '/app/student/schedule', removable: false },
  { id: 'performance', label: 'Charts', icon: '📈', path: '/app/students/me/performance', removable: true },
  { id: 'fees', label: 'Fee statement', icon: '💳', path: '/app/student/fees', removable: false },
  { id: 'assignments', label: 'Marks', icon: '📝', path: '/app/student/marks', removable: false },
];

/** Always shown above “Your shortcuts”; not persisted and no ✕ control. */
export const STUDENT_FIXED_TILE_IDS: readonly StudentTileId[] = [
  'attendance',
  'marks',
  'exams',
  'academics',
  'fees',
  'assignments',
];

export const STUDENT_FIXED_TILE_ID_SET = new Set<StudentTileId>(STUDENT_FIXED_TILE_IDS);

const LS_KEY = 'sms_student_tiles_v1';

const DEFAULT_OPTIONAL_ORDER: StudentTileId[] = ['announcements', 'timetable', 'performance'];

function optionalTileIdSet(): Set<StudentTileId> {
  return new Set(
    STUDENT_TILE_CATALOG.filter((t) => !STUDENT_FIXED_TILE_ID_SET.has(t.id)).map((t) => t.id),
  );
}

export function loadStudentTileOrder(): StudentTileId[] {
  const optionalAllowed = optionalTileIdSet();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [...DEFAULT_OPTIONAL_ORDER];
    const parsed = JSON.parse(raw) as StudentTileId[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_OPTIONAL_ORDER];
    const filtered = parsed.filter((id) => optionalAllowed.has(id));
    if (filtered.length === 0) return [...DEFAULT_OPTIONAL_ORDER];
    return filtered;
  } catch {
    return [...DEFAULT_OPTIONAL_ORDER];
  }
}

export function saveStudentTileOrder(order: StudentTileId[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(order));
}
