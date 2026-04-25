import type { MeProfile } from './SuperAdminDashboard';
import { WorkspaceHero } from '../../components/workspace/WorkspaceKit';

export function ParentDashboard({ profile }: { profile: MeProfile }) {
  return (
    <div className="workspace-page stack">
      <WorkspaceHero
        eyebrow="Family"
        title="Parent portal"
        tag="Preview"
        subtitle={
          <>
            <strong>{profile.email}</strong> — when your school enables the parent experience, attendance summaries,
            fees, and messaging will surface here.
          </>
        }
      />

      <div className="workspace-panel">
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>
          This area will connect to <code style={{ fontSize: 13 }}>/api/v1/parent/**</code> behind the{' '}
          <code style={{ fontSize: 13 }}>parent.portal</code> feature. You will receive the same polished cards and
          shortcuts as the student app.
        </p>
      </div>
    </div>
  );
}
