-- Optional admission metadata; idempotent — column may exist from manual patches.
SET @sql := IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'student_academic_enrollments'
              AND COLUMN_NAME = 'admission_category'),
        'SELECT 1;',
        'ALTER TABLE student_academic_enrollments ADD COLUMN admission_category VARCHAR(32) NULL;');

PREPARE stmt FROM @sql;

EXECUTE stmt;

DEALLOCATE PREPARE stmt;
