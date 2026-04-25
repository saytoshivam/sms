-- Audit + soft delete for staff (idempotent).
-- MySQL 8+

SET @db := DATABASE();

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'staff' AND column_name = 'created_at') > 0,
    'SELECT 1',
    'ALTER TABLE staff ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'staff' AND column_name = 'updated_at') > 0,
    'SELECT 1',
    'ALTER TABLE staff ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'staff' AND column_name = 'created_by') > 0,
    'SELECT 1',
    'ALTER TABLE staff ADD COLUMN created_by VARCHAR(255) NULL'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'staff' AND column_name = 'updated_by') > 0,
    'SELECT 1',
    'ALTER TABLE staff ADD COLUMN updated_by VARCHAR(255) NULL'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'staff' AND column_name = 'is_deleted') > 0,
    'SELECT 1',
    'ALTER TABLE staff ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

