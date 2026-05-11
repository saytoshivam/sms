-- ─────────────────────────────────────────────────────────────────────────────
-- School Document Requirements  — per-school configurable document checklist
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_document_requirements (
    id                  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    school_id           INT          NOT NULL,
    document_type_id    INT          NOT NULL,
    target_type         VARCHAR(32)  NOT NULL  COMMENT 'STUDENT | TEACHER | GUARDIAN | STAFF',
    requirement_status  VARCHAR(32)  NOT NULL  DEFAULT 'REQUIRED'
                        COMMENT 'REQUIRED | OPTIONAL | NOT_REQUIRED',
    is_active           TINYINT(1)   NOT NULL  DEFAULT 1,
    sort_order          INT          NOT NULL  DEFAULT 100,
    created_at          DATETIME(6)  NOT NULL,
    updated_at          DATETIME(6)  NOT NULL,
    UNIQUE KEY uq_sdr_school_doctype_target (school_id, document_type_id, target_type),
    INDEX idx_sdr_school_target (school_id, target_type),
    CONSTRAINT fk_sdr_school   FOREIGN KEY (school_id)        REFERENCES schools(id)        ON DELETE CASCADE,
    CONSTRAINT fk_sdr_doctype  FOREIGN KEY (document_type_id) REFERENCES document_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add document_type_id FK column to student_documents (safe for MySQL 5.7+)
SET @col_sd_dt := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'student_documents'
      AND COLUMN_NAME  = 'document_type_id'
);
SET @sql := IF(@col_sd_dt = 0,
    'ALTER TABLE student_documents ADD COLUMN document_type_id INT NULL',
    'SELECT 1 -- document_type_id already exists');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

