import { useState } from 'react';
import type { StudentListRow } from './studentListTypes';

function initials(s: Pick<StudentListRow, 'firstName' | 'lastName'>): string {
  const a = (s.firstName?.[0] ?? '').toUpperCase();
  const b = (s.lastName?.[0] ?? s.firstName?.[1] ?? '').toUpperCase();
  return (a + b).trim() || '?';
}

export function StudentAvatar({ student, size = 36 }: { student: StudentListRow; size?: number }) {
  const [broken, setBroken] = useState(false);
  const url = student.photoUrl?.trim();
  if (url && !broken) {
    return (
      <img
        className="sw-avatar"
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className="sw-avatar sw-avatar--placeholder"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      aria-hidden
    >
      {initials(student)}
    </div>
  );
}
