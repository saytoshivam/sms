-- Add profile_photo_file_id column to staff table
-- Mirrors the student.profile_photo_file_id pattern; stores a FileObject PK,
-- not a raw URL.  The frontend calls GET /api/files/{id}/content (blob) to display.

ALTER TABLE staff
    ADD COLUMN profile_photo_file_id INT NULL DEFAULT NULL
        COMMENT 'FK to file_objects.id — staff profile photo';

