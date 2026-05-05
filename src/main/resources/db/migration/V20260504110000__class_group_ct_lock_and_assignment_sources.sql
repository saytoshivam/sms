-- homeroom_source, class_teacher_source, class_teacher_locked (idempotent for mixed DBs)

SET @db := DATABASE();

SET @exist_hm := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'homeroom_source');
SET @sql_hm := IF(@exist_hm = 0,
  'ALTER TABLE class_groups ADD COLUMN homeroom_source VARCHAR(16) NULL COMMENT ''auto | manual — homeroom room assignment provenance''',
  'SELECT 1');
PREPARE stmt FROM @sql_hm;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist_cts := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'class_teacher_source');
SET @sql_cts := IF(@exist_cts = 0,
  'ALTER TABLE class_groups ADD COLUMN class_teacher_source VARCHAR(16) NULL COMMENT ''auto | manual — class teacher assignment provenance''',
  'SELECT 1');
PREPARE stmt FROM @sql_cts;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist_ctl := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'class_teacher_locked');
SET @sql_ctl := IF(@exist_ctl = 0,
  'ALTER TABLE class_groups ADD COLUMN class_teacher_locked TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''when 1, bulk Auto assign class teachers skips this section''',
  'SELECT 1');
PREPARE stmt FROM @sql_ctl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE class_groups
SET homeroom_source = 'manual'
WHERE default_room_id IS NOT NULL AND (homeroom_source IS NULL OR homeroom_source = '');
