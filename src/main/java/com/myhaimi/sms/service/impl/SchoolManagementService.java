package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.AttendanceSettingsDTO;
import com.myhaimi.sms.DTO.FeeSchoolSummaryDTO;
import com.myhaimi.sms.DTO.PlanCatalogItemDTO;
import com.myhaimi.sms.DTO.SchoolManagementOverviewDTO;
import com.myhaimi.sms.DTO.SchoolUserRowDTO;
import com.myhaimi.sms.entity.AttendanceMode;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.platform.service.PlatformAuditService;
import com.myhaimi.sms.modules.platform.service.PlatformOperatorNotificationService;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.security.RoleLevels;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionStatus;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanRepository;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SchoolManagementService {

    private final FeeService feeService;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserRepo userRepo;
    private final StudentRepo studentRepo;
    private final StaffRepo staffRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SchoolRepo schoolRepo;
    private final PlatformAuditService platformAuditService;
    private final PlatformOperatorNotificationService platformOperatorNotificationService;
    private final RoleRepo roleRepo;

    private Integer requireTenant() {
        Integer id = TenantContext.getTenantId();
        if (id == null) {
            throw new IllegalStateException("Tenant context required");
        }
        return id;
    }

    @Transactional(readOnly = true)
    public SchoolManagementOverviewDTO overview() {
        Integer schoolId = requireTenant();
        FeeSchoolSummaryDTO fees = feeService.getSchoolSummary();

        String planCode = null;
        String planName = null;
        String status = "NONE";
        TenantSubscription sub =
                tenantSubscriptionRepository.findByTenantIdAndStatus(schoolId, SubscriptionStatus.ACTIVE).orElse(null);
        if (sub != null) {
            planCode = sub.getPlan().getPlanCode();
            planName = sub.getPlan().getName();
            status = sub.getStatus().name();
        }

        long staff = staffRepo.countBySchool_Id(schoolId);
        long groups = classGroupRepo.countBySchool_Id(schoolId);

        Instant now = Instant.now();
        Instant startLast30 = now.minus(30, ChronoUnit.DAYS);
        Instant startPrev30 = now.minus(60, ChronoUnit.DAYS);

        long last30 = studentRepo.countCreatedBetween(schoolId, startLast30, now);
        long prev30 = studentRepo.countCreatedBetween(schoolId, startPrev30, startLast30);

        BigDecimal growthPct;
        if (prev30 == 0) {
            growthPct = last30 > 0 ? BigDecimal.valueOf(100) : BigDecimal.ZERO;
        } else {
            growthPct = BigDecimal.valueOf(last30 - prev30)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(prev30), 1, RoundingMode.HALF_UP);
        }

        return new SchoolManagementOverviewDTO(
                fees, planCode, planName, status, staff, groups, last30, prev30, growthPct);
    }

    @Transactional(readOnly = true)
    public List<SchoolUserRowDTO> listSchoolUsers() {
        Integer schoolId = requireTenant();
        List<User> users = userRepo.findBySchool_IdWithProfilesOrderByEmailAsc(schoolId);
        return users.stream()
                .map(u -> new SchoolUserRowDTO(
                        u.getId(),
                        u.getEmail(),
                        displayNameForUser(u),
                        photoUrlForUser(u),
                        u.getRoles().stream().map(Role::getName).sorted().toList()))
                .sorted(Comparator.comparing(SchoolUserRowDTO::email, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static String displayNameForUser(User u) {
        Staff st = u.getLinkedStaff();
        if (st != null && st.getFullName() != null && !st.getFullName().isBlank()) {
            return st.getFullName().trim();
        }
        Student s = u.getLinkedStudent();
        if (s != null) {
            String fn = s.getFirstName() == null ? "" : s.getFirstName().trim();
            String ln = s.getLastName() == null || s.getLastName().isBlank() ? "" : " " + s.getLastName().trim();
            String combo = (fn + ln).trim();
            if (!combo.isEmpty()) {
                return combo;
            }
        }
        if (u.getUsername() != null && !u.getUsername().isBlank()) {
            return u.getUsername().trim();
        }
        return u.getEmail();
    }

    /** Portrait from linked staff/student when set; otherwise null (client shows initials). */
    private static String photoUrlForUser(User u) {
        Staff st = u.getLinkedStaff();
        if (st != null && st.getPhotoUrl() != null && !st.getPhotoUrl().isBlank()) {
            return st.getPhotoUrl().trim();
        }
        Student s = u.getLinkedStudent();
        if (s != null && s.getPhotoUrl() != null && !s.getPhotoUrl().isBlank()) {
            return s.getPhotoUrl().trim();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public AttendanceSettingsDTO getAttendanceSettings() {
        Integer schoolId = requireTenant();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        return new AttendanceSettingsDTO(school.getAttendanceMode());
    }

    @Transactional
    public void updateAttendanceSettings(AttendanceMode mode, String actorEmail) {
        assertSchoolLeaderForSettings(actorEmail);
        Integer schoolId = requireTenant();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        school.setAttendanceMode(mode);
        schoolRepo.save(school);
        platformAuditService.record(
                "TENANT_ATTENDANCE_MODE",
                "School",
                String.valueOf(schoolId),
                "mode=" + mode.name());
    }

    private void assertSchoolLeaderForSettings(String actorEmail) {
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        Integer schoolId = requireTenant();
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }
        boolean ok = actor.getRoles().stream()
                .map(Role::getName)
                .anyMatch(n -> RoleNames.SCHOOL_ADMIN.equals(n) || RoleNames.PRINCIPAL.equals(n));
        if (!ok) {
            throw new AccessDeniedException("Only school owner or principal can change attendance settings");
        }
    }

    @Transactional(readOnly = true)
    public List<PlanCatalogItemDTO> planCatalog() {
        return subscriptionPlanRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(SchoolManagementService::toCatalogItem)
                .toList();
    }

    /** Role codes the caller may assign: full set for school owner, subset for principal. */
    @Transactional(readOnly = true)
    public List<String> assignableRolesForActor(String actorEmail) {
        Integer schoolId = requireTenant();
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }
        boolean owner = actor.getRoles().stream().anyMatch(r -> RoleNames.SCHOOL_ADMIN.equals(r.getName()));
        boolean principal = actor.getRoles().stream().anyMatch(r -> RoleNames.PRINCIPAL.equals(r.getName()));
        boolean vicePrincipal = actor.getRoles().stream().anyMatch(r -> RoleNames.VICE_PRINCIPAL.equals(r.getName()));

        if (owner) return RoleNames.ASSIGNABLE_BY_SCHOOL_OWNER.stream().sorted().toList();
        if (principal) return RoleNames.ASSIGNABLE_BY_PRINCIPAL.stream().sorted().toList();
        if (vicePrincipal) return RoleNames.ASSIGNABLE_BY_VICE_PRINCIPAL.stream().sorted().toList();

        throw new AccessDeniedException("Not allowed to list assignable roles");
    }

    /**
     * Replaces the target user's roles within the current tenant.
     * <ul>
     *   <li>{@link RoleNames#SCHOOL_ADMIN}: full tenant role assignment (cannot remove last owner).</li>
     *   <li>{@link RoleNames#PRINCIPAL}: staff roles only; cannot modify school owner, principal, student, or parent accounts.</li>
     * </ul>
     */
    @Transactional
    public void updateSchoolUserRoles(int targetUserId, List<String> requestedRoleNames, String actorEmail) {
        Integer schoolId = requireTenant();
        User actor =
                userRepo.findFirstByEmailIgnoreCase(actorEmail.trim()).orElseThrow(() -> new AccessDeniedException(
                        "Actor not found"));
        if (actor.getSchool() == null || !actor.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("Tenant mismatch");
        }

        boolean actorOwner = actor.getRoles().stream().anyMatch(r -> RoleNames.SCHOOL_ADMIN.equals(r.getName()));
        boolean actorPrincipal = actor.getRoles().stream().anyMatch(r -> RoleNames.PRINCIPAL.equals(r.getName()));
        boolean actorVicePrincipal = actor.getRoles().stream().anyMatch(r -> RoleNames.VICE_PRINCIPAL.equals(r.getName()));
        if (!actorOwner && !actorPrincipal && !actorVicePrincipal) {
            throw new AccessDeniedException("Not allowed to assign roles");
        }

        User target = userRepo.findById(targetUserId).orElseThrow(() -> new NoSuchElementException("User not found"));
        if (target.getSchool() == null || !target.getSchool().getId().equals(schoolId)) {
            throw new AccessDeniedException("User is not in this school");
        }

        // Authority checks: cannot control higher/equal levels.
        int actorLevel = actor.getRoles().stream().map(Role::getName).mapToInt(RoleLevels::levelOf).min().orElse(Integer.MAX_VALUE);
        int targetHighestAuthority = target.getRoles().stream().map(Role::getName).mapToInt(RoleLevels::levelOf).min().orElse(Integer.MAX_VALUE);
        if (targetHighestAuthority <= actorLevel) {
            throw new AccessDeniedException("You cannot modify roles for users at your level or above");
        }

        List<String> normalized = requestedRoleNames.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toUpperCase)
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .toList();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("At least one role is required");
        }

        Set<String> allowed = actorOwner
                ? RoleNames.ASSIGNABLE_BY_SCHOOL_OWNER
                : actorPrincipal
                        ? RoleNames.ASSIGNABLE_BY_PRINCIPAL
                        : RoleNames.ASSIGNABLE_BY_VICE_PRINCIPAL;

        for (String name : normalized) {
            if (RoleNames.SUPER_ADMIN.equals(name)) {
                throw new IllegalArgumentException("SUPER_ADMIN cannot be assigned here");
            }
            if (!allowed.contains(name)) {
                throw new IllegalArgumentException("Role cannot be assigned with your authority: " + name);
            }
            int roleLevel = RoleLevels.levelOf(name);
            if (roleLevel <= actorLevel) {
                throw new IllegalArgumentException("Role must be below your authority level: " + name);
            }
        }

        boolean targetHadSchoolAdmin =
                target.getRoles().stream().anyMatch(r -> RoleNames.SCHOOL_ADMIN.equals(r.getName()));
        boolean newHasSchoolAdmin = normalized.contains(RoleNames.SCHOOL_ADMIN);
        if (actorOwner && targetHadSchoolAdmin && !newHasSchoolAdmin) {
            long otherAdmins = userRepo.countBySchoolIdAndRoleNameExcludingUser(
                    schoolId, RoleNames.SCHOOL_ADMIN, targetUserId);
            if (otherAdmins == 0) {
                throw new IllegalArgumentException(
                        "Cannot remove the last school owner (SCHOOL_ADMIN) for this school.");
            }
        }

        Set<Role> resolved = new HashSet<>();
        for (String name : normalized) {
            Role r = roleRepo.findByName(name).stream()
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name));
            resolved.add(r);
        }
        target.getRoles().clear();
        target.getRoles().addAll(resolved);
        userRepo.save(target);

        String detail = "tenantId="
                + schoolId
                + " actorOwner="
                + actorOwner
                + " targetUserId="
                + targetUserId
                + " targetEmail="
                + target.getEmail()
                + " newRoles="
                + String.join(",", normalized);
        platformAuditService.record("TENANT_USER_ROLES_UPDATED", "User", String.valueOf(targetUserId), detail);
    }

    private static PlanCatalogItemDTO toCatalogItem(SubscriptionPlan p) {
        return new PlanCatalogItemDTO(
                p.getPlanCode(), p.getName(), p.getDescription() != null ? p.getDescription() : "");
    }

    /** Records an upgrade / downgrade intent for platform operators (does not change the plan in-app). */
    @Transactional
    public void requestPlanChange(String targetPlanCode, String message) {
        Integer schoolId = requireTenant();
        SubscriptionPlan target = subscriptionPlanRepository
                .findByPlanCodeIgnoreCase(targetPlanCode.trim())
                .orElseThrow(() -> new IllegalArgumentException("Unknown plan: " + targetPlanCode));
        String detail = "tenantId="
                + schoolId
                + " requestedPlan="
                + target.getPlanCode()
                + " note="
                + (message != null ? message.replace('\n', ' ') : "");
        platformAuditService.record("TENANT_PLAN_CHANGE_REQUEST", "TenantSubscription", String.valueOf(schoolId), detail);
        String actorEmail = null;
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            actorEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        }
        School school = schoolRepo.findById(schoolId).orElse(null);
        String schoolName = school != null ? school.getName() : null;
        platformOperatorNotificationService.recordPlanChangeRequest(
                schoolId, schoolName, target.getPlanCode(), target.getName(), actorEmail, message);
    }
}
