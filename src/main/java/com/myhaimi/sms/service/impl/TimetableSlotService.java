package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.announcement.ClassGroupRefDTO;
import com.myhaimi.sms.DTO.timetable.TimetableOccurrenceDTO;
import com.myhaimi.sms.DTO.timetable.TimetableSlotCreateDTO;
import com.myhaimi.sms.DTO.timetable.TimetableSlotViewDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.LectureRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.TimetableSlotRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TimetableSlotService {

    private final TimetableSlotRepo timetableSlotRepo;
    private final LectureRepo lectureRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final StaffRepo staffRepo;

    private Integer requireTenant() {
        Integer id = TenantContext.getTenantId();
        if (id == null) {
            throw new IllegalStateException("Tenant context required");
        }
        return id;
    }

    @Transactional(readOnly = true)
    public List<TimetableSlotViewDTO> listSlotViews() {
        return timetableSlotRepo.findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(requireTenant()).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public TimetableSlotViewDTO create(TimetableSlotCreateDTO dto) {
        Integer schoolId = requireTenant();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(dto.getClassGroupId(), schoolId).orElseThrow();
        TimetableSlot slot = new TimetableSlot();
        slot.setSchool(school);
        slot.setClassGroup(cg);
        slot.setSubject(dto.getSubject());
        slot.setDayOfWeek(dto.getDayOfWeek());
        slot.setStartTime(dto.getStartTime());
        slot.setEndTime(dto.getEndTime());
        slot.setRoom(dto.getRoom());
        if (dto.getActive() != null) {
            slot.setActive(dto.getActive());
        }
        if (dto.getStaffId() != null) {
            Staff st = staffRepo.findById(dto.getStaffId()).filter(s -> schoolId.equals(s.getSchool().getId())).orElseThrow();
            slot.setStaff(st);
        }
        slot.setTeacherDisplayName(dto.getTeacherDisplayName());
        return toView(timetableSlotRepo.save(slot));
    }

    @Transactional
    public void delete(int slotId) {
        Integer schoolId = requireTenant();
        TimetableSlot slot = timetableSlotRepo.findByIdAndSchool_Id(slotId, schoolId).orElseThrow();
        timetableSlotRepo.delete(slot);
    }

    /**
     * Expands weekly recurring slots into concrete dates, merges scheduled {@link Lecture} rows, optionally
     * filtered to one teacher's staff profile.
     */
    @Transactional(readOnly = true)
    public List<TimetableOccurrenceDTO> calendar(LocalDate from, LocalDate to, Integer staffIdFilter) {
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("'to' must be on or after 'from'");
        }
        Integer schoolId = requireTenant();
        List<TimetableSlot> slots =
                timetableSlotRepo.findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(schoolId);
        if (staffIdFilter != null) {
            slots = slots.stream()
                    .filter(s -> s.getStaff() != null && staffIdFilter.equals(s.getStaff().getId()))
                    .toList();
        }

        // One-off lectures should override weekly slots for the same class+time on the same day.
        List<Lecture> lectures = lectureRepo.findBySchool_IdAndDateBetweenOrderByDateAscStartTimeAsc(schoolId, from, to);
        java.util.Set<String> lectureKeys = new java.util.HashSet<>();
        for (Lecture lec : lectures) {
            lectureKeys.add(lec.getDate() + "|" + lec.getClassGroup().getId() + "|" + lec.getStartTime() + "|" + lec.getEndTime());
        }

        List<TimetableOccurrenceDTO> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            var dow = d.getDayOfWeek();
            for (TimetableSlot slot : slots) {
                if (slot.getDayOfWeek() != dow) continue;
                String key = d + "|" + slot.getClassGroup().getId() + "|" + slot.getStartTime() + "|" + slot.getEndTime();
                if (lectureKeys.contains(key)) {
                    continue; // overridden by one-off
                }
                String teacher =
                        slot.getStaff() != null
                                ? slot.getStaff().getFullName()
                                : Optional.ofNullable(slot.getTeacherDisplayName()).orElse("—");
                String cgName = slot.getClassGroup().getDisplayName();
                out.add(new TimetableOccurrenceDTO(
                        d,
                        slot.getStartTime(),
                        slot.getEndTime(),
                        slot.getSubject(),
                        teacher,
                        slot.getRoom(),
                        cgName,
                        "RECURRING"));
            }
        }

        Optional<Staff> staffOpt =
                staffIdFilter != null ? staffRepo.findById(staffIdFilter).filter(s -> schoolId.equals(s.getSchool().getId())) : Optional.empty();
        for (Lecture lec : lectures) {
            if (staffOpt.isPresent()) {
                String tn = lec.getTeacherName();
                if (tn == null || !tn.equals(staffOpt.get().getFullName())) {
                    continue;
                }
            }
            out.add(new TimetableOccurrenceDTO(
                    lec.getDate(),
                    lec.getStartTime(),
                    lec.getEndTime(),
                    lec.getSubject(),
                    Optional.ofNullable(lec.getTeacherName()).orElse("—"),
                    lec.getRoom(),
                    lec.getClassGroup().getDisplayName(),
                    "AD_HOC"));
        }

        out.sort(Comparator.comparing(TimetableOccurrenceDTO::date).thenComparing(TimetableOccurrenceDTO::startTime));
        return out;
    }

    /** Recurring slots + lectures for one class group (student schedule). */
    @Transactional(readOnly = true)
    public List<TimetableOccurrenceDTO> calendarForClassGroup(Integer schoolId, Integer classGroupId, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("'to' must be on or after 'from'");
        }
        List<TimetableSlot> slots =
                timetableSlotRepo.findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(schoolId).stream()
                        .filter(s -> s.getClassGroup().getId().equals(classGroupId))
                        .toList();

        List<Lecture> lectures =
                lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(schoolId, classGroupId, from, to);
        java.util.Set<String> lectureKeys = new java.util.HashSet<>();
        for (Lecture lec : lectures) {
            lectureKeys.add(lec.getDate() + "|" + lec.getStartTime() + "|" + lec.getEndTime());
        }

        List<TimetableOccurrenceDTO> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            var dow = d.getDayOfWeek();
            for (TimetableSlot slot : slots) {
                if (slot.getDayOfWeek() != dow) continue;
                String key = d + "|" + slot.getStartTime() + "|" + slot.getEndTime();
                if (lectureKeys.contains(key)) continue; // overridden by one-off
                String teacher =
                        slot.getStaff() != null
                                ? slot.getStaff().getFullName()
                                : Optional.ofNullable(slot.getTeacherDisplayName()).orElse("—");
                String cgName = slot.getClassGroup().getDisplayName();
                out.add(new TimetableOccurrenceDTO(
                        d,
                        slot.getStartTime(),
                        slot.getEndTime(),
                        slot.getSubject(),
                        teacher,
                        slot.getRoom(),
                        cgName,
                        "RECURRING"));
            }
        }

        for (Lecture lec : lectures) {
            out.add(new TimetableOccurrenceDTO(
                    lec.getDate(),
                    lec.getStartTime(),
                    lec.getEndTime(),
                    lec.getSubject(),
                    Optional.ofNullable(lec.getTeacherName()).orElse("—"),
                    lec.getRoom(),
                    lec.getClassGroup().getDisplayName(),
                    "AD_HOC"));
        }

        out.sort(Comparator.comparing(TimetableOccurrenceDTO::date).thenComparing(TimetableOccurrenceDTO::startTime));
        return out;
    }

    /** Seeds Mon–Fri recurring slots for a class (used by demo data). */
    @Transactional
    public void seedWeeklyPattern(
            School school,
            ClassGroup classGroup,
            String subject,
            Staff staff,
            LocalTime start,
            LocalTime end,
            String room) {
        for (DayOfWeek dow : EnumSet.range(DayOfWeek.MONDAY, DayOfWeek.FRIDAY)) {
            TimetableSlot slot = new TimetableSlot();
            slot.setSchool(school);
            slot.setClassGroup(classGroup);
            slot.setSubject(subject);
            slot.setDayOfWeek(dow);
            slot.setStartTime(start);
            slot.setEndTime(end);
            slot.setRoom(room);
            slot.setStaff(staff);
            slot.setActive(true);
            timetableSlotRepo.save(slot);
        }
    }

    private TimetableSlotViewDTO toView(TimetableSlot s) {
        Integer staffId = s.getStaff() != null ? s.getStaff().getId() : null;
        String staffName = s.getStaff() != null ? s.getStaff().getFullName() : null;
        return new TimetableSlotViewDTO(
                s.getId(),
                s.getClassGroup().getDisplayName(),
                staffId,
                staffName,
                s.getTeacherDisplayName(),
                s.getSubject(),
                s.getDayOfWeek(),
                s.getStartTime(),
                s.getEndTime(),
                s.getRoom(),
                s.isActive());
    }

    /** Distinct class groups where this staff member appears on the active weekly timetable. */
    @Transactional(readOnly = true)
    public List<ClassGroupRefDTO> distinctClassGroupsStaffTeaches(Integer schoolId, Integer staffId) {
        Map<Integer, ClassGroup> byId = new LinkedHashMap<>();
        for (TimetableSlot s : timetableSlotRepo.findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(schoolId)) {
            if (s.getStaff() != null && staffId.equals(s.getStaff().getId())) {
                ClassGroup cg = s.getClassGroup();
                byId.putIfAbsent(cg.getId(), cg);
            }
        }
        return byId.values().stream()
                .map(cg -> new ClassGroupRefDTO(cg.getId(), cg.getCode(), cg.getDisplayName()))
                .sorted(Comparator.comparing(ClassGroupRefDTO::code))
                .toList();
    }
}
