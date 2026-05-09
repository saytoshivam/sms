package com.myhaimi.sms.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myhaimi.sms.DTO.timetable.*;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.SchoolTimeSlotRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import com.myhaimi.sms.repository.TimetableVersionRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

import static com.myhaimi.sms.utils.LectureRowIdEncoding.publishedEntrySurrogate;

@Service
@RequiredArgsConstructor
public class PublishedTimetableCalendarService {

    private final TimetableVersionRepo timetableVersionRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final SchoolTimeSlotRepo schoolTimeSlotRepo;
    private final SchoolRepo schoolRepo;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public Optional<TimetableVersion> findPublishedVersion(Integer schoolId) {
        return timetableVersionRepo.findTopBySchool_IdAndStatusOrderByVersionDesc(schoolId, TimetableStatus.PUBLISHED);
    }

    /**
     * Date-range occurrences from the school's single {@link TimetableStatus#PUBLISHED} version.
     *
     * @param staffIdFilter null = include every teacher's assignment (school leadership consolidated view).
     */
    @Transactional(readOnly = true)
    public List<TimetableOccurrenceDTO> calendar(Integer schoolId, Integer staffIdFilter, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("'to' must be on or after 'from'");
        }
        Optional<TimetableVersion> ver = findPublishedVersion(schoolId);
        if (ver.isEmpty()) {
            return List.of();
        }
        Integer vid = ver.get().getId();
        List<TimetableEntry> entries =
                staffIdFilter == null
                        ? timetableEntryRepo.fetchGraphBySchoolAndVersion(schoolId, vid)
                        : timetableEntryRepo.fetchGraphBySchoolVersionAndStaff(schoolId, vid, staffIdFilter);
        List<TimetableOccurrenceDTO> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            for (TimetableEntry e : entries) {
                if (!e.getDayOfWeek().equals(dow)) continue;
                if (e.getTimeSlot() != null && e.getTimeSlot().isBreakSlot()) continue;
                out.add(toOccurrence(e, d));
            }
        }
        out.sort(Comparator.comparing(TimetableOccurrenceDTO::date).thenComparing(TimetableOccurrenceDTO::startTime));
        return out;
    }

    @Transactional(readOnly = true)
    public List<TimetableOccurrenceDTO> calendarForClassGroup(Integer schoolId, Integer classGroupId, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("'to' must be on or after 'from'");
        }
        Optional<TimetableVersion> ver = findPublishedVersion(schoolId);
        if (ver.isEmpty()) {
            return List.of();
        }
        List<TimetableEntry> entries =
                timetableEntryRepo.fetchGraphBySchoolVersionAndClassGroup(schoolId, ver.get().getId(), classGroupId);
        List<TimetableOccurrenceDTO> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            for (TimetableEntry e : entries) {
                if (!e.getDayOfWeek().equals(dow)) continue;
                if (e.getTimeSlot() != null && e.getTimeSlot().isBreakSlot()) continue;
                out.add(toOccurrence(e, d));
            }
        }
        out.sort(Comparator.comparing(TimetableOccurrenceDTO::date).thenComparing(TimetableOccurrenceDTO::startTime));
        return out;
    }

    @Transactional(readOnly = true)
    public PublishedTeacherWeeklyTimetableDTO teacherWeeklyGrid(Integer schoolId, Integer staffId) {
        Optional<TimetableVersion> ver = findPublishedVersion(schoolId);
        if (ver.isEmpty()) {
            return new PublishedTeacherWeeklyTimetableDTO(null, null, List.of(), List.of(), List.of(), 0, 0, List.of());
        }
        TimetableVersion v = ver.get();
        List<TimetableEntry> assigned =
                timetableEntryRepo.fetchGraphBySchoolVersionAndStaff(schoolId, v.getId(), staffId);
        return buildTeacherWeekly(schoolId, v, assigned);
    }

    @Transactional(readOnly = true)
    public PublishedStudentWeeklyTimetableDTO studentWeeklyGrid(Integer schoolId, Integer classGroupId) {
        Optional<TimetableVersion> ver = findPublishedVersion(schoolId);
        if (ver.isEmpty()) {
            return new PublishedStudentWeeklyTimetableDTO(null, null, List.of(), List.of(), List.of(), List.of());
        }
        TimetableVersion v = ver.get();
        List<TimetableEntry> entries =
                timetableEntryRepo.fetchGraphBySchoolVersionAndClassGroup(schoolId, v.getId(), classGroupId);
        return buildStudentWeekly(schoolId, v, entries);
    }

    private PublishedTeacherWeeklyTimetableDTO buildTeacherWeekly(Integer schoolId, TimetableVersion v, List<TimetableEntry> assigned) {
        List<SchoolTimeSlot> slotEntities =
                schoolTimeSlotRepo.findBySchool_IdAndActiveIsTrueOrderBySlotOrderAsc(schoolId).stream().toList();
        List<PublishedWeeklyPeriodDTO> periods = slotEntities.stream()
                .map(s -> new PublishedWeeklyPeriodDTO(
                        s.getId(), s.getSlotOrder(), s.getStartTime(), s.getEndTime(), s.isBreakSlot()))
                .toList();

        List<DayOfWeek> workingDays = resolveWorkingDays(schoolId);
        if (workingDays.isEmpty()) {
            workingDays =
                    List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);
        }
        List<String> dayNames = workingDays.stream().map(DayOfWeek::name).toList();

        Map<String, TimetableEntry> byDaySlot = new HashMap<>();
        for (TimetableEntry e : assigned) {
            byDaySlot.put(e.getDayOfWeek().name() + "|" + e.getTimeSlot().getId(), e);
        }

        List<PublishedTeacherGridCellDTO> cells = new ArrayList<>();
        int weeklyTeaching = 0;
        int freeTotal = 0;
        DayOfWeek today = LocalDate.now().getDayOfWeek();
        List<PublishedTeacherGridCellDTO> todayCells = new ArrayList<>();

        for (DayOfWeek d : workingDays) {
            for (SchoolTimeSlot slot : slotEntities) {
                if (slot.isBreakSlot()) {
                    PublishedTeacherGridCellDTO c = new PublishedTeacherGridCellDTO(
                            d.name(), slot.getId(), "Break", "", "", true, false);
                    cells.add(c);
                    if (d == today) todayCells.add(c);
                    continue;
                }
                TimetableEntry e = byDaySlot.get(d.name() + "|" + slot.getId());
                if (e == null) {
                    PublishedTeacherGridCellDTO c =
                            new PublishedTeacherGridCellDTO(d.name(), slot.getId(), "", "", "", false, true);
                    cells.add(c);
                    freeTotal++;
                    if (d == today) todayCells.add(c);
                } else {
                    weeklyTeaching++;
                    String room = roomLabel(e.getRoom());
                    PublishedTeacherGridCellDTO c = new PublishedTeacherGridCellDTO(
                            d.name(),
                            slot.getId(),
                            e.getSubject() != null ? e.getSubject().getName() : "",
                            e.getClassGroup() != null ? e.getClassGroup().getDisplayName() : "",
                            room == null ? "" : room,
                            false,
                            false);
                    cells.add(c);
                    if (d == today) todayCells.add(c);
                }
            }
        }
        return new PublishedTeacherWeeklyTimetableDTO(
                v.getVersion(), v.getPublishedAt(), dayNames, periods, cells, weeklyTeaching, freeTotal, todayCells);
    }

    private PublishedStudentWeeklyTimetableDTO buildStudentWeekly(
            Integer schoolId,
            TimetableVersion v,
            List<TimetableEntry> entries) {
        List<SchoolTimeSlot> slotEntities =
                schoolTimeSlotRepo.findBySchool_IdAndActiveIsTrueOrderBySlotOrderAsc(schoolId).stream().toList();
        List<PublishedWeeklyPeriodDTO> periods = slotEntities.stream()
                .map(s -> new PublishedWeeklyPeriodDTO(
                        s.getId(), s.getSlotOrder(), s.getStartTime(), s.getEndTime(), s.isBreakSlot()))
                .toList();

        List<DayOfWeek> workingDays = resolveWorkingDays(schoolId);
        if (workingDays.isEmpty()) {
            workingDays =
                    List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);
        }
        List<String> dayNames = workingDays.stream().map(DayOfWeek::name).toList();

        Map<String, TimetableEntry> byDaySlot = new HashMap<>();
        for (TimetableEntry e : entries) {
            byDaySlot.put(e.getDayOfWeek().name() + "|" + e.getTimeSlot().getId(), e);
        }

        List<PublishedStudentGridCellDTO> cells = new ArrayList<>();
        DayOfWeek today = LocalDate.now().getDayOfWeek();
        List<PublishedStudentGridCellDTO> todayCells = new ArrayList<>();

        for (DayOfWeek d : workingDays) {
            for (SchoolTimeSlot slot : slotEntities) {
                if (slot.isBreakSlot()) {
                    PublishedStudentGridCellDTO c =
                            new PublishedStudentGridCellDTO(d.name(), slot.getId(), "Break", "", "", true, false);
                    cells.add(c);
                    if (d == today) todayCells.add(c);
                    continue;
                }
                TimetableEntry e = byDaySlot.get(d.name() + "|" + slot.getId());
                if (e == null) {
                    PublishedStudentGridCellDTO c =
                            new PublishedStudentGridCellDTO(d.name(), slot.getId(), "", "", "", false, true);
                    cells.add(c);
                    if (d == today) todayCells.add(c);
                } else {
                    String room = roomLabel(e.getRoom());
                    PublishedStudentGridCellDTO c = new PublishedStudentGridCellDTO(
                            d.name(),
                            slot.getId(),
                            e.getSubject() != null ? e.getSubject().getName() : "",
                            e.getStaff() != null ? e.getStaff().getFullName() : "",
                            room == null ? "" : room,
                            false,
                            false);
                    cells.add(c);
                    if (d == today) todayCells.add(c);
                }
            }
        }
        return new PublishedStudentWeeklyTimetableDTO(
                v.getVersion(), v.getPublishedAt(), dayNames, periods, cells, todayCells);
    }

    private TimetableOccurrenceDTO toOccurrence(TimetableEntry e, LocalDate date) {
        LocalTime start = e.getTimeSlot().getStartTime();
        LocalTime end = e.getTimeSlot().getEndTime();
        String teacher = e.getStaff() != null ? e.getStaff().getFullName() : "";
        String subject = e.getSubject() != null ? e.getSubject().getName() : "";
        String cgName = e.getClassGroup() != null ? e.getClassGroup().getDisplayName() : "";
        String room = roomLabel(e.getRoom());
        Integer cgId = e.getClassGroup() != null ? e.getClassGroup().getId() : null;
        Integer rowId = publishedEntrySurrogate(e.getId());
        return new TimetableOccurrenceDTO(date, start, end, subject, teacher, room, cgName, "RECURRING", cgId, rowId);
    }

    private static String roomLabel(Room room) {
        if (room == null) return "";
        return (room.getBuilding() + " " + room.getRoomNumber()).trim();
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
                DayOfWeek dow =
                        switch (v) {
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
            ArrayList<DayOfWeek> out = new ArrayList<>(set);
            out.sort(Comparator.comparingInt(DayOfWeek::getValue));
            return out;
        } catch (Exception ignored) {
            return List.of();
        }
    }
}
