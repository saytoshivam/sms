package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.AttendanceMarkDTO;
import com.myhaimi.sms.DTO.AttendanceSessionCreateDTO;
import com.myhaimi.sms.DTO.AttendanceSessionSheetDTO;
import com.myhaimi.sms.DTO.AttendanceSheetRowDTO;
import com.myhaimi.sms.DTO.attendance.*;
import com.myhaimi.sms.DTO.timetable.TimetableOccurrenceDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.modules.platform.service.PlatformAuditService;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.AttendanceDedupeKeys;
import com.myhaimi.sms.utils.LectureRowIdEncoding;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttendanceService {
    private static final Set<String> ATTENDANCE_LEADERSHIP =
            Set.of("SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "HOD");

    private final AttendanceSessionRepo attendanceSessionRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final StudentRepo studentRepo;
    private final UserRepo userRepo;
    private final LectureRepo lectureRepo;
    private final TimetableEntryRepo timetableEntryRepo;
    private final TimetableSlotRepo timetableSlotRepo;
    private final PublishedTimetableCalendarService publishedTimetableCalendarService;
    private final PlatformAuditService platformAuditService;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    private User requireUser(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not signed in.");
        }
        return userRepo.findFirstByEmailIgnoreCase(email.trim()).orElseThrow();
    }

    private static boolean isAttendanceLeadership(User u) {
        return u.getRoles().stream().map(Role::getName).anyMatch(ATTENDANCE_LEADERSHIP::contains);
    }

    private boolean canTakeDailyAttendance(User actor, ClassGroup cg) {
        if (isAttendanceLeadership(actor)) {
            return true;
        }
        Staff linked = actor.getLinkedStaff();
        if (linked == null) {
            return false;
        }
        Staff ct = cg.getClassTeacher();
        return ct != null && ct.getId().equals(linked.getId());
    }

    private boolean canTakeLectureAttendance(User actor, Lecture lec) {
        if (isAttendanceLeadership(actor)) {
            return true;
        }
        Staff linked = actor.getLinkedStaff();
        if (linked == null) {
            return false;
        }
        if (lec.getStaff() != null && lec.getStaff().getId().equals(linked.getId())) {
            return true;
        }
        String tn = lec.getTeacherName();
        String full = linked.getFullName();
        return tn != null
                && full != null
                && tn.trim().equalsIgnoreCase(full.trim());
    }

    private static String studentDisplayName(Student s) {
        String ln = s.getLastName() == null ? "" : s.getLastName().trim();
        return (s.getFirstName() + " " + ln).trim();
    }

    private static String lectureSummary(Lecture lec) {
        String st = lec.getStartTime() == null ? "?" : lec.getStartTime().toString();
        String et = lec.getEndTime() == null ? "?" : lec.getEndTime().toString();
        if (st.length() >= 5) {
            st = st.substring(0, 5);
        }
        if (et.length() >= 5) {
            et = et.substring(0, 5);
        }
        return st + "–" + et + " · " + lec.getSubject();
    }

    private static String sheetDisplayStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String u = raw.trim().toUpperCase(Locale.ROOT);
        return switch (u) {
            case "ABSENT" -> "ABSENT";
            case "LATE" -> "LATE";
            case "EXCUSED" -> "EXCUSED";
            default -> {
                if ("LEAVE".equals(u)) yield "EXCUSED";
                yield "PRESENT";
            }
        };
    }

    private static String normalizeMarkStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required.");
        }
        String u = status.trim().toUpperCase(Locale.ROOT);
        if ("LEAVE".equals(u)) {
            return "EXCUSED";
        }
        if (!"PRESENT".equals(u) && !"ABSENT".equals(u) && !"LATE".equals(u) && !"EXCUSED".equals(u)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Status must be PRESENT, ABSENT, LATE, EXCUSED, or LEAVE.");
        }
        return u;
    }

    /** Non-leaders: marking only allowed on lecture day while within lesson window (+ grace). Leaders bypass. */
    private void assertLectureOperationalWindowIfNeeded(User actor, School school, AttendanceSession session) {
        if (isAttendanceLeadership(actor)) {
            return;
        }
        if (school.getAttendanceMode() != AttendanceMode.LECTURE_WISE) {
            return;
        }
        Lecture lec = session.getLecture();
        if (lec == null) {
            return;
        }
        LocalDate today = LocalDate.now();
        if (!today.equals(session.getDate())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Attendance for this lecture can only be edited on its scheduled day.");
        }
        LocalTime now = LocalTime.now();
        LocalTime start = lec.getStartTime();
        int grace = Math.max(0, school.getAttendanceLectureGraceMinutes());
        LocalTime windowEnd = lec.getEndTime().plusMinutes(grace);
        if (now.isBefore(start) || now.isAfter(windowEnd)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Outside the marking window for this period.");
        }
    }

    private boolean withinLectureWindow(School school, Lecture lec) {
        if (school.getAttendanceMode() != AttendanceMode.LECTURE_WISE || lec == null) {
            return true;
        }
        LocalDate today = LocalDate.now();
        if (!today.equals(lec.getDate())) {
            return false;
        }
        LocalTime now = LocalTime.now();
        LocalTime start = lec.getStartTime();
        int grace = Math.max(0, school.getAttendanceLectureGraceMinutes());
        LocalTime windowEnd = lec.getEndTime().plusMinutes(grace);
        return !now.isBefore(start) && !now.isAfter(windowEnd);
    }

    private boolean withinLectureWindowOccurrence(School school, TimetableOccurrenceDTO o) {
        if (school.getAttendanceMode() != AttendanceMode.LECTURE_WISE) {
            return true;
        }
        LocalDate today = LocalDate.now();
        if (!today.equals(o.date())) {
            return false;
        }
        LocalTime now = LocalTime.now();
        int grace = Math.max(0, school.getAttendanceLectureGraceMinutes());
        LocalTime windowEnd = o.endTime().plusMinutes(grace);
        return !now.isBefore(o.startTime()) && !now.isAfter(windowEnd);
    }

    /** Whether period end + grace has passed today (same calendar day check). */
    private boolean periodEndedWithGraceSchoolLocal(School school, TimetableOccurrenceDTO o) {
        LocalDate today = LocalDate.now();
        if (!today.equals(o.date())) {
            return false;
        }
        int grace = Math.max(0, school.getAttendanceLectureGraceMinutes());
        LocalTime end = o.endTime().plusMinutes(grace);
        return LocalTime.now().isAfter(end);
    }

    private static String truncateTime(LocalTime t) {
        if (t == null) {
            return "";
        }
        String s = t.toString();
        return s.length() >= 5 ? s.substring(0, 5) : s;
    }

    private void assertCanOperateSession(User actor, AttendanceSession session) {
        School school = schoolRepo.findById(session.getSchool().getId()).orElseThrow();
        ClassGroup cg =
                classGroupRepo.findByIdAndSchool_Id(session.getClassGroup().getId(), school.getId()).orElseThrow();

        if (school.getAttendanceMode() == AttendanceMode.DAILY) {
            if (!canTakeDailyAttendance(actor, cg)) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Only the class teacher or a school leader can change daily attendance for this class.");
            }
            return;
        }
        Lecture lec = session.getLecture();
        if (lec == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lecture-wise mode requires a lecture-linked session.");
        }
        if (!canTakeLectureAttendance(actor, lec)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only the lecturer for this slot (or a school leader) can change this attendance.");
        }
    }

    /**
     * Resolves surrogate row ids ({@link LectureRowIdEncoding}) into a persisted {@link Lecture} row (creating when
     * needed) so FK constraints on attendance sessions stay valid.
     */
    @Transactional
    public Lecture resolveOrCreateLectureForRow(Integer schoolId, Integer classGroupId, LocalDate date, int lectureRowId) {
        classGroupRepo.findByIdAndSchool_Id(classGroupId, schoolId).orElseThrow();
        if (lectureRowId > 0) {
            return lectureRepo.findByIdAndSchool_Id(lectureRowId, schoolId).orElseThrow();
        }
        if (LectureRowIdEncoding.isPublishedEntrySurrogate(lectureRowId)) {
            int eid = LectureRowIdEncoding.timetableEntryIdFromSurrogate(lectureRowId);
            TimetableEntry e =
                    timetableEntryRepo.findById(eid).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown timetable entry."));
            if (!Objects.equals(e.getSchool().getId(), schoolId)
                    || !Objects.equals(e.getClassGroup().getId(), classGroupId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Timetable entry does not match class.");
            }
            if (e.getDayOfWeek() != date.getDayOfWeek()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Timetable entry does not occur on this date.");
            }
            if (e.getTimetableVersion() == null
                    || e.getTimetableVersion().getStatus() != TimetableStatus.PUBLISHED) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Only the published timetable can be used for lecture-wise attendance.");
            }
            if (e.getTimeSlot() != null && e.getTimeSlot().isBreakSlot()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Break slots cannot take attendance.");
            }
            Objects.requireNonNull(e.getSubject());
            Objects.requireNonNull(e.getTimeSlot());
            return lectureRepo
                    .findFirstBySchool_IdAndClassGroup_IdAndDateAndStartTimeAndEndTimeAndSubjectIgnoreCase(
                            schoolId,
                            classGroupId,
                            date,
                            e.getTimeSlot().getStartTime(),
                            e.getTimeSlot().getEndTime(),
                            e.getSubject().getName())
                    .orElseGet(
                            () -> {
                                Lecture l = new Lecture();
                                l.setSchool(e.getSchool());
                                l.setClassGroup(e.getClassGroup());
                                l.setDate(date);
                                l.setStartTime(e.getTimeSlot().getStartTime());
                                l.setEndTime(e.getTimeSlot().getEndTime());
                                l.setSubject(e.getSubject().getName());
                                l.setStaff(e.getStaff());
                                String tn = e.getStaff() != null ? e.getStaff().getFullName() : null;
                                l.setTeacherName(tn);
                                String roomTxt = "";
                                if (e.getRoom() != null) {
                                    roomTxt = (e.getRoom().getBuilding() + " " + e.getRoom().getRoomNumber()).trim();
                                }
                                if (!roomTxt.isBlank()) {
                                    l.setRoom(roomTxt);
                                }
                                return lectureRepo.save(l);
                            });
        }
        if (LectureRowIdEncoding.isLegacyWeeklySlotSurrogate(lectureRowId)) {
            int slotId = LectureRowIdEncoding.legacySlotIdFromSurrogate(lectureRowId);
            TimetableSlot slot = timetableSlotRepo.findByIdAndSchool_Id(slotId, schoolId).orElseThrow();
            if (!Objects.equals(slot.getClassGroup().getId(), classGroupId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Weekly slot does not match class.");
            }
            if (slot.getDayOfWeek() != date.getDayOfWeek()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Weekly slot does not occur on this date.");
            }
            return lectureRepo
                    .findFirstBySchool_IdAndClassGroup_IdAndDateAndStartTimeAndEndTimeAndSubjectIgnoreCase(
                            schoolId,
                            classGroupId,
                            date,
                            slot.getStartTime(),
                            slot.getEndTime(),
                            slot.getSubject())
                    .orElseGet(
                            () -> {
                                Lecture l = new Lecture();
                                l.setSchool(slot.getSchool());
                                l.setClassGroup(slot.getClassGroup());
                                l.setDate(date);
                                l.setStartTime(slot.getStartTime());
                                l.setEndTime(slot.getEndTime());
                                l.setSubject(slot.getSubject());
                                Staff st = slot.getStaff();
                                l.setStaff(st);
                                if (st != null) {
                                    l.setTeacherName(st.getFullName());
                                } else {
                                    l.setTeacherName(slot.getTeacherDisplayName());
                                }
                                l.setRoom(slot.getRoom());
                                return lectureRepo.save(l);
                            });
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown lecture row id.");
    }

    /**
     * Read-only resolver for dashboards: avoids creating surrogate {@link Lecture} rows until a teacher opens the sheet.
     */
    private Optional<Lecture> findMaterializedLectureIfExists(
            Integer schoolId, Integer classGroupId, LocalDate date, int lectureRowId) {
        if (lectureRowId > 0) {
            return lectureRepo.findByIdAndSchool_Id(lectureRowId, schoolId);
        }
        if (LectureRowIdEncoding.isPublishedEntrySurrogate(lectureRowId)) {
            int eid = LectureRowIdEncoding.timetableEntryIdFromSurrogate(lectureRowId);
            Optional<TimetableEntry> oe = timetableEntryRepo.findById(eid);
            if (oe.isEmpty() || !Objects.equals(oe.get().getSchool().getId(), schoolId)) {
                return Optional.empty();
            }
            TimetableEntry e = oe.get();
            if (e.getTimeSlot() == null || e.getSubject() == null) {
                return Optional.empty();
            }
            return lectureRepo.findFirstBySchool_IdAndClassGroup_IdAndDateAndStartTimeAndEndTimeAndSubjectIgnoreCase(
                    schoolId,
                    classGroupId,
                    date,
                    e.getTimeSlot().getStartTime(),
                    e.getTimeSlot().getEndTime(),
                    e.getSubject().getName());
        }
        if (LectureRowIdEncoding.isLegacyWeeklySlotSurrogate(lectureRowId)) {
            int slotId = LectureRowIdEncoding.legacySlotIdFromSurrogate(lectureRowId);
            Optional<TimetableSlot> slotOpt = timetableSlotRepo.findByIdAndSchool_Id(slotId, schoolId);
            if (slotOpt.isEmpty()) {
                return Optional.empty();
            }
            TimetableSlot slot = slotOpt.get();
            return lectureRepo.findFirstBySchool_IdAndClassGroup_IdAndDateAndStartTimeAndEndTimeAndSubjectIgnoreCase(
                    schoolId,
                    classGroupId,
                    date,
                    slot.getStartTime(),
                    slot.getEndTime(),
                    slot.getSubject());
        }
        return Optional.empty();
    }

    public Page<AttendanceSession> listSessions(Pageable pageable, Integer classGroupId, LocalDate date) {
        Integer schoolId = requireSchoolId();
        if (classGroupId == null && date == null) {
            return attendanceSessionRepo.findBySchool_Id(schoolId, pageable);
        }
        return attendanceSessionRepo.findBySchoolFiltered(schoolId, classGroupId, date, pageable);
    }

    @Transactional(readOnly = true)
    public AttendanceSessionSheetDTO getSessionSheet(Integer sessionId, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        AttendanceSession session = attendanceSessionRepo.findByIdAndSchool_Id(sessionId, schoolId).orElseThrow();
        assertCanOperateSession(actor, session);

        ClassGroup cg = session.getClassGroup();
        Integer lecId = session.getLectureId();
        String lecSummary = null;
        Lecture lec = session.getLecture();
        if (lec != null) {
            lecSummary = lectureSummary(lec);
        }

        List<Student> roster =
                studentRepo.findBySchool_IdAndClassGroup_IdOrderByLastNameAscFirstNameAsc(schoolId, cg.getId());
        List<StudentAttendance> existing = studentAttendanceRepo.findByAttendanceSession_Id(sessionId);
        Map<Integer, String> statusByStudent = new HashMap<>();
        for (StudentAttendance sa : existing) {
            statusByStudent.put(sa.getStudent().getId(), sheetDisplayStatus(sa.getStatus()));
        }

        List<AttendanceSheetRowDTO> rows =
                roster.stream()
                        .map(st -> {
                            AttendanceSheetRowDTO r = new AttendanceSheetRowDTO();
                            r.setStudentId(st.getId());
                            r.setAdmissionNo(st.getAdmissionNo());
                            r.setDisplayName(studentDisplayName(st));
                            r.setStatus(statusByStudent.get(st.getId()));
                            return r;
                        })
                        .toList();

        boolean locked = session.getLockedAt() != null;
        boolean window =
                school.getAttendanceMode() != AttendanceMode.LECTURE_WISE
                        || lec == null
                        || isAttendanceLeadership(actor)
                        || withinLectureWindow(school, lec);

        AttendanceSessionSheetDTO out = new AttendanceSessionSheetDTO();
        out.setSessionId(session.getId());
        out.setDate(session.getDate());
        out.setClassGroupDisplayName(cg.getDisplayName());
        out.setLectureId(lecId);
        out.setLectureSummary(lecSummary);
        out.setLocked(locked);
        out.setMarkingWindowOpenNow(window);
        out.setStudents(rows);
        return out;
    }

    @Transactional
    public AttendanceSession createSession(AttendanceSessionCreateDTO dto, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        ClassGroup cg = classGroupRepo.findByIdAndSchool_Id(dto.getClassGroupId(), schoolId).orElseThrow();

        if (school.getAttendanceMode() == AttendanceMode.DAILY) {
            if (dto.getLectureId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Daily attendance does not use a lecture.");
            }
            if (!canTakeDailyAttendance(actor, cg)) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Only the class teacher or a school leader can open daily attendance for this class.");
            }
            String key = AttendanceDedupeKeys.daily(schoolId, cg.getId(), dto.getDate());
            return attendanceSessionRepo
                    .findByDedupeKey(key)
                    .orElseGet(
                            () -> {
                                AttendanceSession s = new AttendanceSession();
                                s.setSchool(school);
                                s.setClassGroup(cg);
                                s.setDate(dto.getDate());
                                s.setLecture(null);
                                s.setDedupeKey(key);
                                return attendanceSessionRepo.save(s);
                            });
        }

        if (dto.getLectureId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a lecture for lecture-wise attendance.");
        }
        Lecture lec = resolveOrCreateLectureForRow(schoolId, cg.getId(), dto.getDate(), dto.getLectureId());
        if (!lec.getClassGroup().getId().equals(cg.getId()) || !lec.getDate().equals(dto.getDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lecture does not match class or date.");
        }
        if (!canTakeLectureAttendance(actor, lec)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only the lecturer for this slot (or a school leader) can open attendance for this lecture.");
        }
        assertLectureOperationalWindowIfNeeded(actor, school, buildEphemeralSessionForWindow(school, cg, dto.getDate(), lec));
        String key = AttendanceDedupeKeys.lecture(lec.getId());
        return attendanceSessionRepo
                .findByDedupeKey(key)
                .orElseGet(
                        () -> {
                            AttendanceSession s = new AttendanceSession();
                            s.setSchool(school);
                            s.setClassGroup(cg);
                            s.setDate(dto.getDate());
                            s.setLecture(lec);
                            s.setDedupeKey(key);
                            return attendanceSessionRepo.save(s);
                        });
    }

    /** Session-shaped holder only for window checks before row is persisted. */
    private static AttendanceSession buildEphemeralSessionForWindow(
            School school, ClassGroup cg, LocalDate date, Lecture lec) {
        AttendanceSession s = new AttendanceSession();
        s.setSchool(school);
        s.setClassGroup(cg);
        s.setDate(date);
        s.setLecture(lec);
        return s;
    }

    @Transactional
    public void mark(Integer sessionId, List<AttendanceMarkDTO> marks, String actorEmail, String editReasonOrNull) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        AttendanceSession session = attendanceSessionRepo.findByIdAndSchool_Id(sessionId, schoolId).orElseThrow();
        assertCanOperateSession(actor, session);

        boolean locked = session.getLockedAt() != null;
        if (locked) {
            String reason = editReasonOrNull == null ? "" : editReasonOrNull.trim();
            if (reason.length() < 4) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Attendance is locked — provide editReason when changing marks.");
            }
            String detail =
                    reason
                            + " | marks="
                            + marks.stream()
                                    .map(m -> m.getStudentId() + ":" + normalizeMarkStatus(m.getStatus()))
                                    .collect(Collectors.joining(","));
            platformAuditService.record(
                    "ATTENDANCE_LOCKED_EDIT", "AttendanceSession", String.valueOf(sessionId), detail);
        } else {
            assertLectureOperationalWindowIfNeeded(actor, school, session);
        }

        Integer sessionClassGroupId = session.getClassGroup().getId();
        for (AttendanceMarkDTO mark : marks) {
            Student student = studentRepo.findByIdAndSchool_Id(mark.getStudentId(), schoolId).orElseThrow();
            ClassGroup sCg = student.getClassGroup();
            if (sCg == null || !sCg.getId().equals(sessionClassGroupId)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Student is not enrolled in this session's class.");
            }
            String normalized = normalizeMarkStatus(mark.getStatus());
            StudentAttendance sa = studentAttendanceRepo
                    .findByAttendanceSession_IdAndStudent_Id(sessionId, student.getId())
                    .orElseGet(
                            () -> {
                                StudentAttendance x = new StudentAttendance();
                                x.setAttendanceSession(session);
                                x.setStudent(student);
                                return x;
                            });
            sa.setStatus(normalized);
            sa.setRemark(mark.getRemark());
            studentAttendanceRepo.save(sa);
        }
    }

    @Transactional
    public void submit(Integer sessionId, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        AttendanceSession session = attendanceSessionRepo.findByIdAndSchool_Id(sessionId, schoolId).orElseThrow();
        assertCanOperateSession(actor, session);
        if (session.getLockedAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Attendance is already locked.");
        }
        assertLectureOperationalWindowIfNeeded(actor, school, session);

        List<Student> roster =
                studentRepo.findBySchool_IdAndClassGroup_IdOrderByLastNameAscFirstNameAsc(
                        schoolId, session.getClassGroup().getId());
        if (roster.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No students in this class.");
        }
        for (Student st : roster) {
            StudentAttendance sa = studentAttendanceRepo
                    .findByAttendanceSession_IdAndStudent_Id(sessionId, st.getId())
                    .orElseGet(
                            () -> {
                                StudentAttendance x = new StudentAttendance();
                                x.setAttendanceSession(session);
                                x.setStudent(st);
                                return x;
                            });
            if (sa.getStatus() == null || sa.getStatus().isBlank()) {
                sa.setStatus("PRESENT");
            }
            studentAttendanceRepo.save(sa);
        }
        session.setLockedAt(Instant.now());
        attendanceSessionRepo.save(session);
    }

    public List<StudentAttendance> listMarks(Integer sessionId, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        AttendanceSession session = attendanceSessionRepo.findByIdAndSchool_Id(sessionId, schoolId).orElseThrow();
        assertCanOperateSession(actor, session);
        return studentAttendanceRepo.findByAttendanceSession_Id(sessionId);
    }

    @Transactional(readOnly = true)
    public TeacherAttendanceContextDTO teacherContext(LocalDate date, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        if (!isAttendanceLeadership(actor) && actor.getLinkedStaff() == null) {
            return new TeacherAttendanceContextDTO(school.getAttendanceMode().name(), List.of(), List.of());
        }

        if (school.getAttendanceMode() == AttendanceMode.DAILY) {
            List<ClassGroup> groups;
            if (isAttendanceLeadership(actor)) {
                groups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
            } else {
                groups = classGroupRepo.findBySchool_IdAndClassTeacher_IdAndIsDeletedFalseOrderByDisplayNameAsc(
                        schoolId, actor.getLinkedStaff().getId());
            }
            List<TeacherDailySectionRowDTO> rows = new ArrayList<>();
            for (ClassGroup cg : groups) {
                Optional<AttendanceSession> opt =
                        attendanceSessionRepo.findBySchool_IdAndClassGroup_IdAndDateAndLectureIsNull(
                                schoolId, cg.getId(), date);
                boolean locked = opt.map(s -> s.getLockedAt() != null).orElse(false);
                boolean pending = opt.isEmpty() || !locked;
                rows.add(
                        new TeacherDailySectionRowDTO(
                                cg.getId(),
                                cg.getDisplayName(),
                                pending,
                                opt.map(AttendanceSession::getId).orElse(null),
                                locked));
            }
            return new TeacherAttendanceContextDTO("DAILY", rows, List.of());
        }

        Integer staffFilter = isAttendanceLeadership(actor) ? null : actor.getLinkedStaff().getId();
        List<TimetableOccurrenceDTO> occurrences =
                publishedTimetableCalendarService.calendar(schoolId, staffFilter, date, date);
        LinkedHashMap<String, TimetableOccurrenceDTO> deduped = new LinkedHashMap<>();
        for (TimetableOccurrenceDTO o : occurrences) {
            if (o.classGroupId() == null || o.lectureRowId() == null) {
                continue;
            }
            deduped.putIfAbsent(o.classGroupId() + "|" + o.lectureRowId(), o);
        }
        List<TeacherLectureSlotRowDTO> lectureRows = new ArrayList<>();
        for (TimetableOccurrenceDTO o : deduped.values()) {
            Integer cgId = o.classGroupId();
            Objects.requireNonNull(cgId);
            int rowId = o.lectureRowId();

            Optional<Lecture> matched = findMaterializedLectureIfExists(schoolId, cgId, date, rowId);
            Optional<Integer> sessionIdOpt = matched.flatMap(
                    le -> attendanceSessionRepo.findFirstBySchool_IdAndLecture_Id(schoolId, le.getId()).map(AttendanceSession::getId));
            boolean locked = matched.flatMap(
                            le ->
                                    attendanceSessionRepo
                                            .findFirstBySchool_IdAndLecture_Id(schoolId, le.getId()))
                    .map(s -> s.getLockedAt() != null)
                    .orElse(false);

            boolean markingWindowNow = withinLectureWindowOccurrence(school, o);

            boolean canOperate = isAttendanceLeadership(actor) || markingWindowNow;

            lectureRows.add(
                    new TeacherLectureSlotRowDTO(
                            cgId,
                            o.classGroupDisplayName(),
                            rowId,
                            Objects.toString(o.subject(), ""),
                            truncateTime(o.startTime()),
                            truncateTime(o.endTime()),
                            markingWindowNow,
                            canOperate,
                            sessionIdOpt.orElse(null),
                            locked));
        }
        return new TeacherAttendanceContextDTO("LECTURE_WISE", List.of(), lectureRows);
    }

    private void assertAdminCanViewAttendanceBoard(User actor) {
        if (!isAttendanceLeadership(actor)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "School leadership only.");
        }
    }

    @Transactional(readOnly = true)
    public AdminDailyAttendanceBoardDTO adminDailyBoard(LocalDate date, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        assertAdminCanViewAttendanceBoard(actor);
        if (school.getAttendanceMode() != AttendanceMode.DAILY) {
            return new AdminDailyAttendanceBoardDTO(null, List.of());
        }
        LocalTime cutoff = school.getAttendanceDailyCutoff();
        boolean pastCutoff = cutoff != null && LocalTime.now().isAfter(cutoff);
        LocalDate today = LocalDate.now();
        boolean cutoffAppliesToday = today.equals(date) && pastCutoff;

        List<ClassGroup> groups = classGroupRepo.findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(schoolId);
        List<AdminDailySectionRowDTO> rows = new ArrayList<>();
        for (ClassGroup cg : groups) {
            Optional<AttendanceSession> sess =
                    attendanceSessionRepo.findBySchool_IdAndClassGroup_IdAndDateAndLectureIsNull(schoolId, cg.getId(), date);
            boolean submitted = sess.map(s -> s.getLockedAt() != null).orElse(false);
            String ct =
                    cg.getClassTeacherDisplayName() == null || cg.getClassTeacherDisplayName().isBlank()
                            ? "—"
                            : cg.getClassTeacherDisplayName().trim();
            String teacherEmail = null;
            if (cg.getClassTeacher() != null && cg.getClassTeacher().getEmail() != null) {
                String em = cg.getClassTeacher().getEmail().trim();
                teacherEmail = em.isBlank() ? null : em;
            }
            rows.add(
                    new AdminDailySectionRowDTO(
                            cg.getId(),
                            cg.getDisplayName(),
                            ct,
                            submitted,
                            sess.map(AttendanceSession::getId).orElse(null),
                            cutoffAppliesToday && !submitted,
                            cg.getGradeLevel(),
                            cg.getSection(),
                            sess.map(AttendanceSession::getLockedAt).orElse(null),
                            teacherEmail));
        }
        return new AdminDailyAttendanceBoardDTO(school.getAttendanceDailyCutoff(), rows);
    }

    @Transactional(readOnly = true)
    public List<AdminLectureGapRowDTO> adminLectureGaps(LocalDate date, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        assertAdminCanViewAttendanceBoard(actor);
        if (school.getAttendanceMode() != AttendanceMode.LECTURE_WISE) {
            return List.of();
        }
        List<TimetableOccurrenceDTO> occurrences =
                publishedTimetableCalendarService.calendar(schoolId, null, date, date);
        LinkedHashMap<String, TimetableOccurrenceDTO> deduped = new LinkedHashMap<>();
        for (TimetableOccurrenceDTO o : occurrences) {
            if (o.classGroupId() == null || o.lectureRowId() == null) {
                continue;
            }
            deduped.putIfAbsent(o.classGroupId() + "|" + o.lectureRowId(), o);
        }
        List<AdminLectureGapRowDTO> out = new ArrayList<>();
        for (TimetableOccurrenceDTO o : deduped.values()) {
            if (o.classGroupId() == null || o.lectureRowId() == null) {
                continue;
            }
            Optional<Lecture> lecOpt = findMaterializedLectureIfExists(schoolId, o.classGroupId(), date, o.lectureRowId());
            boolean periodDone = periodEndedWithGraceSchoolLocal(school, o);
            if (!periodDone) {
                continue;
            }
            boolean missed = true;
            if (lecOpt.isPresent()) {
                Optional<AttendanceSession> sess =
                        attendanceSessionRepo.findFirstBySchool_IdAndLecture_Id(schoolId, lecOpt.get().getId());
                if (sess.isPresent() && sess.get().getLockedAt() != null) {
                    missed = false;
                }
            }
            if (!missed) {
                continue;
            }
            String teacher = o.teacherName() == null || o.teacherName().isBlank() ? "—" : o.teacherName().trim();
            out.add(
                    new AdminLectureGapRowDTO(
                            teacher,
                            o.classGroupId(),
                            o.classGroupDisplayName(),
                            o.lectureRowId(),
                            Objects.toString(o.subject(), ""),
                            truncateTime(o.startTime()),
                            truncateTime(o.endTime()),
                            true));
        }
        return out;
    }
}
