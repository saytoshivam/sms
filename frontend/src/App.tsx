import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppLayout } from './pages/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { GoogleOAuthCallbackPage } from './pages/GoogleOAuthCallbackPage';
import { RegisterSchoolPage } from './pages/RegisterSchoolPage';
import { PlatformPlansFeaturesPage } from './pages/platform/PlatformPlansFeaturesPage';
import { PlatformFeatureCatalogPage } from './pages/platform/PlatformFeatureCatalogPage';
import { PlatformAnnouncementsPage } from './pages/platform/PlatformAnnouncementsPage';
import { PlatformAuditPage } from './pages/platform/PlatformAuditPage';
import { PlatformOperatorNotificationsPage } from './pages/platform/PlatformOperatorNotificationsPage';
import { PlatformIntegrationsPage } from './pages/platform/PlatformIntegrationsPage';
import { PlatformRuntimeFlagsPage } from './pages/platform/PlatformRuntimeFlagsPage';
import { PlatformSchoolEditPage } from './pages/platform/PlatformSchoolEditPage';
import { PlatformSchoolsDirectoryPage } from './pages/platform/PlatformSchoolsDirectoryPage';
import { ClassGroupsPage } from './pages/ClassGroupsPage';
import { StudentsPage } from './pages/StudentsPage';
import { AttendancePage } from './pages/AttendancePage';
import { FeesPage } from './pages/FeesPage';
import { LecturesPage } from './pages/LecturesPage';
import { SchoolThemePage } from './pages/SchoolThemePage';
import { StudentMyPerformancePage, StudentPerformancePage } from './pages/StudentPerformancePage';
import { ClassProgressPage } from './pages/ClassProgressPage';
import { TeacherTimetablePage } from './pages/TeacherTimetablePage';
import { TimetableRulesPage } from './pages/TimetableRulesPage';
import { TimetableGridV2Page } from './pages/TimetableGridV2Page';
import { StudentAcademicsPage } from './pages/StudentAcademicsPage';
import { StudentSchedulePage } from './pages/StudentSchedulePage';
import { StudentViewMarksPage } from './pages/StudentViewMarksPage';
import { StudentAnnouncementsPage } from './pages/StudentAnnouncementsPage';
import { StudentAnnouncementDetailPage } from './pages/StudentAnnouncementDetailPage';
import { ComposeSchoolAnnouncementPage } from './pages/ComposeSchoolAnnouncementPage';
import { ComposeTeacherAnnouncementPage } from './pages/ComposeTeacherAnnouncementPage';
import { StudentFeeStatementPage } from './pages/StudentFeeStatementPage';
import { StudentTermAttendancePage } from './pages/StudentTermAttendancePage';
import { StudentResultsPage } from './pages/StudentResultsPage';
import { StudentResultTermPage } from './pages/StudentResultTermPage';
import { StudentExamsPage } from './pages/StudentExamsPage';
import { SchoolManagementPage } from './pages/SchoolManagementPage';
import { UserAccessManagementPage } from './pages/UserAccessManagementPage';
import { SchoolOnboardingWizardPage } from './pages/SchoolOnboardingWizardPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/oauth/google" element={<GoogleOAuthCallbackPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="admin/register-school" element={<RegisterSchoolPage />} />
        <Route path="admin/plans-features" element={<PlatformPlansFeaturesPage />} />
        <Route path="admin/feature-catalog" element={<PlatformFeatureCatalogPage />} />
        <Route path="admin/announcements" element={<PlatformAnnouncementsPage />} />
        <Route path="admin/audit" element={<PlatformAuditPage />} />
        <Route path="admin/notifications" element={<PlatformOperatorNotificationsPage />} />
        <Route path="admin/integrations" element={<PlatformIntegrationsPage />} />
        <Route path="admin/flags" element={<PlatformRuntimeFlagsPage />} />
        <Route path="admin/schools" element={<PlatformSchoolsDirectoryPage />} />
        <Route path="admin/schools/:schoolId" element={<PlatformSchoolEditPage />} />
        <Route path="school-theme" element={<SchoolThemePage />} />
        <Route path="school/management" element={<SchoolManagementPage />} />
        {/* Kept for existing deep links; dashboard no longer exposes the wizard directly. */}
        <Route path="onboarding" element={<SchoolOnboardingWizardPage />} />
        <Route path="user-access" element={<UserAccessManagementPage />} />
        <Route path="class-groups" element={<ClassGroupsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/me/performance" element={<StudentMyPerformancePage />} />
        <Route path="student/academics" element={<StudentAcademicsPage />} />
        <Route path="student/schedule" element={<StudentSchedulePage />} />
        <Route path="student/marks" element={<StudentViewMarksPage />} />
        <Route path="student/attendance" element={<StudentTermAttendancePage />} />
        <Route path="student/results" element={<StudentResultsPage />} />
        <Route path="student/results/:termSlug" element={<StudentResultTermPage />} />
        <Route path="student/exams" element={<StudentExamsPage />} />
        <Route path="student/announcements" element={<StudentAnnouncementsPage />} />
        <Route path="student/announcements/:id" element={<StudentAnnouncementDetailPage />} />
        <Route path="school/announcements/new" element={<ComposeSchoolAnnouncementPage />} />
        <Route path="teacher/announcements/new" element={<ComposeTeacherAnnouncementPage />} />
        <Route path="student/fees" element={<StudentFeeStatementPage />} />
        <Route path="students/:studentId/performance" element={<StudentPerformancePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="fees" element={<FeesPage />} />
        <Route path="lectures" element={<LecturesPage />} />
        <Route path="teacher/class-progress" element={<ClassProgressPage />} />
        <Route path="teacher/timetable" element={<TeacherTimetablePage />} />
        <Route path="timetable/rules" element={<TimetableRulesPage />} />
        <Route path="timetable/grid" element={<TimetableGridV2Page />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
