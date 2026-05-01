import { create } from 'zustand';

/**
 * The Impact system tracks "pending changes" that are likely to invalidate the
 * current timetable. Modules call `setScope()` when the user begins editing,
 * `recordChange()` after each save, and `clearScope()` when the user leaves.
 *
 * The Operations Hub and the ImpactPill on every ModulePage subscribe to this
 * store to show the user, in one place, "this is what you've changed since
 * the last successful timetable generation".
 *
 * Persistence is intentionally only in-memory: server-side `freshness` (added
 * separately) is the source of truth across reloads and tabs. This store is
 * for *the current session's* uncommitted intent.
 */
export type ImpactScope =
  | 'school'
  | 'time'
  | 'classes'
  | 'subjects'
  | 'rooms'
  | 'staff'
  | 'allocations';

export type ImpactSeverity = 'soft' | 'hard';

export type ImpactChange = {
  /** Stable id for dedupe / display. */
  id: string;
  scope: ImpactScope;
  /** One-line, human-readable. */
  message: string;
  /** Soft = only consistency may suffer; hard = generator output likely invalid. */
  severity: ImpactSeverity;
  /** Optional — entity ids touched, for downstream impact preview. */
  refs?: { teacherIds?: number[]; subjectIds?: number[]; classGroupIds?: number[]; roomIds?: number[] };
  at: number;
};

type ImpactState = {
  changes: ImpactChange[];
  recordChange: (c: Omit<ImpactChange, 'at'>) => void;
  clearScope: (scope: ImpactScope) => void;
  clearAll: () => void;
  /** Drop changes by id; useful after server confirms apply. */
  dismiss: (ids: string[]) => void;
};

export const useImpactStore = create<ImpactState>((set) => ({
  changes: [],
  recordChange: (c) =>
    set((s) => {
      // Dedupe by id within a 60 s window so spammy toggles don't pollute.
      const now = Date.now();
      const filtered = s.changes.filter((x) => !(x.id === c.id && now - x.at < 60_000));
      return { changes: [...filtered, { ...c, at: now }] };
    }),
  clearScope: (scope) => set((s) => ({ changes: s.changes.filter((c) => c.scope !== scope) })),
  clearAll: () => set({ changes: [] }),
  dismiss: (ids) =>
    set((s) => {
      const drop = new Set(ids);
      return { changes: s.changes.filter((c) => !drop.has(c.id)) };
    }),
}));

export type ImpactSummary = {
  total: number;
  hard: number;
  soft: number;
  byScope: Partial<Record<ImpactScope, number>>;
};

export function summarizeImpact(changes: ImpactChange[]): ImpactSummary {
  const byScope: Partial<Record<ImpactScope, number>> = {};
  let hard = 0;
  let soft = 0;
  for (const c of changes) {
    byScope[c.scope] = (byScope[c.scope] ?? 0) + 1;
    if (c.severity === 'hard') hard += 1;
    else soft += 1;
  }
  return { total: changes.length, hard, soft, byScope };
}

/**
 * React hook variant: returns the summary as a plain object that updates when
 * the store changes. Use directly in module pages.
 */
export function useImpactSummary(): ImpactSummary {
  const changes = useImpactStore((s) => s.changes);
  return summarizeImpact(changes);
}

export function useImpactScope(scope: ImpactScope): ImpactSummary {
  const changes = useImpactStore((s) => s.changes.filter((c) => c.scope === scope));
  return summarizeImpact(changes);
}
