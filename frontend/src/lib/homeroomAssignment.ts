export type HomeroomRoomInput = {
  id: number;
  capacity: number | null;
  rawFloorNumber: number | null;
  buildingKey: string;
  buildingOrder: number;
  roomNumber: string;
  type: string | null;
  schedulable: boolean;
};

export type HomeroomSectionInput = {
  classGroupId: number;
  gradeLevel: number | null;
  /** Sorted label for sibling sections (e.g. section letter). */
  sectionSortKey: string;
  /** Skip assigning/changing homeroom for this section (manual homeroom lock). */
  skipHomeroomAuto?: boolean;
  /** Known enrollment when available; falls back to assumption in options. */
  headcount?: number | null;
};

export type HomeroomAssignmentStats = {
  assigned: number;
  consecutiveClusters: number;
  lowerFloorOptimized: number;
  skippedLockedSections: number;
  conflicts: number;
};

/** Nursery / KG / Pre-K style grades sort before numeric grades. */
export function gradeBand(gradeLevel: number | null): number {
  if (gradeLevel == null || !Number.isFinite(Number(gradeLevel))) return 99;
  const g = Number(gradeLevel);
  if (g <= 0) return 0;
  if (g <= 4) return 1;
  if (g <= 8) return 2;
  return 3;
}

function floorSortKey(n: number | null): number {
  if (n == null || !Number.isFinite(n)) return 999;
  return n;
}

function numericTail(roomNumber: string): number {
  const m = String(roomNumber ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function meetsCapacity(room: HomeroomRoomInput, headcount: number | null, fallbackHeadcount: number): boolean {
  const need = headcount != null && headcount > 0 ? headcount : fallbackHeadcount;
  const cap = room.capacity;
  if (cap == null || cap <= 0) return true;
  return cap >= need;
}

function sortSections(a: HomeroomSectionInput, b: HomeroomSectionInput): number {
  const ba = gradeBand(a.gradeLevel) - gradeBand(b.gradeLevel);
  if (ba !== 0) return ba;
  const ga = a.gradeLevel ?? 999;
  const gb = b.gradeLevel ?? 999;
  if (ga !== gb) return ga - gb;
  return a.sectionSortKey.localeCompare(b.sectionSortKey, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Greedy homeroom placement: younger grades & earlier bands first, lower floors first,
 * consecutive sections in the same grade prefer same-floor adjacent picks when possible.
 */
export function assignHomeroomsGreedy(args: {
  sections: HomeroomSectionInput[];
  rooms: HomeroomRoomInput[];
  assumeHeadcountWhenUnknown: number;
}): { assignments: Record<number, number>; stats: HomeroomAssignmentStats } {
  const { sections, rooms, assumeHeadcountWhenUnknown } = args;

  const classrooms = rooms
    .filter((r) => String(r.type ?? '').toUpperCase() === 'CLASSROOM')
    .filter((r) => r.schedulable !== false)
    .slice()
    .sort((a, b) => {
      const fa = floorSortKey(a.rawFloorNumber);
      const fb = floorSortKey(b.rawFloorNumber);
      if (fa !== fb) return fa - fb;
      if (a.buildingOrder !== b.buildingOrder) return a.buildingOrder - b.buildingOrder;
      return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
    });

  const sortedSections = sections.slice().sort(sortSections);

  const usedRoomIds = new Set<number>();
  const assignments: Record<number, number> = {};
  let skippedLockedSections = 0;
  let conflicts = 0;

  const floorsPresent = classrooms.map((r) => r.rawFloorNumber).filter((x): x is number => x != null && Number.isFinite(x));
  const floorsSorted = [...floorsPresent].sort((a, b) => a - b);
  const p33 =
    floorsSorted.length === 0 ? null : floorsSorted[Math.max(0, Math.floor(floorsSorted.length * 0.33))] ?? null;

  /** Last picked room id per grade for cohesion scoring */
  const lastRoomByGrade = new Map<number, number>();

  for (const sec of sortedSections) {
    if (sec.skipHomeroomAuto) {
      skippedLockedSections += 1;
      continue;
    }

    const grade = sec.gradeLevel != null && Number.isFinite(Number(sec.gradeLevel)) ? Number(sec.gradeLevel) : NaN;
    const candidates = classrooms.filter((r) => !usedRoomIds.has(r.id) && meetsCapacity(r, sec.headcount ?? null, assumeHeadcountWhenUnknown));

    if (candidates.length === 0) {
      conflicts += 1;
      continue;
    }

    const lastId = Number.isFinite(grade) ? lastRoomByGrade.get(grade) : undefined;
    const lastRoom = lastId != null ? classrooms.find((r) => r.id === lastId) : null;

    let best = candidates[0]!;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const r of candidates) {
      const fk = floorSortKey(r.rawFloorNumber);
      let score = fk * 1_000_000 + r.buildingOrder * 10_000 + numericTail(r.roomNumber);

      if (lastRoom) {
        const sameFloor = r.rawFloorNumber != null && lastRoom.rawFloorNumber != null && r.rawFloorNumber === lastRoom.rawFloorNumber;
        const sameBuilding = r.buildingKey === lastRoom.buildingKey;
        if (sameFloor) score -= 500_000;
        if (sameBuilding) score -= 50_000;
        const near = Math.abs(numericTail(r.roomNumber) - numericTail(lastRoom.roomNumber));
        score += near * 2;
      }

      if (score < bestScore) {
        bestScore = score;
        best = r;
      }
    }

    assignments[sec.classGroupId] = best.id;
    usedRoomIds.add(best.id);
    if (Number.isFinite(grade)) lastRoomByGrade.set(grade, best.id);
  }

  const assigned = Object.keys(assignments).length;

  let consecutiveClusters = 0;
  const byGrade = new Map<number, HomeroomSectionInput[]>();
  for (const s of sortedSections) {
    const g = s.gradeLevel ?? -1;
    const arr = byGrade.get(g) ?? [];
    arr.push(s);
    byGrade.set(g, arr);
  }
  for (const [, secs] of byGrade) {
    const ordered = secs.slice().sort((a, b) => a.sectionSortKey.localeCompare(b.sectionSortKey, undefined, { numeric: true }));
    for (let i = 0; i < ordered.length - 1; i++) {
      const ridA = assignments[ordered[i]!.classGroupId];
      const ridB = assignments[ordered[i + 1]!.classGroupId];
      if (ridA == null || ridB == null) continue;
      const ra = classrooms.find((r) => r.id === ridA);
      const rb = classrooms.find((r) => r.id === ridB);
      const fa = ra?.rawFloorNumber;
      const fb = rb?.rawFloorNumber;
      if (fa != null && fb != null && fa === fb) consecutiveClusters += 1;
    }
  }

  let lowerFloorOptimized = 0;
  if (p33 != null) {
    for (const cgId of Object.keys(assignments)) {
      const rid = assignments[Number(cgId)];
      const room = classrooms.find((r) => r.id === rid);
      const fl = room?.rawFloorNumber;
      if (fl != null && fl <= p33) lowerFloorOptimized += 1;
    }
  }

  return {
    assignments,
    stats: {
      assigned,
      consecutiveClusters,
      lowerFloorOptimized,
      skippedLockedSections,
      conflicts,
    },
  };
}

export function roomsToHomeroomInputs(rooms: Array<Record<string, unknown>>): HomeroomRoomInput[] {
  const buildingIndex = new Map<string, number>();
  const sortedKeys = [...new Set(rooms.map((r) => String(r.buildingName ?? r.building ?? '').trim() || '_'))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  sortedKeys.forEach((k, i) => buildingIndex.set(k, i));

  return rooms.map((raw) => {
    const id = Number(raw.id);
    const bk = String(raw.buildingName ?? raw.building ?? '').trim() || '_';
    return {
      id: Number.isFinite(id) ? id : -1,
      capacity: raw.capacity != null ? Number(raw.capacity) : null,
      rawFloorNumber: raw.rawFloorNumber != null ? Number(raw.rawFloorNumber) : null,
      buildingKey: bk,
      buildingOrder: buildingIndex.get(bk) ?? 0,
      roomNumber: String(raw.roomNumber ?? ''),
      type: raw.type != null ? String(raw.type) : null,
      schedulable: (raw as { isSchedulable?: boolean }).isSchedulable !== false,
    };
  }).filter((r) => r.id >= 0);
}

export function classGroupsToHomeroomSections(
  classGroups: Array<{
    classGroupId: number;
    gradeLevel: number | null;
    section: string | null;
    displayName?: string | null;
    code?: string | null;
  }>,
  homeroomSourceByClassId?: Readonly<Record<number, 'auto' | 'manual' | ''>>,
  /** Sections containing any slot with locked room metadata skip bulk homeroom automation. */
  slotRoomLockedClassGroupIds?: ReadonlySet<number> | null,
): HomeroomSectionInput[] {
  return classGroups.map((cg) => {
    const sec = String(cg.section ?? '').trim();
    const sortKey = sec || String(cg.code ?? cg.displayName ?? cg.classGroupId);
    const skipManualHomeroom = homeroomSourceByClassId?.[cg.classGroupId] === 'manual';
    const skipLockedSlotRoom = slotRoomLockedClassGroupIds?.has(Number(cg.classGroupId)) === true;
    return {
      classGroupId: cg.classGroupId,
      gradeLevel: cg.gradeLevel,
      sectionSortKey: sortKey,
      skipHomeroomAuto: skipManualHomeroom || skipLockedSlotRoom,
    };
  });
}
