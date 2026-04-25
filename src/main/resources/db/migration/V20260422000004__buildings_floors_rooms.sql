-- Buildings + floors + richer rooms model (backwards compatible with existing rooms.building column)
-- MySQL 8+

SET @db := DATABASE();

-- buildings
SET @has_buildings := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'buildings'
);

SET @stmt := IF(
    @has_buildings > 0,
    'SELECT 1',
    'CREATE TABLE buildings (\n'
    '  id INT NOT NULL AUTO_INCREMENT,\n'
    '  school_id INT NOT NULL,\n'
    '  name VARCHAR(96) NOT NULL,\n'
    '  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n'
    '  PRIMARY KEY (id),\n'
    '  UNIQUE KEY uk_buildings_school_name (school_id, name),\n'
    '  KEY idx_buildings_school (school_id),\n'
    '  CONSTRAINT fk_buildings_school FOREIGN KEY (school_id) REFERENCES schools(id)\n'
    ') ENGINE=InnoDB'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- floors
SET @has_floors := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'floors'
);

SET @stmt := IF(
    @has_floors > 0,
    'SELECT 1',
    'CREATE TABLE floors (\n'
    '  id INT NOT NULL AUTO_INCREMENT,\n'
    '  building_id INT NOT NULL,\n'
    '  name VARCHAR(64) NOT NULL,\n'
    '  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n'
    '  PRIMARY KEY (id),\n'
    '  UNIQUE KEY uk_floors_building_name (building_id, name),\n'
    '  KEY idx_floors_building (building_id),\n'
    '  CONSTRAINT fk_floors_building FOREIGN KEY (building_id) REFERENCES buildings(id)\n'
    ') ENGINE=InnoDB'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- rooms: add building_id, floor_id, lab_type
SET @has_rooms := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'rooms'
);

-- building_id
SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'rooms' AND column_name = 'building_id') > 0,
        'SELECT 1',
        'ALTER TABLE rooms ADD COLUMN building_id INT NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- floor_id
SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'rooms' AND column_name = 'floor_id') > 0,
        'SELECT 1',
        'ALTER TABLE rooms ADD COLUMN floor_id INT NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- lab_type
SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'rooms' AND column_name = 'lab_type') > 0,
        'SELECT 1',
        'ALTER TABLE rooms ADD COLUMN lab_type VARCHAR(16) NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- FK indexes (best-effort)
SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = @db AND table_name = 'rooms' AND index_name = 'idx_rooms_building_id') > 0,
        'SELECT 1',
        'CREATE INDEX idx_rooms_building_id ON rooms(building_id)'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = @db AND table_name = 'rooms' AND index_name = 'idx_rooms_floor_id') > 0,
        'SELECT 1',
        'CREATE INDEX idx_rooms_floor_id ON rooms(floor_id)'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- FK constraints (best-effort; only add if not present)
SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.key_column_usage
            WHERE table_schema = @db AND table_name = 'rooms' AND constraint_name = 'fk_rooms_building') > 0,
        'SELECT 1',
        'ALTER TABLE rooms ADD CONSTRAINT fk_rooms_building FOREIGN KEY (building_id) REFERENCES buildings(id)'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.key_column_usage
            WHERE table_schema = @db AND table_name = 'rooms' AND constraint_name = 'fk_rooms_floor') > 0,
        'SELECT 1',
        'ALTER TABLE rooms ADD CONSTRAINT fk_rooms_floor FOREIGN KEY (floor_id) REFERENCES floors(id)'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Backfill buildings + rooms.building_id from legacy rooms.building when present
-- Insert distinct buildings per school
INSERT INTO buildings (school_id, name)
SELECT DISTINCT r.school_id, r.building
FROM rooms r
LEFT JOIN buildings b ON b.school_id = r.school_id AND b.name = r.building
WHERE r.building IS NOT NULL AND r.building <> '' AND b.id IS NULL;

-- Update rooms.building_id
UPDATE rooms r
JOIN buildings b ON b.school_id = r.school_id AND b.name = r.building
SET r.building_id = b.id
WHERE r.building_id IS NULL;

-- Uniqueness: building_id + room_number (best-effort)
SET @stmt := IF(
    @has_rooms = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = @db AND table_name = 'rooms' AND index_name = 'uk_rooms_building_number') > 0,
        'SELECT 1',
        'ALTER TABLE rooms ADD CONSTRAINT uk_rooms_building_number UNIQUE (building_id, room_number)'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

