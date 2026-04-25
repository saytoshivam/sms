package com.myhaimi.sms.security;

import java.util.Set;

/**
 * Canonical role codes stored in {@code roles.name}. Seeded in {@link com.myhaimi.sms.config.DataSeeder}.
 */
public final class RoleNames {

    public static final String SUPER_ADMIN = "SUPER_ADMIN";

    /** School owner / management (operations). */
    public static final String SCHOOL_ADMIN = "SCHOOL_ADMIN";

    public static final String PRINCIPAL = "PRINCIPAL";
    public static final String VICE_PRINCIPAL = "VICE_PRINCIPAL";
    /** Head of department. */
    public static final String HOD = "HOD";

    public static final String TEACHER = "TEACHER";
    /** Class teacher (homeroom / class-in-charge). */
    public static final String CLASS_TEACHER = "CLASS_TEACHER";

    public static final String STUDENT = "STUDENT";
    public static final String PARENT = "PARENT";

    public static final String LIBRARIAN = "LIBRARIAN";
    public static final String ACCOUNTANT = "ACCOUNTANT";
    public static final String RECEPTIONIST = "RECEPTIONIST";
    public static final String TRANSPORT_MANAGER = "TRANSPORT_MANAGER";
    /** School-level IT / admin staff. */
    public static final String IT_SUPPORT = "IT_SUPPORT";

    public static final String COUNSELOR = "COUNSELOR";
    public static final String EXAM_COORDINATOR = "EXAM_COORDINATOR";
    public static final String HOSTEL_WARDEN = "HOSTEL_WARDEN";

    /**
     * Roles a school owner ({@link #SCHOOL_ADMIN}) may assign to users in their tenant.
     * Platform {@link #SUPER_ADMIN} is excluded.
     */
    public static final Set<String> ASSIGNABLE_BY_SCHOOL_OWNER = Set.of(
            SCHOOL_ADMIN,
            PRINCIPAL,
            VICE_PRINCIPAL,
            HOD,
            TEACHER,
            CLASS_TEACHER,
            STUDENT,
            PARENT,
            LIBRARIAN,
            ACCOUNTANT,
            RECEPTIONIST,
            TRANSPORT_MANAGER,
            IT_SUPPORT,
            COUNSELOR,
            EXAM_COORDINATOR,
            HOSTEL_WARDEN);

    /**
     * Roles a {@link #PRINCIPAL} may assign inside the school. Excludes school ownership, principalship,
     * student/parent portal roles, and platform admin.
     */
    public static final Set<String> ASSIGNABLE_BY_PRINCIPAL = Set.of(
            VICE_PRINCIPAL,
            HOD,
            TEACHER,
            CLASS_TEACHER,
            LIBRARIAN,
            ACCOUNTANT,
            RECEPTIONIST,
            TRANSPORT_MANAGER,
            IT_SUPPORT,
            COUNSELOR,
            EXAM_COORDINATOR,
            HOSTEL_WARDEN);

    /** Vice principal can assign teachers/class teachers (can be extended per-tenant later). */
    public static final Set<String> ASSIGNABLE_BY_VICE_PRINCIPAL = Set.of(
            TEACHER,
            CLASS_TEACHER);

    private RoleNames() {}

    /** Roles that use the school admin workspace (tenant management UI). */
    public static boolean isSchoolLeadership(String roleName) {
        return SCHOOL_ADMIN.equals(roleName)
                || PRINCIPAL.equals(roleName)
                || VICE_PRINCIPAL.equals(roleName)
                || HOD.equals(roleName);
    }

    /** Roles that teach or take a class (timetable, class announcements, etc.). */
    public static boolean isTeaching(String roleName) {
        return TEACHER.equals(roleName) || CLASS_TEACHER.equals(roleName);
    }
}
