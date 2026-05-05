-- Subject venue metadata (allocation-only) + expanded room types (no name-based inference).
-- MySQL 8+

SET @db := DATABASE();

-- subjects.allocation_venue_requirement
SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'subjects' AND column_name = 'allocation_venue_requirement') > 0,
    'SELECT 1',
    'ALTER TABLE subjects ADD COLUMN allocation_venue_requirement VARCHAR(32) NOT NULL DEFAULT ''STANDARD_CLASSROOM'''
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- subjects.specialized_venue_type (RoomType when requirement = SPECIALIZED_ROOM)
SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'subjects' AND column_name = 'specialized_venue_type') > 0,
    'SELECT 1',
    'ALTER TABLE subjects ADD COLUMN specialized_venue_type VARCHAR(32) NULL'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Widen rooms.type for longer enum names
SET @stmt := IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'rooms' AND column_name = 'type' AND character_maximum_length >= 32) > 0,
    'SELECT 1',
    'ALTER TABLE rooms MODIFY COLUMN type VARCHAR(32) NOT NULL DEFAULT ''STANDARD_CLASSROOM'''
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE rooms SET type = 'STANDARD_CLASSROOM' WHERE type = 'CLASSROOM';
UPDATE rooms SET type = 'SCIENCE_LAB' WHERE type = 'LAB' AND (lab_type IS NULL OR lab_type IN ('PHYSICS','CHEMISTRY','OTHER'));
UPDATE rooms SET type = 'COMPUTER_LAB' WHERE type = 'LAB' AND lab_type = 'COMPUTER';
UPDATE rooms SET type = 'SPORTS_AREA' WHERE type = 'SPORTS_ROOM';
