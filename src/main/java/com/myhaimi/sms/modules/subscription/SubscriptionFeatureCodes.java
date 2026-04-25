package com.myhaimi.sms.modules.subscription;

/**
 * Canonical feature codes (must match {@code subscription_features.feature_code} seeds).
 */
public final class SubscriptionFeatureCodes {
    private SubscriptionFeatureCodes() {}

    public static final String CORE_STUDENTS = "core.students";
    public static final String CORE_ATTENDANCE = "core.attendance";
    public static final String ACADEMICS_SUBJECTS = "academics.subjects";
    public static final String ACADEMICS_TIMETABLE = "academics.timetable";
    public static final String ACADEMICS_EXAMS = "academics.exams";
    public static final String ACADEMICS_REPORT_CARDS_PDF = "academics.report_cards_pdf";
    public static final String FEES_BILLING = "fees.billing";
    public static final String FEES_ONLINE_PAYMENTS = "fees.online_payments";
    public static final String NOTIFICATIONS_EMAIL_SMS = "notifications.email_sms";
    public static final String PARENT_PORTAL = "parent.portal";
    public static final String ANALYTICS_ADVANCED = "analytics.advanced";
}
