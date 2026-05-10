-- Improve file_objects indexes and add FK constraints for referential integrity

-- Composite index covering the most common query pattern in FileObjectRepo
ALTER TABLE file_objects
    ADD INDEX IF NOT EXISTS idx_fo_owner_category (school_id, owner_type, owner_id, file_category);

-- Index on storage_key for FileServeController lookups (findByStorageKeyAndSchoolId)
ALTER TABLE file_objects
    ADD INDEX IF NOT EXISTS idx_fo_storage_key (school_id, storage_key(255));

-- Index on student_documents.file_id for FK lookups and JOIN performance
ALTER TABLE student_documents
    ADD INDEX IF NOT EXISTS idx_sd_file_id (file_id);

-- Index on students.profile_photo_file_id
ALTER TABLE students
    ADD INDEX IF NOT EXISTS idx_stu_photo_file (profile_photo_file_id);

-- Foreign key: student_documents.file_id -> file_objects.id
-- Constraint is deferred to allow soft-delete (file row stays after deletion)
ALTER TABLE student_documents
    ADD CONSTRAINT IF NOT EXISTS fk_sd_file_id
        FOREIGN KEY (file_id) REFERENCES file_objects (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key: students.profile_photo_file_id -> file_objects.id
ALTER TABLE students
    ADD CONSTRAINT IF NOT EXISTS fk_stu_photo_file_id
        FOREIGN KEY (profile_photo_file_id) REFERENCES file_objects (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

