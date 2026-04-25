-- Timetable engine v2: fixed time slots + versioned timetable entries + hard conflict constraints.
-- MySQL 8+

CREATE TABLE IF NOT EXISTS school_time_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_order INT NOT NULL,
    is_break TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_school_time_slots_order (school_id, slot_order),
    KEY idx_school_time_slots_school (school_id)
);

CREATE TABLE IF NOT EXISTS timetable_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    version INT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_tt_versions (school_id, version),
    KEY idx_tt_versions_school (school_id),
    KEY idx_tt_versions_status (school_id, status)
);

CREATE TABLE IF NOT EXISTS subject_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    class_group_id INT NOT NULL,
    subject_id INT NOT NULL,
    staff_id INT NOT NULL,
    weekly_frequency INT NOT NULL,
    UNIQUE KEY uq_subject_alloc (school_id, class_group_id, subject_id, staff_id),
    KEY idx_subject_alloc_school (school_id),
    KEY idx_subject_alloc_class (class_group_id),
    KEY idx_subject_alloc_staff (staff_id)
);

CREATE TABLE IF NOT EXISTS timetable_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    timetable_version_id INT NOT NULL,
    class_group_id INT NOT NULL,
    day_of_week VARCHAR(16) NOT NULL,
    time_slot_id INT NOT NULL,
    subject_id INT NOT NULL,
    staff_id INT NOT NULL,
    room_id INT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    -- Hard constraints (per version)
    UNIQUE KEY uq_tt_teacher (timetable_version_id, staff_id, day_of_week, time_slot_id),
    UNIQUE KEY uq_tt_class (timetable_version_id, class_group_id, day_of_week, time_slot_id),
    UNIQUE KEY uq_tt_room (timetable_version_id, room_id, day_of_week, time_slot_id),

    KEY idx_tt_entries_school (school_id),
    KEY idx_tt_entries_version (timetable_version_id),
    KEY idx_tt_entries_class (class_group_id),
    KEY idx_tt_entries_subject (subject_id)
);

