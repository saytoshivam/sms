package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.TimetableSlotRepo;
import com.myhaimi.sms.service.impl.TimetableSlotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;

/**
 * Idempotent extra Mon–Fri recurring slots for Greenwood demo so “today’s timetable” usually has several rows
 * (weekdays), including afternoon blocks that do not overlap the morning core subjects.
 * <p>Runs after {@link GreenwoodDemoAugmentRunner} so Grade 8 classes from backfill exist on first run.
 */
@Component
@Order(6150)
@RequiredArgsConstructor
@Slf4j
public class GreenwoodExtraTimetableRunner implements CommandLineRunner {

    private final SchoolRepo schoolRepo;
    private final ClassGroupRepo classGroupRepo;
    private final StaffRepo staffRepo;
    private final TimetableSlotRepo timetableSlotRepo;
    private final TimetableSlotService timetableSlotService;

    @Override
    @Transactional
    public void run(String... args) {
        schoolRepo.findByCode(DummySchoolDemoSeeder.DEMO_SCHOOL_CODE).ifPresent(this::ensureExtraSlots);
    }

    private void ensureExtraSlots(School school) {
        int sid = school.getId();
        Staff sneha = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(sid, GreenwoodDemoAccounts.STAFF_SNEHA).orElse(null);
        Staff rahul = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(sid, GreenwoodDemoAccounts.STAFF_RAHUL).orElse(null);
        Staff priya = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(sid, GreenwoodDemoAccounts.STAFF_PRIYA).orElse(null);
        if (sneha == null || rahul == null || priya == null) {
            return;
        }
        int added = 0;
        added += addWeeklyIfMissing(school, "10-A", sneha, "Library & Reading", LocalTime.of(14, 0), LocalTime.of(14, 40), "Room 101");
        added += addWeeklyIfMissing(school, "10-A", rahul, "Sports / Games", LocalTime.of(15, 10), LocalTime.of(15, 50), "Sports Ground");
        added += addWeeklyIfMissing(school, "8-A", sneha, "Computer Lab", LocalTime.of(13, 30), LocalTime.of(14, 10), "Lab G8-C");
        added += addWeeklyIfMissing(school, "8-A", priya, "Art & Craft", LocalTime.of(14, 20), LocalTime.of(15, 0), "Room G8-Art");
        added += addWeeklyIfMissing(school, "10-B", sneha, "Life Skills", LocalTime.of(14, 5), LocalTime.of(14, 35), "Room 204");
        if (added > 0) {
            log.info("Greenwood extra timetable: added {} recurring slot group(s).", added);
        }
    }

    private int addWeeklyIfMissing(
            School school, String classCode, Staff staff, String subject, LocalTime start, LocalTime end, String room) {
        ClassGroup cg = classGroupRepo.findByCodeAndSchool_Id(classCode, school.getId()).orElse(null);
        if (cg == null) {
            return 0;
        }
        if (timetableSlotRepo.existsBySchool_IdAndClassGroup_IdAndSubjectAndActiveIsTrue(school.getId(), cg.getId(), subject)) {
            return 0;
        }
        timetableSlotService.seedWeeklyPattern(school, cg, subject, staff, start, end, room);
        return 1;
    }
}
