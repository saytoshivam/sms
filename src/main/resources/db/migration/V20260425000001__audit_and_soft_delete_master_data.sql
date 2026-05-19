-- Audit columns + soft delete for master data (subjects, rooms, class groups).
-- MySQL 8+ (portable approach: conditionals via information_schema)

-- subjects
SET @has_subjects := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'subjects');

SET @q := IF(@has_subjects = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'subjects' AND column_name = 'created_at') > 0,
        'SELECT 1',
        'ALTER TABLE subjects ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_subjects = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'subjects' AND column_name = 'updated_at') > 0,
        'SELECT 1',
        'ALTER TABLE subjects ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_subjects = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'subjects' AND column_name = 'created_by') > 0,
        'SELECT 1',
        'ALTER TABLE subjects ADD COLUMN created_by VARCHAR(255) NULL');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_subjects = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'subjects' AND column_name = 'updated_by') > 0,
        'SELECT 1',
        'ALTER TABLE subjects ADD COLUMN updated_by VARCHAR(255) NULL');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_subjects = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'subjects' AND column_name = 'is_deleted') > 0,
        'SELECT 1',
        'ALTER TABLE subjects ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rooms (Flyway-managed — no table guard needed)
SET @q := IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'rooms' AND column_name = 'created_at') = 0,
        'ALTER TABLE rooms ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
        'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'rooms' AND column_name = 'updated_at') = 0,
        'ALTER TABLE rooms ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
        'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'rooms' AND column_name = 'created_by') = 0,
        'ALTER TABLE rooms ADD COLUMN created_by VARCHAR(255) NULL',
        'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'rooms' AND column_name = 'updated_by') = 0,
        'ALTER TABLE rooms ADD COLUMN updated_by VARCHAR(255) NULL',
        'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'rooms' AND column_name = 'is_deleted') = 0,
        'ALTER TABLE rooms ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0',
        'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- class_groups
SET @has_cg := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'class_groups');

SET @q := IF(@has_cg = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'class_groups' AND column_name = 'created_at') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_cg = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'class_groups' AND column_name = 'updated_at') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_cg = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'class_groups' AND column_name = 'created_by') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN created_by VARCHAR(255) NULL');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_cg = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'class_groups' AND column_name = 'updated_by') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN updated_by VARCHAR(255) NULL');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @q := IF(@has_cg = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'class_groups' AND column_name = 'is_deleted') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;
