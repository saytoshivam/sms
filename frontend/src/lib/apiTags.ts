import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Cross-module tag system for React Query invalidation.
 *
 * Each query declares the tags it depends on; each mutation declares the tags
 * it invalidates. A small dependency map propagates invalidations
 * transitively, so e.g. mutating `staff` also re-fetches things tagged
 * `allocations` and `timetable.conflicts`.
 *
 * This avoids the "I edited X but the timetable still says it's up to date"
 * class of bugs without rewiring every callsite.
 */
export type ApiTag =
  | 'school'
  | 'time'
  | 'classes'
  | 'subjects'
  | 'rooms'
  | 'staff'
  | 'allocations'
  | 'timetable.draft'
  | 'timetable.published'
  | 'timetable.locks'
  | 'timetable.conflicts'
  | 'timetable.freshness'
  | 'onboarding.progress';

/**
 * `dependsOn[A]` lists tags whose data should be refetched whenever A is
 * invalidated. Keep this graph minimal and explicit.
 */
const dependsOn: Record<ApiTag, ApiTag[]> = {
  school: ['onboarding.progress', 'timetable.freshness'],
  time: ['timetable.draft', 'timetable.conflicts', 'timetable.freshness'],
  classes: ['allocations', 'timetable.draft', 'timetable.conflicts', 'timetable.freshness', 'onboarding.progress'],
  subjects: ['allocations', 'timetable.conflicts', 'timetable.freshness', 'onboarding.progress'],
  rooms: ['allocations', 'timetable.conflicts', 'onboarding.progress'],
  staff: ['allocations', 'timetable.conflicts', 'timetable.freshness', 'onboarding.progress'],
  allocations: ['timetable.conflicts', 'timetable.freshness'],
  'timetable.draft': ['timetable.conflicts', 'timetable.freshness'],
  'timetable.published': ['timetable.freshness', 'onboarding.progress'],
  'timetable.locks': ['timetable.draft', 'timetable.conflicts'],
  'timetable.conflicts': [],
  'timetable.freshness': [],
  'onboarding.progress': [],
};

/** Map an `ApiTag` to existing TanStack Query keys used in the app. */
const tagToQueryKeys: Record<ApiTag, readonly (readonly unknown[])[]> = {
  school: [['onboarding-basic-info'], ['me'], ['school-business-kpis']],
  time: [['onboarding-basic-info'], ['tt-setup'], ['ttv2-time-slots']],
  classes: [
    ['class-groups'],
    ['class-groups-catalog'],
    ['class-groups-sections-summary'],
    ['onboarding-academic-structure'],
  ],
  subjects: [['subjects-catalog'], ['subjects-for-class'], ['onboarding-academic-structure']],
  rooms: [['rooms'], ['onboarding-class-default-rooms'], ['rooms-saved-onboarding']],
  staff: [['staff'], ['staff-list-class-groups'], ['onboarding-staff-view']],
  allocations: [['onboarding-academic-structure'], ['tt-setup']],
  'timetable.draft': [['ttv2-draft-version'], ['tt-entries']],
  'timetable.published': [['tt-published-version']],
  'timetable.locks': [['tt-locks']],
  'timetable.conflicts': [['tt-conflicts']],
  'timetable.freshness': [['tt-freshness']],
  'onboarding.progress': [['onboarding-progress']],
};

function expandTags(seed: readonly ApiTag[]): ReadonlySet<ApiTag> {
  const seen = new Set<ApiTag>();
  const stack: ApiTag[] = [...seed];
  while (stack.length) {
    const t = stack.pop()!;
    if (seen.has(t)) continue;
    seen.add(t);
    for (const next of dependsOn[t]) {
      if (!seen.has(next)) stack.push(next);
    }
  }
  return seen;
}

/**
 * Hook used by mutations to invalidate every query touching the given tags
 * (transitively). Use:
 *
 *   const invalidate = useApiTags();
 *   await invalidate(['subjects', 'allocations']);
 */
export function useApiTags() {
  const qc = useQueryClient();
  return useCallback(
    async (tags: readonly ApiTag[]) => {
      const all = expandTags(tags);
      const keys: (readonly unknown[])[] = [];
      for (const t of all) {
        for (const k of tagToQueryKeys[t]) keys.push(k);
      }
      await Promise.all(
        keys.map((key) => qc.invalidateQueries({ queryKey: key as readonly unknown[] })),
      );
    },
    [qc],
  );
}
