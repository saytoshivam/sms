/**
 * Staff Profile Page — /app/teachers/:staffId
 *
 * Full profile view for a single staff member.
 * Data: GET /api/v1/onboarding/staff/{id}/profile
 *
 * Tabs: Overview · Employment · Academics · Timetable ·
 *       Documents · Access · Leave · Payroll · Activity Log
 */
import React, { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffProfile {
  // from StaffSummaryDTO
  id: number;
  employeeNo: string | null;
  fullName: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  staffType: string | null;       // TEACHING | NON_TEACHING | ADMIN | SUPPORT
  status: string | null;          // DRAFT | ACTIVE | INACTIVE | EXITED | SUSPENDED | ON_LEAVE
  employmentType: string | null;
  department: string | null;
  joiningDate: string | null;
  roles: string[];
  teachableSubjectCodes: string[];
  hasLoginAccount: boolean;
  maxWeeklyLectureLoad: number | null;
  maxDailyLectureLoad: number | null;
  canBeClassTeacher: boolean;
  canTakeSubstitution: boolean;
  preferredClassGroupIds: number[];
  restrictedClassGroupIds: number[];
  specialization: string | null;
  yearsOfExperience: number | null;
  loginStatus: string | null;     // NOT_CREATED | ACTIVE | DISABLED
  username: string | null;
  userId: number | null;
  lastInviteSentAt: string | null;
  timetableEligible: boolean;
  missingRequiredItems: string[];
  createdAt: string | null;
  updatedAt: string | null;

  // from StaffProfileDTO (extended)
  gender: string | null;
  dateOfBirth: string | null;
  alternatePhone: string | null;
  reportingManagerStaffId: number | null;
  currentAddressLine1: string | null;
  currentAddressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  highestQualification: string | null;
  professionalQualification: string | null;
  previousInstitution: string | null;

  // payroll (masked)
  salaryType: string | null;
  payrollEnabled: boolean;
  bankAccountHolderName: string | null;
  bankName: string | null;
  bankAccountNumberMasked: string | null;
  ifsc: string | null;
  panNumberMasked: string | null;

  // completeness
  profileCompleteness: {
    filledSections: number;
    totalSections: number;
    percentComplete: number;
    emptySections: string[];
  } | null;
}

interface Subject { id: number; code: string; name: string; type?: string | null }

interface AcademicStructure {
  allocations: {
    classGroupId: number;
    subjectId: number;
    weeklyFrequency: number;
    staffId: number | null;
    roomId: number | null;
  }[];
}

interface ClassGroup { id: number; code?: string | null; name?: string | null; grade?: number | null; section?: string | null }

// ─── Visual helpers ───────────────────────────────────────────────────────────

const B: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 999,
  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
};

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

function avatarColor(name: string): string {
  const c = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#9333ea','#0284c7'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

function statusColor(s: string | null) {
  switch (s) {
    case 'ACTIVE':    return { bg: 'rgba(22,163,74,0.1)',  color: '#166534' };
    case 'DRAFT':     return { bg: 'rgba(37,99,235,0.1)',  color: '#1e40af' };
    case 'INACTIVE':  return { bg: 'rgba(15,23,42,0.07)',  color: '#475569' };
    case 'EXITED':    return { bg: 'rgba(15,23,42,0.1)',   color: '#334155' };
    case 'ON_LEAVE':  return { bg: 'rgba(234,179,8,0.12)', color: '#92400e' };
    case 'SUSPENDED': return { bg: 'rgba(220,38,38,0.1)',  color: '#991b1b' };
    default:          return { bg: 'rgba(15,23,42,0.06)',  color: '#64748b' };
  }
}

function typeColor(t: string | null) {
  switch (t) {
    case 'TEACHING':     return { bg: 'rgba(37,99,235,0.1)',   color: '#1e40af' };
    case 'NON_TEACHING': return { bg: 'rgba(124,58,237,0.1)',  color: '#6d28d9' };
    case 'ADMIN':        return { bg: 'rgba(8,145,178,0.1)',   color: '#0e7490' };
    case 'SUPPORT':      return { bg: 'rgba(15,23,42,0.07)',   color: '#475569' };
    default:             return { bg: 'rgba(15,23,42,0.06)',   color: '#64748b' };
  }
}

function roleColor(r: string) {
  if (r === 'TEACHER' || r === 'CLASS_TEACHER') return { bg: 'rgba(37,99,235,0.1)', color: '#1e40af' };
  if (r === 'PRINCIPAL' || r === 'VICE_PRINCIPAL') return { bg: 'rgba(124,58,237,0.1)', color: '#6d28d9' };
  if (r === 'HOD') return { bg: 'rgba(8,145,178,0.1)', color: '#0e7490' };
  if (r === 'ACCOUNTANT') return { bg: 'rgba(5,150,105,0.1)', color: '#065f46' };
  return { bg: 'rgba(15,23,42,0.06)', color: '#475569' };
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtInstant(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(15,23,42,0.42)', minWidth: 160, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? 'rgba(15,23,42,0.82)' : 'rgba(15,23,42,0.28)', fontFamily: mono ? 'monospace' : undefined, letterSpacing: mono ? '0.03em' : undefined }}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function ModuleDisabledTab({ icon, name, reason }: { icon: string; name: string; reason?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.45 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: 'rgba(15,23,42,0.55)', marginBottom: 6 }}>{name}</div>
      <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.38)', maxWidth: 400, lineHeight: 1.6 }}>
        {reason ?? 'This section is not active for your school plan. Contact your administrator to enable it.'}
      </div>
    </div>
  );
}

// ─── Tabs definition ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview',     icon: '🏠' },
  { id: 'employment',  label: 'Employment',   icon: '💼' },
  { id: 'academics',   label: 'Academics',    icon: '📚' },
  { id: 'timetable',   label: 'Timetable',    icon: '🗓' },
  { id: 'documents',   label: 'Documents',    icon: '📄' },
  { id: 'access',      label: 'Access',       icon: '🔐' },
  { id: 'leave',       label: 'Leave',        icon: '🏖' },
  { id: 'payroll',     label: 'Payroll',      icon: '💰' },
  { id: 'activity',    label: 'Activity Log', icon: '📋' },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── More menu ────────────────────────────────────────────────────────────────

function MoreMenu({ staffId, profile, onResetLogin, onDeactivate, onMarkExited, onRefresh }: {
  staffId: number;
  profile: StaffProfile;
  onResetLogin: () => void;
  onDeactivate: () => void;
  onMarkExited: () => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const item = (label: string, icon: string, onClick: () => void, danger = false, disabled = false) => (
    <button type="button" disabled={disabled} onClick={() => { if (!disabled) { onClick(); setOpen(false); } }}
      style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: disabled ? 'rgba(15,23,42,0.3)' : danger ? '#dc2626' : 'rgba(15,23,42,0.75)', borderRadius: 8, transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(220,38,38,0.06)' : 'rgba(15,23,42,0.04)'; }}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
      <span style={{ fontSize: 14 }}>{icon}</span> {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(15,23,42,0.18)', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        More ⌄
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.12)', boxShadow: '0 8px 32px rgba(15,23,42,0.14)', zIndex: 200, minWidth: 200, padding: 6 }}>
          {item('Upload Document', '📎', () => toast.info('File Upload', 'Digital file upload requires the document storage module to be enabled by your administrator.'), false, true)}
          {item('Reset Login', '🔄', onResetLogin, false, !profile.hasLoginAccount)}
          <div style={{ height: 1, background: 'rgba(15,23,42,0.07)', margin: '4px 0' }} />
          {item('Deactivate', '⏸', onDeactivate, true, profile.status === 'INACTIVE')}
          {item('Mark Exited', '🚪', onMarkExited, true, profile.status === 'EXITED')}
          <div style={{ height: 1, background: 'rgba(15,23,42,0.07)', margin: '4px 0' }} />
          {item('View Timetable Grid', '🗓', () => navigate('/app/timetable/grid'))}
          {item('Staff Directory', '👥', () => navigate('/app/teachers'))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Overview ─────────────────────────────────────────────────────────────

function TabOverview({ profile }: { profile: StaffProfile }) {
  const tc = typeColor(profile.staffType);
  const sc = statusColor(profile.status);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Missing items alert */}
      {profile.missingRequiredItems && profile.missingRequiredItems.length > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>⚠ Profile incomplete</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {profile.missingRequiredItems.map(m => (
              <li key={m} style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, marginBottom: 2 }}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Profile completeness */}
      {profile.profileCompleteness && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid rgba(15,23,42,0.08)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Profile Completeness</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: profile.profileCompleteness.percentComplete >= 80 ? '#166534' : '#92400e' }}>
              {profile.profileCompleteness.percentComplete}%
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: profile.profileCompleteness.percentComplete >= 80 ? '#16a34a' : '#f59e0b', width: `${profile.profileCompleteness.percentComplete}%`, transition: 'width 0.4s' }} />
          </div>
          {profile.profileCompleteness.emptySections.length > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', marginTop: 6, fontWeight: 600 }}>
              Unfilled: {profile.profileCompleteness.emptySections.join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <SectionCard title="Identity">
          <InfoRow label="Full Name"   value={profile.fullName} />
          <InfoRow label="Employee No" value={profile.employeeNo} mono />
          <InfoRow label="Phone"       value={profile.phone} />
          <InfoRow label="Email"       value={profile.email} />
          <InfoRow label="Gender"      value={profile.gender} />
          <InfoRow label="Date of Birth" value={fmtDate(profile.dateOfBirth)} />
        </SectionCard>

        <SectionCard title="Employment Summary">
          <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ ...B, ...tc }}>{profile.staffType ?? '—'}</span>
            <span style={{ ...B, ...sc }}>{profile.status ?? '—'}</span>
          </div>
          <InfoRow label="Designation"      value={profile.designation} />
          <InfoRow label="Department"       value={profile.department} />
          <InfoRow label="Employment Type"  value={profile.employmentType} />
          <InfoRow label="Joining Date"     value={fmtDate(profile.joiningDate)} />
        </SectionCard>
      </div>

      <SectionCard title="Roles">
        {profile.roles.length === 0
          ? <span style={{ fontSize: 13, color: 'rgba(15,23,42,0.35)' }}>No roles assigned</span>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.roles.map(r => {
                const rc = roleColor(r);
                return <span key={r} style={{ ...B, ...rc }}>{r}</span>;
              })}
            </div>}
      </SectionCard>

      <SectionCard title="Timetable Eligibility">
        {profile.timetableEligible ? (
          <div>
            <span style={{ ...B, background: 'rgba(22,163,74,0.1)', color: '#166534' }}>✓ Timetable Eligible</span>
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', marginTop: 8 }}>
              This teacher has an active TEACHER role and at least one teachable subject, and can be assigned in the timetable.
            </div>
            {profile.teachableSubjectCodes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {profile.teachableSubjectCodes.map(c => (
                  <span key={c} style={{ ...B, background: 'rgba(5,150,105,0.09)', color: '#065f46' }}>{c}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <span style={{ ...B, background: 'rgba(15,23,42,0.07)', color: '#475569' }}>Not Eligible</span>
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', marginTop: 8 }}>
              Requires: TEACHER role + at least one teachable subject.
              {!profile.roles.includes('TEACHER') && <span style={{ color: '#b91c1c', display: 'block', marginTop: 4 }}>Missing: TEACHER role.</span>}
              {profile.teachableSubjectCodes.length === 0 && <span style={{ color: '#b91c1c', display: 'block', marginTop: 4 }}>Missing: Teachable subjects.</span>}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Tab: Employment ──────────────────────────────────────────────────────────

function TabEmployment({ profile }: { profile: StaffProfile }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SectionCard title="Job Details">
        <InfoRow label="Staff Type"        value={profile.staffType} />
        <InfoRow label="Designation"       value={profile.designation} />
        <InfoRow label="Department"        value={profile.department} />
        <InfoRow label="Employment Type"   value={profile.employmentType} />
        <InfoRow label="Joining Date"      value={fmtDate(profile.joiningDate)} />
        <InfoRow label="Status"            value={profile.status} />
        <InfoRow label="Reporting Manager" value={profile.reportingManagerStaffId ? `Staff #${profile.reportingManagerStaffId}` : null} />
      </SectionCard>

      <SectionCard title="Address">
        <InfoRow label="Address Line 1" value={profile.currentAddressLine1} />
        <InfoRow label="Address Line 2" value={profile.currentAddressLine2} />
        <InfoRow label="City"           value={profile.city} />
        <InfoRow label="State"          value={profile.state} />
        <InfoRow label="Pincode"        value={profile.pincode} mono />
      </SectionCard>

      <SectionCard title="Emergency Contact">
        <InfoRow label="Name"     value={profile.emergencyContactName} />
        <InfoRow label="Phone"    value={profile.emergencyContactPhone} />
        <InfoRow label="Relation" value={profile.emergencyContactRelation} />
      </SectionCard>

      <SectionCard title="Qualifications">
        <InfoRow label="Highest Qualification"     value={profile.highestQualification} />
        <InfoRow label="Professional Qualification" value={profile.professionalQualification} />
        <InfoRow label="Specialization"            value={profile.specialization} />
        <InfoRow label="Years of Experience"       value={profile.yearsOfExperience != null ? String(profile.yearsOfExperience) : null} />
        <InfoRow label="Previous Institution"      value={profile.previousInstitution} />
      </SectionCard>

      <div style={{ padding: '12px 16px', background: 'rgba(15,23,42,0.03)', borderRadius: 10, border: '1px solid rgba(15,23,42,0.07)' }}>
        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
          📋 HR status history and employment event log are available once the HR Events module is activated for your school.
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Academics ───────────────────────────────────────────────────────────

function TabAcademics({ profile, subjects, structure, classGroups }: {
  profile: StaffProfile;
  subjects: Subject[];
  structure: AcademicStructure | null;
  classGroups: ClassGroup[];
}) {
  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const cgMap = new Map(classGroups.map(cg => [cg.id, cg]));

  // Find allocations assigned to this staff
  const myAllocations = (structure?.allocations ?? []).filter(a => a.staffId === profile.id);

  // Group by class group
  const byClass = new Map<number, { subject: Subject | null; weeklyFrequency: number }[]>();
  for (const a of myAllocations) {
    const subj = subjectMap.get(a.subjectId) ?? null;
    const arr = byClass.get(a.classGroupId) ?? [];
    arr.push({ subject: subj, weeklyFrequency: a.weeklyFrequency });
    byClass.set(a.classGroupId, arr);
  }

  const totalAssigned = myAllocations.reduce((s, a) => s + a.weeklyFrequency, 0);

  function cgLabel(id: number): string {
    const cg = cgMap.get(id);
    if (!cg) return `Class #${id}`;
    if (cg.name) return cg.name;
    if (cg.grade != null) return `Grade ${cg.grade}${cg.section ? ` ${cg.section}` : ''}`;
    return cg.code ?? `#${cg.id}`;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SectionCard title="Teachable Subjects">
        {profile.teachableSubjectCodes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)' }}>
            No teachable subjects assigned.
            {profile.roles.includes('TEACHER') && (
              <span style={{ color: '#b91c1c', marginLeft: 6, fontWeight: 600 }}>Required for timetable eligibility.</span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {profile.teachableSubjectCodes.map(c => (
              <span key={c} style={{ ...B, background: 'rgba(5,150,105,0.1)', color: '#065f46', fontSize: 12 }}>{c}</span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Workload Capacity">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Max Weekly Periods', value: profile.maxWeeklyLectureLoad != null ? String(profile.maxWeeklyLectureLoad) : 'School default' },
            { label: 'Max Daily Periods',  value: profile.maxDailyLectureLoad != null ? String(profile.maxDailyLectureLoad) : 'No daily cap' },
            { label: 'Assigned (Academic Structure)', value: totalAssigned > 0 ? `${totalAssigned} p/wk` : 'None' },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.025)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(15,23,42,0.8)' }}>{value}</div>
            </div>
          ))}
        </div>
        {profile.maxWeeklyLectureLoad != null && totalAssigned > profile.maxWeeklyLectureLoad && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c', fontWeight: 700, padding: '6px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 7 }}>
            ⚠ Over weekly capacity: {totalAssigned} assigned vs. {profile.maxWeeklyLectureLoad} max.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Assignment Flags">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...B, ...(profile.canBeClassTeacher ? { background: 'rgba(37,99,235,0.1)', color: '#1e40af' } : { background: 'rgba(15,23,42,0.06)', color: '#94a3b8' }) }}>
            {profile.canBeClassTeacher ? '✓ Class Teacher Eligible' : '✗ Not Class Teacher Eligible'}
          </span>
          <span style={{ ...B, ...(profile.canTakeSubstitution ? { background: 'rgba(8,145,178,0.1)', color: '#0e7490' } : { background: 'rgba(15,23,42,0.06)', color: '#94a3b8' }) }}>
            {profile.canTakeSubstitution ? '✓ Substitution Eligible' : '✗ No Substitutions'}
          </span>
        </div>
      </SectionCard>

      {/* Assigned sections from academic structure */}
      <SectionCard title="Assigned in Academic Structure">
        {myAllocations.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)' }}>Not assigned to any class / subject in the current academic structure.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {Array.from(byClass.entries()).map(([cgId, entries]) => (
              <div key={cgId} style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.02)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: 'rgba(15,23,42,0.75)', marginBottom: 6 }}>{cgLabel(cgId)}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {entries.map((e, i) => (
                    <span key={i} style={{ ...B, background: 'rgba(5,150,105,0.09)', color: '#065f46', fontSize: 11 }}>
                      {e.subject?.code ?? '?'} — {e.weeklyFrequency}×/wk
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Preferred / Restricted */}
      {((profile.preferredClassGroupIds ?? []).length > 0 || (profile.restrictedClassGroupIds ?? []).length > 0) && (
        <SectionCard title="Class Preferences">
          {(profile.preferredClassGroupIds ?? []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0e7490', marginBottom: 5 }}>Preferred</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {(profile.preferredClassGroupIds ?? []).map(id => (
                  <span key={id} style={{ ...B, background: 'rgba(8,145,178,0.1)', color: '#0e7490' }}>{cgLabel(id)}</span>
                ))}
              </div>
            </div>
          )}
          {(profile.restrictedClassGroupIds ?? []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 5 }}>Restricted (hard block)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {(profile.restrictedClassGroupIds ?? []).map(id => (
                  <span key={id} style={{ ...B, background: 'rgba(220,38,38,0.1)', color: '#991b1b' }}>🚫 {cgLabel(id)}</span>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

// ─── Tab: Timetable ───────────────────────────────────────────────────────────

function TabTimetable({ profile }: { profile: StaffProfile }) {
  const navigate = useNavigate();

  if (!profile.hasLoginAccount) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🗓</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'rgba(15,23,42,0.6)', marginBottom: 6 }}>No login account linked</div>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)', maxWidth: 360, margin: '0 auto 16px' }}>
          A login account must be created and linked to this staff profile before their personal timetable can be shown here.
        </div>
        <button type="button" onClick={() => navigate(`?tab=access`)}
          style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Set up access →
        </button>
      </div>
    );
  }

  if (!profile.timetableEligible) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>📚</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'rgba(15,23,42,0.6)', marginBottom: 6 }}>Not timetable eligible</div>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)', maxWidth: 360, margin: '0 auto' }}>
          Staff needs the TEACHER role and at least one teachable subject before they appear in the published timetable.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ padding: '14px 18px', background: 'rgba(37,99,235,0.05)', borderRadius: 12, border: '1px solid rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 24 }}>🗓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#1e40af', marginBottom: 3 }}>Published Timetable</div>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)' }}>
            View the published timetable grid to see this teacher's assigned periods. Personal timetable is visible when logged in as this staff member.
          </div>
        </div>
        <button type="button" onClick={() => navigate('/app/timetable/grid')}
          style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
          Open Timetable Grid →
        </button>
      </div>

      <div style={{ padding: '12px 16px', background: 'rgba(15,23,42,0.02)', borderRadius: 10, border: '1px solid rgba(15,23,42,0.07)' }}>
        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.42)', fontWeight: 600 }}>
          📋 An embedded per-teacher weekly timetable view is available after the timetable is published. Open the Timetable Grid above to view and manage the full schedule.
        </div>
      </div>

      <SectionCard title="Timetable Assignment Summary">
        <InfoRow label="Timetable Eligible"  value="Yes" />
        <InfoRow label="Teachable Subjects"  value={profile.teachableSubjectCodes.join(', ') || '—'} />
        <InfoRow label="Max Weekly Load"     value={profile.maxWeeklyLectureLoad != null ? `${profile.maxWeeklyLectureLoad} periods/wk` : 'School default'} />
        <InfoRow label="Max Daily Load"      value={profile.maxDailyLectureLoad != null ? `${profile.maxDailyLectureLoad} periods/day` : 'No cap'} />
        <InfoRow label="Can Take Sub."       value={profile.canTakeSubstitution ? 'Yes' : 'No'} />
        <InfoRow label="Class Teacher Cap."  value={profile.canBeClassTeacher ? 'Yes' : 'No'} />
      </SectionCard>
    </div>
  );
}

// ─── Tab: Documents ───────────────────────────────────────────────────────────

interface StaffDoc {
  id: number;
  documentType: string;
  documentTypeName: string | null;
  fileId: number | null;
  originalFilename: string | null;
  fileSize: number | null;
  contentType: string | null;
  uploadedAt: string | null;
  collectionStatus: 'PENDING_COLLECTION' | 'COLLECTED_PHYSICAL' | 'NOT_REQUIRED';
  uploadStatus: 'NOT_UPLOADED' | 'UPLOADED';
  verificationStatus: 'NOT_VERIFIED' | 'VERIFIED' | 'REJECTED';
  verificationSource: 'PHYSICAL_ORIGINAL' | 'UPLOADED_COPY' | null;
  displayStatus: string;
  verifiedByStaffId: number | null;
  verifiedAt: string | null;
  remarks: string | null;
  createdAt: string | null;
}

function docDisplayLabel(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    VERIFIED:          { label: '✓ Verified',        bg: 'rgba(22,163,74,0.1)',   color: '#166534' },
    COLLECTED_PHYSICAL:{ label: '📥 Collected',       bg: 'rgba(37,99,235,0.1)',   color: '#1e40af' },
    UPLOADED:          { label: '📎 Uploaded',         bg: 'rgba(37,99,235,0.08)', color: '#1e40af' },
    REJECTED:          { label: '✗ Rejected',          bg: 'rgba(220,38,38,0.1)',  color: '#b91c1c' },
    NOT_REQUIRED:      { label: '— Not Required',      bg: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.4)' },
    PENDING_COLLECTION:{ label: '⏳ Pending',           bg: 'rgba(234,179,8,0.1)', color: '#92400e' },
  };
  const s = map[status] ?? map['PENDING_COLLECTION'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function DocMoreMenu({
  doc, staffId, onAction,
}: { doc: StaffDoc; staffId: number; onAction: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function doAction(path: string, body?: unknown) {
    try {
      await api.post(path, body ?? {});
      onAction();
      setOpen(false);
    } catch (e) {
      toast.error('Action failed', formatApiError(e));
      setOpen(false);
    }
  }

  const isPending    = doc.collectionStatus === 'PENDING_COLLECTION';
  const isCollected  = doc.collectionStatus === 'COLLECTED_PHYSICAL';
  const isNotReq     = doc.collectionStatus === 'NOT_REQUIRED';
  const isVerified   = doc.verificationStatus === 'VERIFIED';
  const isRejected   = doc.verificationStatus === 'REJECTED';

  const items = [
    !isCollected && !isNotReq && {
      label: '📥 Mark Collected',
      action: () => doAction(`/api/staff/${staffId}/documents/${doc.id}/collect`),
    },
    (isCollected || isNotReq) && !isPending && {
      label: '↩ Mark Pending',
      action: () => doAction(`/api/staff/${staffId}/documents/${doc.id}/collect`, { collectionStatus: 'PENDING_COLLECTION' }),
      // Actually use PATCH
      patchAction: true,
    },
    !isNotReq && {
      label: '— Mark Not Required',
      action: () => doAction(`/api/staff/${staffId}/documents/${doc.id}/mark-not-required`),
    },
    isNotReq && {
      label: '↩ Restore as Pending',
      action: async () => {
        try {
          await api.patch(`/api/staff/${staffId}/documents/${doc.id}`, { collectionStatus: 'PENDING_COLLECTION', uploadStatus: 'NOT_UPLOADED', verificationStatus: 'NOT_VERIFIED' });
          onAction();
          setOpen(false);
        } catch (e) { toast.error('Action failed', formatApiError(e)); setOpen(false); }
      },
    },
    (isVerified || isRejected) && {
      label: '↩ Reset Verification',
      action: async () => {
        try {
          await api.patch(`/api/staff/${staffId}/documents/${doc.id}`, { verificationStatus: 'NOT_VERIFIED' });
          onAction();
          setOpen(false);
        } catch (e) { toast.error('Action failed', formatApiError(e)); setOpen(false); }
      },
    },
  ].filter(Boolean) as { label: string; action: () => void }[];

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(15,23,42,0.13)', background: '#fff', cursor: 'pointer', fontSize: 13, color: 'rgba(15,23,42,0.5)' }}>
        ···
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 200, background: '#fff', borderRadius: 10, border: '1px solid rgba(15,23,42,0.1)', boxShadow: '0 8px 32px rgba(15,23,42,0.12)', minWidth: 190, padding: '6px 0' }}>
          {items.map((item, i) => (
            <button key={i} type="button" onClick={item.action}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(15,23,42,0.75)', fontWeight: 600 }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RejectDialog({ staffId, docId, onDone, onCancel }: { staffId: number; docId: number; onDone: () => void; onCancel: () => void }) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  async function doReject() {
    if (!remarks.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/staff/${staffId}/documents/${docId}/reject`, { remarks: remarks.trim() });
      onDone();
    } catch (e) {
      toast.error('Rejection failed', formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 440, width: '100%', margin: '0 16px' }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8, color: '#b91c1c' }}>Reject Document</div>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.55)', marginBottom: 14 }}>
          Remarks are required so HR knows the reason for rejection.
        </div>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Rejection reason…"
          rows={3}
          style={{ width: '100%', borderRadius: 8, border: '1.5px solid rgba(15,23,42,0.18)', padding: '10px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.18)', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" disabled={busy || !remarks.trim()} onClick={doReject}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy || !remarks.trim() ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocRow({ doc, staffId, onRefresh, isMobile }: { doc: StaffDoc; staffId: number; onRefresh: () => void; isMobile: boolean }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const label = doc.documentTypeName || docDisplayLabel(doc.documentType);
  const isPending    = doc.collectionStatus === 'PENDING_COLLECTION';
  const isCollected  = doc.collectionStatus === 'COLLECTED_PHYSICAL';
  const isNotReq     = doc.collectionStatus === 'NOT_REQUIRED';
  const isVerified   = doc.verificationStatus === 'VERIFIED';

  // Next best action
  let primaryLabel = '';
  let primaryAction: (() => void) | null = null;

  if (!isNotReq) {
    if (isPending) {
      primaryLabel = 'Mark Collected';
      primaryAction = async () => {
        setBusy(true);
        try { await api.post(`/api/staff/${staffId}/documents/${doc.id}/collect`); onRefresh(); }
        catch (e) { toast.error('Action failed', formatApiError(e)); }
        finally { setBusy(false); }
      };
    } else if (isCollected && !isVerified) {
      primaryLabel = 'Verify';
      primaryAction = async () => {
        setBusy(true);
        try { await api.post(`/api/staff/${staffId}/documents/${doc.id}/verify`); onRefresh(); }
        catch (e) { toast.error('Action failed', formatApiError(e)); }
        finally { setBusy(false); }
      };
    }
  }

  // Reject action (secondary, only when collected and not already verified/rejected)
  const showReject = isCollected && !isVerified && doc.verificationStatus !== 'REJECTED';

  if (isMobile) {
    return (
      <>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.09)', padding: '14px 16px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(15,23,42,0.85)' }}>{label}</div>
            <DocStatusBadge status={doc.displayStatus} />
          </div>
          {doc.remarks && (
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', fontStyle: 'italic' }}>"{doc.remarks}"</div>
          )}
          {doc.verificationSource && (
            <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
              Source: {doc.verificationSource === 'PHYSICAL_ORIGINAL' ? 'Physical Original' : 'Uploaded Copy'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {primaryAction && (
              <button type="button" disabled={busy} onClick={primaryAction}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {busy ? '…' : primaryLabel}
              </button>
            )}
            {showReject && (
              <button type="button" disabled={busy} onClick={() => setRejectOpen(true)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.05)', color: '#b91c1c', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Reject
              </button>
            )}
            <DocMoreMenu doc={doc} staffId={staffId} onAction={onRefresh} />
          </div>
        </div>
        {rejectOpen && <RejectDialog staffId={staffId} docId={doc.id} onDone={() => { setRejectOpen(false); onRefresh(); }} onCancel={() => setRejectOpen(false)} />}
      </>
    );
  }

  // Desktop row
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(15,23,42,0.82)' }}>{label}</div>
          {doc.remarks && <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.41)', marginTop: 2, fontStyle: 'italic' }}>"{doc.remarks}"</div>}
          {doc.verificationSource && (
            <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.38)', marginTop: 1, fontWeight: 600 }}>
              {doc.verificationSource === 'PHYSICAL_ORIGINAL' ? 'Physical original' : 'Uploaded copy'} verified
            </div>
          )}
        </div>
        <DocStatusBadge status={doc.displayStatus} />
        <div style={{ display: 'flex', gap: 6 }}>
          {primaryAction && (
            <button type="button" disabled={busy} onClick={primaryAction}
              style={{ padding: '6px 13px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {busy ? '…' : primaryLabel}
            </button>
          )}
          {showReject && (
            <button type="button" disabled={busy} onClick={() => setRejectOpen(true)}
              style={{ padding: '6px 13px', borderRadius: 7, border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.05)', color: '#b91c1c', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Reject
            </button>
          )}
        </div>
        <DocMoreMenu doc={doc} staffId={staffId} onAction={onRefresh} />
      </div>
      {rejectOpen && <RejectDialog staffId={staffId} docId={doc.id} onDone={() => { setRejectOpen(false); onRefresh(); }} onCancel={() => setRejectOpen(false)} />}
    </>
  );
}

function TabDocuments({ staffId }: { staffId: number }) {
  const qc = useQueryClient();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  React.useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 640); }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const docsQ = useQuery({
    queryKey: ['staff-documents', staffId],
    queryFn: async () => (await api.get<StaffDoc[]>(`/api/staff/${staffId}/documents`)).data,
    retry: 1,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['staff-documents', staffId] });
  }

  const docs = docsQ.data ?? [];
  const verified = docs.filter(d => d.verificationStatus === 'VERIFIED').length;
  const pending  = docs.filter(d => d.collectionStatus === 'PENDING_COLLECTION').length;
  const notReq   = docs.filter(d => d.collectionStatus === 'NOT_REQUIRED').length;

  if (docsQ.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'rgba(15,23,42,0.4)', fontSize: 13 }}>
        Loading documents…
      </div>
    );
  }

  if (docsQ.isError) {
    return (
      <div style={{ padding: 20, background: 'rgba(220,38,38,0.06)', borderRadius: 10, border: '1px solid rgba(220,38,38,0.15)', fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
        ⚠ Could not load document checklist. {formatApiError(docsQ.error)}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Summary header */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Verified',     count: verified, color: '#166534', bg: 'rgba(22,163,74,0.08)' },
          { label: 'Pending',      count: pending,  color: '#92400e', bg: 'rgba(234,179,8,0.08)' },
          { label: 'Not Required', count: notReq,   color: 'rgba(15,23,42,0.4)', bg: 'rgba(15,23,42,0.04)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '8px 16px', borderRadius: 10, background: s.bg, minWidth: 100 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(37,99,235,0.06)', minWidth: 100 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1e40af' }}>{docs.length}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', opacity: 0.8 }}>Total</div>
        </div>
      </div>

      {/* Note about upload */}
      <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.18)', borderRadius: 9, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
        ℹ️ Digital file upload is not enabled. Physical document collection and verification are fully operational and tracked below.
      </div>

      {/* Desktop table */}
      {!isMobile && docs.length > 0 && (
        <SectionCard title="Document Checklist">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.35)', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '0 0 8px', borderBottom: '1px solid rgba(15,23,42,0.08)', marginBottom: 2 }}>
            <span>DOCUMENT</span><span>STATUS</span><span>ACTIONS</span><span></span>
          </div>
          {docs.map(doc => (
            <DocRow key={doc.id} doc={doc} staffId={staffId} onRefresh={refresh} isMobile={false} />
          ))}
        </SectionCard>
      )}

      {/* Mobile cards */}
      {isMobile && docs.length > 0 && (
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'rgba(15,23,42,0.6)', marginBottom: 10 }}>DOCUMENT CHECKLIST</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {docs.map(doc => (
              <DocRow key={doc.id} doc={doc} staffId={staffId} onRefresh={refresh} isMobile={true} />
            ))}
          </div>
        </div>
      )}

      {docs.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'rgba(15,23,42,0.4)', fontSize: 13 }}>
          No documents found.
        </div>
      )}
    </div>
  );
}

// ─── Tab: Access ──────────────────────────────────────────────────────────────

interface AccessResult {
  loginStatus: string;
  userId: number | null;
  username: string | null;
  email: string | null;
  roles: string[] | null;
  tempPassword: string | null;
  lastInviteSentAt: string | null;
  message: string | null;
  integrityWarning: string | null;
}

function LoginStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    ACTIVE:      { label: 'Active',       bg: 'rgba(22,163,74,0.1)',  color: '#166534', icon: '🔓' },
    DISABLED:    { label: 'Disabled',     bg: 'rgba(220,38,38,0.1)', color: '#b91c1c', icon: '🚫' },
    NOT_CREATED: { label: 'Not Created',  bg: 'rgba(15,23,42,0.07)', color: '#475569', icon: '🔒' },
  };
  const s = map[status ?? 'NOT_CREATED'] ?? map['NOT_CREATED'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700,
      padding: '4px 14px', borderRadius: 999, background: s.bg, color: s.color }}>
      {s.icon} {s.label}
    </span>
  );
}

function ActionRow({ title, desc, danger, children }: {
  title: string; desc: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 14px',
      background: danger ? 'rgba(220,38,38,0.03)' : 'rgba(15,23,42,0.02)',
      borderRadius: 9,
      border: `1px solid ${danger ? 'rgba(220,38,38,0.12)' : 'rgba(15,23,42,0.07)'}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: danger ? '#b91c1c' : 'rgba(15,23,42,0.82)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.44)', marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>{children}</div>
    </div>
  );
}

function Btn({ label, busy, disabled, onClick, variant = 'secondary' }: {
  label: string; busy?: boolean; disabled?: boolean; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger';
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: '#2563eb', color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: 'rgba(15,23,42,0.75)', border: '1px solid rgba(15,23,42,0.18)' },
    danger:    { background: 'rgba(220,38,38,0.07)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.2)' },
  };
  return (
    <button type="button" disabled={busy || disabled} onClick={onClick}
      style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: (busy || disabled) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.45 : 1, ...styles[variant] }}>
      {busy ? '…' : label}
    </button>
  );
}

function TempPwdBanner({ pwd, onDismiss }: { pwd: string; onDismiss: () => void }) {
  return (
    <div style={{ padding: '14px 16px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 10, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#166534' }}>🔑 One-time temporary password — copy it now</div>
        <button type="button" onClick={onDismiss} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#166534', padding: 0 }}>✕</button>
      </div>
      <code style={{ fontSize: 20, fontWeight: 900, color: '#166534', letterSpacing: '0.12em', userSelect: 'all' }}>{pwd}</code>
      <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>
        Share this with the staff member. It will NOT be shown again — store it safely.
      </div>
    </div>
  );
}

function LinkUserModal({ staffId, onDone, onCancel }: { staffId: number; onDone: (r: AccessResult) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doLink() {
    if (!email.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await api.post<AccessResult>(`/api/staff/${staffId}/link-user`, { email: email.trim() });
      onDone(res.data);
    } catch (e) { setErr(formatApiError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 440, width: '100%', margin: '0 16px' }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>Link Existing User</div>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.5)', marginBottom: 16 }}>
          Enter the email of an existing system user to link them to this staff profile. No new account will be created.
        </div>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@school.edu"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(15,23,42,0.18)', fontSize: 13, boxSizing: 'border-box' }} />
        {err && <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.18)', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={busy || !email.trim()} onClick={doLink}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy || !email.trim() ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Linking…' : 'Link User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, confirm, danger, onConfirm, onCancel }: {
  title: string; body: string; confirm: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 420, width: '100%', margin: '0 16px' }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8, color: danger ? '#b91c1c' : undefined }}>{title}</div>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.55)', marginBottom: 20 }}>{body}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.18)', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={onConfirm}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: danger ? '#dc2626' : '#2563eb', color: '#fff' }}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabAccess({ profile, staffId, onRefresh }: { profile: StaffProfile; staffId: number; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'reset' | 'disable' | 'enable'>(null);

  const loginStatus  = profile.loginStatus ?? 'NOT_CREATED';
  const hasLogin     = loginStatus !== 'NOT_CREATED';
  const isActive     = loginStatus === 'ACTIVE';
  const isDisabled   = loginStatus === 'DISABLED';

  const hasTeacherRole = profile.roles.includes('TEACHER') || profile.roles.includes('CLASS_TEACHER');
  const teacherNoLogin = hasTeacherRole && !hasLogin;
  const teacherDisabled = hasTeacherRole && isDisabled;

  function refresh() { qc.invalidateQueries({ queryKey: ['staff-profile', staffId] }); onRefresh(); }

  async function doAction(path: string, successMsg: string) {
    setBusy(true); setTempPwd(null);
    try {
      const res = await api.post<AccessResult>(path);
      if (res.data.tempPassword) setTempPwd(res.data.tempPassword);
      toast.success('Done', successMsg + (res.data.message ? ' ' + res.data.message : ''));
      refresh();
    } catch (e) { toast.error('Action failed', formatApiError(e)); }
    finally { setBusy(false); setConfirm(null); }
  }

  async function doCreateLogin() {
    if (!profile.email) { toast.error('Email required', 'Add an email address in the Employment tab first.'); return; }
    setBusy(true); setTempPwd(null);
    try {
      const res = await api.post<AccessResult>(`/api/staff/${staffId}/create-login`, { email: profile.email, roles: profile.roles });
      if (res.data.tempPassword) setTempPwd(res.data.tempPassword);
      toast.success('Login created', res.data.message ?? 'Portal access granted.');
      refresh();
    } catch (e) { toast.error('Could not create login', formatApiError(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Integrity warnings */}
      {teacherNoLogin && (
        <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 9, fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>
          ⚠ This staff member has the TEACHER role but no portal login — they cannot access the teacher dashboard until a login is created.
        </div>
      )}
      {teacherDisabled && (
        <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 9, fontSize: 12, color: '#92400e', fontWeight: 700 }}>
          ⚠ TEACHER role is assigned but the login is disabled — teacher dashboard access is blocked until the login is enabled.
        </div>
      )}

      {/* Status card */}
      <SectionCard title="Login Status">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <LoginStatusBadge status={loginStatus} />
          {profile.username && (
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(15,23,42,0.55)', fontWeight: 600 }}>
              @{profile.username}
            </span>
          )}
          {profile.email && (
            <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)' }}>{profile.email}</span>
          )}
        </div>
        {!profile.email && (
          <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
            ⚠ No email set. Add one in the Employment tab before creating a login.
          </div>
        )}
        {profile.lastInviteSentAt && (
          <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
            📨 Invite last recorded: {new Date(profile.lastInviteSentAt).toLocaleString()}
          </div>
        )}
        {profile.userId && (
          <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.35)', marginTop: 4, fontWeight: 600 }}>
            User ID #{profile.userId} · Roles: {profile.roles.join(', ') || '—'}
          </div>
        )}
      </SectionCard>

      {/* Temp password (shown once) */}
      {tempPwd && <TempPwdBanner pwd={tempPwd} onDismiss={() => setTempPwd(null)} />}

      {/* Actions */}
      <SectionCard title="Actions">
        <div style={{ display: 'grid', gap: 10 }}>

          {/* Create login (when no login exists) */}
          {!hasLogin && (
            <ActionRow
              title="Create Portal Login"
              desc={profile.email
                ? `Creates a login for ${profile.email} with the staff member's current roles.`
                : 'Email address required — add one in the Employment tab.'}
            >
              <Btn label="Create Login" busy={busy} disabled={!profile.email} onClick={doCreateLogin} variant="primary" />
            </ActionRow>
          )}

          {/* Link existing user */}
          {!hasLogin && (
            <ActionRow
              title="Link Existing User"
              desc="If this person already has a system account (e.g., from a previous role), link it instead of creating a duplicate."
            >
              <Btn label="Link User" busy={busy} onClick={() => setLinkOpen(true)} />
            </ActionRow>
          )}

          {/* Enable/Disable login */}
          {hasLogin && isActive && (
            <ActionRow
              title="Disable Login"
              desc="Revoke portal access immediately. The account and data are preserved — re-enable at any time."
              danger
            >
              <Btn label="Disable" busy={busy} onClick={() => setConfirm('disable')} variant="danger" />
            </ActionRow>
          )}
          {hasLogin && isDisabled && (
            <ActionRow
              title="Enable Login"
              desc="Restore portal access for this staff member."
            >
              <Btn label="Enable" busy={busy} onClick={() => setConfirm('enable')} variant="primary" />
            </ActionRow>
          )}

          {/* Reset password (active logins only) */}
          {hasLogin && isActive && (
            <ActionRow
              title="Reset Password"
              desc="Generate a new temporary password and invalidate the current one. The temp password is shown once."
            >
              <Btn label="Reset Password" busy={busy} onClick={() => setConfirm('reset')} />
            </ActionRow>
          )}

          {/* Send invite */}
          {hasLogin && isActive && (
            <ActionRow
              title="Send Invite"
              desc="Record that an invite notification was dispatched. Email delivery requires the communications module to be enabled for your school."
            >
              <Btn label="Record Invite" busy={busy} onClick={() => doAction(`/api/staff/${staffId}/send-invite`, 'Invite recorded.')} />
            </ActionRow>
          )}

          {/* Update roles (always visible when login exists) */}
          {hasLogin && (
            <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.02)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)', fontSize: 12, color: 'rgba(15,23,42,0.45)', fontWeight: 600 }}>
              💡 To change roles, use the Wizard — Edit Profile → Roles &amp; Access step.
            </div>
          )}
        </div>
      </SectionCard>

      {/* Confirm modals */}
      {confirm === 'reset' && (
        <ConfirmModal
          title="Reset Login Password?"
          body="A new temporary password will be generated and shown once. The current password stops working immediately."
          confirm="Reset Password"
          onConfirm={() => doAction(`/api/staff/${staffId}/reset-password`, 'Password reset.')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'disable' && (
        <ConfirmModal
          title="Disable Login?"
          body="The staff member will be unable to log in immediately. You can re-enable at any time without creating a new account."
          confirm="Disable Login"
          danger
          onConfirm={() => doAction(`/api/staff/${staffId}/disable-login`, 'Login disabled.')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'enable' && (
        <ConfirmModal
          title="Enable Login?"
          body="The staff member will be able to log in again with their current password."
          confirm="Enable Login"
          onConfirm={() => doAction(`/api/staff/${staffId}/enable-login`, 'Login enabled.')}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Link user modal */}
      {linkOpen && (
        <LinkUserModal
          staffId={staffId}
          onDone={(r) => {
            setLinkOpen(false);
            toast.success('Linked', r.message ?? 'User linked successfully.');
            if (r.tempPassword) setTempPwd(r.tempPassword);
            refresh();
          }}
          onCancel={() => setLinkOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Tab: Activity Log ────────────────────────────────────────────────────────

function TabActivity({ profile }: { profile: StaffProfile }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SectionCard title="Record Timeline">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: 'Last updated',   value: fmtInstant(profile.updatedAt), icon: '✏️' },
            { label: 'Record created', value: fmtInstant(profile.createdAt), icon: '🎉' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(15,23,42,0.6)' }}>{label}</div>
                <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.75)', fontWeight: 600 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ padding: '12px 16px', background: 'rgba(15,23,42,0.02)', borderRadius: 10, border: '1px solid rgba(15,23,42,0.07)' }}>
        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
          📋 Detailed HR event log — status transitions, role updates, login events, and document actions — is available once the audit module is activated for your school.
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StaffProfilePage() {
  const { staffId } = useParams<{ staffId: string }>();
  const id = parseInt(staffId ?? '', 10);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabId = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const [moreOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const profileQ = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: async () => (await api.get<StaffProfile>(`/api/v1/onboarding/staff/${id}/profile`)).data,
    enabled: !isNaN(id),
    retry: false,
  });

  const subjectsQ = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () => {
      const res = await api.get<{ content: Subject[] } | Subject[]>('/api/subjects?size=1000&sort=name,asc');
      const d = res.data;
      return Array.isArray(d) ? d : (d as { content: Subject[] }).content ?? [];
    },
    staleTime: 120_000,
  });

  const structureQ = useQuery({
    queryKey: ['academic-structure'],
    queryFn: async () => {
      const res = await api.get<AcademicStructure>('/api/v1/onboarding/academic-structure');
      return res.data;
    },
    staleTime: 60_000,
  });

  const classGroupsQ = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () => {
      const res = await api.get<{ content: ClassGroup[] } | ClassGroup[]>('/api/class-groups?size=500');
      const d = res.data;
      return Array.isArray(d) ? d : (d as { content: ClassGroup[] }).content ?? [];
    },
    staleTime: 120_000,
  });

  // ── Status mutations ─────────────────────────────────────────────────────────

  const statusMut = useMutation({
    mutationFn: async (newStatus: string) => {
      await api.put(`/api/v1/onboarding/staff/${id}/onboard`, {
        identity: { fullName: profile?.fullName ?? '', phone: profile?.phone ?? '' },
        employment: { staffType: profile?.staffType ?? 'TEACHING', designation: profile?.designation ?? '', status: newStatus },
        rolesAndAccess: { roles: profile?.roles ?? [] },
      });
    },
    onSuccess: (_d, vars) => {
      toast.success('Status updated', `Staff status changed to ${vars}.`);
      qc.invalidateQueries({ queryKey: ['staff-profile', id] });
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (e) => toast.error('Could not update status', formatApiError(e)),
  });

  const profile = profileQ.data;

  function setTab(t: TabId) {
    setSearchParams(p => { p.set('tab', t); return p; }, { replace: true });
  }

  function refreshProfile() {
    qc.invalidateQueries({ queryKey: ['staff-profile', id] });
    qc.invalidateQueries({ queryKey: ['staff'] });
  }

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (profileQ.isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'rgba(15,23,42,0.45)', fontSize: 14 }}>
        Loading staff profile…
      </div>
    );
  }

  if (profileQ.isError || !profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontWeight: 700, color: '#dc2626' }}>Staff record not found</div>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.45)' }}>
          {formatApiError(profileQ.error)}
        </div>
        <button type="button" onClick={() => navigate('/app/teachers')}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          ← Back to Staff Directory
        </button>
      </div>
    );
  }

  const sc  = statusColor(profile.status);
  const tc  = typeColor(profile.staffType);
  const bg  = avatarColor(profile.fullName);

  // ── Profile header ───────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 0 40px' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 0 16px', fontSize: 12, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
        <button type="button" onClick={() => navigate('/app/teachers')}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.5)', fontWeight: 700, fontSize: 12, padding: 0 }}>
          Staff & Teachers
        </button>
        <span>/</span>
        <span style={{ color: 'rgba(15,23,42,0.7)' }}>{profile.fullName}</span>
      </div>

      {/* ── Profile header card ──────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(15,23,42,0.1)', padding: '24px 28px', marginBottom: 20, boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>

          {/* Avatar */}
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 26, userSelect: 'none' }}>
            {initials(profile.fullName)}
          </div>

          {/* Main info */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 950, letterSpacing: '-0.025em', color: 'rgba(15,23,42,0.92)' }}>
                {profile.fullName}
              </h1>
              <span style={{ ...B, ...sc, fontSize: 12, marginTop: 4 }}>{profile.status ?? '—'}</span>
              {profile.timetableEligible && (
                <span style={{ ...B, background: 'rgba(22,163,74,0.1)', color: '#166534', fontSize: 11, marginTop: 4 }}>📚 TT Eligible</span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {profile.employeeNo && (
                <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.45)', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(15,23,42,0.05)', padding: '1px 8px', borderRadius: 6 }}>
                  {profile.employeeNo}
                </span>
              )}
              {profile.designation && (
                <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.55)', fontWeight: 600 }}>{profile.designation}</span>
              )}
              {profile.department && (
                <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)', fontWeight: 500 }}>· {profile.department}</span>
              )}
            </div>

            {/* Type + roles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              <span style={{ ...B, ...tc }}>{profile.staffType ?? 'STAFF'}</span>
              {profile.roles.map(r => {
                const rc = roleColor(r);
                return <span key={r} style={{ ...B, ...rc }}>{r}</span>;
              })}
            </div>

            {/* Contact */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'rgba(15,23,42,0.5)', fontWeight: 600 }}>
              {profile.phone && <span>📞 {profile.phone}</span>}
              {profile.email && <span>✉ {profile.email}</span>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', flexShrink: 0 }}>
            <button type="button" onClick={() => navigate(`/app/teachers?edit=${id}`)}
              style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ✏ Edit Profile
            </button>
            <button type="button" onClick={() => setTab('access')}
              style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid rgba(15,23,42,0.18)', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🔐 Manage Access
            </button>
            <MoreMenu
              staffId={id}
              profile={profile}
              onResetLogin={() => { setTab('access'); }}
              onDeactivate={() => statusMut.mutate('INACTIVE')}
              onMarkExited={() => statusMut.mutate('EXITED')}
              onRefresh={refreshProfile}
            />
          </div>
        </div>
      </div>

      {/* ── Tab nav ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.09)', marginBottom: 18, padding: '4px 6px' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} type="button" onClick={() => setTab(tab.id)}
              style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: active ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s',
                background: active ? 'rgba(37,99,235,0.1)' : 'transparent',
                color: active ? '#1d4ed8' : 'rgba(15,23,42,0.5)' }}>
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <div>
        {activeTab === 'overview'   && <TabOverview   profile={profile} />}
        {activeTab === 'employment' && <TabEmployment profile={profile} />}
        {activeTab === 'academics'  && (
          <TabAcademics
            profile={profile}
            subjects={subjectsQ.data ?? []}
            structure={structureQ.data ?? null}
            classGroups={classGroupsQ.data ?? []}
          />
        )}
        {activeTab === 'timetable'  && <TabTimetable  profile={profile} />}
        {activeTab === 'documents'  && <TabDocuments staffId={id} />}
        {activeTab === 'access'     && <TabAccess profile={profile} staffId={id} onRefresh={refreshProfile} />}
        {activeTab === 'leave'      && (
          <ModuleDisabledTab
            icon="🏖"
            name="Leave Management"
            reason="Leave management is not active for this school. Leave requests, balances, and approval workflows will be available once the HR Leave module is enabled by your administrator."
          />
        )}
        {activeTab === 'payroll'    && (
          profile.payrollEnabled ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <SectionCard title="Payroll Setup">
                <InfoRow label="Salary Type"       value={profile.salaryType} />
                <InfoRow label="Bank Name"          value={profile.bankName} />
                <InfoRow label="Account Holder"     value={profile.bankAccountHolderName} />
                <InfoRow label="Account No."        value={profile.bankAccountNumberMasked} mono />
                <InfoRow label="IFSC"               value={profile.ifsc} mono />
                <InfoRow label="PAN"                value={profile.panNumberMasked} mono />
              </SectionCard>
              <div style={{ padding: '12px 16px', background: 'rgba(234,179,8,0.08)', borderRadius: 10, border: '1px solid rgba(234,179,8,0.2)', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                ℹ️ Payroll processing — salary runs, deductions, and payslip generation — requires the Payroll module to be activated for your school. Contact your administrator to enable it.
              </div>
            </div>
          ) : (
            <ModuleDisabledTab
              icon="💰"
              name="Payroll"
              reason="Payroll is not configured for this staff member. Enable payroll in the Employment section and ensure the Payroll module is active for your school."
            />
          )
        )}
        {activeTab === 'activity'   && <TabActivity   profile={profile} />}
      </div>
    </div>
  );
}






