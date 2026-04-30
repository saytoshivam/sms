package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.ClassGroup;
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
 * Constraint-based timetable generator (scheduling-only):
 * - Teacher ownership is fixed per (classGroup, subject) by upstream steps.
 * - Hard constraints: teacher clash, class clash, exact weekly frequency.
 * - Soft constraints: period consistency, avoid clustering, spread across week, avoid gaps.
 *
 * Rooms are intentionally ignored as a constraint (homeroom-only), per product requirement.
 */
@Slf4j
@Service
public class TimetableGeneratorService {

    public record Session(Integer classGroupId, Integer subjectId, Integer teacherId) {}

    public record Slot(DayOfWeek day, Integer timeSlotId, Integer slotOrder) {
        public String key() { return day.name() + "|" + timeSlotId; }
    }

    public record GenerateResult(
            boolean success,
            List<TimetableEntry> placed,
            Map<String, Object> stats,
            Map<Session, String> lastRejectionReason
    ) {}

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
            Map<String, TimetableEntry> seededExistingByCell
    ) {
        // Prebuild slots list
        List<Slot> allSlots = new ArrayList<>(days.size() * slots.size());
        for (DayOfWeek d : days) {
            for (SchoolTimeSlot s : slots) {
                allSlots.add(new Slot(d, s.getId(), s.getSlotOrder()));
            }
        }

        // Best attempt tracking (only used for diagnostics)
        List<TimetableEntry> bestPlaced = List.of();
        Map<Session, String> bestReasons = Map.of();
        int bestCount = -1;

        for (int attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
            // Copy occupancies so each attempt is independent (locks/manual entries preserved)
            Map<Integer, Set<String>> classOcc = deepCopyOcc(seededClassOcc);
            Map<Integer, Set<String>> teacherOcc = deepCopyOcc(seededTeacherOcc);
            Map<String, TimetableEntry> existingByCell = new HashMap<>(seededExistingByCell);

            // Tracking to score soft constraints
            Map<String, Integer> preferredPeriodByBundle = new HashMap<>();
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders = new HashMap<>();
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount = new HashMap<>();

            // Shuffle sessions to provide diverse search seeds across attempts.
            List<Session> shuffled = new ArrayList<>(sessions);
            Collections.shuffle(shuffled, rnd);

            Deque<TimetableEntry> placed = new ArrayDeque<>();
            Map<Session, String> lastReject = new HashMap<>();

            int[] nodesLeft = new int[]{nodeBudget};
            // First try the cheap greedy placer (fast path for easy inputs).
            boolean ok = greedyPlaceAll(
                    attempt,
                    shuffled,
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
                    existingByCell,
                    preferredPeriodByBundle,
                    classDayFilledOrders,
                    classDaySubjectCount,
                    placed,
                    lastReject,
                    nodesLeft
            );

            if (ok) {
                Map<String, Object> stats = new LinkedHashMap<>();
                stats.put("attemptsUsed", attempt);
                stats.put("strategy", "greedy");
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

        // Greedy could not fit everything in the per-attempt budget. Fall back to a proper CSP backtracking
        // solver (MRV + forward-checking + LCV) which handles tight schedules where greedy paints itself
        // into corners. This runs once with a generous budget; if it still cannot satisfy, we surface
        // diagnostics from the best greedy attempt so the UI can guide the user.
        {
            Map<Integer, Set<String>> classOcc = deepCopyOcc(seededClassOcc);
            Map<Integer, Set<String>> teacherOcc = deepCopyOcc(seededTeacherOcc);
            Map<String, TimetableEntry> existingByCell = new HashMap<>(seededExistingByCell);
            Map<String, Integer> preferredPeriodByBundle = new HashMap<>();
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders = new HashMap<>();
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount = new HashMap<>();
            List<TimetableEntry> placed = new ArrayList<>();
            Map<Session, String> lastReject = new HashMap<>();

            int btBudget = Math.max(nodeBudget, sessions.size() * 4_000);
            int[] nodesLeft = new int[]{btBudget};
            BacktrackResult br = backtrackPlace(
                    sessions,
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
                    existingByCell,
                    preferredPeriodByBundle,
                    classDayFilledOrders,
                    classDaySubjectCount,
                    placed,
                    lastReject,
                    nodesLeft
            );

            if (br.success) {
                Map<String, Object> stats = new LinkedHashMap<>();
                stats.put("attemptsUsed", maxAttempts);
                stats.put("strategy", "backtrack");
                stats.put("nodeBudget", btBudget);
                stats.put("nodesRemaining", nodesLeft[0]);
                stats.put("placedCount", placed.size());
                stats.put("totalSessions", sessions.size());
                stats.put("success", true);
                return new GenerateResult(true, new ArrayList<>(placed), stats, lastReject);
            }

            // Use the best-of (greedy vs backtrack partial) for diagnostics.
            if (placed.size() > bestCount) {
                bestCount = placed.size();
                bestPlaced = new ArrayList<>(placed);
                bestReasons = new HashMap<>(lastReject);
            }
        }

        // Strict requirement: do not return partial timetables when a valid schedule exists.
        // If we cannot place everything after retries, throw with diagnostics.
        String msg = "Timetable generation failed after " + maxAttempts + " attempt(s). "
                + "Placed " + bestPlaced.size() + "/" + sessions.size() + " sessions. "
                + "Last rejection sample: " + bestReasons.entrySet().stream().findFirst().map(e -> e.getValue()).orElse("n/a");
        throw new IllegalStateException(msg);
    }

    /**
     * Greedy placer that ALWAYS evaluates ALL slots, picks best scoring valid slot, and never skips
     * if a valid slot exists (teacher free + class free).
     *
     * This matches the "mandatory" algorithm requirement for the current bugfix.
     */
    private boolean greedyPlaceAll(
            int attempt,
            List<Session> sessions,
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
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            Deque<TimetableEntry> placedOut,
            Map<Session, String> lastReject,
            int[] nodesLeft
    ) {
        for (int i = 0; i < sessions.size(); i++) {
            if (nodesLeft[0]-- <= 0) {
                lastReject.put(sessions.get(i), "Node budget exhausted");
                return false;
            }
            Session s = sessions.get(i);
            Integer cgId = s.classGroupId();
            Integer tId = s.teacherId();
            Integer subjId = s.subjectId();

            ClassGroup cg = classById.get(cgId);
            Subject subj = subjectById.get(subjId);
            Staff teacher = staffById.get(tId);
            if (cg == null || subj == null || teacher == null) {
                lastReject.put(s, "Missing entity (class/subject/teacher)");
                return false;
            }

            // ALWAYS iterate all slots; only reject by hard constraints.
            int classBlocked = 0;
            int teacherBlocked = 0;
            ScoredSlot best = null;

            Set<String> classBusy = classOcc.getOrDefault(cgId, Set.of());
            Set<String> teacherBusy = teacherOcc.getOrDefault(tId, Set.of());
            for (Slot slot : allSlots) {
                String cell = slot.key();
                if (classBusy.contains(cell)) {
                    classBlocked++;
                    continue;
                }
                if (teacherBusy.contains(cell)) {
                    teacherBlocked++;
                    continue;
                }
                int score = scoreSlot(s, slot, w, subj, preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount);
                if (best == null || score > best.score) {
                    best = new ScoredSlot(slot, score);
                }
            }

            if (best == null) {
                lastReject.put(s, "No valid slot. checked=" + allSlots.size() + ", blockedByClass=" + classBlocked + ", blockedByTeacher=" + teacherBlocked);
                if (log.isWarnEnabled()) {
                    log.warn("TT gen attempt={} failed to place session {}/{}: class={} subj={} teacher={} (checked={}, blockedByClass={}, blockedByTeacher={})",
                            attempt, i + 1, sessions.size(),
                            cg.getCode(), subj.getCode(), teacher.getFullName(),
                            allSlots.size(), classBlocked, teacherBlocked);
                }
                return false;
            }

            Slot pick = best.slot;
            TimetableEntry e = new TimetableEntry();
            e.setSchool(school);
            e.setTimetableVersion(version);
            e.setClassGroup(cg);
            e.setSubject(subj);
            e.setStaff(teacher);
            e.setDayOfWeek(pick.day());
            e.setTimeSlot(slotById.get(pick.timeSlotId()));

            place(e, cgId, tId, pick, classOcc, teacherOcc, existingByCell,
                    preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount, bundleKey(s));
            placedOut.addLast(e);

            if (log.isDebugEnabled()) {
                log.debug("TT gen attempt={} placed {}/{}: class={} subj={} teacher={} at {} P{} (score={})",
                        attempt, i + 1, sessions.size(),
                        cg.getCode(), subj.getCode(), teacher.getFullName(),
                        pick.day().name(), pick.slotOrder(), best.score);
            }
        }
        return true;
    }

    private record BacktrackResult(boolean success) {}

    /**
     * CSP-style backtracking placer with MRV variable ordering, LCV-ish value ordering (best score first),
     * and forward checking. Used as a fallback when greedy retries can't fit everything.
     *
     * Variables: each session i must be assigned exactly one slot s.
     * Hard constraints: same-class no double-booking; same-teacher no double-booking; can't reuse a cell
     *   already occupied by a locked/manual entry seeded into classOcc/teacherOcc.
     * Domain pruning: every time we place session i at slot s, we remove s from the candidate domains of
     *   every other unplaced session that shares either i's class group or i's teacher.
     */
    private BacktrackResult backtrackPlace(
            List<Session> sessions,
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
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            List<TimetableEntry> placedOut,
            Map<Session, String> lastReject,
            int[] nodesLeft
    ) {
        int n = sessions.size();
        int m = allSlots.size();
        if (n == 0) return new BacktrackResult(true);

        // Initial domain per session = slots not blocked by seeded class/teacher occupancy.
        BitSet[] domain = new BitSet[n];
        for (int i = 0; i < n; i++) {
            Session s = sessions.get(i);
            Set<String> classBusy = classOcc.getOrDefault(s.classGroupId(), Set.of());
            Set<String> teacherBusy = teacherOcc.getOrDefault(s.teacherId(), Set.of());
            BitSet d = new BitSet(m);
            for (int k = 0; k < m; k++) {
                Slot slot = allSlots.get(k);
                String cell = slot.key();
                if (classBusy.contains(cell)) continue;
                if (teacherBusy.contains(cell)) continue;
                d.set(k);
            }
            if (d.isEmpty()) {
                Session last = sessions.get(i);
                lastReject.put(last,
                        "No valid slot. checked=" + m
                                + ", blockedByClass=" + classBusy.size()
                                + ", blockedByTeacher=" + teacherBusy.size()
                                + " (pre-search)");
                return new BacktrackResult(false);
            }
            domain[i] = d;
        }

        // Adjacency: which sessions share a class or teacher with i (only those need domain pruning when i is placed).
        int[][] sharesByIdx = new int[n][];
        {
            // Group by class and teacher.
            Map<Integer, List<Integer>> byClass = new HashMap<>();
            Map<Integer, List<Integer>> byTeacher = new HashMap<>();
            for (int i = 0; i < n; i++) {
                Session s = sessions.get(i);
                byClass.computeIfAbsent(s.classGroupId(), k -> new ArrayList<>()).add(i);
                byTeacher.computeIfAbsent(s.teacherId(), k -> new ArrayList<>()).add(i);
            }
            for (int i = 0; i < n; i++) {
                Session s = sessions.get(i);
                Set<Integer> set = new HashSet<>();
                for (Integer j : byClass.getOrDefault(s.classGroupId(), List.of())) if (j != i) set.add(j);
                for (Integer j : byTeacher.getOrDefault(s.teacherId(), List.of())) if (j != i) set.add(j);
                int[] arr = new int[set.size()];
                int p = 0;
                for (Integer j : set) arr[p++] = j;
                sharesByIdx[i] = arr;
            }
        }

        boolean[] assigned = new boolean[n];
        int[] assignedSlot = new int[n];
        Arrays.fill(assignedSlot, -1);

        // Track per-step pruning so we can restore on backtrack: stack of (sessionIdx, slotIdx) that we removed.
        Deque<long[]> pruneStack = new ArrayDeque<>();

        boolean ok = solve(
                0, n, m, sessions, allSlots, w, classById, subjectById, staffById,
                domain, assigned, assignedSlot, sharesByIdx, pruneStack,
                classOcc, teacherOcc, existingByCell,
                preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount,
                lastReject, nodesLeft
        );

        if (!ok) return new BacktrackResult(false);

        // Materialize placements into TimetableEntry objects in placement order.
        for (int i = 0; i < n; i++) {
            int slotIdx = assignedSlot[i];
            if (slotIdx < 0) continue; // shouldn't happen on success
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
            placedOut.add(e);
        }
        return new BacktrackResult(true);
    }

    private boolean solve(
            int placedCount,
            int n,
            int m,
            List<Session> sessions,
            List<Slot> allSlots,
            TimetableGeneratorWeights w,
            Map<Integer, ClassGroup> classById,
            Map<Integer, Subject> subjectById,
            Map<Integer, Staff> staffById,
            BitSet[] domain,
            boolean[] assigned,
            int[] assignedSlot,
            int[][] sharesByIdx,
            Deque<long[]> pruneStack,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            Map<Session, String> lastReject,
            int[] nodesLeft
    ) {
        if (placedCount == n) return true;
        if (nodesLeft[0]-- <= 0) {
            for (int i = 0; i < n; i++) if (!assigned[i]) {
                lastReject.put(sessions.get(i), "Search budget exhausted");
                break;
            }
            return false;
        }

        // MRV: pick unassigned session with smallest live domain. Tie-break by largest "degree"
        // (more shared peers = harder to place later).
        int chosen = -1;
        int minSize = Integer.MAX_VALUE;
        int chosenDeg = -1;
        for (int i = 0; i < n; i++) {
            if (assigned[i]) continue;
            int sz = domain[i].cardinality();
            if (sz == 0) {
                Session s = sessions.get(i);
                lastReject.put(s, "Forward-check eliminated all slots; need different earlier choices.");
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
        Subject subj = subjectById.get(s.subjectId());

        // Order candidate slots by score (LCV-ish: higher score = better). Cap candidates explored
        // per node to a sane upper bound to keep search tractable on very tight problems.
        BitSet d = domain[chosen];
        int[] candidates = new int[d.cardinality()];
        int cc = 0;
        for (int k = d.nextSetBit(0); k >= 0; k = d.nextSetBit(k + 1)) {
            candidates[cc++] = k;
        }
        // Score and sort descending.
        int[][] scored = new int[cc][2];
        for (int k = 0; k < cc; k++) {
            int slotIdx = candidates[k];
            scored[k][0] = scoreSlot(s, allSlots.get(slotIdx), w, subj,
                    preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount);
            scored[k][1] = slotIdx;
        }
        Arrays.sort(scored, (a, b) -> Integer.compare(b[0], a[0]));

        // Cap branching factor at the smallest of: domain size, 12 (heuristic) — keeps search bounded.
        int branchCap = Math.min(scored.length, Math.max(6, Math.min(12, (int) Math.ceil(scored.length / 2.0))));
        for (int idx = 0; idx < branchCap; idx++) {
            int slotIdx = scored[idx][1];
            Slot slot = allSlots.get(slotIdx);

            // Place tentatively.
            assigned[chosen] = true;
            assignedSlot[chosen] = slotIdx;
            String cell = slot.key();
            classOcc.computeIfAbsent(s.classGroupId(), k -> new HashSet<>()).add(cell);
            teacherOcc.computeIfAbsent(s.teacherId(), k -> new HashSet<>()).add(cell);
            preferredPeriodByBundle.putIfAbsent(bundleKey(s), slot.slotOrder());
            classDayFilledOrders
                    .computeIfAbsent(s.classGroupId(), k -> new HashMap<>())
                    .computeIfAbsent(slot.day(), k -> new BitSet())
                    .set(slot.slotOrder() - 1);
            classDaySubjectCount
                    .computeIfAbsent(s.classGroupId(), k -> new HashMap<>())
                    .computeIfAbsent(slot.day(), k -> new HashMap<>())
                    .merge(s.subjectId(), 1, Integer::sum);

            // Forward-check: remove slotIdx from domains of peers; remember to restore on backtrack.
            int prunedMark = pruneStack.size();
            boolean wipeout = false;
            for (int peer : sharesByIdx[chosen]) {
                if (assigned[peer]) continue;
                if (domain[peer].get(slotIdx)) {
                    domain[peer].clear(slotIdx);
                    pruneStack.push(new long[]{peer, slotIdx});
                    if (domain[peer].isEmpty()) {
                        wipeout = true;
                        // continue marking so we can restore consistently
                    }
                }
            }

            if (!wipeout) {
                if (solve(placedCount + 1, n, m, sessions, allSlots, w,
                        classById, subjectById, staffById,
                        domain, assigned, assignedSlot, sharesByIdx, pruneStack,
                        classOcc, teacherOcc, existingByCell,
                        preferredPeriodByBundle, classDayFilledOrders, classDaySubjectCount,
                        lastReject, nodesLeft)) {
                    return true;
                }
            }

            // Undo forward checks.
            while (pruneStack.size() > prunedMark) {
                long[] pp = pruneStack.pop();
                domain[(int) pp[0]].set((int) pp[1]);
            }
            // Undo placement.
            classOcc.get(s.classGroupId()).remove(cell);
            teacherOcc.get(s.teacherId()).remove(cell);
            BitSet bs = classDayFilledOrders.getOrDefault(s.classGroupId(), Map.of()).getOrDefault(slot.day(), null);
            if (bs != null) bs.clear(slot.slotOrder() - 1);
            Map<Integer, Integer> sc = classDaySubjectCount.getOrDefault(s.classGroupId(), Map.of()).getOrDefault(slot.day(), Map.of());
            Integer kCount = sc.get(s.subjectId());
            if (kCount != null) {
                if (kCount <= 1) sc.remove(s.subjectId());
                else sc.put(s.subjectId(), kCount - 1);
            }
            assigned[chosen] = false;
            assignedSlot[chosen] = -1;

            if (nodesLeft[0] <= 0) {
                lastReject.put(s, "Search budget exhausted during backtrack");
                return false;
            }
        }
        return false;
    }

    private int scoreSlot(
            Session s,
            Slot slot,
            TimetableGeneratorWeights w,
            Subject subj,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount
    ) {
        int score = 0;

        // Period consistency: prefer same period for same (class,subject,teacher) bundle
        String bundle = bundleKey(s);
        Integer pref = preferredPeriodByBundle.get(bundle);
        if (pref != null) {
            int delta = Math.abs(pref - slot.slotOrder());
            if (delta == 0) score += w.preferConsistentPeriod();
            else score += Math.max(0, w.preferNearPeriod() - (delta * 2));
        }

        // Spread across week: penalize stacking same subject on same day for same class
        int dayCount = classDaySubjectCount
                .getOrDefault(s.classGroupId(), Map.of())
                .getOrDefault(slot.day(), Map.of())
                .getOrDefault(s.subjectId(), 0);
        score -= dayCount * w.spreadAcrossWeek();

        // Avoid same subject consecutive periods in a day (soft)
        BitSet filled = classDayFilledOrders
                .getOrDefault(s.classGroupId(), Map.of())
                .getOrDefault(slot.day(), new BitSet());
        // If adjacent periods are filled AND they are the same subject, add penalty.
        // We approximate: if adjacent periods are already filled, we penalize creating tight clusters.
        boolean left = filled.get(Math.max(0, slot.slotOrder() - 2)); // BitSet is 0-based; slotOrder is 1-based
        boolean right = filled.get(slot.slotOrder()); // next
        if (left || right) score -= w.avoidSameSubjectConsecutive();

        // Avoid gaps: prefer making blocks rather than isolated single periods
        // Simple heuristic: if placing creates an isolated filled period (neighbors empty), penalize;
        // if it fills a hole between two filled, reward a bit.
        boolean prevFilled = filled.get(Math.max(0, slot.slotOrder() - 2));
        boolean nextFilled = filled.get(slot.slotOrder());
        if (!prevFilled && !nextFilled) score -= w.avoidGapsInDay();
        if (prevFilled && nextFilled) score += Math.max(1, w.avoidGapsInDay() / 2);

        // Morning core preference (if subject has type info; tolerate nulls)
        try {
            // Many codebases model core/optional. If absent, no-op.
            Object type = subj.getType();
            if (type != null && type.toString().equalsIgnoreCase("CORE")) {
                if (slot.slotOrder() <= 2) score += w.preferMorningCore();
            }
        } catch (Exception ignored) {
            // ignore if model differs
        }

        return score;
    }

    private void place(
            TimetableEntry e,
            Integer cgId,
            Integer teacherId,
            Slot slot,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            String bundleKey
    ) {
        String cell = slot.key();
        classOcc.computeIfAbsent(cgId, k -> new HashSet<>()).add(cell);
        teacherOcc.computeIfAbsent(teacherId, k -> new HashSet<>()).add(cell);
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

    private void unplace(
            TimetableEntry e,
            Integer cgId,
            Integer teacherId,
            Slot slot,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<String, Integer> preferredPeriodByBundle,
            Map<Integer, Map<DayOfWeek, BitSet>> classDayFilledOrders,
            Map<Integer, Map<DayOfWeek, Map<Integer, Integer>>> classDaySubjectCount,
            String bundleKey
    ) {
        String cell = slot.key();
        Set<String> cset = classOcc.get(cgId);
        if (cset != null) cset.remove(cell);
        Set<String> tset = teacherOcc.get(teacherId);
        if (tset != null) tset.remove(cell);
        existingByCell.remove(cgId + "|" + slot.day().name() + "|" + slot.timeSlotId());

        // Note: we do NOT remove preferredPeriodByBundle to keep stability during search.

        BitSet bs = classDayFilledOrders
                .getOrDefault(cgId, Map.of())
                .getOrDefault(slot.day(), null);
        if (bs != null) bs.clear(slot.slotOrder() - 1);

        Map<Integer, Integer> sc = classDaySubjectCount
                .getOrDefault(cgId, Map.of())
                .getOrDefault(slot.day(), Map.of());
        Integer k = sc.get(e.getSubject().getId());
        if (k != null) {
            if (k <= 1) sc.remove(e.getSubject().getId());
            else sc.put(e.getSubject().getId(), k - 1);
        }
    }

    private static String bundleKey(Session s) {
        return s.classGroupId() + ":" + s.subjectId() + ":" + s.teacherId();
    }

    private static Map<Integer, Set<String>> deepCopyOcc(Map<Integer, Set<String>> in) {
        Map<Integer, Set<String>> out = new HashMap<>();
        for (Map.Entry<Integer, Set<String>> e : in.entrySet()) {
            out.put(e.getKey(), new HashSet<>(e.getValue()));
        }
        return out;
    }

    private record ScoredSlot(Slot slot, int score) {}
}

