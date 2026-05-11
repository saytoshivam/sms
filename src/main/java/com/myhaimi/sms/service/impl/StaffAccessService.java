package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.staff.StaffAccessResultDTO;
import com.myhaimi.sms.DTO.staff.StaffCreateLoginDTO;
import com.myhaimi.sms.DTO.staff.StaffLinkUserDTO;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages the full login access lifecycle for a staff member:
 * create, link, invite, reset-password, disable, enable.
 *
 * Access control (role guards) are enforced at the controller layer with
 * {@code @PreAuthorize}; this service assumes the caller is authorised.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StaffAccessService {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final StaffRepo      staffRepo;
    private final UserRepo       userRepo;
    private final RoleRepo       roleRepo;
    private final SchoolRepo     schoolRepo;
    private final PasswordEncoder passwordEncoder;

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context");
        return id;
    }

    private Staff requireStaff(Integer staffId, Integer schoolId) {
        return staffRepo.findByIdAndSchool_IdAndIsDeletedFalse(staffId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("Staff member not found."));
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) sb.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
        return sb.toString();
    }

    private String deriveUsername(String email) {
        return email.split("@")[0].replaceAll("[^a-zA-Z0-9._-]", "").toLowerCase(Locale.ROOT);
    }

    private String ensureUniqueUsername(String base) {
        String candidate = base;
        int attempt = 0;
        while (userRepo.findFirstByUsernameIgnoreCase(candidate).isPresent()) {
            candidate = base + (++attempt);
        }
        return candidate;
    }

    private Set<Role> resolveRoles(List<String> roleNames) {
        Set<Role> set = new HashSet<>();
        if (roleNames == null || roleNames.isEmpty()) return set;
        for (String name : roleNames) {
            if (name == null || name.isBlank()) continue;
            String up = name.trim().toUpperCase(Locale.ROOT);
            if (RoleNames.SUPER_ADMIN.equals(up) || RoleNames.STUDENT.equals(up) || RoleNames.PARENT.equals(up))
                throw new IllegalArgumentException("Role not permitted for staff: " + up);
            set.add(roleRepo.findByName(up).stream().findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + up)));
        }
        return set;
    }

    private String computeLoginStatus(User user) {
        if (user == null) return "NOT_CREATED";
        return user.isEnabled() ? "ACTIVE" : "DISABLED";
    }

    /**
     * Checks integrity: linked user's linkedStaff should point back to this staff.
     */
    private String buildIntegrityWarning(User user, Staff staff) {
        if (user == null) return null;
        boolean hasTeacher = user.getRoles().stream()
                .anyMatch(r -> RoleNames.TEACHER.equalsIgnoreCase(r.getName()));
        if (hasTeacher) {
            if (user.getLinkedStaff() == null) {
                return "This user has the TEACHER role but has no staff profile linked — teacher dashboard will not load.";
            }
            if (!user.getLinkedStaff().getId().equals(staff.getId())) {
                return "This user's linkedStaff points to a different staff record (id=" + user.getLinkedStaff().getId() + "). Teacher dashboard will show wrong data.";
            }
        }
        return null;
    }

    private StaffAccessResultDTO toResult(User user, Staff staff, String tempPwd, String message) {
        StaffAccessResultDTO r = new StaffAccessResultDTO();
        r.setLoginStatus(computeLoginStatus(user));
        if (user != null) {
            r.setUserId(user.getId());
            r.setUsername(user.getUsername());
            r.setEmail(user.getEmail());
            r.setRoles(user.getRoles().stream().map(Role::getName).sorted().toList());
            r.setLastInviteSentAt(user.getLastInviteSentAt());
        }
        r.setTempPassword(tempPwd);
        r.setMessage(message);
        r.setIntegrityWarning(buildIntegrityWarning(user, staff));
        return r;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * POST /api/staff/{staffId}/create-login
     *
     * Creates a new portal login for this staff member.
     * If a user with the same email already exists, it is linked instead of creating a duplicate.
     * If a login already exists for this staff, updates roles only (no duplicate).
     */
    @Transactional
    public StaffAccessResultDTO createLogin(Integer staffId, StaffCreateLoginDTO dto) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);

        String email = dto.getEmail() == null ? staff.getEmail() : dto.getEmail().trim().toLowerCase(Locale.ROOT);
        if (email == null || email.isBlank())
            throw new IllegalArgumentException("Staff email is required to create a login account.");

        Set<Role> roles = resolveRoles(dto.getRoles());
        // If caller didn't specify roles, carry over the existing login's roles (or empty)
        User existingLink = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId).orElse(null);

        if (existingLink != null) {
            // Login already exists — just update roles if provided
            if (!roles.isEmpty()) {
                existingLink.setRoles(roles);
                existingLink.setEnabled(true);
                userRepo.save(existingLink);
            }
            return toResult(existingLink, staff, null, "Login already exists. Roles updated.");
        }

        // Check for an existing user with the same email
        User byEmail = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
        if (byEmail != null) {
            // Link the existing user to this staff — no duplicate
            byEmail.setLinkedStaff(staff);
            byEmail.setLinkedStudent(null);
            byEmail.setSchool(schoolRepo.findById(schoolId).orElseThrow());
            byEmail.setEnabled(true);
            if (!roles.isEmpty()) byEmail.setRoles(roles);
            userRepo.save(byEmail);
            return toResult(byEmail, staff, null,
                    "Existing user (" + email + ") linked to this staff profile. No duplicate created.");
        }

        // Create a fresh user
        String tempPwd  = generateTempPassword();
        String username = dto.getUsername() != null && !dto.getUsername().isBlank()
                ? ensureUniqueUsername(dto.getUsername().trim())
                : ensureUniqueUsername(deriveUsername(email));

        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(tempPwd));
        user.setEnabled(true);
        user.setSchool(schoolRepo.findById(schoolId).orElseThrow());
        user.setLinkedStaff(staff);
        user.setRoles(roles);
        userRepo.save(user);

        return toResult(user, staff, tempPwd, "Login account created. Temporary password generated — share it with the staff member.");
    }

    /**
     * POST /api/staff/{staffId}/send-invite
     *
     * Records that an invite was requested. Email delivery is not yet active.
     * Updates lastInviteSentAt for audit purposes.
     */
    @Transactional
    public StaffAccessResultDTO sendInvite(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException("No login account exists for this staff member. Create a login first."));

        user.setLastInviteSentAt(Instant.now());
        userRepo.save(user);

        return toResult(user, staff, null,
                "Invite recorded (email delivery not yet active). lastInviteSentAt updated for audit.");
    }

    /**
     * POST /api/staff/{staffId}/reset-password
     *
     * Generates a new temporary password. The old password is immediately invalidated.
     * Returns the plaintext password once — it is not stored.
     */
    @Transactional
    public StaffAccessResultDTO resetPassword(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException("No login account found. Create a login first."));

        if (!user.isEnabled())
            throw new IllegalArgumentException("Cannot reset password for a disabled account. Enable login first.");

        String tempPwd = generateTempPassword();
        user.setPassword(passwordEncoder.encode(tempPwd));
        userRepo.save(user);

        return toResult(user, staff, tempPwd, "Password reset. Share the temporary password with the staff member — it is shown only once.");
    }

    /**
     * POST /api/staff/{staffId}/disable-login
     *
     * Prevents the user from authenticating without deleting the account.
     */
    @Transactional
    public StaffAccessResultDTO disableLogin(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException("No login account found for this staff member."));

        if (!user.isEnabled()) {
            return toResult(user, staff, null, "Login is already disabled.");
        }
        user.setEnabled(false);
        userRepo.save(user);
        return toResult(user, staff, null, "Login disabled. The staff member can no longer authenticate.");
    }

    /**
     * POST /api/staff/{staffId}/enable-login
     *
     * Re-enables a previously disabled account.
     */
    @Transactional
    public StaffAccessResultDTO enableLogin(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException("No login account found for this staff member."));

        if (user.isEnabled()) {
            return toResult(user, staff, null, "Login is already enabled.");
        }
        user.setEnabled(true);
        userRepo.save(user);
        return toResult(user, staff, null, "Login enabled. The staff member can now authenticate.");
    }

    /**
     * POST /api/staff/{staffId}/link-user
     *
     * Links an existing system user (by email) to this staff member.
     * Prevents duplicate account creation when HR imports staff who already have logins.
     */
    @Transactional
    public StaffAccessResultDTO linkUser(Integer staffId, StaffLinkUserDTO dto) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);

        String email = dto.getEmail().trim().toLowerCase(Locale.ROOT);
        User user = userRepo.findFirstByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("No user found with email: " + email));

        // Tenant guard
        if (user.getSchool() == null || !user.getSchool().getId().equals(schoolId))
            throw new IllegalArgumentException("User belongs to a different school and cannot be linked here.");

        // Prevent linking a user already linked to a different staff in this school
        if (user.getLinkedStaff() != null && !user.getLinkedStaff().getId().equals(staffId)) {
            throw new IllegalArgumentException(
                    "This user is already linked to staff #" + user.getLinkedStaff().getId()
                            + " (" + user.getLinkedStaff().getFullName() + "). Unlink first.");
        }

        // Check no other user is already linked to this staff
        User existingLink = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId).orElse(null);
        if (existingLink != null && existingLink.getId() != user.getId()) {
            throw new IllegalArgumentException(
                    "This staff already has a linked login (userId=" + existingLink.getId()
                            + "). Disable or unlink the existing account first.");
        }

        user.setLinkedStaff(staff);
        user.setLinkedStudent(null);
        user.setEnabled(true);
        userRepo.save(user);

        return toResult(user, staff, null, "User " + email + " linked to this staff profile.");
    }
}

