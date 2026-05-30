-- ============================================================
-- Examination Module: Assessment Instances (scheduling layer)
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_instances (
    id               INT            NOT NULL AUTO_INCREMENT,
    school_id        INT            NOT NULL,
    academic_year_id INT            NOT NULL,
    scheme_id        INT            NOT NULL,
    component_id     INT            NOT NULL,
    name             VARCHAR(128)   NOT NULL,
    subject_id       INT            NOT NULL,
    class_group_id   INT            NOT NULL,
    assessment_date  DATE           NULL,
    start_time       TIME           NULL,
    end_time         TIME           NULL,
    room_id          INT            NULL,
    max_marks        DECIMAL(6,2)   NOT NULL,
    status           VARCHAR(24)    NOT NULL DEFAULT 'DRAFT'
        COMMENT 'DRAFT | SCHEDULED | MARKS_ENTRY_OPEN | MARKS_SUBMITTED | LOCKED | PUBLISHED | CANCELLED',
    sequence         INT            NOT NULL,
    created_at       DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    CONSTRAINT fk_ai_school        FOREIGN KEY (school_id) REFERENCES schools (id),
    CONSTRAINT fk_ai_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id),
    CONSTRAINT fk_ai_scheme        FOREIGN KEY (scheme_id) REFERENCES assessment_schemes (id),
    CONSTRAINT fk_ai_component     FOREIGN KEY (component_id) REFERENCES assessment_components (id),
    CONSTRAINT fk_ai_subject       FOREIGN KEY (subject_id) REFERENCES subjects (id),
    CONSTRAINT fk_ai_class_group   FOREIGN KEY (class_group_id) REFERENCES class_groups (id),
    CONSTRAINT fk_ai_room          FOREIGN KEY (room_id) REFERENCES rooms (id),
    CONSTRAINT chk_ai_max_marks    CHECK (max_marks > 0),

    INDEX idx_ai_school_ay       (school_id, academic_year_id),
    INDEX idx_ai_class_subject   (class_group_id, subject_id),
    INDEX idx_ai_scheme_component(scheme_id, component_id),
    INDEX idx_ai_status          (status),
    UNIQUE KEY uk_ai_name_scope  (school_id, component_id, class_group_id, subject_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

