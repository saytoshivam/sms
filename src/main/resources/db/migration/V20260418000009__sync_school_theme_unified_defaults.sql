-- Align legacy seeded/onboarding palettes with AppThemeDefaults (orange unified theme).
-- Skips when `schools` does not exist yet (Flyway runs before Hibernate on a fresh database).
SET @db := DATABASE();
SET @has_schools := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = @db AND table_name = 'schools'
);
SET @sql := IF(
    @has_schools = 0,
    'SELECT 1',
    'UPDATE schools SET primary_color = ''#ea580c'', accent_color = ''#f59e0b'', background_color = ''#fffbeb'', text_color = ''#0f172a'', nav_text_color = ''#ffffff'' WHERE code = ''greenwood-demo'' OR (primary_color = ''#2563eb'' AND accent_color = ''#22c55e'' AND background_color = ''#f8fafc'')'
);
PREPARE stmt_theme FROM @sql;
EXECUTE stmt_theme;
DEALLOCATE PREPARE stmt_theme;
