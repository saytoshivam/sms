-- Add restricted-class-groups and unavailable-periods placeholders to the staff table.
-- Both columns are nullable JSON; defaulting to NULL means no restrictions / not configured.

ALTER TABLE staff
    ADD COLUMN restricted_class_group_ids_json JSON NULL
        COMMENT 'Class group IDs this teacher must NOT be assigned to; stored as JSON array.',
    ADD COLUMN unavailable_periods_json        JSON NULL
        COMMENT 'Placeholder: periods when the teacher is unavailable (day-slot pairs). Not yet enforced by scheduler.';

