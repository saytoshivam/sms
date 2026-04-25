package com.myhaimi.sms.security;

import java.util.Map;

/**
 * Canonical authority levels. Lower number = higher authority.
 * Used for "who can control whom" checks in role assignment flows.
 */
public final class RoleLevels {

    private RoleLevels() {}

    public static final int L0_SUPER_ADMIN = 0;
    public static final int L1_SCHOOL_OWNER = 1;
    public static final int L2_PRINCIPAL = 2;
    public static final int L3_VICE_PRINCIPAL = 3;
    public static final int L4_HOD = 4;
    public static final int L5_TEACHER = 5;
    public static final int L6_STUDENT = 6;
    public static final int L7_PARENT = 7;

    /** RoleName -> level. Roles not present are treated as high numeric (lowest authority). */
    public static final Map<String, Integer> ROLE_TO_LEVEL = Map.ofEntries(
            Map.entry(RoleNames.SUPER_ADMIN, L0_SUPER_ADMIN),
            Map.entry(RoleNames.SCHOOL_ADMIN, L1_SCHOOL_OWNER),
            Map.entry(RoleNames.PRINCIPAL, L2_PRINCIPAL),
            Map.entry(RoleNames.VICE_PRINCIPAL, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.HOD, L4_HOD),
            Map.entry(RoleNames.TEACHER, L5_TEACHER),
            Map.entry(RoleNames.CLASS_TEACHER, L5_TEACHER),
            Map.entry(RoleNames.STUDENT, L6_STUDENT),
            Map.entry(RoleNames.PARENT, L7_PARENT),
            // Parallel domain roles: report to principal, treated as below principal.
            Map.entry(RoleNames.ACCOUNTANT, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.LIBRARIAN, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.TRANSPORT_MANAGER, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.RECEPTIONIST, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.IT_SUPPORT, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.COUNSELOR, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.EXAM_COORDINATOR, L3_VICE_PRINCIPAL),
            Map.entry(RoleNames.HOSTEL_WARDEN, L3_VICE_PRINCIPAL));

    public static int levelOf(String roleName) {
        if (roleName == null) return Integer.MAX_VALUE;
        return ROLE_TO_LEVEL.getOrDefault(roleName, Integer.MAX_VALUE);
    }
}

