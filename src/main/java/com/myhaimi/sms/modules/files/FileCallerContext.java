package com.myhaimi.sms.modules.files;

import java.util.Set;

/**
 * Immutable snapshot of the current caller's identity as seen by the file module.
 * Built once per request by {@link FileController} / {@link FileServeController}.
 */
public record FileCallerContext(
        Integer userId,
        Set<String> roles,
        /** Linked student id — non-null only for STUDENT role. */
        Integer linkedStudentId,
        /** Linked guardian id — non-null only for PARENT role. */
        Integer linkedGuardianId,
        /** School this user belongs to (used for tenant isolation). */
        Integer schoolId
) {
    public boolean isAdmin()           { return roles.contains("SCHOOL_ADMIN"); }
    public boolean isPrincipal()       { return roles.contains("PRINCIPAL"); }
    public boolean isVicePrincipal()   { return roles.contains("VICE_PRINCIPAL"); }
    public boolean isClassTeacher()    { return roles.contains("CLASS_TEACHER"); }
    public boolean isTeacher()         { return roles.contains("TEACHER") || roles.contains("CLASS_TEACHER"); }
    public boolean isParent()          { return roles.contains("PARENT"); }
    public boolean isStudent()         { return roles.contains("STUDENT"); }
    /** Admin or principal — most permissive school roles. */
    public boolean isSchoolLeadership(){ return isAdmin() || isPrincipal(); }
    public boolean hasRole(String r)   { return roles.contains(r); }
}
