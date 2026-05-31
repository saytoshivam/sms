-- ============================================================
-- Examination: reusable assessment schemes + assignments
-- Product not launched: cleanly remove draft schemes created by the
-- previous incorrect multi-select implementation.
-- ============================================================

-- 1) Remove bad empty draft schemes created as "Base [Grade X]" etc.
DELETE s
FROM assessment_schemes s
LEFT JOIN assessment_components c ON c.scheme_id = s.id
WHERE s.status = 'DRAFT'
  AND c.id IS NULL
  AND s.name REGEXP '\\[(Grade|Class|Section|Subject) [^]]+\\]';

-- 2) Assignments table. A scheme is now the reusable pattern; rows here
-- define where that pattern applies.
CREATE TABLE IF NOT EXISTS assessment_scheme_assignments (
    id               INT          NOT NULL AUTO_INCREMENT,
    school_id        INT          NOT NULL,
    scheme_id        INT          NOT NULL,
    academic_year_id INT          NOT NULL,
    scope_type       VARCHAR(32)  NOT NULL
        COMMENT 'SCHOOL | CLASS | SECTION | SUBJECT | CLASS_SUBJECT | SECTION_SUBJECT',
    class_group_id   INT          NULL,
    subject_id       INT          NULL,
    active           TINYINT(1)   NOT NULL DEFAULT 1,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    CONSTRAINT fk_asa_school FOREIGN KEY (school_id) REFERENCES schools(id),
    CONSTRAINT fk_asa_scheme FOREIGN KEY (scheme_id) REFERENCES assessment_schemes(id) ON DELETE CASCADE,
    CONSTRAINT fk_asa_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
    CONSTRAINT fk_asa_class_group FOREIGN KEY (class_group_id) REFERENCES class_groups(id),
    CONSTRAINT fk_asa_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),

    INDEX idx_asa_school_year (school_id, academic_year_id),
    INDEX idx_asa_scheme (scheme_id),
    INDEX idx_asa_scope (scope_type, class_group_id, subject_id, active),
    UNIQUE KEY uk_asa_same_scheme_target (scheme_id, scope_type, class_group_id, subject_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Migrate any remaining legacy scheme scope into one assignment per scheme.
INSERT INTO assessment_scheme_assignments (
    school_id, scheme_id, academic_year_id, scope_type, class_group_id, subject_id, active, created_at, updated_at
)
SELECT
    s.school_id,
    s.id,
    s.academic_year_id,
    s.applicable_scope_type,
    CASE
        WHEN s.applicable_scope_type IN ('CLASS', 'SECTION')
         AND EXISTS (SELECT 1 FROM class_groups cg WHERE cg.id = s.applicable_scope_id)
        THEN s.applicable_scope_id
        ELSE NULL
    END,
    CASE
        WHEN s.applicable_scope_type = 'SUBJECT'
         AND EXISTS (SELECT 1 FROM subjects sub WHERE sub.id = s.applicable_scope_id)
        THEN s.applicable_scope_id
        ELSE NULL
    END,
    1,
    CURRENT_TIMESTAMP(6),
    CURRENT_TIMESTAMP(6)
FROM assessment_schemes s
WHERE s.applicable_scope_type IS NOT NULL
  AND (
      s.applicable_scope_type = 'SCHOOL'
      OR (s.applicable_scope_type IN ('CLASS', 'SECTION') AND EXISTS (SELECT 1 FROM class_groups cg WHERE cg.id = s.applicable_scope_id))
      OR (s.applicable_scope_type = 'SUBJECT' AND EXISTS (SELECT 1 FROM subjects sub WHERE sub.id = s.applicable_scope_id))
  )
  AND NOT EXISTS (SELECT 1 FROM assessment_scheme_assignments a WHERE a.scheme_id = s.id);

-- 4) Drop legacy polymorphic scope columns from schemes.
ALTER TABLE assessment_schemes DROP INDEX idx_as_scope;
ALTER TABLE assessment_schemes DROP COLUMN applicable_scope_type;
ALTER TABLE assessment_schemes DROP COLUMN applicable_scope_id;


