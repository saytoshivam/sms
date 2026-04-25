package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.AttendanceMarkDTO;
import com.myhaimi.sms.DTO.AttendanceSessionCreateDTO;
import com.myhaimi.sms.DTO.AttendanceSessionSheetDTO;
import com.myhaimi.sms.DTO.AttendanceSheetRowDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.AttendanceDedupeKeys;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    /** Collapse legacy statuses to PRESENT/ABSENT for the teacher UI. */
    private static String binaryAttendanceStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String u = raw.trim().toUpperCase();
        return "ABSENT".equals(u) ? "ABSENT" : "PRESENT";
    }

    private static String normalizeMarkStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required.");
        }
        String u = status.trim().toUpperCase();
        if (!"PRESENT".equals(u) && !"ABSENT".equals(u)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be PRESENT or ABSENT.");
        }
        return u;
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
            statusByStudent.put(sa.getStudent().getId(), binaryAttendanceStatus(sa.getStatus()));
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

        AttendanceSessionSheetDTO out = new AttendanceSessionSheetDTO();
        out.setSessionId(session.getId());
        out.setDate(session.getDate());
        out.setClassGroupDisplayName(cg.getDisplayName());
        out.setLectureId(lecId);
        out.setLectureSummary(lecSummary);
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
        Lecture lec = lectureRepo.findByIdAndSchool_Id(dto.getLectureId(), schoolId).orElseThrow();
        if (!lec.getClassGroup().getId().equals(cg.getId()) || !lec.getDate().equals(dto.getDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lecture does not match class or date.");
        }
        if (!canTakeLectureAttendance(actor, lec)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only the lecturer for this slot (or a school leader) can open attendance for this lecture.");
        }
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

    @Transactional
    public void mark(Integer sessionId, List<AttendanceMarkDTO> marks, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        AttendanceSession session = attendanceSessionRepo.findByIdAndSchool_Id(sessionId, schoolId).orElseThrow();
        assertCanOperateSession(actor, session);

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

    public List<StudentAttendance> listMarks(Integer sessionId, String actorEmail) {
        User actor = requireUser(actorEmail);
        Integer schoolId = requireSchoolId();
        AttendanceSession session = attendanceSessionRepo.findByIdAndSchool_Id(sessionId, schoolId).orElseThrow();
        assertCanOperateSession(actor, session);
        return studentAttendanceRepo.findByAttendanceSession_Id(sessionId);
    }
}
