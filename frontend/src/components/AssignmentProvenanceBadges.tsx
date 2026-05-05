import type { ReactNode } from 'react';

function LockIcon({ title }: { title?: string }) {
  return (
    <svg
      className="sms-provenance-badge__lock-icon"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

/** AUTO / MANUAL provenance for homeroom room or class teacher assignment. */
export function AssignmentSourceBadge({ variant }: { variant: 'auto' | 'manual' }) {
  if (variant === 'auto') {
    return (
      <span className="sms-provenance-badge sms-provenance-badge--auto">
        <span className="sms-provenance-badge__label">AUTO</span>
        <LockIcon title="Assigned automatically" />
      </span>
    );
  }
  return <span className="sms-provenance-badge sms-provenance-badge--manual">MANUAL</span>;
}

/** Lavender pill when homeroom or class teacher row is bulk-lock protected. */
export function SectionBulkLockBadge({ kind }: { kind: 'homeroom' | 'classTeacher' }) {
  return (
    <span className="sms-provenance-badge sms-provenance-badge--bulk-lock">
      {kind === 'homeroom' ? 'Homeroom locked' : 'Teacher locked'}
    </span>
  );
}

/** Wrapper row for multiple badges with consistent gap. */
export function ProvenanceBadgeGroup({ children }: { children: ReactNode }) {
  return <span className="sms-provenance-badge-group">{children}</span>;
}
