import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { useApiTags } from '../../lib/apiTags';
import {
  useImpactStore,
  type ImpactChange,
  type ImpactScope,
} from '../../lib/impactStore';

type Props = {
  open: boolean;
  onClose: () => void;
};

const SCOPE_LABEL: Record<ImpactScope, string> = {
  school: 'School info',
  time: 'Time & calendar',
  classes: 'Class sections',
  subjects: 'Subjects',
  rooms: 'Rooms',
  staff: 'Teachers',
  allocations: 'Academic structure',
};

const SCOPE_ROUTE: Record<ImpactScope, string> = {
  school: '/app',
  time: '/app/time',
  classes: '/app/classes-sections',
  subjects: '/app/subjects',
  rooms: '/app/rooms',
  staff: '/app/teachers',
  allocations: '/app/academic',
};

const SCOPE_ORDER: ImpactScope[] = ['allocations', 'staff', 'subjects', 'rooms', 'time', 'classes', 'school'];

type AutoGenResponse = { success?: boolean; placed?: number; required?: number };

/**
 * Slide-over that summarises every uncommitted impact change tracked in the
 * client-side impact store. Lets the user inspect the per-scope detail and
 * trigger a regenerate of the timetable in one click — clearing applied scopes
 * on success so the hub's pill resets.
 */
export function ImpactPreviewPanel({ open, onClose }: Props) {
  const changes = useImpactStore((s) => s.changes);
  const dismiss = useImpactStore((s) => s.dismiss);
  const clearAll = useImpactStore((s) => s.clearAll);
  const clearScope = useImpactStore((s) => s.clearScope);
  const invalidate = useApiTags();

  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const summary = useMemo(() => {
    let hard = 0;
    let soft = 0;
    const byScope: Partial<Record<ImpactScope, ImpactChange[]>> = {};
    for (const c of changes) {
      if (c.severity === 'hard') hard += 1;
      else soft += 1;
      const arr = byScope[c.scope] ?? [];
      arr.push(c);
      byScope[c.scope] = arr;
    }
    return { hard, soft, total: changes.length, byScope };
  }, [changes]);

  const regenerate = useMutation<AutoGenResponse, unknown>({
    mutationFn: async () =>
      (await api.post<AutoGenResponse>('/api/v1/onboarding/timetable/auto-generate', {})).data,
    onSuccess: async (data) => {
      const placed = data?.placed ?? 0;
      const required = data?.required ?? 0;
      toast.success('Timetable regenerated', `${placed}/${required} sessions placed.`);
      // Drop the impact entries that motivated this regenerate. Server-side
      // freshness / conflicts are now the source of truth.
      clearAll();
      setConfirmRegen(false);
      await invalidate(['timetable.draft', 'timetable.conflicts', 'timetable.freshness']);
    },
    onError: (e) => {
      toast.error("Couldn't regenerate", formatApiError(e));
    },
  });

  if (!open) return null;

  const groupedScopes = SCOPE_ORDER.filter((s) => (summary.byScope[s]?.length ?? 0) > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pending timetable impact"
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(15,23,42,0.42)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(480px, 96vw)',
          height: '100%',
          background: '#fff',
          padding: 18,
          overflow: 'auto',
          boxShadow: '-12px 0 32px rgba(15,23,42,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Pending impact</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {summary.total === 0
                ? 'No changes since last regeneration.'
                : `${summary.total} change${summary.total === 1 ? '' : 's'} since last regeneration · ${summary.hard} hard · ${summary.soft} soft`}
            </div>
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {summary.total > 0 ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmRegen(true)}
              disabled={regenerate.isPending}
              style={{ flex: '1 1 220px' }}
            >
              {regenerate.isPending ? 'Regenerating…' : 'Regenerate timetable now'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => clearAll()}
              disabled={regenerate.isPending}
            >
              Dismiss all
            </button>
          </div>
        ) : null}

        {summary.total === 0 ? (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: 'rgba(22,163,74,0.08)',
              color: '#166534',
              border: '1px solid rgba(22,163,74,0.30)',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: 4 }}>All caught up</div>
            The latest published timetable still reflects the current academic structure, teachers,
            rooms, subjects and time slots.
          </div>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {groupedScopes.map((scope) => {
              const items = summary.byScope[scope] ?? [];
              const sorted = [...items].sort((a, b) => b.at - a.at);
              const hard = items.filter((c) => c.severity === 'hard').length;
              const soft = items.length - hard;
              const route = SCOPE_ROUTE[scope];
              return (
                <section key={scope} className="stack" style={{ gap: 6 }}>
                  <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 950,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: '#475569',
                        }}
                      >
                        {SCOPE_LABEL[scope]}
                      </h3>
                      <span className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                        {items.length}
                        {hard > 0 ? ` · ${hard} hard` : ''}
                        {soft > 0 ? ` · ${soft} soft` : ''}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <Link to={route} className="btn secondary" onClick={onClose} style={{ fontSize: 11, padding: '2px 8px' }}>
                        Open
                      </Link>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => clearScope(scope)}
                        style={{ fontSize: 11, padding: '2px 8px', color: '#b91c1c' }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                    {sorted.map((c) => (
                      <li key={c.id}>
                        <ChangeRow change={c} onDismiss={() => dismiss([c.id])} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <div className="muted" style={{ fontSize: 11, marginTop: 'auto', lineHeight: 1.5 }}>
          Impact entries are session-local — they reflect what you've changed since opening the app. Server-side
          conflicts and freshness remain the source of truth across devices and reloads.
        </div>
      </div>

      {confirmRegen ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm regenerate"
          onMouseDown={(e) => {
            e.stopPropagation();
            setConfirmRegen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 96vw)',
              background: '#fff',
              borderRadius: 14,
              padding: 18,
              boxShadow: '0 24px 48px rgba(15,23,42,0.32)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 16 }}>Regenerate timetable?</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              The engine will rebuild the draft from the current academic structure, teachers, rooms and
              time slots. Any unpublished manual edits will be replaced. Locks are respected.
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button type="button" className="btn secondary" onClick={() => setConfirmRegen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
              >
                {regenerate.isPending ? 'Regenerating…' : 'Regenerate now'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChangeRow({ change, onDismiss }: { change: ImpactChange; onDismiss: () => void }) {
  const dot = change.severity === 'hard' ? '#dc2626' : '#ca8a04';
  const refsSummary = useMemo(() => {
    const r = change.refs;
    if (!r) return null;
    const parts: string[] = [];
    if (r.teacherIds?.length) parts.push(`${r.teacherIds.length} teacher${r.teacherIds.length === 1 ? '' : 's'}`);
    if (r.subjectIds?.length) parts.push(`${r.subjectIds.length} subject${r.subjectIds.length === 1 ? '' : 's'}`);
    if (r.classGroupIds?.length) parts.push(`${r.classGroupIds.length} class${r.classGroupIds.length === 1 ? '' : 'es'}`);
    if (r.roomIds?.length) parts.push(`${r.roomIds.length} room${r.roomIds.length === 1 ? '' : 's'}`);
    return parts.length ? parts.join(' · ') : null;
  }, [change.refs]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: 10,
        borderRadius: 10,
        border: '1px solid rgba(15,23,42,0.10)',
        background: '#fff',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: dot, marginTop: 6, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{change.message}</div>
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
          {formatRelative(change.at)}
          {refsSummary ? ` · ${refsSummary}` : ''}
        </div>
      </div>
      <button
        type="button"
        className="btn secondary"
        onClick={onDismiss}
        title="Dismiss"
        style={{ fontSize: 11, padding: '2px 8px', color: '#b91c1c' }}
      >
        ×
      </button>
    </div>
  );
}

function formatRelative(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
