package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.AnnouncementRepo;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Adds sample announcements to the Greenwood demo tenant when the school exists but announcements are empty.
 */
@Component
@Order(6050)
@RequiredArgsConstructor
@Slf4j
public class DemoAnnouncementSeeder implements CommandLineRunner {

    private final SchoolRepo schoolRepo;
    private final UserRepo userRepo;
    private final ClassGroupRepo classGroupRepo;
    private final AnnouncementRepo announcementRepo;

    @Override
    @Transactional
    public void run(String... args) {
        School school = schoolRepo.findByCode(DummySchoolDemoSeeder.DEMO_SCHOOL_CODE).orElse(null);
        if (school == null) {
            return;
        }
        boolean initialPack = announcementRepo.countBySchool_Id(school.getId()) == 0;

        User admin = userRepo.findFirstByEmailIgnoreCase(GreenwoodDemoAccounts.SCHOOL_ADMIN).orElse(null);
        User teacher = userRepo.findFirstByEmailIgnoreCase(GreenwoodDemoAccounts.TEACHER1).orElse(null);
        ClassGroup c10a = classGroupRepo.findByCodeAndSchool_Id("10-A", school.getId()).orElse(null);

        if (initialPack && admin != null) {
            Announcement a = new Announcement();
            a.setSchool(school);
            a.setAuthor(admin);
            a.setCategory(AnnouncementCategory.ACADEMIC);
            a.setTitle("Last date to clear the next term fee — May 31st, 2026");
            a.setBody(
                    "Please ensure fee instalments are cleared before the deadline to avoid late penalties. "
                            + "Contact the accounts office for instalment plans.");
            a.setAudience(AnnouncementAudience.SCHOOL_WIDE);
            a.setReferenceCode("(pending)");
            a = announcementRepo.save(a);
            a.setReferenceCode(refCode(school, a.getId()));
            announcementRepo.save(a);
        }

        if (initialPack && teacher != null && c10a != null && teacher.getLinkedStaff() != null) {
            Announcement t = new Announcement();
            t.setSchool(school);
            t.setAuthor(teacher);
            t.setCategory(AnnouncementCategory.PLACEMENT);
            t.setTitle("Apply now: summer internship briefing (Grade 10-A)");
            t.setBody(
                    "Students in 10-A: we will run a short briefing during homeroom next week. "
                            + "Bring your updated résumé draft if you have one.");
            t.setAudience(AnnouncementAudience.CLASS_TARGETS);
            t.setReferenceCode("(pending)");
            t = announcementRepo.save(t);
            AnnouncementTargetClass at = new AnnouncementTargetClass();
            at.setAnnouncement(t);
            at.setClassGroup(c10a);
            t.getTargetClasses().add(at);
            t.setReferenceCode(refCode(school, t.getId()));
            announcementRepo.save(t);
        }

        /* Idempotent extras: add when we ship new school-scoped features so existing DBs pick up demo rows. */
        if (admin != null
                && !announcementRepo.existsBySchool_IdAndTitle(
                        school.getId(), "Sports day & annual awards — Fri (demo data)")) {
            Announcement sports = new Announcement();
            sports.setSchool(school);
            sports.setAuthor(admin);
            sports.setCategory(AnnouncementCategory.ACADEMIC);
            sports.setTitle("Sports day & annual awards — Fri (demo data)");
            sports.setBody(
                    "Demo announcement for the school-wide feed. House colours: wear your house T-shirt. "
                            + "Schedule: track events 8:00–11:00, lunch, then finals.");
            sports.setAudience(AnnouncementAudience.SCHOOL_WIDE);
            sports.setReferenceCode("(pending)");
            sports = announcementRepo.save(sports);
            sports.setReferenceCode(refCode(school, sports.getId()));
            announcementRepo.save(sports);
            log.info("Seeded extra demo announcement (sports day) for {}", DummySchoolDemoSeeder.DEMO_SCHOOL_CODE);
        }

        if (initialPack) {
            log.info("Demo announcements seeded for {}", DummySchoolDemoSeeder.DEMO_SCHOOL_CODE);
        }
    }

    private static String refCode(School school, int id) {
        String day = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        return String.format("(%s/ANN/%s/%06d)", school.getCode().toUpperCase(Locale.ROOT), day, id);
    }
}
