import type { MeProfile } from './SuperAdminDashboard';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { FeatureArea } from '../../lib/featureAreas';
import {
  DASHBOARD_WIZARD_BY_AREA,
  DASHBOARD_WIZARD_ICONS,
  REQUIRED_STEPS,
  WIZARD_STEPS,
  firstIncompleteWizardStepId,
  onboardingStepHref,
  setupWizardLabel,
} from '../../lib/onboardingWizardMeta';
import { SchoolBusinessKpis } from '../../components/SchoolBusinessKpis';
import { WorkspaceHero, WorkspaceSection, WorkspaceTileLink } from '../../components/workspace/WorkspaceKit';

export function SchoolAdminDashboard({ profile }: { profile: MeProfile }) {
  const school = profile.schoolName?.trim() || 'Your school';
  const isSchoolAdmin = (profile.roles ?? []).includes('SCHOOL_ADMIN');

  const onboarding = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => (await api.get<{ onboardingStatus: string; completedSteps: string[] }>('/api/v1/onboarding/progress')).data,
    enabled: isSchoolAdmin,
  });

  const onboardingPct = (() => {
    const set = new Set(onboarding.data?.completedSteps ?? []);
    let done = 0;
    for (const r of REQUIRED_STEPS) if (set.has(r)) done += 1;
    return Math.round((100 * done) / REQUIRED_STEPS.length);
  })();

  const nextWizardStep = firstIncompleteWizardStepId(onboarding.data?.completedSteps);
  const continueOnboardingTo = nextWizardStep ? onboardingStepHref(nextWizardStep) : '/app/onboarding';

  return (
    <div className="workspace-page stack">
      <WorkspaceHero
        eyebrow="School workspace"
        title={school}
        tag="Admin"
        subtitle={
          <>
            Run day-to-day operations — people, classes, attendance, fees, and announcements. Jump in with the tiles
            below.
          </>
        }
      />

      <section className="workspace-kpi-section card stack" style={{ margin: 0 }}>
        <SchoolBusinessKpis />
      </section>

      {isSchoolAdmin ? (
        <section className="card stack" style={{ margin: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="stack" style={{ gap: 6 }}>
              <strong>School setup wizard</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {onboarding.isLoading ? 'Loading setup progress…' : `Complete the required setup steps to go operational (${onboardingPct}%).`}
              </div>
            </div>
            <Link className="btn" to={continueOnboardingTo}>
              Continue setup
            </Link>
          </div>
          {onboarding.isError ? <div style={{ color: '#b91c1c' }}>{String(onboarding.error)}</div> : null}
        </section>
      ) : null}

      <WorkspaceSection
        title={FeatureArea.SCHOOL_OWNER}
        hint="Revenue, enrollment, subscription tier, branding, and who has access."
      >
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/school/management" icon="🧭" label="School management" />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.USER_ACCESS} hint="Roster and student records for your tenant.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/user-access" icon="🔐" label="Role & access management" />
          {DASHBOARD_WIZARD_BY_AREA.USER_ACCESS.map((id) => {
            const step = WIZARD_STEPS.find((s) => s.id === id);
            if (!step) return null;
            return (
              <WorkspaceTileLink
                key={id}
                to={onboardingStepHref(id)}
                icon={DASHBOARD_WIZARD_ICONS[id]}
                label={setupWizardLabel(step)}
              />
            );
          })}
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.ACADEMIC} hint="Classes, teaching schedule, and one-off lectures.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/lectures" icon="📖" label="Schedule one-off lecture" />
          <WorkspaceTileLink to="/app/teacher/timetable" icon="🗓" label="Timetable" />
          {DASHBOARD_WIZARD_BY_AREA.ACADEMIC.map((id) => {
            const step = WIZARD_STEPS.find((s) => s.id === id);
            if (!step) return null;
            return (
              <WorkspaceTileLink
                key={id}
                to={onboardingStepHref(id)}
                icon={DASHBOARD_WIZARD_ICONS[id]}
                label={setupWizardLabel(step)}
              />
            );
          })}
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.ATTENDANCE} hint="Create sessions and track who was present.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/attendance" icon="✅" label="Attendance" />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.EXAMS_RESULTS} hint="Class-level progress and marks trends.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/teacher/class-progress" icon="📊" label="Class progress" />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.FEES_FINANCE} hint="Invoices, collections, and online payment intents.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/fees" icon="💳" label="Fees & invoices" />
          {DASHBOARD_WIZARD_BY_AREA.FEES_FINANCE.map((id) => {
            const step = WIZARD_STEPS.find((s) => s.id === id);
            if (!step) return null;
            return (
              <WorkspaceTileLink
                key={id}
                to={onboardingStepHref(id)}
                icon={DASHBOARD_WIZARD_ICONS[id]}
                label={setupWizardLabel(step)}
              />
            );
          })}
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.COMMUNICATION} hint="Reach everyone or only selected classes.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/school/announcements/new" icon="📢" label="School-wide post" />
          <WorkspaceTileLink to="/app/teacher/announcements/new" icon="💬" label="Class announcement" />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.LIBRARY}>
        <div className="workspace-placeholder">
          <strong>Coming soon</strong>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Circulation and catalog will appear here as the module is enabled for your plan.
          </p>
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.TRANSPORT}>
        <div className="workspace-placeholder">
          <strong>Coming soon</strong>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Routes, vehicles, and stops — on the roadmap.
          </p>
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        title={FeatureArea.REPORTS_ANALYTICS}
        hint="High-level KPIs are in the business overview above. Deeper exports are planned."
      >
        <div className="workspace-placeholder">
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Scheduled reports and cohort analytics —{' '}
            <strong style={{ color: 'var(--color-text)' }}>use Class progress</strong> for teaching trends today.
          </p>
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.SYSTEM_CONFIG} hint="Logo, colors, and how your school appears in the app.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/school-theme" icon="🎨" label="Theme & branding" />
          {DASHBOARD_WIZARD_BY_AREA.SYSTEM_CONFIG.map((id) => {
            const step = WIZARD_STEPS.find((s) => s.id === id);
            if (!step) return null;
            return (
              <WorkspaceTileLink
                key={id}
                to={onboardingStepHref(id)}
                icon={DASHBOARD_WIZARD_ICONS[id]}
                label={setupWizardLabel(step)}
              />
            );
          })}
        </div>
      </WorkspaceSection>

      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Signed in as {profile.email}
      </p>
    </div>
  );
}
