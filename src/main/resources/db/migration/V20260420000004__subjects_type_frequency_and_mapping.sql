-- Subjects: type + weekly frequency + applicable class groups mapping
-- MySQL 8+

SET @db := DATABASE();
SET @has_subjects := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'subjects'
);

-- type
SET @stmt := IF(
    @has_subjects = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'subjects' AND column_name = 'type') > 0,
        'SELECT 1',
        'ALTER TABLE subjects ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT ''CORE'''
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- weekly_frequency
SET @stmt := IF(
    @has_subjects = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'subjects' AND column_name = 'weekly_frequency') > 0,
        'SELECT 1',
        'ALTER TABLE subjects ADD COLUMN weekly_frequency INT NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- mapping table subject_class_groups
SET @has_scg := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'subject_class_groups'
);

SET @stmt := IF(
    @has_scg > 0,
    'SELECT 1',
    'CREATE TABLE subject_class_groups (\n'
    '  id BIGINT NOT NULL AUTO_INCREMENT,\n'
    '  subject_id INT NOT NULL,\n'
    '  class_group_id INT NOT NULL,\n'
    '  PRIMARY KEY (id),\n'
    '  UNIQUE KEY uk_subject_class_groups (subject_id, class_group_id),\n'
    '  KEY idx_scg_subject (subject_id),\n'
    '  KEY idx_scg_class_group (class_group_id)\n'
    ') ENGINE=InnoDB'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

