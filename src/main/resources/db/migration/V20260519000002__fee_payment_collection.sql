-- ─────────────────────────────────────────────────────────────────────────────
-- Fee Payment Collection
--
-- Migrates the old gateway-based fee_payments table to legacy_fee_payments,
-- then creates the new offline/manual payment tables:
--   fee_payments           — payment collected against student fee demands
--   fee_payment_allocations — links a payment to one or more demands
--   fee_receipts           — receipt document per payment
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Preserve old invoice-based payments ───────────────────────────────────
RENAME TABLE fee_payments TO legacy_fee_payments;

-- ── 2. New fee_payments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_payments (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    school_id           INT           NOT NULL,
    student_id          INT           NOT NULL,
    receipt_no          VARCHAR(64)   NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    payment_mode        VARCHAR(32)   NOT NULL COMMENT 'CASH|UPI|BANK_TRANSFER|CHEQUE|CARD|DEMAND_DRAFT|ADJUSTMENT',
    payment_date        DATE          NOT NULL,
    reference_no        VARCHAR(128)  NULL,
    notes               VARCHAR(512)  NULL,
    status              VARCHAR(16)   NOT NULL DEFAULT 'SUCCESS' COMMENT 'SUCCESS|PENDING|FAILED|CANCELLED',
    collected_by_user_id INT          NULL,
    created_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_fee_payment_receipt (school_id, receipt_no),
    KEY idx_fp_school   (school_id),
    KEY idx_fp_student  (student_id),
    KEY idx_fp_mode     (payment_mode),
    KEY idx_fp_date     (payment_date),
    KEY idx_fp_status   (status),
    CONSTRAINT fk_fp_school   FOREIGN KEY (school_id)  REFERENCES schools  (id) ON DELETE CASCADE,
    CONSTRAINT fk_fp_student  FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Offline/manual fee payment collected by accountant/admin.';

-- ── 3. fee_payment_allocations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_payment_allocations (
    id                    BIGINT        NOT NULL AUTO_INCREMENT,
    payment_id            BIGINT        NOT NULL,
    student_fee_demand_id BIGINT        NOT NULL,
    allocated_amount      DECIMAL(12,2) NOT NULL,
    created_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_fpa_payment_demand (payment_id, student_fee_demand_id),
    KEY idx_fpa_payment (payment_id),
    KEY idx_fpa_demand  (student_fee_demand_id),
    CONSTRAINT fk_fpa_payment FOREIGN KEY (payment_id)            REFERENCES fee_payments        (id) ON DELETE CASCADE,
    CONSTRAINT fk_fpa_demand  FOREIGN KEY (student_fee_demand_id) REFERENCES student_fee_demands (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Allocation of a payment amount across one or more fee demands.';

-- ── 4. fee_receipts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_receipts (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    payment_id      BIGINT       NOT NULL,
    receipt_no      VARCHAR(64)  NOT NULL,
    issued_at       DATETIME(6)  NOT NULL,
    pdf_url         VARCHAR(512) NULL,
    cancelled_at    DATETIME(6)  NULL,
    cancel_reason   VARCHAR(512) NULL,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_fr_payment (payment_id),
    KEY idx_fr_receipt_no (receipt_no),
    CONSTRAINT fk_fr_payment FOREIGN KEY (payment_id) REFERENCES fee_payments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Receipt document generated for a fee payment.';

