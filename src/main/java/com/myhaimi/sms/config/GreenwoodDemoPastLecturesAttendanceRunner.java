package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.utils.AttendanceDedupeKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Random;

/**
 * For existing Greenwood demo DBs: past one-off lectures were only seeded in the future while attendance was in the
 * past, so subject-wise attendance stayed empty. This runner idempotently adds past weekday lectures (matching demo
 * timetables) and attendance sessions/marks for the current academic year window, until enough rows exist.
 */
@Component
@Order(6200)
@RequiredArgsConstructor
@Slf4j
public class GreenwoodDemoPastLecturesAttendanceRunner implements CommandLineRunner {

    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final LectureRepo lectureRepo;
    private final AttendanceSessionRepo attendanceSessionRepo;
    private final StudentAttendanceRepo studentAttendanceRepo;
    private final StudentRepo studentRepo;

    @Override
    @Transactional
    public void run(String... args) {
        schoolRepo.findByCode(DummySchoolDemoSeeder.DEMO_SCHOOL_CODE).ifPresent(this::backfillIfNeeded);
    }

    private void backfillIfNeeded(School school) {
        int sid = school.getId();
        LocalDate today = LocalDate.now();
        LocalDate termStart = academicYearStart(today);
        LocalDate from = termStart.isAfter(today.minusDays(110)) ? termStart : today.minusDays(110);

        var c10a = classGroupRepo.findByCodeAndSchool_Id("10-A", sid).orElse(null);
        if (c10a == null) {
            return;
        }
        int existingPastLecs =
                lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, c10a.getId(), from, today)
                        .size();
        if (existingPastLecs >= 120) {
            return;
        }

        int[] slot = {9000};
        Random rnd = new Random(20250417);
        int lecAdded = 0;
        int sessAdded = 0;

        for (LocalDate d = from; !d.isAfter(today); d = d.plusDays(1)) {
            if (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            var o10a = classGroupRepo.findByCodeAndSchool_Id("10-A", sid);
            if (o10a.isPresent()) {
                lecAdded += seedLectures10A(school, sid, o10a.get(), d, slot);
            }
            var o10b = classGroupRepo.findByCodeAndSchool_Id("10-B", sid);
            if (o10b.isPresent()) {
                lecAdded += seedLectures10B(school, sid, o10b.get(), d, slot);
            }
            var o9a = classGroupRepo.findByCodeAndSchool_Id("9-A", sid);
            if (o9a.isPresent()) {
                lecAdded += seedLectures9A(school, sid, o9a.get(), d, slot);
            }
            var o11a = classGroupRepo.findByCodeAndSchool_Id("11-A", sid);
            if (o11a.isPresent()) {
                lecAdded += seedLectures11A(school, sid, o11a.get(), d, slot);
            }
            var o8a = classGroupRepo.findByCodeAndSchool_Id("8-A", sid);
            if (o8a.isPresent()) {
                lecAdded += seedLectures8A(school, sid, o8a.get(), d, slot);
            }
            var o8b = classGroupRepo.findByCodeAndSchool_Id("8-B", sid);
            if (o8b.isPresent()) {
                lecAdded += seedLectures8B(school, sid, o8b.get(), d, slot);
            }
            var o9b = classGroupRepo.findByCodeAndSchool_Id("9-B", sid);
            if (o9b.isPresent()) {
                lecAdded += seedLectures9B(school, sid, o9b.get(), d, slot);
            }

            sessAdded += ensureAttendanceForDate(school, sid, "10-A", d, rnd);
            sessAdded += ensureAttendanceForDate(school, sid, "10-B", d, rnd);
            sessAdded += ensureAttendanceForDate(school, sid, "9-A", d, rnd);
            sessAdded += ensureAttendanceForDate(school, sid, "11-A", d, rnd);
            sessAdded += ensureAttendanceForDate(school, sid, "8-A", d, rnd);
            sessAdded += ensureAttendanceForDate(school, sid, "8-B", d, rnd);
            sessAdded += ensureAttendanceForDate(school, sid, "9-B", d, rnd);
        }

        if (lecAdded > 0 || sessAdded > 0) {
            log.info(
                    "Greenwood demo past attendance augment: added ~{} past lecture row(s), ~{} attendance session(s)/marks.",
                    lecAdded,
                    sessAdded);
        }
    }

    private int ensureAttendanceForDate(School school, int sid, String classCode, LocalDate d, Random rnd) {
        ClassGroup cg = classGroupRepo.findByCodeAndSchool_Id(classCode, sid).orElse(null);
        if (cg == null) {
            return 0;
        }
        if (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return 0;
        }
        List<Student> roster =
                studentRepo.findBySchool_IdOrderByIdAsc(sid).stream()
                        .filter(s -> s.getClassGroup() != null && cg.getId().equals(s.getClassGroup().getId()))
                        .toList();
        if (roster.isEmpty()) {
            return 0;
        }
        if (attendanceSessionRepo.findBySchool_IdAndClassGroup_IdAndDateAndLectureIsNull(sid, cg.getId(), d).isPresent()) {
            return 0;
        }
        AttendanceSession session = new AttendanceSession();
        session.setSchool(school);
        session.setClassGroup(cg);
        session.setDate(d);
        session.setDedupeKey(AttendanceDedupeKeys.daily(school.getId(), cg.getId(), d));
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
        return 1;
    }

    private static LocalDate academicYearStart(LocalDate d) {
        return d.getMonthValue() >= 4 ? LocalDate.of(d.getYear(), 4, 1) : LocalDate.of(d.getYear() - 1, 4, 1);
    }

    private int seedLectures10A(School school, int sid, ClassGroup cg, LocalDate day, int[] slot) {
        if (!lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, cg.getId(), day, day)
                .isEmpty()) {
            return 0;
        }
        lec(school, cg, day, LocalTime.of(8, 30), LocalTime.of(9, 15), "Mathematics", "Rahul Verma", "Room 101", slot);
        lec(school, cg, day, LocalTime.of(9, 20), LocalTime.of(10, 5), "Science", "Sneha Iyer", "Lab 1", slot);
        lec(school, cg, day, LocalTime.of(11, 10), LocalTime.of(11, 50), "Social Studies", "Vikram Desai", "Room 103", slot);
        lec(school, cg, day, LocalTime.of(13, 0), LocalTime.of(13, 40), "Hindi", "Priya Nair", "Room 105", slot);
        return 4;
    }

    private int seedLectures10B(School school, int sid, ClassGroup cg, LocalDate day, int[] slot) {
        if (!lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, cg.getId(), day, day)
                .isEmpty()) {
            return 0;
        }
        lec(school, cg, day, LocalTime.of(10, 15), LocalTime.of(11, 0), "English", "Sneha Iyer", "Room 204", slot);
        return 1;
    }

    private int seedLectures9A(School school, int sid, ClassGroup cg, LocalDate day, int[] slot) {
        if (!lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, cg.getId(), day, day)
                .isEmpty()) {
            return 0;
        }
        lec(school, cg, day, LocalTime.of(8, 0), LocalTime.of(8, 45), "Mathematics", "Rahul Verma", "Room G9-1", slot);
        lec(school, cg, day, LocalTime.of(8, 50), LocalTime.of(9, 35), "Science", "Priya Nair", "Lab G9", slot);
        lec(school, cg, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "Social Studies", "Vikram Desai", "Room G9-2", slot);
        return 3;
    }

    private int seedLectures11A(School school, int sid, ClassGroup cg, LocalDate day, int[] slot) {
        if (!lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, cg.getId(), day, day)
                .isEmpty()) {
            return 0;
        }
        lec(school, cg, day, LocalTime.of(7, 45), LocalTime.of(8, 30), "Mathematics", "Vikram Desai", "Room 201", slot);
        lec(school, cg, day, LocalTime.of(8, 35), LocalTime.of(9, 20), "Science", "Sneha Iyer", "Lab 2", slot);
        return 2;
    }

    private int seedLectures8A(School school, int sid, ClassGroup cg, LocalDate day, int[] slot) {
        if (!lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, cg.getId(), day, day)
                .isEmpty()) {
            return 0;
        }
        lec(school, cg, day, LocalTime.of(8, 15), LocalTime.of(9, 0), "Mathematics", "Priya Nair", "Room G8-1", slot);
        lec(school, cg, day, LocalTime.of(9, 5), LocalTime.of(9, 50), "Science", "Sneha Iyer", "Lab G8", slot);
        lec(school, cg, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "English", "Vikram Desai", "Room G8-2", slot);
        return 3;
    }

    private int seedLectures8B(School school, int sid, ClassGroup cg, LocalDate day, int[] slot) {
        if (!lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, cg.getId(), day, day)
                .isEmpty()) {
            return 0;
        }
        lec(school, cg, day, LocalTime.of(11, 0), LocalTime.of(11, 45), "Mathematics", "Rahul Verma", "Room G8B-1", slot);
        lec(school, cg, day, LocalTime.of(12, 0), LocalTime.of(12, 40), "Social Studies", "Priya Nair", "Room G8B-2", slot);
        return 2;
    }

    private int seedLectures9B(School school, int sid, ClassGroup cg, LocalDate day, int[] slot) {
        if (!lectureRepo.findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(sid, cg.getId(), day, day)
                .isEmpty()) {
            return 0;
        }
        lec(school, cg, day, LocalTime.of(9, 0), LocalTime.of(9, 45), "Mathematics", "Rahul Verma", "Room 9B-1", slot);
        lec(school, cg, day, LocalTime.of(10, 0), LocalTime.of(10, 40), "English", "Sneha Iyer", "Room 9B-2", slot);
        return 2;
    }

    private void lec(School school, ClassGroup cg, LocalDate day, LocalTime start, LocalTime end, String subject, String teacher, String room, int[] slot) {
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
}
