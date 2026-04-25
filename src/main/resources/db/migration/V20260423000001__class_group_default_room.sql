-- Default homeroom / base room per class group (optional FK to rooms)
-- MySQL 8+

SET @db := DATABASE();

SET @has_col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'default_room_id'
);

SET @stmt := IF(
    @has_col > 0,
    'SELECT 1',
    'ALTER TABLE class_groups\n'
    '  ADD COLUMN default_room_id INT NULL,\n'
    '  ADD KEY idx_class_groups_default_room (default_room_id),\n'
    '  ADD CONSTRAINT fk_class_groups_default_room FOREIGN KEY (default_room_id) REFERENCES rooms(id)\n'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
