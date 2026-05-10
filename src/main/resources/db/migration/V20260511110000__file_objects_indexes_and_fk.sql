-- Add indexes and foreign keys for file_objects, student_documents, students
-- Safe to run repeatedly: uses IF NOT EXISTS / IF EXISTS guards

-- Composite query index: covers the most common FileObjectRepo lookup pattern
ALTER TABLE file_objects
    ADD INDEX IF NOT EXISTS idx_fo_owner_category (school_id, owner_type, owner_id, file_category);

-- Index used by FileServeController (findByStorageKeyAndSchoolIdAndStatusNot)
ALTER TABLE file_objects
    ADD INDEX IF NOT EXISTS idx_fo_storage_key (school_id, storage_key(255));

-- Index for FK lookups on student_documents.file_id
ALTER TABLE student_documents
    ADD INDEX IF NOT EXISTS idx_sd_file_id (file_id);

-- Index for FK lookups on students.profile_photo_file_id
ALTER TABLE students
    ADD INDEX IF NOT EXISTS idx_stu_photo_file (profile_photo_file_id);

-- FK: student_documents.file_id -> file_objects.id
-- ON DELETE SET NULL keeps the document row even after the file object is soft-deleted
ALTER TABLE student_documents
    ADD CONSTRAINT IF NOT EXISTS fk_sd_file_id
        FOREIGN KEY (file_id) REFERENCES file_objects (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- FK: students.profile_photo_file_id -> file_objects.id
ALTER TABLE students
    ADD CONSTRAINT IF NOT EXISTS fk_stu_photo_file_id
        FOREIGN KEY (profile_photo_file_id) REFERENCES file_objects (id)
        ON DELETE SET NULL ON UPDATE CASCADE;
