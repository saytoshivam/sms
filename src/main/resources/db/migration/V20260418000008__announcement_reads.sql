-- No FK constraints: Flyway may run before Hibernate creates students/announcements on a fresh database.
CREATE TABLE IF NOT EXISTS announcement_reads (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT NOT NULL,
    announcement_id  INT NOT NULL,
    read_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_student_announcement (student_id, announcement_id)
);
