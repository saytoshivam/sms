-- Add teaching-specific capability flags and daily load cap to staff table.
-- All nullable / defaulted — safe to apply to existing rows.
-- Guard: staff is Hibernate-managed; skip on fresh DB.

DROP PROCEDURE IF EXISTS _sp_staff_academic_fields;
CREATE PROCEDURE _sp_staff_academic_fields()
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'max_daily_lecture_load') THEN
            ALTER TABLE staff
                ADD COLUMN max_daily_lecture_load  INT         NULL    COMMENT 'Max lectures this staff can teach in a single day. NULL = no cap.',
                ADD COLUMN can_be_class_teacher    TINYINT(1)  NOT NULL DEFAULT 1 COMMENT 'Whether this staff member is eligible for class-teacher assignment.',
                ADD COLUMN can_take_substitution   TINYINT(1)  NOT NULL DEFAULT 1 COMMENT 'Whether this staff member is available for substitution duties.';
        END IF;
    END IF;
END;
CALL _sp_staff_academic_fields();
DROP PROCEDURE IF EXISTS _sp_staff_academic_fields;
