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

            // Shuffle sessions to avoid bias
            List<Session> shuffled = new ArrayList<>(sessions);
            Collections.shuffle(shuffled, rnd);

            Deque<TimetableEntry> placed = new ArrayDeque<>();
            Map<Session, String> lastReject = new HashMap<>();

            int[] nodesLeft = new int[]{nodeBudget};
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

