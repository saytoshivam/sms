-- Make grading schemes fully configurable with lifecycle, editable band labels/results, and class assignments.

ALTER TABLE grading_schemes
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' AFTER name;

CREATE INDEX idx_gs_status ON grading_schemes (status);

ALTER TABLE grading_bands
    ADD COLUMN label VARCHAR(64) NULL AFTER max_percent,
    ADD COLUMN result_type VARCHAR(8) NOT NULL DEFAULT 'PASS' AFTER label;

UPDATE grading_bands
SET label = CASE UPPER(grade)
    WHEN 'A1' THEN 'Outstanding'
    WHEN 'A2' THEN 'Excellent'
    WHEN 'B1' THEN 'Very Good'
    WHEN 'B2' THEN 'Good'
    WHEN 'C1' THEN 'Average'
    WHEN 'C2' THEN 'Below Average'
    WHEN 'D' THEN 'Pass'
    WHEN 'E' THEN 'Fail'
    ELSE grade
END,
result_type = CASE WHEN UPPER(grade) IN ('E', 'F', 'FAIL') THEN 'FAIL' ELSE 'PASS' END
WHERE label IS NULL;

ALTER TABLE grading_bands
    MODIFY COLUMN label VARCHAR(64) NOT NULL;

CREATE TABLE grading_scheme_class_assignments (
    id INT NOT NULL AUTO_INCREMENT,
    grading_scheme_id INT NOT NULL,
    class_group_id INT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_gsca_scheme FOREIGN KEY (grading_scheme_id) REFERENCES grading_schemes (id) ON DELETE CASCADE,
    CONSTRAINT fk_gsca_class_group FOREIGN KEY (class_group_id) REFERENCES class_groups (id),
    UNIQUE KEY uk_gsca_scheme_class (grading_scheme_id, class_group_id),
    INDEX idx_gsca_scheme (grading_scheme_id),
    INDEX idx_gsca_class_group (class_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO grading_scheme_class_assignments (grading_scheme_id, class_group_id)
SELECT id, class_group_id
FROM grading_schemes
WHERE scope = 'CLASS_GROUP' AND class_group_id IS NOT NULL;
