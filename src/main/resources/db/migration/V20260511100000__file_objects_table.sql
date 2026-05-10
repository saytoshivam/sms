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

-- Link student_documents to file_objects (nullable; old rows keep file_url)
ALTER TABLE student_documents
    ADD COLUMN IF NOT EXISTS file_id BIGINT NULL,
    ADD COLUMN IF NOT EXISTS profile_photo_file_id BIGINT NULL;

-- Remove the profile_photo_file_id from student_documents (it belongs on students)
ALTER TABLE student_documents DROP COLUMN IF EXISTS profile_photo_file_id;

-- Add profile photo FK column to students table
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS profile_photo_file_id BIGINT NULL;

