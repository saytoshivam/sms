-- Timetable lifecycle: optional generated_at / published_at columns, REVIEW cleanup, ARCHIVED semantics

SET @dbname = DATABASE();

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'timetable_versions' AND COLUMN_NAME = 'generated_at') > 0,
  'SELECT 1',
  'ALTER TABLE timetable_versions ADD COLUMN generated_at DATETIME(6) NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'timetable_versions' AND COLUMN_NAME = 'published_at') > 0,
  'SELECT 1',
  'ALTER TABLE timetable_versions ADD COLUMN published_at DATETIME(6) NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Ensure status can store ARCHIVED (some DBs may still have a legacy ENUM from manual/schema drift)
ALTER TABLE timetable_versions MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'DRAFT';

-- REVIEW rows strictly older than this school's current published version → ARCHIVED (formerly demoted publish)
UPDATE timetable_versions tv
    INNER JOIN (
        SELECT school_id, MAX(version) AS max_pub_ver
        FROM timetable_versions
        WHERE status = 'PUBLISHED'
        GROUP BY school_id
    ) p ON p.school_id = tv.school_id
SET tv.status = 'ARCHIVED'
WHERE tv.status = 'REVIEW'
  AND tv.version < p.max_pub_ver;

-- Any remaining REVIEW → DRAFT
UPDATE timetable_versions
SET status = 'DRAFT'
WHERE status = 'REVIEW';

UPDATE timetable_versions
SET published_at = COALESCE(published_at, created_at)
WHERE status = 'PUBLISHED';
