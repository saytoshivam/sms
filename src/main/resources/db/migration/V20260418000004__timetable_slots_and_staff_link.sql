-- Weekly recurring timetable + optional link from users to staff (teacher profile).

CREATE TABLE IF NOT EXISTS timetable_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    class_group_id INT NOT NULL,
    staff_id INT NULL,
    teacher_display_name VARCHAR(128) NULL,
    subject VARCHAR(128) NOT NULL,
    day_of_week VARCHAR(16) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(256) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_tt_school (school_id),
    KEY idx_tt_class (class_group_id),
    KEY idx_tt_staff (staff_id)
);

SET @db := DATABASE();
SET @has_users := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = @db AND table_name = 'users'
);
SET @sql := IF(
    @has_users = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'users' AND column_name = 'linked_staff_id') > 0,
        'SELECT 1',
        'ALTER TABLE users ADD COLUMN linked_staff_id INT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    @has_users = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'users' AND index_name = 'idx_users_linked_staff_id') > 0,
        'SELECT 1',
        'CREATE INDEX idx_users_linked_staff_id ON users (linked_staff_id)'
    )
);
PREPARE stmt2 FROM @sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
