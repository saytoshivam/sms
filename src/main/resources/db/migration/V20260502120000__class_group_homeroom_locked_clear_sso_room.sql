-- Section-level homeroom lock; planning-time subject overrides no longer store room_id (homeroom + timetable editor).

SET @db := DATABASE();
SET @has_cg := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'class_groups');

SET @has_col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'homeroom_locked');

SET @stmt := IF(@has_cg = 0 OR @has_col > 0, 'SELECT 1',
    'ALTER TABLE class_groups ADD COLUMN homeroom_locked TINYINT(1) NOT NULL DEFAULT 0');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE subject_section_overrides SET room_id = NULL WHERE room_id IS NOT NULL;