package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.entity.Student;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Random;

/**
 * For existing Greenwood demo tenants: backfills avatars and (if missing) Grade 8 / 9-B classes and demo student
 * {@link GreenwoodDemoAccounts#GRADE8}.
 */
@Component
@Order(6100)
@RequiredArgsConstructor
@Slf4j
public class GreenwoodDemoAugmentRunner implements CommandLineRunner {

    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;
    private final StaffRepo staffRepo;
    private final GreenwoodLowerGradesPopulator greenwoodLowerGradesPopulator;
    private final RoleRepo roleRepo;
    private final PasswordEncoder passwordEncoder;

    @Value("${sms.seed.demo-school.password:demo123}")
    private String demoPassword;

    @Override
    @Transactional
    public void run(String... args) {
        schoolRepo.findByCode(DummySchoolDemoSeeder.DEMO_SCHOOL_CODE).ifPresent(this::augment);
    }

    private void augment(School school) {
        backfillPhotos(school);
        Integer sid = school.getId();
        Staff rahul = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(sid, GreenwoodDemoAccounts.STAFF_RAHUL).orElse(null);
        Staff sneha = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(sid, GreenwoodDemoAccounts.STAFF_SNEHA).orElse(null);
        Staff priya = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(sid, GreenwoodDemoAccounts.STAFF_PRIYA).orElse(null);
        Staff vikram = staffRepo.findFirstBySchool_IdAndEmailIgnoreCase(sid, GreenwoodDemoAccounts.STAFF_VIKRAM).orElse(null);
        if (rahul == null || sneha == null || priya == null || vikram == null) {
            log.warn("Greenwood augment: expected demo staff not found; skip lower-grade population.");
            return;
        }
        Role rStudent = roleRepo.findByName("STUDENT").stream().findFirst().orElse(null);
        if (rStudent == null) {
            return;
        }
        String enc = passwordEncoder.encode(demoPassword);
        greenwoodLowerGradesPopulator.populateIfMissing(
                school, LocalDate.now(), new int[] {9000}, new Random(91), rahul, sneha, priya, vikram, enc, rStudent);
    }

    private void backfillPhotos(School school) {
        int sid = school.getId();
        int n = 0;
        for (Student s : studentRepo.findBySchool_IdOrderByIdAsc(sid)) {
            if (s.getPhotoUrl() == null || s.getPhotoUrl().isBlank()) {
                s.setPhotoUrl(avatarSeed(s.getAdmissionNo() + "-" + s.getFirstName()));
                studentRepo.save(s);
                n++;
            }
        }
        for (Staff st : staffRepo.findBySchool_IdOrderByEmployeeNoAsc(sid)) {
            if (st.getPhotoUrl() == null || st.getPhotoUrl().isBlank()) {
                st.setPhotoUrl(avatarSeed(st.getEmployeeNo() + "-" + st.getFullName()));
                staffRepo.save(st);
                n++;
            }
        }
        if (n > 0) {
            log.info("Greenwood augment: updated {} student/staff photo URLs.", n);
        }
    }

    private static String avatarSeed(String raw) {
        return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + URLEncoder.encode(raw, StandardCharsets.UTF_8);
    }
}
