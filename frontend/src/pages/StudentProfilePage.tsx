import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import type { StudentLifecycleStatus } from '../components/students/studentListTypes';
import {
  EditProfileDrawer,
  GuardianFlowDrawer,
  TransferSectionDrawer,
  CreateParentLoginModal,
} from '../components/students/StudentProfileFlows';
import '../components/students/studentsWorkspace.css';

// ─── Types matching StudentProfileSummaryDTO ─────────────────────────────────

export type ViewerPermissions = {
  canEdit: boolean;
  canTransfer: boolean;
  canCreateStudents: boolean;
  canViewGuardians: boolean;
  canViewMedical: boolean;
  canViewDocuments: boolean;
  canViewFees: boolean;
  canManageParentLogin: boolean;
};

/** Default permissions — used when the API doesn't return them (should not happen in practice). */
const FULL_PERMS: ViewerPermissions = {
  canEdit: true, canTransfer: true, canCreateStudents: true,
  canViewGuardians: true, canViewMedical: true, canViewDocuments: true,
  canViewFees: true, canManageParentLogin: true,
};

const NO_PERMS: ViewerPermissions = {
  canEdit: false, canTransfer: false, canCreateStudents: false,
  canViewGuardians: false, canViewMedical: false, canViewDocuments: false,
  canViewFees: false, canManageParentLogin: false,
};

export type GuardianSummary = {
  id: number;
  name: string;
  relation?: string | null;
  phone?: string | null;
  email?: string | null;
  primaryGuardian: boolean;
  canLogin: boolean;
  receivesNotifications: boolean;
  loginStatus?: 'NOT_CREATED' | 'INVITED' | 'ACTIVE' | null;
  parentUserId?: number | null;
};

export type StudentEnrollmentSummary = {
  id: number;
  academicYearId?: number | null;
  academicYearLabel?: string | null;
  classGroupId?: number | null;
  classGroupDisplayName?: string | null;
  rollNo?: string | null;
  admissionDate?: string | null;
  joiningDate?: string | null;
  status?: string | null;
};

export type StudentMedicalSummary = {
  allergies?: string | null;
  medicalConditions?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  doctorContact?: string | null;
  medicationNotes?: string | null;
};

export type StudentDocumentSummary = {
  id: number;
  documentType?: string | null;
  fileUrl?: string | null;
  status?: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | null;
  verifiedByStaffId?: number | null;
  verifiedAt?: string | null;
  remarks?: string | null;
  createdAt?: string | null;
};

/** Kept for backward compatibility — StudentOnboardWizardPage imports this. */
export type StudentProfilePayload = {
  id: number;
  admissionNo: string;
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  photoUrl?: string | null;
  status?: StudentLifecycleStatus | null;
  phone?: string | null;
  address?: string | null;
  classGroupId?: number | null;
  classGroupDisplayName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  currentEnrollment?: StudentEnrollmentSummary | null;
  enrollmentHistory?: StudentEnrollmentSummary[];
  guardians?: GuardianSummary[];
  medical?: StudentMedicalSummary | null;
  documents?: StudentDocumentSummary[];
  viewerPermissions?: ViewerPermissions | null;
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function fullName(p: Pick<StudentProfilePayload, 'firstName' | 'middleName' | 'lastName'>): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim();
}

function initials(p: Pick<StudentProfilePayload, 'firstName' | 'lastName'>): string {
  const a = (p.firstName?.[0] ?? '').toUpperCase();
  const b = (p.lastName?.[0] ?? p.firstName?.[1] ?? '').toUpperCase();
  return (a + b).trim() || '?';
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:      { bg: 'rgba(22,163,74,0.12)',  color: '#166534' },
  INACTIVE:    { bg: 'rgba(15,23,42,0.07)',   color: 'rgba(15,23,42,0.6)' },
  TRANSFERRED: { bg: 'rgba(234,88,12,0.12)',  color: '#9a3412' },
  ALUMNI:      { bg: 'rgba(79,70,229,0.12)',  color: '#4338ca' },
  COMPLETED:   { bg: 'rgba(22,163,74,0.1)',   color: '#166534' },
  WITHDRAWN:   { bg: 'rgba(220,38,38,0.1)',   color: '#991b1b' },
};

const DOC_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: 'rgba(234,179,8,0.12)',  color: '#854d0e', label: 'Pending' },
  SUBMITTED: { bg: 'rgba(59,130,246,0.12)', color: '#1e40af', label: 'Submitted' },
  VERIFIED:  { bg: 'rgba(22,163,74,0.12)',  color: '#166534', label: 'Verified' },
  REJECTED:  { bg: 'rgba(220,38,38,0.12)',  color: '#991b1b', label: 'Rejected' },
};

// ─── Reusable micro-components ────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span style={{ color: 'rgba(15,23,42,0.4)', fontSize: 12 }}>—</span>;
  const s = STATUS_STYLE[status] ?? { bg: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.55)' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', background: s.bg, color: s.color, textTransform: 'uppercase' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DocPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span style={{ color: 'rgba(15,23,42,0.4)', fontSize: 12 }}>—</span>;
  const s = DOC_STATUS[status] ?? { bg: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.55)', label: status };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline', minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.42)', minWidth: 140, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: 'rgba(15,23,42,0.82)', flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
        {children ?? value ?? '—'}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(15,23,42,0.42)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="card" style={{ display: 'grid', gap: 8, ...style }}>{children}</div>;
}

function PlaceholderState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px', maxWidth: 440, margin: '0 auto' }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: 'rgba(15,23,42,0.8)', marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 14, color: 'rgba(15,23,42,0.5)', lineHeight: 1.65, margin: 0 }}>{body}</p>
    </div>
  );
}

function FeatureFlag({ on, label }: { on: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: on ? '#16a34a' : 'rgba(15,23,42,0.18)' }} />
      <span style={{ color: on ? 'rgba(15,23,42,0.78)' : 'rgba(15,23,42,0.4)' }}>{label}</span>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'guardians' | 'academic' | 'attendance' | 'documents' | 'fees' | 'activity';

const ALL_TABS: { key: TabKey; label: string; requiresPerm?: keyof ViewerPermissions }[] = [
  { key: 'overview',    label: 'Overview' },
  { key: 'guardians',   label: 'Guardians',    requiresPerm: 'canViewGuardians' },
  { key: 'academic',    label: 'Academic' },
  { key: 'attendance',  label: 'Attendance' },
  { key: 'documents',   label: 'Documents',    requiresPerm: 'canViewDocuments' },
  { key: 'fees',        label: 'Fees',         requiresPerm: 'canViewFees' },
  { key: 'activity',    label: 'Activity Log' },
];

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ p }: { p: StudentProfilePayload }) {
  const primaryG = p.guardians?.find((g) => g.primaryGuardian) ?? p.guardians?.[0];
  const hasMedical =
    p.medical &&
    [p.medical.allergies, p.medical.medicalConditions, p.medical.emergencyContactName].some((v) => v?.trim());
  const docV = p.documents?.filter((d) => d.status === 'VERIFIED').length ?? 0;
  const docP = p.documents?.filter((d) => d.status === 'PENDING' || d.status === 'SUBMITTED').length ?? 0;
  const docTotal = p.documents?.length ?? 0;

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))' }}>
      {/* Basic Details */}
      <Card>
        <SectionTitle>Basic Details</SectionTitle>
        <InfoRow label="Admission No." value={p.admissionNo} />
        <InfoRow label="Date of Birth" value={fmtDate(p.dateOfBirth)} />
        <InfoRow label="Gender" value={p.gender} />
        <InfoRow label="Blood Group" value={p.bloodGroup} />
        <InfoRow label="Phone" value={p.phone} />
        <InfoRow label="Address" value={p.address} />
      </Card>

      {/* Current Placement */}
      <Card>
        <SectionTitle>Current Placement</SectionTitle>
        <InfoRow label="Class / Section" value={p.classGroupDisplayName || p.currentEnrollment?.classGroupDisplayName} />
        <InfoRow label="Roll No." value={p.currentEnrollment?.rollNo} />
        <InfoRow label="Academic Year" value={p.currentEnrollment?.academicYearLabel} />
        <InfoRow label="Admission Date" value={fmtDate(p.currentEnrollment?.admissionDate)} />
        <InfoRow label="Joining Date" value={fmtDate(p.currentEnrollment?.joiningDate)} />
        {p.currentEnrollment?.status && (
          <InfoRow label="Enrollment Status"><StatusBadge status={p.currentEnrollment.status} /></InfoRow>
        )}
      </Card>

      {/* Primary Guardian */}
      <Card>
        <SectionTitle>Primary Guardian</SectionTitle>
        {primaryG ? (
          <>
            <InfoRow label="Name" value={primaryG.name} />
            <InfoRow label="Relation" value={primaryG.relation} />
            <InfoRow label="Phone" value={primaryG.phone} />
            <InfoRow label="Email" value={primaryG.email} />
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(15,23,42,0.45)' }}>No guardian linked.</p>
        )}
        {(p.guardians?.length ?? 0) > 1 && (
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(15,23,42,0.42)', marginTop: 2 }}>
            +{(p.guardians!.length) - 1} more guardian(s) — see Guardians tab
          </p>
        )}
      </Card>

      {/* Documents summary */}
      <Card>
        <SectionTitle>Document Status</SectionTitle>
        {docTotal === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(15,23,42,0.45)' }}>No documents uploaded yet.</p>
        ) : (
          <>
            <InfoRow label="Total Uploaded" value={String(docTotal)} />
            <InfoRow label="Verified" value={String(docV)} />
            <InfoRow label="Awaiting Review" value={String(docP)} />
          </>
        )}
      </Card>

      {/* Medical */}
      {hasMedical && (
        <Card style={{ border: '1px solid rgba(220,38,38,0.18)', background: 'rgba(220,38,38,0.025)' }}>
          <SectionTitle>⚠ Medical Information</SectionTitle>
          {p.medical!.allergies && <InfoRow label="Allergies" value={p.medical!.allergies} />}
          {p.medical!.medicalConditions && <InfoRow label="Conditions" value={p.medical!.medicalConditions} />}
          {p.medical!.emergencyContactName && (
            <InfoRow label="Emergency Contact" value={`${p.medical!.emergencyContactName}${p.medical!.emergencyContactPhone ? ` · ${p.medical!.emergencyContactPhone}` : ''}`} />
          )}
          {p.medical!.doctorContact && <InfoRow label="Doctor" value={p.medical!.doctorContact} />}
          {p.medical!.medicationNotes && <InfoRow label="Medication Notes" value={p.medical!.medicationNotes} />}
        </Card>
      )}
    </div>
  );
}

// ─── Guardians tab ────────────────────────────────────────────────────────────

const LOGIN_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  NOT_CREATED: { bg: 'rgba(15,23,42,0.07)',  color: 'rgba(15,23,42,0.5)',  label: 'No Login' },
  INVITED:     { bg: 'rgba(234,179,8,0.12)', color: '#854d0e',             label: 'Invited' },
  ACTIVE:      { bg: 'rgba(22,163,74,0.12)', color: '#166534',             label: 'Active' },
};

function LoginStatusBadge({ status }: { status: string | null | undefined }) {
  const s = LOGIN_STATUS_STYLE[status ?? 'NOT_CREATED'] ?? LOGIN_STATUS_STYLE['NOT_CREATED'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function GuardiansTab({
  p,
  studentId,
  onAdd,
  onEdit,
  onSetPrimary,
  onCreateLogin,
  onRefresh,
  canEdit,
  canManageParentLogin,
}: {
  p: StudentProfilePayload;
  studentId: number;
  onAdd: () => void;
  onEdit: (g: GuardianSummary) => void;
  onSetPrimary: (g: GuardianSummary) => void;
  onCreateLogin: (g: GuardianSummary) => void;
  onRefresh: () => void;
  canEdit: boolean;
  canManageParentLogin: boolean;
}) {
  const guardians = p.guardians ?? [];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Linked Guardians ({guardians.length})</div>
        {canEdit && (
          <button type="button" className="btn secondary" style={{ fontSize: 13, padding: '7px 12px' }} onClick={onAdd}>
            + Add Guardian
          </button>
        )}
      </div>

      {guardians.length === 0 && (
        <PlaceholderState icon="👤" title="No guardians linked" body="No guardian information has been added for this student yet." />
      )}

      {guardians.map((g) => (
        <Card key={g.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: 'rgba(15,23,42,0.9)' }}>{g.name}</span>
                {g.primaryGuardian && (
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(234,88,12,0.12)', color: '#9a3412' }}>
                    Primary
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.5)', marginTop: 2 }}>{g.relation || 'Guardian'}</div>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => onEdit(g)}>Edit</button>
                {!g.primaryGuardian && (
                  <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => onSetPrimary(g)}>
                    Set Primary
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
            <InfoRow label="Phone" value={g.phone} />
            <InfoRow label="Email" value={g.email} />
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid rgba(15,23,42,0.06)', alignItems: 'center' }}>
            <FeatureFlag on={g.receivesNotifications} label="Receives Notifications" />
            <FeatureFlag on={g.canLogin} label="Portal Login Access" />
            {canManageParentLogin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.42)' }}>Login</span>
                <LoginStatusBadge status={g.loginStatus} />
                {(!g.loginStatus || g.loginStatus === 'NOT_CREATED') && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => onCreateLogin(g)}
                  >
                    Create Login
                  </button>
                )}
                {g.loginStatus === 'ACTIVE' && (
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: 11, padding: '4px 10px', color: 'rgba(15,23,42,0.5)', cursor: 'not-allowed', opacity: 0.6 }}
                    disabled
                    title="Invite sending coming soon"
                  >
                    Send Invite
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Academic tab ─────────────────────────────────────────────────────────────

function AcademicTab({ p }: { p: StudentProfilePayload }) {
  const enr = p.currentEnrollment;
  const history = p.enrollmentHistory ?? [];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card>
        <SectionTitle>Current Enrollment</SectionTitle>
        {enr ? (
          <>
            <InfoRow label="Academic Year" value={enr.academicYearLabel} />
            <InfoRow label="Class / Section" value={enr.classGroupDisplayName || p.classGroupDisplayName} />
            <InfoRow label="Roll No." value={enr.rollNo} />
            <InfoRow label="Admission Date" value={fmtDate(enr.admissionDate)} />
            <InfoRow label="Joining Date" value={fmtDate(enr.joiningDate)} />
            <InfoRow label="Status"><StatusBadge status={enr.status} /></InfoRow>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(15,23,42,0.45)' }}>No active enrollment record found.</p>
        )}
      </Card>

      <Card>
        <SectionTitle>Enrollment History</SectionTitle>
        {history.length > 0 ? (
          <div>
            {history.map((h) => (
              <div key={h.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                <span style={{ fontWeight: 700, fontSize: 13, flex: 1, minWidth: 100 }}>{h.academicYearLabel ?? `Year ${h.academicYearId}`}</span>
                <span style={{ fontSize: 13, color: 'rgba(15,23,42,0.6)' }}>{h.classGroupDisplayName ?? '—'}</span>
                <StatusBadge status={h.status} />
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(15,23,42,0.42)' }}>
            Prior academic year enrollment will appear here once additional years are completed.
          </p>
        )}
      </Card>
    </div>
  );
}

// ─── Documents tab ────────────────────────────────────────────────────────────

function DocumentsTab({ p }: { p: StudentProfilePayload }) {
  const docs = p.documents ?? [];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Documents ({docs.length})</div>
        <button type="button" className="btn secondary" style={{ fontSize: 13, padding: '7px 12px', opacity: 0.6, cursor: 'not-allowed' }} disabled>
          Upload Document
        </button>
      </div>

      {docs.length === 0 && (
        <PlaceholderState icon="📄" title="No documents uploaded" body="Document upload will be available once the upload module is enabled. Verified documents will appear here with their review status." />
      )}

      {docs.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(250,250,249,0.96)', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
                  {['Document Type', 'Status', 'Remarks', 'Verified At', 'File'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.5)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'rgba(15,23,42,0.85)' }}>{doc.documentType?.replace(/_/g, ' ') || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><DocPill status={doc.status} /></td>
                    <td style={{ padding: '10px 14px', color: 'rgba(15,23,42,0.58)', maxWidth: 200 }}>{doc.remarks || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'rgba(15,23,42,0.58)', whiteSpace: 'nowrap' }}>{fmtDate(doc.verifiedAt)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 600 }}>View ↗</a>
                      ) : (
                        <span style={{ color: 'rgba(15,23,42,0.3)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Avatar ───────────────────────────────────────────────────────────

function ProfileAvatar({ p, size = 80 }: { p: StudentProfilePayload; size?: number }) {
  const [broken, setBroken] = useState(false);
  const url = p.photoUrl?.trim();
  if (url && !broken) {
    return (
      <img
        src={url} alt="" onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: 16, objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(15,23,42,0.08)' }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: 16, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#e7e5e4,#d6d3d1)',
        color: 'rgba(28,25,23,0.75)', fontWeight: 800,
        fontSize: Math.max(16, Math.round(size * 0.36)),
        border: '2px solid rgba(15,23,42,0.07)',
      }}
    >
      {initials(p)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = Number(studentId);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen]           = useState(false);
  const [transferOpen, setTransferOpen]   = useState(false);
  const [guardianAdd, setGuardianAdd]     = useState(false);
  const [guardianEdit, setGuardianEdit]   = useState<GuardianSummary | null>(null);
  const [createLoginGuardian, setCreateLoginGuardian] = useState<GuardianSummary | null>(null);

  const profile = useQuery({
    queryKey: ['student-profile', id],
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => (await api.get<StudentProfilePayload>(`/api/students/${id}`)).data,
  });

  // Sync ?tab= query param → tab state
  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null;
    if (t) {
      const visibleTabs = ALL_TABS.filter(tab => !tab.requiresPerm || perms[tab.requiresPerm]);
      if (visibleTabs.some((x) => x.key === t)) setActiveTab(t);
    }
  }, [searchParams]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="workspace-feature-page stack">
        <p>Invalid student.</p>
        <Link className="btn secondary" to="/app/students">← Back to students</Link>
      </div>
    );
  }

  const p = profile.data;
  const perms: ViewerPermissions = p?.viewerPermissions ?? (profile.isLoading ? NO_PERMS : FULL_PERMS);
  const visibleTabs = ALL_TABS.filter(tab => !tab.requiresPerm || perms[tab.requiresPerm]);
  const name = p ? fullName(p) : '…';
  const primaryG = p?.guardians?.find((g) => g.primaryGuardian) ?? p?.guardians?.[0];

  function handleTabClick(key: TabKey) {
    setActiveTab(key);
    setSearchParams(
      (prev) => { const n = new URLSearchParams(prev); n.set('tab', key); return n; },
      { replace: true },
    );
  }

  return (
    <div className="workspace-feature-page" style={{ display: 'grid', gap: 0 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 14 }}>
        <Link style={{ fontSize: 13, fontWeight: 600, color: 'rgba(15,23,42,0.48)' }} to="/app/students">← Students</Link>
      </div>

      {/* Error */}
      {profile.error && (
        <div className="card" style={{ color: '#991b1b', marginBottom: 16 }}>
          {(profile.error as any)?.response?.status === 403
            ? '🔒 You do not have permission to view this student profile.'
            : formatApiError(profile.error)}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn secondary" onClick={() => profile.refetch()}>Retry</button>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {profile.isLoading && !p && (
        <div className="card" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: 'rgba(15,23,42,0.07)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'grid', gap: 10 }}>
            <div style={{ height: 22, borderRadius: 6, background: 'rgba(15,23,42,0.07)', width: '50%' }} />
            <div style={{ height: 14, borderRadius: 6, background: 'rgba(15,23,42,0.05)', width: '36%' }} />
            <div style={{ height: 14, borderRadius: 6, background: 'rgba(15,23,42,0.04)', width: '28%' }} />
          </div>
        </div>
      )}

      {p && (
        <>
          {/* ── Profile Header ── */}
          <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <ProfileAvatar p={p} size={80} />

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'rgba(15,23,42,0.92)', lineHeight: 1.2 }}>
                  {name}
                </h2>
                <StatusBadge status={p.status} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 18px', fontSize: 13, color: 'rgba(15,23,42,0.56)' }}>
                <span>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4, color: 'rgba(15,23,42,0.36)' }}>Admission</span>
                  {p.admissionNo}
                </span>
                {(p.classGroupDisplayName || p.currentEnrollment?.classGroupDisplayName) && (
                  <span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4, color: 'rgba(15,23,42,0.36)' }}>Class</span>
                    {p.classGroupDisplayName || p.currentEnrollment?.classGroupDisplayName}
                  </span>
                )}
                {p.currentEnrollment?.rollNo && (
                  <span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4, color: 'rgba(15,23,42,0.36)' }}>Roll</span>
                    {p.currentEnrollment.rollNo}
                  </span>
                )}
                {primaryG?.phone && (
                  <span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4, color: 'rgba(15,23,42,0.36)' }}>Guardian</span>
                    {primaryG.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {perms.canEdit && (
                <button type="button" className="btn" style={{ fontSize: 13, padding: '8px 14px' }} onClick={() => setEditOpen(true)}>
                  Edit Profile
                </button>
              )}
              {perms.canTransfer && (
                <button type="button" className="btn secondary" style={{ fontSize: 13, padding: '8px 12px' }} onClick={() => setTransferOpen(true)}>
                  Change Section
                </button>
              )}
              {perms.canManageParentLogin && (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: 13, padding: '8px 12px' }}
                  onClick={() => { handleTabClick('guardians'); }}
                  title="Go to Guardians tab to create parent logins"
                >
                  Parent Login
                </button>
              )}
              <button type="button" className="btn secondary" style={{ fontSize: 13, padding: '8px 12px', opacity: 0.6, cursor: 'not-allowed' }} disabled>Upload Doc</button>
              {perms.canEdit && (
                <button type="button" className="btn secondary" style={{ fontSize: 13, padding: '8px 12px', opacity: 0.6, cursor: 'not-allowed', color: '#991b1b' }} disabled>Deactivate</button>
              )}
              <Link className="btn secondary" to={`/app/students/${id}/performance`} style={{ fontSize: 13, padding: '8px 12px', textDecoration: 'none' }}>Performance</Link>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 0, marginBottom: 16, borderBottom: '2px solid rgba(15,23,42,0.07)' }}>
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabClick(t.key)}
                style={{
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: activeTab === t.key ? 800 : 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: activeTab === t.key ? 'var(--color-primary)' : 'rgba(15,23,42,0.5)',
                  borderBottom: `2px solid ${activeTab === t.key ? 'var(--color-primary)' : 'transparent'}`,
                  marginBottom: -2,
                  borderRadius: 0,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s,border-color 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab Content ── */}
          {activeTab === 'overview'   && <OverviewTab   p={p} />}
          {activeTab === 'guardians'  && (
            <GuardiansTab
              p={p}
              studentId={id}
              onAdd={() => { setGuardianAdd(true); setActiveTab('guardians'); }}
              onEdit={(g) => setGuardianEdit(g)}
              onSetPrimary={async (g) => {
                try {
                  await api.post(`/api/students/${id}/guardians/${g.id}/set-primary`);
                  profile.refetch();
                } catch { /* handled inline by toast if needed */ }
              }}
              onCreateLogin={(g) => setCreateLoginGuardian(g)}
              onRefresh={() => profile.refetch()}
              canEdit={perms.canEdit}
              canManageParentLogin={perms.canManageParentLogin}
            />
          )}
          {activeTab === 'academic'   && <AcademicTab   p={p} />}
          {activeTab === 'attendance' && (
            <PlaceholderState icon="📋" title="Attendance not yet recorded" body="Attendance records will appear here once attendance has been recorded for this student. No data has been fabricated." />
          )}
          {activeTab === 'documents'  && <DocumentsTab  p={p} />}
          {activeTab === 'fees' && (
            <PlaceholderState icon="💰" title="Fee module not enabled" body="Fee statements and due amounts will appear here once the fee module is configured for this school." />
          )}
          {activeTab === 'activity' && (
            <PlaceholderState icon="🕓" title="Activity log coming soon" body="A complete audit trail of changes to this student's profile will appear here once the activity log module is enabled." />
          )}
        </>
      )}

      {/* Edit Drawer */}
      {editOpen && p && <EditProfileDrawer p={p} onClose={() => setEditOpen(false)} />}

      {/* Transfer Section Drawer */}
      {transferOpen && p && (
        <TransferSectionDrawer
          studentId={id}
          currentClassGroupDisplayName={p.classGroupDisplayName || p.currentEnrollment?.classGroupDisplayName}
          currentEnrollmentAcademicYearId={p.currentEnrollment?.academicYearId}
          onClose={() => setTransferOpen(false)}
          onSaved={() => { profile.refetch(); setTransferOpen(false); }}
        />
      )}

      {/* Add Guardian Drawer */}
      {guardianAdd && p && (
        <GuardianFlowDrawer
          studentId={id}
          mode="add"
          onClose={() => setGuardianAdd(false)}
          onSaved={() => { profile.refetch(); setGuardianAdd(false); }}
        />
      )}

      {/* Edit Guardian Drawer */}
      {guardianEdit && p && (
        <GuardianFlowDrawer
          studentId={id}
          mode="edit"
          guardian={guardianEdit}
          onClose={() => setGuardianEdit(null)}
          onSaved={() => { profile.refetch(); setGuardianEdit(null); }}
        />
      )}

      {/* Create Parent Login Modal */}
      {createLoginGuardian && (
        <CreateParentLoginModal
          studentId={id}
          guardian={createLoginGuardian}
          onClose={() => setCreateLoginGuardian(null)}
          onDone={() => { profile.refetch(); setCreateLoginGuardian(null); }}
        />
      )}
    </div>
  );
}
