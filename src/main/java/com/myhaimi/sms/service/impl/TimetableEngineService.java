package com.myhaimi.sms.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myhaimi.sms.DTO.timetable.engine.*;
import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableVersionViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryUpsertDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TimetableEngineService {

    private final SchoolRepo schoolRepo;
    private final SchoolTimeSlotRepo schoolTimeSlotRepo;
    private final TimetableVersionRepo timetableVersionRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final TimetableLockRepo timetableLockRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SubjectRepo subjectRepo;
    private final StaffRepo staffRepo;
    private final RoomRepo roomRepo;
    private final SubjectAllocationRepo subjectAllocationRepo;
    private final SubjectSectionOverrideRepo subjectSectionOverrideRepo;
    private final StaffTeachableSubjectRepository staffTeachableSubjectRepository;
    private final ObjectMapper objectMapper;
    private final TimetableGridV2Service timetableGridV2Service;
    private final TimetableGeneratorService timetableGeneratorService;

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private List<DayOfWeek> resolveWorkingDays(Integer schoolId) {
        try {
            School school = schoolRepo.findById(schoolId).orElseThrow();
            String raw = school.getOnboardingBasicInfoJson();
            if (raw == null || raw.isBlank()) return List.of();
            JsonNode node = objectMapper.readTree(raw);
            JsonNode wd = node.path("workingDays");
            if (wd == null || !wd.isArray()) return List.of();
            Set<DayOfWeek> set = new LinkedHashSet<>();
            for (JsonNode it : wd) {
                String v = it == null ? "" : it.asText("").trim().toUpperCase();
                DayOfWeek dow = switch (v) {
                    case "MON" -> DayOfWeek.MONDAY;
                    case "TUE" -> DayOfWeek.TUESDAY;
                    case "WED" -> DayOfWeek.WEDNESDAY;
                    case "THU" -> DayOfWeek.THURSDAY;
                    case "FRI" -> DayOfWeek.FRIDAY;
                    case "SAT" -> DayOfWeek.SATURDAY;
                    case "SUN" -> DayOfWeek.SUNDAY;
                    default -> null;
                };
                if (dow != null) set.add(dow);
            }
            return new ArrayList<>(set);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private record Window(LocalTime start, LocalTime end) {}

    private List<Window> resolveOpenWindows(Integer schoolId) {
        try {
            School school = schoolRepo.findById(schoolId).orElseThrow();
            String raw = school.getOnboardingBasicInfoJson();
            if (raw == null || raw.isBlank()) return List.of();
            JsonNode node = objectMapper.readTree(raw);
            List<Window> windows = new ArrayList<>();
            JsonNode openWindows = node.path("openWindows");
            if (openWindows != null && openWindows.isArray() && openWindows.size() > 0) {
                for (JsonNode w : openWindows) {
                    String st = w.path("startTime").asText(null);
                    String et = w.path("endTime").asText(null);
                    if (st == null || et == null) continue;
                    LocalTime start = LocalTime.parse(st.trim());
                    LocalTime end = LocalTime.parse(et.trim());
                    if (!start.isBefore(end)) continue;
                    windows.add(new Window(start, end));
                }
            }
            if (!windows.isEmpty()) return windows;
            String st = node.path("schoolStartTime").asText(null);
            String et = node.path("schoolEndTime").asText(null);
            if (st == null || et == null) return List.of();
            LocalTime start = LocalTime.parse(st.trim());
            LocalTime end = LocalTime.parse(et.trim());
            if (!start.isBefore(end)) return List.of();
            return List.of(new Window(start, end));
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private boolean withinWindows(LocalTime start, LocalTime end, List<Window> windows) {
        if (windows == null || windows.isEmpty()) return true;
        for (Window w : windows) {
            // slot must be fully inside a configured open window
            if (!start.isBefore(end)) continue;
            boolean inside = (start.equals(w.start) || start.isAfter(w.start)) && (end.equals(w.end) || end.isBefore(w.end));
            if (inside) return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public TimetableSetupDTO setup(Integer schoolIdFromPath) {
        Integer schoolId = requireSchoolId();
        if (schoolIdFromPath != null && !schoolId.equals(schoolIdFromPath)) {
            throw new IllegalArgumentException("Invalid schoolId");
        }

        List<DayOfWeek> days = resolveWorkingDays(schoolId);
        if (days.isEmpty()) days = List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);

        List<Window> openWindows = resolveOpenWindows(schoolId);
        List<SchoolTimeSlot> slots = schoolTimeSlotRepo.findBySchool_IdAndActiveIsTrueOrderBySlotOrderAsc(schoolId).stream()
                .filter(s -> withinWindows(s.getStartTime(), s.getEndTime(), openWindows))
                .toList();
        List<ClassGroup> classGroups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        List<Subject> subjects = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId);
        List<Staff> staff = staffRepo.findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(schoolId);
        List<Room> rooms = roomRepo.findBySchool_IdAndIsDeletedFalse(schoolId).stream()
                .sorted(Comparator.comparing(Room::getBuilding, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(Room::getRoomNumber, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
        List<SubjectAllocation> allocations = subjectAllocationRepo.findBySchool_Id(schoolId);
        List<StaffTeachableSubject> teachables = staffTeachableSubjectRepository.findByStaff_School_Id(schoolId);

        Map<Integer, Set<Integer>> teachableByStaffId = new HashMap<>();
        for (StaffTeachableSubject ts : teachables) {
            Integer sid = ts.getStaff() == null ? null : ts.getStaff().getId();
            Integer subId = ts.getSubject() == null ? null : ts.getSubject().getId();
            if (sid == null || subId == null) continue;
            teachableByStaffId.computeIfAbsent(sid, k -> new LinkedHashSet<>()).add(subId);
        }

        int workingSlotsPerWeek = Math.max(0, (int) slots.stream().filter(s -> !s.isBreakSlot()).count() * days.size());
        Map<String, Object> capacities = new LinkedHashMap<>();
        capacities.put("schoolSlotsPerWeek", workingSlotsPerWeek);
        capacities.put("teacherMaxWeeklyLectureLoadFallback", workingSlotsPerWeek);

        List<Map<String, Object>> slotsOut = slots.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("startTime", s.getStartTime());
            m.put("endTime", s.getEndTime());
            m.put("slotOrder", s.getSlotOrder());
            m.put("isBreak", s.isBreakSlot());
            return m;
        }).toList();

        List<Map<String, Object>> classesOut = classGroups.stream().map(cg -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", cg.getId());
            m.put("code", cg.getCode());
            m.put("displayName", cg.getDisplayName());
            m.put("gradeLevel", cg.getGradeLevel());
            m.put("section", cg.getSection());
            m.put("defaultRoomId", cg.getDefaultRoomId());
            return m;
        }).toList();

        List<Map<String, Object>> subjectsOut = subjects.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("code", s.getCode());
            m.put("name", s.getName());
            m.put("type", s.getType() == null ? null : s.getType().name());
            m.put("weeklyFrequency", s.getWeeklyFrequency());
            return m;
        }).toList();

        List<Map<String, Object>> teachersOut = staff.stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("fullName", t.getFullName());
            m.put("maxWeeklyLectureLoad", t.getMaxWeeklyLectureLoad());
            m.put("teachableSubjectIds", new ArrayList<>(teachableByStaffId.getOrDefault(t.getId(), Set.of())));
            return m;
        }).toList();

        List<Map<String, Object>> roomsOut = rooms.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("building", r.getBuilding());
            m.put("roomNumber", r.getRoomNumber());
            m.put("type", r.getType() == null ? null : r.getType().name());
            m.put("isSchedulable", r.getIsSchedulable());
            return m;
        }).toList();

        List<Map<String, Object>> allocOut = allocations.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("classGroupId", a.getClassGroup() == null ? null : a.getClassGroup().getId());
            m.put("subjectId", a.getSubject() == null ? null : a.getSubject().getId());
            m.put("staffId", a.getStaff() == null ? null : a.getStaff().getId());
            m.put("roomId", a.getRoom() == null ? null : a.getRoom().getId());
            m.put("weeklyFrequency", a.getWeeklyFrequency());
            return m;
        }).toList();

        return new TimetableSetupDTO(
                schoolId,
                days.stream().map(Enum::name).toList(),
                slotsOut,
                classesOut,
                subjectsOut,
                teachersOut,
                roomsOut,
                allocOut,
                capacities
        );
    }

    private record LectureReq(Integer classGroupId, Integer subjectId, Integer fixedStaffId, Integer fixedRoomId) {
    }

    private record GroupKey(Integer classGroupId, Integer subjectId, Integer staffId, Integer roomId) {
    }

    private static String cgCode(Map<Integer, ClassGroup> byId, Integer id) {
        ClassGroup cg = byId.get(id);
        return cg == null ? null : cg.getCode();
    }

    @Transactional
    public TimetableGenerateResponseDTO generate(TimetableGenerateRequestDTO req) {
        Integer schoolId = requireSchoolId();
        if (req.schoolId() != null && !schoolId.equals(req.schoolId())) throw new IllegalArgumentException("Invalid schoolId");

        Instant generatedAt = Instant.now();
        boolean replace = req.replaceExisting() == null || req.replaceExisting();

        TimetableVersionViewDTO draftView = timetableGridV2Service.ensureDraftVersion();
        TimetableVersion version = timetableVersionRepo.findByIdAndSchool_Id(draftView.id(), schoolId).orElseThrow();

        List<Window> openWindows = resolveOpenWindows(schoolId);
        List<SchoolTimeSlot> slots = schoolTimeSlotRepo.findBySchool_IdAndActiveIsTrueOrderBySlotOrderAsc(schoolId).stream()
                .filter(s -> !s.isBreakSlot())
                .filter(s -> withinWindows(s.getStartTime(), s.getEndTime(), openWindows))
                .toList();
        if (slots.isEmpty()) throw new IllegalStateException("No time slots found. Create or generate time slots first.");

        List<DayOfWeek> days = resolveWorkingDays(schoolId);
        if (days.isEmpty()) days = List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);

        List<ClassGroup> classGroups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        Map<Integer, ClassGroup> classById = classGroups.stream().collect(Collectors.toMap(ClassGroup::getId, x -> x));

        // Room conflicts are intentionally ignored in the current engine mode (homeroom-only),
        // per product requirement for onboarding Step 7.

        // Staff teachables
        Map<Integer, Set<Integer>> teachableByStaffId = new HashMap<>();
        for (StaffTeachableSubject ts : staffTeachableSubjectRepository.findByStaff_School_Id(schoolId)) {
            Integer sid = ts.getStaff() == null ? null : ts.getStaff().getId();
            Integer subId = ts.getSubject() == null ? null : ts.getSubject().getId();
            if (sid == null || subId == null) continue;
            teachableByStaffId.computeIfAbsent(sid, k -> new LinkedHashSet<>()).add(subId);
        }

        // Locks (cells that must not change)
        List<TimetableLock> locks = timetableLockRepo.findBySchool_IdAndTimetableVersion_Id(schoolId, version.getId()).stream()
                .filter(TimetableLock::isLocked)
                .toList();
        Set<String> lockedCells = new HashSet<>();
        for (TimetableLock l : locks) {
            lockedCells.add(l.getClassGroup().getId() + "|" + l.getDayOfWeek().name() + "|" + l.getTimeSlot().getId());
        }

        // Existing entries (used to preserve locked cells)
        List<TimetableEntry> existingAll = timetableEntryRepo.findBySchool_IdAndTimetableVersion_Id(schoolId, version.getId());
        Map<String, TimetableEntry> existingByCell = new HashMap<>();
        for (TimetableEntry e : existingAll) {
            String k = e.getClassGroup().getId() + "|" + e.getDayOfWeek().name() + "|" + e.getTimeSlot().getId();
            existingByCell.put(k, e);
        }

        if (replace) {
            // delete all unlocked entries for this version
            List<TimetableEntry> toDelete = existingAll.stream()
                    .filter(e -> {
                        String k = e.getClassGroup().getId() + "|" + e.getDayOfWeek().name() + "|" + e.getTimeSlot().getId();
                        return !lockedCells.contains(k);
                    })
                    .toList();
            if (!toDelete.isEmpty()) timetableEntryRepo.deleteAllInBatch(toDelete);
            // refresh existing map to locked-only
            existingByCell.entrySet().removeIf(en -> !lockedCells.contains(en.getKey()));
        }

        // Occupancy maps seeded with locked entries
        Map<Integer, Set<String>> classOcc = new HashMap<>();
        Map<Integer, Set<String>> teacherOcc = new HashMap<>();
        for (TimetableEntry e : existingByCell.values()) {
            String cell = e.getDayOfWeek().name() + "|" + e.getTimeSlot().getId();
            classOcc.computeIfAbsent(e.getClassGroup().getId(), k -> new HashSet<>()).add(cell);
            teacherOcc.computeIfAbsent(e.getStaff().getId(), k -> new HashSet<>()).add(cell);
        }
        // Also block locked empty cells
        for (String lc : lockedCells) {
            String[] parts = lc.split("\\|");
            Integer cgId = Integer.valueOf(parts[0]);
            String day = parts[1];
            Integer slotId = Integer.valueOf(parts[2]);
            String cell = day + "|" + slotId;
            classOcc.computeIfAbsent(cgId, k -> new HashSet<>()).add(cell);
        }

        List<TimetableConflictDTO> hard = new ArrayList<>();
        List<TimetableConflictDTO> soft = new ArrayList<>();

        // Class-level allocations (weeklyFrequency may be null; then we fall back to subject.weeklyFrequency).
        List<SubjectAllocation> allocs = subjectAllocationRepo.findBySchool_Id(schoolId);
        Map<Integer, List<SubjectAllocation>> allocsByClass = allocs.stream()
                .filter(a -> a.getClassGroup() != null)
                .collect(Collectors.groupingBy(a -> a.getClassGroup().getId()));

        // Section overrides (per classGroup+subject): frequency/teacher/room overrides.
        Map<String, SubjectSectionOverride> overrideByCgSub = new HashMap<>();
        for (SubjectSectionOverride o : subjectSectionOverrideRepo.findBySubject_School_Id(schoolId)) {
            if (o.getClassGroup() == null || o.getSubject() == null) continue;
            overrideByCgSub.put(o.getClassGroup().getId() + ":" + o.getSubject().getId(), o);
        }

        // If the academic structure explicitly assigns a teacher to a subject (allocation / override),
        // treat that as "teachable" for timetable generation even if staff_teachable_subjects wasn't filled.
        for (SubjectAllocation a : allocs) {
            if (a.getStaff() == null || a.getSubject() == null) continue;
            teachableByStaffId.computeIfAbsent(a.getStaff().getId(), k -> new LinkedHashSet<>()).add(a.getSubject().getId());
        }
        for (SubjectSectionOverride o : overrideByCgSub.values()) {
            if (o.getStaff() == null || o.getSubject() == null) continue;
            teachableByStaffId.computeIfAbsent(o.getStaff().getId(), k -> new LinkedHashSet<>()).add(o.getSubject().getId());
        }

        School school = schoolRepo.findById(schoolId).orElseThrow();
        Map<Integer, Subject> subjectById = subjectRepo.findBySchool_IdAndIsDeletedFalseOrderByCodeAsc(schoolId).stream()
                .collect(Collectors.toMap(Subject::getId, s -> s));
        Map<Integer, Staff> staffById = staffRepo.findBySchool_IdAndIsDeletedFalseOrderByEmployeeNoAsc(schoolId).stream()
                .collect(Collectors.toMap(Staff::getId, s -> s));
        Map<Integer, SchoolTimeSlot> slotById = slots.stream().collect(Collectors.toMap(SchoolTimeSlot::getId, s -> s));

        // Expand required sessions globally (teacher clashes enforced across school).
        List<TimetableGeneratorService.Session> sessions = new ArrayList<>();
        Map<String, Long> requiredByBundle = new HashMap<>();
        Map<Integer, Long> requiredByClass = new HashMap<>();

        for (ClassGroup cg : classGroups) {
            Integer cgId = cg.getId();
            List<SubjectAllocation> list = allocsByClass.getOrDefault(cgId, List.of());
            if (list.isEmpty()) continue;

            for (SubjectAllocation a : list) {
                Integer subjId = a.getSubject() == null ? null : a.getSubject().getId();
                if (subjId == null) continue;
                SubjectSectionOverride ov = overrideByCgSub.get(cgId + ":" + subjId);

                Integer fixedStaffId =
                        (ov != null && ov.getStaff() != null) ? ov.getStaff().getId() :
                                (a.getStaff() == null ? null : a.getStaff().getId());

                Integer overrideFreq = (ov == null) ? null : ov.getPeriodsPerWeek();
                Integer allocFreq = a.getWeeklyFrequency();
                Integer subjectFreq = a.getSubject() == null ? null : a.getSubject().getWeeklyFrequency();
                int n = Math.max(0,
                        overrideFreq != null ? overrideFreq :
                                (allocFreq != null ? allocFreq : (subjectFreq == null ? 0 : subjectFreq)));
                if (n <= 0) continue;

                if (fixedStaffId == null) {
                    Subject subj = a.getSubject();
                    String subjCode = subj == null ? ("#" + subjId) : subj.getCode();
                    String subjName = subj == null ? "" : (" (" + subj.getName() + ")");
                    hard.add(new TimetableConflictDTO(
                            "HARD",
                            "UNASSIGNED_TEACHER",
                            cgId,
                            cg.getCode(),
                            null,
                            null,
                            "Unassigned teacher",
                            "Cannot schedule " + cg.getCode() + " · " + subjCode + subjName + " because no teacher is assigned in Subject Allocation / Section Override."
                    ));
                    continue;
                }

                Set<Integer> teachables = teachableByStaffId.getOrDefault(fixedStaffId, Set.of());
                if (!teachables.contains(subjId)) {
                    Subject subj = a.getSubject();
                    String subjCode = subj == null ? ("#" + subjId) : subj.getCode();
                    String subjName = subj == null ? "" : (" (" + subj.getName() + ")");
                    Staff st = staffById.get(fixedStaffId);
                    String staffName = st == null ? ("#" + fixedStaffId) : st.getFullName();
                    hard.add(new TimetableConflictDTO(
                            "HARD",
                            "TEACHER_NOT_TEACHABLE",
                            cgId,
                            cg.getCode(),
                            null,
                            null,
                            "Teacher not teachable",
                            "Cannot schedule " + cg.getCode() + " · " + subjCode + subjName + " because assigned teacher " + staffName + " is not mapped teachable for this subject."
                    ));
                    continue;
                }

                for (int i = 0; i < n; i++) {
                    sessions.add(new TimetableGeneratorService.Session(cgId, subjId, fixedStaffId));
                }
                requiredByBundle.merge(cgId + ":" + subjId + ":" + fixedStaffId, (long) n, Long::sum);
                requiredByClass.merge(cgId, (long) n, Long::sum);
            }
        }

        // Feasibility pre-check (per class): if required periods exceed available cells, scheduling is impossible.
        int totalCellsPerClass = days.size() * slots.size();
        List<String> infeasible = new ArrayList<>();
        for (ClassGroup cg : classGroups) {
            Integer cgId = cg.getId();
            long required = requiredByClass.getOrDefault(cgId, 0L);
            int blocked = classOcc.getOrDefault(cgId, Set.of()).size(); // locked/manual cells
            int available = Math.max(0, totalCellsPerClass - blocked);
            if (required > available) {
                infeasible.add(cg.getCode() + " requires " + required + " periods but only " + available + " cells are available (days=" + days.size()
                        + ", periodsPerDay=" + slots.size() + ", locked/blocked=" + blocked + ").");
                hard.add(new TimetableConflictDTO(
                        "HARD",
                        "INSUFFICIENT_SLOTS",
                        cgId,
                        cg.getCode(),
                        null,
                        null,
                        "Insufficient slots",
                        "Required periods (" + required + ") exceed available cells (" + available + ") for " + cg.getCode()
                                + ". Reduce weekly frequencies, add periods/extend open timings, or unlock cells."
                ));
            }
        }
        if (!infeasible.isEmpty()) {
            throw new IllegalStateException("Timetable is infeasible for " + infeasible.size() + " class(es). " + String.join(" | ", infeasible));
        }

        TimetableGeneratorWeights weights = TimetableGeneratorWeights.balancedDefaults();
        Random rnd = new Random();
        int maxAttempts = 22;
        int nodeBudget = Math.min(600_000, Math.max(60_000, sessions.size() * 1200));

        TimetableGeneratorService.GenerateResult gen = timetableGeneratorService.generate(
                school,
                version,
                days,
                slots,
                sessions,
                classById,
                subjectById,
                staffById,
                slotById,
                weights,
                rnd,
                maxAttempts,
                nodeBudget,
                classOcc,
                teacherOcc,
                existingByCell
        );

        List<TimetableEntry> toCreate = gen.placed();
        if (!toCreate.isEmpty()) timetableEntryRepo.saveAll(toCreate);

        if (!gen.success()) {
            Map<String, Long> placedByBundle = new HashMap<>();
            for (TimetableEntry e : toCreate) {
                placedByBundle.merge(e.getClassGroup().getId() + ":" + e.getSubject().getId() + ":" + e.getStaff().getId(), 1L, Long::sum);
            }
            for (Map.Entry<String, Long> en : requiredByBundle.entrySet()) {
                long want = en.getValue();
                long have = placedByBundle.getOrDefault(en.getKey(), 0L);
                if (have >= want) continue;
                String[] p = en.getKey().split(":");
                Integer cgId = Integer.valueOf(p[0]);
                Integer subjId = Integer.valueOf(p[1]);
                Integer staffId = Integer.valueOf(p[2]);

                ClassGroup cg = classById.get(cgId);
                Subject subj = subjectById.get(subjId);
                Staff st = staffById.get(staffId);

                long blockedByClass = 0;
                long blockedByTeacher = 0;
                long available = 0;
                Set<String> classBusy = classOcc.getOrDefault(cgId, Set.of());
                Set<String> teacherBusy = teacherOcc.getOrDefault(staffId, Set.of());
                for (DayOfWeek d : days) {
                    for (SchoolTimeSlot s : slots) {
                        String cell = d.name() + "|" + s.getId();
                        boolean bc = classBusy.contains(cell);
                        boolean bt = teacherBusy.contains(cell);
                        if (!bc && !bt) available++;
                        else {
                            if (bc) blockedByClass++;
                            if (bt) blockedByTeacher++;
                        }
                    }
                }

                hard.add(new TimetableConflictDTO(
                        "HARD",
                        "MISSING_FREQUENCY",
                        cgId,
                        cg == null ? ("#" + cgId) : cg.getCode(),
                        null,
                        null,
                        "Missing weekly frequency",
                        "Could not schedule " + (want - have) + " period(s) for "
                                + (cg == null ? ("#" + cgId) : cg.getCode()) + " · "
                                + (subj == null ? ("#" + subjId) : subj.getCode()) + (subj == null ? "" : (" (" + subj.getName() + ")"))
                                + " (required " + want + ", scheduled " + have + "). "
                                + "Teacher=" + (st == null ? ("#" + staffId) : st.getFullName())
                                + ". Slot availability: freeCells=" + available
                                + ", blockedByClass/locked=" + blockedByClass
                                + ", blockedByTeacher=" + blockedByTeacher
                                + " (cells checked=" + (days.size() * slots.size()) + ")."
                ));
            }
        }

        // Return view list for the whole version (so UI can render section/teacher/room tabs)
        List<TimetableEntryViewDTO> view = timetableEntryRepo.findBySchool_IdAndTimetableVersion_Id(schoolId, version.getId()).stream()
                .map(this::toView)
                .toList();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("versionId", version.getId());
        stats.put("placedCount", toCreate.size());
        stats.put("lockedCells", lockedCells.size());
        stats.put("hardConflicts", hard.size());
        stats.put("softConflicts", soft.size());
        stats.put("generator", "constraint-scoring-backtracking");
        stats.put("attemptsUsed", gen.stats().get("attemptsUsed"));
        stats.put("nodeBudget", gen.stats().get("nodeBudget"));

        return new TimetableGenerateResponseDTO(
                true,
                new TimetableVersionViewDTO(version.getId(), version.getStatus().name(), version.getVersion()),
                view,
                hard,
                soft,
                generatedAt,
                stats
        );
    }

    private TimetableEntryViewDTO toView(TimetableEntry e) {
        String roomLabel = null;
        Integer roomId = null;
        if (e.getRoom() != null) {
            roomId = e.getRoom().getId();
            roomLabel = e.getRoom().getBuilding() + " " + e.getRoom().getRoomNumber();
        }
        return new TimetableEntryViewDTO(
                e.getId(),
                e.getClassGroup().getId(),
                e.getDayOfWeek().name(),
                e.getTimeSlot().getId(),
                e.getSubject().getId(),
                e.getSubject().getCode(),
                e.getSubject().getName(),
                e.getStaff().getId(),
                e.getStaff().getFullName(),
                roomId,
                roomLabel
        );
    }

    private void scheduleClass(
            Integer schoolId,
            ClassGroup cg,
            TimetableVersion version,
            List<DayOfWeek> days,
            List<SchoolTimeSlot> slots,
            List<Room> rooms,
            Map<Integer, Room> roomById,
            Map<Integer, Set<Integer>> teachableByStaffId,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            List<LectureReq> reqs,
            List<TimetableEntry> outCreate,
            List<TimetableConflictDTO> hardOut
    ) {
        Integer cgId = cg.getId();

        // SlotId -> slotOrder for consistency scoring.
        Map<Integer, Integer> slotOrderById = new HashMap<>();
        for (SchoolTimeSlot s : slots) {
            slotOrderById.put(s.getId(), s.getSlotOrder());
        }

        // Build list of all candidate cells for this class (day|slotId) in stable order
        List<String> cells = new ArrayList<>();
        for (DayOfWeek d : days) {
            for (SchoolTimeSlot s : slots) {
                cells.add(d.name() + "|" + s.getId());
            }
        }

        Map<Integer, Integer> scheduledCountBySubject = new HashMap<>();
        // seed with locked existing entries
        for (Map.Entry<String, TimetableEntry> en : existingByCell.entrySet()) {
            String[] p = en.getKey().split("\\|");
            if (p.length != 3) continue;
            Integer id = Integer.valueOf(p[0]);
            if (!id.equals(cgId)) continue;
            TimetableEntry e = en.getValue();
            if (e.getSubject() != null) {
                scheduledCountBySubject.merge(e.getSubject().getId(), 1, Integer::sum);
            }
        }

        // Place using scheduling-only algorithm:
        // fixed (subject, teacher, room) bundles, prefer same period across days (soft high priority),
        // then repair pass if anything remains.
        Deque<TimetableEntry> placed = new ArrayDeque<>();

        int freeCells = 0;
        Set<String> occ = classOcc.getOrDefault(cgId, Set.of());
        for (String cell : cells) {
            if (!occ.contains(cell)) freeCells++;
        }
        if (reqs.size() > freeCells) {
            hardOut.add(new TimetableConflictDTO(
                    "HARD",
                    "INSUFFICIENT_SLOTS",
                    cgId,
                    cg.getCode(),
                    null,
                    null,
                    "Insufficient slots",
                    "Required periods (" + reqs.size() + ") exceed available empty slots (" + freeCells + ") for " + cg.getCode()
                            + ". Increase school timings/periods or reduce weekly frequencies."
            ));
        }
        // 1) Consistency-first greedy fill (one per day on preferred period if possible).
        Map<GroupKey, Integer> placedByGroup = consistentFill(
                schoolId,
                cg,
                version,
                days,
                slots,
                slotOrderById,
                reqs,
                rooms,
                roomById,
                teachableByStaffId,
                classOcc,
                teacherOcc,
                roomOcc,
                existingByCell,
                scheduledCountBySubject,
                placed
        );

        // 2) Repair: try to place remaining periods anywhere valid (max-fill).
        List<LectureReq> remainingReqs = subtractSatisfiedReqs(cgId, reqs, placedByGroup);
        greedyFill(
                schoolId,
                cg,
                version,
                cells,
                remainingReqs,
                rooms,
                roomById,
                teachableByStaffId,
                classOcc,
                teacherOcc,
                roomOcc,
                existingByCell,
                scheduledCountBySubject,
                placed
        );

        Map<Integer, Long> needed = reqs.stream().collect(Collectors.groupingBy(r -> r.subjectId, Collectors.counting()));
        boolean fullySatisfied = true;
        for (Map.Entry<Integer, Long> en : needed.entrySet()) {
            long have = scheduledCountBySubject.getOrDefault(en.getKey(), 0);
            if (have < en.getValue()) {
                fullySatisfied = false;
                break;
            }
        }
        if (!fullySatisfied) {
            // we still keep whatever got placed; compute missing frequencies as conflicts
            for (Map.Entry<Integer, Long> en : needed.entrySet()) {
                long have = scheduledCountBySubject.getOrDefault(en.getKey(), 0);
                long want = en.getValue();
                if (have < want) {
                    Subject subj = subjectRepo.findById(en.getKey()).orElse(null);
                    String subjCode = subj == null ? ("#" + en.getKey()) : subj.getCode();
                    String subjName = subj == null ? "" : (" (" + subj.getName() + ")");

                    // Root-cause breakdown: why no more cells are available (teacher busy / room busy / class occupied/locked).
                    long blockedByClass = 0;
                    long blockedByTeacher = 0;
                    long blockedByRoom = 0;
                    long available = 0;
                    Set<String> classBusy = classOcc.getOrDefault(cgId, Set.of());

                    // Pick the fixed teacher/room for this subject in this class (if multiple, we'll use the first).
                    Integer fixedTeacher = null;
                    Integer fixedRoom = null;
                    for (LectureReq r : reqs) {
                        if (r.subjectId.equals(en.getKey())) {
                            fixedTeacher = r.fixedStaffId;
                            fixedRoom = r.fixedRoomId;
                            break;
                        }
                    }
                    Set<String> teacherBusy = fixedTeacher == null ? Set.of() : teacherOcc.getOrDefault(fixedTeacher, Set.of());
                    Set<String> roomBusy = fixedRoom == null ? Set.of() : roomOcc.getOrDefault(fixedRoom, Set.of());

                    for (DayOfWeek d : days) {
                        for (SchoolTimeSlot s : slots) {
                            String cell = d.name() + "|" + s.getId();
                            boolean bc = classBusy.contains(cell);
                            boolean bt = fixedTeacher != null && teacherBusy.contains(cell);
                            boolean br = fixedRoom != null && roomBusy.contains(cell);
                            if (!bc && !bt && !br) {
                                available++;
                            } else {
                                if (bc) blockedByClass++;
                                if (bt) blockedByTeacher++;
                                if (br) blockedByRoom++;
                            }
                        }
                    }
                    if (available == 0 && (fixedTeacher != null || fixedRoom != null)) {
                        hardOut.add(new TimetableConflictDTO(
                                "HARD",
                                "NO_AVAILABLE_SLOT",
                                cgId,
                                cg.getCode(),
                                null,
                                null,
                                "No available slot",
                                "Cannot place remaining " + (want - have) + " period(s) for " + cg.getCode() + " · " + subjCode + subjName
                                        + " because there is no free cell after constraints. Breakdown: class occupied/locked=" + blockedByClass
                                        + ", teacher busy=" + blockedByTeacher + ", room busy=" + blockedByRoom + " (cells checked=" + (days.size() * slots.size()) + ")."
                        ));
                        continue;
                    }
                    hardOut.add(new TimetableConflictDTO(
                            "HARD",
                            "MISSING_FREQUENCY",
                            cgId,
                            cg.getCode(),
                            null,
                            null,
                            "Missing weekly frequency",
                            "Could not schedule " + (want - have) + " period(s) for " + cg.getCode() + " · " + subjCode + subjName
                                    + " (required " + want + ", scheduled " + have + ")."
                    ));
                }
            }
        }

        // Commit placed entries
        outCreate.addAll(placed);
    }

    /**
     * Consistency-first placement:
     * For each (class, subject, fixed teacher, fixed room) group, pick a preferred period (slotOrder)
     * and try to place one lecture per day on that same period, falling back to nearby periods.
     */
    private Map<GroupKey, Integer> consistentFill(
            Integer schoolId,
            ClassGroup cg,
            TimetableVersion version,
            List<DayOfWeek> days,
            List<SchoolTimeSlot> slots,
            Map<Integer, Integer> slotOrderById,
            List<LectureReq> reqs,
            List<Room> rooms,
            Map<Integer, Room> roomById,
            Map<Integer, Set<Integer>> teachableByStaffId,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<Integer, Integer> scheduledCountBySubject,
            Deque<TimetableEntry> placedOut
    ) {
        Integer cgId = cg.getId();

        Map<GroupKey, Integer> needByGroup = new LinkedHashMap<>();
        for (LectureReq r : reqs) {
            if (r.fixedStaffId == null) continue; // in our product flow, teacher is already decided; skip if missing.
            Set<Integer> teachables = teachableByStaffId.getOrDefault(r.fixedStaffId, Set.of());
            if (!teachables.contains(r.subjectId)) {
                // If the "smart assignment" produced an invalid mapping, don't schedule it.
                continue;
            }
            GroupKey gk = new GroupKey(cgId, r.subjectId, r.fixedStaffId, r.fixedRoomId);
            needByGroup.merge(gk, 1, Integer::sum);
        }
        if (needByGroup.isEmpty()) return Map.of();

        // Determine preferred slotOrder per group: choose period with max availability across days for fixed teacher/room.
        Map<GroupKey, Integer> preferredOrder = new HashMap<>();
        for (Map.Entry<GroupKey, Integer> en : needByGroup.entrySet()) {
            GroupKey gk = en.getKey();
            int bestAvail = -1;
            int bestOrder = 1;
            for (SchoolTimeSlot s : slots) {
                int avail = 0;
                String slotCellSuffix = "|" + s.getId();
                for (DayOfWeek d : days) {
                    String cell = d.name() + slotCellSuffix;
                    if (classOcc.getOrDefault(cgId, Set.of()).contains(cell)) continue;
                    if (teacherOcc.getOrDefault(gk.staffId, Set.of()).contains(cell)) continue;
                    if (gk.roomId != null && roomOcc.getOrDefault(gk.roomId, Set.of()).contains(cell)) continue;
                    avail++;
                }
                if (avail > bestAvail || (avail == bestAvail && s.getSlotOrder() < bestOrder)) {
                    bestAvail = avail;
                    bestOrder = s.getSlotOrder();
                }
            }
            preferredOrder.put(gk, bestOrder);
        }

        Map<Integer, SchoolTimeSlot> slotByOrder = new HashMap<>();
        for (SchoolTimeSlot s : slots) slotByOrder.put(s.getSlotOrder(), s);
        int maxOrder = slots.stream().map(SchoolTimeSlot::getSlotOrder).max(Integer::compareTo).orElse(1);

        Map<GroupKey, Integer> placedByGroup = new HashMap<>();
        for (Map.Entry<GroupKey, Integer> en : needByGroup.entrySet()) {
            GroupKey gk = en.getKey();
            int remaining = en.getValue();
            int pref = preferredOrder.getOrDefault(gk, 1);

            // First pass: one per day, try preferred period, then nearest.
            for (DayOfWeek d : days) {
                if (remaining <= 0) break;
                Candidate best = null;
                for (int delta = 0; delta <= Math.max(0, maxOrder); delta++) {
                    int order = delta == 0 ? pref : (pref - delta);
                    int order2 = (delta == 0) ? -1 : (pref + delta);
                    for (int o : new int[]{order, order2}) {
                        if (o <= 0) continue;
                        SchoolTimeSlot s = slotByOrder.get(o);
                        if (s == null) continue;
                        String cell = d.name() + "|" + s.getId();
                        if (classOcc.getOrDefault(cgId, Set.of()).contains(cell)) continue;
                        if (teacherOcc.getOrDefault(gk.staffId, Set.of()).contains(cell)) continue;
                        if (gk.roomId != null && roomOcc.getOrDefault(gk.roomId, Set.of()).contains(cell)) continue;
                        int score = delta * 2; // closer is better
                        Candidate cand = new Candidate(d, s.getId(), gk.staffId, gk.roomId, score);
                        if (best == null || cand.score < best.score) best = cand;
                    }
                    if (best != null && best.score == 0) break;
                }
                if (best == null) continue;
                placeOne(schoolId, cg, version, best, gk.subjectId, classOcc, teacherOcc, roomOcc, scheduledCountBySubject, placedOut);
                placedByGroup.merge(gk, 1, Integer::sum);
                remaining -= 1;
            }
            if (remaining <= 0) continue;
        }
        return placedByGroup;
    }

    private List<LectureReq> subtractSatisfiedReqs(
            Integer cgId,
            List<LectureReq> reqs,
            Map<GroupKey, Integer> placedByGroup
    ) {
        if (placedByGroup == null || placedByGroup.isEmpty()) return reqs;
        Map<GroupKey, Integer> remaining = new HashMap<>(placedByGroup);
        List<LectureReq> out = new ArrayList<>(reqs.size());
        for (LectureReq r : reqs) {
            if (r.fixedStaffId != null) {
                GroupKey gk = new GroupKey(cgId, r.subjectId, r.fixedStaffId, r.fixedRoomId);
                Integer k = remaining.get(gk);
                if (k != null && k > 0) {
                    if (k == 1) remaining.remove(gk);
                    else remaining.put(gk, k - 1);
                    continue; // this requirement already satisfied by consistency pass
                }
            }
            out.add(r);
        }
        return out;
    }

    private boolean teacheablesContains(Set<Integer> teachables, Integer subjId) {
        return teachables != null && teachables.contains(subjId);
    }

    private void placeOne(
            Integer schoolId,
            ClassGroup cg,
            TimetableVersion version,
            Candidate best,
            Integer subjectId,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<Integer, Integer> scheduledCountBySubject,
            Deque<TimetableEntry> placedOut
    ) {
        Integer cgId = cg.getId();
        String cell = best.dow.name() + "|" + best.slotId;
        TimetableEntry e = new TimetableEntry();
        e.setSchool(schoolRepo.findById(schoolId).orElseThrow());
        e.setTimetableVersion(version);
        e.setClassGroup(cg);
        e.setDayOfWeek(best.dow);
        e.setTimeSlot(schoolTimeSlotRepo.findByIdAndSchool_Id(best.slotId, schoolId).orElseThrow());
        e.setSubject(subjectRepo.findById(subjectId).orElseThrow());
        e.setStaff(staffRepo.findById(best.teacherId).orElseThrow());
        if (best.roomId != null) {
            e.setRoom(roomRepo.findById(best.roomId).orElseThrow());
        }
        placedOut.addLast(e);
        classOcc.computeIfAbsent(cgId, k -> new HashSet<>()).add(cell);
        teacherOcc.computeIfAbsent(best.teacherId, k -> new HashSet<>()).add(cell);
        if (best.roomId != null) roomOcc.computeIfAbsent(best.roomId, k -> new HashSet<>()).add(cell);
        scheduledCountBySubject.merge(subjectId, 1, Integer::sum);
    }

    /**
     * Greedy "max-fill" placement: places as many lectures as possible while respecting hard constraints.
     * Used when bounded backtracking cannot satisfy all requirements.
     */
    private void greedyFill(
            Integer schoolId,
            ClassGroup cg,
            TimetableVersion version,
            List<String> cells,
            List<LectureReq> reqs,
            List<Room> rooms,
            Map<Integer, Room> roomById,
            Map<Integer, Set<Integer>> teachableByStaffId,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<Integer, Integer> scheduledCountBySubject,
            Deque<TimetableEntry> placedOut
    ) {
        Integer cgId = cg.getId();
        for (LectureReq r : reqs) {
            // Skip if already satisfied (can happen if some got placed by backtracking before failing).
            int have = scheduledCountBySubject.getOrDefault(r.subjectId, 0);
            // We don't know the exact "want" for this subject here without recomputing; greedy-fill aims to maximize placements.

            Candidate best = null;
            for (String cell : cells) {
                if (classOcc.getOrDefault(cgId, Set.of()).contains(cell)) continue;

                DayOfWeek dow = DayOfWeek.valueOf(cell.split("\\|")[0]);
                Integer slotId = Integer.valueOf(cell.split("\\|")[1]);
                String globalKey = cgId + "|" + dow.name() + "|" + slotId;
                if (existingByCell.containsKey(globalKey)) continue;

                // teacher options
                List<Integer> teacherOptions;
                if (r.fixedStaffId != null) {
                    teacherOptions = List.of(r.fixedStaffId);
                } else {
                    teacherOptions = teachableByStaffId.entrySet().stream()
                            .filter(en -> en.getValue().contains(r.subjectId))
                            .map(Map.Entry::getKey)
                            .toList();
                }
                if (teacherOptions.isEmpty()) continue;

                // room options (prefer fixed/default, else any)
                List<Integer> roomOptions = new ArrayList<>();
                if (r.fixedRoomId != null) {
                    roomOptions.add(r.fixedRoomId);
                } else if (cg.getDefaultRoomId() != null) {
                    roomOptions.add(cg.getDefaultRoomId());
                }
                for (Room rm : rooms) {
                    if (cg.getDefaultRoomId() != null && rm.getId().equals(cg.getDefaultRoomId())) continue;
                    roomOptions.add(rm.getId());
                }
                roomOptions.add(null);

                for (Integer teacherId : teacherOptions) {
                    if (teacherOcc.getOrDefault(teacherId, Set.of()).contains(cell)) continue;
                    if (r.fixedStaffId == null && !teachableByStaffId.getOrDefault(teacherId, Set.of()).contains(r.subjectId)) continue;

                    for (Integer roomId : roomOptions) {
                        if (roomId != null && roomOcc.getOrDefault(roomId, Set.of()).contains(cell)) continue;
                        if (r.fixedRoomId != null && !r.fixedRoomId.equals(roomId)) continue;

                        int score = 0;
                        if (cg.getDefaultRoomId() != null && roomId != null && !cg.getDefaultRoomId().equals(roomId)) score += 2;
                        if (roomId == null) score += 1;
                        score += teacherOcc.getOrDefault(teacherId, Set.of()).size() / 8;

                        Candidate cand = new Candidate(dow, slotId, teacherId, roomId, score);
                        if (best == null || cand.score < best.score) best = cand;
                    }
                }
            }

            if (best == null) {
                continue; // cannot place this lecture
            }

            String cell = best.dow.name() + "|" + best.slotId;
            TimetableEntry e = new TimetableEntry();
            e.setSchool(schoolRepo.findById(schoolId).orElseThrow());
            e.setTimetableVersion(version);
            e.setClassGroup(cg);
            e.setDayOfWeek(best.dow);
            e.setTimeSlot(schoolTimeSlotRepo.findByIdAndSchool_Id(best.slotId, schoolId).orElseThrow());
            e.setSubject(subjectRepo.findById(r.subjectId).orElseThrow());
            e.setStaff(staffRepo.findById(best.teacherId).orElseThrow());
            if (best.roomId != null) {
                e.setRoom(roomRepo.findById(best.roomId).orElseThrow());
            }

            placedOut.addLast(e);
            classOcc.computeIfAbsent(cgId, k -> new HashSet<>()).add(cell);
            teacherOcc.computeIfAbsent(best.teacherId, k -> new HashSet<>()).add(cell);
            if (best.roomId != null) roomOcc.computeIfAbsent(best.roomId, k -> new HashSet<>()).add(cell);
            scheduledCountBySubject.merge(r.subjectId, 1, Integer::sum);
        }
    }

    private boolean backtrackPlace(
            Integer schoolId,
            ClassGroup cg,
            TimetableVersion version,
            List<String> cells,
            List<LectureReq> reqs,
            int idx,
            List<Room> rooms,
            Map<Integer, Room> roomById,
            Map<Integer, Set<Integer>> teachableByStaffId,
            Map<Integer, Set<String>> classOcc,
            Map<Integer, Set<String>> teacherOcc,
            Map<Integer, Set<String>> roomOcc,
            Map<String, TimetableEntry> existingByCell,
            Map<Integer, Integer> scheduledCountBySubject,
            Deque<TimetableEntry> placedOut,
            int budget
    ) {
        if (idx >= reqs.size()) return true;
        if (budget <= 0) return false;

        LectureReq r = reqs.get(idx);
        Integer cgId = cg.getId();

        // Build viable placements ranked by soft score
        List<Candidate> cands = new ArrayList<>();
        for (String cell : cells) {
            if (classOcc.getOrDefault(cgId, Set.of()).contains(cell)) continue; // already occupied or locked
            DayOfWeek dow = DayOfWeek.valueOf(cell.split("\\|")[0]);
            Integer slotId = Integer.valueOf(cell.split("\\|")[1]);

            // subject spread soft: avoid same subject on same day
            int score = 0;
            // count same subject on this day already
            int sameDay = 0;
            for (TimetableEntry e : placedOut) {
                if (e.getClassGroup().getId().equals(cgId) && e.getDayOfWeek().equals(dow) && e.getSubject().getId().equals(r.subjectId)) sameDay++;
            }
            score += sameDay * 5;

            // teacher options
            List<Integer> teacherOptions;
            if (r.fixedStaffId != null) {
                teacherOptions = List.of(r.fixedStaffId);
            } else {
                teacherOptions = teachableByStaffId.entrySet().stream()
                        .filter(en -> en.getValue().contains(r.subjectId))
                        .map(Map.Entry::getKey)
                        .toList();
            }
            if (teacherOptions.isEmpty()) continue;

            // room options
            List<Integer> roomOptions = new ArrayList<>();
            if (r.fixedRoomId != null) {
                roomOptions.add(r.fixedRoomId);
            } else if (cg.getDefaultRoomId() != null) {
                roomOptions.add(cg.getDefaultRoomId());
            }
            // add other schedulable rooms as fallback
            for (Room rm : rooms) {
                if (cg.getDefaultRoomId() != null && rm.getId().equals(cg.getDefaultRoomId())) continue;
                roomOptions.add(rm.getId());
            }
            // allow "no room" option last
            roomOptions.add(null);

            // iterate a small subset of teacher/room combos for ranking
            for (int ti = 0; ti < Math.min(6, teacherOptions.size()); ti++) {
                Integer teacherId = teacherOptions.get(ti);
                if (teacherOcc.getOrDefault(teacherId, Set.of()).contains(cell)) continue;

                // ensure teachable (strict) only when engine is *choosing* a teacher.
                // When teacher is fixed by allocation/override, we allow it (and validation happens elsewhere).
                if (r.fixedStaffId == null && !teachableByStaffId.getOrDefault(teacherId, Set.of()).contains(r.subjectId)) continue;

                int teacherScore = score;
                teacherScore += teacherOcc.getOrDefault(teacherId, Set.of()).size() / 8; // balance load

                for (int ri = 0; ri < Math.min(6, roomOptions.size()); ri++) {
                    Integer roomId = roomOptions.get(ri);
                    if (roomId != null && roomOcc.getOrDefault(roomId, Set.of()).contains(cell)) continue;
                    if (r.fixedRoomId != null && !r.fixedRoomId.equals(roomId)) continue;
                    if (roomId != null) {
                        Room rm = roomById.get(roomId);
                        // if allocation fixes a room, room type is enforced by that room itself.
                        if (rm != null && rm.getType() == RoomType.LAB) {
                            // ok
                        }
                    }

                    int roomScore = teacherScore;
                    if (cg.getDefaultRoomId() != null && roomId != null && !cg.getDefaultRoomId().equals(roomId)) roomScore += 2;
                    if (roomId == null) roomScore += 1;
                    cands.add(new Candidate(dow, slotId, teacherId, roomId, roomScore));
                }
            }
        }

        cands.sort(Comparator.comparingInt(c -> c.score));
        int tryLimit = Math.min(80, cands.size());
        for (int i = 0; i < tryLimit; i++) {
            Candidate c = cands.get(i);
            String cell = c.dow.name() + "|" + c.slotId;
            String globalKey = cgId + "|" + c.dow.name() + "|" + c.slotId;
            if (existingByCell.containsKey(globalKey)) continue; // locked existing already handled by classOcc, but keep safe

            TimetableEntry e = new TimetableEntry();
            e.setSchool(schoolRepo.findById(schoolId).orElseThrow());
            e.setTimetableVersion(version);
            e.setClassGroup(cg);
            e.setDayOfWeek(c.dow);
            e.setTimeSlot(schoolTimeSlotRepo.findByIdAndSchool_Id(c.slotId, schoolId).orElseThrow());
            e.setSubject(subjectRepo.findById(r.subjectId).orElseThrow());
            e.setStaff(staffRepo.findById(c.teacherId).orElseThrow());
            if (c.roomId != null) {
                e.setRoom(roomRepo.findById(c.roomId).orElseThrow());
            }

            // place
            placedOut.addLast(e);
            classOcc.computeIfAbsent(cgId, k -> new HashSet<>()).add(cell);
            teacherOcc.computeIfAbsent(c.teacherId, k -> new HashSet<>()).add(cell);
            if (c.roomId != null) roomOcc.computeIfAbsent(c.roomId, k -> new HashSet<>()).add(cell);
            scheduledCountBySubject.merge(r.subjectId, 1, Integer::sum);

            boolean ok = backtrackPlace(
                    schoolId, cg, version, cells, reqs, idx + 1,
                    rooms, roomById, teachableByStaffId,
                    classOcc, teacherOcc, roomOcc, existingByCell,
                    scheduledCountBySubject, placedOut,
                    budget - 1
            );
            if (ok) return true;

            // unplace
            placedOut.removeLast();
            Set<String> cls = classOcc.get(cgId);
            if (cls != null) cls.remove(cell);
            Set<String> tch = teacherOcc.get(c.teacherId);
            if (tch != null) tch.remove(cell);
            if (c.roomId != null) {
                Set<String> rm = roomOcc.get(c.roomId);
                if (rm != null) rm.remove(cell);
            }
            scheduledCountBySubject.merge(r.subjectId, -1, Integer::sum);
            if (scheduledCountBySubject.getOrDefault(r.subjectId, 0) <= 0) scheduledCountBySubject.remove(r.subjectId);
        }

        return false;
    }

    private record Candidate(DayOfWeek dow, Integer slotId, Integer teacherId, Integer roomId, int score) {
    }

    @Transactional
    public TimetableEntryViewDTO updateCell(TimetableCellUpdateDTO dto) {
        Integer schoolId = requireSchoolId();
        TimetableVersion version = timetableVersionRepo.findByIdAndSchool_Id(dto.timetableVersionId(), schoolId).orElseThrow();
        if (version.getStatus() == TimetableStatus.PUBLISHED) {
            throw new IllegalStateException("Published timetable cannot be edited. Create a new draft version.");
        }

        DayOfWeek dow;
        try {
            dow = DayOfWeek.valueOf(dto.dayOfWeek().trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid dayOfWeek");
        }

        // Lock/unlock is allowed even when clearing/setting.
        if (dto.locked() != null) {
            School school = schoolRepo.findById(schoolId).orElseThrow();
            ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(dto.classGroupId(), schoolId).orElseThrow();
            SchoolTimeSlot slot = schoolTimeSlotRepo.findByIdAndSchool_Id(dto.timeSlotId(), schoolId).orElseThrow();
            TimetableLock lock = timetableLockRepo
                    .findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
                            schoolId, version.getId(), cg.getId(), dow, slot.getId()
                    )
                    .orElse(null);
            boolean wantLocked = Boolean.TRUE.equals(dto.locked());
            if (wantLocked) {
                if (lock == null) {
                    lock = new TimetableLock();
                    lock.setSchool(school);
                    lock.setTimetableVersion(version);
                    lock.setClassGroup(cg);
                    lock.setDayOfWeek(dow);
                    lock.setTimeSlot(slot);
                }
                lock.setLocked(true);
                timetableLockRepo.save(lock);
            } else {
                if (lock != null) {
                    timetableLockRepo.delete(lock);
                }
            }
        }

        // Clear cell
        if (dto.subjectId() == null || dto.staffId() == null) {
            timetableGridV2Service.clearEntry(version.getId(), dto.classGroupId(), dow.name(), dto.timeSlotId());
            // return null is not allowed by controller; return a lightweight placeholder by re-reading entry (null -> throw)
            TimetableEntry maybe = timetableEntryRepo
                    .findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
                            schoolId, version.getId(), dto.classGroupId(), dow, dto.timeSlotId()
                    )
                    .orElse(null);
            if (maybe == null) {
                // "cleared" sentinel (frontend will refetch anyway)
                return new TimetableEntryViewDTO(0, dto.classGroupId(), dow.name(), dto.timeSlotId(), 0, "", "", 0, "", null, null);
            }
        }

        TimetableEntryUpsertDTO up = new TimetableEntryUpsertDTO(
                version.getId(),
                dto.classGroupId(),
                dow.name(),
                dto.timeSlotId(),
                dto.subjectId(),
                dto.staffId(),
                dto.roomId()
        );
        return timetableGridV2Service.upsertEntry(up);
    }

    @Transactional
    public TimetableVersionViewDTO saveDraft(Integer versionId) {
        Integer schoolId = requireSchoolId();
        TimetableVersion v = timetableVersionRepo.findByIdAndSchool_Id(versionId, schoolId).orElseThrow();
        if (v.getStatus() == TimetableStatus.PUBLISHED) return new TimetableVersionViewDTO(v.getId(), v.getStatus().name(), v.getVersion());
        v.setStatus(TimetableStatus.REVIEW);
        v = timetableVersionRepo.save(v);
        return new TimetableVersionViewDTO(v.getId(), v.getStatus().name(), v.getVersion());
    }

    @Transactional
    public TimetableVersionViewDTO publish(Integer versionId) {
        Integer schoolId = requireSchoolId();
        TimetableVersion v = timetableVersionRepo.findByIdAndSchool_Id(versionId, schoolId).orElseThrow();
        if (v.getStatus() == TimetableStatus.PUBLISHED) return new TimetableVersionViewDTO(v.getId(), v.getStatus().name(), v.getVersion());

        // Hard check: every allocation frequency must be satisfied.
        List<SubjectAllocation> allocs = subjectAllocationRepo.findBySchool_Id(schoolId);
        Map<String, Long> countByClassSub = new HashMap<>();
        for (TimetableEntry e : timetableEntryRepo.findBySchool_IdAndTimetableVersion_Id(schoolId, v.getId())) {
            String k = e.getClassGroup().getId() + "|" + e.getSubject().getId();
            countByClassSub.merge(k, 1L, Long::sum);
        }
        for (SubjectAllocation a : allocs) {
            if (a.getWeeklyFrequency() == null || a.getWeeklyFrequency() <= 0) continue;
            String k = a.getClassGroup().getId() + "|" + a.getSubject().getId();
            long have = countByClassSub.getOrDefault(k, 0L);
            if (have < a.getWeeklyFrequency()) {
                throw new IllegalStateException("Cannot publish: missing frequency for " + a.getClassGroup().getCode() + " / " + a.getSubject().getCode() + " (" + have + "/" + a.getWeeklyFrequency() + ").");
            }
        }

        // Archive existing published by downgrading to REVIEW
        TimetableVersion published = timetableVersionRepo.findTopBySchool_IdAndStatusOrderByVersionDesc(schoolId, TimetableStatus.PUBLISHED).orElse(null);
        if (published != null) {
            published.setStatus(TimetableStatus.REVIEW);
            timetableVersionRepo.save(published);
        }
        v.setStatus(TimetableStatus.PUBLISHED);
        v = timetableVersionRepo.save(v);
        return new TimetableVersionViewDTO(v.getId(), v.getStatus().name(), v.getVersion());
    }

    @Transactional(readOnly = true)
    public List<TimetableCellKeyDTO> listLocks(Integer timetableVersionId) {
        Integer schoolId = requireSchoolId();
        timetableVersionRepo.findByIdAndSchool_Id(timetableVersionId, schoolId).orElseThrow();
        return timetableLockRepo.findBySchool_IdAndTimetableVersion_Id(schoolId, timetableVersionId).stream()
                .filter(TimetableLock::isLocked)
                .map(l -> new TimetableCellKeyDTO(
                        l.getClassGroup().getId(),
                        l.getDayOfWeek().name(),
                        l.getTimeSlot().getId()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TimetableEntryViewDTO> listEntries(Integer timetableVersionId) {
        Integer schoolId = requireSchoolId();
        timetableVersionRepo.findByIdAndSchool_Id(timetableVersionId, schoolId).orElseThrow();
        return timetableEntryRepo.findBySchool_IdAndTimetableVersion_Id(schoolId, timetableVersionId).stream()
                .map(this::toView)
                .toList();
    }
}

