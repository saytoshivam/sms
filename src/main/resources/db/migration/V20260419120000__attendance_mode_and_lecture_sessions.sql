-- School-level attendance strategy, optional class teacher, lecture→staff link, and stable session keys.
-- Flyway runs before Hibernate on an empty DB: only ALTER when the table already exists (otherwise Hibernate creates columns).

SET @db := DATABASE();

SET @has_schools := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'schools');
SET @has_class_groups := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'class_groups');
SET @has_lectures := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'lectures');
SET @has_attendance_sessions := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'attendance_sessions');
SET @has_staff := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'staff');

-- schools.attendance_mode
SET @sql := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'attendance_mode') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN attendance_mode VARCHAR(32) NOT NULL DEFAULT ''LECTURE_WISE'''
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- class_groups.class_teacher_staff_id
SET @sql := IF(
    @has_class_groups = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'class_groups' AND column_name = 'class_teacher_staff_id') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD COLUMN class_teacher_staff_id INT NULL'
    )
);
PREPARE stmt2 FROM @sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @sql := IF(
    @has_class_groups = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'class_groups' AND index_name = 'idx_cg_class_teacher_staff') > 0,
        'SELECT 1',
        'CREATE INDEX idx_cg_class_teacher_staff ON class_groups (class_teacher_staff_id)'
    )
);
PREPARE stmt3 FROM @sql;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @sql := IF(
    @has_class_groups = 0 OR @has_staff = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema = @db AND table_name = 'class_groups' AND constraint_name = 'fk_cg_class_teacher_staff') > 0,
        'SELECT 1',
        'ALTER TABLE class_groups ADD CONSTRAINT fk_cg_class_teacher_staff FOREIGN KEY (class_teacher_staff_id) REFERENCES staff(id)'
    )
);
PREPARE stmt4 FROM @sql;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

-- lectures.staff_id
SET @sql := IF(
    @has_lectures = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'lectures' AND column_name = 'staff_id') > 0,
        'SELECT 1',
        'ALTER TABLE lectures ADD COLUMN staff_id INT NULL'
    )
);
PREPARE stmt5 FROM @sql;
EXECUTE stmt5;
DEALLOCATE PREPARE stmt5;

SET @sql := IF(
    @has_lectures = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'lectures' AND index_name = 'idx_lectures_staff') > 0,
        'SELECT 1',
        'CREATE INDEX idx_lectures_staff ON lectures (staff_id)'
    )
);
PREPARE stmt6 FROM @sql;
EXECUTE stmt6;
DEALLOCATE PREPARE stmt6;

SET @sql := IF(
    @has_lectures = 0 OR @has_staff = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema = @db AND table_name = 'lectures' AND constraint_name = 'fk_lectures_staff') > 0,
        'SELECT 1',
        'ALTER TABLE lectures ADD CONSTRAINT fk_lectures_staff FOREIGN KEY (staff_id) REFERENCES staff(id)'
    )
);
PREPARE stmt7 FROM @sql;
EXECUTE stmt7;
DEALLOCATE PREPARE stmt7;

-- attendance_sessions: lecture link + dedupe key
SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND column_name = 'lecture_id') > 0,
        'SELECT 1',
        'ALTER TABLE attendance_sessions ADD COLUMN lecture_id INT NULL'
    )
);
PREPARE stmt8 FROM @sql;
EXECUTE stmt8;
DEALLOCATE PREPARE stmt8;

SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND column_name = 'dedupe_key') > 0,
        'SELECT 1',
        'ALTER TABLE attendance_sessions ADD COLUMN dedupe_key VARCHAR(96) NULL'
    )
);
PREPARE stmt9 FROM @sql;
EXECUTE stmt9;
DEALLOCATE PREPARE stmt9;

SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    'UPDATE attendance_sessions
     SET dedupe_key = CONCAT(''d-'', school_id, ''-'', class_group_id, ''-'', DATE_FORMAT(`date`, ''%Y-%m-%d''))
     WHERE dedupe_key IS NULL'
);
PREPARE stmt_upd FROM @sql;
EXECUTE stmt_upd;
DEALLOCATE PREPARE stmt_upd;

SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND index_name = 'idx_attendance_sessions_school') > 0,
        'SELECT 1',
        'CREATE INDEX idx_attendance_sessions_school ON attendance_sessions (school_id)'
    )
);
PREPARE stmt_ixs FROM @sql;
EXECUTE stmt_ixs;
DEALLOCATE PREPARE stmt_ixs;

SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND index_name = 'idx_attendance_sessions_class_group') > 0,
        'SELECT 1',
        'CREATE INDEX idx_attendance_sessions_class_group ON attendance_sessions (class_group_id)'
    )
);
PREPARE stmt_ixcg FROM @sql;
EXECUTE stmt_ixcg;
DEALLOCATE PREPARE stmt_ixcg;

SET @idx := IF(
    @has_attendance_sessions = 0,
    NULL,
    (
        SELECT s.INDEX_NAME
        FROM information_schema.statistics s
        WHERE s.TABLE_SCHEMA = @db
          AND s.TABLE_NAME = 'attendance_sessions'
          AND s.INDEX_NAME <> 'PRIMARY'
          AND s.NON_UNIQUE = 0
          AND s.SEQ_IN_INDEX = 1
          AND s.COLUMN_NAME = 'school_id'
          AND EXISTS (
              SELECT 1 FROM information_schema.statistics s2
              WHERE s2.TABLE_SCHEMA = s.TABLE_SCHEMA
                AND s2.TABLE_NAME = s.TABLE_NAME
                AND s2.INDEX_NAME = s.INDEX_NAME
                AND s2.COLUMN_NAME = 'class_group_id'
          )
          AND EXISTS (
              SELECT 1 FROM information_schema.statistics s3
              WHERE s3.TABLE_SCHEMA = s.TABLE_SCHEMA
                AND s3.TABLE_NAME = s.TABLE_NAME
                AND s3.INDEX_NAME = s.INDEX_NAME
                AND s3.COLUMN_NAME = 'date'
          )
        LIMIT 1
    )
);

SET @dropSql := IF(
    @idx IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE attendance_sessions DROP INDEX `', @idx, '`')
);
PREPARE stmtDrop FROM @dropSql;
EXECUTE stmtDrop;
DEALLOCATE PREPARE stmtDrop;

SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND column_name = 'dedupe_key') = 0,
        'SELECT 1',
        IF(
            (SELECT IS_NULLABLE FROM information_schema.columns
             WHERE table_schema = @db AND table_name = 'attendance_sessions' AND column_name = 'dedupe_key') = 'NO',
            'SELECT 1',
            'ALTER TABLE attendance_sessions MODIFY COLUMN dedupe_key VARCHAR(96) NOT NULL'
        )
    )
);
PREPARE stmt10 FROM @sql;
EXECUTE stmt10;
DEALLOCATE PREPARE stmt10;

SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND column_name = 'dedupe_key') = 0,
        'SELECT 1',
        IF(
            (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = @db AND table_name = 'attendance_sessions' AND index_name = 'uk_attendance_sessions_dedupe') > 0,
            'SELECT 1',
            'CREATE UNIQUE INDEX uk_attendance_sessions_dedupe ON attendance_sessions (dedupe_key)'
        )
    )
);
PREPARE stmt11 FROM @sql;
EXECUTE stmt11;
DEALLOCATE PREPARE stmt11;

SET @sql := IF(
    @has_attendance_sessions = 0 OR @has_lectures = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND constraint_name = 'fk_as_lecture') > 0,
        'SELECT 1',
        'ALTER TABLE attendance_sessions ADD CONSTRAINT fk_as_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id)'
    )
);
PREPARE stmt12 FROM @sql;
EXECUTE stmt12;
DEALLOCATE PREPARE stmt12;

SET @sql := IF(
    @has_attendance_sessions = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'attendance_sessions' AND index_name = 'idx_as_lecture') > 0,
        'SELECT 1',
        'CREATE INDEX idx_as_lecture ON attendance_sessions (lecture_id)'
    )
);
PREPARE stmt13 FROM @sql;
EXECUTE stmt13;
DEALLOCATE PREPARE stmt13;
