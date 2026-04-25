-- Portrait URLs for UI (e.g. DiceBear / CDN placeholders).

SET @db := DATABASE();
SET @has_students := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = @db AND table_name = 'students'
);
SET @has_staff := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = @db AND table_name = 'staff'
);
SET @sql := IF(
    @has_students = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'students' AND column_name = 'photo_url') > 0,
        'SELECT 1',
        'ALTER TABLE students ADD COLUMN photo_url VARCHAR(512) NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    @has_staff = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'staff' AND column_name = 'photo_url') > 0,
        'SELECT 1',
        'ALTER TABLE staff ADD COLUMN photo_url VARCHAR(512) NULL'
    )
);
PREPARE stmt2 FROM @sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
