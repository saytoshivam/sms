-- Student onboarding foundation: academic years, enrollments, guardian mapping, documents, medical
-- MySQL 8+
SET @db := DATABASE();

-- ---- academic_years ----
CREATE TABLE IF NOT EXISTS academic_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    label VARCHAR(128) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_academic_years_school FOREIGN KEY (school_id) REFERENCES schools (id),
    UNIQUE KEY uk_academic_year_school_label (school_id, label),
    KEY idx_academic_year_school (school_id)
) ENGINE=InnoDB;

-- ---- students extra columns ----
SET @stmt := IF(
        (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = @db AND table_name = 'students' AND column_name = 'middle_name') > 0,
        'SELECT 1',
        'ALTER TABLE students ADD COLUMN middle_name VARCHAR(128) NULL AFTER first_name');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
        (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = @db AND table_name = 'students' AND column_name = 'blood_group') > 0,
        'SELECT 1',
        'ALTER TABLE students ADD COLUMN blood_group VARCHAR(16) NULL');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
        (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = @db AND table_name = 'students' AND column_name = 'status') > 0,
        'SELECT 1',
        "ALTER TABLE students ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'");
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
        (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = @db AND table_name = 'students' AND column_name = 'updated_at') > 0,
        'SELECT 1',
        'ALTER TABLE students ADD COLUMN updated_at DATETIME(6) NULL');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE students SET updated_at = created_at WHERE updated_at IS NULL;

-- ---- guardians extended columns ----
SET @has_guardians := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'guardians');

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'occupation') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN occupation VARCHAR(128) NULL'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'address_line1') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN address_line1 VARCHAR(255) NULL'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'address_line2') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN address_line2 VARCHAR(255) NULL'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'city') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN city VARCHAR(128) NULL'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'state_field') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN state_field VARCHAR(128) NULL'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'pincode') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN pincode VARCHAR(16) NULL'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'created_at') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'updated_at') > 0,
                   'SELECT 1', 'ALTER TABLE guardians ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @guardian_has_student_id := IF(
        @has_guardians = 0, 0,
        (SELECT COUNT(*) FROM information_schema.columns
           WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'guardians' AND COLUMN_NAME = 'student_id'));

SET @u := IF(@guardian_has_student_id > 0,
        'UPDATE guardians SET phone = ''-'' WHERE student_id IS NOT NULL AND (phone IS NULL OR LENGTH(TRIM(IFNULL(phone,''''))) = 0)',
        'SELECT 1');
PREPARE sg_phone FROM @u; EXECUTE sg_phone; DEALLOCATE PREPARE sg_phone;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'phone' AND IS_NULLABLE = 'YES') > 0,
                   'ALTER TABLE guardians MODIFY COLUMN phone VARCHAR(32) NOT NULL', 'SELECT 1'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS student_guardians (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    guardian_id INT NOT NULL,
    relation VARCHAR(64) NOT NULL,
    is_primary BIT(1) NOT NULL DEFAULT b'0',
    can_login BIT(1) NOT NULL DEFAULT b'0',
    receives_notifications BIT(1) NOT NULL DEFAULT b'1',
    CONSTRAINT fk_sg_student FOREIGN KEY (student_id) REFERENCES students (id),
    CONSTRAINT fk_sg_guardian FOREIGN KEY (guardian_id) REFERENCES guardians (id),
    UNIQUE KEY uk_sg_student_guardian (student_id, guardian_id),
    KEY idx_sg_student_primary (student_id, is_primary)
) ENGINE=InnoDB;

-- Migrate legacy guardians.student_id into join rows (only when column still exists)
SET @migrate_sg := IF(@guardian_has_student_id > 0,
        CONCAT(
                'INSERT IGNORE INTO student_guardians (student_id, guardian_id, relation, is_primary, can_login, receives_notifications) ',
                'SELECT student_id, id, ',
                'CASE WHEN relation IS NULL OR LENGTH(TRIM(IFNULL(relation,''''))) = 0 THEN ''Parent'' ELSE LEFT(TRIM(relation), 64) END, ',
                'TRUE, FALSE, TRUE FROM guardians ',
                'WHERE student_id IS NOT NULL AND NOT EXISTS ',
                '(SELECT 1 FROM student_guardians sg WHERE sg.guardian_id = guardians.id)'),
        'SELECT 1');
PREPARE ins_sg FROM @migrate_sg; EXECUTE ins_sg; DEALLOCATE PREPARE ins_sg;

-- Drop FK guardians -> students then column student_id
SET @fk := (SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = @db
              AND TABLE_NAME = 'guardians'
              AND COLUMN_NAME = 'student_id'
              AND REFERENCED_TABLE_NAME IS NOT NULL
              LIMIT 1);
SET @dropfk := IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE guardians DROP FOREIGN KEY `', @fk, '`'));
PREPARE sgfk FROM @dropfk;
EXECUTE sgfk;
DEALLOCATE PREPARE sgfk;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'student_id') > 0,
                   'ALTER TABLE guardians DROP COLUMN student_id', 'SELECT 1'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@has_guardians = 0, 'SELECT 1',
                IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = 'guardians' AND column_name = 'relation') > 0,
                   'ALTER TABLE guardians DROP COLUMN relation', 'SELECT 1'));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- student enrollments ----
CREATE TABLE IF NOT EXISTS student_academic_enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    class_group_id INT NOT NULL,
    roll_no VARCHAR(32) NULL,
    admission_date DATE NULL,
    joining_date DATE NULL,
    status VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_sae_student FOREIGN KEY (student_id) REFERENCES students (id),
    CONSTRAINT fk_sae_ay FOREIGN KEY (academic_year_id) REFERENCES academic_years (id),
    CONSTRAINT fk_sae_class_group FOREIGN KEY (class_group_id) REFERENCES class_groups (id),
    UNIQUE KEY uk_sae_student_academic_year (student_id, academic_year_id),
    UNIQUE KEY uk_sae_roll (academic_year_id, class_group_id, roll_no),
    KEY idx_sae_student (student_id),
    KEY idx_sae_class_year (class_group_id, academic_year_id)
) ENGINE=InnoDB;

-- ---- medical ----
CREATE TABLE IF NOT EXISTS student_medical_infos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL UNIQUE,
    allergies VARCHAR(2048) NULL,
    medical_conditions VARCHAR(2048) NULL,
    emergency_contact_name VARCHAR(128) NULL,
    emergency_contact_phone VARCHAR(32) NULL,
    doctor_contact VARCHAR(256) NULL,
    medication_notes VARCHAR(4096) NULL,
    CONSTRAINT fk_smi_student FOREIGN KEY (student_id) REFERENCES students (id)
) ENGINE=InnoDB;

-- ---- documents ----
CREATE TABLE IF NOT EXISTS student_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    document_type VARCHAR(64) NOT NULL,
    file_url VARCHAR(1024) NOT NULL,
    status VARCHAR(32) NOT NULL,
    verified_by INT NULL,
    verified_at DATETIME(6) NULL,
    remarks VARCHAR(1024) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_sd_student FOREIGN KEY (student_id) REFERENCES students (id),
    KEY idx_sd_student (student_id)
) ENGINE=InnoDB;

-- Backfill academic year per school (April–March window heuristic)
INSERT INTO academic_years (school_id, label, starts_on, ends_on, created_at, updated_at)
SELECT s.id AS school_id,
       CONCAT(
               CASE WHEN MONTH(CURRENT_DATE()) >= 4 THEN YEAR(CURRENT_DATE())
                    ELSE YEAR(CURRENT_DATE()) - 1 END,
               '-',
               CASE WHEN MONTH(CURRENT_DATE()) >= 4 THEN YEAR(CURRENT_DATE()) + 1
                    ELSE YEAR(CURRENT_DATE()) END
       ),
       STR_TO_DATE(CONCAT(CASE WHEN MONTH(CURRENT_DATE()) >= 4 THEN YEAR(CURRENT_DATE())
                               ELSE YEAR(CURRENT_DATE()) - 1 END, '-04-01'), '%Y-%m-%d'),
       STR_TO_DATE(CONCAT(CASE WHEN MONTH(CURRENT_DATE()) >= 4 THEN YEAR(CURRENT_DATE()) + 1
                               ELSE YEAR(CURRENT_DATE()) END, '-03-31'), '%Y-%m-%d'),
       CURRENT_TIMESTAMP(6),
       CURRENT_TIMESTAMP(6)
FROM schools s
WHERE NOT EXISTS (
    SELECT 1 FROM academic_years ay WHERE ay.school_id = s.id
);

-- Backfill enrollments for students already assigned to class groups (with latest academic year for school)
INSERT IGNORE INTO student_academic_enrollments (
    student_id, academic_year_id, class_group_id, roll_no, admission_date, joining_date, status, created_at, updated_at
)
SELECT st.id AS student_id,
       ay.id AS academic_year_id,
       st.class_group_id,
       NULL,
       CAST(st.created_at AS DATE),
       CAST(st.created_at AS DATE),
       'ACTIVE',
       CURRENT_TIMESTAMP(6),
       CURRENT_TIMESTAMP(6)
FROM students st
JOIN class_groups cg ON cg.id = st.class_group_id
JOIN academic_years ay ON ay.school_id = st.school_id
WHERE ay.id = (
    SELECT ay2.id
    FROM academic_years ay2
    WHERE ay2.school_id = st.school_id
    ORDER BY ay2.starts_on DESC, ay2.id DESC
        LIMIT 1
    )
AND NOT EXISTS (SELECT 1 FROM student_academic_enrollments e WHERE e.student_id = st.id);
