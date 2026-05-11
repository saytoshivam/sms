-- Staff entity upgrade: add HR profile, classification, payroll, and address fields.
-- All new columns are nullable (or have defaults) to keep existing rows valid.

ALTER TABLE staff
    ADD COLUMN staff_type           VARCHAR(32)  NOT NULL DEFAULT 'TEACHING'   AFTER designation,
    ADD COLUMN status               VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE'      AFTER staff_type,
    ADD COLUMN gender               VARCHAR(16)  NULL                           AFTER status,
    ADD COLUMN date_of_birth        DATE         NULL                           AFTER gender,
    ADD COLUMN alternate_phone      VARCHAR(32)  NULL                           AFTER phone,
    ADD COLUMN joining_date         DATE         NULL                           AFTER email,
    ADD COLUMN employment_type      VARCHAR(32)  NULL                           AFTER joining_date,
    ADD COLUMN department           VARCHAR(128) NULL                           AFTER employment_type,
    ADD COLUMN reporting_manager_staff_id INT    NULL                           AFTER department,

    ADD COLUMN current_address_line1 VARCHAR(255) NULL,
    ADD COLUMN current_address_line2 VARCHAR(255) NULL,
    ADD COLUMN city                  VARCHAR(128) NULL,
    ADD COLUMN state                 VARCHAR(128) NULL,
    ADD COLUMN pincode               VARCHAR(16)  NULL,

    ADD COLUMN emergency_contact_name     VARCHAR(128) NULL,
    ADD COLUMN emergency_contact_phone    VARCHAR(32)  NULL,
    ADD COLUMN emergency_contact_relation VARCHAR(64)  NULL,

    ADD COLUMN highest_qualification      VARCHAR(128) NULL,
    ADD COLUMN professional_qualification VARCHAR(255) NULL,
    ADD COLUMN specialization             VARCHAR(255) NULL,
    ADD COLUMN years_of_experience        INT          NULL,
    ADD COLUMN previous_institution       VARCHAR(255) NULL,

    ADD COLUMN salary_type               VARCHAR(32)   NULL,
    ADD COLUMN payroll_enabled           TINYINT(1)    NOT NULL DEFAULT 0,
    ADD COLUMN bank_account_holder_name  VARCHAR(128)  NULL,
    ADD COLUMN bank_name                 VARCHAR(128)  NULL,
    ADD COLUMN bank_account_number       VARCHAR(64)   NULL,
    ADD COLUMN ifsc                      VARCHAR(16)   NULL,
    ADD COLUMN pan_number                VARCHAR(16)   NULL;

-- Migrate existing staff:
--   If designation contains 'teacher' (case-insensitive) → TEACHING, else ADMIN.
--   All non-deleted existing staff are considered ACTIVE.

UPDATE staff
SET staff_type = CASE
        WHEN LOWER(designation) LIKE '%teacher%' THEN 'TEACHING'
        ELSE 'ADMIN'
    END,
    status = 'ACTIVE'
WHERE is_deleted = 0;

-- Soft-deleted records keep DEFAULT ('TEACHING' / 'ACTIVE') — they are historical and won't appear in active queries.
