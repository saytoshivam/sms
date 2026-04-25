INSERT INTO subscription_plans (plan_code, name, description, active, created_at, updated_at)
VALUES
    ('BASIC', 'Basic', 'Core student and attendance workflows', 1, NOW(6), NOW(6)),
    ('PREMIUM', 'Premium', 'Adds exams, timetable, and parent portal', 1, NOW(6), NOW(6)),
    ('ENTERPRISE', 'Enterprise', 'Adds PDF report cards, online payments, and advanced analytics', 1, NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    updated_at = VALUES(updated_at);

INSERT INTO subscription_features (feature_code, name, description, created_at, updated_at)
VALUES
    ('core.students', 'Students', 'Student profiles and admissions', NOW(6), NOW(6)),
    ('core.attendance', 'Attendance', 'Daily attendance and reports', NOW(6), NOW(6)),
    ('academics.subjects', 'Subjects', 'Subjects catalog', NOW(6), NOW(6)),
    ('academics.timetable', 'Timetable', 'Class timetable', NOW(6), NOW(6)),
    ('academics.exams', 'Exams', 'Exam scheduling and marks', NOW(6), NOW(6)),
    ('academics.report_cards_pdf', 'Report cards (PDF)', 'Generated report cards', NOW(6), NOW(6)),
    ('fees.billing', 'Fee billing', 'Invoices and fee structures', NOW(6), NOW(6)),
    ('fees.online_payments', 'Online payments', 'Integrates with payment service', NOW(6), NOW(6)),
    ('notifications.email_sms', 'Notifications', 'Email/SMS via notification service', NOW(6), NOW(6)),
    ('parent.portal', 'Parent portal', 'Parent dashboards and messaging', NOW(6), NOW(6)),
    ('analytics.advanced', 'Advanced analytics', 'Cross-school analytics (enterprise)', NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    updated_at = VALUES(updated_at);

-- BASIC
INSERT INTO subscription_plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, 1
FROM subscription_plans p
JOIN subscription_features f ON f.feature_code IN (
                                                     'core.students',
                                                     'core.attendance',
                                                     'academics.subjects',
                                                     'fees.billing'
    )
WHERE p.plan_code = 'BASIC'
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);

-- PREMIUM = BASIC superset + extras
INSERT INTO subscription_plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, 1
FROM subscription_plans p
JOIN subscription_features f ON f.feature_code IN (
                                                     'core.students',
                                                     'core.attendance',
                                                     'academics.subjects',
                                                     'academics.timetable',
                                                     'academics.exams',
                                                     'fees.billing',
                                                     'notifications.email_sms',
                                                     'parent.portal'
    )
WHERE p.plan_code = 'PREMIUM'
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);

-- ENTERPRISE = all catalog features ON
INSERT INTO subscription_plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, 1
FROM subscription_plans p
JOIN subscription_features f ON 1 = 1
WHERE p.plan_code = 'ENTERPRISE'
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);
