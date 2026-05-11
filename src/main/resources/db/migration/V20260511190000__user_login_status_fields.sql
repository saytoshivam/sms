-- ─────────────────────────────────────────────────────────────────────────────
-- User login lifecycle fields
-- Phase 1: enabled flag + invite tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS enabled             TINYINT(1)  NOT NULL DEFAULT 1
        COMMENT '0 = login disabled by admin',
    ADD COLUMN IF NOT EXISTS last_invite_sent_at DATETIME(6) NULL
        COMMENT 'Timestamp of last invite/welcome email dispatch request';

