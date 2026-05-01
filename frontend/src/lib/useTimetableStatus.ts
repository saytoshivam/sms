import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import {
  detectEntryConflicts,
  detectStructuralConflicts,
  summariseConflicts,
  type Conflict,
  type EntryRef,
  type SetupSnapshot,
} from './timetableConflicts';

/**
 * Read-only timetable status. Fast, no mutations — safe to call from the
 * Operations Hub, NBA engine, or any module that wants to surface "the
 * timetable's overall health" without the bulky lifecycle mutations.
 *
 * `useTimetableLifecycle` composes this hook and adds the action mutations on
 * top.
 */

type Version = { id: number; status: string; version: number };

export type TimetableStatusLevel = 'idle' | 'ok' | 'warn' | 'error' | 'info';

export type TimetableStatus = {
  level: TimetableStatusLevel;
  label: string;
  hint?: string;
};

export type UseTimetableStatusResult = {
  setup: SetupSnapshot | null;
  setupLoading: boolean;
  setupError: unknown;
  version: Version | null;
  versionLoading: boolean;
  entries: EntryRef[];
  entriesLoading: boolean;
  versionStatus: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'UNKNOWN';
  conflicts: { hard: number; soft: number; total: number };
  conflictsList: Conflict[];
  publishBlocked: boolean;
  publishBlockedReason: string | null;
  hasEntries: boolean;
  hasPublishedTimetable: boolean;
  status: TimetableStatus;
  versionLabel: string | null;
};

export function useTimetableStatus(): UseTimetableStatusResult {
  const setupQuery = useQuery({
    queryKey: ['tt-setup'],
    queryFn: async () => (await api.get<SetupSnapshot & { schoolId?: number }>('/api/timetable/setup')).data,
  });

  const draftQuery = useQuery({
    queryKey: ['ttv2-draft-version'],
    queryFn: async () => (await api.post<Version>('/api/v2/timetable/versions/draft')).data,
  });

  const versionId = draftQuery.data?.id ?? null;

  const entriesQuery = useQuery({
    queryKey: ['tt-entries', versionId],
    enabled: Boolean(versionId),
    queryFn: async () =>
      (await api.get<EntryRef[]>(`/api/timetable/entries?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data,
  });

  const setup = setupQuery.data ?? null;
  const entries = entriesQuery.data ?? [];

  const conflictsList = useMemo(
    () => [
      ...detectStructuralConflicts(setup),
      ...detectEntryConflicts(setup, entries),
    ],
    [setup, entries],
  );

  const conflicts = useMemo(() => summariseConflicts(conflictsList), [conflictsList]);

  const versionStatus: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'UNKNOWN' = useMemo(() => {
    const raw = String(draftQuery.data?.status ?? '').toUpperCase();
    if (raw === 'DRAFT' || raw === 'REVIEW' || raw === 'PUBLISHED') return raw;
    return 'UNKNOWN';
  }, [draftQuery.data]);

  const hasEntries = entries.length > 0;
  const hasPublishedTimetable = versionStatus === 'PUBLISHED' && hasEntries;

  const publishBlockedReason: string | null = useMemo(() => {
    if (!setup) return 'Setup is loading…';
    if (conflicts.hard > 0) {
      return `${conflicts.hard} hard conflict${conflicts.hard === 1 ? '' : 's'} must be resolved before publishing.`;
    }
    if (!hasEntries) return 'Generate a draft before publishing.';
    return null;
  }, [setup, conflicts.hard, hasEntries]);

  const status: TimetableStatus = useMemo(() => {
    if (setupQuery.isLoading || draftQuery.isLoading || entriesQuery.isLoading) {
      return { level: 'idle', label: 'Loading' };
    }
    if (setupQuery.isError) return { level: 'error', label: 'Setup failed' };

    if (versionStatus === 'PUBLISHED') {
      return {
        level: 'ok',
        label: `Published v${draftQuery.data?.version ?? '?'}`,
        hint: hasEntries ? `${entries.length} entries live` : 'No entries — published empty',
      };
    }

    if (conflicts.hard > 0) {
      return {
        level: 'error',
        label: `${conflicts.hard} hard · ${conflicts.soft} soft`,
        hint: 'Hard conflicts block publish.',
      };
    }
    if (conflicts.soft > 0) {
      return {
        level: 'warn',
        label: `${conflicts.soft} soft conflict${conflicts.soft === 1 ? '' : 's'}`,
        hint: 'Advisory — publish allowed.',
      };
    }
    if (!hasEntries) {
      return { level: 'idle', label: 'No draft yet', hint: 'Generate a draft to populate.' };
    }
    return {
      level: versionStatus === 'REVIEW' ? 'info' : 'ok',
      label: versionStatus === 'REVIEW' ? `In review · v${draftQuery.data?.version ?? '?'}` : `Draft · v${draftQuery.data?.version ?? '?'}`,
    };
  }, [
    setupQuery.isLoading,
    setupQuery.isError,
    draftQuery.isLoading,
    draftQuery.data,
    entriesQuery.isLoading,
    entries.length,
    conflicts.hard,
    conflicts.soft,
    hasEntries,
    versionStatus,
  ]);

  const versionLabel: string | null = useMemo(() => {
    if (!draftQuery.data) return null;
    const v = draftQuery.data.version != null ? `v${draftQuery.data.version}` : '';
    const s =
      versionStatus === 'PUBLISHED'
        ? 'Published'
        : versionStatus === 'REVIEW'
          ? 'In review'
          : versionStatus === 'DRAFT'
            ? 'Draft'
            : 'Working copy';
    return `${s} ${v}`.trim();
  }, [draftQuery.data, versionStatus]);

  return {
    setup,
    setupLoading: setupQuery.isLoading,
    setupError: setupQuery.isError ? setupQuery.error : null,
    version: draftQuery.data ?? null,
    versionLoading: draftQuery.isLoading,
    entries,
    entriesLoading: entriesQuery.isLoading,
    versionStatus,
    conflicts,
    conflictsList,
    publishBlocked: publishBlockedReason != null,
    publishBlockedReason,
    hasEntries,
    hasPublishedTimetable,
    status,
    versionLabel,
  };
}
