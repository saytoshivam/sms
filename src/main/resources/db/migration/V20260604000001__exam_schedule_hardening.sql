-- ============================================================
-- Examination Module: Hardening – add missing columns to
--   assessment_components and assessment_instances.
--
-- Uses SET + PREPARE conditional pattern for MySQL 5.7 compatibility.
-- (ADD COLUMN IF NOT EXISTS requires MySQL 8.0.29+.)
-- Safe on databases where Hibernate ddl-auto=update already added
-- some of these columns.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. assessment_components.requires_scheduling
-- ─────────────────────────────────────────────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'assessment_components'
      AND COLUMN_NAME  = 'requires_scheduling'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE assessment_components ADD COLUMN requires_scheduling TINYINT(1) NOT NULL DEFAULT 1',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- ────────────────────────────────────────────────────────��────
-- 2. assessment_components.marks_entry_required
-- ─────────────────────────────────────────────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'assessment_components'
      AND COLUMN_NAME  = 'marks_entry_required'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE assessment_components ADD COLUMN marks_entry_required TINYINT(1) NOT NULL DEFAULT 1',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- ─────────────────────────────────────────────────────────────
-- 3. assessment_components.scheduling_mode
-- ─────────────────────────────────────────────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'assessment_components'
      AND COLUMN_NAME  = 'scheduling_mode'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE assessment_components ADD COLUMN scheduling_mode VARCHAR(16) NOT NULL DEFAULT ''CENTRALIZED''',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- ─────────────────────────────────────────────────────────────
-- 4. assessment_instances.schedule_group_id
-- ─────────────────────────────────────────────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'assessment_instances'
      AND COLUMN_NAME  = 'schedule_group_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE assessment_instances ADD COLUMN schedule_group_id VARCHAR(64) NULL',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- ─────────────────────────────────────────────────────────────
-- 5. assessment_instances.instructions
-- ─────────────────────────────────────���───────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'assessment_instances'
      AND COLUMN_NAME  = 'instructions'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE assessment_instances ADD COLUMN instructions TEXT NULL',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- ─────────────────────────────────────────────────────────────
-- 6. assessment_instances.assigned_teacher_staff_id  (NEW)
-- ─────────────────────────────────────────────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'assessment_instances'
      AND COLUMN_NAME  = 'assigned_teacher_staff_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE assessment_instances ADD COLUMN assigned_teacher_staff_id INT NULL',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- ────────���────────────────────────────────────────────────────
-- 7. Index on schedule_group_id (conditional)
-- ─────────────────────────────────────────────────────────────
SET @idx_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'assessment_instances'
      AND INDEX_NAME   = 'idx_ai_schedule_group'
);
SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE assessment_instances ADD INDEX idx_ai_schedule_group (schedule_group_id)',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
