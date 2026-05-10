-- Add indexes and foreign keys for file_objects, student_documents, students
-- Compatible with MySQL 5.7+ (ADD INDEX/CONSTRAINT IF NOT EXISTS requires MySQL 8.0.3+)

-- Composite query index: covers the most common FileObjectRepo lookup pattern
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_objects' AND INDEX_NAME = 'idx_fo_owner_category');
SET @sql := IF(@idx = 0,
    'ALTER TABLE file_objects ADD INDEX idx_fo_owner_category (school_id, owner_type, owner_id, file_category)',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- Index used by FileServeController (findByStorageKeyAndSchoolIdAndStatusNot)
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'file_objects' AND INDEX_NAME = 'idx_fo_storage_key');
SET @sql := IF(@idx = 0,
    'ALTER TABLE file_objects ADD INDEX idx_fo_storage_key (school_id, storage_key(255))',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- Index for FK lookups on student_documents.file_id
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_documents' AND INDEX_NAME = 'idx_sd_file_id');
SET @sql := IF(@idx = 0,
    'ALTER TABLE student_documents ADD INDEX idx_sd_file_id (file_id)',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- Index for FK lookups on students.profile_photo_file_id
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND INDEX_NAME = 'idx_stu_photo_file');
SET @sql := IF(@idx = 0,
    'ALTER TABLE students ADD INDEX idx_stu_photo_file (profile_photo_file_id)',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- FK: student_documents.file_id -> file_objects.id
-- ON DELETE SET NULL keeps the document row even after the file object is soft-deleted
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_documents'
    AND CONSTRAINT_NAME = 'fk_sd_file_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0,
    'ALTER TABLE student_documents ADD CONSTRAINT fk_sd_file_id FOREIGN KEY (file_id) REFERENCES file_objects (id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;

-- FK: students.profile_photo_file_id -> file_objects.id
SET @fk := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students'
    AND CONSTRAINT_NAME = 'fk_stu_photo_file_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@fk = 0,
    'ALTER TABLE students ADD CONSTRAINT fk_stu_photo_file_id FOREIGN KEY (profile_photo_file_id) REFERENCES file_objects (id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1');
PREPARE _stmt FROM @sql; EXECUTE _stmt; DEALLOCATE PREPARE _stmt;
