-- Add verification_source column to student_documents
-- This tracks HOW a document was verified:
--   PHYSICAL_ORIGINAL - admin inspected the physical original (no upload required)
--   UPLOADED_COPY     - verification done against an uploaded scanned/photo copy
-- Nullable: only set when verification_status = 'VERIFIED'

ALTER TABLE student_documents
    ADD COLUMN IF NOT EXISTS verification_source VARCHAR(32) NULL;

