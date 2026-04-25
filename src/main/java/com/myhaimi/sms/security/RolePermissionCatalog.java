package com.myhaimi.sms.security;

import java.util.HashSet;
import java.util.Set;

import static com.myhaimi.sms.security.PermissionCodes.*;

/**
 * Default permissions granted by each role name. Use {@link com.myhaimi.sms.service.impl.EffectiveTenantPermissionService}
 * to intersect with enabled subscription features.
 */
public final class RolePermissionCatalog {

    private static final Set<String> TEACHER = Set.of(
            TCH_VIEW_ASSIGNED_CLASSES_SUBJECTS,
            TCH_UPLOAD_STUDY_MATERIAL,
            TCH_ASSIGN_HOMEWORK,
            TCH_MARK_ATTENDANCE,
            TCH_EDIT_ATTENDANCE_WINDOW,
            TCH_ENTER_MARKS,
            TCH_UPLOAD_INTERNAL_ASSESSMENTS,
            TCH_MESSAGE_PARENTS_STUDENTS);

    private static final Set<String> CLASS_TEACHER_EXTRA = Set.of(
            CT_CLASS_ATTENDANCE_OVERVIEW,
            CT_TRACK_STUDENT_PERFORMANCE,
            CT_CONTACT_ALL_CLASS_PARENTS,
            CT_HANDLE_STUDENT_ISSUES);

    private static final Set<String> VICE_PRINCIPAL = Set.of(
            OPS_DAILY_MANAGE,
            OPS_ATTENDANCE_OVERSEE,
            OPS_DISCIPLINE_MONITOR,
            OPS_LEAVE_APPROVE,
            OPS_ESCALATION_HANDLE,
            OPS_OPERATIONAL_REPORTS,
            TENANT_SETTINGS_VIEW);

    private static final Set<String> HOD = Set.of(
            ACAD_ASSIGN_SUBJECTS_TO_TEACHERS,
            ACAD_REVIEW_SYLLABUS_COMPLETION,
            ACAD_APPROVE_LESSON_PLANS,
            ACAD_VALIDATE_MARKS_BEFORE_PUBLISH,
            ACAD_ANALYZE_SUBJECT_PERFORMANCE,
            ACAD_MONITOR_TEACHER_ACTIVITY,
            TENANT_SETTINGS_VIEW);

    private static final Set<String> STUDENT = Set.of(
            STU_VIEW_PROFILE,
            STU_VIEW_ATTENDANCE,
            STU_VIEW_TIMETABLE,
            STU_VIEW_HOMEWORK,
            STU_VIEW_EXAM_RESULTS,
            STU_DOWNLOAD_REPORT_CARDS,
            STU_RECEIVE_NOTIFICATIONS);

    private static final Set<String> PARENT = Set.of(
            PAR_VIEW_CHILD_ATTENDANCE,
            PAR_VIEW_CHILD_PERFORMANCE,
            PAR_VIEW_CHILD_TIMETABLE,
            PAR_PAY_FEES_ONLINE,
            PAR_DOWNLOAD_RECEIPTS,
            PAR_VIEW_DUES,
            PAR_CHAT_TEACHERS,
            PAR_RECEIVE_ALERTS);

    private static final Set<String> LIBRARIAN = Set.of(
            LIB_MANAGE_INVENTORY,
            LIB_ISSUE_RETURN_BOOKS,
            LIB_TRACK_DUE_DATES,
            LIB_MANAGE_FINES,
            LIB_REPORTS_ISSUED_OVERDUE);

    private static final Set<String> ACCOUNTANT = Set.of(
            ACC_FEE_STRUCTURES_MANAGE,
            ACC_GENERATE_INVOICES,
            ACC_TRACK_PAYMENTS,
            ACC_HANDLE_REFUNDS,
            ACC_REVENUE_REPORTS,
            ACC_PENDING_DUES_REPORTS,
            ACC_VERIFY_PAYMENT_STATUS);

    private static final Set<String> RECEPTIONIST = Set.of(
            REC_ADMISSIONS_DATA_ENTRY,
            REC_HANDLE_INQUIRIES,
            REC_BASIC_REPORTS,
            REC_VISITOR_LOGS,
            REC_PRINT_DOCUMENTS);

    private static final Set<String> TRANSPORT = Set.of(
            TR_ROUTES_BUSES_MANAGE,
            TR_ASSIGN_STUDENTS_TO_ROUTES,
            TR_BUS_ATTENDANCE,
            TR_DELAY_NOTIFICATIONS);

    private static final Set<String> IT_SUPPORT = Set.of(
            USERS_ACCOUNTS_MANAGE,
            USERS_PASSWORD_RESET,
            INTEGRATIONS_CONFIGURE,
            SYSTEM_USAGE_MONITOR);

    private static final Set<String> COUNSELOR = Set.of(COUNSEL_STUDENT_SESSIONS, OPS_ESCALATION_HANDLE);

    private static final Set<String> EXAM_COORDINATOR = Set.of(EXAM_COORD_SCHEDULES, ACAD_VALIDATE_MARKS_BEFORE_PUBLISH);

    private static final Set<String> HOSTEL_WARDEN = Set.of(HOSTEL_ROSTER_MANAGE, OPS_DISCIPLINE_MONITOR, OPS_LEAVE_APPROVE);

    private static final Set<String> PRINCIPAL = union(
            VICE_PRINCIPAL,
            HOD,
            Set.of(
                    CLASS_STRUCTURES_APPROVE,
                    TIMETABLE_APPROVE,
                    TEACHER_PERFORMANCE_MONITOR,
                    ADMISSIONS_APPROVE,
                    TRANSFERS_TC_APPROVE,
                    EXAM_SCHEDULE_APPROVE,
                    EXAM_RESULTS_SCHOOL_VIEW,
                    ATTENDANCE_TRENDS_SCHOOL_VIEW,
                    FIN_VIEW_FEE_REPORTS,
                    FIN_APPROVE_FEE_WAIVERS,
                    ANNOUNCEMENTS_APPROVE_SCHOOL,
                    USERS_ROLES_ASSIGN,
                    TENANT_SETTINGS_VIEW));

    /** Broadest tenant role: union of operational domains (for defaults / tooling). */
    private static final Set<String> SCHOOL_ADMIN = union(
            PRINCIPAL,
            ACCOUNTANT,
            LIBRARIAN,
            RECEPTIONIST,
            TRANSPORT,
            IT_SUPPORT,
            TEACHER,
            CLASS_TEACHER_EXTRA,
            STUDENT,
            PARENT,
            COUNSELOR,
            EXAM_COORDINATOR,
            HOSTEL_WARDEN);

    private static final Set<String> ALL_TENANT = Set.copyOf(SCHOOL_ADMIN);

    private RolePermissionCatalog() {}

    public static Set<String> forRoleName(String roleName) {
        if (roleName == null) {
            return Set.of();
        }
        return switch (roleName) {
            case RoleNames.SCHOOL_ADMIN -> Set.copyOf(SCHOOL_ADMIN);
            case RoleNames.PRINCIPAL -> Set.copyOf(PRINCIPAL);
            case RoleNames.VICE_PRINCIPAL -> Set.copyOf(VICE_PRINCIPAL);
            case RoleNames.HOD -> Set.copyOf(HOD);
            case RoleNames.TEACHER -> Set.copyOf(TEACHER);
            case RoleNames.CLASS_TEACHER -> union(TEACHER, CLASS_TEACHER_EXTRA);
            case RoleNames.STUDENT -> Set.copyOf(STUDENT);
            case RoleNames.PARENT -> Set.copyOf(PARENT);
            case RoleNames.LIBRARIAN -> Set.copyOf(LIBRARIAN);
            case RoleNames.ACCOUNTANT -> Set.copyOf(ACCOUNTANT);
            case RoleNames.RECEPTIONIST -> Set.copyOf(RECEPTIONIST);
            case RoleNames.TRANSPORT_MANAGER -> Set.copyOf(TRANSPORT);
            case RoleNames.IT_SUPPORT -> Set.copyOf(IT_SUPPORT);
            case RoleNames.COUNSELOR -> Set.copyOf(COUNSELOR);
            case RoleNames.EXAM_COORDINATOR -> Set.copyOf(EXAM_COORDINATOR);
            case RoleNames.HOSTEL_WARDEN -> Set.copyOf(HOSTEL_WARDEN);
            default -> Set.of();
        };
    }

    public static Set<String> allTenantPermissions() {
        return ALL_TENANT;
    }

    @SafeVarargs
    private static Set<String> union(Set<String> first, Set<String>... rest) {
        HashSet<String> out = new HashSet<>(first);
        for (Set<String> s : rest) {
            out.addAll(s);
        }
        return Set.copyOf(out);
    }
}
