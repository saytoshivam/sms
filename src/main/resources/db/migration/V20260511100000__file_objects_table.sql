-- File management: central file_objects table for all ERP attachments
CREATE TABLE IF NOT EXISTS file_objects (
    id                BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    school_id         INT           NOT NULL,
    owner_type        VARCHAR(64)   NOT NULL COMMENT 'e.g. STUDENT, TEACHER',
    owner_id          VARCHAR(64)   NOT NULL COMMENT 'PK of the owning entity',
    file_category     VARCHAR(48)   NOT NULL,
    original_filename VARCHAR(512)  NOT NULL,
    stored_filename   VARCHAR(512)  NOT NULL,
    storage_provider  VARCHAR(32)   NOT NULL COMMENT 'local | s3',
    bucket_name       VARCHAR(128)  NULL,
    storage_key       VARCHAR(1024) NOT NULL,
    content_type      VARCHAR(128)  NOT NULL,
    file_size         BIGINT        NOT NULL,
    checksum          VARCHAR(64)   NULL,
    visibility        VARCHAR(32)   NOT NULL DEFAULT 'SCHOOL_INTERNAL',
    status            VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE',
    uploaded_by       INT           NULL,
    uploaded_at       DATETIME(6)   NOT NULL,
    deleted_at        DATETIME(6)   NULL,
    INDEX idx_fo_school  (school_id),
    INDEX idx_fo_owner   (owner_type, owner_id),
    INDEX idx_fo_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add file_id to student_documents (safe for MySQL 5.7+ — IF NOT EXISTS not supported before 8.0.3)
SET @col_sd_file_id := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_documents' AND COLUMN_NAME = 'file_id'
);
SET @sql := IF(@col_sd_file_id = 0,
    'ALTER TABLE student_documents ADD COLUMN file_id BIGINT NULL',
    'SELECT 1 -- file_id already exists, skip');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- Add profile_photo_file_id to students (safe for MySQL 5.7+)
SET @col_stu_photo := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'profile_photo_file_id'
);
SET @sql := IF(@col_stu_photo = 0,
    'ALTER TABLE students ADD COLUMN profile_photo_file_id BIGINT NULL',
    'SELECT 1 -- profile_photo_file_id already exists, skip');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
