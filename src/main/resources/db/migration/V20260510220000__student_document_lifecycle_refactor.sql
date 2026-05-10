-- Add new document lifecycle tracking columns to student_documents table
-- Supports real admission document workflow: collect physical -> upload scan -> verify

ALTER TABLE student_documents 
ADD COLUMN collection_status VARCHAR(32) DEFAULT 'PENDING_COLLECTION' NOT NULL,
ADD COLUMN upload_status VARCHAR(32) DEFAULT 'NOT_UPLOADED' NOT NULL,
ADD COLUMN verification_status VARCHAR(32) DEFAULT 'NOT_VERIFIED' NOT NULL;

-- Make file_url nullable to support checklist rows before upload
ALTER TABLE student_documents 
MODIFY COLUMN file_url VARCHAR(1024) NULL;

-- Migrate legacy status values to new lifecycle fields
-- PENDING -> physical not collected, not uploaded, not verified
UPDATE student_documents 
SET collection_status = 'PENDING_COLLECTION',
    upload_status = 'NOT_UPLOADED',
    verification_status = 'NOT_VERIFIED'
WHERE status = 'PENDING';

-- SUBMITTED -> physical collected, file uploaded, not verified
UPDATE student_documents 
SET collection_status = 'COLLECTED_PHYSICAL',
    upload_status = 'UPLOADED',
    verification_status = 'NOT_VERIFIED'
WHERE status = 'SUBMITTED';

-- VERIFIED -> physical collected, file uploaded, verified
UPDATE student_documents 
SET collection_status = 'COLLECTED_PHYSICAL',
    upload_status = 'UPLOADED',
    verification_status = 'VERIFIED'
WHERE status = 'VERIFIED';

-- REJECTED -> physical collected, file uploaded, rejected
UPDATE student_documents 
SET collection_status = 'COLLECTED_PHYSICAL',
    upload_status = 'UPLOADED',
    verification_status = 'REJECTED'
WHERE status = 'REJECTED';

-- Make status column nullable for backward compatibility during transition
ALTER TABLE student_documents 
MODIFY COLUMN status VARCHAR(32) NULL;
