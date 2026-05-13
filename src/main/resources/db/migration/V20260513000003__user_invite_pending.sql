-- ─────────────────────────────────────────────────────────────────────────────
-- User invite_pending flag
-- True when an invite has been recorded but the user has not been explicitly
-- activated. Used to distinguish the INVITED login state from ACTIVE/DISABLED.
-- ─────────────────────────────────────────────────────────────────────────────

DROP PROCEDURE IF EXISTS _mig_user_invite_pending;
CREATE PROCEDURE _mig_user_invite_pending()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.COLUMNS
        WHERE  TABLE_SCHEMA = DATABASE()
          AND  TABLE_NAME   = 'users'
          AND  COLUMN_NAME  = 'invite_pending'
    ) THEN
        ALTER TABLE users
            ADD COLUMN invite_pending TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '1 = invite recorded via send-invite; reset to 0 when login is enabled/disabled.';
    END IF;
END;
CALL _mig_user_invite_pending();
DROP PROCEDURE IF EXISTS _mig_user_invite_pending;

