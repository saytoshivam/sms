-- School onboarding: domain + wizard progress tracker
-- MySQL 8+

SET @db := DATABASE();
SET @has_schools := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'schools'
);

-- Add domain (optional)
SET @stmt := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'domain') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN domain VARCHAR(255) NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add onboarding_status (current step)
SET @stmt := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'onboarding_status') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN onboarding_status VARCHAR(32) NOT NULL DEFAULT ''BASIC_INFO'''
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Add onboarding_completed (json set of completed steps)
SET @stmt := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'onboarding_completed') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN onboarding_completed JSON NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

