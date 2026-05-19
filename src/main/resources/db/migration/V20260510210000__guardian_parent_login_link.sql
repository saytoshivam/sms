-- Parent/Guardian login linking: add linked_guardian_id to users table
-- MySQL 8+
-- Guard: users and guardians are Hibernate-managed; skip on fresh DB.
SET @db := DATABASE();
SET @has_users := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'users');

-- Add linked_guardian_id column to users if not exists
SET @stmt := IF(
    @has_users = 0 OR (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'users' AND column_name = 'linked_guardian_id') > 0,
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN linked_guardian_id INT NULL AFTER linked_staff_id');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add index for linked_guardian_id (logical FK to guardians.id — guardians is Hibernate-managed)
SET @idx_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_linked_guardian');
SET @stmt := IF(@has_users = 0 OR @idx_exists > 0, 'SELECT 1',
    'ALTER TABLE users ADD KEY idx_users_linked_guardian (linked_guardian_id) /* Logical FK to guardians.id (Hibernate-managed) */');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
