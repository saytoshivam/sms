package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.ParentLoginCreateResultDTO;
import com.myhaimi.sms.DTO.StudentViewDTO;
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
import java.util.List;
import java.util.Optional;

/**
 * Handles creation and linking of parent/guardian login accounts.
 * One User (PARENT role) is linked to one Guardian entity.
 * That Guardian may be the guardian of multiple students via StudentGuardian.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentLoginService {

    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;
    private final GuardianRepo guardianRepo;
    private final StudentGuardianRepo studentGuardianRepo;
    private final PasswordEncoder passwordEncoder;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";

    /** POST /api/students/{studentId}/guardians/{guardianId}/create-login */
    @Transactional
    public ParentLoginCreateResultDTO createOrLink(Integer studentId, Integer guardianId) {
        Integer schoolId = requireSchoolId();

        // Validate student belongs to school
        Student student = studentRepo.findByIdAndSchool_Id(studentId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found."));

        // Validate guardian belongs to school
        Guardian guardian = guardianRepo.findById(guardianId)
                .filter(g -> g.getSchool() != null && schoolId.equals(g.getSchool().getId()))
                .orElseThrow(() -> new IllegalArgumentException("Guardian not found."));

        // Validate guardian is linked to this student
        studentGuardianRepo.findByStudent_IdAndGuardian_Id(studentId, guardianId)
                .orElseThrow(() -> new IllegalArgumentException("Guardian is not linked to this student."));

        // 1. If a user is already linked to this guardian, return linked result
        Optional<User> alreadyLinked = userRepo.findFirstByLinkedGuardian_Id(guardianId);
        if (alreadyLinked.isPresent()) {
            User u = alreadyLinked.get();
            log.info("Guardian {} already has a linked parent user {}", guardianId, u.getId());
            return ParentLoginCreateResultDTO.linked(u.getId(), u.getUsername());
        }

        // 2. Try to find existing user by guardian email or phone
        if (guardian.getEmail() != null && !guardian.getEmail().isBlank()) {
            Optional<User> byEmail = userRepo.findFirstByEmailIgnoreCase(guardian.getEmail().trim());
            if (byEmail.isPresent()) {
                User u = byEmail.get();
                boolean isParent = u.getRoles().stream().anyMatch(r -> RoleNames.PARENT.equals(r.getName()));
                if (isParent) {
                    u.setLinkedGuardian(guardian);
                    userRepo.save(u);
                    updateCanLogin(studentId, guardianId);
                    log.info("Linked existing parent user {} to guardian {}", u.getId(), guardianId);
                    return ParentLoginCreateResultDTO.linked(u.getId(), u.getUsername());
                }
            }
        }

        // 3. Create a new user account with PARENT role
        School school = schoolRepo.findById(schoolId).orElseThrow();
        Role parentRole = roleRepo.findByName(RoleNames.PARENT).stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("PARENT role not seeded."));

        String tempPassword = generateTempPassword();
        String username = buildUsername(guardian, schoolId);
        String email = resolveEmail(guardian, schoolId);

        // Ensure username uniqueness
        String baseUsername = username;
        int suffix = 2;
        while (userRepo.findFirstByUsernameIgnoreCase(username).isPresent()) {
            username = baseUsername + suffix++;
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setSchool(school);
        user.setLinkedGuardian(guardian);
        user.getRoles().add(parentRole);

        User saved = userRepo.save(user);
        updateCanLogin(studentId, guardianId);

        log.info("Created parent user {} (username={}) for guardian {}", saved.getId(), username, guardianId);
        return ParentLoginCreateResultDTO.created(saved.getId(), username, tempPassword);
    }

    /** GET /api/parents/{parentUserId}/linked-students */
    @Transactional(readOnly = true)
    public List<Student> getLinkedStudents(Integer parentUserId) {
        Integer schoolId = requireSchoolId();
        User user = userRepo.findByIdWithSchool(parentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Parent user not found."));

        // Must belong to the same school
        if (user.getSchool() == null || !schoolId.equals(user.getSchool().getId())) {
            throw new IllegalArgumentException("Parent user not found.");
        }

        Guardian guardian = user.getLinkedGuardian();
        if (guardian == null) return List.of();

        return studentGuardianRepo.findByGuardian_Id(guardian.getId())
                .stream()
                .map(StudentGuardian::getStudent)
                .toList();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void updateCanLogin(Integer studentId, Integer guardianId) {
        studentGuardianRepo.findByStudent_IdAndGuardian_Id(studentId, guardianId)
                .ifPresent(sg -> {
                    if (!sg.isCanLogin()) {
                        sg.setCanLogin(true);
                        studentGuardianRepo.save(sg);
                    }
                });
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private String buildUsername(Guardian g, Integer schoolId) {
        if (g.getEmail() != null && !g.getEmail().isBlank()) {
            return g.getEmail().trim().toLowerCase();
        }
        // phone-based username: parent_<phone>
        String phone = g.getPhone().replaceAll("[^0-9]", "");
        return "parent_" + phone;
    }

    private String resolveEmail(Guardian g, Integer schoolId) {
        if (g.getEmail() != null && !g.getEmail().isBlank()) {
            return g.getEmail().trim().toLowerCase();
        }
        // Synthetic email to satisfy NOT NULL + unique constraint
        String phone = g.getPhone().replaceAll("[^0-9]", "");
        return "parent-" + phone + "@school" + schoolId + ".noemail.sms";
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}

