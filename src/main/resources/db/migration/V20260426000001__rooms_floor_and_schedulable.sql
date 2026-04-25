-- Add explicit floor number/name + schedulable flag to rooms (idempotent).
-- MySQL 8+

SET @db := DATABASE();

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'rooms' AND column_name = 'floor_number') > 0,
    'SELECT 1',
    'ALTER TABLE rooms ADD COLUMN floor_number INT NULL'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'rooms' AND column_name = 'floor_name') > 0,
    'SELECT 1',
    'ALTER TABLE rooms ADD COLUMN floor_name VARCHAR(64) NULL'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'rooms' AND column_name = 'is_schedulable') > 0,
    'SELECT 1',
    'ALTER TABLE rooms ADD COLUMN is_schedulable TINYINT(1) NOT NULL DEFAULT 1'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

