import { ClipboardCheck, FileText, IndianRupee, Presentation, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MeProfile } from '../../modules/dashboards/SuperAdminDashboard';
import { hasSchoolLeadershipRole } from '../../lib/roleGroups';

export function SchoolAdminCommandBar({ profile }: { profile: MeProfile }) {
  const leader = hasSchoolLeadershipRole(profile.roles ?? []);
  const mode = profile.schoolAttendanceMode ?? 'LECTURE_WISE';
  const attendanceHref = leader && mode === 'DAILY' ? '/app/attendance/daily-monitor' : '/app/attendance';

  return (
    <div className="erp-command-strip" role="region" aria-label="Quick search and actions">
      <div className="erp-command-strip__inner">
        <div className="erp-cmd-search-wrap" role="search">
          <Search size={16} strokeWidth={2.25} aria-hidden />
          <input
            type="search"
            className="erp-cmd-search-input"
            placeholder="Search students, teachers, classes, invoices…"
            autoComplete="off"
            readOnly
            onFocus={(e) => e.currentTarget.blur()}
            title="Universal search will connect to directory search"
            aria-label="Universal search (preview)"
          />
        </div>
        <div className="erp-quick-actions">
          <Link to={attendanceHref}>
            <ClipboardCheck aria-hidden />
            Attendance
          </Link>
          <Link to="/app/school/announcements/new">
            <FileText aria-hidden />
            Circular
          </Link>
          <Link to="/app/lectures">
            <Presentation aria-hidden />
            Lecture
          </Link>
          <Link to="/app/school/announcements/new">
            <Users aria-hidden />
            Substitute
          </Link>
          <Link to="/app/fees">
            <IndianRupee aria-hidden />
            Fee receipt
          </Link>
        </div>
      </div>
    </div>
  );
}
