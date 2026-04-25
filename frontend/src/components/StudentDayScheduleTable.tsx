import type { TimetableOccurrence } from '../pages/TeacherTimetablePage';

function slotTypeLabel(source: string): 'Weekly' | 'One-off' {
  return source === 'RECURRING' ? 'Weekly' : 'One-off';
}

/**
 * Student-facing timetable: time, subject, teacher, room, weekly vs one-off.
 * Reuses global `data-table` / tag styles; optional compact + embed for dashboard card.
 */
export function StudentDayScheduleTable({
  rows,
  compact,
  embedInCard,
  ariaLabel,
}: {
  rows: TimetableOccurrence[];
  compact?: boolean;
  /** Inside `.student-tt-body` — tighter padding, no double inset */
  embedInCard?: boolean;
  ariaLabel?: string;
}) {
  if (rows.length === 0) return null;
  const wrapClass = [
    embedInCard ? 'student-sched-table-wrap student-sched-table-wrap--embed' : 'student-sched-table-wrap',
    compact ? 'teacher-tt-table-wrap--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={wrapClass}>
      <table className="data-table teacher-tt-table student-sched-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Subject</th>
            <th scope="col">Teacher</th>
            <th scope="col">Room</th>
            <th scope="col">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o, i) => (
            <tr key={`${o.startTime}-${i}-${o.subject}-${o.source}-${o.room ?? ''}`}>
              <td>
                {o.startTime.slice(0, 5)}–{o.endTime.slice(0, 5)}
              </td>
              <td className="teacher-tt-col-subject">{o.subject}</td>
              <td>{o.teacherName?.trim() ? o.teacherName : '—'}</td>
              <td>{o.room?.trim() ? o.room : '—'}</td>
              <td className="teacher-tt-col-type">
                <span className={o.source === 'RECURRING' ? 'tag tag-rec' : 'tag tag-adhoc'}>{slotTypeLabel(o.source)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
