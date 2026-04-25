-- Subject → class (grade) mapping with optional section overrides.
-- Keep subject_class_groups as a materialized mapping for existing timetable logic.
-- MySQL 8+

SET @db := DATABASE();

-- subject_class_mappings: one row per (subject, grade)
SET @has_scm := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'subject_class_mappings'
);

SET @stmt := IF(
    @has_scm > 0,
    'SELECT 1',
    'CREATE TABLE subject_class_mappings (\n'
    '  id BIGINT NOT NULL AUTO_INCREMENT,\n'
    '  subject_id INT NOT NULL,\n'
    '  grade_level INT NOT NULL,\n'
    '  applies_to_all_sections TINYINT(1) NOT NULL DEFAULT 1,\n'
    '  PRIMARY KEY (id),\n'
    '  UNIQUE KEY uk_subject_grade (subject_id, grade_level),\n'
    '  KEY idx_scm_subject (subject_id),\n'
    '  CONSTRAINT fk_scm_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)\n'
    ') ENGINE=InnoDB'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- subject_section_overrides: when applies_to_all_sections = 0, pick specific class_groups (sections)
SET @has_sso := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'subject_section_overrides'
);

SET @stmt := IF(
    @has_sso > 0,
    'SELECT 1',
    'CREATE TABLE subject_section_overrides (\n'
    '  id BIGINT NOT NULL AUTO_INCREMENT,\n'
    '  subject_id INT NOT NULL,\n'
    '  class_group_id INT NOT NULL,\n'
    '  PRIMARY KEY (id),\n'
    '  UNIQUE KEY uk_subject_class_group (subject_id, class_group_id),\n'
    '  KEY idx_sso_subject (subject_id),\n'
    '  KEY idx_sso_class_group (class_group_id),\n'
    '  CONSTRAINT fk_sso_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),\n'
    '  CONSTRAINT fk_sso_class_group FOREIGN KEY (class_group_id) REFERENCES class_groups(id)\n'
    ') ENGINE=InnoDB'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

