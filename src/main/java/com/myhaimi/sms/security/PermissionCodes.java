package com.myhaimi.sms.security;

/**
 * Fine-grained capability strings for authorization. Mapped from roles in {@link RolePermissionCatalog} and
 * optionally gated by subscription features in {@link PermissionFeatureGates}.
 */
public final class PermissionCodes {

    // —— Cross-cutting / admin ——
    public static final String TENANT_SETTINGS_VIEW = "TENANT_SETTINGS_VIEW";
    public static final String USERS_ROLES_ASSIGN = "USERS_ROLES_ASSIGN";
    public static final String USERS_ACCOUNTS_MANAGE = "USERS_ACCOUNTS_MANAGE";
    public static final String USERS_PASSWORD_RESET = "USERS_PASSWORD_RESET";
    public static final String INTEGRATIONS_CONFIGURE = "INTEGRATIONS_CONFIGURE";
    public static final String SYSTEM_USAGE_MONITOR = "SYSTEM_USAGE_MONITOR";

    // —— Vice principal / operations ——
    public static final String OPS_DAILY_MANAGE = "OPS_DAILY_MANAGE";
    public static final String OPS_ATTENDANCE_OVERSEE = "OPS_ATTENDANCE_OVERSEE";
    public static final String OPS_DISCIPLINE_MONITOR = "OPS_DISCIPLINE_MONITOR";
    public static final String OPS_LEAVE_APPROVE = "OPS_LEAVE_APPROVE";
    public static final String OPS_ESCALATION_HANDLE = "OPS_ESCALATION_HANDLE";
    public static final String OPS_OPERATIONAL_REPORTS = "OPS_OPERATIONAL_REPORTS";

    // —— Principal / leadership (school) ——
    public static final String ADMISSIONS_APPROVE = "ADMISSIONS_APPROVE";
    public static final String TRANSFERS_TC_APPROVE = "TRANSFERS_TC_APPROVE";
    public static final String TIMETABLE_APPROVE = "TIMETABLE_APPROVE";
    public static final String CLASS_STRUCTURES_APPROVE = "CLASS_STRUCTURES_APPROVE";
    public static final String TEACHER_PERFORMANCE_MONITOR = "TEACHER_PERFORMANCE_MONITOR";
    public static final String EXAM_SCHEDULE_APPROVE = "EXAM_SCHEDULE_APPROVE";
    public static final String EXAM_RESULTS_SCHOOL_VIEW = "EXAM_RESULTS_SCHOOL_VIEW";
    public static final String ATTENDANCE_TRENDS_SCHOOL_VIEW = "ATTENDANCE_TRENDS_SCHOOL_VIEW";
    public static final String FIN_VIEW_FEE_REPORTS = "FIN_VIEW_FEE_REPORTS";
    public static final String FIN_APPROVE_FEE_WAIVERS = "FIN_APPROVE_FEE_WAIVERS";
    public static final String ANNOUNCEMENTS_APPROVE_SCHOOL = "ANNOUNCEMENTS_APPROVE_SCHOOL";

    // —— HOD / department ——
    public static final String ACAD_ASSIGN_SUBJECTS_TO_TEACHERS = "ACAD_ASSIGN_SUBJECTS_TO_TEACHERS";
    public static final String ACAD_REVIEW_SYLLABUS_COMPLETION = "ACAD_REVIEW_SYLLABUS_COMPLETION";
    public static final String ACAD_APPROVE_LESSON_PLANS = "ACAD_APPROVE_LESSON_PLANS";
    public static final String ACAD_VALIDATE_MARKS_BEFORE_PUBLISH = "ACAD_VALIDATE_MARKS_BEFORE_PUBLISH";
    public static final String ACAD_ANALYZE_SUBJECT_PERFORMANCE = "ACAD_ANALYZE_SUBJECT_PERFORMANCE";
    public static final String ACAD_MONITOR_TEACHER_ACTIVITY = "ACAD_MONITOR_TEACHER_ACTIVITY";

    // —— Teacher ——
    public static final String TCH_VIEW_ASSIGNED_CLASSES_SUBJECTS = "TCH_VIEW_ASSIGNED_CLASSES_SUBJECTS";
    public static final String TCH_UPLOAD_STUDY_MATERIAL = "TCH_UPLOAD_STUDY_MATERIAL";
    public static final String TCH_ASSIGN_HOMEWORK = "TCH_ASSIGN_HOMEWORK";
    public static final String TCH_MARK_ATTENDANCE = "TCH_MARK_ATTENDANCE";
    public static final String TCH_EDIT_ATTENDANCE_WINDOW = "TCH_EDIT_ATTENDANCE_WINDOW";
    public static final String TCH_ENTER_MARKS = "TCH_ENTER_MARKS";
    public static final String TCH_UPLOAD_INTERNAL_ASSESSMENTS = "TCH_UPLOAD_INTERNAL_ASSESSMENTS";
    public static final String TCH_MESSAGE_PARENTS_STUDENTS = "TCH_MESSAGE_PARENTS_STUDENTS";

    // —— Class teacher (adds to teacher) ——
    public static final String CT_CLASS_ATTENDANCE_OVERVIEW = "CT_CLASS_ATTENDANCE_OVERVIEW";
    public static final String CT_TRACK_STUDENT_PERFORMANCE = "CT_TRACK_STUDENT_PERFORMANCE";
    public static final String CT_CONTACT_ALL_CLASS_PARENTS = "CT_CONTACT_ALL_CLASS_PARENTS";
    public static final String CT_HANDLE_STUDENT_ISSUES = "CT_HANDLE_STUDENT_ISSUES";

    // —— Student ——
    public static final String STU_VIEW_PROFILE = "STU_VIEW_PROFILE";
    public static final String STU_VIEW_ATTENDANCE = "STU_VIEW_ATTENDANCE";
    public static final String STU_VIEW_TIMETABLE = "STU_VIEW_TIMETABLE";
    public static final String STU_VIEW_HOMEWORK = "STU_VIEW_HOMEWORK";
    public static final String STU_VIEW_EXAM_RESULTS = "STU_VIEW_EXAM_RESULTS";
    public static final String STU_DOWNLOAD_REPORT_CARDS = "STU_DOWNLOAD_REPORT_CARDS";
    public static final String STU_RECEIVE_NOTIFICATIONS = "STU_RECEIVE_NOTIFICATIONS";

    // —— Parent ——
    public static final String PAR_VIEW_CHILD_ATTENDANCE = "PAR_VIEW_CHILD_ATTENDANCE";
    public static final String PAR_VIEW_CHILD_PERFORMANCE = "PAR_VIEW_CHILD_PERFORMANCE";
    public static final String PAR_VIEW_CHILD_TIMETABLE = "PAR_VIEW_CHILD_TIMETABLE";
    public static final String PAR_PAY_FEES_ONLINE = "PAR_PAY_FEES_ONLINE";
    public static final String PAR_DOWNLOAD_RECEIPTS = "PAR_DOWNLOAD_RECEIPTS";
    public static final String PAR_VIEW_DUES = "PAR_VIEW_DUES";
    public static final String PAR_CHAT_TEACHERS = "PAR_CHAT_TEACHERS";
    public static final String PAR_RECEIVE_ALERTS = "PAR_RECEIVE_ALERTS";

    // —— Librarian ——
    public static final String LIB_MANAGE_INVENTORY = "LIB_MANAGE_INVENTORY";
    public static final String LIB_ISSUE_RETURN_BOOKS = "LIB_ISSUE_RETURN_BOOKS";
    public static final String LIB_TRACK_DUE_DATES = "LIB_TRACK_DUE_DATES";
    public static final String LIB_MANAGE_FINES = "LIB_MANAGE_FINES";
    public static final String LIB_REPORTS_ISSUED_OVERDUE = "LIB_REPORTS_ISSUED_OVERDUE";

    // —— Accountant ——
    public static final String ACC_FEE_STRUCTURES_MANAGE = "ACC_FEE_STRUCTURES_MANAGE";
    public static final String ACC_GENERATE_INVOICES = "ACC_GENERATE_INVOICES";
    public static final String ACC_TRACK_PAYMENTS = "ACC_TRACK_PAYMENTS";
    public static final String ACC_HANDLE_REFUNDS = "ACC_HANDLE_REFUNDS";
    public static final String ACC_REVENUE_REPORTS = "ACC_REVENUE_REPORTS";
    public static final String ACC_PENDING_DUES_REPORTS = "ACC_PENDING_DUES_REPORTS";
    public static final String ACC_VERIFY_PAYMENT_STATUS = "ACC_VERIFY_PAYMENT_STATUS";

    // —— Reception ——
    public static final String REC_ADMISSIONS_DATA_ENTRY = "REC_ADMISSIONS_DATA_ENTRY";
    public static final String REC_HANDLE_INQUIRIES = "REC_HANDLE_INQUIRIES";
    public static final String REC_BASIC_REPORTS = "REC_BASIC_REPORTS";
    public static final String REC_VISITOR_LOGS = "REC_VISITOR_LOGS";
    public static final String REC_PRINT_DOCUMENTS = "REC_PRINT_DOCUMENTS";

    // —— Transport ——
    public static final String TR_ROUTES_BUSES_MANAGE = "TR_ROUTES_BUSES_MANAGE";
    public static final String TR_ASSIGN_STUDENTS_TO_ROUTES = "TR_ASSIGN_STUDENTS_TO_ROUTES";
    public static final String TR_BUS_ATTENDANCE = "TR_BUS_ATTENDANCE";
    public static final String TR_DELAY_NOTIFICATIONS = "TR_DELAY_NOTIFICATIONS";

    // —— Counsellor / exam coord / hostel (light defaults) ——
    public static final String COUNSEL_STUDENT_SESSIONS = "COUNSEL_STUDENT_SESSIONS";
    public static final String EXAM_COORD_SCHEDULES = "EXAM_COORD_SCHEDULES";
    public static final String HOSTEL_ROSTER_MANAGE = "HOSTEL_ROSTER_MANAGE";

    private PermissionCodes() {}
}
