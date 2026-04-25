-- Class groups: structured fields for onboarding (grade/section/capacity)
-- MySQL 8+

SET @db := DATABASE();
SET @has_class_groups := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'class_groups'
);

-- grade_level
SET @stmt := IF(
    @has_class_groups = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'grade_level') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN grade_level INT NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- section
SET @stmt := IF(
    @has_class_groups = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'section') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN section VARCHAR(16) NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- capacity
SET @stmt := IF(
    @has_class_groups = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'capacity') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN capacity INT NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

