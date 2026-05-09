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

type Version = { id: number; status: string; version: number; generatedAt?: string | null; publishedAt?: string | null };

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
  /** Latest published version row (if any). */
  latestPublishedVersion: Version | null;
  entries: EntryRef[];
  entriesLoading: boolean;
  /** Versions list or published peek still loading — wait before hub “not started” decisions. */
  timetableHealthExtrasLoading: boolean;
  versionStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'UNKNOWN';
  conflicts: { hard: number; soft: number; total: number };
  conflictsList: Conflict[];
  publishBlocked: boolean;
  publishBlockedReason: string | null;
  hasEntries: boolean;
  /** School has at least one non-empty timetable version marked PUBLISHED (not tied to workspace pointer). */
  hasPublishedTimetable: boolean;
  /** Entry count for latest published version (if it differs from workspace). */
  latestPublishedEntriesCount: number | null;
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
    // "Workspace" version reflects saved/published state without creating a new draft every time.
    queryFn: async () => (await api.post<Version>('/api/v2/timetable/versions/workspace')).data,
  });

  const versionsQuery = useQuery({
    queryKey: ['ttv2-versions'],
    queryFn: async () => (await api.get<Version[]>('/api/v2/timetable/versions')).data,
  });

  const latestPublishedVersion = useMemo(() => {
    const list = versionsQuery.data ?? [];
    const pubs = list.filter((v) => String(v.status).toUpperCase() === 'PUBLISHED');
    pubs.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    return pubs[0] ?? null;
  }, [versionsQuery.data]);

  const versionId = draftQuery.data?.id ?? null;
  const latestPublishedId = latestPublishedVersion?.id ?? null;
  /** When workspace isn't the latest published row, peek that version's entry count for hub / badges. */
  const needPublishedPeek = Boolean(latestPublishedId != null && versionId !== latestPublishedId);

  const entriesQuery = useQuery({
    queryKey: ['tt-entries', versionId],
    enabled: Boolean(versionId),
    queryFn: async () =>
      (await api.get<EntryRef[]>(`/api/timetable/entries?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data,
  });

  const publishedPeekQuery = useQuery({
    queryKey: ['tt-entries', latestPublishedId],
    enabled: needPublishedPeek && Boolean(latestPublishedId),
    queryFn: async () =>
      (await api.get<EntryRef[]>(`/api/timetable/entries?timetableVersionId=${encodeURIComponent(String(latestPublishedId))}`)).data,
  });

  const setup = setupQuery.data ?? null;
  const entries = entriesQuery.data ?? [];
  const publishedEntriesCount = needPublishedPeek ? (publishedPeekQuery.data?.length ?? 0) : entries.length;

  const conflictsList = useMemo(
    () => [
      ...detectStructuralConflicts(setup),
      ...detectEntryConflicts(setup, entries),
    ],
    [setup, entries],
  );

  const conflicts = useMemo(() => summariseConflicts(conflictsList), [conflictsList]);

  const versionStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'UNKNOWN' = useMemo(() => {
    const raw = String(draftQuery.data?.status ?? '').toUpperCase();
    if (raw === 'DRAFT' || raw === 'PUBLISHED' || raw === 'ARCHIVED') return raw;
    return 'UNKNOWN';
  }, [draftQuery.data]);

  const hasEntries = entries.length > 0;

  const timetableHealthExtrasLoading = Boolean(
    versionsQuery.isLoading ||
      versionsQuery.isFetching ||
      (needPublishedPeek && latestPublishedId != null && (publishedPeekQuery.isLoading || publishedPeekQuery.isFetching)),
  );

  const hasPublishedTimetable = useMemo(() => {
    const pid = latestPublishedId;
    if (pid == null) return false;
    if (!needPublishedPeek) {
      return hasEntries && String(draftQuery.data?.status ?? '').toUpperCase() === 'PUBLISHED';
    }
    return (publishedPeekQuery.data?.length ?? 0) > 0;
  }, [
    latestPublishedId,
    needPublishedPeek,
    hasEntries,
    draftQuery.data?.status,
    publishedPeekQuery.data?.length,
  ]);

  const publishBlockedReason: string | null = useMemo(() => {
    if (!setup) return 'Setup is loading…';
    if (versionStatus === 'PUBLISHED') {
      return 'Workspace is showing the published timetable — generate or open a draft to publish updates.';
    }
    if (conflicts.hard > 0) {
      return `${conflicts.hard} hard conflict${conflicts.hard === 1 ? '' : 's'} must be resolved before publishing.`;
    }
    if (!hasEntries) return 'Generate a draft before publishing.';
    return null;
  }, [setup, conflicts.hard, hasEntries, versionStatus]);

  const status: TimetableStatus = useMemo(() => {
    if (setupQuery.isLoading || draftQuery.isLoading || entriesQuery.isLoading || timetableHealthExtrasLoading) {
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

    // Workspace may be empty while the school still has a published timetable.
    // In that case, report the published posture for operational dashboards.
    if (!hasEntries && hasPublishedTimetable && latestPublishedVersion) {
      const v = latestPublishedVersion.version != null ? `v${latestPublishedVersion.version}` : 'v?';
      return {
        level: 'ok',
        label: `Published ${v}`,
        hint: `${publishedEntriesCount} entries live`,
      };
    }
    if (!hasEntries) {
      return { level: 'idle', label: 'No draft yet', hint: 'Generate a draft to populate.' };
    }
    return {
      level: 'ok',
      label: `Draft · v${draftQuery.data?.version ?? '?'}`,
    };
  }, [
    setupQuery.isLoading,
    setupQuery.isError,
    draftQuery.isLoading,
    draftQuery.data,
    entriesQuery.isLoading,
    timetableHealthExtrasLoading,
    entries.length,
    conflicts.hard,
    conflicts.soft,
    hasEntries,
    versionStatus,
    hasPublishedTimetable,
    latestPublishedVersion,
    publishedEntriesCount,
  ]);

  const versionLabel: string | null = useMemo(() => {
    if (!draftQuery.data) return null;
    const v = draftQuery.data.version != null ? `v${draftQuery.data.version}` : '';
    const s =
      versionStatus === 'PUBLISHED'
        ? 'Published'
        : versionStatus === 'ARCHIVED'
          ? 'Archived'
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
    latestPublishedVersion,
    entries,
    entriesLoading: entriesQuery.isLoading,
    timetableHealthExtrasLoading,
    versionStatus,
    conflicts,
    conflictsList,
    publishBlocked: publishBlockedReason != null,
    publishBlockedReason,
    hasEntries,
    hasPublishedTimetable,
    latestPublishedEntriesCount: latestPublishedId == null ? null : publishedEntriesCount,
    status,
    versionLabel,
  };
}
