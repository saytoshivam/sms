-- Default homeroom / base room per class group (optional FK to rooms)
-- MySQL 8+
-- Note: uses single-line IF strings to avoid multi-line adjacent literal concatenation
--       issues observed in MySQL 9.x when the THEN branch ('SELECT 1') is selected.

SET @db := DATABASE();

-- Add default_room_id column (skip if table doesn't exist or column already present)
SET @stmt := IF((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'class_groups') = 0 OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'default_room_id') > 0, 'SELECT 1', 'ALTER TABLE class_groups ADD COLUMN default_room_id INT NULL');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add index on default_room_id (skip if table/index absent)
SET @stmt := IF((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'class_groups') = 0 OR (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = @db AND table_name = 'class_groups' AND index_name = 'idx_class_groups_default_room') > 0, 'SELECT 1', 'ALTER TABLE class_groups ADD KEY idx_class_groups_default_room (default_room_id)');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
