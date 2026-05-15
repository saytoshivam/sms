package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.staff.StaffAccessResultDTO;
import com.myhaimi.sms.DTO.staff.StaffCreateLoginDTO;
import com.myhaimi.sms.DTO.staff.StaffLinkUserDTO;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.StaffRoleMapping;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StaffRoleMappingRepository;
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

/**
 * Manages the full login access lifecycle for a staff member:
 * create, link, invite, reset-password, disable, enable.
 *
 * <p>Login status is honest: NOT_CREATED / ACTIVE / DISABLED only.
 * {@code lastInviteSentAt} is stored as metadata but does NOT change the status.</p>
 *
 * <p>Safety rules:</p>
 * <ul>
 *   <li>Never clear {@code User.linkedStudent} — that is a different lifecycle.</li>
 *   <li>Reject linking if the user already owns a student or guardian profile.</li>
 *   <li>Reject linking if the user has STUDENT or PARENT roles.</li>
 *   <li>Staff roles are provisioned from {@link StaffRoleMapping}, not invented.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StaffAccessService {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RNG = new SecureRandom();

    private final StaffRepo                 staffRepo;
    private final UserRepo                  userRepo;
    private final RoleRepo                  roleRepo;
    private final SchoolRepo                schoolRepo;
    private final StaffRoleMappingRepository staffRoleMappingRepository;
    private final PasswordEncoder           passwordEncoder;

    // ── Helpers ──────────────────────────────────────────────────────────────

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

    /**
     * Resolves the staff member's roles from the first-class {@link StaffRoleMapping} table.
     * Returns an empty set if no mappings exist (caller decides the fallback behaviour).
     */
    private Set<Role> resolveStaffOwnRoles(Integer staffId) {
        List<StaffRoleMapping> mappings = staffRoleMappingRepository.findByStaff_Id(staffId);
        Set<Role> set = new HashSet<>();
        for (StaffRoleMapping m : mappings) {
            if (m.getRole() != null) set.add(m.getRole());
        }
        return set;
    }

    /** loginStatus: 3 honest states. lastInviteSentAt is metadata only. */
    private String computeLoginStatus(User user) {
        if (user == null) return "NOT_CREATED";
        return user.isEnabled() ? "ACTIVE" : "DISABLED";
    }

    private String buildIntegrityWarning(User user, Staff staff) {
        if (user == null) return null;
        boolean hasTeacher = user.getRoles().stream()
                .anyMatch(r -> RoleNames.TEACHER.equalsIgnoreCase(r.getName()));
        if (hasTeacher) {
            if (user.getLinkedStaff() == null)
                return "This user has the TEACHER role but no staff profile linked — teacher dashboard will not load.";
            if (!user.getLinkedStaff().getId().equals(staff.getId()))
                return "This user's linkedStaff points to a different staff record (id=" + user.getLinkedStaff().getId() + ").";
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

    /**
     * Hard guard: reject any user that already belongs to a student or guardian profile
     * or carries a STUDENT / PARENT role.
     *
     * <p><strong>We never call {@code user.setLinkedStudent(null)} here.</strong>
     * Clearing a student link is a separate, explicit migration action, not a side-effect
     * of staff onboarding.</p>
     */
    private void assertUserSafeToLinkAsStaff(User user, String email) {
        if (user.getLinkedStudent() != null)
            throw new IllegalArgumentException(
                    "User " + email + " is linked to student #" + user.getLinkedStudent().getId()
                    + " and cannot be linked to a staff profile. Use a separate account.");
        if (user.getLinkedGuardian() != null)
            throw new IllegalArgumentException(
                    "User " + email + " is linked to a guardian profile and cannot be linked to staff.");
        boolean hasForbiddenRole = user.getRoles().stream()
                .anyMatch(r -> RoleNames.STUDENT.equalsIgnoreCase(r.getName())
                            || RoleNames.PARENT.equalsIgnoreCase(r.getName()));
        if (hasForbiddenRole)
            throw new IllegalArgumentException(
                    "User " + email + " has a STUDENT or PARENT role and cannot be linked to a staff profile.");
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * POST /api/staff/{staffId}/create-login
     *
     * Creates a new portal login for this staff member. User.roles are
     * provisioned from StaffRoleMapping. Never clears linkedStudent.
     */
    @Transactional
    public StaffAccessResultDTO createLogin(Integer staffId, StaffCreateLoginDTO dto) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);

        String email = dto.getEmail() == null ? staff.getEmail() : dto.getEmail().trim().toLowerCase(Locale.ROOT);
        if (email == null || email.isBlank())
            throw new IllegalArgumentException("Staff email is required to create a login account.");

        // Roles: StaffRoleMapping is the ONLY authoritative source.
        // Caller-supplied role lists from StaffCreateLoginDTO are intentionally ignored here —
        // roles must be managed through the staff role management flow, not login creation.
        Set<Role> roles = resolveStaffOwnRoles(staffId);
        if (roles.isEmpty())
            throw new IllegalArgumentException(
                    "Assign at least one staff role (via staff role management) before creating a login account. "
                    + "Staff roles control portal access permissions.");

        User existingLink = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId).orElse(null);
        if (existingLink != null) {
            if (!roles.isEmpty()) existingLink.setRoles(roles);
            existingLink.setEnabled(true);
            userRepo.save(existingLink);
            return toResult(existingLink, staff, null, "Login already exists. Roles updated.");
        }

        // Existing user with the same email
        User byEmail = userRepo.findFirstByEmailIgnoreCase(email).orElse(null);
        if (byEmail != null) {
            assertUserSafeToLinkAsStaff(byEmail, email);
            if (byEmail.getSchool() == null || !byEmail.getSchool().getId().equals(schoolId))
                throw new IllegalArgumentException("User " + email + " belongs to a different school.");
            if (byEmail.getLinkedStaff() != null && !byEmail.getLinkedStaff().getId().equals(staffId))
                throw new IllegalArgumentException(
                        "User " + email + " is already linked to a different staff member.");
            byEmail.setLinkedStaff(staff);
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

        return toResult(user, staff, tempPwd,
                "Login account created. Temporary password generated — share it with the staff member.");
    }

    /**
     * POST /api/staff/{staffId}/send-invite
     *
     * Records that an invite was requested.
     * Email delivery is not enabled. {@code lastInviteSentAt} is updated for audit purposes.
     * Login status does NOT change — the account remains ACTIVE.
     */
    @Transactional
    public StaffAccessResultDTO sendInvite(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No login account exists for this staff member. Create a login first."));

        user.setLastInviteSentAt(Instant.now());
        userRepo.save(user);

        return toResult(user, staff, null,
                "Invite recorded. Email delivery is not enabled yet. lastInviteSentAt updated for audit.");
    }

    /**
     * POST /api/staff/{staffId}/reset-password
     * Generates a new temporary password. Shown once — not stored in plaintext.
     */
    @Transactional
    public StaffAccessResultDTO resetPassword(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No login account found. Create a login first."));

        if (!user.isEnabled())
            throw new IllegalArgumentException(
                    "Cannot reset password for a disabled account. Enable login first.");

        String tempPwd = generateTempPassword();
        user.setPassword(passwordEncoder.encode(tempPwd));
        userRepo.save(user);

        return toResult(user, staff, tempPwd,
                "Password reset. Share the temporary password — it is shown only once.");
    }

    /**
     * POST /api/staff/{staffId}/disable-login
     * Prevents authentication without deleting the account.
     */
    @Transactional
    public StaffAccessResultDTO disableLogin(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No login account found for this staff member."));

        if (!user.isEnabled()) return toResult(user, staff, null, "Login is already disabled.");
        user.setEnabled(false);
        userRepo.save(user);
        return toResult(user, staff, null, "Login disabled. The staff member can no longer authenticate.");
    }

    /**
     * POST /api/staff/{staffId}/enable-login
     * Re-enables a previously disabled account.
     */
    @Transactional
    public StaffAccessResultDTO enableLogin(Integer staffId) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);
        User user = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No login account found for this staff member."));

        if (user.isEnabled()) return toResult(user, staff, null, "Login is already enabled.");
        user.setEnabled(true);
        userRepo.save(user);
        return toResult(user, staff, null, "Login enabled. The staff member can now authenticate.");
    }

    /**
     * POST /api/staff/{staffId}/link-user
     *
     * Links an existing system user (by email) to this staff member.
     * Comprehensive safety guards prevent cross-contamination of login profiles.
     * <strong>Never clears linkedStudent.</strong>
     */
    @Transactional
    public StaffAccessResultDTO linkUser(Integer staffId, StaffLinkUserDTO dto) {
        Integer schoolId = requireSchoolId();
        Staff staff = requireStaff(staffId, schoolId);

        String email = dto.getEmail().trim().toLowerCase(Locale.ROOT);
        User user = userRepo.findFirstByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("No user found with email: " + email));

        if (user.getSchool() == null || !user.getSchool().getId().equals(schoolId))
            throw new IllegalArgumentException("User belongs to a different school and cannot be linked here.");

        // Hard safety: reject student/guardian/forbidden-role users
        assertUserSafeToLinkAsStaff(user, email);

        if (user.getLinkedStaff() != null && !user.getLinkedStaff().getId().equals(staffId))
            throw new IllegalArgumentException(
                    "This user is already linked to staff #" + user.getLinkedStaff().getId()
                    + " (" + user.getLinkedStaff().getFullName() + "). Unlink first.");

        User existingLink = userRepo.findFirstBySchool_IdAndLinkedStaff_Id(schoolId, staffId).orElse(null);
        if (existingLink != null && existingLink.getId() != user.getId())
            throw new IllegalArgumentException(
                    "This staff already has a linked login (userId=" + existingLink.getId()
                    + "). Disable or unlink the existing account first.");

        // Provision staff roles from StaffRoleMapping
        Set<Role> staffRoles = resolveStaffOwnRoles(staffId);
        user.setLinkedStaff(staff);
        user.setEnabled(true);
        if (!staffRoles.isEmpty()) user.setRoles(staffRoles);
        userRepo.save(user);

        return toResult(user, staff, null, "User " + email + " linked to this staff profile.");
    }
}

