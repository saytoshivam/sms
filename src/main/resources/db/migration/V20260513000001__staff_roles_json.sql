-- ─────────────────────────────────────────────────────────────────────────────
-- Staff first-class role assignment
-- Staff roles must be saved against Staff even before a login account exists.
-- On MySQL < 8 there is no ALTER TABLE … ADD COLUMN IF NOT EXISTS; use a proc.
-- ─────────────────────────────────────────────────────────────────────────────

DROP PROCEDURE IF EXISTS _mig_staff_roles_json;
CREATE PROCEDURE _mig_staff_roles_json()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.COLUMNS
        WHERE  TABLE_SCHEMA = DATABASE()
          AND  TABLE_NAME   = 'staff'
          AND  COLUMN_NAME  = 'staff_roles_json'
    ) THEN
        ALTER TABLE staff
            ADD COLUMN staff_roles_json JSON NULL
                COMMENT 'First-class role names assigned to this staff member, e.g. ["TEACHER","HOD"]. '
                        'Populated on onboarding. Provisioned to User.roles when a login is created.';
    END IF;
END;
CALL _mig_staff_roles_json();
DROP PROCEDURE IF EXISTS _mig_staff_roles_json;

