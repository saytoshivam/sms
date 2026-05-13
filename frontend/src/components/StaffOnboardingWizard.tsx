/**
 * Staff Onboarding Wizard
 *
 * A 9-step guided wizard to onboard a single staff member.
 * Layout: Left vertical stepper | Center active form | Right live preview + checklist
 *
 * API: POST /api/v1/onboarding/staff/onboard  (structured StaffOnboardingRequest)
 *      PUT  /api/v1/onboarding/staff/{id}/onboard
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardSubject { id: number; code: string; name: string; type?: string | null }
export interface WizardClassGroup { id: number; code?: string | null; name?: string | null }

/** Shape returned by /api/v1/onboarding/teacher-demand-summary */
interface DemandSummary {
  schoolSlotsPerWeek: number;
  hasSevereShortage: boolean;
  subjects: {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    requiredPeriods: number;
    qualifiedTeacherCount: number;
    availableCapacity: number;
    assignmentFeasible: boolean;
    status: string;
    statusDetail: string;
  }[];
}

interface WizardDraft {
  // Step 1 – Identity
  fullName: string;
  phone: string;
  employeeNo: string;
  staffType: string; // TEACHING | NON_TEACHING | ADMIN | SUPPORT

  // Step 2 – Employment
  designation: string;
  department: string;
  joiningDate: string;
  employmentType: string; // FULL_TIME | PART_TIME | CONTRACT | VISITING

  // Step 3 – Roles & Access
  roles: string[];
  createLoginAccount: boolean;

  // Step 4 – Academic Capabilities
  teachableSubjectIds: number[];
  maxWeeklyLectureLoad: number | '';
  maxDailyLectureLoad: number | '';
  canBeClassTeacher: boolean;
  canTakeSubstitution: boolean;
  preferredClassGroupIds: number[];
  restrictedClassGroupIds: number[];
  unavailablePeriodsNote: string; // placeholder text

  // Step 5 – Contact & Emergency
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;

  // Step 6 – Qualifications
  qualifications: string;
  experience: string;

  // Step 7 – Documents Checklist
  docs: Record<string, boolean>;

  // Step 8 – Payroll Prep
  bankAccount: string;
  bankName: string;
  ifscCode: string;
  panNumber: string;

  // Step 9 – Review (no extra fields)
}

function emptyDraft(): WizardDraft {
  return {
    fullName: '', phone: '', employeeNo: '', staffType: 'TEACHING',
    designation: '', department: '', joiningDate: '', employmentType: 'FULL_TIME',
    roles: [], createLoginAccount: false,
    teachableSubjectIds: [], maxWeeklyLectureLoad: '', maxDailyLectureLoad: '',
    canBeClassTeacher: true, canTakeSubstitution: true,
    preferredClassGroupIds: [], restrictedClassGroupIds: [],
    unavailablePeriodsNote: '',
    email: '', address: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
    qualifications: '', experience: '',
    docs: { 'Offer Letter': false, 'ID Proof': false, 'Photo': false, 'Certificates': false, 'PAN Card': false, 'Bank Details': false },
    bankAccount: '', bankName: '', ifscCode: '', panNumber: '',
  };
}


// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Identity',              icon: '👤' },
  { id: 2, label: 'Employment',            icon: '💼' },
  { id: 3, label: 'Roles & Access',        icon: '🔑' },
  { id: 4, label: 'Academic Capabilities', icon: '📚' },
  { id: 5, label: 'Contact & Emergency',   icon: '📞' },
  { id: 6, label: 'Qualifications',        icon: '🎓' },
  { id: 7, label: 'Documents',             icon: '📄' },
  { id: 8, label: 'Payroll Prep',          icon: '💰' },
  { id: 9, label: 'Review & Activate',     icon: '✅' },
] as const;

const ROLE_OPTIONS = [
  { value: 'TEACHER',       label: 'Teacher' },
  { value: 'HOD',           label: 'HOD' },
  { value: 'VICE_PRINCIPAL',label: 'Vice Principal' },
  { value: 'PRINCIPAL',     label: 'Principal' },
  { value: 'ACCOUNTANT',    label: 'Accountant' },
  { value: 'CLERK',         label: 'Clerk' },
  { value: 'SCHOOL_ADMIN',  label: 'School Admin' },
];

const STAFF_TYPES = [
  { value: 'TEACHING',     label: 'Teaching' },
  { value: 'NON_TEACHING', label: 'Non-Teaching' },
  { value: 'ADMIN',        label: 'Admin' },
  { value: 'SUPPORT',      label: 'Support' },
];

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME',  label: 'Full-Time' },
  { value: 'PART_TIME',  label: 'Part-Time' },
  { value: 'CONTRACT',   label: 'Contract' },
  { value: 'VISITING',   label: 'Visiting' },
];

// ─── Validation helpers ───────────────────────────────────────────────────────

function canSaveDraft(d: WizardDraft) {
  return !!d.fullName.trim() && !!d.phone.trim() && !!d.staffType && !!d.designation.trim() && d.roles.length > 0;
}

function canActivate(d: WizardDraft) {
  return canSaveDraft(d) && !!d.joiningDate;
}

function missingForDraft(d: WizardDraft): string[] {
  const m: string[] = [];
  if (!d.fullName.trim())    m.push('Full name');
  if (!d.phone.trim())       m.push('Phone');
  if (!d.staffType)          m.push('Staff type');
  if (!d.designation.trim()) m.push('Designation');
  if (d.roles.length === 0)  m.push('At least one role');
  return m;
}

function missingForActivate(d: WizardDraft): string[] {
  const m = missingForDraft(d);
  if (!d.joiningDate) m.push('Joining date');
  return m;
}

function isTimetableEligible(d: WizardDraft): boolean {
  return d.roles.includes('TEACHER') && d.teachableSubjectIds.length > 0;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  fontSize: 13, padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(15,23,42,0.15)', width: '100%',
  boxSizing: 'border-box', background: '#fff', outline: 'none',
};

const BASE_BADGE: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 999,
  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
};

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)' }}>{hint}</span>}
    </label>
  );
}

function Row({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: 'flex', gap, flexWrap: 'wrap' }}>{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 8 }}>
      {children}
    </div>
  );
}

function initials(name: string) { return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'; }
function avatarColor(name: string): string {
  const c = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#9333ea','#0284c7'];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

function typeColor(t: string) {
  return { TEACHING: '#1e40af', NON_TEACHING: '#6d28d9', ADMIN: '#0e7490', SUPPORT: '#475569' }[t] ?? '#475569';
}
function typeBg(t: string) {
  return { TEACHING: 'rgba(37,99,235,0.1)', NON_TEACHING: 'rgba(124,58,237,0.1)', ADMIN: 'rgba(8,145,178,0.1)', SUPPORT: 'rgba(15,23,42,0.07)' }[t] ?? 'rgba(15,23,42,0.07)';
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepIdentity({ d, set }: { d: WizardDraft; set: (p: Partial<WizardDraft>) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Row>
        <Field label="Full Name" required>
          <input style={inputSt} value={d.fullName} placeholder="e.g. Priya Sharma" onChange={e => set({ fullName: e.target.value })} />
        </Field>
        <Field label="Employee No" hint="Auto-generated if left blank">
          <input style={inputSt} value={d.employeeNo} placeholder="e.g. EMP-001" onChange={e => set({ employeeNo: e.target.value })} />
        </Field>
      </Row>
      <Row>
        <Field label="Phone" required>
          <input style={inputSt} value={d.phone} placeholder="+91 9876543210" onChange={e => set({ phone: e.target.value })} />
        </Field>
        <Field label="Staff Type" required>
          <select style={inputSt} value={d.staffType} onChange={e => set({ staffType: e.target.value })}>
            {STAFF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </Row>
    </div>
  );
}

function StepEmployment({ d, set }: { d: WizardDraft; set: (p: Partial<WizardDraft>) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Row>
        <Field label="Designation" required>
          <input style={inputSt} value={d.designation} placeholder="e.g. Senior Teacher, Assistant Principal" onChange={e => set({ designation: e.target.value })} />
        </Field>
        <Field label="Department">
          <input style={inputSt} value={d.department} placeholder="e.g. Science, Academics" onChange={e => set({ department: e.target.value })} />
        </Field>
      </Row>
      <Row>
        <Field label="Joining Date" hint="Required for activation">
          <input style={inputSt} type="date" value={d.joiningDate} onChange={e => set({ joiningDate: e.target.value })} />
        </Field>
        <Field label="Employment Type">
          <select style={inputSt} value={d.employmentType} onChange={e => set({ employmentType: e.target.value })}>
            {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </Row>
    </div>
  );
}

function StepRolesAccess({ d, set }: { d: WizardDraft; set: (p: Partial<WizardDraft>) => void }) {
  const toggle = (r: string) => set({ roles: d.roles.includes(r) ? d.roles.filter(x => x !== r) : [...d.roles, r] });
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <SectionTitle>School Roles <span style={{ color: '#dc2626' }}>*</span></SectionTitle>
        <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', margin: '0 0 10px' }}>Select all roles this staff member holds. At least one is required.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ROLE_OPTIONS.map(r => {
            const on = d.roles.includes(r.value);
            return (
              <button key={r.value} type="button" onClick={() => toggle(r.value)}
                style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                  border: on ? '1.5px solid #ea580c' : '1px solid rgba(15,23,42,0.18)',
                  background: on ? 'rgba(234,88,12,0.12)' : '#fff',
                  color: on ? '#7c2d12' : '#475569' }}>
                {r.label}
              </button>
            );
          })}
        </div>
        {d.roles.length === 0 && (
          <p style={{ fontSize: 11, color: '#b91c1c', marginTop: 6, fontWeight: 600 }}>⚠ Select at least one role</p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', background: 'rgba(15,23,42,0.03)', borderRadius: 10, border: '1px solid rgba(15,23,42,0.08)' }}>
        <SectionTitle>Login Account</SectionTitle>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.createLoginAccount} style={{ marginTop: 2, flexShrink: 0 }}
            onChange={e => set({ createLoginAccount: e.target.checked })} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(15,23,42,0.8)' }}>Create portal login account</div>
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', marginTop: 2 }}>
              {d.createLoginAccount
                ? 'A temporary password will be generated. Requires email in Step 5.'
                : 'Staff member will not have portal access until a login is created.'}
            </div>
          </div>
        </label>
        {d.createLoginAccount && !d.email.trim() && (
          <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, padding: '4px 8px', background: 'rgba(234,179,8,0.08)', borderRadius: 6 }}>
            ⚠ Add email in Step 5 for login creation
          </div>
        )}
      </div>
    </div>
  );
}

function StepAcademic({ d, set, subjects, classGroups, demand }: {
  d: WizardDraft; set: (p: Partial<WizardDraft>) => void;
  subjects: WizardSubject[]; classGroups: WizardClassGroup[];
  demand?: DemandSummary | null;
}) {
  const [subjectSearch, setSubjectSearch] = React.useState('');
  const isTeacher = d.roles.includes('TEACHER');

  const toggleSub = (id: number) =>
    set({ teachableSubjectIds: d.teachableSubjectIds.includes(id) ? d.teachableSubjectIds.filter(x => x !== id) : [...d.teachableSubjectIds, id] });
  const togglePref = (id: number) =>
    set({ preferredClassGroupIds: d.preferredClassGroupIds.includes(id) ? d.preferredClassGroupIds.filter(x => x !== id) : [...d.preferredClassGroupIds, id] });
  const toggleRestr = (id: number) =>
    set({ restrictedClassGroupIds: d.restrictedClassGroupIds.includes(id) ? d.restrictedClassGroupIds.filter(x => x !== id) : [...d.restrictedClassGroupIds, id] });

  const query = subjectSearch.toLowerCase();
  const filtered = subjects.filter(s =>
    !query || s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query) || (s.type ?? '').toLowerCase().includes(query)
  );
  const grouped = React.useMemo(() => {
    const map: Record<string, WizardSubject[]> = {};
    filtered.forEach(s => { const g = s.type ?? 'General'; (map[g] = map[g] ?? []).push(s); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const selectedDemand = React.useMemo(() =>
    demand?.subjects.filter(ds => d.teachableSubjectIds.includes(ds.subjectId)) ?? [],
    [demand, d.teachableSubjectIds]
  );
  const totalRequiredPeriods = selectedDemand.reduce((s, ds) => s + ds.requiredPeriods, 0);
  const weeklyLoad = d.maxWeeklyLectureLoad !== '' ? Number(d.maxWeeklyLectureLoad) : null;
  const avgQualified = selectedDemand.reduce((s, ds) => s + ds.qualifiedTeacherCount, 0);
  const loadBelowDemand = weeklyLoad !== null && totalRequiredPeriods > 0 && weeklyLoad < Math.ceil(totalRequiredPeriods / Math.max(avgQualified, 1));

  if (!isTeacher) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(15,23,42,0.4)' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📚</div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Not applicable</div>
        <div style={{ fontSize: 13 }}>Academic capabilities apply only to staff with the <strong>Teacher</strong> role.</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Go back to Step 3 and assign the Teacher role to enable this step.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Teachable Subjects ─────────────────────────────────── */}
      <div>
        <SectionTitle>Teachable Subjects <span style={{ color: '#dc2626' }}>*</span></SectionTitle>
        <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', margin: '0 0 10px' }}>
          Select all subjects this teacher can teach. Required for timetable eligibility.
        </p>
        {subjects.length > 6 && (
          <input style={{ ...inputSt, marginBottom: 8 }} placeholder="Search by code, name, or type…"
            value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} />
        )}
        {subjects.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)', padding: '10px', background: 'rgba(15,23,42,0.03)', borderRadius: 8 }}>
            No subjects in catalog yet. Add subjects in the Subjects module first.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)', padding: '8px', background: 'rgba(15,23,42,0.03)', borderRadius: 8 }}>
            No subjects match "{subjectSearch}"
          </div>
        ) : (
          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 10, background: '#fff' }}>
            {grouped.map(([typeName, subs]) => (
              <div key={typeName}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(15,23,42,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '7px 12px 4px', background: 'rgba(15,23,42,0.025)', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                  {typeName}
                </div>
                {subs.map(s => {
                  const on = d.teachableSubjectIds.includes(s.id);
                  const ds = demand?.subjects.find(x => x.subjectId === s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleSub(s.id)}
                      style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', borderBottom: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer', background: on ? 'rgba(22,163,74,0.07)' : 'transparent', textAlign: 'left', transition: 'background 0.1s' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: on ? 'none' : '1.5px solid rgba(15,23,42,0.2)', background: on ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900 }}>
                        {on ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: on ? 'rgba(22,163,74,0.15)' : 'rgba(15,23,42,0.06)', color: on ? '#166534' : '#475569', flexShrink: 0, fontFamily: 'monospace' }}>
                        {s.code}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: on ? '#166534' : 'rgba(15,23,42,0.75)', flex: 1, textAlign: 'left' }}>
                        {s.name}
                      </span>
                      {ds && (
                        <span style={{ fontSize: 10, color: ds.assignmentFeasible ? '#64748b' : '#dc2626', fontWeight: 600, flexShrink: 0, background: ds.assignmentFeasible ? 'rgba(8,145,178,0.08)' : 'rgba(220,38,38,0.08)', padding: '2px 7px', borderRadius: 5 }}>
                          {ds.requiredPeriods}p/wk · {ds.qualifiedTeacherCount}T{!ds.assignmentFeasible ? ' ⚠' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {d.teachableSubjectIds.length > 0 ? (
          <div style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginTop: 6 }}>
            ✓ {d.teachableSubjectIds.length} subject{d.teachableSubjectIds.length > 1 ? 's' : ''} selected
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 700, marginTop: 6 }}>
            ⚠ Select at least one subject for timetable eligibility
          </div>
        )}

        {/* Demand summary for selected subjects */}
        {selectedDemand.length > 0 && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(248,250,252,1)', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Teacher Demand Context</div>
            {selectedDemand.map(ds => (
              <div key={ds.subjectId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#475569', background: 'rgba(15,23,42,0.06)', padding: '1px 6px', borderRadius: 4 }}>{ds.subjectCode}</span>
                <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.65)', flex: 1 }}>{ds.subjectName}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: ds.assignmentFeasible ? '#0e7490' : '#dc2626', background: ds.assignmentFeasible ? 'rgba(8,145,178,0.08)' : 'rgba(220,38,38,0.08)', padding: '2px 7px', borderRadius: 5 }}>
                  {ds.requiredPeriods} p/wk · {ds.qualifiedTeacherCount} teacher{ds.qualifiedTeacherCount !== 1 ? 's' : ''}{!ds.assignmentFeasible ? ' · Shortage ⚠' : ' · OK ✓'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Load Configuration ─────────────────────────────────── */}
      <div>
        <SectionTitle>Load Configuration</SectionTitle>
        <Row>
          <Field label="Max Weekly Periods" hint="Leave blank to use school default">
            <input style={inputSt} type="number" min={1} max={60} placeholder="e.g. 24"
              value={d.maxWeeklyLectureLoad === '' ? '' : d.maxWeeklyLectureLoad}
              onChange={e => set({ maxWeeklyLectureLoad: e.target.value === '' ? '' : Math.max(1, Math.trunc(Number(e.target.value))) })} />
          </Field>
          <Field label="Max Daily Periods" hint="Optional — no daily cap if blank">
            <input style={inputSt} type="number" min={1} max={12} placeholder="e.g. 6"
              value={d.maxDailyLectureLoad === '' ? '' : d.maxDailyLectureLoad}
              onChange={e => set({ maxDailyLectureLoad: e.target.value === '' ? '' : Math.max(1, Math.trunc(Number(e.target.value))) })} />
          </Field>
        </Row>
        {loadBelowDemand && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#92400e', fontWeight: 700, padding: '6px 10px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 7 }}>
            ⚠ Max weekly load ({weeklyLoad}) may be below expected assignment ({totalRequiredPeriods} p/wk total demand across {avgQualified} teacher{avgQualified !== 1 ? 's' : ''}).
          </div>
        )}
      </div>

      {/* ── Assignment Capabilities ─────────────────────────────── */}
      <div>
        <SectionTitle>Assignment Capabilities</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 9, border: `1px solid ${d.canBeClassTeacher ? 'rgba(37,99,235,0.25)' : 'rgba(15,23,42,0.09)'}`, background: d.canBeClassTeacher ? 'rgba(37,99,235,0.04)' : '#fff', cursor: 'pointer' }}>
            <input type="checkbox" checked={d.canBeClassTeacher} style={{ marginTop: 2, flexShrink: 0, accentColor: '#2563eb' }}
              onChange={e => set({ canBeClassTeacher: e.target.checked })} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: d.canBeClassTeacher ? '#1e40af' : 'rgba(15,23,42,0.7)' }}>Can be Class Teacher</div>
              <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', marginTop: 2 }}>Eligible to be assigned as the primary class teacher for a section.</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 9, border: `1px solid ${d.canTakeSubstitution ? 'rgba(8,145,178,0.25)' : 'rgba(15,23,42,0.09)'}`, background: d.canTakeSubstitution ? 'rgba(8,145,178,0.04)' : '#fff', cursor: 'pointer' }}>
            <input type="checkbox" checked={d.canTakeSubstitution} style={{ marginTop: 2, flexShrink: 0, accentColor: '#0891b2' }}
              onChange={e => set({ canTakeSubstitution: e.target.checked })} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: d.canTakeSubstitution ? '#0e7490' : 'rgba(15,23,42,0.7)' }}>Can Take Substitutions</div>
              <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', marginTop: 2 }}>Available for smart substitution when another teacher is absent.</div>
            </div>
          </label>
        </div>
      </div>

      {/* ── Preferred & Restricted Classes ─────────────────────── */}
      {classGroups.length > 0 && (
        <div>
          <SectionTitle>Preferred Classes</SectionTitle>
          <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', margin: '0 0 8px' }}>Soft preference — helps timetable auto-assign.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 100, overflowY: 'auto', padding: 6, background: 'rgba(15,23,42,0.02)', borderRadius: 8, border: '1px solid rgba(15,23,42,0.08)' }}>
            {classGroups.map(cg => {
              const label = cg.name ?? cg.code ?? String(cg.id);
              const on = d.preferredClassGroupIds.includes(cg.id);
              return (
                <button key={cg.id} type="button" onClick={() => togglePref(cg.id)}
                  style={{ padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: on ? '1.5px solid #0891b2' : '1px solid rgba(15,23,42,0.13)',
                    background: on ? 'rgba(8,145,178,0.1)' : '#fff', color: on ? '#0e7490' : '#475569' }}>
                  {label}
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', margin: '10px 0 8px' }}>Restricted classes — hard block, never assigned to these.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 100, overflowY: 'auto', padding: 6, background: 'rgba(15,23,42,0.02)', borderRadius: 8, border: `1px solid ${d.restrictedClassGroupIds.length > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(15,23,42,0.08)'}` }}>
            {classGroups.map(cg => {
              const label = cg.name ?? cg.code ?? String(cg.id);
              const on = d.restrictedClassGroupIds.includes(cg.id);
              return (
                <button key={cg.id} type="button" onClick={() => toggleRestr(cg.id)}
                  style={{ padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: on ? '1.5px solid #dc2626' : '1px solid rgba(15,23,42,0.13)',
                    background: on ? 'rgba(220,38,38,0.1)' : '#fff', color: on ? '#991b1b' : '#475569' }}>
                  {on ? '🚫 ' : ''}{label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Unavailable Periods (placeholder) ──────────────────── */}
      <div>
        <SectionTitle>Unavailable Periods
          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(15,23,42,0.35)', textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>(coming soon)</span>
        </SectionTitle>
        <div style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 9 }}>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', marginBottom: 6 }}>
            Define day + period slots when this teacher is unavailable. The timetable scheduler will respect these in a future release.
          </div>
          <input style={{ ...inputSt, color: 'rgba(15,23,42,0.35)' }} disabled
            placeholder="e.g. Monday P1, Friday P5 — configurable after scheduler module launches" />
        </div>
      </div>

    </div>
  );
}

function StepContact({ d, set }: { d: WizardDraft; set: (p: Partial<WizardDraft>) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Row>
        <Field label="Email" hint={d.createLoginAccount ? 'Required for login account' : undefined}>
          <input style={inputSt} type="email" value={d.email} placeholder="e.g. priya@school.edu.in" onChange={e => set({ email: e.target.value })} />
        </Field>
      </Row>
      <Field label="Address">
        <textarea style={{ ...inputSt, minHeight: 64, resize: 'vertical' }} value={d.address} placeholder="Residential address" onChange={e => set({ address: e.target.value })} />
      </Field>
      <div style={{ borderTop: '1px solid rgba(15,23,42,0.07)', paddingTop: 14 }}>
        <SectionTitle>Emergency Contact</SectionTitle>
        <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
          <Row>
            <Field label="Contact Name">
              <input style={inputSt} value={d.emergencyContactName} placeholder="e.g. Rajesh Sharma" onChange={e => set({ emergencyContactName: e.target.value })} />
            </Field>
            <Field label="Relation">
              <input style={inputSt} value={d.emergencyContactRelation} placeholder="e.g. Spouse, Parent" onChange={e => set({ emergencyContactRelation: e.target.value })} />
            </Field>
          </Row>
          <Row>
            <Field label="Contact Phone">
              <input style={inputSt} value={d.emergencyContactPhone} placeholder="+91 9876543210" onChange={e => set({ emergencyContactPhone: e.target.value })} />
            </Field>
          </Row>
        </div>
      </div>
    </div>
  );
}

function StepQualifications({ d, set }: { d: WizardDraft; set: (p: Partial<WizardDraft>) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Field label="Academic Qualifications" hint="List degrees, certifications, specialisations">
        <textarea style={{ ...inputSt, minHeight: 100, resize: 'vertical' }} value={d.qualifications}
          placeholder={"e.g.\nB.Ed. – IGNOU (2015)\nM.Sc. Physics – Delhi University (2013)\nCBSE TGT Certified"}
          onChange={e => set({ qualifications: e.target.value })} />
      </Field>
      <Field label="Work Experience" hint="Previous organisations & roles">
        <textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }} value={d.experience}
          placeholder={"e.g.\n2015–2019 – DPS Noida – Science Teacher\n2019–2022 – Sunrise Academy – Sr. Science Teacher"}
          onChange={e => set({ experience: e.target.value })} />
      </Field>
    </div>
  );
}

const DOC_LABELS: Record<string, string> = {
  'Offer Letter': 'Offer letter signed & returned',
  'ID Proof': 'Government ID proof (Aadhaar / Passport)',
  'Photo': 'Passport-size photographs',
  'Certificates': 'Academic / professional certificates',
  'PAN Card': 'PAN card copy',
  'Bank Details': 'Bank account details form',
};

function StepDocuments({ d, set }: { d: WizardDraft; set: (p: Partial<WizardDraft>) => void }) {
  const toggle = (key: string) => set({ docs: { ...d.docs, [key]: !d.docs[key] } });
  const checked = Object.values(d.docs).filter(Boolean).length;
  const total   = Object.keys(d.docs).length;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'rgba(15,23,42,0.5)' }}>
        Track which documents have been collected. <strong>{checked}/{total}</strong> collected.
      </p>
      {Object.entries(d.docs).map(([key, val]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${val ? 'rgba(22,163,74,0.3)' : 'rgba(15,23,42,0.09)'}`, background: val ? 'rgba(22,163,74,0.04)' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
          <input type="checkbox" checked={val} style={{ marginTop: 2, flexShrink: 0, accentColor: '#16a34a' }}
            onChange={() => toggle(key)} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: val ? '#166534' : 'rgba(15,23,42,0.75)' }}>{key}</div>
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', marginTop: 1 }}>{DOC_LABELS[key] ?? ''}</div>
          </div>
          {val && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
        </label>
      ))}
    </div>
  );
}

function StepPayroll({ d, set }: { d: WizardDraft; set: (p: Partial<WizardDraft>) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', padding: '8px 12px', background: 'rgba(234,179,8,0.08)', borderRadius: 8, border: '1px solid rgba(234,179,8,0.2)' }}>
        ℹ️ Payroll data is stored locally for your reference. Full payroll module with processing will be available in a future release.
      </div>
      <Row>
        <Field label="Bank Name">
          <input style={inputSt} value={d.bankName} placeholder="e.g. State Bank of India" onChange={e => set({ bankName: e.target.value })} />
        </Field>
        <Field label="Account Number">
          <input style={inputSt} value={d.bankAccount} placeholder="e.g. 1234567890" onChange={e => set({ bankAccount: e.target.value })} />
        </Field>
      </Row>
      <Row>
        <Field label="IFSC Code">
          <input style={inputSt} value={d.ifscCode} placeholder="e.g. SBIN0001234" onChange={e => set({ ifscCode: e.target.value })} />
        </Field>
        <Field label="PAN Number">
          <input style={inputSt} value={d.panNumber} placeholder="e.g. ABCDE1234F" onChange={e => set({ panNumber: e.target.value })} />
        </Field>
      </Row>
    </div>
  );
}

function ReviewRow({ label, value, missing }: { label: string; value?: string | null; missing?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(15,23,42,0.45)', minWidth: 130, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: missing ? '#dc2626' : 'rgba(15,23,42,0.8)', fontWeight: missing ? 700 : 500 }}>
        {value || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
      </div>
    </div>
  );
}

function StepReview({ d, subjects, onSaveDraft, onActivate, busy }: {
  d: WizardDraft; subjects: WizardSubject[];
  onSaveDraft: () => void; onActivate: () => void; busy: boolean;
}) {
  const draftMissing    = missingForDraft(d);
  const activateMissing = missingForActivate(d);
  const subjectNames = subjects.filter(s => d.teachableSubjectIds.includes(s.id)).map(s => s.code).join(', ');

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ padding: '14px 16px', background: 'rgba(15,23,42,0.02)', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(15,23,42,0.7)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Identity & Employment</div>
        <ReviewRow label="Full Name"        value={d.fullName} missing={!d.fullName} />
        <ReviewRow label="Phone"            value={d.phone}    missing={!d.phone} />
        <ReviewRow label="Email"            value={d.email} />
        <ReviewRow label="Employee No"      value={d.employeeNo} />
        <ReviewRow label="Staff Type"       value={d.staffType}        missing={!d.staffType} />
        <ReviewRow label="Designation"      value={d.designation}      missing={!d.designation} />
        <ReviewRow label="Department"       value={d.department} />
        <ReviewRow label="Employment Type"  value={d.employmentType} />
        <ReviewRow label="Joining Date"     value={d.joiningDate} />
      </div>

      <div style={{ padding: '14px 16px', background: 'rgba(15,23,42,0.02)', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(15,23,42,0.7)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Roles & Academic</div>
        <ReviewRow label="Roles"           value={d.roles.join(', ')}           missing={d.roles.length === 0} />
        <ReviewRow label="Login Account"   value={d.createLoginAccount ? 'Yes' : 'No'} />
        <ReviewRow label="Teachable Subj." value={subjectNames || undefined} />
        <ReviewRow label="Max Period Load" value={d.maxWeeklyLectureLoad !== '' ? String(d.maxWeeklyLectureLoad) + ' per week' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || draftMissing.length > 0} onClick={onSaveDraft}
          style={{ flex: '1 1 180px', padding: '11px 20px', borderRadius: 10, border: '1.5px solid rgba(15,23,42,0.2)', background: '#fff', fontSize: 14, fontWeight: 700, cursor: busy || draftMissing.length > 0 ? 'not-allowed' : 'pointer', color: draftMissing.length > 0 ? 'rgba(15,23,42,0.3)' : 'rgba(15,23,42,0.75)', transition: 'all 0.15s' }}>
          {busy ? 'Saving…' : 'Save as Draft'}
        </button>
        <button type="button" disabled={busy || activateMissing.length > 0} onClick={onActivate}
          style={{ flex: '2 1 200px', padding: '11px 20px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 800, cursor: busy || activateMissing.length > 0 ? 'not-allowed' : 'pointer', background: activateMissing.length > 0 ? 'rgba(37,99,235,0.3)' : '#2563eb', color: '#fff', transition: 'all 0.15s' }}>
          {busy ? 'Activating…' : '🚀 Activate Staff'}
        </button>
      </div>

      {draftMissing.length > 0 && (
        <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
          To save draft, complete: {draftMissing.join(', ')}
        </div>
      )}
      {draftMissing.length === 0 && activateMissing.length > 0 && (
        <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
          To activate, also complete: {activateMissing.join(', ')}
        </div>
      )}
    </div>
  );
}

// ─── Right panel – Live Preview ────────────────────────────────────────────────

function LivePreview({ d, subjects }: { d: WizardDraft; subjects: WizardSubject[] }) {
  const name   = d.fullName.trim() || 'New Staff Member';
  const type   = d.staffType || 'TEACHING';
  const bg     = avatarColor(name);
  const ttElig = isTimetableEligible(d);
  const draftM = missingForDraft(d);
  const actM   = missingForActivate(d);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Avatar card */}
      <div style={{ padding: '18px 16px', background: '#fff', borderRadius: 14, border: '1px solid rgba(15,23,42,0.1)', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: bg, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 22 }}>
          {initials(name)}
        </div>
        <div style={{ fontWeight: 900, fontSize: 15, color: 'rgba(15,23,42,0.88)', lineHeight: 1.2 }}>{name}</div>
        {d.employeeNo && <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', fontWeight: 600, marginTop: 3 }}>{d.employeeNo}</div>}
        {d.designation && <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.55)', marginTop: 4 }}>{d.designation}</div>}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 5 }}>
          <span style={{ ...BASE_BADGE, background: typeBg(type), color: typeColor(type) }}>{STAFF_TYPES.find(t => t.value === type)?.label ?? type}</span>
          {d.department && <span style={{ ...BASE_BADGE, background: 'rgba(15,23,42,0.06)', color: '#475569' }}>{d.department}</span>}
        </div>
      </div>

      {/* Info rows */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.09)', overflow: 'hidden' }}>
        <PreviewRow icon="🔑" label="Roles">
          {d.roles.length === 0
            ? <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 700 }}>None selected</span>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {d.roles.map(r => <span key={r} style={{ ...BASE_BADGE, background: 'rgba(37,99,235,0.1)', color: '#1e40af' }}>{r}</span>)}
              </div>}
        </PreviewRow>
        <PreviewRow icon="🔐" label="Login">
          <span style={{ ...BASE_BADGE, ...(d.createLoginAccount ? { background: 'rgba(22,163,74,0.1)', color: '#166534' } : { background: 'rgba(15,23,42,0.06)', color: '#64748b' }) }}>
            {d.createLoginAccount ? 'Will be created' : 'No login'}
          </span>
        </PreviewRow>
        <PreviewRow icon="📅" label="Joining">
          <span style={{ fontSize: 12, color: d.joiningDate ? 'rgba(15,23,42,0.75)' : '#dc2626', fontWeight: 600 }}>
            {d.joiningDate ? new Date(d.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}
          </span>
        </PreviewRow>
        <PreviewRow icon="📚" label="Timetable">
          <span style={{ ...BASE_BADGE, ...(ttElig ? { background: 'rgba(22,163,74,0.1)', color: '#166534' } : { background: 'rgba(15,23,42,0.06)', color: '#64748b' }) }}>
            {ttElig ? `Eligible · ${d.teachableSubjectIds.length} subj.` : 'Not eligible'}
          </span>
        </PreviewRow>
      </div>

      {/* Checklist */}
      {(draftM.length > 0 || actM.length > 0) && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.09)', padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Missing items</div>
          {draftM.map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#dc2626', fontSize: 14 }}>○</span>
              <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{m}</span>
              <span style={{ fontSize: 10, color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>draft</span>
            </div>
          ))}
          {actM.filter(m => !draftM.includes(m)).map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#d97706', fontSize: 14 }}>○</span>
              <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>{m}</span>
              <span style={{ fontSize: 10, color: '#92400e', background: 'rgba(234,179,8,0.1)', padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>activate</span>
            </div>
          ))}
        </div>
      )}

      {draftM.length === 0 && actM.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(22,163,74,0.06)', borderRadius: 10, border: '1px solid rgba(22,163,74,0.2)' }}>
          <div style={{ fontSize: 16, marginBottom: 4 }}>✅</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>Ready to activate!</div>
        </div>
      )}
    </div>
  );
}

function PreviewRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ minWidth: 60, fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.4)', flexShrink: 0, marginTop: 2 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

/** Response shape from POST/PUT /api/v1/onboarding/staff/onboard */
interface StaffOnboardingResponse {
  staff: {
    id: number;
    fullName: string;
    timetableEligible: boolean;
    missingRequiredItems: string[];
    [key: string]: unknown;
  };
  warnings: string[];
  tempPassword: string | null;
}

interface StaffOnboardingWizardProps {
  onClose: () => void;
  /** Called with the newly-created staff ID after a successful save or activate. */
  onSuccess: (staffId: number) => void;
}

export function StaffOnboardingWizard({ onClose, onSuccess }: StaffOnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [draft, setDraftRaw] = useState<WizardDraft>(emptyDraft());
  const [busy, setBusy] = useState(false);

  const set = useCallback((partial: Partial<WizardDraft>) => setDraftRaw(p => ({ ...p, ...partial })), []);

  // Queries
  const subjectsQ = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () => (await api.get<{ content: WizardSubject[] }>('/api/subjects?size=1000&sort=name,asc')).data,
    staleTime: 60_000,
  });
  const classGroupsQ = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () => (await api.get<{ content: WizardClassGroup[] } | WizardClassGroup[]>('/api/class-groups?size=500')).data,
    staleTime: 60_000,
  });
  const demandQ = useQuery({
    queryKey: ['teacher-demand-summary'],
    queryFn: async () => {
      try {
        return (await api.get<DemandSummary>('/api/v1/onboarding/teacher-demand-summary')).data;
      } catch {
        return null; // demand context is best-effort; don't block wizard
      }
    },
    staleTime: 120_000,
    enabled: draft.roles.includes('TEACHER'),
  });

  const subjects: WizardSubject[] = useMemo(() => {
    const raw = subjectsQ.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return (raw as { content: WizardSubject[] }).content ?? [];
  }, [subjectsQ.data]);

  const classGroups: WizardClassGroup[] = useMemo(() => {
    const raw = classGroupsQ.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return (raw as { content: WizardClassGroup[] }).content ?? [];
  }, [classGroupsQ.data]);

  const demand: DemandSummary | null = demandQ.data ?? null;

  // Build API body — structured StaffOnboardingRequest
  function buildBody(status: 'DRAFT' | 'ACTIVE') {
    const isTeacher = draft.roles.includes('TEACHER');
    return {
      identity: {
        fullName: draft.fullName.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim() || null,
        employeeNo: draft.employeeNo.trim() || null,
      },
      employment: {
        staffType: draft.staffType || 'TEACHING',
        designation: draft.designation.trim(),
        department: draft.department.trim() || null,
        joiningDate: draft.joiningDate || null,
        employmentType: draft.employmentType || null,
        status,
      },
      rolesAndAccess: {
        roles: draft.roles,
        createLoginAccount: draft.createLoginAccount && !!draft.email.trim(),
      },
      academicCapabilities: isTeacher ? {
        teachableSubjectIds: draft.teachableSubjectIds,
        maxWeeklyLectureLoad: draft.maxWeeklyLectureLoad !== '' ? draft.maxWeeklyLectureLoad : null,
        maxDailyLectureLoad: draft.maxDailyLectureLoad !== '' ? draft.maxDailyLectureLoad : null,
        canBeClassTeacher: draft.canBeClassTeacher,
        canTakeSubstitution: draft.canTakeSubstitution,
        preferredClassGroupIds: draft.preferredClassGroupIds,
        restrictedClassGroupIds: draft.restrictedClassGroupIds,
        unavailablePeriodsJson: draft.unavailablePeriodsNote.trim() || null,
      } : null,
      contact: {
        currentAddressLine1: draft.address.trim() || null,
        emergencyContactName: draft.emergencyContactName.trim() || null,
        emergencyContactPhone: draft.emergencyContactPhone.trim() || null,
        emergencyContactRelation: draft.emergencyContactRelation.trim() || null,
      },
      qualification: {
        highestQualification: draft.qualifications.trim() || null,
        previousInstitution: draft.experience.trim() || null,
      },
      payrollSetup: (draft.bankName || draft.bankAccount || draft.ifscCode || draft.panNumber) ? {
        bankName: draft.bankName.trim() || null,
        bankAccountNumber: draft.bankAccount.trim() || null,
        ifsc: draft.ifscCode.trim() || null,
        panNumber: draft.panNumber.trim() || null,
      } : null,
    };
  }

  async function handleSaveDraft() {
    const missing = missingForDraft(draft);
    if (missing.length > 0) { toast.error('Missing fields', missing.join(', ')); return; }
    setBusy(true);
    try {
      const res = await api.post<StaffOnboardingResponse>('/api/v1/onboarding/staff/onboard', buildBody('DRAFT'));
      const result = res.data;
      if (result.warnings?.length) {
        toast.info('Saved with warnings', result.warnings.join(' · '));
      } else {
        toast.success('Draft saved', `${draft.fullName} added as draft.`);
      }
      onSuccess(result.staff.id);
    } catch (e) {
      toast.error('Could not save', formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate() {
    const missing = missingForActivate(draft);
    if (missing.length > 0) { toast.error('Missing fields', missing.join(', ')); return; }
    setBusy(true);
    try {
      const res = await api.post<StaffOnboardingResponse>('/api/v1/onboarding/staff/onboard', buildBody('ACTIVE'));
      const result = res.data;
      if (result.tempPassword) {
        toast.success('Login created', `Temp password: ${result.tempPassword} — copy it now, shown once.`);
      }
      if (result.warnings?.length) {
        toast.info('Activated with warnings', result.warnings.join(' · '));
      } else {
        toast.success('Staff activated!', `${draft.fullName} is now active.`);
      }
      onSuccess(result.staff.id);
    } catch (e) {
      toast.error('Could not activate', formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  // Step content
  function renderStepContent() {
    switch (step) {
      case 1: return <StepIdentity d={draft} set={set} />;
      case 2: return <StepEmployment d={draft} set={set} />;
      case 3: return <StepRolesAccess d={draft} set={set} />;
      case 4: return <StepAcademic d={draft} set={set} subjects={subjects} classGroups={classGroups} demand={demand} />;
      case 5: return <StepContact d={draft} set={set} />;
      case 6: return <StepQualifications d={draft} set={set} />;
      case 7: return <StepDocuments d={draft} set={set} />;
      case 8: return <StepPayroll d={draft} set={set} />;
      case 9: return <StepReview d={draft} subjects={subjects} onSaveDraft={handleSaveDraft} onActivate={handleActivate} busy={busy} />;
      default: return null;
    }
  }

  function stepStatus(s: number): 'complete' | 'active' | 'upcoming' {
    if (s < step) return 'complete';
    if (s === step) return 'active';
    return 'upcoming';
  }

  return (
    /* Backdrop */
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Drawer panel */}
      <div className="sow-drawer" style={{ width: '100%', maxWidth: 1100, background: '#f8fafc', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'hidden', boxShadow: '-8px 0 40px rgba(15,23,42,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.1)', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: '-0.02em', color: 'rgba(15,23,42,0.9)' }}>Staff Onboarding</div>
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', fontWeight: 600, marginTop: 2 }}>
              Step {step} of {STEPS.length} — {STEPS[step - 1].label}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {canSaveDraft(draft) && step < 9 && (
              <button type="button" disabled={busy} onClick={handleSaveDraft}
                style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.18)', background: '#fff', color: 'rgba(15,23,42,0.65)', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                Save draft
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ width: 32, height: 32, border: 'none', background: 'rgba(15,23,42,0.08)', borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(15,23,42,0.6)' }}>
              ×
            </button>
          </div>
        </div>

        {/* Mobile step pill nav (visible only on narrow screens via CSS) */}
        <div className="sow-mobile-step-nav">
          {STEPS.map((s) => {
            const status = stepStatus(s.id);
            return (
              <button key={s.id} type="button" onClick={() => setStep(s.id)}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: status === 'active' ? '1.5px solid #2563eb' : '1px solid rgba(15,23,42,0.15)',
                  background: status === 'active' ? '#2563eb' : status === 'complete' ? 'rgba(22,163,74,0.1)' : '#fff',
                  color: status === 'active' ? '#fff' : status === 'complete' ? '#166534' : 'rgba(15,23,42,0.55)' }}>
                {status === 'complete' ? '✓ ' : ''}{s.label}
              </button>
            );
          })}
        </div>

        {/* Body – 3 columns (responsive via CSS classes) */}
        <div className="sow-body" style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 280px', overflow: 'hidden', minHeight: 0 }}>

          {/* Left stepper */}
          <div className="sow-stepper-col" style={{ overflowY: 'auto', padding: '20px 0', background: '#fff', borderRight: '1px solid rgba(15,23,42,0.08)' }}>
            {STEPS.map((s, idx) => {
              const status = stepStatus(s.id);
              return (
                <button key={s.id} type="button" onClick={() => setStep(s.id)}
                  style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: status === 'active' ? 'rgba(37,99,235,0.08)' : 'none', cursor: 'pointer', textAlign: 'left', position: 'relative', borderLeft: status === 'active' ? '3px solid #2563eb' : '3px solid transparent', transition: 'all 0.1s' }}>
                  {/* Step dot */}
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                    background: status === 'complete' ? '#16a34a' : status === 'active' ? '#2563eb' : 'rgba(15,23,42,0.08)',
                    color: status === 'upcoming' ? 'rgba(15,23,42,0.4)' : '#fff',
                    fontWeight: 800 }}>
                    {status === 'complete' ? '✓' : idx + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: status === 'active' ? 800 : 600, color: status === 'active' ? '#1d4ed8' : status === 'complete' ? '#166534' : 'rgba(15,23,42,0.55)', lineHeight: 1.2 }}>
                      {s.icon} {s.label}
                    </div>
                  </div>
                  {/* vertical connector */}
                  {idx < STEPS.length - 1 && (
                    <div style={{ position: 'absolute', left: 32, bottom: -10, width: 2, height: 10, background: status === 'complete' ? 'rgba(22,163,74,0.3)' : 'rgba(15,23,42,0.08)' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Center – active form */}
          <div className="sow-form-col" style={{ overflowY: 'auto', padding: '28px 32px' }}>
            <div style={{ maxWidth: 560 }}>
              {/* Step header */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{STEPS[step - 1].icon}</div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', color: 'rgba(15,23,42,0.9)' }}>{STEPS[step - 1].label}</h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(15,23,42,0.45)', fontWeight: 500 }}>
                  {[
                    'Basic identity information for the staff member.',
                    'Employment details and onboarding dates.',
                    'School roles determine access permissions. Login account lets staff use the portal.',
                    'Configure subjects and timetable preferences.',
                    'Contact information and emergency details.',
                    'Academic background and work experience.',
                    'Track onboarding document collection.',
                    'Bank and payroll information for HR records.',
                    'Review all details before creating the staff record.',
                  ][step - 1]}
                </p>
              </div>

              {renderStepContent()}

              {/* Navigation */}
              {step !== 9 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 16, borderTop: '1px solid rgba(15,23,42,0.07)' }}>
                  <button type="button" disabled={step === 1} onClick={() => setStep(s => s - 1)}
                    style={{ fontSize: 13, padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(15,23,42,0.15)', background: '#fff', color: step === 1 ? 'rgba(15,23,42,0.3)' : 'rgba(15,23,42,0.7)', fontWeight: 700, cursor: step === 1 ? 'not-allowed' : 'pointer' }}>
                    ← Back
                  </button>
                  <button type="button" onClick={() => setStep(s => Math.min(9, s + 1))}
                    style={{ fontSize: 13, padding: '8px 20px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                    {step === 8 ? 'Review →' : 'Next →'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right – Live preview */}
          <div className="sow-preview-col" style={{ overflowY: 'auto', padding: '20px 16px', background: 'rgba(248,250,252,0.9)', borderLeft: '1px solid rgba(15,23,42,0.08)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Live Preview</div>
            <LivePreview d={draft} subjects={subjects} />
          </div>
        </div>
      </div>
    </div>
  );
}



