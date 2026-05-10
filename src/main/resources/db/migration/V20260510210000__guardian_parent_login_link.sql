-- Parent/Guardian login linking: add linked_guardian_id to users table
-- MySQL 8+
SET @db := DATABASE();

-- Add linked_guardian_id column to users if not exists
SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'users' AND column_name = 'linked_guardian_id') > 0,
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN linked_guardian_id INT NULL AFTER linked_staff_id');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add FK constraint for linked_guardian_id if not exists
SET @fk_exists := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_linked_guardian');
SET @stmt := IF(@fk_exists > 0, 'SELECT 1',
    'ALTER TABLE users ADD CONSTRAINT fk_users_linked_guardian FOREIGN KEY (linked_guardian_id) REFERENCES guardians (id) ON DELETE SET NULL');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Index for lookup by guardian
SET @idx_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_linked_guardian');
SET @stmt := IF(@idx_exists > 0, 'SELECT 1',
    'ALTER TABLE users ADD KEY idx_users_linked_guardian (linked_guardian_id)');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

