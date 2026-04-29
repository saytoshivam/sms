package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.timetable.v2.TimeSlotCreateDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimeSlotViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.AutoFillRequestDTO;
import com.myhaimi.sms.DTO.timetable.v2.AutoFillResultDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryUpsertDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableEntryViewDTO;
import com.myhaimi.sms.DTO.timetable.v2.TimetableVersionViewDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.TenantContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TimetableGridV2Service {

    private final SchoolRepo schoolRepo;
    private final SchoolTimeSlotRepo schoolTimeSlotRepo;
    private final TimetableVersionRepo timetableVersionRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SubjectRepo subjectRepo;
    private final StaffRepo staffRepo;
    private final RoomRepo roomRepo;
    private final SubjectAllocationRepo subjectAllocationRepo;
    private final ObjectMapper objectMapper;

    private Integer requireSchoolId() {
        Integer id = TenantContext.getTenantId();
        if (id == null) id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    @Transactional(readOnly = true)
    public List<TimeSlotViewDTO> listTimeSlots() {
        Integer schoolId = requireSchoolId();
        return schoolTimeSlotRepo.findBySchool_IdAndActiveIsTrueOrderBySlotOrderAsc(schoolId).stream()
                .map(s -> new TimeSlotViewDTO(s.getId(), s.getStartTime(), s.getEndTime(), s.getSlotOrder(), s.isBreakSlot()))
                .toList();
    }

    @Transactional
    public TimeSlotViewDTO createTimeSlot(TimeSlotCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (dto.endTime().isBefore(dto.startTime()) || dto.endTime().equals(dto.startTime())) {
            throw new IllegalArgumentException("End time must be after start time");
        }
        SchoolTimeSlot s = new SchoolTimeSlot();
        s.setSchool(school);
        s.setStartTime(dto.startTime());
        s.setEndTime(dto.endTime());
        s.setSlotOrder(dto.slotOrder());
        s.setBreakSlot(dto.isBreak() != null && dto.isBreak());
        s = schoolTimeSlotRepo.save(s);
        return new TimeSlotViewDTO(s.getId(), s.getStartTime(), s.getEndTime(), s.getSlotOrder(), s.isBreakSlot());
    }

    @Transactional
    public void clearTimeSlots() {
        Integer schoolId = requireSchoolId();
        // Slots are referenced by entries; to "regenerate slots" safely, clear entries too.
        if (timetableEntryRepo.countBySchool_Id(schoolId) > 0) {
            timetableEntryRepo.deleteBySchool_Id(schoolId);
        }
        schoolTimeSlotRepo.deleteBySchool_Id(schoolId);
    }

    @Transactional
    public TimeSlotViewDTO updateTimeSlot(Integer timeSlotId, TimeSlotCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        if (dto.endTime().isBefore(dto.startTime()) || dto.endTime().equals(dto.startTime())) {
            throw new IllegalArgumentException("End time must be after start time");
        }
        SchoolTimeSlot s = schoolTimeSlotRepo.findByIdAndSchool_Id(timeSlotId, schoolId).orElseThrow();
        s.setStartTime(dto.startTime());
        s.setEndTime(dto.endTime());
        s.setSlotOrder(dto.slotOrder());
        s.setBreakSlot(dto.isBreak() != null && dto.isBreak());
        s = schoolTimeSlotRepo.save(s);
        return new TimeSlotViewDTO(s.getId(), s.getStartTime(), s.getEndTime(), s.getSlotOrder(), s.isBreakSlot());
    }

    @Transactional
    public AutoFillResultDTO autoFill(AutoFillRequestDTO dto) {
        Integer schoolId = requireSchoolId();
        TimetableVersion version = timetableVersionRepo.findByIdAndSchool_Id(dto.timetableVersionId(), schoolId).orElseThrow();
        if (version.getStatus() == TimetableStatus.PUBLISHED) {
            throw new IllegalStateException("Published timetable cannot be edited. Create a new draft version.");
        }
        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(dto.classGroupId(), schoolId).orElseThrow();

        String mode = dto.mode() == null ? "FILL_EMPTY" : dto.mode().trim().toUpperCase();
        boolean replace = "REPLACE".equals(mode);

        List<SchoolTimeSlot> slots = schoolTimeSlotRepo.findBySchool_IdAndActiveIsTrueOrderBySlotOrderAsc(schoolId).stream()
                .filter(s -> !s.isBreakSlot())
                .toList();
        if (slots.isEmpty()) {
            throw new IllegalStateException("No time slots found. Create or generate time slots first.");
        }

        List<DayOfWeek> days = resolveWorkingDays(schoolId);
        if (days.isEmpty()) {
            days = List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);
        }

        // Existing entries for this class+version
        List<TimetableEntry> existing = timetableEntryRepo.findBySchool_IdAndTimetableVersion_IdAndClassGroup_Id(
                schoolId, version.getId(), cg.getId());
        Map<String, TimetableEntry> entryByCell = new HashMap<>();
        for (TimetableEntry e : existing) {
            entryByCell.put(e.getDayOfWeek().name() + "|" + e.getTimeSlot().getId(), e);
        }

        if (replace && !existing.isEmpty()) {
            timetableEntryRepo.deleteAll(existing);
            entryByCell.clear();
        }

        List<SubjectAllocation> allocations = subjectAllocationRepo.findBySchool_IdAndClassGroup_Id(schoolId, cg.getId());
        if (allocations.isEmpty()) {
            return new AutoFillResultDTO(0, 0, 0, slots.size() * days.size(), List.of("No subject allocations found for this class."));
        }

        // Expand required placements
        List<SubjectAllocation> queue = new ArrayList<>();
        for (SubjectAllocation a : allocations) {
            int freq = a.getWeeklyFrequency() == null ? 0 : a.getWeeklyFrequency();
            for (int i = 0; i < Math.max(0, freq); i++) queue.add(a);
        }
        if (queue.isEmpty()) {
            return new AutoFillResultDTO(0, 0, 0, slots.size() * days.size(), List.of("All allocations have weeklyFrequency=0."));
        }

        int placed = 0;
        int skippedFilled = 0;
        int skippedConflict = 0;
        int skippedNoAlloc = 0;
        List<String> warnings = new ArrayList<>();

        int qi = 0;
        for (DayOfWeek d : days) {
            for (SchoolTimeSlot s : slots) {
                String key = d.name() + "|" + s.getId();
                if (entryByCell.containsKey(key)) {
                    skippedFilled += 1;
                    continue;
                }
                if (qi >= queue.size()) {
                    skippedNoAlloc += 1;
                    continue;
                }

                boolean placedHere = false;
                // Try a bounded number of allocations for this cell to avoid infinite loops in conflict-heavy scenarios.
                int attempts = Math.min(queue.size() - qi, 12);
                for (int a = 0; a < attempts; a++) {
                    SubjectAllocation alloc = queue.get(qi);
                    qi += 1;
                    try {
                        // Teacher conflict check (room optional; not auto-assigned)
                        if (timetableEntryRepo.existsBySchool_IdAndTimetableVersion_IdAndStaff_IdAndDayOfWeekAndTimeSlot_Id(
                                schoolId, version.getId(), alloc.getStaff().getId(), d, s.getId())) {
                            skippedConflict += 1;
                            continue;
                        }

                        TimetableEntry e = new TimetableEntry();
                        e.setSchool(schoolRepo.findById(schoolId).orElseThrow());
                        e.setTimetableVersion(version);
                        e.setClassGroup(cg);
                        e.setDayOfWeek(d);
                        e.setTimeSlot(s);
                        e.setSubject(alloc.getSubject());
                        e.setStaff(alloc.getStaff());
                        Room allocRoom = alloc.getRoom();
                        e.setRoom(allocRoom != null ? allocRoom : cg.getDefaultRoom());
                        e = timetableEntryRepo.save(e);
                        entryByCell.put(key, e);
                        placed += 1;
                        placedHere = true;
                        break;
                    } catch (Exception ex) {
                        skippedConflict += 1;
                    }
                }

                if (!placedHere && qi >= queue.size()) {
                    skippedNoAlloc += 1;
                }
            }
        }

        // Any remaining queue means we couldn't place all requested weekly frequencies.
        int remaining = Math.max(0, queue.size() - qi);
        if (remaining > 0) {
            warnings.add("Could not place " + remaining + " period(s). Add more time slots or reduce weekly frequencies.");
        }

        return new AutoFillResultDTO(placed, skippedFilled, skippedConflict, skippedNoAlloc, warnings);
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

    @Transactional
    public TimetableVersionViewDTO ensureDraftVersion() {
        Integer schoolId = requireSchoolId();
        TimetableVersion v = timetableVersionRepo.findTopBySchool_IdAndStatusOrderByVersionDesc(schoolId, TimetableStatus.DRAFT)
                .orElse(null);
        if (v != null) return new TimetableVersionViewDTO(v.getId(), v.getStatus().name(), v.getVersion());

        School school = schoolRepo.findById(schoolId).orElseThrow();
        // Use max(version) + 1 (not count) to avoid collisions when versions have gaps.
        int nextVersion = timetableVersionRepo.findTopBySchool_IdOrderByVersionDesc(schoolId)
                .map(TimetableVersion::getVersion)
                .map(ver -> ver + 1)
                .orElse(1);
        TimetableVersion nv = new TimetableVersion();
        nv.setSchool(school);
        nv.setStatus(TimetableStatus.DRAFT);
        nv.setVersion(nextVersion);
        nv = timetableVersionRepo.save(nv);
        return new TimetableVersionViewDTO(nv.getId(), nv.getStatus().name(), nv.getVersion());
    }

    @Transactional(readOnly = true)
    public List<TimetableEntryViewDTO> listEntries(Integer timetableVersionId, Integer classGroupId) {
        Integer schoolId = requireSchoolId();
        timetableVersionRepo.findByIdAndSchool_Id(timetableVersionId, schoolId).orElseThrow();
        classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();
        return timetableEntryRepo.findBySchool_IdAndTimetableVersion_IdAndClassGroup_Id(schoolId, timetableVersionId, classGroupId).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public TimetableEntryViewDTO upsertEntry(TimetableEntryUpsertDTO dto) {
        Integer schoolId = requireSchoolId();
        TimetableVersion version = timetableVersionRepo.findByIdAndSchool_Id(dto.timetableVersionId(), schoolId).orElseThrow();
        if (version.getStatus() == TimetableStatus.PUBLISHED) {
            throw new IllegalStateException("Published timetable cannot be edited. Create a new draft version.");
        }

        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(dto.classGroupId(), schoolId).orElseThrow();
        Subject subj = subjectRepo.findById(dto.subjectId()).filter(s -> schoolId.equals(s.getSchool().getId())).orElseThrow();
        Staff staff = staffRepo.findById(dto.staffId()).filter(s -> schoolId.equals(s.getSchool().getId())).orElseThrow();
        SchoolTimeSlot slot = schoolTimeSlotRepo.findByIdAndSchool_Id(dto.timeSlotId(), schoolId).orElseThrow();
        if (slot.isBreakSlot()) {
            throw new IllegalArgumentException("Cannot assign a class during a break slot.");
        }

        DayOfWeek dow;
        try {
            dow = DayOfWeek.valueOf(dto.dayOfWeek().trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid dayOfWeek");
        }

        Room room = null;
        if (dto.roomId() != null) {
            room = roomRepo.findById(dto.roomId()).filter(r -> schoolId.equals(r.getSchool().getId())).orElseThrow();
            if (timetableEntryRepo.existsBySchool_IdAndTimetableVersion_IdAndRoom_IdAndDayOfWeekAndTimeSlot_Id(
                    schoolId, version.getId(), room.getId(), dow, slot.getId())) {
                TimetableEntry conflict = timetableEntryRepo
                        .findFirstBySchool_IdAndTimetableVersion_IdAndRoom_IdAndDayOfWeekAndTimeSlot_Id(
                                schoolId, version.getId(), room.getId(), dow, slot.getId())
                        .orElse(null);
                String where = conflict == null ? "" : (" (already used by " + conflict.getClassGroup().getCode() + ")");
                throw new IllegalStateException("Room conflict: room already booked for this slot" + where + ".");
            }
        }

        // Teacher conflict
        if (timetableEntryRepo.existsBySchool_IdAndTimetableVersion_IdAndStaff_IdAndDayOfWeekAndTimeSlot_Id(
                schoolId, version.getId(), staff.getId(), dow, slot.getId())) {
            // allow if it's the same existing cell entry (handled below by upsert), else conflict.
            TimetableEntry existingCell = timetableEntryRepo
                    .findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
                            schoolId, version.getId(), cg.getId(), dow, slot.getId())
                    .orElse(null);
            if (existingCell == null || existingCell.getStaff() == null || !existingCell.getStaff().getId().equals(staff.getId())) {
                TimetableEntry conflict = timetableEntryRepo
                        .findFirstBySchool_IdAndTimetableVersion_IdAndStaff_IdAndDayOfWeekAndTimeSlot_Id(
                                schoolId, version.getId(), staff.getId(), dow, slot.getId())
                        .orElse(null);
                String where = conflict == null ? "" : (" (already assigned to " + conflict.getClassGroup().getCode() + ")");
                throw new IllegalStateException("Teacher conflict: teacher already assigned for this slot" + where + ".");
            }
        }

        // Weekly frequency (if allocation exists)
        SubjectAllocation alloc = subjectAllocationRepo
                .findBySchool_IdAndClassGroup_IdAndSubject_Id(schoolId, cg.getId(), subj.getId())
                .orElse(null);
        if (alloc != null && alloc.getWeeklyFrequency() != null && alloc.getWeeklyFrequency() > 0) {
            long already = timetableEntryRepo.countBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndSubject_Id(
                    schoolId, version.getId(), cg.getId(), subj.getId());
            TimetableEntry existing = timetableEntryRepo
                    .findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
                            schoolId, version.getId(), cg.getId(), dow, slot.getId())
                    .orElse(null);
            boolean sameSubjectReplacing = existing != null && existing.getSubject() != null && existing.getSubject().getId().equals(subj.getId());
            if (!sameSubjectReplacing && already >= alloc.getWeeklyFrequency()) {
                throw new IllegalStateException("Subject frequency exceeded for this class (weeklyFrequency=" + alloc.getWeeklyFrequency() + ").");
            }
        }

        TimetableEntry entry = timetableEntryRepo
                .findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
                        schoolId, version.getId(), cg.getId(), dow, slot.getId())
                .orElse(null);

        if (entry == null) {
            entry = new TimetableEntry();
            entry.setSchool(schoolRepo.findById(schoolId).orElseThrow());
            entry.setTimetableVersion(version);
            entry.setClassGroup(cg);
            entry.setDayOfWeek(dow);
            entry.setTimeSlot(slot);
        }
        entry.setSubject(subj);
        entry.setStaff(staff);
        entry.setRoom(room);
        entry = timetableEntryRepo.save(entry);
        return toView(entry);
    }

    @Transactional
    public void clearEntry(Integer timetableVersionId, Integer classGroupId, String dayOfWeek, Integer timeSlotId) {
        Integer schoolId = requireSchoolId();
        TimetableVersion version = timetableVersionRepo.findByIdAndSchool_Id(timetableVersionId, schoolId).orElseThrow();
        if (version.getStatus() == TimetableStatus.PUBLISHED) {
            throw new IllegalStateException("Published timetable cannot be edited. Create a new draft version.");
        }
        classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();
        SchoolTimeSlot slot = schoolTimeSlotRepo.findByIdAndSchool_Id(timeSlotId, schoolId).orElseThrow();
        DayOfWeek dow;
        try {
            dow = DayOfWeek.valueOf(dayOfWeek.trim().toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid dayOfWeek");
        }
        TimetableEntry entry = timetableEntryRepo
                .findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
                        schoolId, version.getId(), classGroupId, dow, slot.getId())
                .orElse(null);
        if (entry != null) {
            timetableEntryRepo.delete(entry);
        }
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
}

