-- Daily cutoff (admin alerts), lecture grace window, session lock after submit.

SET @db := DATABASE();

SET @has_schools := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'schools');
SET @has_as := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'attendance_sessions');

-- schools.attendance_daily_cutoff (TIME)
SET @sql := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'attendance_daily_cutoff') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN attendance_daily_cutoff TIME NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- schools.attendance_lecture_grace_minutes
SET @sql := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'attendance_lecture_grace_minutes') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN attendance_lecture_grace_minutes INT NOT NULL DEFAULT 15'
    )
);
PREPARE stmt2 FROM @sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- attendance_sessions.locked_at
SET @sql := IF(
    @has_as = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND column_name = 'locked_at') > 0,
        'SELECT 1',
        'ALTER TABLE attendance_sessions ADD COLUMN locked_at DATETIME(6) NULL'
    )
);
PREPARE stmt3 FROM @sql;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
