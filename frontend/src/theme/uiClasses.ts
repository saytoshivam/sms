/**
 * BEM block names for themed UI. Import these when building new screens so class strings stay consistent.
 */
export const themeUi = {
  timeline: 'theme-timeline',
  dateKeeper: 'date-keeper',
  timeKeeper: 'time-keeper',
  selectKeeper: 'select-keeper',
} as const;

export type ThemeUiBlock = (typeof themeUi)[keyof typeof themeUi];
