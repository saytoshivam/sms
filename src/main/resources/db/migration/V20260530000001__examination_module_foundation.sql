-- ============================================================
-- Examination Module: Assessment Schemes, Components,
--                     Grading Schemes, Grading Bands
-- Clean schema – product not launched; no backward compat needed.
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. assessment_schemes
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_schemes (
    id                    INT          NOT NULL AUTO_INCREMENT,
    school_id             INT          NOT NULL,
    academic_year_id      INT          NOT NULL,
    name                  VARCHAR(128) NOT NULL,
    description           TEXT,
    applicable_scope_type VARCHAR(32)  NOT NULL
        COMMENT 'SCHOOL | CLASS | SECTION | SUBJECT',
    applicable_scope_id   INT          NULL
        COMMENT 'FK to classgroup / subject depending on scope; NULL for SCHOOL scope',
    status                VARCHAR(16)  NOT NULL DEFAULT 'DRAFT'
        COMMENT 'DRAFT | PUBLISHED | ARCHIVED',
    version_no            INT          NOT NULL DEFAULT 1,
    published_at          DATETIME(6)  NULL,
    archived_at           DATETIME(6)  NULL,
    created_at            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    CONSTRAINT fk_as_school      FOREIGN KEY (school_id)        REFERENCES schools (id),
    CONSTRAINT fk_as_academic_yr FOREIGN KEY (academic_year_id) REFERENCES academic_years (id),

    INDEX idx_as_school        (school_id),
    INDEX idx_as_academic_year (academic_year_id),
    INDEX idx_as_status        (status),
    INDEX idx_as_scope         (applicable_scope_type, applicable_scope_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- 2. assessment_components
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_components (
    id               INT            NOT NULL AUTO_INCREMENT,
    scheme_id        INT            NOT NULL,
    name             VARCHAR(128)   NOT NULL,
    component_type   VARCHAR(32)    NOT NULL
        COMMENT 'CONTINUOUS_ASSESSMENT | MID_TERM | END_TERM | PRACTICAL | PROJECT | ASSIGNMENT | ATTENDANCE | NOTEBOOK | VIVA | OTHER',
    weightage_percent DECIMAL(5,2)  NOT NULL
        COMMENT 'Percentage share in final result; must be > 0',
    max_marks        DECIMAL(6,2)   NULL
        COMMENT 'NULL allowed for ATTENDANCE_PERCENTAGE rule',
    calculation_rule VARCHAR(32)    NOT NULL
        COMMENT 'SINGLE_ASSESSMENT | SUM | AVERAGE | BEST_N_OF_M | HIGHEST | MANUAL | ATTENDANCE_PERCENTAGE',
    total_assessments INT           NULL
        COMMENT 'Total tests conducted; required for BEST_N_OF_M / SUM / AVERAGE',
    best_of_count    INT            NULL
        COMMENT 'Top-N to consider; required for BEST_N_OF_M; must be <= total_assessments',
    sequence         INT            NOT NULL,
    mandatory        TINYINT(1)     NOT NULL DEFAULT 1,
    created_at       DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    CONSTRAINT fk_ac_scheme FOREIGN KEY (scheme_id) REFERENCES assessment_schemes (id) ON DELETE CASCADE,
    CONSTRAINT chk_ac_weightage CHECK (weightage_percent > 0),
    CONSTRAINT chk_ac_best_of   CHECK (best_of_count IS NULL OR total_assessments IS NULL OR best_of_count <= total_assessments),

    INDEX idx_ac_scheme (scheme_id),
    UNIQUE KEY uk_ac_sequence (scheme_id, sequence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- 3. grading_schemes
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_schemes (
    id               INT          NOT NULL AUTO_INCREMENT,
    school_id        INT          NOT NULL,
    academic_year_id INT          NULL,
    name             VARCHAR(128) NOT NULL,
    active           TINYINT(1)   NOT NULL DEFAULT 1,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    CONSTRAINT fk_gs_school      FOREIGN KEY (school_id)        REFERENCES schools (id),
    CONSTRAINT fk_gs_academic_yr FOREIGN KEY (academic_year_id) REFERENCES academic_years (id),

    INDEX idx_gs_school        (school_id),
    INDEX idx_gs_academic_year (academic_year_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ──────────────────────────────────────────────
-- 4. grading_bands
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_bands (
    id                INT           NOT NULL AUTO_INCREMENT,
    grading_scheme_id INT           NOT NULL,
    grade             VARCHAR(16)   NOT NULL,
    min_percent       DECIMAL(5,2)  NOT NULL,
    max_percent       DECIMAL(5,2)  NOT NULL,
    grade_point       DECIMAL(4,2)  NULL,
    remarks           VARCHAR(128)  NULL,
    sequence          INT           NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_gb_scheme FOREIGN KEY (grading_scheme_id) REFERENCES grading_schemes (id) ON DELETE CASCADE,

    INDEX idx_gb_scheme (grading_scheme_id),
    UNIQUE KEY uk_gb_sequence (grading_scheme_id, sequence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
