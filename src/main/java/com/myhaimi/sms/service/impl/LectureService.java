package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.LectureCreateDTO;
import com.myhaimi.sms.DTO.LectureDayRowDTO;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.Lecture;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.TimetableEntry;
import com.myhaimi.sms.entity.TimetableSlot;
import com.myhaimi.sms.entity.TimetableStatus;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.LectureRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.TimetableEntryRepo;
import com.myhaimi.sms.repository.TimetableSlotRepo;
import com.myhaimi.sms.repository.TimetableVersionRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LectureService {
    private final LectureRepo lectureRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final UserRepo userRepo;
    private final TimetableSlotRepo timetableSlotRepo;
    private final TimetableVersionRepo timetableVersionRepo;
    private final TimetableEntryRepo timetableEntryRepo;

    /** Legacy slot surrogate ids avoid collision with timetable_entry ids used as negatives in the timeline. */
    private static final int WEEKLY_SLOT_ID_BASE = 1_000_000_000;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "School context is required. Use a school account, or sign out and sign in again so your token includes the school.");
        }
        return schoolId;
    }

    public Page<Lecture> list(Pageable pageable) {
        return lectureRepo.findBySchool_Id(requireSchoolId(), pageable);
    }

    /** Lectures for one class on one day (sorted by start time). */
    public List<LectureDayRowDTO> listByClassAndDate(Integer classGroupId, LocalDate date) {
        Integer schoolId = requireSchoolId();
        classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();
        DayOfWeek dow = date.getDayOfWeek();

        List<LectureDayRowDTO> rows = new ArrayList<>();
        for (Lecture le : lectureRepo.findBySchool_IdAndClassGroup_IdAndDateOrderByStartTimeAsc(schoolId, classGroupId, date)) {
            rows.add(new LectureDayRowDTO(
                    le.getId(),
                    le.getStartTime(),
                    le.getEndTime(),
                    le.getSubject(),
                    le.getTeacherName()));
        }

        timetableVersionRepo
                .findTopBySchool_IdAndStatusOrderByVersionDesc(schoolId, TimetableStatus.PUBLISHED)
                .ifPresent(ver ->
                        addPublishedTimetableRows(rows, schoolId, ver.getId(), classGroupId, dow));

        for (TimetableSlot slot : timetableSlotRepo.findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(schoolId)) {
            if (!slot.getClassGroup().getId().equals(classGroupId)) continue;
            if (slot.getDayOfWeek() != dow) continue;
            String tn = timetableSlotTeacherName(slot);
            rows.add(new LectureDayRowDTO(
                    -(WEEKLY_SLOT_ID_BASE + slot.getId()),
                    slot.getStartTime(),
                    slot.getEndTime(),
                    slot.getSubject(),
                    tn));
        }

        rows.sort(Comparator.comparing(LectureDayRowDTO::startTime));
        return rows;
    }

    private void addPublishedTimetableRows(
            List<LectureDayRowDTO> rows,
            Integer schoolId,
            Integer publishedVersionId,
            Integer classGroupId,
            DayOfWeek dow) {
        List<TimetableEntry> ents =
                timetableEntryRepo.fetchGraphBySchoolVersionAndClassGroup(schoolId, publishedVersionId, classGroupId);
        for (TimetableEntry e : ents) {
            if (!dow.equals(e.getDayOfWeek())) continue;
            if (e.getTimeSlot() == null || e.getTimeSlot().isBreakSlot()) continue;
            String subj = e.getSubject() != null ? e.getSubject().getName() : "";
            String tn = e.getStaff() != null ? e.getStaff().getFullName() : null;
            rows.add(new LectureDayRowDTO(
                    -e.getId(),
                    e.getTimeSlot().getStartTime(),
                    e.getTimeSlot().getEndTime(),
                    subj,
                    tn));
        }
    }

    private static String timetableSlotTeacherName(TimetableSlot slot) {
        if (slot.getStaff() != null) {
            return Optional.ofNullable(slot.getStaff().getFullName()).orElse(null);
        }
        String display = slot.getTeacherDisplayName();
        return display == null || display.isBlank() ? null : display.trim();
    }

    /**
     * Creates a one-off lecture. If the signed-in user has a linked {@link com.myhaimi.sms.entity.Staff} profile, the
     * lecture is always attributed to that staff member (client cannot book for someone else).
     */
    @Transactional
    public Lecture create(LectureCreateDTO dto, String actorEmail) {
        if (actorEmail == null || actorEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated.");
        }
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(dto.getClassGroupId(), schoolId).orElseThrow();

        User actor = userRepo.findFirstByEmailIgnoreCase(actorEmail).orElseThrow();
        if (actor.getLinkedStaff() == null) {
            boolean teacherRoleOnly = actor.getRoles().stream()
                    .map(Role::getName)
                    .anyMatch(n -> "TEACHER".equals(n) || "CLASS_TEACHER".equals(n));
            if (teacherRoleOnly) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Your login must be linked to a staff profile before you can schedule one-off lectures.");
            }
        }

        String teacherNameToSave;
        if (actor.getLinkedStaff() != null) {
            String full = actor.getLinkedStaff().getFullName();
            if (full == null || full.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Your staff profile has no name; ask an admin to update it.");
            }
            teacherNameToSave = full.trim();
        } else {
            teacherNameToSave =
                    dto.getTeacherName() == null || dto.getTeacherName().isBlank()
                            ? null
                            : dto.getTeacherName().trim();
        }

        LocalTime start = dto.getStartTime();
        LocalTime end = dto.getEndTime();
        if (!start.isBefore(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End time must be after start time.");
        }

        List<Lecture> sameDay =
                lectureRepo.findBySchool_IdAndClassGroup_IdAndDateOrderByStartTimeAsc(schoolId, cg.getId(), dto.getDate());
        for (Lecture existing : sameDay) {
            if (intervalsOverlap(start, end, existing.getStartTime(), existing.getEndTime())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Another lecture for this class overlaps this time slot ("
                                + existing.getStartTime()
                                + "–"
                                + existing.getEndTime()
                                + ", "
                                + existing.getSubject()
                                + ").");
            }
        }

        var dow = dto.getDate().getDayOfWeek();
        timetableVersionRepo
                .findTopBySchool_IdAndStatusOrderByVersionDesc(schoolId, TimetableStatus.PUBLISHED)
                .ifPresent(ver ->
                        timetableEntryRepo.fetchGraphBySchoolVersionAndClassGroup(schoolId, ver.getId(), cg.getId())
                                .stream()
                                .filter(e -> dow.equals(e.getDayOfWeek()))
                                .filter(e -> e.getTimeSlot() != null && !e.getTimeSlot().isBreakSlot())
                                .forEach(e -> {
                                    LocalTime bs = e.getTimeSlot().getStartTime();
                                    LocalTime be = e.getTimeSlot().getEndTime();
                                    if (intervalsOverlap(start, end, bs, be)) {
                                        String lbl =
                                                e.getSubject() != null ? e.getSubject().getName() : "timetabled class";
                                        throw new ResponseStatusException(
                                                HttpStatus.CONFLICT,
                                                "This time overlaps the published weekly timetable for this class ("
                                                        + bs
                                                        + "–"
                                                        + be
                                                        + ", "
                                                        + lbl
                                                        + ").");
                                    }
                                }));

        // Teacher conflict: cannot overlap with another one-off lecture (same teacher) on the same day
        if (teacherNameToSave != null && !teacherNameToSave.isBlank()) {
            List<Lecture> allSameDay =
                    lectureRepo.findBySchool_IdAndDateBetweenOrderByDateAscStartTimeAsc(schoolId, dto.getDate(), dto.getDate());
            for (Lecture existing : allSameDay) {
                if (existing.getTeacherName() == null) continue;
                if (!teacherNameToSave.equals(existing.getTeacherName())) continue;
                if (intervalsOverlap(start, end, existing.getStartTime(), existing.getEndTime())) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Teacher conflict: " + teacherNameToSave + " is already booked ("
                                    + existing.getStartTime()
                                    + "–"
                                    + existing.getEndTime()
                                    + ", "
                                    + existing.getClassGroup().getDisplayName()
                                    + ").");
                }
            }

            // Teacher conflict: cannot overlap with weekly recurring timetable slots
            List<TimetableSlot> weekly =
                    timetableSlotRepo.findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(schoolId).stream()
                            .filter(s -> s.getDayOfWeek() == dow)
                            .toList();
            for (TimetableSlot slot : weekly) {
                String slotTeacher = timetableSlotTeacherName(slot);
                if (slotTeacher == null) continue;
                if (!teacherNameToSave.equals(slotTeacher)) continue;
                if (intervalsOverlap(start, end, slot.getStartTime(), slot.getEndTime())) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Teacher conflict: " + teacherNameToSave + " has a weekly class ("
                                    + slot.getStartTime()
                                    + "–"
                                    + slot.getEndTime()
                                    + ", "
                                    + slot.getClassGroup().getDisplayName()
                                    + ").");
                }
            }

            timetableVersionRepo
                    .findTopBySchool_IdAndStatusOrderByVersionDesc(schoolId, TimetableStatus.PUBLISHED)
                    .ifPresent(ver -> {
                        for (TimetableEntry e : timetableEntryRepo.fetchGraphBySchoolAndVersion(schoolId, ver.getId())) {
                            if (!dow.equals(e.getDayOfWeek())) continue;
                            if (e.getTimeSlot() == null || e.getTimeSlot().isBreakSlot()) continue;
                            if (e.getStaff() == null || !actor.getLinkedStaff().getId().equals(e.getStaff().getId())) {
                                continue;
                            }
                            LocalTime bs = e.getTimeSlot().getStartTime();
                            LocalTime be = e.getTimeSlot().getEndTime();
                            if (intervalsOverlap(start, end, bs, be)) {
                                throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Teacher conflict: " + teacherNameToSave + " is on the published timetable ("
                                                + bs
                                                + "–"
                                                + be
                                                + ", "
                                                + e.getClassGroup().getDisplayName()
                                                + ").");
                            }
                        }
                    });
        }

        Lecture l = new Lecture();
        l.setSchool(school);
        l.setClassGroup(cg);
        l.setDate(dto.getDate());
        l.setStartTime(start);
        l.setEndTime(end);
        l.setSubject(dto.getSubject());
        l.setTeacherName(teacherNameToSave);
        l.setRoom(dto.getRoom());
        if (actor.getLinkedStaff() != null) {
            l.setStaff(actor.getLinkedStaff());
        }
        return lectureRepo.save(l);
    }

    /** True if [aStart,aEnd) overlaps [bStart,bEnd) — adjacent slots do not overlap. */
    static boolean intervalsOverlap(LocalTime aStart, LocalTime aEnd, LocalTime bStart, LocalTime bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }
}

