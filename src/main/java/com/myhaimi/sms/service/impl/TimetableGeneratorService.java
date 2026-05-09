package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.Room;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.SchoolTimeSlot;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.Subject;
import com.myhaimi.sms.entity.TimetableEntry;
import com.myhaimi.sms.entity.TimetableVersion;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.util.*;

/**
 * Two-phase timetable generator (scheduling-only):
 * <p>
 * <b>Phase 1 — day distribution:</b> For each section+subject, spread {@code n} new weekly sessions across working days.
 * For a 5-day week, uses memorizable templates (e.g. 3/wk→Mon–Wed; 4/wk→Mon,Tue,Thu,Fri; 5/wk→all days). Otherwise
 * falls back to balanced counts with extras spread across indices. Packs into days with lowest {@code seedCount + newCount}
 * vs targets so locked cells do not blow per-day caps.
 * <p>
 * <b>Phase 2 — period assignment:</b> <b>Period-major (horizontal):</b> for each period order (P1…Pn), iterate working days
 * (Mon→Fri), and assign one lecture per class that still needs one that day in that slot. This aligns subjects across the week
 * at consistent periods before filling the next row. Scoring uses week balance, same-period consistency with prior days,
 * within-day adjacency avoidance, urgency, spread, and class-teacher P1 preference.
 * <p>
 * Hard: teacher/section/room clash; seeded cells respected.
 */
@Slf4j
@Service
public class TimetableGeneratorService {

    /**
     * @param weeklyOccurrenceIndex 0-based within this section's weekly count for (subject, teacher).
     */
    public record Session(Integer classGroupId, Integer subjectId, Integer teacherId, Integer homeroomRoomId,
                          int weeklyOccurrenceIndex) {}

    public record Slot(DayOfWeek day, Integer timeSlotId, Integer slotOrder) {
        public String key() {
            return day.name() + "|" + timeSlotId;
        }
    }

    public record AnchoredSession(Session session, DayOfWeek targetDay) {}

    public record GenerateResult(
            boolean success,
            List<TimetableEntry> placed,
            Map<String, Object> stats,
            Map<Session, String> lastRejectionReason
    ) {}

    private static final int PEN_DAY_LOAD = 4;
    private static final int PEN_PERIOD_BALANCE = 3;
    // Week-wide visual balance (avoid front-loading): strong enough to affect choices,
    // but never overrides hard constraints (clashes are filtered out before scoring).
    private static final int PEN_DAY_SPARSITY = 20;
    private static final int PEN_EMPTY_TAIL = 35;

    /** Strongly discourage repeating the same subject in consecutive periods when alternatives exist. */
    private static final int PEN_SAME_SUBJECT_ADJACENT = 5000;

    /** Prefer placing subjects that still have many unscheduled occurrences left this day (carry demand forward). */
    private static final int PEN_SUBJECT_URGENCY = 8;

    /** Prefer spacing repeats of the same subject across the day (larger gap since last slot for that subject). */
    private static final int PEN_SUBJECT_SPREAD = 6;

    /**
     * Strong preference for placing a subject at (day, period) when that subject already appears at the same period on other
     * days for this section (horizontal alignment across the week). Scaled by {@link TimetableGeneratorWeights#preferConsistentPeriod()}.
     */
    private static final int PEN_SAME_PERIOD_CONSISTENCY = 14_000;

    /**
     * When this subject already sits on other days, penalize choosing a period away from the dominant (modal) slot order so
     * Wed tracks Mon/Tue even before exact row equality is scored.
     */
    private static final int PEN_OFF_MODAL_PERIOD = 9_000;

    // High priority soft preference: CT should be P1 when CT teaches the section.
    private static final int PEN_CT_NOT_P1 = 120;

    /** Normalizes {@link TimetableGeneratorWeights#preferConsistentPeriod()} so {@code 80} ⇒ multiplier 1 on consistency/modal terms. */
    private static final int CONSISTENCY_WEIGHT_NORM = 80;

    public GenerateResult generate(
            School school,
            TimetableVersion version,
            List<DayOfWeek> days,
            List<SchoolTimeSlot> slots,
            List<Session> sessions,
            Map<Integer, ClassGroup> classById,
            Map<Integer, Subject> subjectById,
            Map<Integer, Staff> staffById,
            Map<Integer, SchoolTimeSlot> slotById,
            TimetableGeneratorWeights weights,
            Random rnd,
            int maxAttempts,
            int nodeBudget,
            Map<Integer, Set<String>> seededClassOcc,
            Map<Integer, Set<String>> seededTeacherOcc,
            Map<Integer, Set<String>> seededRoomOcc,
            Map<String, TimetableEntry> seededExistingByCell,
            Map<Integer, Integer> classTeacherStaffIdByClassGroupId,
            Map<Integer, Room> homeroomRoomByClassGroupId
    ) {
        // ISO Mon→Sun: phase-1 indices, tail/sparsity, and P1..Pn × days must not follow arbitrary JSON order.
        days = new ArrayList<>(days);
        days.sort(Comparator.comparingInt(DayOfWeek::getValue));

        List<Slot> allSlots = new ArrayList<>(days.size() * slots.size());
        for (SchoolTimeSlot ts : slots) {
        for (DayOfWeek d : days) {
                allSlots.add(new Slot(d, ts.getId(), ts.getSlotOrder()));
            }
        }

        List<TimetableEntry> bestPlaced = List.of();
        Map<Session, String> bestReasons = Map.of();
        int bestCount = -1;

        for (int attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
            Map<Integer, Set<String>> classOcc = deepCopyOcc(seededClassOcc);
            Map<Integer, Set<String>> teacherOcc = deepCopyOcc(seededTeacherOcc);
            Map<Integer, Set<String>> roomOcc = deepCopyOcc(seededRoomOcc);
            Map<String, TimetableEntry> existingByCell = new HashMap<>(seededExistingByCell);

            Map<String, Integer> preferredPeriodByBundle = new HashMap<>();
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders = new HashMap<>();
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount = new HashMap<>();
            seedSubjectDayCountsFromExisting(existingByCell, classDaySubjectCount);

            Deque<TimetableEntry> placed = new ArrayDeque<>();
            Map<Session, String> lastReject = new HashMap<>();
            int[] nodesLeft = new int[]{nodeBudget};

            List<AnchoredSession> anchored = phase1DistributeDays(sessions, days, classDaySubjectCount, rnd);
            boolean ok = phase2AssignPeriods(
                    attempt,
                    anchored,
                    days,
                    slots,
                    allSlots,
                    weights,
                    school,
                    version,
                    classById,
                    subjectById,
                    staffById,
                    slotById,
                    classOcc,
                    teacherOcc,
                    roomOcc,
                    existingByCell,
                    preferredPeriodByBundle,
                    classDayFilledOrders,
                    classDaySubjectCount,
                    classTeacherStaffIdByClassGroupId,
                    homeroomRoomByClassGroupId,
                    placed,
                    lastReject,
                    nodesLeft,
                    rnd
            );

            if (ok) {
                Map<String, Object> stats = new LinkedHashMap<>();
                stats.put("attemptsUsed", attempt);
                stats.put("strategy", "two-phase");
                stats.put("nodeBudget", nodeBudget);
                stats.put("nodesRemaining", nodesLeft[0]);
                stats.put("placedCount", placed.size());
                stats.put("totalSessions", sessions.size());
                stats.put("success", true);
                return new GenerateResult(true, new ArrayList<>(placed), stats, lastReject);
            }

            if (placed.size() > bestCount) {
                bestCount = placed.size();
                bestPlaced = new ArrayList<>(placed);
                bestReasons = new HashMap<>(lastReject);
            }
        }

        {
            Map<Integer, Set<String>> classOcc = deepCopyOcc(seededClassOcc);
            Map<Integer, Set<String>> teacherOcc = deepCopyOcc(seededTeacherOcc);
            Map<Integer, Set<String>> roomOcc = deepCopyOcc(seededRoomOcc);
            Map<String, TimetableEntry> existingByCell = new HashMap<>(seededExistingByCell);
            Map<String, Integer> preferredPeriodByBundle = new HashMap<>();
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders = new HashMap<>();
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount = new HashMap<>();
            seedSubjectDayCountsFromExisting(existingByCell, classDaySubjectCount);
            List<TimetableEntry> placed = new ArrayList<>();
            Map<Session, String> lastReject = new HashMap<>();

            int btBudget = Math.max(nodeBudget, sessions.size() * 4_000);
            int[] nodesLeft = new int[]{btBudget};
            List<Session> btOrder = new ArrayList<>(sessions);
            btOrder.sort(Comparator
                    .comparingInt(Session::classGroupId)
                    .thenComparingInt(Session::subjectId)
                    .thenComparingInt(Session::weeklyOccurrenceIndex)
                    .thenComparingInt(Session::teacherId));
            List<AnchoredSession> anchoredDet = phase1DistributeDays(btOrder, days, classDaySubjectCount, new Random(0xC0FFEE));
            List<TimetableEntry> btPlaced = new ArrayList<>();
            BacktrackResult br = backtrackAnchored(
                    btOrder,
                    anchoredDet,
                    days,
                    allSlots,
                    weights,
                    school,
                    version,
                    classById,
                    subjectById,
                    staffById,
                    slotById,
                    classOcc,
                    teacherOcc,
                    roomOcc,
                    existingByCell,
                    preferredPeriodByBundle,
                    classDayFilledOrders,
                    classDaySubjectCount,
                    classTeacherStaffIdByClassGroupId,
                    homeroomRoomByClassGroupId,
                    btPlaced,
                    lastReject,
                    nodesLeft
            );

            if (br.success) {
                Map<String, Object> stats = new LinkedHashMap<>();
                stats.put("attemptsUsed", maxAttempts);
                stats.put("strategy", "backtrack-anchored");
                stats.put("nodeBudget", btBudget);
                stats.put("nodesRemaining", nodesLeft[0]);
                stats.put("placedCount", btPlaced.size());
                stats.put("totalSessions", sessions.size());
                stats.put("success", true);
                return new GenerateResult(true, new ArrayList<>(btPlaced), stats, lastReject);
            }

            if (btPlaced.size() > bestCount) {
                bestCount = btPlaced.size();
                bestPlaced = new ArrayList<>(btPlaced);
                bestReasons = new HashMap<>(lastReject);
            }
        }

        String msg = "Timetable generation failed after " + maxAttempts + " attempt(s). "
                + "Placed " + bestPlaced.size() + "/" + sessions.size() + " sessions. "
                + "Last rejection sample: " + bestReasons.entrySet().stream().findFirst().map(Map.Entry::getValue).orElse("n/a");
        throw new IllegalStateException(msg);
    }

    /**
     * Phase 1: build ideal per-day counts, then assign each session a target weekday respecting caps vs locks.
     */
    private static List<AnchoredSession> phase1DistributeDays(
            List<Session> sessions,
            List<DayOfWeek> workingDays,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> seededSubjectByDay,
            Random rnd
    ) {
        int d = workingDays.size();
        Map<String, List<Session>> byCs = new TreeMap<>();
        for (Session s : sessions) {
            byCs.computeIfAbsent(classSubjectKey(s.classGroupId(), s.subjectId()), k -> new ArrayList<>()).add(s);
        }
        for (List<Session> lst : byCs.values()) {
            lst.sort(Comparator.comparingInt(Session::weeklyOccurrenceIndex));
        }

        List<AnchoredSession> out = new ArrayList<>(sessions.size());
        for (Map.Entry<String, List<Session>> en : byCs.entrySet()) {
            List<Session> lst = en.getValue();
            int n = lst.size();
            String[] parts = en.getKey().split(":");
            int cgId = Integer.parseInt(parts[0]);
            int subjId = Integer.parseInt(parts[1]);

            int[] seedByDayIdx = new int[d];
            int sumSeed = 0;
            for (int j = 0; j < d; j++) {
                DayOfWeek dow = workingDays.get(j);
                int c = seededSubjectByDay
                        .getOrDefault(cgId, Map.of())
                        .getOrDefault(dow, Map.of())
                        .getOrDefault(subjId, 0);
                seedByDayIdx[j] = c;
                sumSeed += c;
            }
            int total = n + sumSeed;
            int maxPer = d <= 0 ? total : Math.max(1, (total + d - 1) / d);

            int[] ideal = idealDayPatternTemplate(total, d);

            int[] newOnDay = new int[d];
            List<DayOfWeek> chosenDays = new ArrayList<>(n);
            for (int u = 0; u < n; u++) {
                int bestJ = -1;
                int bestKey0 = Integer.MAX_VALUE;
                int bestKey1 = Integer.MAX_VALUE;
                int bestKey2 = Integer.MAX_VALUE;
                for (int j = 0; j < d; j++) {
                    int cap = maxPer - seedByDayIdx[j] - newOnDay[j];
                    if (cap <= 0) continue;
                    int cur = seedByDayIdx[j] + newOnDay[j];
                    int gapToIdeal = cur - ideal[j];
                    int dayIx = dayLoadKey(workingDays, workingDays.get(j));
                    if (gapToIdeal < bestKey0
                            || (gapToIdeal == bestKey0 && cur < bestKey1)
                            || (gapToIdeal == bestKey0 && cur == bestKey1 && dayIx < bestKey2)) {
                        bestKey0 = gapToIdeal;
                        bestKey1 = cur;
                        bestKey2 = dayIx;
                        bestJ = j;
                    }
                }
                if (bestJ < 0) {
                    int minLoad = Integer.MAX_VALUE;
                    for (int j = 0; j < d; j++) {
                        int load = seedByDayIdx[j] + newOnDay[j];
                        if (load < minLoad) {
                            minLoad = load;
                            bestJ = j;
                        }
                    }
                }
                newOnDay[bestJ]++;
                chosenDays.add(workingDays.get(bestJ));
            }

            for (int i = 0; i < n; i++) {
                out.add(new AnchoredSession(lst.get(i), chosenDays.get(i)));
            }
        }
        out.sort(Comparator.comparingInt((AnchoredSession a) -> dayLoadKey(workingDays, a.targetDay()))
                .thenComparingInt(a -> a.session().classGroupId())
                .thenComparingInt(a -> a.session().subjectId()));
        Collections.shuffle(out, rnd);
        out.sort(Comparator.comparingInt((AnchoredSession a) -> dayLoadKey(workingDays, a.targetDay())));
        return out;
    }

    private static int dayLoadKey(List<DayOfWeek> workingDays, DayOfWeek dow) {
        int i = workingDays.indexOf(dow);
        return i < 0 ? 7 : i;
    }

    /**
     * Memorizable day targets for a 5-day Mon–Fri week (indices 0…4). Falls back to {@link #idealDayCountsPerWorkingDay}
     * for other week lengths or totals &gt; 7.
     */
    private static int[] idealDayPatternTemplate(int total, int d) {
        if (d == 5 && total >= 1 && total <= 7) {
            return switch (total) {
                case 1 -> new int[]{0, 0, 1, 0, 0};           // Wed only
                case 2 -> new int[]{0, 1, 0, 1, 0};           // Tue / Thu
                case 3 -> new int[]{1, 1, 1, 0, 0};           // Mon–Wed consecutive
                case 4 -> new int[]{1, 1, 0, 1, 1};           // Mon,Tue,Thu,Fri
                case 5 -> new int[]{1, 1, 1, 1, 1};           // daily
                case 6 -> new int[]{2, 1, 1, 1, 1};           // one double + spread
                case 7 -> new int[]{2, 2, 1, 1, 1};
                default -> idealDayCountsPerWorkingDay(total, d);
            };
        }
        return idealDayCountsPerWorkingDay(total, d);
    }

    /**
     * Target lectures per working day for total {@code T} spread across {@code d} days (indices follow {@code workingDays} order).
     * For d=5 yields 5→1,1,1,1,1; 6→2,1,1,1,1; 7→2,1,2,1,1; …; 10→2,2,2,2,2.
     */
    private static int[] idealDayCountsPerWorkingDay(int total, int d) {
        int[] ideal = new int[d];
        if (d <= 0 || total <= 0) {
            return ideal;
        }
        int base = total / d;
        int rem = total % d;
        Arrays.fill(ideal, base);
        for (int k = 0; k < rem; k++) {
            ideal[(k * d) / rem]++;
        }
        return ideal;
    }

    private static boolean phase2AssignPeriods(
            int attempt,
            List<AnchoredSession> anchored,
            List<DayOfWeek> workingDays,
            List<SchoolTimeSlot> slotDefs,
            List<Slot> allSlots,
            TimetableGeneratorWeights w,
            School school,
            TimetableVersion version,
            Map<Integer, ClassGroup> classById,
            Map<Integer, Subject> subjectById,
            Map<Integer, Staff> staffById,
            Map<Integer, SchoolTimeSlot> slotById,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            Map<Integer, Integer> classTeacherStaffIdByClassGroupId,
            Map<Integer, Room> homeroomRoomByClassGroupId,
            Deque<TimetableEntry> placedOut,
            Map<Session, String> lastReject,
            int[] nodesLeft,
            Random rnd
    ) {
        Map<DayOfWeek, Integer> schoolDayLoad = new EnumMap<>(DayOfWeek.class);

        seedSchoolDayLoadFromExisting(existingByCell, schoolDayLoad);

        // cgId -> day -> slotOrder -> subjectId (seeded + newly placed) for adjacency / spread heuristics
        Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> subjectAtSlot = new HashMap<>();
        seedSubjectAtSlotFromExisting(existingByCell, subjectAtSlot);
        // cgId -> day -> subjectId -> last slotOrder seen that day (for spread)
        Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> lastSlotForSubject = new HashMap<>();

        Map<Integer, Map<DayOfWeek, List<AnchoredSession>>> pending = new HashMap<>();
        for (AnchoredSession a : anchored) {
            Session s = a.session();
            pending
                    .computeIfAbsent(s.classGroupId(), k -> new HashMap<>())
                    .computeIfAbsent(a.targetDay(), k -> new ArrayList<>())
                    .add(a);
        }

        List<SchoolTimeSlot> orderedSlots = new ArrayList<>(slotDefs);
        orderedSlots.sort(Comparator.comparingInt(SchoolTimeSlot::getSlotOrder));

        // Period-major: fill P1 across Mon..Fri, then P2 across Mon..Fri, … (not Mon P1..Pn then Tue …).
        for (SchoolTimeSlot ts : orderedSlots) {
            int po = ts.getSlotOrder();
            for (DayOfWeek day : workingDays) {
                Slot slot = new Slot(day, ts.getId(), po);
                String cell = slot.key();

                List<Integer> cgIds = new ArrayList<>();
                for (Map.Entry<Integer, Map<DayOfWeek, List<AnchoredSession>>> en : pending.entrySet()) {
                    List<AnchoredSession> bucket = en.getValue().get(day);
                    if (bucket != null && !bucket.isEmpty()) {
                        cgIds.add(en.getKey());
                    }
                }
                Collections.shuffle(cgIds, rnd);

                for (Integer cgId : cgIds) {
                    List<AnchoredSession> bucket = pending.get(cgId).get(day);
                    if (bucket == null || bucket.isEmpty()) continue;

                    if (classOcc.getOrDefault(cgId, Set.of()).contains(cell)) {
                        continue;
                    }

                    Integer prevSubj = previousSlotSubject(subjectAtSlot, cgId, day, po);
                    List<AnchoredSession> valid = new ArrayList<>();
                    for (AnchoredSession cand : new ArrayList<>(bucket)) {
                        Session s = cand.session();
                        Integer tId = s.teacherId();
                        Integer homeroomRid = s.homeroomRoomId();
            Set<String> classBusy = classOcc.getOrDefault(cgId, Set.of());
            Set<String> teacherBusy = teacherOcc.getOrDefault(tId, Set.of());
                        Set<String> roomBusy = homeroomRid == null ? Set.of() : roomOcc.getOrDefault(homeroomRid, Set.of());
                        if (classBusy.contains(cell)) continue;
                        if (teacherBusy.contains(cell)) continue;
                        if (homeroomRid != null && roomBusy.contains(cell)) continue;
                        valid.add(cand);
                    }

                    if (valid.isEmpty()) {
                    continue;
                }

                    boolean existsDiffFromPrev = false;
                    if (prevSubj != null) {
                        for (AnchoredSession v : valid) {
                            if (!v.session().subjectId().equals(prevSubj)) {
                                existsDiffFromPrev = true;
                                break;
                            }
                        }
                    }

                    AnchoredSession best = null;
                    int bestPen = Integer.MAX_VALUE;
                    for (AnchoredSession cand : valid) {
                        Session s = cand.session();
                        int remSubj = countSubjectOccurrences(bucket, s.subjectId());
                        Integer lastSlot = lastSlotForSubject
                                .getOrDefault(cgId, Map.of())
                                .getOrDefault(day, Map.of())
                                .get(s.subjectId());
                        int consistencyMatches = countSameSubjectSamePeriodElsewhere(
                                subjectAtSlot, cgId, day, po, s.subjectId());
                        int pen = slotFirstPenalty(
                                s,
                                slot,
                                workingDays,
                                schoolDayLoad,
                                classDayFilledOrders,
                                classTeacherStaffIdByClassGroupId,
                                w,
                                remSubj,
                                lastSlot,
                                existsDiffFromPrev,
                                prevSubj,
                                consistencyMatches,
                                subjectAtSlot
                        );
                        if (pen < bestPen) {
                            bestPen = pen;
                            best = cand;
                        }
                    }

                    if (nodesLeft[0]-- <= 0) {
                        lastReject.put(bucket.getFirst().session(), "Node budget exhausted");
                return false;
            }

                    Session s = best.session();
                    Integer tId = s.teacherId();
                    Integer subjId = s.subjectId();
                    Integer homeroomRid = s.homeroomRoomId();

                    ClassGroup cg = classById.get(cgId);
                    Subject subj = subjectById.get(subjId);
                    Staff teacher = staffById.get(tId);
                    if (cg == null || subj == null || teacher == null) {
                        lastReject.put(s, "Missing entity (class/subject/teacher)");
                        return false;
                    }

            TimetableEntry e = new TimetableEntry();
            e.setSchool(school);
            e.setTimetableVersion(version);
            e.setClassGroup(cg);
            e.setSubject(subj);
            e.setStaff(teacher);
                    e.setDayOfWeek(slot.day());
                    e.setTimeSlot(slotById.get(slot.timeSlotId()));
                    Room hr = homeroomRoomByClassGroupId.get(cgId);
                    if (hr != null) {
                        e.setRoom(hr);
                    }

                    place(e, cgId, tId, homeroomRid, slot, classOcc, teacherOcc, roomOcc, existingByCell,
                    preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount, bundleKey(s));

                    subjectAtSlot
                            .computeIfAbsent(cgId, k -> new EnumMap<>(DayOfWeek.class))
                            .computeIfAbsent(day, k -> new HashMap<>())
                            .put(po, subjId);
                    lastSlotForSubject
                            .computeIfAbsent(cgId, k -> new EnumMap<>(DayOfWeek.class))
                            .computeIfAbsent(day, k -> new HashMap<>())
                            .put(subjId, po);

                    schoolDayLoad.merge(day, 1, Integer::sum);
            placedOut.addLast(e);

                    bucket.remove(best);
                }
            }
        }

        for (Map.Entry<Integer, Map<DayOfWeek, List<AnchoredSession>>> e : pending.entrySet()) {
            for (Map.Entry<DayOfWeek, List<AnchoredSession>> d : e.getValue().entrySet()) {
                if (!d.getValue().isEmpty()) {
                    Session left = d.getValue().getFirst().session();
                    lastReject.put(left, "Could not place all sessions on " + d.getKey() + " (period-major packing)");
                    if (log.isWarnEnabled()) {
                        log.warn("TT two-phase attempt={} incomplete: classGroupId={} day={} remaining={}",
                                attempt, e.getKey(), d.getKey(), d.getValue().size());
                    }
                    return false;
                }
            }
        }

        return true;
    }

    private static void seedSubjectAtSlotFromExisting(
            Map<String, TimetableEntry> existingByCell,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> subjectAtSlot
    ) {
        for (TimetableEntry e : existingByCell.values()) {
            if (e.getClassGroup() == null || e.getSubject() == null || e.getDayOfWeek() == null || e.getTimeSlot() == null) {
                continue;
            }
            int cgId = e.getClassGroup().getId();
            int so = e.getTimeSlot().getSlotOrder();
            int sid = e.getSubject().getId();
            subjectAtSlot
                    .computeIfAbsent(cgId, k -> new EnumMap<>(DayOfWeek.class))
                    .computeIfAbsent(e.getDayOfWeek(), k -> new HashMap<>())
                    .put(so, sid);
        }
    }

    private static Integer previousSlotSubject(
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> subjectAtSlot,
            int cgId,
            DayOfWeek day,
            int slotOrder
    ) {
        if (slotOrder <= 1) return null;
        Map<Integer, Integer> row = subjectAtSlot.getOrDefault(cgId, Map.of()).getOrDefault(day, Map.of());
        return row.get(slotOrder - 1);
    }

    private static int countSubjectOccurrences(List<AnchoredSession> bucket, Integer subjectId) {
        int c = 0;
        for (AnchoredSession a : bucket) {
            if (Objects.equals(a.session().subjectId(), subjectId)) c++;
        }
        return c;
    }

    /**
     * Other working days (excluding {@code day}) where this class already has {@code subjectId} at {@code slotOrder}.
     */
    private static int countSameSubjectSamePeriodElsewhere(
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> subjectAtSlot,
            int cgId,
            DayOfWeek day,
            int slotOrder,
            Integer subjectId
    ) {
        if (subjectId == null) return 0;
        Map<DayOfWeek, Map<Integer, Integer>> byDay = subjectAtSlot.getOrDefault(cgId, Map.of());
        int n = 0;
        for (Map.Entry<DayOfWeek, Map<Integer, Integer>> en : byDay.entrySet()) {
            if (en.getKey().equals(day)) continue;
            Integer sid = en.getValue() != null ? en.getValue().get(slotOrder) : null;
            if (subjectId.equals(sid)) n++;
        }
        return n;
    }

    /**
     * Among other days (not {@code excludeDay}) where this subject is already placed, return the most common period
     * (slot order). Ties go to the smaller period index for stability.
     */
    private static Integer dominantPeriodForSubjectElsewhere(
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> subjectAtSlot,
            int cgId,
            Integer subjectId,
            DayOfWeek excludeDay
    ) {
        if (subjectId == null) return null;
        Map<DayOfWeek, Map<Integer, Integer>> byDay = subjectAtSlot.getOrDefault(cgId, Map.of());
        int[] hist = new int[64];
        for (Map.Entry<DayOfWeek, Map<Integer, Integer>> en : byDay.entrySet()) {
            if (en.getKey().equals(excludeDay)) continue;
            Map<Integer, Integer> row = en.getValue();
            if (row == null) continue;
            for (Map.Entry<Integer, Integer> cell : row.entrySet()) {
                if (subjectId.equals(cell.getValue())) {
                    int so = cell.getKey();
                    if (so >= 0 && so < hist.length) {
                        hist[so]++;
                    }
                }
            }
        }
        int bestSo = -1;
        int bestCnt = 0;
        for (int so = 0; so < hist.length; so++) {
            int h = hist[so];
            if (h == 0) continue;
            if (h > bestCnt || (h == bestCnt && (bestSo < 0 || so < bestSo))) {
                bestCnt = h;
                bestSo = so;
            }
        }
        return bestCnt > 0 ? bestSo : null;
    }

    private static int slotFirstPenalty(
            Session s,
            Slot slot,
            List<DayOfWeek> workingDays,
            Map<DayOfWeek, Integer> schoolDayLoad,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Integer> classTeacherStaffIdByClassGroupId,
            TimetableGeneratorWeights w,
            int remainingForSubjectOnThisDay,
            Integer lastSlotForThisSubject,
            boolean existsDifferentValidFromPrev,
            Integer prevSubjectId,
            int samePeriodConsistencyMatchesElsewhere,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> subjectAtSlot
    ) {
        int pen = phase2Penalty(s, slot, workingDays, schoolDayLoad, classDayFilledOrders, classTeacherStaffIdByClassGroupId, w);

        int cw = Math.max(1, w.preferConsistentPeriod());

        pen -= PEN_SUBJECT_URGENCY * Math.max(0, remainingForSubjectOnThisDay);
        if (lastSlotForThisSubject != null) {
            pen -= PEN_SUBJECT_SPREAD * (slot.slotOrder() - lastSlotForThisSubject);
        }

        pen -= (PEN_SAME_PERIOD_CONSISTENCY * cw / CONSISTENCY_WEIGHT_NORM)
                * Math.max(0, samePeriodConsistencyMatchesElsewhere);

        Integer modalElsewhere = dominantPeriodForSubjectElsewhere(
                subjectAtSlot, s.classGroupId(), s.subjectId(), slot.day());
        if (modalElsewhere != null) {
            pen += (PEN_OFF_MODAL_PERIOD * cw / CONSISTENCY_WEIGHT_NORM)
                    * Math.abs(slot.slotOrder() - modalElsewhere);
        }

        if (prevSubjectId != null && prevSubjectId.equals(s.subjectId())) {
            if (existsDifferentValidFromPrev) {
                pen += PEN_SAME_SUBJECT_ADJACENT;
            }
        }

        return pen;
    }

    private static int phase2Penalty(
            Session s,
            Slot slot,
            List<DayOfWeek> workingDays,
            Map<DayOfWeek, Integer> schoolDayLoad,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Integer> classTeacherStaffIdByClassGroupId,
            TimetableGeneratorWeights w
    ) {
        int pen = PEN_DAY_LOAD * schoolDayLoad.getOrDefault(slot.day(), 0);

        BitSet filled = classDayFilledOrders
                .getOrDefault(s.classGroupId(), Map.of())
                .getOrDefault(slot.day(), new BitSet());
        int po = slot.slotOrder();
        pen += PEN_PERIOD_BALANCE * filled.cardinality();

        // Late-week balancing: penalize moves that increase Mon/Tue/Wed saturation while Thu/Fri stay sparse.
        pen += daySparsityPenalty(workingDays, schoolDayLoad, slot.day());
        pen += emptyTailPenalty(workingDays, schoolDayLoad, slot.day());

        Integer ct = classTeacherStaffIdByClassGroupId.get(s.classGroupId());
        if (ct != null && ct.equals(s.teacherId()) && po != 1) {
            pen += PEN_CT_NOT_P1 * (po - 1) + (w.preferClassTeacherFirstPeriod() > 0 ? 1 : 0);
        }

        return pen;
    }

    private static void seedSchoolDayLoadFromExisting(
            Map<String, TimetableEntry> existingByCell,
            Map<DayOfWeek, Integer> schoolDayLoad
    ) {
        for (TimetableEntry e : existingByCell.values()) {
            DayOfWeek d = e.getDayOfWeek();
            if (d == null) continue;
            schoolDayLoad.merge(d, 1, Integer::sum);
        }
    }

    /**
     * Penalize increasing imbalance between earlier and later working days.
     * Heavier penalty when later days are much emptier than earlier days.
     */
    private static int daySparsityPenalty(
            List<DayOfWeek> workingDays,
            Map<DayOfWeek, Integer> schoolDayLoad,
            DayOfWeek placingDay
    ) {
        int d = workingDays.size();
        if (d <= 1) return 0;

        int[] loads = new int[d];
        int sum = 0;
        for (int i = 0; i < d; i++) {
            loads[i] = schoolDayLoad.getOrDefault(workingDays.get(i), 0);
            sum += loads[i];
        }
        int placingIx = dayLoadKey(workingDays, placingDay);
        if (placingIx < 0 || placingIx >= d) return 0;

        // Simulate this placement.
        loads[placingIx]++;
        sum++;

        int avg = (int) Math.ceil(sum / (double) d);
        int tailN = Math.min(2, d);
        int tailSum = 0;
        int headSum = 0;
        int headN = d - tailN;
        for (int i = 0; i < d; i++) {
            if (i >= d - tailN) tailSum += loads[i];
            else headSum += loads[i];
        }
        int tailAvg = (int) Math.floor(tailSum / (double) tailN);
        int headAvg = headN > 0 ? (int) Math.floor(headSum / (double) headN) : avg;

        // If tail is much sparser than head, penalize adding more to the head.
        int gap = headAvg - tailAvg;
        if (gap <= 1) return 0;

        boolean placingInHead = placingIx < d - tailN;
        if (!placingInHead) {
            // Filling the tail reduces imbalance; small reward is handled by returning 0 here.
            return 0;
        }

        // Quadratic growth so extreme cases like 7/7/6/1/0 get heavily discouraged.
        return PEN_DAY_SPARSITY * gap * gap;
    }

    /**
     * Penalize schedules that leave the last N working days mostly empty while earlier days are saturated.
     * This is a stronger “tail protection” than simple sparsity, and pushes the solver to fill Thu/Fri earlier.
     */
    private static int emptyTailPenalty(
            List<DayOfWeek> workingDays,
            Map<DayOfWeek, Integer> schoolDayLoad,
            DayOfWeek placingDay
    ) {
        int d = workingDays.size();
        if (d <= 2) return 0;

        int tailN = Math.min(2, d);
        int[] loads = new int[d];
        int sum = 0;
        for (int i = 0; i < d; i++) {
            loads[i] = schoolDayLoad.getOrDefault(workingDays.get(i), 0);
            sum += loads[i];
        }
        int placingIx = dayLoadKey(workingDays, placingDay);
        if (placingIx < 0 || placingIx >= d) return 0;
        loads[placingIx]++;
        sum++;

        int tailSum = 0;
        for (int i = d - tailN; i < d; i++) tailSum += loads[i];

        // Expected tail share if week was roughly balanced.
        double expectedTail = sum * (tailN / (double) d);
        double deficit = expectedTail - tailSum;
        if (deficit <= 0.75) return 0;

        // Stronger than sparsity: linear+quadratic to avoid "mostly empty Thu/Fri".
        int def = (int) Math.ceil(deficit);
        return PEN_EMPTY_TAIL * def + (PEN_EMPTY_TAIL / 2) * def * def;
    }

    private record BacktrackResult(boolean success) {}

    /**
     * Anchored CSP: each session only on its phase-1 day; candidates scored by same phase-2 penalty (minimize).
     */
    private static BacktrackResult backtrackAnchored(
            List<Session> sessions,
            List<AnchoredSession> anchoredList,
            List<DayOfWeek> workingDays,
            List<Slot> allSlots,
            TimetableGeneratorWeights w,
            School school,
            TimetableVersion version,
            Map<Integer, ClassGroup> classById,
            Map<Integer, Subject> subjectById,
            Map<Integer, Staff> staffById,
            Map<Integer, SchoolTimeSlot> slotById,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            Map<Integer, Integer> classTeacherStaffIdByClassGroupId,
            Map<Integer, Room> homeroomRoomByClassGroupId,
            List<TimetableEntry> placedOut,
            Map<Session, String> lastReject,
            int[] nodesLeft
    ) {
        Map<Session, DayOfWeek> anchor = new HashMap<>();
        for (AnchoredSession a : anchoredList) {
            anchor.put(a.session(), a.targetDay());
        }
        int n = sessions.size();
        int m = allSlots.size();
        if (n == 0) return new BacktrackResult(true);

        BitSet[] domain = new BitSet[n];
        for (int i = 0; i < n; i++) {
            Session s = sessions.get(i);
            DayOfWeek ad = anchor.get(s);
            if (ad == null) {
                lastReject.put(s, "Missing anchor day");
                return new BacktrackResult(false);
            }
            Set<String> classBusy = classOcc.getOrDefault(s.classGroupId(), Set.of());
            Set<String> teacherBusy = teacherOcc.getOrDefault(s.teacherId(), Set.of());
            Integer hr = s.homeroomRoomId();
            Set<String> roomBusy = hr == null ? Set.of() : roomOcc.getOrDefault(hr, Set.of());
            BitSet d = new BitSet(m);
            for (int k = 0; k < m; k++) {
                Slot slot = allSlots.get(k);
                if (slot.day() != ad) continue;
                String cell = slot.key();
                if (classBusy.contains(cell)) continue;
                if (teacherBusy.contains(cell)) continue;
                if (hr != null && roomBusy.contains(cell)) continue;
                d.set(k);
            }
            if (d.isEmpty()) {
                lastReject.put(s, "No slot on anchored day " + ad);
                return new BacktrackResult(false);
            }
            domain[i] = d;
        }

        int[][] sharesByIdx = buildShares(sessions);
        boolean[] assigned = new boolean[n];
        int[] assignedSlot = new int[n];
        Arrays.fill(assignedSlot, -1);
        Map<DayOfWeek, Integer> schoolDayLoad = new EnumMap<>(DayOfWeek.class);
        seedSchoolDayLoadFromExisting(existingByCell, schoolDayLoad);

        Deque<long[]> pruneStack = new ArrayDeque<>();
        boolean ok = solveAnchored(
                0, n, m, sessions, allSlots, w, domain, assigned, assignedSlot,
                sharesByIdx, anchor, pruneStack,
                classOcc, teacherOcc, roomOcc, existingByCell,
                preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount,
                schoolDayLoad,
                classTeacherStaffIdByClassGroupId,
                workingDays, lastReject, nodesLeft
        );
        if (!ok) return new BacktrackResult(false);

        for (int i = 0; i < n; i++) {
            int slotIdx = assignedSlot[i];
            Session s = sessions.get(i);
            Slot slot = allSlots.get(slotIdx);
            TimetableEntry e = new TimetableEntry();
            e.setSchool(school);
            e.setTimetableVersion(version);
            e.setClassGroup(classById.get(s.classGroupId()));
            e.setSubject(subjectById.get(s.subjectId()));
            e.setStaff(staffById.get(s.teacherId()));
            e.setDayOfWeek(slot.day());
            e.setTimeSlot(slotById.get(slot.timeSlotId()));
            Room room = homeroomRoomByClassGroupId.get(s.classGroupId());
            if (room != null) e.setRoom(room);
            placedOut.add(e);
        }
        return new BacktrackResult(true);
    }

    private static boolean solveAnchored(
            int placedCount,
            int n,
            int m,
            List<Session> sessions,
            List<Slot> allSlots,
            TimetableGeneratorWeights w,
            BitSet[] domain,
            boolean[] assigned,
            int[] assignedSlot,
            int[][] sharesByIdx,
            Map<Session, DayOfWeek> anchor,
            Deque<long[]> pruneStack,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            Map<DayOfWeek, Integer> schoolDayLoad,
            Map<Integer, Integer> classTeacherStaffIdByClassGroupId,
            List<DayOfWeek> workingDays,
            Map<Session, String> lastReject,
            int[] nodesLeft
    ) {
        if (placedCount == n) return true;
        if (nodesLeft[0]-- <= 0) {
            lastReject.put(sessions.getFirst(), "Search budget exhausted");
            return false;
        }

        int chosen = -1;
        int minSize = Integer.MAX_VALUE;
        int chosenDeg = -1;
        for (int i = 0; i < n; i++) {
            if (assigned[i]) continue;
            int sz = domain[i].cardinality();
            if (sz == 0) {
                lastReject.put(sessions.get(i), "Forward-check eliminated all slots");
                return false;
            }
            int deg = sharesByIdx[i].length;
            if (sz < minSize || (sz == minSize && deg > chosenDeg)) {
                minSize = sz;
                chosenDeg = deg;
                chosen = i;
            }
        }
        if (chosen < 0) return true;

        Session s = sessions.get(chosen);
        DayOfWeek ad = anchor.get(s);

        BitSet d = domain[chosen];
        int[] candidates = new int[d.cardinality()];
        int cc = 0;
        for (int k = d.nextSetBit(0); k >= 0; k = d.nextSetBit(k + 1)) {
            Slot sl = allSlots.get(k);
            candidates[cc++] = k;
        }
        if (cc == 0) {
            lastReject.put(s, "No valid slot on anchored day");
            return false;
        }

        int[][] scored = new int[cc][2];
        for (int k = 0; k < cc; k++) {
            int slotIdx = candidates[k];
            Slot slot = allSlots.get(slotIdx);
            scored[k][0] = phase2Penalty(s, slot, workingDays, schoolDayLoad, classDayFilledOrders, classTeacherStaffIdByClassGroupId, w);
            scored[k][1] = slotIdx;
        }
        Arrays.sort(scored, Comparator.comparingInt(a -> a[0]));

        int branchCap = Math.min(scored.length, Math.max(8, Math.min(16, (int) Math.ceil(scored.length / 2.0))));
        for (int idx = 0; idx < branchCap; idx++) {
            int slotIdx = scored[idx][1];
            Slot slot = allSlots.get(slotIdx);

            assigned[chosen] = true;
            assignedSlot[chosen] = slotIdx;
            String cell = slot.key();
            classOcc.computeIfAbsent(s.classGroupId(), k -> new HashSet<>()).add(cell);
            teacherOcc.computeIfAbsent(s.teacherId(), k -> new HashSet<>()).add(cell);
            Integer hr = s.homeroomRoomId();
            if (hr != null) roomOcc.computeIfAbsent(hr, k -> new HashSet<>()).add(cell);
            preferredPeriodByBundle.putIfAbsent(bundleKey(s), slot.slotOrder());
            classDayFilledOrders
                    .computeIfAbsent(s.classGroupId(), k -> new HashMap<>())
                    .computeIfAbsent(slot.day(), k -> new BitSet())
                    .set(slot.slotOrder() - 1);
            classDaySubjectCount
                    .computeIfAbsent(s.classGroupId(), k -> new HashMap<>())
                    .computeIfAbsent(slot.day(), k -> new HashMap<>())
                    .merge(s.subjectId(), 1, Integer::sum);
            schoolDayLoad.merge(slot.day(), 1, Integer::sum);

            int prunedMark = pruneStack.size();
            boolean wipeout = false;
            for (int peer : sharesByIdx[chosen]) {
                if (assigned[peer]) continue;
                if (domain[peer].get(slotIdx)) {
                    domain[peer].clear(slotIdx);
                    pruneStack.push(new long[]{peer, slotIdx});
                    if (domain[peer].isEmpty()) wipeout = true;
                }
            }

            if (!wipeout && solveAnchored(placedCount + 1, n, m, sessions, allSlots, w, domain, assigned, assignedSlot,
                    sharesByIdx, anchor, pruneStack,
                    classOcc, teacherOcc, roomOcc, existingByCell, preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount,
                    schoolDayLoad, classTeacherStaffIdByClassGroupId, workingDays, lastReject, nodesLeft)) {
                    return true;
            }

            while (pruneStack.size() > prunedMark) {
                long[] pp = pruneStack.pop();
                domain[(int) pp[0]].set((int) pp[1]);
            }
            schoolDayLoad.merge(slot.day(), -1, Integer::sum);
            classOcc.get(s.classGroupId()).remove(cell);
            teacherOcc.get(s.teacherId()).remove(cell);
            if (hr != null) {
                Set<String> rs = roomOcc.get(hr);
                if (rs != null) rs.remove(cell);
            }
            BitSet bs = classDayFilledOrders.getOrDefault(s.classGroupId(), Map.of()).getOrDefault(slot.day(), null);
            if (bs != null) bs.clear(slot.slotOrder() - 1);
            Map<Integer, Integer> sc = classDaySubjectCount.getOrDefault(s.classGroupId(), Map.of()).getOrDefault(slot.day(), Map.of());
            Integer kc = sc.get(s.subjectId());
            if (kc != null) {
                if (kc <= 1) sc.remove(s.subjectId());
                else sc.put(s.subjectId(), kc - 1);
            }
            assigned[chosen] = false;
            assignedSlot[chosen] = -1;
        }
        return false;
    }

    private static int[][] buildShares(List<Session> sessions) {
        int n = sessions.size();
        Map<Integer, List<Integer>> byClass = new HashMap<>();
        Map<Integer, List<Integer>> byTeacher = new HashMap<>();
        Map<Integer, List<Integer>> byRoom = new HashMap<>();
        for (int i = 0; i < n; i++) {
            Session s = sessions.get(i);
            byClass.computeIfAbsent(s.classGroupId(), k -> new ArrayList<>()).add(i);
            byTeacher.computeIfAbsent(s.teacherId(), k -> new ArrayList<>()).add(i);
            if (s.homeroomRoomId() != null) {
                byRoom.computeIfAbsent(s.homeroomRoomId(), k -> new ArrayList<>()).add(i);
            }
        }
        int[][] shares = new int[n][];
        for (int i = 0; i < n; i++) {
            Session s = sessions.get(i);
            Set<Integer> set = new HashSet<>();
            for (Integer j : byClass.getOrDefault(s.classGroupId(), List.of())) if (j != i) set.add(j);
            for (Integer j : byTeacher.getOrDefault(s.teacherId(), List.of())) if (j != i) set.add(j);
            if (s.homeroomRoomId() != null) {
                for (Integer j : byRoom.getOrDefault(s.homeroomRoomId(), List.of())) if (j != i) set.add(j);
            }
            int[] arr = new int[set.size()];
            int p = 0;
            for (Integer j : set) arr[p++] = j;
            shares[i] = arr;
        }
        return shares;
    }

    private static void place(
            TimetableEntry e,
            Integer cgId,
            Integer teacherId,
            Integer homeroomRoomId,
            Slot slot,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            String bundleKey
    ) {
        String cell = slot.key();
        classOcc.computeIfAbsent(cgId, k -> new HashSet<>()).add(cell);
        teacherOcc.computeIfAbsent(teacherId, k -> new HashSet<>()).add(cell);
        if (homeroomRoomId != null) {
            roomOcc.computeIfAbsent(homeroomRoomId, k -> new HashSet<>()).add(cell);
        }
        existingByCell.put(cgId + "|" + slot.day().name() + "|" + slot.timeSlotId(), e);

        preferredPeriodByBundle.putIfAbsent(bundleKey, slot.slotOrder());

        classDayFilledOrders
                .computeIfAbsent(cgId, k -> new HashMap<>())
                .computeIfAbsent(slot.day(), k -> new BitSet())
                .set(slot.slotOrder() - 1);

        classDaySubjectCount
                .computeIfAbsent(cgId, k -> new HashMap<>())
                .computeIfAbsent(slot.day(), k -> new HashMap<>())
                .merge(e.getSubject().getId(), 1, Integer::sum);
    }

    private static String bundleKey(Session s) {
        return s.classGroupId() + ":" + s.subjectId() + ":" + s.teacherId();
    }

    private static String classSubjectKey(int classGroupId, int subjectId) {
        return classGroupId + ":" + subjectId;
    }

    private static void seedSubjectDayCountsFromExisting(
            Map<String, TimetableEntry> existingByCell,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount
    ) {
        for (TimetableEntry e : existingByCell.values()) {
            if (e.getClassGroup() == null || e.getSubject() == null || e.getDayOfWeek() == null) continue;
            int cgId = e.getClassGroup().getId();
            int subjId = e.getSubject().getId();
            classDaySubjectCount
                    .computeIfAbsent(cgId, k -> new HashMap<>())
                    .computeIfAbsent(e.getDayOfWeek(), k -> new HashMap<>())
                    .merge(subjId, 1, Integer::sum);
        }
    }

    private static Map<Integer, Set<String>> deepCopyOcc(Map<Integer, Set<String>> in) {
        Map<Integer, Set<String>> out = new HashMap<>();
        for (Map.Entry<Integer, Set<String>> e : in.entrySet()) {
            out.put(e.getKey(), new HashSet<>(e.getValue()));
        }
        return out;
    }
}
