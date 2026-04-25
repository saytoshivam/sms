-- Add onboarding basic info JSON payload to schools
-- MySQL 8+

SET @db := DATABASE();
SET @has_schools := (
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @db AND table_name = 'schools'
);

SET @stmt := IF(
    @has_schools = 0,
    'SELECT 1',
    IF(
        (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = @db AND table_name = 'schools' AND column_name = 'onboarding_basic_info') > 0,
        'SELECT 1',
        'ALTER TABLE schools ADD COLUMN onboarding_basic_info JSON NULL'
    )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

