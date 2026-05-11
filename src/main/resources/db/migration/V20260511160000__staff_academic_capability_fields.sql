-- Add teaching-specific capability flags and daily load cap to staff table.
-- All nullable / defaulted — safe to apply to existing rows.

ALTER TABLE staff
    ADD COLUMN max_daily_lecture_load  INT         NULL    COMMENT 'Max lectures this staff can teach in a single day. NULL = no cap.',
    ADD COLUMN can_be_class_teacher    TINYINT(1)  NOT NULL DEFAULT 1 COMMENT 'Whether this staff member is eligible for class-teacher assignment.',
    ADD COLUMN can_take_substitution   TINYINT(1)  NOT NULL DEFAULT 1 COMMENT 'Whether this staff member is available for substitution duties.';
