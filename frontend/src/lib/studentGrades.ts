import type { StudentMarkRow } from '../components/StudentMarksBoard';

export type LetterGrade = {
  letter: string;
  /** Grade points on a 4.0 scale (for TGPA). */
  gradePoint: number;
  status: string;
  pass: boolean;
};

/** Map percentage (0–100) to letter, 4-point grade value, and status labels similar to university result cards. */
export function letterGradeFromPercent(pct: number): LetterGrade {
  const p = Math.max(0, Math.min(100, pct));
  if (p >= 90) return { letter: 'A+', gradePoint: 4.0, status: 'Outstanding', pass: true };
  if (p >= 85) return { letter: 'A', gradePoint: 3.7, status: 'Excellent', pass: true };
  if (p >= 80) return { letter: 'B+', gradePoint: 3.3, status: 'Good', pass: true };
  if (p >= 75) return { letter: 'B', gradePoint: 3.0, status: 'Above Average', pass: true };
  if (p >= 70) return { letter: 'C+', gradePoint: 2.7, status: 'Satisfactory', pass: true };
  if (p >= 65) return { letter: 'C', gradePoint: 2.5, status: 'Average', pass: true };
  if (p >= 55) return { letter: 'D', gradePoint: 2.0, status: 'Pass', pass: true };
  return { letter: 'E', gradePoint: 0, status: 'Reappear', pass: false };
}

export function formatSemesterHeading(termName: string): string {
  const n = termName.toLowerCase();
  if (n.includes('2') && (n.includes('term') || n.includes('sem'))) return 'Semester : II';
  if (n.includes('ii')) return 'Semester : II';
  return 'Semester : I';
}

export function groupMarksByTerm(marks: StudentMarkRow[]): Map<string, StudentMarkRow[]> {
  const map = new Map<string, StudentMarkRow[]>();
  for (const m of marks) {
    const key = (m.termName && m.termName.trim()) || 'Term 1';
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return map;
}

export type CourseGradeRow = {
  subjectCode: string;
  subjectName: string;
  avgPercent: number;
  letter: LetterGrade;
};

/** One combined grade per subject within a term (mean of assessment percentages). */
export function courseGradesForTerm(rows: StudentMarkRow[]): CourseGradeRow[] {
  const bySubj = new Map<string, { code: string; name: string; sum: number; n: number }>();
  for (const m of rows) {
    const key = m.subjectCode || m.subjectName;
    const cur = bySubj.get(key) ?? { code: m.subjectCode, name: m.subjectName, sum: 0, n: 0 };
    cur.sum += m.scorePercent;
    cur.n += 1;
    bySubj.set(key, cur);
  }
  const out: CourseGradeRow[] = [];
  for (const v of bySubj.values()) {
    const avg = v.n > 0 ? v.sum / v.n : 0;
    out.push({
      subjectCode: v.code,
      subjectName: v.name,
      avgPercent: avg,
      letter: letterGradeFromPercent(avg),
    });
  }
  out.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  return out;
}

export function tgpaFromCourses(courses: CourseGradeRow[]): number {
  if (courses.length === 0) return 0;
  const sum = courses.reduce((s, c) => s + c.letter.gradePoint, 0);
  return sum / courses.length;
}

export function overallPerformanceGpa(terms: { tgpa: number; courseCount: number }[]): number {
  if (terms.length === 0) return 0;
  let w = 0;
  let acc = 0;
  for (const t of terms) {
    if (t.courseCount <= 0) continue;
    acc += t.tgpa * t.courseCount;
    w += t.courseCount;
  }
  if (w === 0) return 0;
  return acc / w;
}
