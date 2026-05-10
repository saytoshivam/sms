package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.StudentLoginCreateResultDTO;
import com.myhaimi.sms.entity.*;
import com.myhaimi.sms.repository.*;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Optional;

/**
 * Handles creation and linking of student login accounts.
 * One User (STUDENT role) is linked to one Student entity via User.linkedStudent.
 * The username is generated from the student's admissionNo.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentLoginService {

    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;
    private final PasswordEncoder passwordEncoder;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";

    /** POST /api/students/{studentId}/create-login */
    @Transactional
    public StudentLoginCreateResultDTO createLogin(Integer studentId) {
        Integer schoolId = requireSchoolId();

        // Validate student belongs to school
        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        // Prevent duplicate: if a user is already linked to this student, return already_exists
        Optional<User> alreadyLinked = userRepo.findFirstByLinkedStudent_Id(studentId);
        if (alreadyLinked.isPresent()) {
            User u = alreadyLinked.get();
            log.info("Student {} already has a linked student user {}", studentId, u.getId());
            return StudentLoginCreateResultDTO.alreadyExists(u.getId(), u.getUsername());
        }

        // Create a new user account with STUDENT role
        School school = schoolRepo.findById(schoolId).orElseThrow();
        Role studentRole = roleRepo.findByName(RoleNames.STUDENT).stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("STUDENT role not seeded."));

        String tempPassword = generateTempPassword();
        String username = buildUsername(student, schoolId);
        String email = buildSyntheticEmail(student, schoolId);

        // Ensure username uniqueness
        String baseUsername = username;
        int suffix = 2;
        while (userRepo.findFirstByUsernameIgnoreCase(username).isPresent()) {
            username = baseUsername + suffix++;
        }

        // Ensure email uniqueness
        String baseEmail = email;
        int emailSuffix = 2;
        while (userRepo.findFirstByEmailIgnoreCase(email).isPresent()) {
            // Insert suffix before the @
            int at = baseEmail.indexOf('@');
            email = baseEmail.substring(0, at) + emailSuffix++ + baseEmail.substring(at);
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setSchool(school);
        user.setLinkedStudent(student);
        user.getRoles().add(studentRole);

        User saved = userRepo.save(user);
        log.info("Created student user {} (username={}) for student {}", saved.getId(), username, studentId);
        return StudentLoginCreateResultDTO.created(saved.getId(), username, tempPassword);
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    /**
     * Build a username from the student's admissionNo.
     * Pattern: student_<admissionNo_cleaned>  e.g. "student_2024001"
     */
    private String buildUsername(Student student, Integer schoolId) {
        String admNo = student.getAdmissionNo().replaceAll("[^A-Za-z0-9]", "").toLowerCase();
        return "stu_" + admNo;
    }

    /**
     * Build a synthetic email so the NOT NULL + unique email constraint is satisfied
     * even when the student doesn't have a personal email on file.
     */
    private String buildSyntheticEmail(Student student, Integer schoolId) {
        String admNo = student.getAdmissionNo().replaceAll("[^A-Za-z0-9]", "").toLowerCase();
        return "student-" + admNo + "@school" + schoolId + ".noemail.sms";
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}

