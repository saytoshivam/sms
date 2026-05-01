import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { useApiTags } from '../../lib/apiTags';
import {
  type Conflict,
  type ConflictResolution,
  detectEntryConflicts,
  detectStructuralConflicts,
  summariseConflicts,
  type EntryRef,
  type SetupSnapshot,
} from '../../lib/timetableConflicts';

type Props = {
  /** Optional: when the consumer already holds the latest generate response, prefer those entries. */
  freshEntries?: EntryRef[] | null;
  /** Called whenever the user triggers a regenerate / auto-fix. */
  onRegenerate?: () => Promise<void> | void;
  onAutoFix?: () => Promise<void> | void;
};

type Version = { id: number; status: string; version: number };

export function ConflictsPanel({ freshEntries, onRegenerate, onAutoFix }: Props) {
  const invalidate = useApiTags();

  const setup = useQuery({
    queryKey: ['tt-setup'],
    queryFn: async () => (await api.get<SetupSnapshot & { schoolId?: number }>('/api/timetable/setup')).data,
  });

  // Draft version is needed to fetch entries; cheap & idempotent.
  const draft = useQuery({
    queryKey: ['ttv2-draft-version'],
    queryFn: async () => (await api.post<Version>('/api/v2/timetable/versions/draft')).data,
  });

  const versionId = draft.data?.id ?? null;

  const entriesQuery = useQuery({
    queryKey: ['tt-entries', versionId],
    enabled: Boolean(versionId) && !freshEntries,
    queryFn: async () =>
      (await api.get<EntryRef[]>(`/api/timetable/entries?timetableVersionId=${encodeURIComponent(String(versionId))}`)).data,
  });

  const entries = freshEntries ?? entriesQuery.data ?? null;

  const conflicts: Conflict[] = useMemo(() => {
    const s = setup.data ?? null;
    return [...detectStructuralConflicts(s), ...detectEntryConflicts(s, entries)];
  }, [setup.data, entries]);

  const { hard, soft, total } = summariseConflicts(conflicts);

  const hardList = useMemo(() => conflicts.filter((c) => c.severity === 'HARD'), [conflicts]);
  const softList = useMemo(() => conflicts.filter((c) => c.severity === 'SOFT'), [conflicts]);

  const [filter, setFilter] = useState<'ALL' | 'HARD' | 'SOFT'>('ALL');

  const visible = filter === 'HARD' ? hardList : filter === 'SOFT' ? softList : conflicts;

  // ---- bulk actions ----
  const regenMutation = useMutation({
    mutationFn: async () => {
      if (onRegenerate) {
        await onRegenerate();
        return;
      }
      // fallback: call the v1 onboarding auto-generate
      await api.post('/api/v1/onboarding/timetable/auto-generate', {});
    },
    onSuccess: async () => {
      toast.success('Regenerated', 'Timetable rebuilt. Re-checking conflicts.');
      await invalidate(['timetable.draft', 'timetable.conflicts', 'timetable.freshness']);
    },
    onError: (e) => toast.error('Regenerate failed', formatApiError(e)),
  });

  const autoFixMutation = useMutation({
    mutationFn: async () => {
      if (onAutoFix) {
        await onAutoFix();
        return;
      }
      await api.post('/api/timetable/auto-fix', {
        schoolId: null,
        academicYearId: null,
        replaceExisting: true,
      });
    },
    onSuccess: async () => {
      toast.success('Auto-fix attempted', 'Engine re-ran respecting locks.');
      await invalidate(['timetable.draft', 'timetable.conflicts', 'timetable.freshness']);
    },
    onError: (e) => toast.error('Auto-fix failed', formatApiError(e)),
  });

  const isLoading = setup.isLoading || (draft.isLoading && !freshEntries) || entriesQuery.isLoading;

  if (isLoading) {
    return <div className="muted" style={{ fontSize: 13 }}>Analysing conflicts…</div>;
  }
  if (setup.isError) {
    return (
      <div className="sms-alert sms-alert--error" style={{ margin: 0 }}>
        <div>
          <div className="sms-alert__title">Could not analyse conflicts</div>
          <div className="sms-alert__msg">{formatApiError(setup.error)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* summary card */}
      <div
        className="card stack"
        style={{
          gap: 12,
          padding: 12,
          border: '1px solid rgba(15,23,42,0.10)',
          borderRadius: 12,
        }}
      >
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 22, fontWeight: 950, color: hard > 0 ? '#b91c1c' : soft > 0 ? '#a16207' : '#166534' }}>
              {total}
            </div>
            <div className="muted" style={{ fontSize: 13, fontWeight: 800 }}>
              total — <span style={{ color: '#b91c1c' }}>{hard} hard</span> ·{' '}
              <span style={{ color: '#a16207' }}>{soft} soft</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <FilterTab label="All" value="ALL" active={filter} onClick={setFilter} count={total} />
            <FilterTab label="Hard" value="HARD" active={filter} onClick={setFilter} count={hard} tone="bad" />
            <FilterTab label="Soft" value="SOFT" active={filter} onClick={setFilter} count={soft} tone="warn" />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => autoFixMutation.mutate()}
              disabled={autoFixMutation.isPending || total === 0}
            >
              {autoFixMutation.isPending ? 'Working…' : 'Auto-fix'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => regenMutation.mutate()}
              disabled={regenMutation.isPending}
            >
              {regenMutation.isPending ? 'Working…' : 'Regenerate'}
            </button>
          </div>
        </div>
        {hard > 0 ? (
          <div className="muted" style={{ fontSize: 12, color: '#7c2d12' }}>
            <strong>Hard conflicts block publish.</strong> Fix them via the deep-links below or run auto-fix to let the engine retry within current locks.
          </div>
        ) : soft > 0 ? (
          <div className="muted" style={{ fontSize: 12, color: '#7c2d12' }}>
            Soft conflicts are advisory — publish is allowed, but the engine flagged them as worth a second look.
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 12, color: '#166534', fontWeight: 700 }}>
            No conflicts detected. The current draft satisfies every hard constraint.
          </div>
        )}
      </div>

      {/* per-conflict cards */}
      {visible.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>
          {total === 0 ? 'Nothing to fix here.' : `No ${filter.toLowerCase()} conflicts.`}
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {visible.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              onAction={(actionId) => {
                if (actionId === 'auto-fix') autoFixMutation.mutate();
                else if (actionId === 'regenerate') regenMutation.mutate();
              }}
              busy={regenMutation.isPending || autoFixMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  value,
  active,
  onClick,
  count,
  tone,
}: {
  label: string;
  value: 'ALL' | 'HARD' | 'SOFT';
  active: 'ALL' | 'HARD' | 'SOFT';
  onClick: (v: 'ALL' | 'HARD' | 'SOFT') => void;
  count: number;
  tone?: 'bad' | 'warn';
}) {
  const isActive = active === value;
  const baseColor = tone === 'bad' ? '#b91c1c' : tone === 'warn' ? '#a16207' : '#0f172a';
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        border: isActive ? `1px solid ${baseColor}` : '1px solid rgba(15,23,42,0.18)',
        background: isActive ? `${baseColor}15` : '#fff',
        color: isActive ? baseColor : '#475569',
        fontWeight: 800,
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}{' '}
      <span style={{ fontWeight: 950 }}>{count}</span>
    </button>
  );
}

function ConflictCard({
  conflict: c,
  onAction,
  busy,
}: {
  conflict: Conflict;
  onAction: (actionId: 'auto-fix' | 'regenerate') => void;
  busy?: boolean;
}) {
  const isHard = c.severity === 'HARD';
  const accent = isHard ? '#b91c1c' : '#a16207';
  const accentBg = isHard ? 'rgba(220,38,38,0.06)' : 'rgba(234,179,8,0.10)';
  const accentBorder = isHard ? 'rgba(220,38,38,0.30)' : 'rgba(234,179,8,0.40)';

  return (
    <div
      className="card stack"
      style={{
        gap: 8,
        padding: 12,
        border: `1px solid ${accentBorder}`,
        background: accentBg,
        borderRadius: 12,
      }}
    >
      <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            background: accent,
            color: '#fff',
            fontSize: 10,
            fontWeight: 950,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {c.severity}
        </span>
        <span style={{ fontWeight: 900, color: accent, fontSize: 14 }}>{c.title}</span>
        <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>
          {c.kind.replace(/_/g, ' ').toLowerCase()}
        </span>
      </div>
      <div style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{c.detail}</div>
      {c.resolutions.length > 0 ? (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {c.resolutions.map((r, i) => (
            <ResolutionButton key={i} r={r} onAction={onAction} busy={busy} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResolutionButton({
  r,
  onAction,
  busy,
}: {
  r: ConflictResolution;
  onAction: (actionId: 'auto-fix' | 'regenerate') => void;
  busy?: boolean;
}) {
  if (r.kind === 'link') {
    return (
      <Link to={r.href} className="btn secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
        {r.label} →
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="btn"
      style={{ fontSize: 12, padding: '4px 10px' }}
      onClick={() => onAction(r.actionId)}
      disabled={busy}
    >
      {r.label}
    </button>
  );
}
