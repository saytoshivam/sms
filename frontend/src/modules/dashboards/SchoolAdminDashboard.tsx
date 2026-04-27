import type { MeProfile } from './SuperAdminDashboard';
import { FeatureArea } from '../../lib/featureAreas';
import { onboardingStepHref } from '../../lib/onboardingWizardMeta';
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
            Run day-to-day operations — people, classes, attendance, fees, and announcements. Jump in with the tiles
            below.
          </>
        }
      />

      <section className="workspace-kpi-section card stack" style={{ margin: 0 }}>
        <SchoolBusinessKpis />
      </section>

      <WorkspaceSection
        title={FeatureArea.SCHOOL_OWNER}
        hint="Revenue, enrollment, subscription tier, branding, and who has access. Follow the setup steps in order."
      >
        {isSchoolAdmin ? (
          <div className="stack" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 8 }}>
              <p className="workspace-section__hint" style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                Step 1 — Basic setup
              </p>
              <div className="student-tile-grid">
                <WorkspaceTileLink to="/app/school/management" icon="🧭" label="School management" />
                <WorkspaceTileLink to={onboardingStepHref('BASIC_INFO')} icon="⚙️" label="Basic setup" />
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <p className="workspace-section__hint" style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                Step 2 — Classes & sections
              </p>
              <div className="student-tile-grid">
                <WorkspaceTileLink to={onboardingStepHref('CLASSES')} icon="🧩" label="Classes & sections" />
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <p className="workspace-section__hint" style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                Step 3 — Rooms, subjects & fee structure
              </p>
              <div className="student-tile-grid">
                <WorkspaceTileLink to={onboardingStepHref('ROOMS')} icon="🚪" label="Rooms" />
                <WorkspaceTileLink to={onboardingStepHref('SUBJECTS')} icon="📐" label="Subjects" />
                <WorkspaceTileLink to={onboardingStepHref('FEES')} icon="🧾" label="Fee structure" />
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <p className="workspace-section__hint" style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                Step 4 — Staff & students
              </p>
              <div className="student-tile-grid">
                <WorkspaceTileLink to={onboardingStepHref('STAFF')} icon="👔" label="Staff & roles" />
                <WorkspaceTileLink to={onboardingStepHref('STUDENTS')} icon="✏️" label="Students" />
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <p className="workspace-section__hint" style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                Step 5 — Academic structure
              </p>
              <div className="student-tile-grid">
                <WorkspaceTileLink to={onboardingStepHref('ACADEMIC_STRUCTURE')} icon="🔗" label="Academic structure" />
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <p className="workspace-section__hint" style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                Step 6 — Timetable generator
              </p>
              <div className="student-tile-grid">
                <WorkspaceTileLink to={onboardingStepHref('TIMETABLE')} icon="🗒️" label="Timetable generator" />
              </div>
            </div>
          </div>
        ) : (
          <div className="student-tile-grid">
            <WorkspaceTileLink to="/app/school/management" icon="🧭" label="School management" />
          </div>
        )}
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
