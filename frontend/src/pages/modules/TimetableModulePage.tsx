import { useEffect, useMemo, useState } from 'react';
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

  const versionLabel = useMemo(() => {
    if (!lc.version) return null;
    const v = lc.version.version != null ? `v${lc.version.version}` : '';
    const s = lc.versionStatus === 'PUBLISHED'
      ? 'Published'
      : lc.versionStatus === 'REVIEW'
        ? 'In review'
        : lc.versionStatus === 'DRAFT'
          ? 'Draft'
          : 'Working copy';
    return `${s} ${v}`.trim();
  }, [lc.version, lc.versionStatus]);

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
        disabled={lc.saveDraftPending || !lc.hasEntries || lc.versionStatus === 'PUBLISHED'}
        onClick={() => void lc.saveDraft()}
        title={lc.hasEntries ? 'Move the draft to review' : 'Generate a draft first'}
      >
        {lc.saveDraftPending ? 'Saving…' : 'Save draft'}
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
        {lc.regeneratePending ? 'Regenerating…' : 'Regenerate'}
      </button>
    </>
  );

  return (
    <ModulePage
      title="Timetable"
      subtitle={
        <>
          Generate, review conflicts, lock cells, and publish. Edits propagate immediately to teacher and student views.
          {versionLabel ? (
            <span style={{ display: 'inline-block', marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: 'rgba(15,23,42,0.06)', color: '#0f172a' }}>
              {versionLabel}
            </span>
          ) : null}
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
