import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Step7TimetableWorkspace from '../../components/Step7TimetableWorkspace';
import { ModulePage } from '../../components/module/ModulePage';
import { ConflictsPanel } from '../../components/timetable/ConflictsPanel';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { useTimetableLifecycle } from '../../lib/useTimetableLifecycle';

type BasicInfo = {
  workingDays?: string[];
};

type Version = { id: number; status: string; version: number; generatedAt?: string | null; publishedAt?: string | null };

const TABS = ['workspace', 'conflicts'] as const;
type TimetableTab = (typeof TABS)[number];

/**
 * Standalone Timetable workspace at /app/timetable.
 *
 * Two top-level tabs:
 *  - workspace  → existing Step7TimetableWorkspace (full-fat editor)
 *  - conflicts  → first-class conflicts dashboard with deep-link resolutions
 *
 * Header actions cover the full lifecycle:
 *   Open editor · Discard & regenerate · Save draft · Publish · Regenerate
 */
export function TimetableModulePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as TimetableTab | null;
  const [tab, setTab] = useState<TimetableTab>(TABS.includes(tabParam as TimetableTab) ? (tabParam as TimetableTab) : 'workspace');
  useEffect(() => {
    if (TABS.includes(tabParam as TimetableTab)) setTab(tabParam as TimetableTab);
    else setTab('workspace');
  }, [tabParam]);

  const basicInfo = useQuery({
    queryKey: ['onboarding-basic-info'],
    queryFn: async () => (await api.get<BasicInfo>('/api/v1/onboarding/basic-info')).data,
  });

  const lc = useTimetableLifecycle();

  // ---- confirms ----
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const versions = useQuery({
    queryKey: ['ttv2-versions'],
    queryFn: async () => (await api.get<Version[]>('/api/v2/timetable/versions')).data,
  });

  const latestPublished: Version | null = useMemo(() => {
    const list = versions.data ?? [];
    const pubs = list.filter((v) => String(v.status).toUpperCase() === 'PUBLISHED');
    pubs.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    return pubs[0] ?? null;
  }, [versions.data]);

  const latestDraftVersion: Version | null = useMemo(() => {
    const list = versions.data ?? [];
    const drafts = list.filter((v) => String(v.status).toUpperCase() === 'DRAFT');
    drafts.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    return drafts[0] ?? null;
  }, [versions.data]);

  const [viewKey, setViewKey] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    // If there is no published timetable, keep the UI on draft view.
    if (viewKey === 'PUBLISHED' && !latestPublished) setViewKey('DRAFT');
  }, [viewKey, latestPublished]);
  useEffect(() => {
    if (!viewMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = viewMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setViewMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [viewMenuOpen]);

  const versionLabel = useMemo(() => {
    if (!lc.version) return null;
    const v = lc.version.version != null ? `v${lc.version.version}` : '';
    const s = lc.versionStatus === 'PUBLISHED'
      ? 'Published'
      : lc.versionStatus === 'ARCHIVED'
        ? 'Archived'
        : lc.versionStatus === 'DRAFT'
          ? 'Draft'
          : 'Working copy';
    return `${s} ${v}`.trim();
  }, [lc.version, lc.versionStatus]);

  const activeViewLabel = useMemo(() => {
    if (viewKey === 'PUBLISHED') {
      const v = latestPublished?.version != null ? ` v${latestPublished.version}` : '';
      return `Published${v}`;
    }
    return 'Draft';
  }, [viewKey, latestPublished?.version]);

  const setView = (next: 'DRAFT' | 'PUBLISHED') => {
    if (next === 'PUBLISHED' && !latestPublished) {
      toast.info('No published timetable yet', 'Publish a draft to enable this view.');
      return;
    }
    setViewKey(next);
    setViewMenuOpen(false);
  };

  const headerActions = (
    <>
      <button
        type="button"
        className="btn secondary"
        onClick={() => navigate('/app/timetable/grid')}
      >
        Open editor
      </button>
      <button
        type="button"
        className="btn secondary"
        disabled={lc.discardPending || !lc.hasEntries}
        onClick={() => setConfirmDiscard(true)}
        title={lc.hasEntries ? 'Discard the current draft and regenerate from scratch' : 'No draft to discard'}
      >
        {lc.discardPending ? 'Working…' : 'Discard & regenerate'}
      </button>
      <button
        type="button"
        className="btn secondary"
        disabled={lc.clearDraftPending || !lc.hasEntries}
        onClick={() => setConfirmClear(true)}
        title={lc.hasEntries ? 'Clear all entries + locks from the current draft' : 'No draft to clear'}
      >
        {lc.clearDraftPending ? 'Clearing…' : 'Clear draft'}
      </button>
      <button
        type="button"
        className="btn secondary"
        disabled={lc.saveDraftPending || !lc.hasEntries || lc.versionStatus === 'PUBLISHED'}
        onClick={() => void lc.saveDraft()}
        title={lc.hasEntries ? 'Save draft metadata' : 'Generate a draft first'}
      >
        {lc.saveDraftPending ? 'Saving…' : 'Save draft'}
      </button>
      <button
        type="button"
        className="btn secondary"
        disabled={
          lc.archiveDraftPending || lc.version == null || lc.versionStatus === 'PUBLISHED' || lc.versionStatus === 'ARCHIVED'
        }
        onClick={() => void lc.archiveDraft()}
        title={
          lc.versionStatus === 'PUBLISHED'
            ? 'Cannot archive the live published timetable'
            : 'Archive the current working version (draft only)'
        }
      >
        {lc.archiveDraftPending ? 'Archiving…' : 'Archive'}
      </button>
      <button
        type="button"
        className="btn"
        disabled={lc.publishPending || lc.publishBlocked}
        onClick={() => setConfirmPublish(true)}
        title={lc.publishBlockedReason ?? 'Publish the current draft'}
      >
        {lc.publishPending ? 'Publishing…' : 'Publish'}
      </button>
      <button
        type="button"
        className="btn"
        disabled={lc.regeneratePending}
        onClick={() => void lc.regenerate()}
      >
        {lc.regeneratePending ? 'Generating…' : 'Generate draft'}
      </button>
    </>
  );

  return (
    <ModulePage
      title="Timetable"
      subtitle={
        <>
          Generate a draft, fix conflicts, then publish. Teachers and students only see the published timetable.
          {latestDraftVersion || latestPublished ? (
            <span style={{ display: 'inline-block', marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: 'rgba(37,99,235,0.08)', color: '#1e3a8a' }}>
              {latestDraftVersion ? `Draft v${latestDraftVersion.version}` : 'No draft'}
              {' · '}
              {latestPublished ? `Published v${latestPublished.version}` : 'Not published'}
            </span>
          ) : null}
          {versionLabel ? (
            <span style={{ display: 'inline-block', marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: 'rgba(15,23,42,0.06)', color: '#0f172a' }}>
              {versionLabel}
            </span>
          ) : null}
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>View</span>
            <span ref={viewMenuRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                onClick={() => setViewMenuOpen((v) => !v)}
                className="btn secondary"
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 800,
                }}
                title="Switch between draft and published timetable"
                aria-haspopup="menu"
                aria-expanded={viewMenuOpen}
              >
                {activeViewLabel}
                <span style={{ fontSize: 12, opacity: 0.75, lineHeight: 1 }}>▾</span>
              </button>

              {viewMenuOpen ? (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 34,
                    right: 0,
                    minWidth: 180,
                    borderRadius: 14,
                    border: '1px solid rgba(15,23,42,0.10)',
                    background: '#fff',
                    boxShadow: '0 16px 40px rgba(15,23,42,0.18)',
                    padding: 6,
                    zIndex: 50,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setView('DRAFT')}
                    className="w-full"
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: '1px solid transparent',
                      background: viewKey === 'DRAFT' ? 'rgba(59,130,246,0.10)' : 'transparent',
                      color: '#0f172a',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setView('PUBLISHED')}
                    className="w-full"
                    disabled={!latestPublished}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: '1px solid transparent',
                      background: viewKey === 'PUBLISHED' ? 'rgba(59,130,246,0.10)' : 'transparent',
                      color: !latestPublished ? 'rgba(15,23,42,0.35)' : '#0f172a',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: !latestPublished ? 'not-allowed' : 'pointer',
                      marginTop: 2,
                    }}
                  >
                    Published{latestPublished ? ` v${latestPublished.version ?? '?'}` : ''}
                  </button>
                </div>
              ) : null}
            </span>
          </span>
        </>
      }
      status={lc.status}
      headerActions={headerActions}
      tabs={[
        { id: 'workspace', label: 'Workspace' },
        {
          id: 'conflicts',
          label: 'Conflicts',
          badge: lc.conflicts.total > 0 ? lc.conflicts.total : null,
        },
      ]}
      activeTabId={tab}
      tabHrefBase="/app/timetable"
    >
      {lc.publishBlockedReason && lc.versionStatus !== 'PUBLISHED' && lc.hasEntries ? (
        <div
          className="card"
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 10,
            background: 'rgba(234,179,8,0.10)',
            border: '1px solid rgba(234,179,8,0.30)',
            color: '#7c2d12',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Publish disabled: {lc.publishBlockedReason}
        </div>
      ) : null}

      {tab === 'conflicts' ? (
        <ConflictsPanel
          onRegenerate={() => lc.regenerate().then(() => undefined)}
          onAutoFix={() => lc.autoFix().then(() => undefined)}
        />
      ) : (
        <Step7TimetableWorkspace
          onAutoGenerateDraft={() => lc.regenerate().then((r) => r ?? { success: true })}
          autoGeneratePending={lc.regeneratePending}
          autoGenerateErrorText={null}
          workingDays={basicInfo.data?.workingDays ?? null}
          onOpenEditor={() => navigate('/app/timetable/grid')}
          onCompleteStep={() => {
            toast.info('Use Publish', 'Publish the draft from the page header to make it active.');
          }}
          completePending={false}
          viewVersion={viewKey === 'PUBLISHED' ? latestPublished : null}
          readOnly={viewKey === 'PUBLISHED'}
        />
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard current draft?"
        description="The current draft will be replaced by a fresh auto-generation. Manual edits will be lost. Locks are respected. This cannot be undone."
        confirmLabel={lc.discardPending ? 'Working…' : 'Discard & regenerate'}
        confirmDisabled={lc.discardPending}
        danger
        onConfirm={async () => {
          await lc.discardAndRegenerate();
          setConfirmDiscard(false);
        }}
        onClose={() => setConfirmDiscard(false)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear this draft timetable?"
        description="This deletes all draft entries and locks (it does not regenerate). This cannot be undone."
        confirmLabel={lc.clearDraftPending ? 'Clearing…' : 'Clear draft'}
        confirmDisabled={lc.clearDraftPending}
        danger
        onConfirm={async () => {
          await lc.clearDraft();
          setConfirmClear(false);
        }}
        onClose={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={confirmPublish}
        title="Publish this timetable?"
        description={
          lc.conflicts.soft > 0
            ? `${lc.conflicts.soft} soft conflict${lc.conflicts.soft === 1 ? '' : 's'} will be carried into the published version. Continue anyway?`
            : 'This makes the draft active for teachers and students.'
        }
        confirmLabel={lc.publishPending ? 'Publishing…' : 'Publish'}
        confirmDisabled={lc.publishPending || lc.publishBlocked}
        onConfirm={async () => {
          await lc.publish();
          setConfirmPublish(false);
        }}
        onClose={() => setConfirmPublish(false)}
      />
    </ModulePage>
  );
}
