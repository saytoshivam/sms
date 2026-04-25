-- Platform owner: tenant archive, global feature killswitch, audit trail, platform announcements, runtime flags, payment settings persistence.
-- Idempotent: Hibernate may have created these columns first; `schools` may not exist until after Hibernate runs.

SET @db := DATABASE();
SET @has_schools := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = @db AND table_name = 'schools'
);

SET @sql := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'archived') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN archived BIT(1) NOT NULL DEFAULT 0 AFTER nav_text_color'
    )
);
PREPARE stmt_schools_archived FROM @sql;
EXECUTE stmt_schools_archived;
DEALLOCATE PREPARE stmt_schools_archived;

SET @sql := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'schools' AND index_name = 'idx_schools_archived') > 0,
        'SELECT 1',
        'CREATE INDEX idx_schools_archived ON schools (archived)'
    )
);
PREPARE stmt_schools_idx FROM @sql;
EXECUTE stmt_schools_idx;
DEALLOCATE PREPARE stmt_schools_idx;

SET @sql := (
    SELECT IF(
        COUNT(*) > 0,
        'SELECT 1',
        'ALTER TABLE subscription_features ADD COLUMN globally_enabled BIT(1) NOT NULL DEFAULT 1 AFTER description'
    )
    FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'subscription_features' AND column_name = 'globally_enabled'
);
PREPARE stmt_sf_ge FROM @sql;
EXECUTE stmt_sf_ge;
DEALLOCATE PREPARE stmt_sf_ge;

CREATE TABLE IF NOT EXISTS platform_announcements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(512) NOT NULL,
    body TEXT NOT NULL,
    published BIT(1) NOT NULL DEFAULT 0,
    author_user_id INT NULL COMMENT 'Logical FK to users.id',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_platform_announcements_published (published, created_at DESC)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    occurred_at DATETIME(6) NOT NULL,
    actor_email VARCHAR(256),
    action VARCHAR(96) NOT NULL,
    resource_type VARCHAR(96),
    resource_id VARCHAR(128),
    detail TEXT,
    KEY idx_audit_occurred (occurred_at DESC),
    KEY idx_audit_actor (actor_email)
);

CREATE TABLE IF NOT EXISTS platform_feature_flags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    flag_key VARCHAR(128) NOT NULL,
    enabled BIT(1) NOT NULL DEFAULT 0,
    description VARCHAR(512),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_platform_feature_flags_key (flag_key)
);

INSERT INTO platform_feature_flags (flag_key, enabled, description, updated_at)
VALUES
    ('maintenance.mode', 0, 'When enabled, non–super-admin API calls may be rejected (hook points in code).', NOW(6)),
    ('signup.open', 1, 'Allow public / school self-registration flows when implemented.', NOW(6))
ON DUPLICATE KEY UPDATE description = VALUES(description);

CREATE TABLE IF NOT EXISTS platform_payment_settings (
    id INT NOT NULL PRIMARY KEY DEFAULT 1,
    public_base_url VARCHAR(512) NOT NULL DEFAULT 'http://localhost:8080',
    webhook_secret VARCHAR(256) NOT NULL DEFAULT 'change-me-payment-webhook',
    demo_auto_complete BIT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

INSERT INTO platform_payment_settings (id, public_base_url, webhook_secret, demo_auto_complete, updated_at)
VALUES (1, 'http://localhost:8080', 'change-me-payment-webhook', 0, NOW(6))
ON DUPLICATE KEY UPDATE id = id;
