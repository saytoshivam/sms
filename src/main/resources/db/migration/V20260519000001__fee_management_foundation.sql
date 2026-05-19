-- ─────────────────────────────────────────────────────────────────────────────
-- Fee Management Foundation
--
-- Creates the core fee domain tables:
--   fee_heads            — what is being charged (master)
--   fee_plans            — fee structure template for an academic year
--   fee_plan_items       — one fee head entry scoped to school/class/section/student
--   fee_installments     — due-date schedule for a plan item
--   student_fee_demands  — actual payable record generated for each student
--
-- Principle: fee structure is a template; student_fee_demands is the actual
-- payable. Changing a fee plan after demands are generated does NOT silently
-- change existing demands.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── fee_heads ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_heads (
    id          INT          NOT NULL AUTO_INCREMENT,
    school_id   INT          NOT NULL,
    code        VARCHAR(32)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    description VARCHAR(512) NULL,
    fee_type    VARCHAR(32)  NOT NULL,
    refundable  TINYINT(1)   NOT NULL DEFAULT 0,
    optional    TINYINT(1)   NOT NULL DEFAULT 0,
    active      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_fee_head_school_code (school_id, code),
    KEY idx_fee_head_school (school_id),
    KEY idx_fee_head_school_id (school_id) -- Logical FK to schools.id (Hibernate-managed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master fee category definitions per school.';

-- ── fee_plans ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_plans (
    id               INT          NOT NULL AUTO_INCREMENT,
    school_id        INT          NOT NULL,
    academic_year_id INT          NOT NULL,
    name             VARCHAR(128) NOT NULL,
    description      VARCHAR(512) NULL,
    status           VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',
    published_at     DATETIME(6)  NULL,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_fee_plan_school (school_id),
    KEY idx_fee_plan_academic_year (academic_year_id),
    KEY idx_fee_plan_status (status),
    KEY idx_fee_plan_school_id (school_id),   -- Logical FK to schools.id (Hibernate-managed)
    CONSTRAINT fk_fee_plan_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fee plan (template) for a school academic year.';

-- ── fee_plan_items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_plan_items (
    id                    INT             NOT NULL AUTO_INCREMENT,
    fee_plan_id           INT             NOT NULL,
    fee_head_id           INT             NOT NULL,
    applicable_scope_type VARCHAR(16)     NOT NULL,
    applicable_scope_id   INT             NOT NULL,
    amount                DECIMAL(12,2)   NOT NULL,
    frequency             VARCHAR(16)     NOT NULL,
    mandatory             TINYINT(1)      NOT NULL DEFAULT 1,
    created_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at            DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_fpi_fee_plan (fee_plan_id),
    KEY idx_fpi_fee_head (fee_head_id),
    CONSTRAINT fk_fpi_fee_plan FOREIGN KEY (fee_plan_id) REFERENCES fee_plans (id) ON DELETE CASCADE,
    CONSTRAINT fk_fpi_fee_head FOREIGN KEY (fee_head_id) REFERENCES fee_heads (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Individual fee-head entries inside a fee plan, scoped to school/class/section/student.';

-- ── fee_installments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_installments (
    id               INT           NOT NULL AUTO_INCREMENT,
    fee_plan_item_id INT           NOT NULL,
    name             VARCHAR(128)  NOT NULL,
    due_date         DATE          NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    sequence         INT           NOT NULL,
    created_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_fi_fee_plan_item (fee_plan_item_id),
    KEY idx_fi_due_date (due_date),
    CONSTRAINT fk_fi_fee_plan_item FOREIGN KEY (fee_plan_item_id) REFERENCES fee_plan_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Installment schedule for a fee plan item.';

-- ── student_fee_demands ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_fee_demands (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    school_id          INT           NOT NULL,
    student_id         INT           NOT NULL,
    academic_year_id   INT           NOT NULL,
    fee_plan_id        INT           NOT NULL,
    fee_head_id        INT           NOT NULL,
    fee_plan_item_id   INT           NULL,
    fee_installment_id INT           NULL,
    demand_no          VARCHAR(64)   NOT NULL,
    description        VARCHAR(512)  NULL,
    original_amount    DECIMAL(12,2) NOT NULL,
    concession_amount  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    fine_amount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payable_amount     DECIMAL(12,2) NOT NULL,
    paid_amount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance_amount     DECIMAL(12,2) NOT NULL,
    due_date           DATE          NOT NULL,
    status             VARCHAR(16)   NOT NULL DEFAULT 'UNPAID',
    generated_at       DATETIME(6)   NOT NULL,
    created_at         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at         DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_demand_school_no (school_id, demand_no),
    KEY idx_sfd_school      (school_id),
    KEY idx_sfd_student     (student_id),
    KEY idx_sfd_academic_yr (academic_year_id),
    KEY idx_sfd_fee_plan    (fee_plan_id),
    KEY idx_sfd_fee_head    (fee_head_id),
    KEY idx_sfd_status      (status),
    KEY idx_sfd_due_date    (due_date),
    KEY idx_sfd_school_id  (school_id),   -- Logical FK to schools.id (Hibernate-managed)
    KEY idx_sfd_student_id (student_id),  -- Logical FK to students.id (Hibernate-managed)
    CONSTRAINT fk_sfd_academic_year   FOREIGN KEY (academic_year_id) REFERENCES academic_years   (id) ON DELETE RESTRICT,
    CONSTRAINT fk_sfd_fee_plan        FOREIGN KEY (fee_plan_id)      REFERENCES fee_plans        (id) ON DELETE RESTRICT,
    CONSTRAINT fk_sfd_fee_head        FOREIGN KEY (fee_head_id)      REFERENCES fee_heads        (id) ON DELETE RESTRICT,
    CONSTRAINT fk_sfd_fee_plan_item   FOREIGN KEY (fee_plan_item_id) REFERENCES fee_plan_items   (id) ON DELETE SET NULL,
    CONSTRAINT fk_sfd_fee_installment FOREIGN KEY (fee_installment_id) REFERENCES fee_installments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Actual payable demand generated for a student. Immutable snapshot from fee plan at generation.';
