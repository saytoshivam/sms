-- Add restricted-class-groups and unavailable-periods placeholders to the staff table.
-- Both columns are nullable JSON; defaulting to NULL means no restrictions / not configured.
-- Guard: staff is Hibernate-managed; skip on fresh DB.

DROP PROCEDURE IF EXISTS _sp_staff_restricted_periods;
CREATE PROCEDURE _sp_staff_restricted_periods()
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'restricted_class_group_ids_json') THEN
            ALTER TABLE staff
                ADD COLUMN restricted_class_group_ids_json JSON NULL
                    COMMENT 'Class group IDs this teacher must NOT be assigned to; stored as JSON array.',
                ADD COLUMN unavailable_periods_json        JSON NULL
                    COMMENT 'Placeholder: periods when the teacher is unavailable (day-slot pairs). Not yet enforced by scheduler.';
        END IF;
    END IF;
END;
CALL _sp_staff_restricted_periods();
DROP PROCEDURE IF EXISTS _sp_staff_restricted_periods;
