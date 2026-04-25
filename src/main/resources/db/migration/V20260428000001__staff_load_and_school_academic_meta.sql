-- Staff: optional max weekly load + preferred class groups (onboarding & scheduling)
-- School: JSON blob for per-slot teacher assignment source/lock (onboarding)

SET @db := DATABASE();

-- staff
SET @col := 'max_weekly_lecture_load';
SET @has := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'staff' AND column_name = @col);
SET @stmt := IF(@has > 0, 'SELECT 1', 'ALTER TABLE staff ADD COLUMN max_weekly_lecture_load INT NULL');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := 'preferred_class_group_ids';
SET @has := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'staff' AND column_name = @col);
SET @stmt := IF(@has > 0, 'SELECT 1', 'ALTER TABLE staff ADD COLUMN preferred_class_group_ids JSON NULL');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- schools: JSON list of { classGroupId, subjectId, source, locked } for onboarding Step 6
SET @col := 'onboarding_academic_assignment_meta';
SET @has := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'schools' AND column_name = @col);
SET @stmt := IF(@has > 0, 'SELECT 1', 'ALTER TABLE schools ADD COLUMN onboarding_academic_assignment_meta JSON NULL');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
