import type { StudentListRow } from './studentListTypes';
import { classSectionLabel, studentFullName } from './studentListTypes';

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** UTF-8 BOM so Excel recognises Unicode. */
const CSV_BOM = '\uFEFF';

export function buildStudentsCsv(rows: StudentListRow[]): string {
  const header = [
    'Student name',
    'Admission no',
    'Class / section',
    'Roll no',
    'Guardian name',
    'Guardian phone',
    'Status',
    'Docs verified',
    'Docs pending',
  ];
  const lines = [
    header.map(escapeCsvCell).join(','),
    ...rows.map((s) =>
      [
        studentFullName(s),
        s.admissionNo ?? '',
        classSectionLabel(s),
        s.rollNo ?? '',
        s.primaryGuardianName ?? '',
        s.primaryGuardianPhone ?? '',
        s.status ?? '',
        String(s.documentVerifiedCount ?? 0),
        String(s.documentPendingCount ?? 0),
      ]
        .map(String)
        .map(escapeCsvCell)
        .join(','),
    ),
  ];
  return CSV_BOM + lines.join('\n');
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
