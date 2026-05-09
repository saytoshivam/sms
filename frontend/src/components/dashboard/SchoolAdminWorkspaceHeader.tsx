import { Link } from 'react-router-dom';
import type { MeProfile } from '../../modules/dashboards/SuperAdminDashboard';
import type { SchoolAdminOperationalSnapshot } from './schoolAdmin/useSchoolAdminOperationalData';
import './schoolAdminWorkspaceHeader.css';

export function SchoolAdminWorkspaceHeader({
  profile,
  op,
}: {
  profile: MeProfile;
  op: SchoolAdminOperationalSnapshot;
}) {
  const school = profile.schoolName?.trim() || 'Your school';
  const mode = profile.schoolAttendanceMode ?? 'LECTURE_WISE';
  const tt = op.tt;
  const inbox = op.operationalInbox ?? [];

  const ttChip =
    tt.setupLoading || tt.timetableHealthExtrasLoading
      ? '…'
      : tt.versionStatus === 'PUBLISHED'
        ? 'Published'
        : tt.conflicts.hard > 0
          ? 'Blocked'
          : 'Draft';

  return (
    <header className="erp-ws-head">
      <div className="erp-ws-head__primary">
        <h1 className="erp-ws-head__title">{school}</h1>
        <p className="erp-ws-head__sub">
          Command cockpit · Academic year {op.academicYearLabel}
        </p>
      </div>
      <div className="erp-ws-inbox" aria-label="Operational inbox">
        <span className="erp-ws-inbox__title">Inbox</span>
        <div className="erp-ws-inbox__row">
          {inbox.map((item) => (
            <Link key={item.id} className={`erp-ws-inbox__chip erp-ws-inbox__chip--${item.tone}`} to={item.to}>
              <span className="erp-ws-inbox__count" aria-hidden>
                {item.count > 99 ? '99+' : item.count}
              </span>
              <span className="erp-ws-inbox__text">
                <span className="erp-ws-inbox__label">{item.label}</span>
                <span className="erp-ws-inbox__meta">{item.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className="erp-ws-head__chips" aria-label="Workspace context">
        <span className="erp-ws-chip">
          <span className="erp-ws-chip__k">Attendance mode</span>
          <span className="erp-ws-chip__v">{mode === 'DAILY' ? 'Daily board' : 'Lecture-wise'}</span>
        </span>
        <span className="erp-ws-chip">
          <span className="erp-ws-chip__k">Timetable</span>
          <span className="erp-ws-chip__v">{ttChip}</span>
        </span>
        <span className="erp-ws-chip">
          <span className="erp-ws-chip__k">Sections</span>
          <span className="erp-ws-chip__v">{op.activeSectionsCount}</span>
        </span>
        <span className="erp-ws-chip">
          <span className="erp-ws-chip__k">Teachers</span>
          <span className="erp-ws-chip__v">{op.rosterTeachers ?? '—'}</span>
        </span>
      </div>
      <div className="erp-ws-head__meta">
        <span className="erp-ws-live-dot" aria-hidden />
        <span>{op.syncTimeLabel}</span>
      </div>
    </header>
  );
}
