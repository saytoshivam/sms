package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.entity.enums.StudentAcademicEnrollmentStatus;
import com.myhaimi.sms.theme.AppThemeDefaults;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanRepository;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.service.impl.TimetableSlotService;
import com.myhaimi.sms.utils.AttendanceDedupeKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

/**
 * Rich demo tenant: Greenwood International (school code {@code greenwood-demo}) with users, classes,
 * students, attendance, marks, lectures, guardians, and sample fees. Idempotent — skips if school exists.
 */
@Component
@Order(6000)
@RequiredArgsConstructor
@Slf4j
public class DummySchoolDemoSeeder implements CommandLineRunner {

    public static final String DEMO_SCHOOL_CODE = "greenwood-demo";

    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SubjectRepo subjectRepo;
    private final StaffRepo staffRepo;
    private final StudentRepo studentRepo;
    private final GuardianRepo guardianRepo;
    private final AcademicYearRepo academicYearRepo;
    private final StudentAcademicEnrollmentRepo studentAcademicEnrollmentRepo;
    private final StudentGuardianRepo studentGuardianRepo;
    private final LectureRepo lectureRepo;
    private final AttendanceSessionRepo attendanceSessionRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final StudentMarkRepo studentMarkRepo;
    private final FeeInvoiceRepo feeInvoiceRepo;
    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final PasswordEncoder passwordEncoder;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;
    private final TimetableSlotService timetableSlotService;
    private final GreenwoodLowerGradesPopulator greenwoodLowerGradesPopulator;

    @Value("${sms.seed.demo-school.enabled:true}")
    private boolean demoSchoolEnabled;

    @Value("${sms.seed.demo-school.password:demo123}")
    private String demoPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (!demoSchoolEnabled) {
            return;
        }
        if (schoolRepo.findByCode(DEMO_SCHOOL_CODE).isPresent()) {
            log.info("Demo school '{}' already exists — skipping DummySchoolDemoSeeder.", DEMO_SCHOOL_CODE);
            return;
        }

        School school = new School();
        school.setName("Greenwood International (Demo)");
        school.setCode(DEMO_SCHOOL_CODE);
        school.setPrimaryColor(AppThemeDefaults.PRIMARY);
        school.setAccentColor(AppThemeDefaults.ACCENT);
        school.setBackgroundColor(AppThemeDefaults.BACKGROUND);
        school.setTextColor(AppThemeDefaults.TEXT);
        school.setNavTextColor(AppThemeDefaults.NAV_TEXT);
        school = schoolRepo.save(school);
        Integer sid = school.getId();

        LocalDate todaySeed = LocalDate.now();
        int startY = todaySeed.getMonthValue() >= 4 ? todaySeed.getYear() : todaySeed.getYear() - 1;
        AcademicYear demoYear = new AcademicYear();
        demoYear.setSchool(school);
        demoYear.setLabel(startY + "-" + (startY + 1));
        demoYear.setStartsOn(LocalDate.of(startY, 4, 1));
        demoYear.setEndsOn(LocalDate.of(startY + 1, 3, 31));
        demoYear = academicYearRepo.save(demoYear);

        final ClassGroup c10a = classGroupRepo.save(cg(school, "10-A", "Grade 10 — Section A"));
        final ClassGroup c10b = classGroupRepo.save(cg(school, "10-B", "Grade 10 — Section B"));
        final ClassGroup c9a = classGroupRepo.save(cg(school, "9-A", "Grade 9 — Section A"));
        final ClassGroup c11a = classGroupRepo.save(cg(school, "11-A", "Grade 11 — Science"));

        subjectRepo.save(sub(school, "MAT", "Mathematics"));
        subjectRepo.save(sub(school, "SCI", "Science"));
        subjectRepo.save(sub(school, "ENG", "English"));
        subjectRepo.save(sub(school, "SST", "Social Studies"));
        subjectRepo.save(sub(school, "HIN", "Hindi"));

        Staff principalStaff =
                staffRepo.save(st(school, "EMP001", "Dr. Ananya Rao", "Principal", GreenwoodDemoAccounts.STAFF_PRINCIPAL));
        Staff rahul = staffRepo.save(st(school, "EMP002", "Rahul Verma", "Teacher", GreenwoodDemoAccounts.STAFF_RAHUL));
        Staff sneha = staffRepo.save(st(school, "EMP003", "Sneha Iyer", "Teacher", GreenwoodDemoAccounts.STAFF_SNEHA));
        Staff priya = staffRepo.save(st(school, "EMP004", "Priya Nair", "Teacher", GreenwoodDemoAccounts.STAFF_PRIYA));
        Staff vikram = staffRepo.save(st(school, "EMP005", "Vikram Desai", "Teacher", GreenwoodDemoAccounts.STAFF_VIKRAM));
        Staff librarianStaff =
                staffRepo.save(st(school, "EMP006", "Meera Krishnan", "Librarian", GreenwoodDemoAccounts.STAFF_LIBRARIAN));

        timetableSlotService.seedWeeklyPattern(school, c10a, "Mathematics", rahul, LocalTime.of(8, 30), LocalTime.of(9, 15), "Room 101");
        timetableSlotService.seedWeeklyPattern(school, c10a, "Science", sneha, LocalTime.of(9, 20), LocalTime.of(10, 5), "Lab 1");
        timetableSlotService.seedWeeklyPattern(school, c10a, "Social Studies", vikram, LocalTime.of(11, 10), LocalTime.of(11, 50), "Room 103");
        timetableSlotService.seedWeeklyPattern(school, c10a, "Hindi", priya, LocalTime.of(13, 0), LocalTime.of(13, 40), "Room 105");
        timetableSlotService.seedWeeklyPattern(school, c10b, "English", sneha, LocalTime.of(10, 15), LocalTime.of(11, 0), "Room 204");
        timetableSlotService.seedWeeklyPattern(school, c9a, "Mathematics", rahul, LocalTime.of(8, 0), LocalTime.of(8, 45), "Room G9-1");
        timetableSlotService.seedWeeklyPattern(school, c9a, "Science", priya, LocalTime.of(8, 50), LocalTime.of(9, 35), "Lab G9");
        timetableSlotService.seedWeeklyPattern(school, c11a, "Mathematics", vikram, LocalTime.of(7, 45), LocalTime.of(8, 30), "Room 201");
        timetableSlotService.seedWeeklyPattern(school, c11a, "Science", sneha, LocalTime.of(8, 35), LocalTime.of(9, 20), "Lab 2");

        List<Student> students = new ArrayList<>();
        students.add(stu(school, c10a, "GW2025-001", "Aarav", "Mehta", LocalDate.of(2009, 3, 12)));
        students.add(stu(school, c10a, "GW2025-002", "Diya", "Patel", LocalDate.of(2009, 7, 21)));
        students.add(stu(school, c10a, "GW2025-003", "Kabir", "Singh", LocalDate.of(2008, 11, 2)));
        students.add(stu(school, c10a, "GW2025-004", "Ira", "Nair", LocalDate.of(2009, 1, 30)));
        students.add(stu(school, c10a, "GW2025-005", "Vihaan", "Shah", LocalDate.of(2008, 9, 5)));
        students.add(stu(school, c10b, "GW2025-006", "Mira", "Joshi", LocalDate.of(2009, 5, 18)));
        students.add(stu(school, c10b, "GW2025-007", "Neel", "Kulkarni", LocalDate.of(2008, 12, 9)));
        students.add(stu(school, c9a, "GW2025-008", "Riya", "Chopra", LocalDate.of(2010, 2, 14)));
        students.add(stu(school, c9a, "GW2025-009", "Arjun", "Reddy", LocalDate.of(2010, 6, 3)));
        students.add(stu(school, c9a, "GW2025-010", "Sara", "Khan", LocalDate.of(2009, 10, 20)));
        students.add(stu(school, c11a, "GW2025-011", "Dev", "Malhotra", LocalDate.of(2007, 4, 8)));
        students.add(stu(school, c11a, "GW2025-012", "Ananya", "Sen", LocalDate.of(2007, 8, 1)));
        students = studentRepo.saveAll(students);

        for (Student s : students) {
            Guardian g = new Guardian();
            g.setSchool(school);
            g.setName("Parent of " + s.getFirstName());
            g.setPhone("9" + String.format("%09d", s.getId() * 997 % 1_000_000_000));
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
            en.setAcademicYear(demoYear);
            en.setClassGroup(s.getClassGroup());
            en.setAdmissionDate(LocalDate.now());
            en.setJoiningDate(LocalDate.now());
            en.setStatus(StudentAcademicEnrollmentStatus.ACTIVE);
            studentAcademicEnrollmentRepo.save(en);
        }

        LocalDate today = LocalDate.now();
        int[] slot = {0};
        for (int d = 0; d < 14; d++) {
            LocalDate day = today.plusDays(d);
            if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            lec(school, c10a, day, LocalTime.of(8, 30), LocalTime.of(9, 15), "Mathematics", "Rahul Verma", "Room 101", slot);
            lec(school, c10a, day, LocalTime.of(9, 20), LocalTime.of(10, 5), "Science", "Sneha Iyer", "Lab 1", slot);
            lec(school, c10a, day, LocalTime.of(11, 10), LocalTime.of(11, 50), "Social Studies", "Vikram Desai", "Room 103", slot);
            lec(school, c10a, day, LocalTime.of(13, 0), LocalTime.of(13, 40), "Hindi", "Priya Nair", "Room 105", slot);
            lec(school, c10b, day, LocalTime.of(10, 15), LocalTime.of(11, 0), "English", "Sneha Iyer", "Room 204", slot);
            lec(school, c9a, day, LocalTime.of(8, 0), LocalTime.of(8, 45), "Mathematics", "Rahul Verma", "Room G9-1", slot);
            lec(school, c9a, day, LocalTime.of(8, 50), LocalTime.of(9, 35), "Science", "Priya Nair", "Lab G9", slot);
            lec(school, c9a, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "Social Studies", "Vikram Desai", "Room G9-2", slot);
            lec(school, c11a, day, LocalTime.of(7, 45), LocalTime.of(8, 30), "Mathematics", "Vikram Desai", "Room 201", slot);
            lec(school, c11a, day, LocalTime.of(8, 35), LocalTime.of(9, 20), "Science", "Sneha Iyer", "Lab 2", slot);
        }

        /* Past lectures on the same calendar days as attendance so subject-wise attendance is populated. */
        seedPastWeekdayLectures(school, sid, c10a, c10b, c9a, c11a, today, slot);

        List<Student> classA = students.stream()
                .filter(s -> s.getClassGroup() != null && Objects.equals(s.getClassGroup().getId(), c10a.getId()))
                .toList();
        List<Student> class9 = students.stream()
                .filter(s -> s.getClassGroup() != null && Objects.equals(s.getClassGroup().getId(), c9a.getId()))
                .toList();
        List<Student> class11 = students.stream()
                .filter(s -> s.getClassGroup() != null && Objects.equals(s.getClassGroup().getId(), c11a.getId()))
                .toList();
        List<Student> classB = students.stream()
                .filter(s -> s.getClassGroup() != null && Objects.equals(s.getClassGroup().getId(), c10b.getId()))
                .toList();
        Random rnd = new Random(42);
        seedAttendanceForClass(school, sid, c10a, classA, today, rnd, 52);
        seedAttendanceForClass(school, sid, c10b, classB, today, rnd, 45);
        seedAttendanceForClass(school, sid, c9a, class9, today, rnd, 45);
        seedAttendanceForClass(school, sid, c11a, class11, today, rnd, 40);

        for (Student s : classA) {
            upsertMark(school, s, "MAT", "UNIT1", "Unit test 1", new BigDecimal("20"), bd(16 + rnd.nextInt(4)), today.minusDays(35));
            upsertMark(school, s, "MAT", "UNIT2", "Unit test 2", new BigDecimal("25"), bd(18 + rnd.nextInt(6)), today.minusDays(28));
            upsertMark(school, s, "SCI", "LAB1", "Practical assessment", new BigDecimal("30"), bd(22 + rnd.nextInt(7)), today.minusDays(22));
            upsertMark(school, s, "SCI", "MID", "Mid-term", new BigDecimal("40"), bd(28 + rnd.nextInt(10)), today.minusDays(14));
            upsertMark(school, s, "ENG", "ORAL", "Oral & comprehension", new BigDecimal("20"), bd(14 + rnd.nextInt(5)), today.minusDays(10));
            upsertMark(school, s, "ENG", "FINAL", "Term paper", new BigDecimal("50"), bd(38 + rnd.nextInt(10)), today.minusDays(3));
            upsertMark(school, s, "MAT", "QUIZ1", "Quick quiz", new BigDecimal("10"), bd(7 + rnd.nextInt(3)), today.minusDays(40));
            upsertMark(school, s, "SCI", "PRACT2", "Second practical", new BigDecimal("25"), bd(19 + rnd.nextInt(5)), today.minusDays(8));
            upsertMark(school, s, "SST", "MAP", "Map skills test", new BigDecimal("15"), bd(11 + rnd.nextInt(3)), today.minusDays(18));
            upsertMark(school, s, "HIN", "SPELL", "Spelling test", new BigDecimal("20"), bd(15 + rnd.nextInt(4)), today.minusDays(12));
        }

        for (Student s : class9) {
            upsertMark(school, s, "MAT", "U1", "Unit 1", new BigDecimal("20"), bd(14 + rnd.nextInt(5)), today.minusDays(20));
            upsertMark(school, s, "SCI", "LABA", "Lab A", new BigDecimal("15"), bd(11 + rnd.nextInt(4)), today.minusDays(15));
            upsertMark(school, s, "SST", "CIV", "Civics quiz", new BigDecimal("10"), bd(7 + rnd.nextInt(3)), today.minusDays(9));
        }
        for (Student s : class11) {
            upsertMark(school, s, "MAT", "MOCK", "Board mock", new BigDecimal("80"), bd(58 + rnd.nextInt(15)), today.minusDays(6));
            upsertMark(school, s, "SCI", "PRACX", "Practical exam", new BigDecimal("40"), bd(30 + rnd.nextInt(8)), today.minusDays(11));
        }

        for (int i = 0; i < 3; i++) {
            Student s = classA.get(i);
            FeeInvoice inv = new FeeInvoice();
            inv.setSchool(school);
            inv.setStudent(s);
            inv.setAmountDue(new BigDecimal("45000.00"));
            inv.setDueDate(today.plusMonths(1));
            inv.setStatus("PARTIAL");
            inv = feeInvoiceRepo.save(inv);
        }

        Role rAdmin = roleRepo.findByName("SCHOOL_ADMIN").stream().findFirst().orElseThrow();
        Role rPrincipal = roleRepo.findByName("PRINCIPAL").stream().findFirst().orElseThrow();
        Role rTeacher = roleRepo.findByName("TEACHER").stream().findFirst().orElseThrow();
        Role rLibrarian = roleRepo.findByName("LIBRARIAN").stream().findFirst().orElseThrow();
        Role rStudent = roleRepo.findByName("STUDENT").stream().findFirst().orElseThrow();
        Role rParent = roleRepo.findByName("PARENT").stream().findFirst().orElseThrow();

        String enc = passwordEncoder.encode(demoPassword);
        userRepo.save(user("schooladmin", GreenwoodDemoAccounts.SCHOOL_ADMIN, enc, school, Set.of(rAdmin)));
        userRepo.save(user("schoolowner", GreenwoodDemoAccounts.SCHOOL_OWNER, enc, school, Set.of(rAdmin)));

        User principalUser = user("principal", GreenwoodDemoAccounts.PRINCIPAL, enc, school, Set.of(rPrincipal));
        principalUser.setLinkedStaff(principalStaff);
        userRepo.save(principalUser);

        User t1 = user("teacher1", GreenwoodDemoAccounts.TEACHER1, enc, school, Set.of(rTeacher));
        t1.setLinkedStaff(rahul);
        userRepo.save(t1);
        User t2 = user("teacher2", GreenwoodDemoAccounts.TEACHER2, enc, school, Set.of(rTeacher));
        t2.setLinkedStaff(sneha);
        userRepo.save(t2);

        User libUser = user("librarian", GreenwoodDemoAccounts.LIBRARIAN, enc, school, Set.of(rLibrarian));
        libUser.setLinkedStaff(librarianStaff);
        userRepo.save(libUser);

        for (int i = 0; i < 5 && i < classA.size(); i++) {
            Student st = classA.get(i);
            User u = user("student" + (i + 1), GreenwoodDemoAccounts.studentEmail(i + 1), enc, school, Set.of(rStudent));
            u.setLinkedStudent(st);
            userRepo.save(u);
        }

        User parent = user("parent1", GreenwoodDemoAccounts.PARENT1, enc, school, Set.of(rParent));
        userRepo.save(parent);

        SubscriptionPlan premium =
                subscriptionPlanRepository.findByPlanCodeIgnoreCase("PREMIUM").orElse(null);
        if (premium != null) {
            TenantSubscription sub = tenantSubscriptionRepository.findByTenantId(sid).orElseGet(TenantSubscription::new);
            sub.setTenantId(sid);
            sub.setPlan(premium);
            sub.setStatus(SubscriptionStatus.ACTIVE);
            sub.setStartsAt(java.time.Instant.now());
            tenantSubscriptionRepository.save(sub);
        }

        greenwoodLowerGradesPopulator.populateIfMissing(school, today, slot, rnd, rahul, sneha, priya, vikram, enc, rStudent);

        log.info(
                """
                        === Greenwood demo tenant ready ===
                        School code (login branding): {}
                        Password for all demo users: {}
                        Logins: superadmin@myhaimi.com (platform SUPER_ADMIN, separate seed), schooladmin@ / schoolowner@ (SCHOOL_ADMIN), principal@ (PRINCIPAL), \
                        teacher1@ / teacher2@ (TEACHER), librarian@ (LIBRARIAN), student1@..student5@ (STUDENT), grade8@ (Grade 8 — Karan), parent1@ (PARENT)
                        """,
                DEMO_SCHOOL_CODE,
                demoPassword);
    }

    /**
     * One-off lectures on past weekdays so they align with {@link #seedAttendanceForClass} (same dates) and the
     * student portal can compute subject-wise attendance.
     */
    private void seedPastWeekdayLectures(
            School school,
            int sid,
            ClassGroup c10a,
            ClassGroup c10b,
            ClassGroup c9a,
            ClassGroup c11a,
            LocalDate today,
            int[] slot) {
        for (int i = 1; i <= 60; i++) {
            LocalDate day = today.minusDays(i);
            if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            if (lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c10a.getId(), day, day)
                    .isEmpty()) {
                lec(school, c10a, day, LocalTime.of(8, 30), LocalTime.of(9, 15), "Mathematics", "Rahul Verma", "Room 101", slot);
                lec(school, c10a, day, LocalTime.of(9, 20), LocalTime.of(10, 5), "Science", "Sneha Iyer", "Lab 1", slot);
                lec(school, c10a, day, LocalTime.of(11, 10), LocalTime.of(11, 50), "Social Studies", "Vikram Desai", "Room 103", slot);
                lec(school, c10a, day, LocalTime.of(13, 0), LocalTime.of(13, 40), "Hindi", "Priya Nair", "Room 105", slot);
            }
            if (lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c10b.getId(), day, day)
                    .isEmpty()) {
                lec(school, c10b, day, LocalTime.of(10, 15), LocalTime.of(11, 0), "English", "Sneha Iyer", "Room 204", slot);
            }
            if (lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c9a.getId(), day, day)
                    .isEmpty()) {
                lec(school, c9a, day, LocalTime.of(8, 0), LocalTime.of(8, 45), "Mathematics", "Rahul Verma", "Room G9-1", slot);
                lec(school, c9a, day, LocalTime.of(8, 50), LocalTime.of(9, 35), "Science", "Priya Nair", "Lab G9", slot);
                lec(school, c9a, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "Social Studies", "Vikram Desai", "Room G9-2", slot);
            }
            if (lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c11a.getId(), day, day)
                    .isEmpty()) {
                lec(school, c11a, day, LocalTime.of(7, 45), LocalTime.of(8, 30), "Mathematics", "Vikram Desai", "Room 201", slot);
                lec(school, c11a, day, LocalTime.of(8, 35), LocalTime.of(9, 20), "Science", "Sneha Iyer", "Lab 2", slot);
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

    private static String avatarSeed(String raw) {
        return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + URLEncoder.encode(raw, StandardCharsets.UTF_8);
    }

    private static BigDecimal bd(int v) {
        return new BigDecimal(v);
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

    private static User user(String username, String email, String enc, School school, Set<Role> roles) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPassword(enc);
        u.setSchool(school);
        u.setRoles(new HashSet<>(roles));
        return u;
    }

    private static ClassGroup cg(School school, String code, String display) {
        ClassGroup c = new ClassGroup();
        c.setSchool(school);
        c.setCode(code);
        c.setDisplayName(display);
        return c;
    }

    private static Subject sub(School school, String code, String name) {
        Subject s = new Subject();
        s.setSchool(school);
        s.setCode(code);
        s.setName(name);
        return s;
    }

    private static Staff st(School school, String emp, String name, String designation, String email) {
        Staff s = new Staff();
        s.setSchool(school);
        s.setEmployeeNo(emp);
        s.setFullName(name);
        s.setDesignation(designation);
        s.setEmail(email);
        s.setPhone("9876543210");
        s.setPhotoUrl(avatarSeed(emp + "-" + name));
        return s;
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
}
