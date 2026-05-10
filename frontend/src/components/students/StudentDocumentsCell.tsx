import type { StudentListRow } from './studentListTypes';

export function StudentDocumentsCell({ row }: { row: StudentListRow }) {
  const v = row.documentVerifiedCount ?? 0;
  const p = row.documentPendingCount ?? 0;
  const total = v + p;

  if (total === 0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(15,23,42,0.38)',
          padding: '2px 7px',
          borderRadius: 999,
          background: 'rgba(15,23,42,0.05)',
          border: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        0 docs
      </span>
    );
  }

  if (v > 0 && p === 0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 700,
          color: '#166534',
          padding: '2px 8px',
          borderRadius: 999,
          background: 'rgba(22,163,74,0.1)',
          border: '1px solid rgba(22,163,74,0.2)',
        }}
      >
        ✓ {v} verified
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      {v > 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#166534',
            padding: '2px 7px',
            borderRadius: 999,
            background: 'rgba(22,163,74,0.1)',
          }}
        >
          {v} verified
        </span>
      )}
      {p > 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#854d0e',
            padding: '2px 7px',
            borderRadius: 999,
            background: 'rgba(234,179,8,0.1)',
          }}
        >
          {p} pending
        </span>
      )}
    </span>
  );
}
