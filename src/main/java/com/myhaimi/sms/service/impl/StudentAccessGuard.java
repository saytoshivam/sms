package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.student.StudentViewerPermissionsDTO;
import com.myhaimi.sms.entity.ClassGroup;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.SubjectAllocation;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.ClassGroupRepo;
import com.myhaimi.sms.repository.SubjectAllocationRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.security.RoleNames;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves the effective access context for the current authenticated user
 * within the Student module. Enforces tenant isolation and per-role restrictions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentAccessGuard {

    private final UserRepo userRepo;
    private final ClassGroupRepo classGroupRepo;
    private final SubjectAllocationRepo subjectAllocationRepo;

    /**
     * Resolves caller context. Throws {@link AccessDeniedException} if the caller
     * doesn't have any student module access (e.g., SUPER_ADMIN, wrong tenant, not authenticated).
     */
    @Transactional(readOnly = true)
    public StudentCallerContext resolve(Integer schoolId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AccessDeniedException("Not authenticated.");
        }
        String email = auth.getName();

        User user = userRepo.findFirstByEmailIgnoreCase(email)
                .orElseThrow(() -> new AccessDeniedException("User account not found."));

        Set<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        // SUPER_ADMIN must not casually browse school student data
        if (roles.contains(RoleNames.SUPER_ADMIN)) {
            throw new AccessDeniedException(
                    "Platform administrators cannot directly access school student records.");
        }

        // Tenant isolation: user must belong to the school from the request context
        if (user.getSchool() == null || !schoolId.equals(user.getSchool().getId())) {
            throw new AccessDeniedException("Access denied: school mismatch.");
        }

        Integer linkedStudentId  = user.getLinkedStudent()  != null ? user.getLinkedStudent().getId()  : null;
        Integer linkedGuardianId = user.getLinkedGuardian() != null ? user.getLinkedGuardian().getId() : null;
        Integer linkedStaffId    = user.getLinkedStaff()    != null ? user.getLinkedStaff().getId()    : null;

        // Permission flags (all false by default)
        boolean canViewAnyStudent    = false;
        boolean canEdit              = false;
        boolean canTransfer          = false;
        boolean canCreateStudents    = false;
        boolean canViewGuardians     = false;
        boolean canViewMedical       = false;
        boolean canViewDocuments     = false;
        boolean canViewFees          = false;
        boolean canManageParentLogin = false;
        boolean canManageStudentLogin = false;
        // null = unrestricted (all classes in school); non-null = explicit allowlist
        Set<Integer> allowedClassGroupIds = null;

        if (roles.contains(RoleNames.SCHOOL_ADMIN) || roles.contains(RoleNames.PRINCIPAL)) {
            canViewAnyStudent = true;
            canEdit = true; canTransfer = true; canCreateStudents = true;
            canViewGuardians = true; canViewMedical = true;
            canViewDocuments = true; canViewFees = true;
            canManageParentLogin = true; canManageStudentLogin = true;

        } else if (roles.contains(RoleNames.VICE_PRINCIPAL)) {
            canViewAnyStudent = true;
            canViewGuardians = true; canViewMedical = true;
            canViewDocuments = true; canViewFees = true;
            canManageParentLogin = true; canManageStudentLogin = true;

        } else if (roles.contains(RoleNames.ACCOUNTANT)) {
            canViewAnyStudent = true;
            canViewFees = true;

        } else if (roles.contains(RoleNames.CLASS_TEACHER)) {
            // Class teacher: own homeroom classes only
            if (linkedStaffId != null) {
                List<ClassGroup> ownedClasses = classGroupRepo
                        .findBySchool_IdAndClassTeacher_IdAndIsDeletedFalseOrderByDisplayNameAsc(
                                schoolId, linkedStaffId);
                allowedClassGroupIds = ownedClasses.stream()
                        .map(ClassGroup::getId)
                        .collect(Collectors.toCollection(HashSet::new));
            } else {
                allowedClassGroupIds = Set.of();
            }
            canViewGuardians = true;
            canViewMedical   = true;

        } else if (roles.contains(RoleNames.TEACHER)) {
            // Subject teacher: only sections they are allocated to
            if (linkedStaffId != null) {
                List<SubjectAllocation> allocs =
                        subjectAllocationRepo.findBySchool_IdAndStaff_Id(schoolId, linkedStaffId);
                allowedClassGroupIds = allocs.stream()
                        .map(a -> a.getClassGroup().getId())
                        .collect(Collectors.toCollection(HashSet::new));
            } else {
                allowedClassGroupIds = Set.of();
            }
            // Subject teacher: basic view only — no guardians, no medical

        } else if (roles.contains(RoleNames.PARENT)) {
            // Access controlled per-student via linked guardian; class group list not used
            allowedClassGroupIds = Set.of();
            canViewGuardians = true; // can see their own guardian data
            canViewFees      = true; // parents can see fees

        } else if (roles.contains(RoleNames.STUDENT)) {
            allowedClassGroupIds = Set.of();

        } else {
            // All other roles (librarian, counselor, etc.) — no student data access
            throw new AccessDeniedException(
                    "Your role does not have access to student records.");
        }

        return new StudentCallerContext(
                email, roles,
                linkedStudentId, linkedGuardianId, linkedStaffId,
                allowedClassGroupIds,
                canViewAnyStudent, canEdit, canTransfer, canCreateStudents,
                canViewGuardians, canViewMedical, canViewDocuments, canViewFees,
                canManageParentLogin, canManageStudentLogin);
    }

    /** Builds the viewer permissions DTO for embedding in the profile response. */
    public static StudentViewerPermissionsDTO toPermissionsDTO(StudentCallerContext ctx) {
        return StudentViewerPermissionsDTO.builder()
                .canEdit(ctx.canEdit())
                .canTransfer(ctx.canTransfer())
                .canCreateStudents(ctx.canCreateStudents())
                .canViewGuardians(ctx.canViewGuardians())
                .canViewMedical(ctx.canViewMedical())
                .canViewDocuments(ctx.canViewDocuments())
                .canViewFees(ctx.canViewFees())
                .canManageParentLogin(ctx.canManageParentLogin())
                .canManageStudentLogin(ctx.canManageStudentLogin())
                .build();
    }
}

