/**
 * Product reference: default responsibilities by role (in-school). Backend enforcement is role + subscription feature +
 * fine-grained {@code PermissionCodes} — see GET /api/v1/tenant/capabilities.
 */
export const ROLE_PLAYBOOK_SECTIONS: {
  id: string;
  title: string;
  tagline: string;
  bullets: string[];
}[] = [
  {
    id: 'vice-principal',
    title: '6. Vice principal',
    tagline: 'Operational head',
    bullets: [
      'Manage daily school operations',
      'Oversee attendance',
      'Monitor discipline records',
      'Approve leave requests (teachers/students)',
      'Handle escalations',
      'Generate operational reports',
    ],
  },
  {
    id: 'hod',
    title: '7. HOD (Head of department)',
    tagline: 'Department-level control',
    bullets: [
      'Academic: assign subjects to teachers; review syllabus completion; approve lesson plans',
      'Exams: validate marks before publish; analyze subject performance',
      'Teachers: monitor teacher activity; recommend improvements',
    ],
  },
  {
    id: 'teacher',
    title: '8. Teacher',
    tagline: 'Core execution role',
    bullets: [
      'Classroom: view assigned classes & subjects; upload study material; assign homework',
      'Attendance: mark daily attendance; edit within allowed window',
      'Exams: enter marks; upload internal assessments',
      'Communication: send messages to parents/students',
    ],
  },
  {
    id: 'class-teacher',
    title: '9. Class teacher',
    tagline: 'Special role — extra privileges',
    bullets: [
      'Manage class attendance overview',
      'Track student performance',
      'Communicate with all parents of class',
      'Handle student issues',
    ],
  },
  {
    id: 'student',
    title: '10. Student',
    tagline: 'Limited, self-focused',
    bullets: [
      'View profile, attendance, timetable, homework',
      'View exam results; download report cards',
      'Receive notifications',
    ],
  },
  {
    id: 'parent',
    title: '11. Parent',
    tagline: 'Financial + monitoring',
    bullets: [
      'Student tracking: child attendance, performance, timetable',
      'Fees: pay online; download receipts; view dues',
      'Communication: chat with teachers; receive alerts',
    ],
  },
  {
    id: 'accountant',
    title: '12. Accountant',
    tagline: 'Financial control',
    bullets: [
      'Fees: structures; invoices; payments; refunds',
      'Reports: revenue; pending dues',
      'Integration: verify payment status from payment service',
    ],
  },
  {
    id: 'receptionist',
    title: '13. Receptionist / front desk',
    tagline: 'Entry-level admin',
    bullets: [
      'Student admissions (data entry); inquiries',
      'Basic reports; visitor logs; print documents',
    ],
  },
  {
    id: 'it-support',
    title: '14. IT / system admin (school level)',
    tagline: 'Technical operations',
    bullets: [
      'Manage user accounts; reset passwords',
      'Configure integrations; monitor system usage',
    ],
  },
];

/** Example mapping: feature area → typical roles (illustrative). */
export const FEATURE_ROLE_MATRIX: { feature: string; roles: string }[] = [
  { feature: 'Attendance', roles: 'Teacher, Class teacher, Principal, Vice principal' },
  { feature: 'Fees', roles: 'Accountant, Parent' },
  { feature: 'Exams', roles: 'Teacher, HOD, Principal' },
  { feature: 'Reports', roles: 'School admin, Principal' },
  { feature: 'Notifications', roles: 'All (as applicable)' },
];
