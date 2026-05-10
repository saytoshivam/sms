package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.security.RoleNames;

import java.util.Set;

/**
 * Immutable snapshot of the current caller's effective permissions within the Student module.
 * Produced once per request by {@link StudentAccessGuard#resolve(Integer)}.
 *
 * @param allowedClassGroupIds null = all class groups in the school are visible;
 *                             non-null = only those specific class group IDs are visible.
 *                             An empty set means nothing is accessible.
 */
public record StudentCallerContext(
        String email,
        Set<String> roleNames,
        Integer linkedStudentId,
        Integer linkedGuardianId,
        Integer linkedStaffId,
        Set<Integer> allowedClassGroupIds,
        boolean canViewAnyStudent,
        boolean canEdit,
        boolean canTransfer,
        boolean canCreateStudents,
        boolean canViewGuardians,
        boolean canViewMedical,
        boolean canViewDocuments,
        boolean canViewFees,
        boolean canManageParentLogin
) {
    public boolean hasRole(String role) {
        return roleNames != null && roleNames.contains(role);
    }

    public boolean isSchoolAdmin()   { return hasRole(RoleNames.SCHOOL_ADMIN); }
    public boolean isPrincipal()     { return hasRole(RoleNames.PRINCIPAL); }
    public boolean isVicePrincipal() { return hasRole(RoleNames.VICE_PRINCIPAL); }
    public boolean isClassTeacher()  { return hasRole(RoleNames.CLASS_TEACHER); }
    public boolean isTeacher()       { return hasRole(RoleNames.TEACHER) || hasRole(RoleNames.CLASS_TEACHER); }
    public boolean isParent()        { return hasRole(RoleNames.PARENT); }
    public boolean isStudent()       { return hasRole(RoleNames.STUDENT); }
}

