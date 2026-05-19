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
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1a. Drop FK that allowed SET NULL ────────────────────────────────────────
ALTER TABLE student_fee_demands
    DROP FOREIGN KEY fk_sfd_fee_plan_item;

ALTER TABLE student_fee_demands
    DROP FOREIGN KEY fk_sfd_fee_installment;

-- ── 1b. Make columns NOT NULL  ────────────────────────────────────────────────
-- Safe because FeeDemandService always supplies both values; existing rows were
-- inserted via the same code path.
ALTER TABLE student_fee_demands
    MODIFY COLUMN fee_plan_item_id   INT NOT NULL,
    MODIFY COLUMN fee_installment_id INT NOT NULL;

-- ── 1c. Re-add FKs with RESTRICT (no silent NULLing of parent pointers) ───────
ALTER TABLE student_fee_demands
    ADD CONSTRAINT fk_sfd_fee_plan_item   FOREIGN KEY (fee_plan_item_id)   REFERENCES fee_plan_items   (id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_sfd_fee_installment FOREIGN KEY (fee_installment_id) REFERENCES fee_installments (id) ON DELETE RESTRICT;

-- ── 2. Idempotency unique constraint on demand generation ─────────────────────
ALTER TABLE student_fee_demands
    ADD UNIQUE KEY uq_sfd_student_item_installment (school_id, student_id, fee_plan_item_id, fee_installment_id);

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
    CONSTRAINT fk_school_seq_school FOREIGN KEY (school_id) REFERENCES schools (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Atomic per-school sequence counters for financial document numbers.';

