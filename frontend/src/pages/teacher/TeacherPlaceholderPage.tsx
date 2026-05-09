import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './teacherWorkspace.css';

export function TeacherPlaceholderPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="workspace-feature-page tws-page">
      <div className="tws-toolbar">
        <h2>{title}</h2>
      </div>
      <div className="tws-placeholder">
        <div className="tws-placeholder__title">Coming in phased rollout</div>
        <p style={{ margin: 0 }}>{children}</p>
        <p className="muted" style={{ margin: '14px 0 0', fontSize: 12 }}>
          Dashboard and timetable surfaces already use live data; module pipelines (leave, substitutions, and similar)
          attach here without changing this navigation skeleton.
        </p>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link to="/app/dashboard">← Teacher dashboard</Link>
      </p>
    </div>
  );
}
