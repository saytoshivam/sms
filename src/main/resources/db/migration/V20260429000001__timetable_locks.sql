-- Timetable locks: persist locked cells per timetable version.
-- MySQL 8+

CREATE TABLE IF NOT EXISTS timetable_locks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    timetable_version_id INT NOT NULL,
    class_group_id INT NOT NULL,
    day_of_week VARCHAR(16) NOT NULL,
    time_slot_id INT NOT NULL,
    locked TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_tt_locks_cell (school_id, timetable_version_id, class_group_id, day_of_week, time_slot_id),
    KEY idx_tt_locks_version (timetable_version_id),
    KEY idx_tt_locks_school (school_id),
    KEY idx_tt_locks_class (class_group_id)
);

