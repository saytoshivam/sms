/**
 * Staff Profile Page — /app/teachers/:staffId
 *
 * Full profile view for a single staff member.
 * Data: GET /api/staff/{id}
 *
 * Tabs: Overview · Employment · Academics · Timetable ·
 *       Documents · Access · Leave · Payroll · Activity Log
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TeacherWeeklyTimetableEmbed } from '../components/timetable/TeacherWeeklyTimetableEmbed';

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
  /** FK to file_objects.id — fetch via GET /api/files/{id}/content as blob */
  profilePhotoFileId: number | null;
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
  loginStatus: string | null;     // NOT_CREATED | ACTIVE | DISABLED  (INVITED not used)
  username: string | null;
  userId: number | null;
  lastInviteSentAt: string | null;
  timetableEligible: boolean;
  missingRequiredItems: string[];
  /**
   * True when status = ACTIVE but required activation fields are missing
   * (fullName, phone, staffType, designation, joiningDate, or no roles).
   * The UI should show a prominent "Status is inconsistent" warning.
   */
  activationInconsistent: boolean;
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

  // work details
  workLocation: string | null;

  // payroll (masked)
  salaryType: string | null;
  payrollEnabled: boolean;
  bankAccountHolderName: string | null;
  bankName: string | null;
  bankAccountNumberMasked: string | null;
  ifsc: string | null;
  panNumberMasked: string | null;

  // timetable scheduling constraints
  unavailablePeriods: { dayOfWeek: string; periodNumber: number }[] | null;
  timetableEligibilityReasons: string[] | null;

  // completeness
  profileCompleteness: {
    percentComplete: number;
    filledSections: number;
    totalSections: number;
    emptySections: string[];
    categories: {
      id: string;
      name: string;
      icon: string;
      weight: number;
      score: number;
      missing: string[];
    }[];
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

// ─── Staff Profile Avatar ─────────────────────────────────────────────────────

function StaffProfileAvatar({
  profile, size = 52, canEdit = false, onUpload,
}: {
  profile: StaffProfile; size?: number; canEdit?: boolean; onUpload?: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imgBroken, setImgBroken] = useState(false);

  // Fetch profile photo as an authenticated blob so the Authorization header is sent
  useEffect(() => {
    setSignedUrl(null);
    setImgBroken(false);
    if (!profile.profilePhotoFileId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    api.get(`/api/files/${profile.profilePhotoFileId}/content`, { responseType: 'blob' })
      .then(r => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(r.data as Blob);
        setSignedUrl(objectUrl);
      })
      .catch(() => { /* show initials fallback on error */ });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile.profilePhotoFileId]);

  const hasPhoto = !!signedUrl && !imgBroken;
  const bg = avatarColor(profile.fullName);
  const radius = size >= 64 ? 14 : '50%';

  const avatarStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0,
    border: '2px solid rgba(15,23,42,0.08)',
  };
  const fallbackStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, color: '#fff', fontWeight: 900,
    fontSize: Math.max(14, Math.round(size * 0.36)),
    border: '2px solid rgba(15,23,42,0.07)',
    userSelect: 'none',
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {hasPhoto
        ? <img src={signedUrl!} alt="" onError={() => setImgBroken(true)} style={avatarStyle} />
        : <div aria-hidden style={fallbackStyle}>{initials(profile.fullName)}</div>
      }
      {canEdit && onUpload && (
        <button
          type="button"
          onClick={onUpload}
          title="Change profile photo"
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(15,23,42,0.75)', border: '1.5px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{ fontSize: 11 }}>📷</span>
        </button>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {  return (
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

// ─── Tabs definition ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview',     icon: '' },
  { id: 'employment',  label: 'Employment',   icon: '' },
  { id: 'academics',   label: 'Academics',    icon: '' },
  { id: 'timetable',   label: 'Timetable',    icon: '' },
  { id: 'documents',   label: 'Documents',    icon: '' },
  { id: 'access',      label: 'Access',       icon: '' },
  { id: 'leave',       label: 'Leave',        icon: '' },
  { id: 'payroll',     label: 'Payroll',      icon: '' },
  { id: 'activity',    label: 'Activity Log', icon: '' },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── More menu ────────────────────────────────────────────────────────────────

function MoreMenu({ staffId: _staffId, profile, onResetLogin, onDeactivate, onMarkExited, onRefresh: _onRefresh, onDocuments, onDelete }: {
  staffId: number;
  profile: StaffProfile;
  onResetLogin: () => void;
  onDeactivate: () => void;
  onMarkExited: () => void;
  onRefresh: () => void;
  onDocuments?: () => void;
  onDelete: () => void;
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
          {item('Upload Document', '', () => onDocuments ? onDocuments() : undefined, false, !onDocuments)}
          {item('Reset Login', '', onResetLogin, false, !profile.hasLoginAccount)}
          <div style={{ height: 1, background: 'rgba(15,23,42,0.07)', margin: '4px 0' }} />
          {item('Deactivate', '⏸', onDeactivate, true, profile.status === 'INACTIVE')}
          {item('Mark Exited', '', onMarkExited, true, profile.status === 'EXITED')}
          <div style={{ height: 1, background: 'rgba(15,23,42,0.07)', margin: '4px 0' }} />
          {item('Delete Staff', '', onDelete, true)}
          <div style={{ height: 1, background: 'rgba(15,23,42,0.07)', margin: '4px 0' }} />
          {item('View Timetable Grid', '', () => navigate('/app/timetable/grid'))}
          {item('Staff Directory', '', () => navigate('/app/teachers'))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Overview ─────────────────────────────────────────────────────────────

// ─── Tab: Overview ──────────────────────────────────────────────────────────���──

function ReadinessGroup({
  title, icon, items, color, bg, border,
}: {
  title: string; icon: string; items: string[];
  color: string; bg: string; border: string;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ padding: '12px 14px', background: bg, border: `1px solid ${border}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: color + '22', color }}>{items.length}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 2 }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReadinessCard({
  icon, label, value, sub, ok, warn,
}: {
  icon: string; label: string; value: string; sub?: string;
  ok?: boolean; warn?: boolean;
}) {
  const color  = ok ? '#166534' : warn ? '#92400e' : '#475569';
  const bg     = ok ? 'rgba(22,163,74,0.07)' : warn ? 'rgba(234,179,8,0.07)' : 'rgba(15,23,42,0.04)';
  const border = ok ? 'rgba(22,163,74,0.2)' : warn ? 'rgba(234,179,8,0.2)' : 'rgba(15,23,42,0.1)';
  return (
    <div style={{ padding: '12px 14px', background: bg, border: `1px solid ${border}`, borderRadius: 10, flex: '1 1 140px', minWidth: 130 }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.45)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TabOverview({ profile }: { profile: StaffProfile }) {
  const tc = typeColor(profile.staffType);
  const sc = statusColor(profile.status);
  const navigate = useNavigate();

  // ── A. Readiness blockers ────────────────────────────────────────────────────

  // Activation blockers — what's needed to set status = ACTIVE
  const activationBlockers: string[] = [];
  if (!profile.fullName?.trim())     activationBlockers.push('Full name missing');
  if (!profile.phone?.trim())        activationBlockers.push('Phone number missing');
  if (!profile.staffType)            activationBlockers.push('Staff type not set');
  if (!profile.designation?.trim())  activationBlockers.push('Designation not set');
  if (!profile.joiningDate)          activationBlockers.push('Joining date not set');
  if ((profile.roles?.length ?? 0) === 0) activationBlockers.push('No roles assigned');

  // Timetable blockers — from backend computed field
  const timetableBlockers = (profile.timetableEligibilityReasons ?? [])
    .filter(r => r !== 'Staff not ACTIVE'); // shown separately as activation blocker

  // Portal blockers — what's needed for login
  const portalBlockers: string[] = [];
  if (!profile.email?.trim())         portalBlockers.push('Email address required to create a login');
  if (!profile.hasLoginAccount)       portalBlockers.push('Login account not created');
  else if (profile.loginStatus === 'DISABLED') portalBlockers.push('Login account is disabled');

  // Document blockers — from completeness categories
  const docCat = profile.profileCompleteness?.categories?.find(c => c.id === 'documents');
  const documentBlockers = (docCat?.missing ?? []).filter(m => !m.includes('no documents configured'));

  const allClear = activationBlockers.length === 0 && timetableBlockers.length === 0
                  && portalBlockers.length === 0 && documentBlockers.length === 0;

  // ── Login status display ─────────────────────────────────────────────────────
  const loginLabel =
    profile.loginStatus === 'ACTIVE'      ? 'Active'
  : profile.loginStatus === 'DISABLED'    ? 'Disabled'
  : profile.loginStatus === 'NOT_CREATED' ? 'Not created'
  : '—';
  const loginOk   = profile.loginStatus === 'ACTIVE';
  const loginWarn = profile.loginStatus === 'DISABLED';

  // ── Document progress ─────────────────────────────────────────────────────────
  const docsScore = docCat?.score ?? null;
  const docsMissing = docCat?.missing.find(m => m.match(/\d+ of \d+/));
  const docsLabel = docsScore === null ? '—'
    : docsScore >= 100 ? '✓ Complete'
    : `${docsScore}%`;

  // ── Weekly load ──────────────────────────────────────────────────────────────
  const weeklyLoadLabel = profile.maxWeeklyLectureLoad != null
    ? `${profile.maxWeeklyLectureLoad} /wk`
    : 'School default';

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* ── A. Readiness blockers ───────────────────────────────────────────── */}
      {allClear ? (
        <div style={{ padding: '12px 16px', background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>All readiness checks passed — profile is operational.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Readiness Blockers
          </div>
          <ReadinessGroup title="Activation Blockers"  icon="⚡" items={activationBlockers}  color="#b91c1c" bg="rgba(220,38,38,0.04)" border="rgba(220,38,38,0.18)" />
          <ReadinessGroup title="Timetable Blockers"   icon="" items={timetableBlockers}   color="#92400e" bg="rgba(234,179,8,0.05)"  border="rgba(234,179,8,0.2)"  />
          <ReadinessGroup title="Portal Blockers"      icon="" items={portalBlockers}       color="#1e40af" bg="rgba(37,99,235,0.04)"  border="rgba(37,99,235,0.18)" />
          <ReadinessGroup title="Document Blockers"    icon="" items={documentBlockers}     color="#0e7490" bg="rgba(8,145,178,0.04)"  border="rgba(8,145,178,0.18)" />
        </div>
      )}

      {/* ── B. Profile completeness ──────────────────────────────────────────── */}
      {profile.profileCompleteness && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Profile Completeness
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 8, width: 160, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999, transition: 'width 0.4s',
                  width: `${profile.profileCompleteness.percentComplete}%`,
                  background: profile.profileCompleteness.percentComplete >= 80
                    ? '#16a34a' : profile.profileCompleteness.percentComplete >= 50
                    ? '#f59e0b' : '#dc2626',
                }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: profile.profileCompleteness.percentComplete >= 80 ? '#166534' : profile.profileCompleteness.percentComplete >= 50 ? '#92400e' : '#b91c1c' }}>
                {profile.profileCompleteness.percentComplete}%
              </div>
            </div>
          </div>
          {(profile.profileCompleteness.categories ?? []).map(cat => (
            <div key={cat.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{cat.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(15,23,42,0.7)' }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.35)', fontWeight: 600 }}>({cat.weight}%)</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 20, background: cat.score >= 80 ? 'rgba(22,163,74,0.1)' : cat.score >= 50 ? 'rgba(234,179,8,0.1)' : 'rgba(220,38,38,0.08)', color: cat.score >= 80 ? '#166534' : cat.score >= 50 ? '#92400e' : '#b91c1c' }}>
                  {cat.score}%
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: 'rgba(15,23,42,0.06)', overflow: 'hidden', marginBottom: cat.missing.length > 0 ? 4 : 0 }}>
                <div style={{ height: '100%', borderRadius: 999, transition: 'width 0.4s', width: `${cat.score}%`, background: cat.score >= 80 ? '#16a34a' : cat.score >= 50 ? '#f59e0b' : '#ef4444' }} />
              </div>
              {cat.missing.length > 0 && (
                <div style={{ paddingLeft: 20 }}>
                  {cat.missing.map((m, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'rgba(15,23,42,0.5)', fontWeight: 600, lineHeight: 1.7 }}>· {m}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── E. Operational readiness cards ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <ReadinessCard
          icon={profile.timetableEligible ? '' : ''}
          label="Timetable"
          value={profile.timetableEligible ? '✓ Eligible' : '✗ Not Eligible'}
          sub={profile.timetableEligible ? `${profile.teachableSubjectCodes.length} subject${profile.teachableSubjectCodes.length !== 1 ? 's' : ''}` : (profile.timetableEligibilityReasons?.length ?? 0) + ' blocker(s)'}
          ok={profile.timetableEligible}
          warn={!profile.timetableEligible}
        />
        <ReadinessCard
          icon=""
          label="Login"
          value={loginLabel}
          sub={profile.username ? `@${profile.username}` : undefined}
          ok={loginOk}
          warn={loginWarn}
        />
        <ReadinessCard
          icon=""
          label="Documents"
          value={docsLabel}
          sub={docsMissing ?? undefined}
          ok={docsScore !== null && docsScore >= 100}
          warn={docsScore !== null && docsScore > 0 && docsScore < 100}
        />
        <ReadinessCard
          icon=""
          label="Subjects"
          value={profile.teachableSubjectCodes.length > 0 ? String(profile.teachableSubjectCodes.length) : 'None'}
          sub={profile.teachableSubjectCodes.slice(0, 3).join(', ') || (profile.staffType !== 'TEACHING' ? 'N/A' : 'Not assigned')}
          ok={profile.teachableSubjectCodes.length > 0}
          warn={profile.staffType === 'TEACHING' && profile.teachableSubjectCodes.length === 0}
        />
        <ReadinessCard
          icon="⚡"
          label="Weekly Load"
          value={weeklyLoadLabel}
          sub={profile.maxDailyLectureLoad != null ? `Max ${profile.maxDailyLectureLoad}/day` : undefined}
          ok={profile.maxWeeklyLectureLoad != null}
        />
      </div>

      {/* ── C. Identity summary ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <SectionCard title="Identity">
          <InfoRow label="Full Name"     value={profile.fullName} />
          <InfoRow label="Employee No"   value={profile.employeeNo} mono />
          <InfoRow label="Phone"         value={profile.phone} />
          <InfoRow label="Email"         value={profile.email} />
          <InfoRow label="Gender"        value={profile.gender} />
          <InfoRow label="Date of Birth" value={fmtDate(profile.dateOfBirth)} />
        </SectionCard>

        {/* ── D. Employment summary ─────────────────────────────────────────── */}
        <SectionCard title="Employment">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            <span style={{ ...B, ...tc }}>{profile.staffType ?? '—'}</span>
            <span style={{ ...B, ...sc }}>{profile.status ?? '—'}</span>
            {profile.roles.map(r => { const rc = roleColor(r); return <span key={r} style={{ ...B, ...rc }}>{r}</span>; })}
          </div>
          <InfoRow label="Designation"      value={profile.designation} />
          <InfoRow label="Department"       value={profile.department} />
          <InfoRow label="Employment Type"  value={profile.employmentType} />
          <InfoRow label="Joining Date"     value={fmtDate(profile.joiningDate)} />
          <InfoRow label="Reporting Mgr"    value={profile.reportingManagerStaffId ? `Staff #${profile.reportingManagerStaffId}` : null} />
        </SectionCard>
      </div>

      {/* Edit shortcut */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => navigate(`/app/teachers?edit=${profile.id}`)}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(37,99,235,0.25)', background: 'rgba(37,99,235,0.05)', color: '#1d4ed8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          ✏ Edit Profile
        </button>
      </div>

    </div>
  );
}

// ─── Tab: Employment ──────────────────────────────────────────────────────────

function TabEmployment({ profile }: { profile: StaffProfile }) {
  const tc = typeColor(profile.staffType);
  const sc = statusColor(profile.status);

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* ── Employment Record ────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', padding: '16px 18px', marginBottom: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Employment Record
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {profile.staffType && <span style={{ ...B, ...tc }}>{profile.staffType}</span>}
          {profile.status    && <span style={{ ...B, ...sc }}>{profile.status}</span>}
          {profile.roles.map(r => { const rc = roleColor(r); return <span key={r} style={{ ...B, ...rc }}>{r}</span>; })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0 }}>
          <div>
            <InfoRow label="Employee No"       value={profile.employeeNo} mono />
            <InfoRow label="Designation"       value={profile.designation} />
            <InfoRow label="Department"        value={profile.department} />
            <InfoRow label="Employment Type"   value={profile.employmentType} />
            <InfoRow label="Joining Date"      value={fmtDate(profile.joiningDate)} />
          </div>
          <div>
            <InfoRow label="Status"            value={profile.status} />
            <InfoRow label="Work Location"     value={profile.workLocation} />
            <InfoRow label="Reporting Manager" value={profile.reportingManagerStaffId ? `Staff #${profile.reportingManagerStaffId}` : null} />
            <InfoRow label="Max Weekly Load"   value={profile.maxWeeklyLectureLoad != null ? `${profile.maxWeeklyLectureLoad} periods/wk` : null} />
            <InfoRow label="Max Daily Load"    value={profile.maxDailyLectureLoad  != null ? `${profile.maxDailyLectureLoad} periods/day`   : null} />
          </div>
        </div>
      </div>

      {/* ── Contact ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <SectionCard title="Contact">
          <InfoRow label="Phone"           value={profile.phone} />
          <InfoRow label="Alternate Phone" value={profile.alternatePhone} />
          <InfoRow label="Email"           value={profile.email} />
          <InfoRow label="Address Line 1"  value={profile.currentAddressLine1} />
          <InfoRow label="Address Line 2"  value={profile.currentAddressLine2} />
          <InfoRow label="City"            value={profile.city} />
          <InfoRow label="State"           value={profile.state} />
          <InfoRow label="Pincode"         value={profile.pincode} mono />
        </SectionCard>

        <SectionCard title="Emergency Contact">
          <InfoRow label="Name"     value={profile.emergencyContactName} />
          <InfoRow label="Phone"    value={profile.emergencyContactPhone} />
          <InfoRow label="Relation" value={profile.emergencyContactRelation} />
        </SectionCard>
      </div>

      {/* ── Qualifications ───────────────────────────────────────────────────── */}
      <SectionCard title="Qualifications & Background">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0 }}>
          <div>
            <InfoRow label="Highest Qualification"      value={profile.highestQualification} />
            <InfoRow label="Professional Qualification" value={profile.professionalQualification} />
            <InfoRow label="Specialization"             value={profile.specialization} />
          </div>
          <div>
            <InfoRow label="Years of Experience"        value={profile.yearsOfExperience != null ? `${profile.yearsOfExperience} yr${profile.yearsOfExperience !== 1 ? 's' : ''}` : null} />
            <InfoRow label="Previous Institution"       value={profile.previousInstitution} />
          </div>
        </div>
      </SectionCard>

      {/* ── No audit log note ────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.02)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)' }}>
        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
           HR status history and employment event log are not enabled for this school.
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Academics ───────────────────────────────────────────────────────────

function subjectTypeColor(type: string | null | undefined): React.CSSProperties {
  switch (type) {
    case 'CORE':     return { background: 'rgba(37,99,235,0.1)',  color: '#1e40af' };
    case 'ELECTIVE': return { background: 'rgba(124,58,237,0.1)', color: '#6d28d9' };
    case 'OPTIONAL': return { background: 'rgba(8,145,178,0.1)',  color: '#0e7490' };
    case 'LAB':      return { background: 'rgba(5,150,105,0.1)',  color: '#065f46' };
    case 'ACTIVITY': return { background: 'rgba(234,179,8,0.1)',  color: '#92400e' };
    default:         return { background: 'rgba(15,23,42,0.06)',  color: '#475569' };
  }
}

function TabAcademics({ profile, subjects, structure, classGroups, onEditProfile }: {
  profile: StaffProfile;
  subjects: Subject[];
  structure: AcademicStructure | null;
  classGroups: ClassGroup[];
  onEditProfile?: () => void;
}) {
  // Defensive: ensure subjects / classGroups are always arrays even if cache is stale/corrupt
  const safeSubjects     = Array.isArray(subjects)    ? subjects    : [];
  const safeClassGroups  = Array.isArray(classGroups) ? classGroups : [];
  const safeRoles        = Array.isArray(profile.roles)               ? profile.roles               : [];
  const safeTeachCodes   = Array.isArray(profile.teachableSubjectCodes) ? profile.teachableSubjectCodes : [];
  const safePrefCGs      = Array.isArray(profile.preferredClassGroupIds)  ? profile.preferredClassGroupIds  : [];
  const safeRestCGs      = Array.isArray(profile.restrictedClassGroupIds) ? profile.restrictedClassGroupIds : [];

  const subjectMap    = new Map(safeSubjects.map(s => [s.id, s]));
  const subjectByCode = new Map(safeSubjects.map(s => [s.code, s]));
  const cgMap         = new Map(safeClassGroups.map(cg => [cg.id, cg]));

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
  const maxWeekly = profile.maxWeeklyLectureLoad;
  const remainingCapacity = maxWeekly != null ? maxWeekly - totalAssigned : null;

  function cgLabel(id: number): string {
    const cg = cgMap.get(id);
    if (!cg) return `Class #${id}`;
    if (cg.name) return cg.name;
    if (cg.grade != null) return `Grade ${cg.grade}${cg.section ? ` ${cg.section}` : ''}`;
    return cg.code ?? `#${cg.id}`;
  }

  const isTeacher = safeRoles.includes('TEACHER');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Edit shortcut banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 10, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.6)', fontWeight: 600 }}>
           This view is read-only. To assign subjects, set workload, or change timetable flags, use <strong>Edit Profile</strong>.
        </div>
        <button type="button" onClick={onEditProfile}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          ✏ Edit Academic Capabilities
        </button>
      </div>

      {/* ── A. Timetable Eligibility ─────────────────────────────────────────── */}
      <SectionCard title="Timetable Eligibility">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {profile.timetableEligible ? (
            <span style={{ ...B, background: 'rgba(22,163,74,0.12)', color: '#166534', fontSize: 13, padding: '4px 14px' }}>✓ Eligible</span>
          ) : (
            <span style={{ ...B, background: 'rgba(220,38,38,0.09)', color: '#b91c1c', fontSize: 13, padding: '4px 14px' }}>✗ Not Eligible</span>
          )}
        </div>
        {profile.timetableEligible ? (
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', lineHeight: 1.6 }}>
            This teacher has an active TEACHER role, at least one teachable subject, and a configured load capacity.
          </div>
        ) : (
          <div>
            {((profile.timetableEligibilityReasons ?? []).length > 0) ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(profile.timetableEligibilityReasons ?? []).map((r, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, marginBottom: 4 }}>{r}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                Eligibility check pending — save profile to refresh.
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── B. Staff Roles (from StaffRoleMapping) ───────────────────────────── */}
      <SectionCard title="Staff Roles">
        {safeRoles.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)' }}>
            No roles assigned. Assign at least one role to enable portal access and timetable scheduling.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {safeRoles.map(r => {
              const rc = roleColor(r);
              const label: Record<string, string> = {
                TEACHER: 'Teacher',
                CLASS_TEACHER: 'Class Teacher',
                HOD: 'Head of Department',
                PRINCIPAL: 'Principal',
                VICE_PRINCIPAL: 'Vice Principal',
                ACCOUNTANT: 'Accountant',
              };
              return (
                <span key={r} style={{ ...B, ...rc, fontSize: 12, padding: '4px 12px' }}>
                  {label[r] ?? r}
                </span>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── C. Teachable Subjects ────────────────────────────────────────────── */}
      <SectionCard title="Teachable Subjects">
        {safeTeachCodes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.4)' }}>
            No teachable subjects assigned.
            {isTeacher && (
              <span style={{ color: '#b91c1c', marginLeft: 6, fontWeight: 600 }}>Required for timetable eligibility.</span>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {safeTeachCodes.map(code => {
              const subj = subjectByCode.get(code);
              return (
                <div key={code}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(5,150,105,0.04)', borderRadius: 9, border: '1px solid rgba(5,150,105,0.12)', flexWrap: 'wrap' }}>
                  <span style={{ ...B, background: 'rgba(5,150,105,0.1)', color: '#065f46', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.04em', flexShrink: 0 }}>
                    {code}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(15,23,42,0.78)', flex: 1, minWidth: 100 }}>
                    {subj?.name ?? <span style={{ color: 'rgba(15,23,42,0.35)', fontStyle: 'italic' }}>Name not found</span>}
                  </span>
                  {subj?.type && (
                    <span style={{ ...B, ...subjectTypeColor(subj.type), fontSize: 11, flexShrink: 0 }}>
                      {subj.type}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── D. Workload ─────────────────────────────────────────────────────── */}
      <SectionCard title="Workload">
        {isTeacher && maxWeekly == null && (
          <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 10, padding: '6px 10px', background: 'rgba(234,179,8,0.08)', borderRadius: 7, border: '1px solid rgba(234,179,8,0.18)' }}>
            ⚠ Max weekly lecture load is not set. A school default is required when this is absent — without either, this teacher is not timetable eligible.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
          {/* Max weekly */}
          <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.025)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Max Weekly Periods</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(15,23,42,0.8)' }}>
              {maxWeekly != null ? maxWeekly : <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(15,23,42,0.4)' }}>Not set</span>}
            </div>
            {maxWeekly == null && (
              <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.35)', marginTop: 3 }}>School default applies</div>
            )}
          </div>
          {/* Max daily */}
          <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.025)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Max Daily Periods</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(15,23,42,0.8)' }}>
              {profile.maxDailyLectureLoad != null ? profile.maxDailyLectureLoad : <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(15,23,42,0.4)' }}>No cap</span>}
            </div>
          </div>
          {/* Assigned weekly load */}
          <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.025)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Assigned (This Week)</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: totalAssigned > 0 ? 'rgba(15,23,42,0.8)' : 'rgba(15,23,42,0.35)' }}>
              {totalAssigned > 0 ? `${totalAssigned} p/wk` : 'None'}
            </div>
          </div>
          {/* Remaining capacity */}
          <div style={{
            padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)',
            background: remainingCapacity != null
              ? remainingCapacity < 0 ? 'rgba(220,38,38,0.06)' : remainingCapacity === 0 ? 'rgba(234,179,8,0.06)' : 'rgba(22,163,74,0.06)'
              : 'rgba(15,23,42,0.025)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Remaining Capacity</div>
            <div style={{
              fontSize: 16, fontWeight: 900,
              color: remainingCapacity != null
                ? remainingCapacity < 0
                  ? '#b91c1c' : remainingCapacity === 0 ? '#92400e' : '#166534'
                : 'rgba(15,23,42,0.35)',
            }}>
              {remainingCapacity != null
                ? remainingCapacity < 0
                  ? `${remainingCapacity} (over)`
                  : `${remainingCapacity} p/wk free`
                : '—'}
            </div>
          </div>
        </div>
        {maxWeekly != null && totalAssigned > maxWeekly && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#b91c1c', fontWeight: 700, padding: '6px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 7 }}>
            ⚠ Over weekly capacity: {totalAssigned} assigned vs. {maxWeekly} max.
          </div>
        )}
      </SectionCard>

      {/* ── E. Teacher Capabilities ─────────────────────────────────────────── */}
      <SectionCard title="Teacher Capabilities">
        {/* canBeClassTeacher + canTakeSubstitution */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            borderRadius: 9, border: `1px solid ${profile.canBeClassTeacher ? 'rgba(37,99,235,0.2)' : 'rgba(15,23,42,0.08)'}`,
            background: profile.canBeClassTeacher ? 'rgba(37,99,235,0.05)' : 'rgba(15,23,42,0.025)',
            flex: '1 1 180px',
          }}>
            <span style={{ fontSize: 18 }}>{profile.canBeClassTeacher ? '✅' : '⬜'}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: profile.canBeClassTeacher ? '#1e40af' : 'rgba(15,23,42,0.45)' }}>
                {profile.canBeClassTeacher ? 'Class Teacher Eligible' : 'Not a Class Teacher'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', marginTop: 2 }}>canBeClassTeacher</div>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            borderRadius: 9, border: `1px solid ${profile.canTakeSubstitution ? 'rgba(8,145,178,0.2)' : 'rgba(15,23,42,0.08)'}`,
            background: profile.canTakeSubstitution ? 'rgba(8,145,178,0.05)' : 'rgba(15,23,42,0.025)',
            flex: '1 1 180px',
          }}>
            <span style={{ fontSize: 18 }}>{profile.canTakeSubstitution ? '✅' : '⬜'}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: profile.canTakeSubstitution ? '#0e7490' : 'rgba(15,23,42,0.45)' }}>
                {profile.canTakeSubstitution ? 'Substitution Available' : 'No Substitutions'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', marginTop: 2 }}>canTakeSubstitution</div>
            </div>
          </div>
        </div>

        {/* Preferred class groups */}
        <div style={{ marginBottom: safeRestCGs.length > 0 ? 12 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0e7490', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Preferred Class Groups
          </div>
          {safePrefCGs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.35)', fontStyle: 'italic' }}>None specified — scheduler treats all classes equally.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {safePrefCGs.map(id => (
                <span key={id} style={{ ...B, background: 'rgba(8,145,178,0.1)', color: '#0e7490', fontSize: 12 }}>⭐ {cgLabel(id)}</span>
              ))}
            </div>
          )}
        </div>

        {/* Restricted class groups */}
        {safeRestCGs.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Restricted Class Groups (Hard Block)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {safeRestCGs.map(id => (
                <span key={id} style={{ ...B, background: 'rgba(220,38,38,0.1)', color: '#991b1b', fontSize: 12 }}> {cgLabel(id)}</span>
              ))}
            </div>
          </div>
        )}
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
    </div>
  );
}

// ─── Tab: Timetable ───────────────────────────────────────────────────────────

function TabTimetable({ profile }: { profile: StaffProfile }) {
  const reasons = [
    ...(profile.timetableEligibilityReasons ?? []),
    ...(profile.missingRequiredItems ?? []),
  ].filter(Boolean);

  return (
    <TeacherWeeklyTimetableEmbed
      staffId={profile.id}
      timetableEligible={profile.timetableEligible}
      eligibilityReasons={reasons}
    />
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

/** School-configured document requirement (from /api/schools/document-requirements) */
interface SchoolDocReq {
  documentTypeId: number;
  documentTypeCode: string;
  documentTypeName: string;
  requirementStatus: 'REQUIRED' | 'OPTIONAL' | 'NOT_REQUIRED';
  active: boolean;
}

function docDisplayLabel(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    VERIFIED:          { label: '✓ Verified',        bg: 'rgba(22,163,74,0.1)',   color: '#166534' },
    COLLECTED_PHYSICAL:{ label: ' Collected',       bg: 'rgba(37,99,235,0.1)',   color: '#1e40af' },
    UPLOADED:          { label: ' Uploaded',         bg: 'rgba(37,99,235,0.08)', color: '#1e40af' },
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
  doc, staffId, onAction, onUpload, onReject, onEditRemark,
}: {
  doc: StaffDoc; staffId: number;
  onAction: (path: string, body?: unknown, isPatch?: boolean) => void;
  onUpload: () => void;
  onReject: () => void;
  onEditRemark: () => void;
}) {
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

  const coll      = doc.collectionStatus;
  const up        = doc.uploadStatus;
  const ver       = doc.verificationStatus;
  const hasFile   = !!doc.fileId;
  const isPending = coll === 'PENDING_COLLECTION';
  const isCollected = coll === 'COLLECTED_PHYSICAL';
  const isNotReq  = coll === 'NOT_REQUIRED';
  const isVerified = ver === 'VERIFIED';
  const isRejected = ver === 'REJECTED';
  const isUploaded = up === 'UPLOADED';
  const canV      = !isNotReq && ver === 'NOT_VERIFIED' && (isCollected || isUploaded);

  // Mirror student primary-type to avoid duplicating the primary action in this menu
  const primaryType: 'collect' | 'verifyPhysical' | 'verifyUploaded' | 'replace' | 'none' =
    isNotReq                                                        ? 'none'
    : isPending                                                     ? 'collect'
    : isCollected && !isUploaded && ver === 'NOT_VERIFIED'          ? 'verifyPhysical'
    : isUploaded  && ver === 'NOT_VERIFIED'                         ? 'verifyUploaded'
    : isRejected                                                    ? 'replace'
    : 'none';

  const close = () => setOpen(false);

  const items = ([
    { label: 'View / Open',          onClick: () => { close(); if (doc.fileId) window.open(`/api/files/${doc.fileId}/content`, '_blank'); }, show: hasFile },
    { label: 'Download',             onClick: async () => { close(); if (!doc.fileId) return; try { const r = await api.get(`/api/files/${doc.fileId}/content`, { responseType: 'blob', params: { download: true } }); const url = URL.createObjectURL(new Blob([r.data])); const a = document.createElement('a'); a.href = url; a.download = doc.originalFilename ?? 'document'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch { toast.error('Download failed'); } }, show: hasFile },
    { label: 'Upload file',          onClick: () => { close(); onUpload(); }, show: !isNotReq && !isUploaded && !isRejected },
    { label: 'Replace file',         onClick: () => { close(); onUpload(); }, show: hasFile && !isNotReq && primaryType !== 'replace' },
    { label: 'Verify from original', onClick: () => { close(); onAction(`/api/staff/${staffId}/documents/${doc.id}/verify`, { verificationSource: 'PHYSICAL_ORIGINAL' }); }, show: canV && isCollected && primaryType !== 'verifyPhysical' },
    { label: 'Verify from upload',   onClick: () => { close(); onAction(`/api/staff/${staffId}/documents/${doc.id}/verify`, { verificationSource: 'UPLOADED_COPY' }); }, show: canV && isUploaded && primaryType !== 'verifyUploaded' },
    { label: 'Reject',               onClick: () => { close(); onReject(); }, show: canV, danger: true },
    { label: 'Mark Pending',         onClick: () => { close(); onAction(`/api/staff/${staffId}/documents/${doc.id}`, { collectionStatus: 'PENDING_COLLECTION', uploadStatus: 'NOT_UPLOADED', verificationStatus: 'NOT_VERIFIED' }, true); }, show: (isCollected || isNotReq) },
    { label: 'Mark Not Required',    onClick: () => { close(); onAction(`/api/staff/${staffId}/documents/${doc.id}/mark-not-required`); }, show: !isNotReq },
    { label: (isVerified || isRejected) ? 'Reset Verification' : undefined, onClick: () => { close(); onAction(`/api/staff/${staffId}/documents/${doc.id}`, { verificationStatus: 'NOT_VERIFIED' }, true); }, show: isVerified || isRejected },
    { label: doc.remarks ? 'Edit Remark' : 'Add Remark', onClick: () => { close(); onEditRemark(); }, show: true },
  ] as { label?: string; onClick: () => void; show: boolean; danger?: boolean }[])
    .filter(i => i.show && i.label);

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(15,23,42,0.13)', background: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.5)', fontSize: 18, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        title="More actions">⋯</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 4, zIndex: 9999, background: '#fff', border: '1px solid rgba(15,23,42,0.11)', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.18)', minWidth: 190, padding: '4px 0' }}>
          {items.map((item, i) => (
            <button key={i} type="button" onClick={item.onClick}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: item.danger ? '#991b1b' : 'rgba(15,23,42,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.background = item.danger ? 'rgba(220,38,38,0.06)' : 'rgba(15,23,42,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >{item.label}</button>
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
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [editRemarkOpen, setEditRemarkOpen] = useState(false);
  const [editRemarkValue, setEditRemarkValue] = useState('');
  const [busy, setBusy]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const label    = doc.documentTypeName || docDisplayLabel(doc.documentType);
  const coll     = doc.collectionStatus;
  const up       = doc.uploadStatus;
  const ver      = doc.verificationStatus;
  const isPending    = coll === 'PENDING_COLLECTION';
  const isCollected  = coll === 'COLLECTED_PHYSICAL';
  const isNotReq     = coll === 'NOT_REQUIRED';
  const isVerified   = ver === 'VERIFIED';
  const isRejected   = ver === 'REJECTED';
  const isUploaded   = up  === 'UPLOADED';
  const hasFile      = !!doc.fileId;

  async function callAction(path: string, body?: unknown, isPatch = false) {
    setBusy(true); setRowError(null);
    try {
      if (isPatch) await api.patch(path, body ?? {});
      else         await api.post(path, body ?? {});
      onRefresh();
    } catch (e: any) {
      setRowError(e?.response?.data?.error ?? e?.message ?? 'Action failed.');
    } finally { setBusy(false); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setRowError('File must be < 10 MB.'); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
    if (!['application/pdf','image/jpeg','image/png'].includes(file.type)) { setRowError('Only PDF, JPG, PNG allowed.'); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
    setUploading(true); setRowError(null);
    try {
      const form = new FormData(); form.append('file', file);
      await api.post(`/api/staff/${staffId}/documents/${doc.id}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onRefresh(); toast.success('Uploaded', `${file.name} uploaded successfully.`);
    } catch (e: any) { setRowError(e?.response?.data?.error ?? e?.message ?? 'Upload failed.'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleDownload() {
    if (!doc.fileId) return;
    try {
      const resp = await api.get(`/api/files/${doc.fileId}/content`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setRowError('Could not load file.'); }
  }

  async function submitEditRemark() {
    setBusy(true); setRowError(null);
    try {
      await api.patch(`/api/staff/${staffId}/documents/${doc.id}`, { remarks: editRemarkValue.trim() || null });
      setEditRemarkOpen(false); setEditRemarkValue(''); onRefresh();
    } catch (e: any) { setRowError(e?.response?.data?.error ?? e?.message ?? 'Update failed.'); }
    finally { setBusy(false); }
  }

  // ── Primary action priority (mirrors student documents) ────────────────────
  // 1. PENDING_COLLECTION                            → Mark Collected
  // 2. COLLECTED_PHYSICAL + NOT_UPLOADED + NOT_VERIFIED → Verify Physical
  // 3. UPLOADED + NOT_VERIFIED                       → Verify (uploaded copy)
  // 4. REJECTED                                      → Replace File
  type PA = { label: string; isPrimary?: boolean; onClick: () => void } | null;
  let pa: PA = null;
  if (!isNotReq) {
    if (isPending)
      pa = { label: busy ? '…' : 'Mark Collected', isPrimary: true, onClick: () => callAction(`/api/staff/${staffId}/documents/${doc.id}/collect`) };
    else if (isCollected && !isUploaded && ver === 'NOT_VERIFIED')
      pa = { label: busy ? '…' : 'Verify Physical', isPrimary: true, onClick: () => callAction(`/api/staff/${staffId}/documents/${doc.id}/verify`, { verificationSource: 'PHYSICAL_ORIGINAL' }) };
    else if (isUploaded && ver === 'NOT_VERIFIED')
      pa = { label: busy ? '…' : 'Verify', isPrimary: true, onClick: () => callAction(`/api/staff/${staffId}/documents/${doc.id}/verify`, { verificationSource: 'UPLOADED_COPY' }) };
    else if (isRejected)
      pa = { label: uploading ? 'Uploading…' : '↑ Replace File', isPrimary: false, onClick: () => fileInputRef.current?.click() };
  }

  // Upload shown when doc can receive a file (not rejected = already replace, not verified if they can re-upload)
  const showUpload = !isNotReq && !isRejected && !(ver === 'VERIFIED' && isUploaded);

  if (isMobile) {
    return (
      <>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.09)', padding: '14px 16px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: isNotReq ? 'rgba(15,23,42,0.38)' : 'rgba(15,23,42,0.85)' }}>{label}</div>
            <DocStatusBadge status={doc.displayStatus} />
          </div>

          {hasFile && (
            <button type="button" onClick={handleDownload}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: 'fit-content' }}>
              {doc.originalFilename ?? 'View file'}
              {doc.fileSize && <span style={{ opacity: 0.6 }}>· {(doc.fileSize / 1024).toFixed(0)} KB</span>}
            </button>
          )}

          {doc.verificationSource && (
            <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>
              {doc.verificationSource === 'PHYSICAL_ORIGINAL' ? ' Physical original' : ' Uploaded copy'} verified
              {doc.verifiedAt && <span style={{ marginLeft: 5 }}>{new Date(doc.verifiedAt).toLocaleDateString()}</span>}
            </div>
          )}
          {doc.remarks && <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', fontStyle: 'italic' }}>"{doc.remarks}"</div>}

          {editRemarkOpen ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <textarea autoFocus value={editRemarkValue} onChange={e => setEditRemarkValue(e.target.value)} rows={2}
                style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.18)', resize: 'vertical', width: '100%' }} placeholder="Enter remark…" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn" disabled={busy} style={{ fontSize: 12, padding: '5px 12px' }} onClick={submitEditRemark}>{busy ? '…' : 'Save'}</button>
                <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => { setEditRemarkOpen(false); setEditRemarkValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {pa && (
                <button type="button" className={pa.isPrimary ? 'btn' : 'btn secondary'} disabled={busy || uploading} onClick={pa.onClick}
                  style={{ fontSize: 12, padding: '5px 14px', whiteSpace: 'nowrap' }}>{pa.label}</button>
              )}
              {showUpload && (
                <button type="button" className="btn secondary" disabled={uploading} onClick={() => fileInputRef.current?.click()}
                  title={isUploaded ? 'Replace uploaded file' : 'Upload document (PDF, JPG, PNG — max 10 MB)'}
                  style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                  {uploading ? 'Uploading…' : isUploaded ? '↑ Re-upload' : '↑ Upload'}
                </button>
              )}
              {!pa && isVerified && <span style={{ fontSize: 12, color: '#166534', fontWeight: 700 }}>✓ Verified</span>}
              {!pa && isNotReq   && <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.35)', fontStyle: 'italic' }}>Not required</span>}
              <DocMoreMenu doc={doc} staffId={staffId}
                onAction={(path: string, body?: unknown, isPatch?: boolean) => callAction(path, body, isPatch)}
                onUpload={() => fileInputRef.current?.click()}
                onReject={() => setRejectOpen(true)}
                onEditRemark={() => { setEditRemarkOpen(true); setEditRemarkValue(doc.remarks ?? ''); }}
              />
            </div>
          )}
          {rowError && <div style={{ fontSize: 12, color: '#b91c1c' }}>⚠ {rowError}</div>}
        </div>
        {rejectOpen && <RejectDialog staffId={staffId} docId={doc.id} onDone={() => { setRejectOpen(false); onRefresh(); }} onCancel={() => setRejectOpen(false)} />}
      </>
    );
  }

  // ── Desktop row ────────────────────────────────────────────────────────────
  return (
    <>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
      <tr style={{ borderBottom: rowError ? 'none' : '1px solid rgba(15,23,42,0.06)', background: isNotReq ? 'rgba(15,23,42,0.013)' : undefined }}>
        {/* Document name */}
        <td style={{ padding: '10px 12px', verticalAlign: 'middle', fontWeight: 600, fontSize: 13, color: isNotReq ? 'rgba(15,23,42,0.38)' : 'rgba(15,23,42,0.85)' }}>
          {label}
          {doc.remarks && <span title={doc.remarks} style={{ marginLeft: 5, fontSize: 11, color: 'rgba(15,23,42,0.35)' }}></span>}
          {doc.verificationSource && (
            <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.38)', marginTop: 2, fontWeight: 500 }}>
              {doc.verificationSource === 'PHYSICAL_ORIGINAL' ? ' Physical original' : ' Uploaded copy'} verified
            </div>
          )}
        </td>

        {/* Status */}
        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
          <DocStatusBadge status={doc.displayStatus} />
          {isVerified && doc.verifiedAt && (
            <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.38)', marginTop: 2 }}>{new Date(doc.verifiedAt).toLocaleDateString()}</div>
          )}
        </td>

        {/* File chip */}
        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
          {hasFile ? (
            <button type="button" onClick={handleDownload}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', color: '#1d4ed8', fontSize: 11, fontWeight: 600, cursor: 'pointer', maxWidth: 160, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.originalFilename ?? 'View file'}</span>
              {doc.fileSize && <span style={{ flexShrink: 0, opacity: 0.6 }}>· {(doc.fileSize / 1024).toFixed(0)} KB</span>}
            </button>
          ) : (
            <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.28)' }}>No file</span>
          )}
        </td>

        {/* Actions */}
        <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
          {editRemarkOpen ? (
            <div style={{ display: 'grid', gap: 5, minWidth: 180 }}>
              <textarea autoFocus value={editRemarkValue} onChange={e => setEditRemarkValue(e.target.value)} rows={2}
                style={{ fontSize: 12, resize: 'vertical', width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.18)' }} placeholder="Enter remark…" />
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="btn" disabled={busy} style={{ fontSize: 11, padding: '3px 9px' }} onClick={submitEditRemark}>{busy ? '…' : 'Save'}</button>
                <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => { setEditRemarkOpen(false); setEditRemarkValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {pa && (
                <button type="button" className={pa.isPrimary ? 'btn' : 'btn secondary'} disabled={busy || uploading} onClick={pa.onClick}
                  style={{ fontSize: 11, padding: '4px 12px', whiteSpace: 'nowrap' }}>{pa.label}</button>
              )}
              {showUpload && (
                <button type="button" className="btn secondary" disabled={uploading} onClick={() => fileInputRef.current?.click()}
                  title={isUploaded ? 'Replace uploaded file' : 'Upload document (PDF, JPG, PNG — max 10 MB)'}
                  style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                  {uploading ? 'Uploading…' : isUploaded ? '↑ Re-upload' : '↑ Upload'}
                </button>
              )}
              {!pa && isVerified && <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>✓ Verified</span>}
              {!pa && isNotReq   && <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.28)', fontStyle: 'italic' }}>Not required</span>}
            </div>
          )}
        </td>

        {/* Kebab */}
        <td style={{ padding: '10px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
          <DocMoreMenu doc={doc} staffId={staffId}
            onAction={(path: string, body?: unknown, isPatch?: boolean) => callAction(path, body, isPatch)}
            onUpload={() => fileInputRef.current?.click()}
            onReject={() => setRejectOpen(true)}
            onEditRemark={() => { setEditRemarkOpen(true); setEditRemarkValue(doc.remarks ?? ''); }}
          />
        </td>
      </tr>
      {rowError && (
        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <td colSpan={5} style={{ padding: '4px 12px 10px', color: '#b91c1c', fontSize: 12 }}>⚠ {rowError}</td>
        </tr>
      )}
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

  // Fetch configured TEACHER document requirements from settings
  const reqsQ = useQuery({
    queryKey: ['school-document-requirements', 'TEACHER'],
    queryFn: async () =>
      (await api.get<SchoolDocReq[]>('/api/schools/document-requirements', {
        params: { targetType: 'TEACHER' },
      })).data,
    retry: 1,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['staff-documents', staffId] });
  }

  const allDocs = docsQ.data ?? [];

  // Build the set of configured (REQUIRED / OPTIONAL) doc type codes from settings
  const configuredCodes = new Set(
    (reqsQ.data ?? [])
      .filter(r => r.requirementStatus !== 'NOT_REQUIRED' && r.active)
      .map(r => r.documentTypeCode),
  );
  const hasAnyRequirements = configuredCodes.size > 0;

  // Only show docs that match configured requirements; if requirements not loaded yet show all
  const docs = reqsQ.isSuccess && hasAnyRequirements
    ? allDocs.filter(d => configuredCodes.has(d.documentType))
    : reqsQ.isSuccess && !hasAnyRequirements
      ? [] // configured but all set to NOT_REQUIRED → show nothing
      : allDocs; // requirements loading or failed → show all as fallback

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

      {/* No requirements configured banner */}
      {reqsQ.isSuccess && !hasAnyRequirements && (
        <div style={{ padding: '12px 16px', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 10, fontSize: 13, color: '#92400e', fontWeight: 600, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16 }}>⚙️</span>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 2 }}>No teacher document requirements configured</div>
            <div style={{ fontWeight: 500, opacity: 0.85 }}>
              Configure required documents in <strong>Settings → Document Requirements → Teacher Documents</strong> to populate this checklist.
            </div>
          </div>
        </div>
      )}

      {/* Summary header */}
      {docs.length > 0 && (
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
      )}

      {/* Desktop table */}
      {!isMobile && docs.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'visible' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Document', 'Status', 'File', 'Next Action', ''].map(col => (
                    <th key={col} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.45)', whiteSpace: 'nowrap', background: 'rgba(250,250,249,0.98)', borderBottom: '1px solid rgba(15,23,42,0.07)', position: 'sticky', top: 0 }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <DocRow key={doc.id} doc={doc} staffId={staffId} onRefresh={refresh} isMobile={false} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

      {docs.length === 0 && hasAnyRequirements && (
        <div style={{ padding: 24, textAlign: 'center', color: 'rgba(15,23,42,0.4)', fontSize: 13 }}>
          No document records found. They will be auto-created on the next page load.
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
    ACTIVE:      { label: 'Active',       bg: 'rgba(22,163,74,0.1)',  color: '#166534', icon: '' },
    INVITED:     { label: 'Invited',      bg: 'rgba(37,99,235,0.1)',  color: '#1e40af', icon: '' },
    DISABLED:    { label: 'Disabled',     bg: 'rgba(220,38,38,0.1)', color: '#b91c1c', icon: '' },
    NOT_CREATED: { label: 'Not Created',  bg: 'rgba(15,23,42,0.07)', color: '#475569', icon: '' },
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
        <div style={{ fontSize: 12, fontWeight: 800, color: '#166534' }}> One-time temporary password — copy it now</div>
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

  // loginStatus is one of: NOT_CREATED | ACTIVE | DISABLED
  // INVITED is not used — lastInviteSentAt is recorded as metadata only.
  const loginStatus  = profile.loginStatus ?? 'NOT_CREATED';
  const hasLogin     = loginStatus !== 'NOT_CREATED';
  const isActive     = loginStatus === 'ACTIVE';
  const isDisabled   = loginStatus === 'DISABLED';

  const hasTeacherRole = profile.roles.includes('TEACHER') || profile.roles.includes('CLASS_TEACHER');
  const teacherNoLogin = hasTeacherRole && !hasLogin;
  const teacherDisabled = hasTeacherRole && isDisabled;
  const hasRoles = profile.roles.length > 0;
  const noRolesBlocked = !hasLogin && !hasRoles;

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
    if (profile.roles.length === 0) {
      toast.error('Role required', 'Assign a staff role before creating a login. Go to Edit Profile → Roles & Access.');
      return;
    }
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

      {/* No-roles blocker — must be top-most warning */}
      {noRolesBlocked && (
        <div style={{ padding: '14px 16px', background: 'rgba(220,38,38,0.06)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}></span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>
              Assign a staff role before creating a login.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.55)', fontWeight: 600 }}>
              Portal access requires at least one role from the staff profile (e.g. TEACHER, PRINCIPAL).
              Go to <strong>Edit Profile → Roles &amp; Access</strong> to assign a role first.
            </div>
          </div>
        </div>
      )}

      {/* Integrity warnings */}
      {teacherNoLogin && hasRoles && (
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
        {/* Lifecycle detail rows */}
        <div style={{ display: 'grid', gap: 0 }}>
          <InfoRow label="Login Status"    value={loginStatus.replace('_', ' ')} />
          <InfoRow label="Username"        value={profile.username ? `@${profile.username}` : null} />
          <InfoRow label="Linked User ID"  value={profile.userId ? `#${profile.userId}` : null} />
          <InfoRow label="Last Invite"     value={profile.lastInviteSentAt ? fmtInstant(profile.lastInviteSentAt) : null} />
          <InfoRow label="Roles (from profile)" value={profile.roles.length > 0 ? profile.roles.join(', ') : '—'} />
        </div>
        {!profile.email && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
            ⚠ No email set. Add one in the Employment tab before creating a login.
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
              desc={
                !hasRoles
                  ? '⚠ Assign a staff role before creating a login.'
                  : profile.email
                    ? `Creates a login for ${profile.email} with the staff member's current roles (${profile.roles.join(', ')}).`
                    : 'Email address required — add one in the Employment tab.'
              }
              danger={!hasRoles}
            >
              <Btn label="Create Login" busy={busy} disabled={!profile.email || !hasRoles} onClick={doCreateLogin} variant="primary" />
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
          {hasLogin && (isDisabled) && (
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
              title="Record Invite"
              desc="Records the invite timestamp for audit purposes. Email delivery is not enabled yet — no email is actually sent."
            >
              <Btn label="Record Invite" busy={busy} onClick={() => doAction(`/api/staff/${staffId}/send-invite`, 'Invite recorded. Email delivery is not enabled yet.')} />
            </ActionRow>
          )}

          {/* Update roles info — roles always come from StaffRoleMapping, never set here */}
          {hasLogin && (
            <div style={{ padding: '12px 14px', background: 'rgba(37,99,235,0.03)', borderRadius: 9, border: '1px solid rgba(37,99,235,0.12)', fontSize: 12, color: 'rgba(15,23,42,0.5)', fontWeight: 600 }}>
               Portal roles are automatically derived from the staff member's <strong>StaffRoleMapping</strong> (assigned in Edit Profile → Roles &amp; Access).
              Role changes must be made there — they are reflected here on next login.
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

// ─── Tab: Leave ───────────────────────────────────────────────────────────────

function TabLeave() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Disabled state banner */}
      <div style={{
        padding: '20px 22px',
        background: 'rgba(15,23,42,0.02)',
        border: '1.5px dashed rgba(15,23,42,0.12)',
        borderRadius: 14,
        display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 36, flexShrink: 0 }}></div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: 'rgba(15,23,42,0.6)', marginBottom: 6 }}>
            Leave Management is not enabled yet for this school.
          </div>
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.42)', lineHeight: 1.6, fontWeight: 500 }}>
            Individual leave balances, leave requests, approval workflows, and timetable impact tracking
            are not active. Contact your administrator to enable leave management.
          </div>
        </div>
      </div>

      {/* Forward-looking capability preview — clearly marked as coming soon */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          When Leave Management is enabled, this tab will show:
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { icon: '', title: 'Leave Balance',     desc: 'Available, used, and pending leave for each leave type (e.g. Casual, Sick, Earned).' },
            { icon: '', title: 'Leave History',      desc: 'All past leave records with dates, type, status, and approver.' },
            { icon: '', title: 'Upcoming Leave',     desc: 'Approved future leave and pending requests awaiting approval.' },
            { icon: '', title: 'Timetable Impact',   desc: 'Which periods are affected by leave and whether a substitute has been assigned.' },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 9, background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)' }}>
              <span style={{ fontSize: 18, opacity: 0.45, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(15,23,42,0.45)', marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.38)', lineHeight: 1.5, fontWeight: 500 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Tab: Payroll ─────────────────────────────────────────────────────────────

function TabPayroll({ profile }: { profile: StaffProfile }) {
  const hasAnyData =
    profile.salaryType ||
    profile.bankName ||
    profile.bankAccountHolderName ||
    profile.bankAccountNumberMasked ||
    profile.ifsc ||
    profile.panNumberMasked;

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Payroll-prep status banner (always shown) */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(234,179,8,0.07)',
        border: '1px solid rgba(234,179,8,0.22)',
        borderRadius: 10,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
        <div style={{ fontSize: 13, color: '#92400e', fontWeight: 700 }}>
          Payroll details are stored for staff records. Salary processing is not enabled for this school.
        </div>
      </div>

      {/* Payroll enabled status */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          Payroll Configuration
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(15,23,42,0.5)' }}>Payroll Enabled</span>
          {profile.payrollEnabled ? (
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: 'rgba(22,163,74,0.1)', color: '#166534' }}>✓ Yes</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: 'rgba(15,23,42,0.07)', color: '#475569' }}>Not Enabled</span>
          )}
        </div>
        <InfoRow label="Salary Type" value={profile.salaryType ?? null} />
      </div>

      {/* Bank & Tax details */}
      {profile.payrollEnabled || hasAnyData ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <SectionCard title="Bank Details">
            <InfoRow label="Account Holder" value={profile.bankAccountHolderName} />
            <InfoRow label="Bank Name"       value={profile.bankName} />
            <InfoRow label="Account No."     value={profile.bankAccountNumberMasked} mono />
            <InfoRow label="IFSC"            value={profile.ifsc} mono />
          </SectionCard>
          <SectionCard title="Tax Details">
            <InfoRow label="PAN (masked)" value={profile.panNumberMasked} mono />
          </SectionCard>
        </div>
      ) : (
        <div style={{ padding: '16px 18px', background: 'rgba(15,23,42,0.02)', borderRadius: 12, border: '1px dashed rgba(15,23,42,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.38)', fontWeight: 600 }}>
            No payroll details on record for this staff member.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.3)', marginTop: 4 }}>
            Add bank and tax details via <strong>Edit Profile → Payroll Setup</strong>.
          </div>
        </div>
      )}

      {/* Explicit "not coming" note — no fake payslips */}
      <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.02)', borderRadius: 9, border: '1px solid rgba(15,23,42,0.07)', fontSize: 12, color: 'rgba(15,23,42,0.38)', fontWeight: 600 }}>
         Payslips, deductions, tax forms, and payroll runs are not available — salary processing is not active for this school.
      </div>

    </div>
  );
}

// ─── Tab: Activity Log ────────────────────────────────────────────────────────

/** Single entry in the system timeline (createdAt / updatedAt only — no full audit yet). */
function TimelineEntry({ icon, iconBg, label, value, sub }: {
  icon: string; iconBg: string; label: string; value: string; sub?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: iconBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(15,23,42,0.78)' }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(15,23,42,0.55)', marginTop: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.35)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function TabActivity({ profile }: { profile: StaffProfile }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Audit disabled banner */}
      <div style={{
        padding: '14px 18px',
        background: 'rgba(15,23,42,0.02)',
        border: '1.5px dashed rgba(15,23,42,0.12)',
        borderRadius: 12,
        display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 30, flexShrink: 0 }}></div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: 'rgba(15,23,42,0.55)', marginBottom: 4 }}>
            Activity log will appear after audit tracking is enabled.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)', lineHeight: 1.6, fontWeight: 500 }}>
            Detailed event tracking — status transitions, role changes, login events, document actions —
            is not active for this school. The system timestamps below are always available.
          </div>
        </div>
      </div>

      {/* System timestamps — always available from entity */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.38)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          System Record
        </div>
        <TimelineEntry
          icon="✏️" iconBg="rgba(37,99,235,0.08)"
          label="Last Updated"
          value={fmtInstant(profile.updatedAt)}
          sub="Most recent change to any profile field"
        />
        <TimelineEntry
          icon="" iconBg="rgba(22,163,74,0.08)"
          label="Record Created"
          value={fmtInstant(profile.createdAt)}
          sub="When this staff member was first added to the system"
        />
      </div>

      {/* Forward-looking event types */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)', padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(15,23,42,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          When audit tracking is enabled, each log entry will show:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 16 }}>
          {[
            { icon: '', label: 'Timestamp' },
            { icon: '', label: 'Actor (who made the change)' },
            { icon: '', label: 'Action' },
            { icon: '⬅️', label: 'Old value' },
            { icon: '➡️', label: 'New value' },
            { icon: '', label: 'Reason / note' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(15,23,42,0.4)', fontWeight: 600, padding: '4px 0' }}>
              <span style={{ opacity: 0.5 }}>{f.icon}</span> {f.label}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Events tracked:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            'Profile Created', 'Employment Updated', 'Role Changed',
            'Subject Added', 'Document Verified', 'Login Created',
            'Status Changed', 'Payroll Updated',
          ].map(ev => (
            <span key={ev} style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(15,23,42,0.05)', color: 'rgba(15,23,42,0.38)',
            }}>{ev}</span>
          ))}
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
  const [_moreOpen] = useState(false);

  // ── Photo upload state ───────────────────────────────────────────────────────
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const profileQ = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: async () => (await api.get<StaffProfile>(`/api/staff/${id}`)).data,
    enabled: !isNaN(id),
    retry: false,
  });

  const subjectsQ = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () => (await api.get('/api/subjects?size=1000&sort=name,asc')).data,
    // Multiple pages share this cache key. Some store the raw Page object; others store
    // Subject[]. The select fn normalises the cached value to Subject[] every time.
    select: (data: unknown): Subject[] => {
      if (Array.isArray(data)) return data as Subject[];
      const page = data as { content?: unknown };
      if (page && Array.isArray(page.content)) return page.content as Subject[];
      return [];
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
      await api.put(`/api/staff/${id}/onboard`, {
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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteMut = useMutation({
    mutationFn: async () => { await api.delete(`/api/staff/${id}`); },
    onSuccess: () => {
      toast.success('Staff deleted', `${profile?.fullName ?? 'Staff'} has been deleted.`);
      qc.invalidateQueries({ queryKey: ['staff'] });
      navigate('/app/teachers');
    },
    onError: (e) => toast.error('Could not delete staff', formatApiError(e)),
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
      </div>
    );
  }

  const sc  = statusColor(profile.status);
  const tc  = typeColor(profile.staffType);

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

      {/* ── Profile header card — compact ────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(15,23,42,0.1)', padding: '16px 20px', marginBottom: 14, boxShadow: '0 1px 8px rgba(15,23,42,0.05)' }}>

        {/* Hidden file input for profile photo */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
              setPhotoError('File size must be under 2 MB.');
              if (photoInputRef.current) photoInputRef.current.value = '';
              return;
            }
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
              setPhotoError('Only JPG, PNG, or WEBP images are allowed.');
              if (photoInputRef.current) photoInputRef.current.value = '';
              return;
            }
            setPhotoUploading(true);
            setPhotoError(null);
            try {
              const form = new FormData();
              form.append('file', file);
              await api.post(`/api/staff/${id}/profile-photo`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              qc.invalidateQueries({ queryKey: ['staff-profile', id] });
              qc.invalidateQueries({ queryKey: ['staff'] });
            } catch (err: unknown) {
              const e = err as { response?: { data?: { error?: string } }; message?: string };
              setPhotoError(e?.response?.data?.error ?? e?.message ?? 'Upload failed.');
            } finally {
              setPhotoUploading(false);
              if (photoInputRef.current) photoInputRef.current.value = '';
            }
          }}
        />

        {/* Row 1: avatar, name, status, eligibility + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

          {/* Avatar with photo support */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <StaffProfileAvatar
              profile={profile}
              size={52}
              canEdit={true}
              onUpload={() => { setPhotoError(null); photoInputRef.current?.click(); }}
            />
            {photoUploading && <span style={{ fontSize: 10, color: 'rgba(15,23,42,0.45)' }}>Uploading…</span>}
            {photoError && <span style={{ fontSize: 10, color: '#b91c1c', maxWidth: 80, textAlign: 'center' }}>{photoError}</span>}
          </div>

          {/* Name + primary badges */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: 'rgba(15,23,42,0.92)' }}>
                {profile.fullName}
              </h1>
              {/* Status badge — red with ⚠ when inconsistent */}
              {profile.activationInconsistent ? (
                <span style={{ ...B, background: 'rgba(220,38,38,0.12)', color: '#b91c1c', fontSize: 11 }}>
                  {profile.status ?? '—'} ⚠
                </span>
              ) : (
                <span style={{ ...B, ...sc, fontSize: 11 }}>{profile.status ?? '—'}</span>
              )}
              {/* Timetable eligibility — include first reason if not eligible */}
              {profile.timetableEligible ? (
                <span style={{ ...B, background: 'rgba(22,163,74,0.1)', color: '#166534', fontSize: 10 }}>
                   Eligible
                </span>
              ) : (
                <span
                  style={{ ...B, background: 'rgba(15,23,42,0.07)', color: '#64748b', fontSize: 10 }}
                  title={(profile.timetableEligibilityReasons ?? []).join(' · ')}
                >
                   Not Eligible
                  {(profile.timetableEligibilityReasons?.length ?? 0) > 0 && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>
                      — {profile.timetableEligibilityReasons![0]}
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Row 2: emp no · designation · department */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              {profile.employeeNo && (
                <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.45)', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(15,23,42,0.05)', padding: '1px 7px', borderRadius: 5 }}>
                  {profile.employeeNo}
                </span>
              )}
              {profile.designation && (
                <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.6)', fontWeight: 600 }}>{profile.designation}</span>
              )}
              {profile.department && (
                <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.38)', fontWeight: 500 }}>· {profile.department}</span>
              )}
            </div>

            {/* Row 3: staff type + roles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
              <span style={{ ...B, ...tc, fontSize: 10 }}>{profile.staffType ?? 'STAFF'}</span>
              {profile.roles.map(r => {
                const rc = roleColor(r);
                return <span key={r} style={{ ...B, ...rc, fontSize: 10 }}>{r}</span>;
              })}
            </div>

            {/* Row 4: contact */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'rgba(15,23,42,0.5)', fontWeight: 600 }}>
              {profile.phone && <span> {profile.phone}</span>}
              {profile.email && <span>✉ {profile.email}</span>}
            </div>
          </div>

          {/* Actions — compact */}
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <button type="button" onClick={() => navigate(`/app/teachers?edit=${id}`)}
              style={{ padding: '7px 15px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✏ Edit Profile
            </button>
            <button type="button" onClick={() => setTab('access')}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid rgba(15,23,42,0.18)', background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
               Access
            </button>
            <MoreMenu
              staffId={id}
              profile={profile}
              onResetLogin={() => { setTab('access'); }}
              onDeactivate={() => statusMut.mutate('INACTIVE')}
              onMarkExited={() => statusMut.mutate('EXITED')}
              onRefresh={refreshProfile}
              onDocuments={() => setTab('documents')}
              onDelete={() => setDeleteConfirmOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* ── Activation inconsistency banner ──────────────────────────────────── */}
      {profile.activationInconsistent && (
        <div style={{
          padding: '14px 18px', marginBottom: 16,
          background: 'rgba(220,38,38,0.06)',
          border: '1.5px solid rgba(220,38,38,0.25)',
          borderRadius: 12,
          display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>⚠️</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: '#b91c1c', marginBottom: 6 }}>
              Status is inconsistent — required activation fields are missing
            </div>
            <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.65)', marginBottom: 8 }}>
              This staff member is marked <strong>ACTIVE</strong> but does not meet the activation
              requirements. Complete the missing fields or change the status to DRAFT / INACTIVE.
            </div>
            {(profile.missingRequiredItems ?? []).filter(m =>
              m.includes('Joining date') || m.includes('role') || m.includes('Designation') ||
              m.includes('Staff type') || m.includes('Full name') || m.includes('Phone')
            ).map((m, i) => (
              <div key={i} style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, marginBottom: 3 }}>
                • {m}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => navigate(`/app/teachers?edit=${id}`)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✏ Fix Required Fields
            </button>
            <button type="button"
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate('INACTIVE')}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.35)', background: '#fff', color: '#b91c1c', fontWeight: 700, fontSize: 12, cursor: statusMut.isPending ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {statusMut.isPending ? '…' : 'Deactivate'}
            </button>
          </div>
        </div>
      )}

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
            onEditProfile={() => navigate(`/app/teachers?edit=${id}`)}
          />
        )}
        {activeTab === 'timetable'  && <TabTimetable  profile={profile} />}
        {activeTab === 'documents'  && <TabDocuments staffId={id} />}
        {activeTab === 'access'     && <TabAccess profile={profile} staffId={id} onRefresh={refreshProfile} />}
        {activeTab === 'leave'      && <TabLeave />}
        {activeTab === 'payroll'    && <TabPayroll profile={profile} />}
        {activeTab === 'activity'   && <TabActivity   profile={profile} />}
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete ${profile?.fullName ?? 'staff member'}?`}
        description="This permanently deletes the staff record, login account, and any timetable entries assigned to them. Academic structure references are also cleared. This cannot be undone."
        danger
        confirmLabel={deleteMut.isPending ? 'Deleting…' : 'Delete staff'}
        confirmDisabled={deleteMut.isPending}
        onClose={() => (deleteMut.isPending ? null : setDeleteConfirmOpen(false))}
        onConfirm={async () => { await deleteMut.mutateAsync(); }}
      />
    </div>
  );
}


