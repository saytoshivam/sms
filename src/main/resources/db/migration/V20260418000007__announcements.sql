-- Idempotent: local DBs may already have these tables from manual tests or partial runs.
-- No FK constraints here: Flyway runs before Hibernate on an empty DB, so schools/users/class_groups may not exist yet.
-- JPA enforces relationships at runtime; Hibernate ddl-auto=update aligns the schema after core tables exist.
CREATE TABLE IF NOT EXISTS announcements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    school_id       INT          NOT NULL,
    author_user_id  INT          NOT NULL,
    category        VARCHAR(32)  NOT NULL,
    title           VARCHAR(512) NOT NULL,
    body            TEXT         NOT NULL,
    reference_code  VARCHAR(128) NOT NULL,
    audience        VARCHAR(32)  NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_announcements_school_created (school_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS announcement_target_classes (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id   INT NOT NULL,
    class_group_id    INT NOT NULL,
    UNIQUE KEY uq_announcement_class (announcement_id, class_group_id)
);
