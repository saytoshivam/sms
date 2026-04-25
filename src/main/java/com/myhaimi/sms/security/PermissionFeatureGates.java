package com.myhaimi.sms.security;

import com.myhaimi.sms.modules.subscription.SubscriptionFeatureCodes;

import java.util.HashMap;
import java.util.Map;

/**
 * Optional subscription feature required for a permission to be effective. If the tenant's plan does not include the
 * feature, the permission is treated as inactive (UI/API should block), even if the user's role grants the permission.
 */
public final class PermissionFeatureGates {

    private static final Map<String, String> PERMISSION_TO_FEATURE = new HashMap<>();

    static {
        // Attendance
        gate(PermissionCodes.OPS_ATTENDANCE_OVERSEE, SubscriptionFeatureCodes.CORE_ATTENDANCE);
        gate(PermissionCodes.TCH_MARK_ATTENDANCE, SubscriptionFeatureCodes.CORE_ATTENDANCE);
        gate(PermissionCodes.TCH_EDIT_ATTENDANCE_WINDOW, SubscriptionFeatureCodes.CORE_ATTENDANCE);
        gate(PermissionCodes.CT_CLASS_ATTENDANCE_OVERVIEW, SubscriptionFeatureCodes.CORE_ATTENDANCE);
        gate(PermissionCodes.STU_VIEW_ATTENDANCE, SubscriptionFeatureCodes.CORE_ATTENDANCE);
        gate(PermissionCodes.PAR_VIEW_CHILD_ATTENDANCE, SubscriptionFeatureCodes.CORE_ATTENDANCE);
        gate(PermissionCodes.TR_BUS_ATTENDANCE, SubscriptionFeatureCodes.CORE_STUDENTS);
        gate(PermissionCodes.ATTENDANCE_TRENDS_SCHOOL_VIEW, SubscriptionFeatureCodes.CORE_ATTENDANCE);

        // Students / academics
        gate(PermissionCodes.TCH_VIEW_ASSIGNED_CLASSES_SUBJECTS, SubscriptionFeatureCodes.ACADEMICS_SUBJECTS);
        gate(PermissionCodes.ACAD_ASSIGN_SUBJECTS_TO_TEACHERS, SubscriptionFeatureCodes.ACADEMICS_SUBJECTS);
        gate(PermissionCodes.ACAD_REVIEW_SYLLABUS_COMPLETION, SubscriptionFeatureCodes.ACADEMICS_SUBJECTS);
        gate(PermissionCodes.ACAD_APPROVE_LESSON_PLANS, SubscriptionFeatureCodes.ACADEMICS_SUBJECTS);
        gate(PermissionCodes.ACAD_MONITOR_TEACHER_ACTIVITY, SubscriptionFeatureCodes.ACADEMICS_SUBJECTS);
        gate(PermissionCodes.TIMETABLE_APPROVE, SubscriptionFeatureCodes.ACADEMICS_TIMETABLE);
        gate(PermissionCodes.STU_VIEW_TIMETABLE, SubscriptionFeatureCodes.ACADEMICS_TIMETABLE);
        gate(PermissionCodes.PAR_VIEW_CHILD_TIMETABLE, SubscriptionFeatureCodes.ACADEMICS_TIMETABLE);

        // Exams / marks
        gate(PermissionCodes.TCH_ENTER_MARKS, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.TCH_UPLOAD_INTERNAL_ASSESSMENTS, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.ACAD_VALIDATE_MARKS_BEFORE_PUBLISH, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.ACAD_ANALYZE_SUBJECT_PERFORMANCE, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.EXAM_SCHEDULE_APPROVE, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.EXAM_RESULTS_SCHOOL_VIEW, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.STU_VIEW_EXAM_RESULTS, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.PAR_VIEW_CHILD_PERFORMANCE, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.CT_TRACK_STUDENT_PERFORMANCE, SubscriptionFeatureCodes.ACADEMICS_EXAMS);
        gate(PermissionCodes.STU_DOWNLOAD_REPORT_CARDS, SubscriptionFeatureCodes.ACADEMICS_REPORT_CARDS_PDF);

        // Fees
        gate(PermissionCodes.FIN_VIEW_FEE_REPORTS, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.FIN_APPROVE_FEE_WAIVERS, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.ACC_FEE_STRUCTURES_MANAGE, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.ACC_GENERATE_INVOICES, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.ACC_TRACK_PAYMENTS, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.ACC_HANDLE_REFUNDS, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.ACC_REVENUE_REPORTS, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.ACC_PENDING_DUES_REPORTS, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.ACC_VERIFY_PAYMENT_STATUS, SubscriptionFeatureCodes.FEES_BILLING);
        gate(PermissionCodes.PAR_PAY_FEES_ONLINE, SubscriptionFeatureCodes.FEES_ONLINE_PAYMENTS);
        gate(PermissionCodes.PAR_DOWNLOAD_RECEIPTS, SubscriptionFeatureCodes.FEES_ONLINE_PAYMENTS);
        gate(PermissionCodes.PAR_VIEW_DUES, SubscriptionFeatureCodes.FEES_BILLING);

        // Parent portal / comms
        gate(PermissionCodes.PAR_CHAT_TEACHERS, SubscriptionFeatureCodes.PARENT_PORTAL);
        gate(PermissionCodes.TCH_MESSAGE_PARENTS_STUDENTS, SubscriptionFeatureCodes.NOTIFICATIONS_EMAIL_SMS);
        gate(PermissionCodes.CT_CONTACT_ALL_CLASS_PARENTS, SubscriptionFeatureCodes.PARENT_PORTAL);
        gate(PermissionCodes.STU_RECEIVE_NOTIFICATIONS, SubscriptionFeatureCodes.NOTIFICATIONS_EMAIL_SMS);
        gate(PermissionCodes.PAR_RECEIVE_ALERTS, SubscriptionFeatureCodes.NOTIFICATIONS_EMAIL_SMS);

        // Student self-service
        gate(PermissionCodes.STU_VIEW_PROFILE, SubscriptionFeatureCodes.CORE_STUDENTS);
        gate(PermissionCodes.STU_VIEW_HOMEWORK, SubscriptionFeatureCodes.ACADEMICS_SUBJECTS);

        // Analytics
        gate(PermissionCodes.OPS_OPERATIONAL_REPORTS, SubscriptionFeatureCodes.ANALYTICS_ADVANCED);
        gate(PermissionCodes.TEACHER_PERFORMANCE_MONITOR, SubscriptionFeatureCodes.ANALYTICS_ADVANCED);
    }

    private PermissionFeatureGates() {}

    private static void gate(String permission, String featureCode) {
        PERMISSION_TO_FEATURE.put(permission, featureCode);
    }

    /** @return required feature code, or null if no subscription gate applies */
    public static String requiredFeature(String permissionCode) {
        return PERMISSION_TO_FEATURE.get(permissionCode);
    }
}
