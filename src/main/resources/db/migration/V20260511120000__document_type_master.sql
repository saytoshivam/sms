-- ─────────────────────────────────────────────────────────────────────────────
-- Document Type Master  — system-seeded catalogue of reusable document types
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_types (
    id                INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code              VARCHAR(64)   NOT NULL,
    name              VARCHAR(128)  NOT NULL,
    description       VARCHAR(512)  NULL,
    target_type       VARCHAR(32)   NOT NULL COMMENT 'STUDENT | TEACHER | GUARDIAN | STAFF | GENERAL',
    is_system_defined TINYINT(1)    NOT NULL DEFAULT 0,
    is_active         TINYINT(1)    NOT NULL DEFAULT 1,
    sort_order        INT           NOT NULL DEFAULT 100,
    UNIQUE KEY uq_doctype_code_target (code, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Student document types ────────────────────────────────────────────────────
INSERT INTO document_types (code, name, description, target_type, is_system_defined, is_active, sort_order) VALUES
('BIRTH_CERTIFICATE',     'Birth Certificate',            'Official birth certificate issued by government authorities',        'STUDENT', 1, 1,  10),
('AADHAAR_CARD',          'Aadhaar Card',                 'Government-issued national identity document (UID)',                 'STUDENT', 1, 1,  20),
('TRANSFER_CERTIFICATE',  'Transfer Certificate',          'Transfer certificate (TC) from previous school',                    'STUDENT', 1, 1,  30),
('PREVIOUS_MARKSHEET',    'Previous Marksheet',            'Last academic year marksheet / report card',                        'STUDENT', 1, 1,  40),
('PARENT_ID_PROOF',       'Parent ID Proof',               'Identity proof of parent or guardian',                              'STUDENT', 1, 1,  50),
('ADDRESS_PROOF',         'Address Proof',                 'Proof of residential address (utility bill, Aadhaar, etc.)',        'STUDENT', 1, 1,  60),
('CASTE_CERTIFICATE',     'Caste Certificate',             'Caste or category certificate, if applicable',                      'STUDENT', 1, 1,  70),
('MEDICAL_CERTIFICATE',   'Medical Certificate',           'Medical fitness or health certificate',                             'STUDENT', 1, 1,  80),
('MIGRATION_CERTIFICATE', 'Migration Certificate',         'Required for students migrating from another state or board',       'STUDENT', 1, 1,  90),
('CHARACTER_CERTIFICATE', 'Character Certificate',         'Character certificate from previous institution',                   'STUDENT', 1, 1, 100),
('INCOME_CERTIFICATE',    'Income Certificate',            'Income certificate for fee concession or scholarship',              'STUDENT', 1, 1, 110),
('PASSPORT_PHOTO',        'Passport Photo',                'Recent passport-size photograph',                                   'STUDENT', 1, 1, 120);

-- ── Teacher / Staff document types ───────────────────────────────────────────
INSERT INTO document_types (code, name, description, target_type, is_system_defined, is_active, sort_order) VALUES
('AADHAAR_CARD',          'Aadhaar Card',                 'Government-issued national identity document (UID)',                 'TEACHER', 1, 1,  10),
('PAN_CARD',              'PAN Card',                     'Permanent Account Number card',                                     'TEACHER', 1, 1,  20),
('RESUME',                'Resume / CV',                  'Updated curriculum vitae with employment history',                  'TEACHER', 1, 1,  30),
('EDUCATIONAL_CERTIFICATES', 'Educational Certificates',  'Degree or diploma certificates for qualifying education',           'TEACHER', 1, 1,  40),
('EXPERIENCE_LETTER',     'Experience Letter',            'Experience letter from previous employer',                          'TEACHER', 1, 1,  50),
('RELIEVING_LETTER',      'Relieving Letter',             'Relieving letter from most recent employer',                        'TEACHER', 1, 1,  60),
('BANK_PROOF',            'Bank Proof / Cancelled Cheque','Cancelled cheque or bank passbook for salary transfer',             'TEACHER', 1, 1,  70),
('POLICE_VERIFICATION',   'Police Verification',          'Police clearance or verification certificate',                      'TEACHER', 1, 1,  80),
('MEDICAL_FITNESS',       'Medical Fitness Certificate',  'Medical fitness certificate for employment',                        'TEACHER', 1, 1,  90),
('APPOINTMENT_LETTER',    'Appointment Letter',           'Appointment letter issued by the school',                          'TEACHER', 1, 1, 100),
('TEACHING_QUALIFICATION','B.Ed / Teaching Qualification','Teaching qualification certificate (B.Ed, D.El.Ed, etc.)',          'TEACHER', 1, 1, 110),
('ADDRESS_PROOF',         'Address Proof',                'Proof of residential address',                                      'TEACHER', 1, 1, 120),
('PASSPORT_PHOTO',        'Passport Photo',               'Recent passport-size photograph',                                   'TEACHER', 1, 1, 130);

