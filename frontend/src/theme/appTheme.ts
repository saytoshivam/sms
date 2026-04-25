/**
 * Single source of truth for default UI colors (MyHaimi unified theme).
 * Keep in sync with: `src/main/java/com/myhaimi/sms/theme/AppThemeDefaults.java`
 * and the fallbacks in `src/index.css` :root.
 * Secondary body text uses `--color-text-muted` (from `--color-text`), not `--color-nav-text`.
 */
export const APP_THEME = {
  primaryColor: '#ea580c',
  accentColor: '#f59e0b',
  backgroundColor: '#fffbeb',
  textColor: '#0f172a',
  navTextColor: '#ffffff',
} as const;

export type AppTheme = typeof APP_THEME;
