-- Academic marks for analytics + optional student portal link on users.
-- Uses information_schema checks so this stays safe on brownfield DBs where Hibernate may have created columns first.

CREATE TABLE IF NOT EXISTS student_marks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    student_id INT NOT NULL,
    subject_code VARCHAR(32) NOT NULL,
    assessment_key VARCHAR(64) NOT NULL,
    assessment_title VARCHAR(128) NOT NULL,
    max_score DECIMAL(6, 2) NOT NULL,
    score_obtained DECIMAL(6, 2) NOT NULL,
    assessed_on DATE NOT NULL,
    term_name VARCHAR(64),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_student_marks_seed (school_id, student_id, subject_code, assessment_key),
    KEY idx_student_marks_student (student_id),
    KEY idx_student_marks_school (school_id)
);

SET @db := DATABASE();
SET @has_users := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = @db AND table_name = 'users'
);
SET @sql := IF(
    @has_users = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = @db AND table_name = 'users' AND column_name = 'linked_student_id') > 0,
        'SELECT 1',
        'ALTER TABLE users ADD COLUMN linked_student_id INT NULL'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    @has_users = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = @db AND table_name = 'users' AND index_name = 'idx_users_linked_student_id') > 0,
        'SELECT 1',
        'CREATE INDEX idx_users_linked_student_id ON users (linked_student_id)'
    )
);
PREPARE stmt2 FROM @sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
