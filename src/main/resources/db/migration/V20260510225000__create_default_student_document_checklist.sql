-- Create default document checklist rows for all existing students
-- Ensures every student has default admission documents for tracking
-- Guard: students is Hibernate-managed; skip on fresh DB.

DROP PROCEDURE IF EXISTS _sp_default_student_docs;
CREATE PROCEDURE _sp_default_student_docs()
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students') THEN
        INSERT INTO student_documents (
            student_id,
            document_type,
            collection_status,
            upload_status,
            verification_status,
            file_url,
            verified_by,
            verified_at,
            remarks,
            created_at,
            updated_at
        )
        SELECT
            s.id,
            dt.doc_type,
            'PENDING_COLLECTION',
            'NOT_UPLOADED',
            'NOT_VERIFIED',
            NULL,
            NULL,
            NULL,
            NULL,
            NOW(),
            NOW()
        FROM students s
        CROSS JOIN (
            SELECT 'BIRTH_CERTIFICATE' AS doc_type
            UNION ALL SELECT 'AADHAAR_CARD'
            UNION ALL SELECT 'TRANSFER_CERTIFICATE'
            UNION ALL SELECT 'PREVIOUS_MARKSHEET'
            UNION ALL SELECT 'PARENT_ID_PROOF'
            UNION ALL SELECT 'ADDRESS_PROOF'
        ) dt
        WHERE NOT EXISTS (
            SELECT 1 FROM student_documents sd
            WHERE sd.student_id = s.id
              AND sd.document_type = dt.doc_type
        );
    END IF;
END;
CALL _sp_default_student_docs();
DROP PROCEDURE IF EXISTS _sp_default_student_docs;
