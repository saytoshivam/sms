-- In-app alerts for platform operators (e.g. SUPER_ADMIN) when tenants request subscription changes.

CREATE TABLE IF NOT EXISTS platform_operator_notifications (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    kind VARCHAR(64) NOT NULL,
    title VARCHAR(512) NOT NULL,
    body TEXT,
    tenant_id INT NULL,
    actor_email VARCHAR(255) NULL,
    detail TEXT NULL
);

-- MySQL doesn't support CREATE INDEX IF NOT EXISTS; use information_schema guard.
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'platform_operator_notifications'
    AND index_name = 'idx_platform_op_notif_created'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_platform_op_notif_created ON platform_operator_notifications (created_at DESC)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'platform_operator_notifications'
    AND index_name = 'idx_platform_op_notif_kind'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_platform_op_notif_kind ON platform_operator_notifications (kind)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS platform_operator_notification_reads (
    notification_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (notification_id, user_id),
    CONSTRAINT fk_ponr_notification FOREIGN KEY (notification_id) REFERENCES platform_operator_notifications (id) ON DELETE CASCADE,
    CONSTRAINT fk_ponr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'platform_operator_notification_reads'
    AND index_name = 'idx_ponr_user_unread'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_ponr_user_unread ON platform_operator_notification_reads (user_id, notification_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
