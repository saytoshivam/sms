import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Hero band aligned with student dashboard (gradient, rounded, soft shadow). */
export function WorkspaceHero({
  eyebrow,
  title,
  subtitle,
  tag,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  tag?: string;
}) {
  return (
    <section className="workspace-hero">
      <div className="workspace-hero__top">
        <p className="workspace-hero__eyebrow">{eyebrow}</p>
        {tag ? <span className="workspace-hero__tag">{tag}</span> : null}
      </div>
      <h1 className="workspace-hero__title">{title}</h1>
      {subtitle ? <div className="workspace-hero__subtitle">{subtitle}</div> : null}
    </section>
  );
}

/** Same tile treatment as the student dashboard shortcuts. */
export function WorkspaceTileLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <div className="student-tile-wrap">
      <Link to={to} className="student-tile">
        <span className="student-tile-icon" aria-hidden>
          {icon}
        </span>
        <span className="student-tile-label">{label}</span>
      </Link>
    </div>
  );
}

export function WorkspaceSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="workspace-section">
      <div className="workspace-section__head">
        <h2 className="workspace-section__title">{title}</h2>
        {hint ? <p className="workspace-section__hint">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
