-- ─────────────────────────────────────────────────────────────────────────────
-- School default teacher weekly load
-- Used as a fallback when individual staff have no maxWeeklyLectureLoad set.
-- A staff without their own limit AND no school default is NOT timetable eligible.
-- ─────────────────────────────────────────────────────────────────────────────

DROP PROCEDURE IF EXISTS _mig_school_default_load;
CREATE PROCEDURE _mig_school_default_load()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.COLUMNS
        WHERE  TABLE_SCHEMA = DATABASE()
          AND  TABLE_NAME   = 'schools'
          AND  COLUMN_NAME  = 'default_teacher_weekly_load'
    ) THEN
        ALTER TABLE schools
            ADD COLUMN default_teacher_weekly_load INT NULL
                COMMENT 'School-wide default max weekly lecture load for teaching staff. '
                        'Applied when staff.max_weekly_lecture_load is NULL.';
    END IF;
END;
CALL _mig_school_default_load();
DROP PROCEDURE IF EXISTS _mig_school_default_load;

