-- Optional room for each (class, subject) allocation (timetable default per subject/section)
SET @db := DATABASE();

SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'subject_allocations' AND COLUMN_NAME = 'room_id'
);

SET @sql := IF(
  @has = 0,
  'ALTER TABLE subject_allocations ADD COLUMN room_id INT NULL, ADD KEY idx_subject_alloc_room (room_id), ADD CONSTRAINT fk_subject_alloc_room FOREIGN KEY (room_id) REFERENCES rooms (id)',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
