-- ─────────────────────────────────────────────────────────────────────────────
-- Staff Documents — document checklist lifecycle for staff members
-- Mirrors the student_documents pattern with a STAFF target.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_documents (
    id                  INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staff_id            INT           NOT NULL,
    document_type       VARCHAR(64)   NOT NULL   COMMENT 'Code string e.g. PHOTO, RESUME',
    document_type_id    INT           NULL        COMMENT 'FK to document_types.id; null for legacy rows',
    collection_status   VARCHAR(32)   NOT NULL   DEFAULT 'PENDING_COLLECTION'
                                                  COMMENT 'PENDING_COLLECTION | COLLECTED_PHYSICAL | NOT_REQUIRED',
    upload_status       VARCHAR(32)   NOT NULL   DEFAULT 'NOT_UPLOADED'
                                                  COMMENT 'NOT_UPLOADED | UPLOADED',
    verification_status VARCHAR(32)   NOT NULL   DEFAULT 'NOT_VERIFIED'
                                                  COMMENT 'NOT_VERIFIED | VERIFIED | REJECTED',
    verification_source VARCHAR(32)   NULL        COMMENT 'PHYSICAL_ORIGINAL | UPLOADED_COPY — set when VERIFIED',
    file_id             BIGINT        NULL        COMMENT 'FK to file_objects.id; set after upload',
    verified_by         INT           NULL        COMMENT 'FK to staff.id who verified this document',
    verified_at         DATETIME(6)   NULL,
    remarks             VARCHAR(1024) NULL,
    created_at          DATETIME(6)   NOT NULL,
    updated_at          DATETIME(6)   NOT NULL,

    CONSTRAINT fk_staff_doc_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    INDEX idx_staff_doc_staff_id (staff_id),
    INDEX idx_staff_doc_document_type (document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── STAFF document types — seeded master catalogue ───────────────────────────
INSERT IGNORE INTO document_types (code, name, description, target_type, is_system_defined, is_active, sort_order) VALUES
('PHOTO',                    'Photo',                       'Recent passport-size photograph of staff member',                 'STAFF', 1, 1,  10),
('AADHAAR_ID_PROOF',         'Aadhaar / ID Proof',          'Government-issued national identity document (Aadhaar or other)', 'STAFF', 1, 1,  20),
('ADDRESS_PROOF',            'Address Proof',               'Proof of residential address (utility bill, Aadhaar, etc.)',      'STAFF', 1, 1,  30),
('QUALIFICATION_CERTIFICATE','Qualification Certificate',   'Highest academic qualification certificate',                      'STAFF', 1, 1,  40),
('EXPERIENCE_LETTER',        'Experience Letter',           'Experience / service letter from previous employer',              'STAFF', 1, 1,  50),
('APPOINTMENT_LETTER',       'Appointment Letter',          'Appointment letter issued by this institution',                   'STAFF', 1, 1,  60),
('RESUME',                   'Resume / CV',                 'Updated curriculum vitae with employment history',                'STAFF', 1, 1,  70),
('POLICE_VERIFICATION',      'Police Verification',         'Police clearance or verification certificate',                    'STAFF', 1, 1,  80),
('MEDICAL_FITNESS',          'Medical Fitness',             'Medical fitness certificate for employment',                      'STAFF', 1, 1,  90),
('PAN_CARD',                 'PAN Card',                    'Permanent Account Number card',                                   'STAFF', 1, 1, 100),
('BANK_PROOF',               'Bank Proof',                  'Cancelled cheque or bank passbook for salary transfer',           'STAFF', 1, 1, 110);

-- ── Default document rows for all existing staff members ─────────────────────
-- Creates one row per default document type per staff member (skips if already exists).
INSERT INTO staff_documents (
    staff_id, document_type, document_type_id,
    collection_status, upload_status, verification_status,
    created_at, updated_at
)
SELECT
    s.id,
    dt.code,
    dt.id,
    'PENDING_COLLECTION',
    'NOT_UPLOADED',
    'NOT_VERIFIED',
    NOW(6),
    NOW(6)
FROM staff s
CROSS JOIN document_types dt
WHERE dt.target_type = 'STAFF'
  AND dt.is_active   = 1
  AND s.is_deleted   = 0
  AND NOT EXISTS (
      SELECT 1 FROM staff_documents sd
      WHERE sd.staff_id      = s.id
        AND sd.document_type = dt.code
  );

