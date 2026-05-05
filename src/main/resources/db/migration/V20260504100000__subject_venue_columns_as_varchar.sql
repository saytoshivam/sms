-- Persist subject venue enums as VARCHAR (not MySQL ENUM).
-- Hibernate ddl-auto often maps @Enumerated(STRING) to MySQL ENUM sorted alphabetically, where ACTIVITY_SPACE
-- is the first member. Empty/legacy cells can then be read back as ACTIVITY_SPACE even though subjects were
-- never configured for activity space.

SET @db := DATABASE();

-- Normalize rows Hibernate/JDBC cannot map to a known requirement name.
UPDATE subjects
SET allocation_venue_requirement = 'STANDARD_CLASSROOM'
WHERE allocation_venue_requirement IS NULL
   OR TRIM(CAST(allocation_venue_requirement AS CHAR(64))) = ''
   OR CAST(allocation_venue_requirement AS CHAR(64)) NOT IN (
        'STANDARD_CLASSROOM',
        'LAB_REQUIRED',
        'ACTIVITY_SPACE',
        'SPORTS_AREA',
        'SPECIALIZED_ROOM',
        'FLEXIBLE'
    );

ALTER TABLE subjects
    MODIFY COLUMN allocation_venue_requirement VARCHAR(32) NOT NULL DEFAULT 'STANDARD_CLASSROOM';

ALTER TABLE subjects
    MODIFY COLUMN specialized_venue_type VARCHAR(32) NULL;
