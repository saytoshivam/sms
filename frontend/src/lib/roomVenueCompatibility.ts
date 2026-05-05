import type { SubjectVenueRequirement } from './subjectVenueRequirement';

/** Mirrors backend {@code RoomType}. */
export const ROOM_TYPES = [
  'STANDARD_CLASSROOM',
  'SCIENCE_LAB',
  'COMPUTER_LAB',
  'MULTIPURPOSE',
  'ART_ROOM',
  'MUSIC_ROOM',
  'SPORTS_AREA',
  'LIBRARY',
  'AUDITORIUM',
  'STAFF_ROOM',
  'OFFICE',
  'OTHER',
] as const;

export type RoomVenueType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<RoomVenueType, string> = {
  STANDARD_CLASSROOM: 'Standard classroom',
  SCIENCE_LAB: 'Science lab',
  COMPUTER_LAB: 'Computer lab',
  MULTIPURPOSE: 'Multipurpose',
  ART_ROOM: 'Art room',
  MUSIC_ROOM: 'Music room',
  SPORTS_AREA: 'Sports area',
  LIBRARY: 'Library',
  AUDITORIUM: 'Auditorium',
  STAFF_ROOM: 'Staff room',
  OFFICE: 'Office',
  OTHER: 'Other',
};

export function parseRoomVenueType(raw: string | null | undefined): RoomVenueType | null {
  if (raw == null || String(raw).trim() === '') return null;
  const u = String(raw).trim().toUpperCase();
  if (u === 'CLASSROOM') return 'STANDARD_CLASSROOM';
  if (u === 'LAB') return 'SCIENCE_LAB';
  if (u === 'SPORTS_ROOM') return 'SPORTS_AREA';
  return (ROOM_TYPES as readonly string[]).includes(u) ? (u as RoomVenueType) : 'OTHER';
}

export function compatibleRoomTypes(
  subjectRequirement: SubjectVenueRequirement,
  specializedRoomType: RoomVenueType | null,
): ReadonlySet<RoomVenueType> {
  switch (subjectRequirement) {
    case 'STANDARD_CLASSROOM':
      return new Set<RoomVenueType>(['STANDARD_CLASSROOM']);
    case 'LAB_REQUIRED':
      return new Set(['SCIENCE_LAB', 'COMPUTER_LAB', 'MULTIPURPOSE']);
    case 'ACTIVITY_SPACE':
      return new Set(['ART_ROOM', 'MUSIC_ROOM', 'MULTIPURPOSE']);
    case 'SPORTS_AREA':
      return new Set(['SPORTS_AREA']);
    case 'SPECIALIZED_ROOM': {
      const s = new Set<RoomVenueType>(['MULTIPURPOSE']);
      if (specializedRoomType) s.add(specializedRoomType);
      return s;
    }
    case 'FLEXIBLE':
      return new Set(ROOM_TYPES as unknown as RoomVenueType[]);
    default:
      return new Set(['STANDARD_CLASSROOM']);
  }
}

export function isRoomTypeCompatible(
  subjectRequirement: SubjectVenueRequirement,
  specializedRoomType: RoomVenueType | null,
  roomType: string | null | undefined,
): boolean {
  const rt = parseRoomVenueType(roomType);
  if (rt == null) return false;
  return compatibleRoomTypes(subjectRequirement, specializedRoomType).has(rt);
}

export function labRoomPreferenceRank(t: RoomVenueType): number {
  if (t === 'SCIENCE_LAB') return 0;
  if (t === 'COMPUTER_LAB') return 1;
  if (t === 'MULTIPURPOSE') return 2;
  return 99;
}

export function formatCompatibleRoomTypesList(subjectRequirement: SubjectVenueRequirement): string {
  return [...compatibleRoomTypes(subjectRequirement, null)].join(', ');
}

export function schoolHasAnyCompatibleRoom(
  schedulableRoomTypes: Array<string | null | undefined>,
  subjectRequirement: SubjectVenueRequirement,
  specializedRoomType: RoomVenueType | null,
): boolean {
  const allowed = compatibleRoomTypes(subjectRequirement, specializedRoomType);
  for (const raw of schedulableRoomTypes) {
    const t = parseRoomVenueType(raw);
    if (t && allowed.has(t)) return true;
  }
  return false;
}
