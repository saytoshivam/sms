import { useMutation } from '@tanstack/react-query';
import { api } from './api';
import { formatApiError } from './errors';
import { toast } from './toast';
import { useApiTags } from './apiTags';
import { useImpactStore } from './impactStore';
import {
  useTimetableStatus,
  type TimetableStatus,
  type UseTimetableStatusResult,
} from './useTimetableStatus';
import type { EntryRef, SetupSnapshot } from './timetableConflicts';

/**
 * Lifecycle hook for the Timetable module shell.
 *
 * Backend reality:
 *   POST /api/v2/timetable/versions/draft         - ensure a draft exists
 *   POST /api/v1/onboarding/timetable/auto-generate - rebuild the draft from setup
 *   POST /api/timetable/save-draft?timetableVersionId=X - move DRAFT -> REVIEW
 *   POST /api/timetable/publish?timetableVersionId=X    - REVIEW/DRAFT -> PUBLISHED
 *   POST /api/timetable/auto-fix                       - re-run respecting locks
 *
 * There's no rollback API, so "Discard & regenerate" simply runs auto-generate
 * again — that overwrites the current draft.
 *
 * This hook composes `useTimetableStatus` for read-only state and adds the
 * action mutations on top. All four resolution actions clear the impact store
 * on success, since by definition the engine has consumed the user's pending
 * changes.
 */

type Version = { id: number; status: string; version: number };

type AutoGenResponse = {
  success?: boolean;
  placed?: number;
  required?: number;
};

export type UseTimetableLifecycleResult = {
  // Server data (re-exported from useTimetableStatus)
  setup: SetupSnapshot | null;
  setupLoading: boolean;
  setupError: unknown;
  version: Version | null;
  versionLoading: boolean;
  entries: EntryRef[];
  entriesLoading: boolean;

  // Derived UI state
  versionStatus: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'UNKNOWN';
  conflicts: { hard: number; soft: number; total: number };
  publishBlocked: boolean;
  publishBlockedReason: string | null;
  hasEntries: boolean;
  status: TimetableStatus;

  // Actions
  regenerate: () => Promise<AutoGenResponse | undefined>;
  regeneratePending: boolean;
  saveDraft: () => Promise<Version | undefined>;
  saveDraftPending: boolean;
  publish: () => Promise<Version | undefined>;
  publishPending: boolean;
  discardAndRegenerate: () => Promise<AutoGenResponse | undefined>;
  discardPending: boolean;
  autoFix: () => Promise<AutoGenResponse | undefined>;
  autoFixPending: boolean;
};

export function useTimetableLifecycle(): UseTimetableLifecycleResult {
  const invalidate = useApiTags();
  const clearAllImpact = useImpactStore((s) => s.clearAll);

  const s: UseTimetableStatusResult = useTimetableStatus();
  const versionId = s.version?.id ?? null;

  // ---- mutations ----
  const regen = useMutation({
    mutationFn: async () =>
      (await api.post<AutoGenResponse>('/api/v1/onboarding/timetable/auto-generate', {})).data,
    onSuccess: async (data) => {
      const placed = data?.placed ?? 0;
      const required = data?.required ?? 0;
      toast.success('Timetable regenerated', `${placed}/${required} sessions placed.`);
      clearAllImpact();
      await invalidate(['timetable.draft', 'timetable.conflicts', 'timetable.freshness']);
    },
    onError: (e) => toast.error("Couldn't regenerate", formatApiError(e)),
  });

  const saveDraftMut = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error('Missing draft version. Generate a draft first.');
      return (await api.post<Version>(`/api/timetable/save-draft?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data;
    },
    onSuccess: async () => {
      toast.success('Draft saved', 'Moved to review.');
      await invalidate(['timetable.draft']);
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error('Missing draft version. Generate a draft first.');
      if (s.conflicts.hard > 0) throw new Error(s.publishBlockedReason ?? 'Hard conflicts block publish.');
      if (!s.hasEntries) throw new Error('Cannot publish an empty draft.');
      return (await api.post<Version>(`/api/timetable/publish?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data;
    },
    onSuccess: async (v) => {
      toast.success('Published', `Timetable v${v?.version ?? '?'} is now active.`);
      // Once published the impact pill should reset since the engine has
      // committed every pending edit.
      clearAllImpact();
      await invalidate(['timetable.published', 'timetable.draft', 'timetable.freshness']);
    },
    onError: (e) => toast.error('Publish failed', formatApiError(e)),
  });

  const discardMut = useMutation({
    mutationFn: async () =>
      (await api.post<AutoGenResponse>('/api/v1/onboarding/timetable/auto-generate', {})).data,
    onSuccess: async (data) => {
      const placed = data?.placed ?? 0;
      const required = data?.required ?? 0;
      toast.success('Draft discarded', `Rebuilt: ${placed}/${required} sessions placed.`);
      clearAllImpact();
      await invalidate(['timetable.draft', 'timetable.conflicts', 'timetable.freshness']);
    },
    onError: (e) => toast.error('Discard failed', formatApiError(e)),
  });

  const autoFixMut = useMutation({
    mutationFn: async () =>
      (
        await api.post<AutoGenResponse>('/api/timetable/auto-fix', {
          schoolId: null,
          academicYearId: null,
          replaceExisting: true,
        })
      ).data,
    onSuccess: async (data) => {
      const placed = data?.placed ?? 0;
      const required = data?.required ?? 0;
      const detail = required ? `${placed}/${required} sessions placed.` : 'Engine re-ran respecting locks.';
      toast.success('Auto-fix attempted', detail);
      // Auto-fix re-evaluates conflicts against the current setup, so any
      // pending impact has effectively been consumed.
      clearAllImpact();
      await invalidate(['timetable.draft', 'timetable.conflicts', 'timetable.freshness']);
    },
    onError: (e) => toast.error('Auto-fix failed', formatApiError(e)),
  });

  return {
    setup: s.setup,
    setupLoading: s.setupLoading,
    setupError: s.setupError,
    version: s.version,
    versionLoading: s.versionLoading,
    entries: s.entries,
    entriesLoading: s.entriesLoading,

    versionStatus: s.versionStatus,
    conflicts: s.conflicts,
    publishBlocked: s.publishBlocked,
    publishBlockedReason: s.publishBlockedReason,
    hasEntries: s.hasEntries,
    status: s.status,

    regenerate: () => regen.mutateAsync(),
    regeneratePending: regen.isPending,
    saveDraft: () => saveDraftMut.mutateAsync(),
    saveDraftPending: saveDraftMut.isPending,
    publish: () => publishMut.mutateAsync(),
    publishPending: publishMut.isPending,
    discardAndRegenerate: () => discardMut.mutateAsync(),
    discardPending: discardMut.isPending,
    autoFix: () => autoFixMut.mutateAsync(),
    autoFixPending: autoFixMut.isPending,
  };
}
