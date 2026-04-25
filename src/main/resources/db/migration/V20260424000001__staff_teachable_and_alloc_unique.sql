-- Staff "can teach" capabilities + one allocation row per (school, class, subject).

CREATE TABLE IF NOT EXISTS staff_teachable_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    subject_id INT NOT NULL,
    UNIQUE KEY uq_staff_teachable (staff_id, subject_id),
    KEY idx_sts_subject (subject_id),
    KEY idx_sts_staff (staff_id),
    CONSTRAINT fk_sts_staff FOREIGN KEY (staff_id) REFERENCES staff (id) ON DELETE CASCADE,
    CONSTRAINT fk_sts_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Deduplicate subject_allocations: keep the lowest id for each (school, class, subject).
DELETE sa1
FROM subject_allocations sa1
         INNER JOIN subject_allocations sa2
                    ON sa1.school_id = sa2.school_id
                        AND sa1.class_group_id = sa2.class_group_id
                        AND sa1.subject_id = sa2.subject_id
                        AND sa1.id > sa2.id;

-- Drop old 4-column unique (name may be uq_subject_alloc or may already be removed).
SET @q := IF(
        (SELECT COUNT(*)
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'subject_allocations'
           AND index_name = 'uq_subject_alloc') > 0,
        'ALTER TABLE subject_allocations DROP INDEX uq_subject_alloc',
        'SELECT 1');
PREPARE stmt FROM @q;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add new 3-column unique if not present.
SET @q2 := IF(
        (SELECT COUNT(*)
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'subject_allocations'
           AND index_name = 'uq_subject_alloc_per_class_subject') = 0,
        'ALTER TABLE subject_allocations ADD UNIQUE KEY uq_subject_alloc_per_class_subject (school_id, class_group_id, subject_id)',
        'SELECT 1');
PREPARE stmt2 FROM @q2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
