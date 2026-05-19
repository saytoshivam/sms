-- ─────────────────────────────────────────────────────────────────────────────
-- Fee Engine Hardening
--
-- 1. Drop old ON DELETE SET NULL FKs on student_fee_demands and make
--    fee_plan_item_id / fee_installment_id NOT NULL (every demand must link
--    to a specific plan item AND installment — no orphaned demands).
-- 2. Add composite unique constraint that makes demand generation idempotent:
--    (school_id, student_id, fee_plan_item_id, fee_installment_id)
-- 3. Create school_sequences table for safe, lock-based sequence generation.
--    Replaces COUNT+1 patterns used for demand numbers and receipt numbers.
--
-- Note: all ALTER operations are wrapped in stored procedures for idempotency
-- (the CREATE TABLE fails with a syntax error on first run → Flyway marks it
-- failed → repair() re-runs the entire script, so every statement must be safe
-- to run multiple times).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1a. Drop FK that allowed SET NULL (idempotent) ───────────────────────────
DROP PROCEDURE IF EXISTS _sp_fee_drop_fk_plan_item;
CREATE PROCEDURE _sp_fee_drop_fk_plan_item()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'student_fee_demands'
          AND CONSTRAINT_NAME = 'fk_sfd_fee_plan_item'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE student_fee_demands DROP FOREIGN KEY fk_sfd_fee_plan_item;
    END IF;
END;
CALL _sp_fee_drop_fk_plan_item();
DROP PROCEDURE IF EXISTS _sp_fee_drop_fk_plan_item;

DROP PROCEDURE IF EXISTS _sp_fee_drop_fk_installment;
CREATE PROCEDURE _sp_fee_drop_fk_installment()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'student_fee_demands'
          AND CONSTRAINT_NAME = 'fk_sfd_fee_installment'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE student_fee_demands DROP FOREIGN KEY fk_sfd_fee_installment;
    END IF;
END;
CALL _sp_fee_drop_fk_installment();
DROP PROCEDURE IF EXISTS _sp_fee_drop_fk_installment;

-- ── 1b. Make columns NOT NULL (idempotent — MODIFY is safe to repeat) ─────────
ALTER TABLE student_fee_demands
    MODIFY COLUMN fee_plan_item_id   INT NOT NULL,
    MODIFY COLUMN fee_installment_id INT NOT NULL;

-- ── 1c. Re-add FKs with RESTRICT (idempotent) ────────────────────────────────
DROP PROCEDURE IF EXISTS _sp_fee_add_fk_plan_item;
CREATE PROCEDURE _sp_fee_add_fk_plan_item()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'student_fee_demands'
          AND CONSTRAINT_NAME = 'fk_sfd_fee_plan_item'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE student_fee_demands
            ADD CONSTRAINT fk_sfd_fee_plan_item FOREIGN KEY (fee_plan_item_id) REFERENCES fee_plan_items (id) ON DELETE RESTRICT;
    END IF;
END;
CALL _sp_fee_add_fk_plan_item();
DROP PROCEDURE IF EXISTS _sp_fee_add_fk_plan_item;

DROP PROCEDURE IF EXISTS _sp_fee_add_fk_installment;
CREATE PROCEDURE _sp_fee_add_fk_installment()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'student_fee_demands'
          AND CONSTRAINT_NAME = 'fk_sfd_fee_installment'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE student_fee_demands
            ADD CONSTRAINT fk_sfd_fee_installment FOREIGN KEY (fee_installment_id) REFERENCES fee_installments (id) ON DELETE RESTRICT;
    END IF;
END;
CALL _sp_fee_add_fk_installment();
DROP PROCEDURE IF EXISTS _sp_fee_add_fk_installment;

-- ── 2. Idempotency unique constraint on demand generation ─────────────────────
DROP PROCEDURE IF EXISTS _sp_fee_add_unique;
CREATE PROCEDURE _sp_fee_add_unique()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'student_fee_demands'
          AND INDEX_NAME   = 'uq_sfd_student_item_installment'
    ) THEN
        ALTER TABLE student_fee_demands
            ADD UNIQUE KEY uq_sfd_student_item_installment (school_id, student_id, fee_plan_item_id, fee_installment_id);
    END IF;
END;
CALL _sp_fee_add_unique();
DROP PROCEDURE IF EXISTS _sp_fee_add_unique;

-- ── 3. school_sequences – safe, locked, school-scoped sequence counters ───────
CREATE TABLE IF NOT EXISTS school_sequences (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    school_id      INT          NOT NULL,
    sequence_type  VARCHAR(32)  NOT NULL  COMMENT 'FEE_DEMAND | FEE_RECEIPT',
    current_value  BIGINT       NOT NULL  DEFAULT 0,
    updated_at     DATETIME(6)  NOT NULL  DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_school_seq_type (school_id, sequence_type),
    KEY idx_school_seq_school (school_id),
    KEY idx_school_seq_school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Atomic per-school sequence counters for financial document numbers.';
