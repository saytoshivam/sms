-- ============================================================
-- Examination Module: Student Assessment Marks
-- ============================================================

CREATE TABLE IF NOT EXISTS student_assessment_marks (
    id                     INT            NOT NULL AUTO_INCREMENT,
    school_id              INT            NOT NULL,
    assessment_instance_id INT            NOT NULL,
    student_id             INT            NOT NULL,
    marks_obtained         DECIMAL(6,2)   NULL
        COMMENT 'NULL when absent; must be <= assessment_instances.max_marks',
    absent                 TINYINT(1)     NOT NULL DEFAULT 0,
    absent_reason          VARCHAR(256)   NULL,
    remarks                VARCHAR(512)   NULL,
    status                 VARCHAR(16)    NOT NULL DEFAULT 'DRAFT'
        COMMENT 'DRAFT | SUBMITTED | LOCKED',
    entered_by             VARCHAR(256)   NULL,
    submitted_at           DATETIME(6)    NULL,
    locked_at              DATETIME(6)    NULL,
    created_at             DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at             DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    CONSTRAINT fk_sam_school    FOREIGN KEY (school_id)              REFERENCES schools (id),
    CONSTRAINT fk_sam_instance  FOREIGN KEY (assessment_instance_id) REFERENCES assessment_instances (id),
    CONSTRAINT fk_sam_student   FOREIGN KEY (student_id)             REFERENCES students (id),
    CONSTRAINT chk_sam_marks    CHECK (marks_obtained IS NULL OR marks_obtained >= 0),

    UNIQUE KEY uk_sam_instance_student (assessment_instance_id, student_id),
    INDEX idx_sam_instance (assessment_instance_id),
    INDEX idx_sam_student  (student_id),
    INDEX idx_sam_school   (school_id),
    INDEX idx_sam_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

