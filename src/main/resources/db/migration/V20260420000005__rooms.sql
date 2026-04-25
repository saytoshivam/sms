-- Rooms / infrastructure (for timetable room allocation)
-- MySQL 8+

SET @db := DATABASE();
SET @has_rooms := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'rooms'
);

SET @stmt := IF(
    @has_rooms > 0,
    'SELECT 1',
    'CREATE TABLE rooms (\n'
    '  id INT NOT NULL AUTO_INCREMENT,\n'
    '  school_id INT NOT NULL,\n'
    '  building VARCHAR(64) NOT NULL,\n'
    '  room_number VARCHAR(64) NOT NULL,\n'
    '  type VARCHAR(16) NOT NULL DEFAULT ''CLASSROOM'',\n'
    '  capacity INT NULL,\n'
    '  PRIMARY KEY (id),\n'
    '  UNIQUE KEY uk_rooms_school_building_number (school_id, building, room_number),\n'
    '  KEY idx_rooms_school (school_id),\n'
    '  CONSTRAINT fk_rooms_school FOREIGN KEY (school_id) REFERENCES schools(id)\n'
    ') ENGINE=InnoDB'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

