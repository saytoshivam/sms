-- Grading schemes are reusable master configurations.
-- They may apply always, or be bounded by an optional effective academic-year range.

ALTER TABLE grading_schemes
    ADD COLUMN scope VARCHAR(32) NOT NULL DEFAULT 'SCHOOL' AFTER academic_year_id,
    ADD COLUMN class_group_id INT NULL AFTER scope,
    ADD COLUMN default_scheme TINYINT(1) NOT NULL DEFAULT 1 AFTER class_group_id,
    ADD COLUMN passing_percent DECIMAL(5,2) NOT NULL DEFAULT 33.00 AFTER default_scheme,
    ADD COLUMN effective_from_academic_year_id INT NULL AFTER passing_percent,
    ADD COLUMN effective_to_academic_year_id INT NULL AFTER effective_from_academic_year_id;

CREATE INDEX idx_gs_effective_from ON grading_schemes (effective_from_academic_year_id);
CREATE INDEX idx_gs_effective_to ON grading_schemes (effective_to_academic_year_id);
CREATE INDEX idx_gs_scope_class ON grading_schemes (scope, class_group_id);

ALTER TABLE grading_schemes
    ADD CONSTRAINT fk_gs_class_group FOREIGN KEY (class_group_id) REFERENCES class_groups (id),
    ADD CONSTRAINT fk_gs_effective_from_ay FOREIGN KEY (effective_from_academic_year_id) REFERENCES academic_years (id),
    ADD CONSTRAINT fk_gs_effective_to_ay FOREIGN KEY (effective_to_academic_year_id) REFERENCES academic_years (id);
