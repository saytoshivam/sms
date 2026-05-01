import type { MeProfile } from './SuperAdminDashboard';
import { FeatureArea } from '../../lib/featureAreas';
import { SchoolBusinessKpis } from '../../components/SchoolBusinessKpis';
import { WorkspaceHero, WorkspaceSection, WorkspaceTileLink } from '../../components/workspace/WorkspaceKit';

export function SchoolAdminDashboard({ profile }: { profile: MeProfile }) {
  const school = profile.schoolName?.trim() || 'Your school';
  const isSchoolAdmin = (profile.roles ?? []).includes('SCHOOL_ADMIN');

  return (
    <div className="workspace-page stack">
      <WorkspaceHero
        eyebrow="School workspace"
        title={school}
        tag="Admin"
        subtitle={
          <>
            Operational modules, readiness signals, and the setup checklist live on the <strong style={{ fontWeight: 900 }}>Operations hub</strong>.
            Below are KPIs and shortcuts for attendance, finance, messaging, and other day‑to‑day work.
          </>
        }
      />

      <section className="workspace-kpi-section card stack" style={{ margin: 0 }}>
        <SchoolBusinessKpis />
      </section>

      <WorkspaceSection
        title={FeatureArea.SCHOOL_OWNER}
        hint="School profile and leadership tools. Structured timetable setup stays on Operations hub."
      >
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app" icon="🧭" label="Operations hub" />
          <WorkspaceTileLink to="/app/school/management" icon="🏫" label="School management" />
          {isSchoolAdmin ? (
            <WorkspaceTileLink to="/app/onboarding" icon="📤" label="Setup wizard & imports" />
          ) : null}
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.USER_ACCESS} hint="Roster and student records for your tenant.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/user-access" icon="🔐" label="Role & access management" />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title={FeatureArea.ACADEMIC} hint="Classes, teaching schedule, and one-off lectures.">
        <div className="student-tile-grid">
          <WorkspaceTileLink to="/app/lectures" icon="📖" label="Schedule one-off lecture" />
          <WorkspaceTileLink to="/app/teacher/timetable" icon="🗓" label="Timetable" />
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
        </div>
      </WorkspaceSection>

      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Signed in as {profile.email}
      </p>
    </div>
  );
}
