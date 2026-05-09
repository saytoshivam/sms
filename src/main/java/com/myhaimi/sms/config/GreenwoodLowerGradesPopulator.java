package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.service.impl.TimetableSlotService;
import com.myhaimi.sms.utils.AttendanceDedupeKeys;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * Idempotent: adds Grade 8 (8-A, 8-B), Grade 9-B, linked demo student login, lectures, attendance, and marks when
 * missing (for existing Greenwood DBs and as final step of fresh demo seed).
 */
@Service
@RequiredArgsConstructor
public class GreenwoodLowerGradesPopulator {

    private final ClassGroupRepo classGroupRepo;
    private final StudentRepo studentRepo;
    private final GuardianRepo guardianRepo;
    private final AcademicYearRepo academicYearRepo;
    private final StudentAcademicEnrollmentRepo studentAcademicEnrollmentRepo;
    private final StudentGuardianRepo studentGuardianRepo;
    private final LectureRepo lectureRepo;
    private final AttendanceSessionRepo attendanceSessionRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final StudentMarkRepo studentMarkRepo;
    private final UserRepo userRepo;
    private final TimetableSlotService timetableSlotService;

    @Transactional
    public void populateIfMissing(
            School school,
            LocalDate today,
            int[] lectureSlotCounter,
            Random rnd,
            Staff rahul,
            Staff sneha,
            Staff priya,
            Staff vikram,
            String enc,
            Role rStudent) {
        Integer sid = school.getId();
        if (classGroupRepo.findByCodeAndSchool_Id("8-A", sid).isPresent()) {
            return;
        }

        final ClassGroup c9b = classGroupRepo.save(cg(school, "9-B", "Grade 9 — Section B"));
        final ClassGroup c8a = classGroupRepo.save(cg(school, "8-A", "Grade 8 — Section A"));
        final ClassGroup c8b = classGroupRepo.save(cg(school, "8-B", "Grade 8 — Section B"));

        timetableSlotService.seedWeeklyPattern(school, c9b, "Mathematics", rahul, LocalTime.of(9, 0), LocalTime.of(9, 45), "Room 9B-1");
        timetableSlotService.seedWeeklyPattern(school, c9b, "English", sneha, LocalTime.of(10, 0), LocalTime.of(10, 40), "Room 9B-2");
        timetableSlotService.seedWeeklyPattern(school, c8a, "Mathematics", priya, LocalTime.of(8, 15), LocalTime.of(9, 0), "Room G8-1");
        timetableSlotService.seedWeeklyPattern(school, c8a, "Science", sneha, LocalTime.of(9, 5), LocalTime.of(9, 50), "Lab G8");
        timetableSlotService.seedWeeklyPattern(school, c8a, "English", vikram, LocalTime.of(10, 0), LocalTime.of(10, 40), "Room G8-2");
        timetableSlotService.seedWeeklyPattern(school, c8b, "Mathematics", rahul, LocalTime.of(11, 0), LocalTime.of(11, 45), "Room G8B-1");
        timetableSlotService.seedWeeklyPattern(school, c8b, "Social Studies", priya, LocalTime.of(12, 0), LocalTime.of(12, 40), "Room G8B-2");

        List<Student> extra = new ArrayList<>();
        extra.add(stu(school, c9b, "GW2025-013", "Liam", "Patel", LocalDate.of(2010, 4, 2)));
        extra.add(stu(school, c9b, "GW2025-014", "Noah", "Kapoor", LocalDate.of(2010, 9, 11)));
        extra.add(stu(school, c8a, "GW2026-801", "Karan", "Desai", LocalDate.of(2012, 3, 1)));
        extra.add(stu(school, c8a, "GW2026-802", "Pihu", "Sharma", LocalDate.of(2012, 7, 19)));
        extra.add(stu(school, c8a, "GW2026-803", "Reyansh", "Gupta", LocalDate.of(2011, 11, 8)));
        extra.add(stu(school, c8a, "GW2026-804", "Meera", "Iyer", LocalDate.of(2012, 1, 25)));
        extra.add(stu(school, c8b, "GW2026-805", "Shaurya", "Menon", LocalDate.of(2011, 5, 30)));
        extra.add(stu(school, c8b, "GW2026-806", "Tara", "Bose", LocalDate.of(2012, 8, 14)));
        extra = studentRepo.saveAll(extra);

        AcademicYear ay = academicYearRepo
                .findFirstBySchool_Id(sid, Sort.by(Sort.Direction.DESC, "startsOn", "id"))
                .orElseThrow(() -> new IllegalStateException("Demo school missing academic year row."));

        for (Student s : extra) {
            Guardian g = new Guardian();
            g.setSchool(school);
            g.setName("Parent of " + s.getFirstName());
            g.setPhone("9" + String.format("%09d", s.getId() * 991 % 1_000_000_000));
            g.setEmail(GreenwoodDemoAccounts.guardianEmail(s.getAdmissionNo().toLowerCase()));
            guardianRepo.save(g);

            StudentGuardian sg = new StudentGuardian();
            sg.setStudent(s);
            sg.setGuardian(g);
            sg.setRelation("Father");
            sg.setPrimaryGuardian(true);
            sg.setCanLogin(false);
            sg.setReceivesNotifications(true);
            studentGuardianRepo.save(sg);

            StudentAcademicEnrollment en = new StudentAcademicEnrollment();
            en.setStudent(s);
            en.setAcademicYear(ay);
            en.setClassGroup(s.getClassGroup());
            en.setAdmissionDate(LocalDate.now());
            en.setJoiningDate(LocalDate.now());
            en.setStatus(StudentAcademicEnrollmentStatus.ACTIVE);
            studentAcademicEnrollmentRepo.save(en);
        }

        for (int d = 0; d < 14; d++) {
            LocalDate day = today.plusDays(d);
            if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            lec(school, c9b, day, LocalTime.of(9, 0), LocalTime.of(9, 45), "Mathematics", "Rahul Verma", "Room 9B-1", lectureSlotCounter);
            lec(school, c9b, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "English", "Sneha Iyer", "Room 9B-2", lectureSlotCounter);
            lec(school, c8a, day, LocalTime.of(8, 15), LocalTime.of(9, 0), "Mathematics", "Priya Nair", "Room G8-1", lectureSlotCounter);
            lec(school, c8a, day, LocalTime.of(9, 5), LocalTime.of(9, 50), "Science", "Sneha Iyer", "Lab G8", lectureSlotCounter);
            lec(school, c8a, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "English", "Vikram Desai", "Room G8-2", lectureSlotCounter);
            lec(school, c8b, day, LocalTime.of(11, 0), LocalTime.of(11, 45), "Mathematics", "Rahul Verma", "Room G8B-1", lectureSlotCounter);
            lec(school, c8b, day, LocalTime.of(12, 0), LocalTime.of(12, 40), "Social Studies", "Priya Nair", "Room G8B-2", lectureSlotCounter);
        }

        seedPastWeekdayLecturesLowerGrades(school, sid, c8a, c8b, c9b, today, lectureSlotCounter);

        List<Student> class8a = extra.stream().filter(s -> s.getClassGroup() != null && s.getClassGroup().getId().equals(c8a.getId())).toList();
        List<Student> class8b = extra.stream().filter(s -> s.getClassGroup() != null && s.getClassGroup().getId().equals(c8b.getId())).toList();
        List<Student> class9b = extra.stream().filter(s -> s.getClassGroup() != null && s.getClassGroup().getId().equals(c9b.getId())).toList();

        seedAttendanceForClass(school, sid, c8a, class8a, today, rnd, 40);
        seedAttendanceForClass(school, sid, c8b, class8b, today, rnd, 40);
        seedAttendanceForClass(school, sid, c9b, class9b, today, rnd, 40);

        for (Student s : class8a) {
            upsertMark(school, s, "MAT", "T1", "Term check 1", new BigDecimal("15"), bd(11 + rnd.nextInt(4)), today.minusDays(14));
            upsertMark(school, s, "SCI", "LAB1", "Lab worksheet", new BigDecimal("10"), bd(7 + rnd.nextInt(3)), today.minusDays(10));
        }
        for (Student s : class9b) {
            upsertMark(school, s, "MAT", "QZ1", "Quiz 1", new BigDecimal("12"), bd(9 + rnd.nextInt(3)), today.minusDays(12));
        }

        Student karan =
                extra.stream().filter(s -> "GW2026-801".equals(s.getAdmissionNo())).findFirst().orElse(null);
        if (karan != null && userRepo.findFirstByEmailIgnoreCase(GreenwoodDemoAccounts.GRADE8).isEmpty()) {
            User u8 = new User();
            u8.setUsername("grade8-demo");
            u8.setEmail(GreenwoodDemoAccounts.GRADE8);
            u8.setPassword(enc);
            u8.setSchool(school);
            u8.setRoles(new HashSet<>(Set.of(rStudent)));
            u8.setLinkedStudent(karan);
            userRepo.save(u8);
        }
    }

    private void seedPastWeekdayLecturesLowerGrades(
            School school, int sid, ClassGroup c8a, ClassGroup c8b, ClassGroup c9b, LocalDate today, int[] slot) {
        for (int i = 1; i <= 55; i++) {
            LocalDate day = today.minusDays(i);
            if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            if (lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c8a.getId(), day, day)
                    .isEmpty()) {
                lec(school, c8a, day, LocalTime.of(8, 15), LocalTime.of(9, 0), "Mathematics", "Priya Nair", "Room G8-1", slot);
                lec(school, c8a, day, LocalTime.of(9, 5), LocalTime.of(9, 50), "Science", "Sneha Iyer", "Lab G8", slot);
                lec(school, c8a, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "English", "Vikram Desai", "Room G8-2", slot);
            }
            if (lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c8b.getId(), day, day)
                    .isEmpty()) {
                lec(school, c8b, day, LocalTime.of(11, 0), LocalTime.of(11, 45), "Mathematics", "Rahul Verma", "Room G8B-1", slot);
                lec(school, c8b, day, LocalTime.of(12, 0), LocalTime.of(12, 40), "Social Studies", "Priya Nair", "Room G8B-2", slot);
            }
            if (lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c9b.getId(), day, day)
                    .isEmpty()) {
                lec(school, c9b, day, LocalTime.of(9, 0), LocalTime.of(9, 45), "Mathematics", "Rahul Verma", "Room 9B-1", slot);
                lec(school, c9b, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "English", "Sneha Iyer", "Room 9B-2", slot);
            }
        }
    }

    private void seedAttendanceForClass(
            School school,
            Integer sid,
            ClassGroup cg,
            List<Student> roster,
            LocalDate today,
            Random rnd,
            int daysBack) {
        for (int i = 0; i < daysBack; i++) {
            LocalDate day = today.minusDays(i);
            if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            if (attendanceSessionRepo.findBySchool_IdAndClassGroup_IdAndDateAndLectureIsNull(sid, cg.getId(), day).isPresent()) {
                continue;
            }
            AttendanceSession session = new AttendanceSession();
            session.setSchool(school);
            session.setClassGroup(cg);
            session.setDate(day);
            session.setDedupeKey(AttendanceDedupeKeys.daily(school.getId(), cg.getId(), day));
            session = attendanceSessionRepo.save(session);
            for (Student s : roster) {
                StudentAttendance sa = new StudentAttendance();
                sa.setAttendanceSession(session);
                sa.setStudent(s);
                double p = rnd.nextDouble();
                String status =
                        p < 0.05 ? "EXCUSED" : p < 0.14 ? "ABSENT" : p < 0.20 ? "LATE" : "PRESENT";
                sa.setStatus(status);
                studentAttendanceRepo.save(sa);
            }
        }
    }

    private void upsertMark(School school, Student s, String subj, String key, String title, BigDecimal max, BigDecimal score, LocalDate on) {
        studentMarkRepo
                .findBySchool_IdAndStudent_IdAndAssessmentKey(school.getId(), s.getId(), key + "_" + subj)
                .ifPresentOrElse(
                        x -> {},
                        () -> {
                            StudentMark m = new StudentMark();
                            m.setSchool(school);
                            m.setStudent(s);
                            m.setSubjectCode(subj);
                            m.setAssessmentKey(key + "_" + subj);
                            m.setAssessmentTitle(title);
                            m.setMaxScore(max);
                            m.setScoreObtained(score);
                            m.setAssessedOn(on);
                            m.setTermName("Term 1");
                            studentMarkRepo.save(m);
                        });
    }

    private static BigDecimal bd(int v) {
        return new BigDecimal(v);
    }

    private void lec(
            School school,
            ClassGroup cg,
            LocalDate day,
            LocalTime start,
            LocalTime end,
            String subject,
            String teacher,
            String room,
            int[] slot) {
        Lecture l = new Lecture();
        l.setSchool(school);
        l.setClassGroup(cg);
        l.setDate(day);
        l.setStartTime(start);
        l.setEndTime(end);
        l.setSubject(subject);
        l.setTeacherName(teacher);
        l.setRoom(room + "-" + (++slot[0]));
        lectureRepo.save(l);
    }

    private static ClassGroup cg(School school, String code, String display) {
        ClassGroup c = new ClassGroup();
        c.setSchool(school);
        c.setCode(code);
        c.setDisplayName(display);
        return c;
    }

    private static Student stu(School school, ClassGroup cg, String adm, String fn, String ln, LocalDate dob) {
        Student s = new Student();
        s.setSchool(school);
        s.setClassGroup(cg);
        s.setAdmissionNo(adm);
        s.setFirstName(fn);
        s.setLastName(ln);
        s.setDateOfBirth(dob);
        s.setGender("UNSPECIFIED");
        s.setPhone("9800000000");
        s.setAddress("Greenwood Campus Rd, Demo City");
        s.setPhotoUrl(avatarSeed(adm + "-" + fn));
        return s;
    }

    private static String avatarSeed(String raw) {
        return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + URLEncoder.encode(raw, StandardCharsets.UTF_8);
    }
}
