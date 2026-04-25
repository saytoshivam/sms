-- Add class-level subject templates + section-level overrides (nullable fallbacks)
-- MySQL 8+

SET @db := DATABASE();

-- 1) class_subject_configs (grade-level template)
SET @has_csc := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'class_subject_configs'
);

SET @stmt := IF(
    @has_csc > 0,
    'SELECT 1',
    'CREATE TABLE class_subject_configs (\n'
    '  id BIGINT NOT NULL AUTO_INCREMENT,\n'
    '  school_id INT NOT NULL,\n'
    '  grade_level INT NOT NULL,\n'
    '  subject_id INT NOT NULL,\n'
    '  default_periods_per_week INT NOT NULL,\n'
    '  staff_id INT NULL,\n'
    '  room_id INT NULL,\n'
    '  PRIMARY KEY (id),\n'
    '  UNIQUE KEY uq_class_subject_cfg (school_id, grade_level, subject_id),\n'
    '  KEY idx_csc_school (school_id),\n'
    '  KEY idx_csc_grade (school_id, grade_level),\n'
    '  KEY idx_csc_subject (subject_id),\n'
    '  KEY idx_csc_staff (staff_id),\n'
    '  KEY idx_csc_room (room_id),\n'
    '  CONSTRAINT fk_csc_school FOREIGN KEY (school_id) REFERENCES schools(id),\n'
    '  CONSTRAINT fk_csc_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),\n'
    '  CONSTRAINT fk_csc_staff FOREIGN KEY (staff_id) REFERENCES staff(id),\n'
    '  CONSTRAINT fk_csc_room FOREIGN KEY (room_id) REFERENCES rooms(id)\n'
    ') ENGINE=InnoDB'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) subject_section_overrides: add nullable override fields
SET @has_sso := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'subject_section_overrides'
);

-- periods_per_week
SET @stmt := IF(
    @has_sso = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'subject_section_overrides' AND column_name = 'periods_per_week') > 0,
        'SELECT 1',
        'ALTER TABLE subject_section_overrides ADD COLUMN periods_per_week INT NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- staff_id
SET @stmt := IF(
    @has_sso = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'subject_section_overrides' AND column_name = 'staff_id') > 0,
        'SELECT 1',
        'ALTER TABLE subject_section_overrides ADD COLUMN staff_id INT NULL, ADD KEY idx_sso_staff (staff_id), ADD CONSTRAINT fk_sso_staff FOREIGN KEY (staff_id) REFERENCES staff(id)'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- room_id
SET @stmt := IF(
    @has_sso = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'subject_section_overrides' AND column_name = 'room_id') > 0,
        'SELECT 1',
        'ALTER TABLE subject_section_overrides ADD COLUMN room_id INT NULL, ADD KEY idx_sso_room (room_id), ADD CONSTRAINT fk_sso_room FOREIGN KEY (room_id) REFERENCES rooms(id)'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) subject_allocations.staff_id nullable (teacher optional)
SET @has_sa := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'subject_allocations'
);
SET @stmt := IF(
    @has_sa = 0,
    'SELECT 1',
    IF(
        (SELECT IS_NULLABLE FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'subject_allocations' AND column_name = 'staff_id') = 'YES',
        'SELECT 1',
        'ALTER TABLE subject_allocations MODIFY COLUMN staff_id INT NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

