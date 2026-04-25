import { NavLink } from 'react-router-dom';

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  flex: 1,
  textAlign: 'center' as const,
  padding: '10px 4px 8px',
  fontSize: 11,
  fontWeight: 600,
  color: isActive ? 'var(--color-primary)' : '#64748b',
  borderTop: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
  textDecoration: 'none',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 4,
});

export function StudentBottomNav() {
  return (
    <nav className="student-bottom-nav" aria-label="Student primary">
      <NavLink to="/app" end style={linkStyle}>
        <span style={{ fontSize: 18 }}>▦</span>
        Dashboard
      </NavLink>
      <NavLink to="/app/student/announcements" style={linkStyle}>
        <span style={{ fontSize: 18 }}>📰</span>
        Happenings
      </NavLink>
      <NavLink to="/app/student/schedule" style={linkStyle}>
        <span style={{ fontSize: 18 }}>✎</span>
        Schedule
      </NavLink>
      <NavLink to="/app/students/me/performance" style={linkStyle}>
        <span style={{ fontSize: 18 }}>≡</span>
        View marks
      </NavLink>
    </nav>
  );
}
