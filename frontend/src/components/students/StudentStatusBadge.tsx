import type { StudentLifecycleStatus } from './studentListTypes';

const STATUS_CLASS: Record<StudentLifecycleStatus, string> = {
  ACTIVE: 'sw-badge sw-badge--active',
  INACTIVE: 'sw-badge sw-badge--inactive',
  TRANSFERRED: 'sw-badge sw-badge--transferred',
  ALUMNI: 'sw-badge sw-badge--alumni',
};

export function StudentStatusBadge({ status }: { status: StudentLifecycleStatus | null | undefined }) {
  if (!status) return <span className="sw-badge sw-badge--muted">—</span>;
  return <span className={STATUS_CLASS[status] ?? 'sw-badge sw-badge--muted'}>{status.replace(/_/g, ' ')}</span>;
}
