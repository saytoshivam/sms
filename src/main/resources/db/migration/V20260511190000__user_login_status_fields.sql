-- ─────────────────────────────────────────────────────────────────────────────
-- User login lifecycle fields
-- Phase 1: enabled flag + invite tracking
-- Uses stored-procedure guards because MySQL does not support
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS (that is MariaDB syntax).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── enabled ──────────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _migration_add_enabled;
CREATE PROCEDURE _migration_add_enabled()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.COLUMNS
        WHERE  TABLE_SCHEMA = DATABASE()
          AND  TABLE_NAME   = 'users'
          AND  COLUMN_NAME  = 'enabled'
    ) THEN
        ALTER TABLE users
            ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '0 = login disabled by admin';
    END IF;
END;
CALL _migration_add_enabled();
DROP PROCEDURE IF EXISTS _migration_add_enabled;

-- ── last_invite_sent_at ───────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _migration_add_invite_ts;
CREATE PROCEDURE _migration_add_invite_ts()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.COLUMNS
        WHERE  TABLE_SCHEMA = DATABASE()
          AND  TABLE_NAME   = 'users'
          AND  COLUMN_NAME  = 'last_invite_sent_at'
    ) THEN
        ALTER TABLE users
            ADD COLUMN last_invite_sent_at DATETIME(6) NULL
                COMMENT 'Timestamp of last invite/welcome email dispatch request';
    END IF;
END;
CALL _migration_add_invite_ts();
DROP PROCEDURE IF EXISTS _migration_add_invite_ts;
