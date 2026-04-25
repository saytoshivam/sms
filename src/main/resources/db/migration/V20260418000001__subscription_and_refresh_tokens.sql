-- SaaS subscription catalog + per-tenant subscription + opaque refresh tokens.
-- Logical references: tenant_subscriptions.tenant_id -> schools.id, refresh_tokens.user_id -> users.id
-- (no FK to Hibernate-managed tables to avoid ordering issues on empty databases).

CREATE TABLE IF NOT EXISTS subscription_plans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(512),
    active BIT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_subscription_plans_code (plan_code)
);

CREATE TABLE IF NOT EXISTS subscription_features (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    feature_code VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(512),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_subscription_features_code (feature_code)
);

CREATE TABLE IF NOT EXISTS subscription_plan_features (
    plan_id BIGINT NOT NULL,
    feature_id BIGINT NOT NULL,
    enabled BIT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (plan_id, feature_id),
    CONSTRAINT fk_spf_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
    CONSTRAINT fk_spf_feature FOREIGN KEY (feature_id) REFERENCES subscription_features (id)
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL COMMENT 'Logical FK to schools.id',
    plan_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    starts_at DATETIME(6) NOT NULL,
    ends_at DATETIME(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_tenant_subscriptions_tenant (tenant_id),
    CONSTRAINT fk_ts_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
    KEY idx_tenant_subscriptions_status (status)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'Logical FK to users.id',
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_refresh_tokens_hash (token_hash),
    KEY idx_refresh_tokens_user (user_id),
    KEY idx_refresh_tokens_expires (expires_at)
);
