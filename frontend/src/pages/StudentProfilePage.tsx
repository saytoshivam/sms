import React, { useEffect, useRef, useState } from 'react';
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
  CreateStudentLoginModal,
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
  canManageStudentLogin: boolean;
};

/** Default permissions — used when the API doesn't return them (should not happen in practice). */
const FULL_PERMS: ViewerPermissions = {
  canEdit: true, canTransfer: true, canCreateStudents: true,
  canViewGuardians: true, canViewMedical: true, canViewDocuments: true,
  canViewFees: true, canManageParentLogin: true, canManageStudentLogin: true,
};

const NO_PERMS: ViewerPermissions = {
  canEdit: false, canTransfer: false, canCreateStudents: false,
  canViewGuardians: false, canViewMedical: false, canViewDocuments: false,
  canViewFees: false, canManageParentLogin: false, canManageStudentLogin: false,
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

export type DocLifecycleStatus =
  | 'PENDING_COLLECTION' | 'COLLECTED_PHYSICAL' | 'UPLOADED' | 'VERIFIED' | 'REJECTED' | 'NOT_REQUIRED'
  | 'PENDING' | 'SUBMITTED'; // legacy values from older API responses

export type StudentDocumentSummary = {
  id: number;
  documentType?: string | null;
  /** @deprecated Use fileId + GET /api/files/{fileId}/download-url instead. */
  fileUrl?: string | null;
  /** FileObject id from the managed file module. Present after upload via POST …/upload. */
  fileId?: number | null;
  // File metadata — populated once a file has been uploaded
  originalFilename?: string | null;
  fileSize?: number | null;
  contentType?: string | null;
  uploadedAt?: string | null;
  /** Computed single-status from backend: NOT_REQUIRED > REJECTED > VERIFIED > UPLOADED > COLLECTED_PHYSICAL > PENDING_COLLECTION */
  displayStatus?: string | null;
  status?: DocLifecycleStatus | null;           // legacy — may be null for new documents
  collectionStatus?: string | null;
  uploadStatus?: string | null;
  verificationStatus?: string | null;
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
  /** FileObject id for managed profile photo. Null for legacy records. */
  profilePhotoFileId?: number | null;
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
  /** Student portal login info — populated only if the school has student login provisioning enabled. */
  studentLoginStatus?: 'NOT_CREATED' | 'INVITED' | 'ACTIVE' | 'DISABLED' | null;
  studentLoginUsername?: string | null;
  studentLoginLastInviteSentAt?: string | null;
  studentUserId?: number | null;
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

function fmtFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  PENDING:            { bg: 'rgba(234,179,8,0.12)',  color: '#854d0e', label: 'Pending Collection' },
  PENDING_COLLECTION: { bg: 'rgba(234,179,8,0.12)',  color: '#854d0e', label: 'Pending Collection' },
  COLLECTED_PHYSICAL: { bg: 'rgba(59,130,246,0.12)', color: '#1e40af', label: 'Collected (Physical)' },
  SUBMITTED:          { bg: 'rgba(59,130,246,0.12)', color: '#1e40af', label: 'Uploaded' },
  UPLOADED:           { bg: 'rgba(59,130,246,0.12)', color: '#1e40af', label: 'Uploaded' },
  VERIFIED:           { bg: 'rgba(22,163,74,0.12)',  color: '#166534', label: 'Verified' },
  REJECTED:           { bg: 'rgba(220,38,38,0.12)',  color: '#991b1b', label: 'Rejected' },
  NOT_REQUIRED:       { bg: 'rgba(15,23,42,0.07)',   color: 'rgba(15,23,42,0.45)', label: 'Not Required' },
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

type TabKey = 'overview' | 'guardians' | 'academic' | 'attendance' | 'documents' | 'access' | 'fees' | 'activity';

const ALL_TABS: { key: TabKey; label: string; requiresPerm?: keyof ViewerPermissions }[] = [
  { key: 'overview',    label: 'Overview' },
  { key: 'guardians',   label: 'Guardians',    requiresPerm: 'canViewGuardians' },
  { key: 'academic',    label: 'Academic' },
  { key: 'attendance',  label: 'Attendance' },
  { key: 'documents',   label: 'Documents',    requiresPerm: 'canViewDocuments' },
  { key: 'access',      label: 'Access' },
  { key: 'fees',        label: 'Fees',         requiresPerm: 'canViewFees' },
  { key: 'activity',    label: 'Activity Log' },
];

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ p }: { p: StudentProfilePayload }) {
  const primaryG = p.guardians?.find((g) => g.primaryGuardian) ?? p.guardians?.[0];
  const hasMedical =
    p.medical &&
    [p.medical.allergies, p.medical.medicalConditions, p.medical.emergencyContactName].some((v) => v?.trim());

  const docs = p.documents ?? [];
  const docTotal   = docs.length;
  const docVerified = docs.filter((d) => normDocStatus(d) === 'VERIFIED').length;
  const docUploaded = docs.filter((d) => normDocStatus(d) === 'UPLOADED').length;
  const docPending  = docs.filter((d) => ['PENDING_COLLECTION', 'COLLECTED_PHYSICAL'].includes(normDocStatus(d))).length;
  const docRejected = docs.filter((d) => normDocStatus(d) === 'REJECTED').length;
  const allVerified = docTotal > 0 && docVerified === docTotal;

  function docSummaryLine() {
    if (docTotal === 0) return null;
    if (allVerified) return { text: 'All verified', color: '#166534', bg: 'rgba(22,163,74,0.1)' };
    const parts: string[] = [];
    if (docVerified) parts.push(`${docVerified} verified`);
    if (docUploaded) parts.push(`${docUploaded} uploaded`);
    if (docPending)  parts.push(`${docPending} pending`);
    if (docRejected) parts.push(`${docRejected} rejected`);
    return { text: parts.join(' · '), color: 'rgba(15,23,42,0.65)', bg: 'transparent' };
  }
  const docSummary = docSummaryLine();

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
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(15,23,42,0.45)' }}>No documents on record — see the Documents tab to manage the checklist.</p>
        ) : (
          <>
            <InfoRow label="Total on record" value={String(docTotal)} />
            {docVerified > 0 && <InfoRow label="Verified" value={String(docVerified)} />}
            {docUploaded > 0 && <InfoRow label="Uploaded / Review" value={String(docUploaded)} />}
            {docPending > 0  && <InfoRow label="Pending Collection" value={String(docPending)} />}
            {docRejected > 0 && <InfoRow label="Rejected" value={String(docRejected)} />}
            {docSummary && (
              <div style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, background: docSummary.bg || 'rgba(15,23,42,0.04)', display: 'inline-block', fontSize: 12, fontWeight: 700, color: docSummary.color }}>
                {docSummary.text}
              </div>
            )}
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

/** Normalise to the new lifecycle vocabulary for display.
 *  Prefers the backend-computed `displayStatus` field; falls back to legacy `status`. */
function normDocStatus(doc: StudentDocumentSummary): string {
  if (doc.displayStatus) return doc.displayStatus;
  const s = doc.status;
  if (!s) return 'PENDING_COLLECTION';
  if (s === 'PENDING') return 'PENDING_COLLECTION';
  if (s === 'SUBMITTED') return 'UPLOADED';
  return s;
}

// ── Per-dimension status display maps ────────────────────────────────────────
const COLL_INFO: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_COLLECTION: { label: 'Pending Collection', bg: 'rgba(234,179,8,0.12)',  color: '#854d0e' },
  COLLECTED_PHYSICAL: { label: 'Collected',          bg: 'rgba(59,130,246,0.12)', color: '#1e40af' },
  NOT_REQUIRED:       { label: 'Not Required',       bg: 'rgba(15,23,42,0.07)',   color: 'rgba(15,23,42,0.45)' },
};
const UP_INFO: Record<string, { label: string; bg: string; color: string }> = {
  NOT_UPLOADED: { label: 'Not Uploaded', bg: 'rgba(15,23,42,0.06)',   color: 'rgba(15,23,42,0.4)' },
  UPLOADED:     { label: 'Uploaded',     bg: 'rgba(59,130,246,0.12)', color: '#1e40af' },
};
const VER_INFO: Record<string, { label: string; bg: string; color: string }> = {
  NOT_VERIFIED: { label: 'Not Verified', bg: 'rgba(15,23,42,0.06)',   color: 'rgba(15,23,42,0.4)' },
  VERIFIED:     { label: 'Verified',     bg: 'rgba(22,163,74,0.12)',  color: '#166534' },
  REJECTED:     { label: 'Rejected',     bg: 'rgba(220,38,38,0.12)', color: '#991b1b' },
};

function LifecyclePill({ map, value }: { map: Record<string, { label: string; bg: string; color: string }>; value?: string | null }) {
  const key = value?.toString() ?? '';
  const info = map[key];
  if (!info) return <span style={{ color: 'rgba(15,23,42,0.32)', fontSize: 12 }}>—</span>;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: info.bg, color: info.color, whiteSpace: 'nowrap' }}>
      {info.label}
    </span>
  );
}

function SmallBtn({
  label, onClick, danger, primary, disabled, title,
}: {
  label: string; onClick?: () => void; danger?: boolean; primary?: boolean;
  disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      className={primary ? 'btn' : 'btn secondary'}
      style={{
        fontSize: 11, padding: '4px 9px', flexShrink: 0, whiteSpace: 'nowrap',
        ...(danger ? { background: 'rgba(220,38,38,0.07)', color: '#991b1b', borderColor: 'rgba(220,38,38,0.2)' } : {}),
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}),
      }}
      disabled={disabled}
      title={title}
      onClick={disabled ? undefined : onClick}
    >
      {label}
    </button>
  );
}

const TH_STYLE: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontWeight: 800, fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.5)',
  whiteSpace: 'nowrap', background: 'rgba(250,250,249,0.98)',
  borderBottom: '1px solid rgba(15,23,42,0.07)', position: 'sticky', top: 0,
};
const TD_STYLE: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };

// ─── DocumentsTab component ───────────────────────────────────────────────────

function DocumentsTab({
  p, studentId, onRefresh, canEdit,
}: {
  p: StudentProfilePayload; studentId: number; onRefresh: () => void; canEdit: boolean;
}) {
  const docs = p.documents ?? [];

  // Per-row action state
  const [busy, setBusy]       = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ docId: number; msg: string } | null>(null);

  // Inline reject (requires reason)
  const [rejectDoc, setRejectDoc]     = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Inline edit remark
  const [editRemarkDoc, setEditRemarkDoc]     = useState<number | null>(null);
  const [editRemarkValue, setEditRemarkValue] = useState('');

  // Per-row upload
  const [uploadingDoc, setUploadingDoc] = useState<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function callAction(docId: number, endpoint: string, body?: object) {
    setBusy(docId);
    setRowError(null);
    try {
      await api.post(`/api/students/${studentId}/documents/${docId}/${endpoint}`, body ?? {});
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Action failed.';
      setRowError({ docId, msg });
    } finally {
      setBusy(null);
    }
  }

  async function callPatch(docId: number, body: object) {
    setBusy(docId);
    setRowError(null);
    try {
      await api.patch(`/api/students/${studentId}/documents/${docId}`, body);
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Update failed.';
      setRowError({ docId, msg });
    } finally {
      setBusy(null);
    }
  }

  async function submitReject(docId: number) {
    if (!rejectReason.trim()) return;
    setBusy(docId);
    setRowError(null);
    try {
      await api.post(`/api/students/${studentId}/documents/${docId}/reject`, { remarks: rejectReason.trim() });
      setRejectDoc(null);
      setRejectReason('');
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Rejection failed.';
      setRowError({ docId, msg });
    } finally {
      setBusy(null);
    }
  }

  async function submitEditRemark(docId: number) {
    setBusy(docId);
    setRowError(null);
    try {
      await api.patch(`/api/students/${studentId}/documents/${docId}`, { remarks: editRemarkValue.trim() || null });
      setEditRemarkDoc(null);
      setEditRemarkValue('');
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Update failed.';
      setRowError({ docId, msg });
    } finally {
      setBusy(null);
    }
  }

  async function handleFileSelected(docId: number, file: File) {
    // Client-side validation (mirrors backend: 10 MB max, PDF/JPG/PNG only)
    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      setRowError({ docId, msg: `File size must be less than ${MAX_MB} MB.` });
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      setUploadingDoc(null);
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setRowError({ docId, msg: 'Only PDF, JPG, and PNG files are allowed.' });
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      setUploadingDoc(null);
      return;
    }

    setUploadingDoc(docId);
    setBusy(docId);
    setRowError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/api/students/${studentId}/documents/${docId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Upload failed.';
      setRowError({ docId, msg });
    } finally {
      setUploadingDoc(null);
      setBusy(null);
      // reset file input so same file can be re-selected if needed
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  }

  async function handleDownload(fileId: number, docId: number) {
    setBusy(docId);
    setRowError(null);
    try {
      const resp = await api.get<{ downloadUrl?: string }>(`/api/files/${fileId}/download-url`);
      const url = resp.data?.downloadUrl;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setRowError({ docId, msg: 'Could not get download URL.' });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Could not get download URL.';
      setRowError({ docId, msg });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Hidden file input — triggered by per-row upload button */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          const docId = uploadingDoc;
          if (file && docId != null) handleFileSelected(docId, file);
        }}
      />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>
          Documents
          <span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(15,23,42,0.45)', marginLeft: 6 }}>({docs.length})</span>
        </div>
      </div>

      {/* True empty state — only when backend didn't create default rows at all */}
      {docs.length === 0 && (
        <PlaceholderState
          icon="📄"
          title="No documents on record"
          body="Default document types will appear here once the student profile is fully set up. If you see this message for an existing student, please refresh or contact support."
        />
      )}

      {/* Document checklist table */}
      {docs.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>Document</th>
                  <th style={TH_STYLE}>Collection</th>
                  <th style={TH_STYLE}>Upload</th>
                  <th style={TH_STYLE}>Verification</th>
                  <th style={{ ...TH_STYLE, minWidth: 160 }}>Remarks</th>
                  {canEdit && <th style={{ ...TH_STYLE, minWidth: 180 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const isBusy   = busy === doc.id;
                  const err      = rowError?.docId === doc.id ? rowError.msg : null;
                  const isReject = rejectDoc === doc.id;
                  const isEdit   = editRemarkDoc === doc.id;

                  const coll = doc.collectionStatus ?? 'PENDING_COLLECTION';
                  const up   = doc.uploadStatus ?? 'NOT_UPLOADED';
                  const ver  = doc.verificationStatus ?? 'NOT_VERIFIED';

                  // Which collection actions to show
                  const canMarkCollected   = canEdit && coll === 'PENDING_COLLECTION';
                  const canMarkPending     = canEdit && (coll === 'COLLECTED_PHYSICAL' || coll === 'NOT_REQUIRED');
                  const canMarkNotRequired = canEdit && coll !== 'NOT_REQUIRED';
                  // Verify/Reject: only meaningful when there's something to review
                  const canVerifyReject    = canEdit && ver === 'NOT_VERIFIED' && (coll === 'COLLECTED_PHYSICAL' || up === 'UPLOADED');

                  const rowStyle: React.CSSProperties = {
                    borderBottom: err ? 'none' : '1px solid rgba(15,23,42,0.06)',
                    background: coll === 'NOT_REQUIRED' ? 'rgba(15,23,42,0.015)' : undefined,
                  };

                  return (
                    <React.Fragment key={doc.id}>
                      <tr style={rowStyle}>
                         {/* Document name */}
                        <td style={{ ...TD_STYLE, fontWeight: 600, color: 'rgba(15,23,42,0.85)', minWidth: 140 }}>
                          <div>{doc.documentType?.replace(/_/g, ' ') || '—'}</div>
                          {doc.fileId ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDownload(doc.fileId!, doc.id)}
                              style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginTop: 2, background: 'none', border: 'none', cursor: isBusy ? 'wait' : 'pointer', padding: 0 }}>
                              View / Download ↗
                            </button>
                          ) : doc.fileUrl ? (
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginTop: 2 }}>
                              View file ↗
                            </a>
                          ) : null}
                        </td>

                        {/* Collection status */}
                        <td style={TD_STYLE}>
                          <LifecyclePill map={COLL_INFO} value={coll} />
                        </td>

                        {/* Upload status + file metadata */}
                        <td style={TD_STYLE}>
                          <LifecyclePill map={UP_INFO} value={up} />
                          {doc.originalFilename && (
                            <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.55)', marginTop: 3, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                 title={doc.originalFilename}>
                              {doc.originalFilename}
                            </div>
                          )}
                          {doc.fileSize != null && (
                            <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.38)', lineHeight: 1.3 }}>
                              {fmtFileSize(doc.fileSize)}
                            </div>
                          )}
                        </td>

                        {/* Verification status */}
                        <td style={TD_STYLE}>
                          <LifecyclePill map={VER_INFO} value={ver} />
                          {ver === 'VERIFIED' && doc.verifiedAt && (
                            <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.4)', marginTop: 3 }}>
                              {fmtDate(doc.verifiedAt)}
                            </div>
                          )}
                        </td>

                        {/* Remarks */}
                        <td style={{ ...TD_STYLE, maxWidth: 220 }}>
                          {isEdit ? (
                            <div style={{ display: 'grid', gap: 5 }}>
                              <textarea
                                autoFocus
                                value={editRemarkValue}
                                onChange={(e) => setEditRemarkValue(e.target.value)}
                                rows={2}
                                style={{ fontSize: 12, resize: 'vertical', width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.18)' }}
                                placeholder="Enter remarks…"
                              />
                              <div style={{ display: 'flex', gap: 4 }}>
                                <SmallBtn label={isBusy ? '…' : 'Save'} primary disabled={isBusy || !editRemarkValue.trim() && !doc.remarks}
                                  onClick={() => submitEditRemark(doc.id)} />
                                <SmallBtn label="Cancel" onClick={() => { setEditRemarkDoc(null); setEditRemarkValue(''); }} />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span style={{ color: doc.remarks ? 'rgba(15,23,42,0.72)' : 'rgba(15,23,42,0.28)', fontSize: 12 }}>
                                {doc.remarks || '—'}
                              </span>
                              {canEdit && (
                                <button type="button" onClick={() => { setEditRemarkDoc(doc.id); setEditRemarkValue(doc.remarks ?? ''); setRejectDoc(null); }}
                                  style={{ display: 'block', marginTop: 3, fontSize: 10, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                                  {doc.remarks ? 'Edit' : '+ Add remark'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        {canEdit && (
                          <td style={TD_STYLE}>
                            {isReject ? (
                              <div style={{ display: 'grid', gap: 5 }}>
                                <textarea
                                  autoFocus
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  rows={2}
                                  style={{ fontSize: 12, resize: 'vertical', width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.4)' }}
                                  placeholder="Reason for rejection (required)…"
                                />
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <SmallBtn label={isBusy ? '…' : 'Confirm Reject'} danger disabled={isBusy || !rejectReason.trim()}
                                    onClick={() => submitReject(doc.id)} />
                                  <SmallBtn label="Cancel" onClick={() => { setRejectDoc(null); setRejectReason(''); }} />
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {canMarkCollected && (
                                  <SmallBtn label={isBusy ? '…' : 'Mark Collected'} disabled={isBusy}
                                    onClick={() => callAction(doc.id, 'collect')} />
                                )}
                                {canMarkPending && (
                                  <SmallBtn label={isBusy ? '…' : 'Mark Pending'} disabled={isBusy}
                                    onClick={() => callAction(doc.id, 'mark-pending')} />
                                )}
                                {canMarkNotRequired && (
                                  <SmallBtn label="Not Required" disabled={isBusy}
                                    onClick={() => callAction(doc.id, 'mark-not-required')} />
                                )}
                                {/* Upload: available when doc is not NOT_REQUIRED */}
                                {coll !== 'NOT_REQUIRED' && (
                                  <SmallBtn
                                    label={isBusy && uploadingDoc === doc.id ? '…' : (up === 'UPLOADED' ? 'Replace File' : 'Upload File')}
                                    disabled={isBusy}
                                    onClick={() => {
                                      setUploadingDoc(doc.id);
                                      setTimeout(() => uploadInputRef.current?.click(), 0);
                                    }}
                                  />
                                )}
                                {canVerifyReject && (
                                  <>
                                    <SmallBtn label={isBusy ? '…' : 'Verify'} primary disabled={isBusy}
                                      onClick={() => callAction(doc.id, 'verify')} />
                                    <SmallBtn label="Reject" danger disabled={isBusy}
                                      onClick={() => { setRejectDoc(doc.id); setRejectReason(''); setEditRemarkDoc(null); }} />
                                  </>
                                )}
                                {!canMarkCollected && !canMarkPending && !canMarkNotRequired && !canVerifyReject && coll === 'NOT_REQUIRED' && (
                                  <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.32)' }}>—</span>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>

                      {/* Inline error row */}
                      {err && (
                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                          <td colSpan={canEdit ? 6 : 5}
                            style={{ padding: '4px 12px 10px', color: '#b91c1c', fontSize: 12 }}>
                            ⚠ {err}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Access tab ───────────────────────────────────────────────────────────────

const LOGIN_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  NOT_CREATED: { bg: 'rgba(15,23,42,0.07)',  color: 'rgba(15,23,42,0.5)',  label: 'No Login' },
  INVITED:     { bg: 'rgba(234,179,8,0.12)', color: '#854d0e',             label: 'Invited' },
  ACTIVE:      { bg: 'rgba(22,163,74,0.12)', color: '#166534',             label: 'Active' },
  DISABLED:    { bg: 'rgba(220,38,38,0.10)', color: '#991b1b',             label: 'Disabled' },
};

function LoginStatusBadge({ status }: { status: string | null | undefined }) {
  const s = LOGIN_STATUS_STYLE[status ?? 'NOT_CREATED'] ?? LOGIN_STATUS_STYLE['NOT_CREATED'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function NotEnabledBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.09)', borderRadius: 10 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
      <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.62)', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function AccessTab({
  p,
  onCreateParentLogin,
  onCreateStudentLogin,
  canManageParentLogin,
  canManageStudentLogin,
}: {
  p: StudentProfilePayload;
  onCreateParentLogin: (g: GuardianSummary) => void;
  onCreateStudentLogin: () => void;
  canManageParentLogin: boolean;
  canManageStudentLogin: boolean;
}) {
  const guardians = p.guardians ?? [];
  // studentLoginStatus is always present now (backend always sets it)
  const studentLoginProvisioned = p.studentLoginStatus !== undefined;

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Student Login ── */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Student Login</div>
        <Card>
          {!studentLoginProvisioned ? (
            <NotEnabledBanner>
              <strong>Account provisioning is not enabled.</strong><br />
              Student portal logins are not configured for this school. Contact your system administrator to enable student login access.
            </NotEnabledBanner>
          ) : !canManageStudentLogin ? (
            <NotEnabledBanner>
              <strong>Permission required.</strong><br />
              You do not have permission to manage student login accounts.
            </NotEnabledBanner>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.42)', minWidth: 120 }}>Login Status</span>
                <LoginStatusBadge status={p.studentLoginStatus} />
              </div>
              {p.studentLoginUsername && (
                <InfoRow label="Username" value={p.studentLoginUsername} />
              )}
              {p.studentLoginLastInviteSentAt && (
                <InfoRow label="Last Invite Sent" value={fmtDate(p.studentLoginLastInviteSentAt)} />
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                {(!p.studentLoginStatus || p.studentLoginStatus === 'NOT_CREATED') && (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={onCreateStudentLogin}
                  >
                    Create Student Login
                  </button>
                )}
                {(p.studentLoginStatus === 'INVITED' || p.studentLoginStatus === 'ACTIVE') && (
                  <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 12px', opacity: 0.55, cursor: 'not-allowed' }} disabled
                    title="Invite resending is not yet available.">
                    Resend Invite
                  </button>
                )}
                {p.studentLoginStatus === 'ACTIVE' && (
                  <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 12px', opacity: 0.55, cursor: 'not-allowed', color: '#991b1b' }} disabled
                    title="Login deactivation is not yet available.">
                    Disable Login
                  </button>
                )}
                {p.studentLoginStatus === 'DISABLED' && (
                  <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 12px', opacity: 0.55, cursor: 'not-allowed' }} disabled
                    title="Login re-enable is not yet available.">
                    Re-enable Login
                  </button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Parent / Guardian Login ── */}
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Parent / Guardian Login</div>

        {!canManageParentLogin && (
          <NotEnabledBanner>
            <strong>Permission required.</strong><br />
            You do not have permission to manage parent login accounts.
          </NotEnabledBanner>
        )}

        {canManageParentLogin && guardians.length === 0 && (
          <PlaceholderState icon="👤" title="No guardians linked" body="Add a guardian first — then come back here to provision their parent portal login." />
        )}

        {canManageParentLogin && guardians.length > 0 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {guardians.map((g) => (
              <Card key={g.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{g.name}</span>
                      {g.primaryGuardian && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'rgba(234,88,12,0.1)', color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Primary
                        </span>
                      )}
                      <LoginStatusBadge status={g.loginStatus} />
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', marginTop: 3 }}>
                      {g.relation || 'Guardian'}
                      {g.phone && <> &nbsp;·&nbsp; {g.phone}</>}
                      {g.email && <> &nbsp;·&nbsp; {g.email}</>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {(!g.loginStatus || g.loginStatus === 'NOT_CREATED') && (
                      <button
                        type="button" className="btn"
                        style={{ fontSize: 12, padding: '6px 12px' }}
                        onClick={() => onCreateParentLogin(g)}
                      >
                        Create Login
                      </button>
                    )}
                    {g.loginStatus === 'INVITED' && (
                      <button
                        type="button" className="btn secondary"
                        style={{ fontSize: 12, padding: '6px 12px', opacity: 0.55, cursor: 'not-allowed' }}
                        disabled
                        title="Invite resending is not yet available. Please provision a new login if needed."
                      >
                        Send Invite
                      </button>
                    )}
                    {g.loginStatus === 'ACTIVE' && (
                      <>
                        <button
                          type="button" className="btn secondary"
                          style={{ fontSize: 12, padding: '6px 12px', opacity: 0.55, cursor: 'not-allowed' }}
                          disabled
                          title="Invite sending is not yet available for active accounts."
                        >
                          Send Invite
                        </button>
                        <button
                          type="button" className="btn secondary"
                          style={{ fontSize: 12, padding: '6px 12px', opacity: 0.55, cursor: 'not-allowed', color: '#991b1b' }}
                          disabled
                          title="Login deactivation is not yet available. Contact your system administrator."
                        >
                          Disable Login
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {g.loginStatus === 'INVITED' && (
                  <div style={{ fontSize: 12, color: '#854d0e', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 6, padding: '6px 10px' }}>
                    An invite has been sent. Guardian has not yet logged in.
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Avatar ───────────────────────────────────────────────────────────

function ProfileAvatar({
  p, size = 80, canEdit = false, onUpload,
}: {
  p: StudentProfilePayload; size?: number; canEdit?: boolean; onUpload?: () => void;
}) {
  const [signedUrl, setSignedUrl]   = useState<string | null>(null);
  const [imgBroken, setImgBroken]   = useState(false);

  // Fetch a short-lived signed URL when profilePhotoFileId is set.
  // Never use p.photoUrl directly — it may be stale or point to a JSON endpoint.
  useEffect(() => {
    setSignedUrl(null);
    setImgBroken(false);
    if (!p.profilePhotoFileId) return;
    let cancelled = false;
    api.get<{ downloadUrl?: string }>(`/api/files/${p.profilePhotoFileId}/download-url`)
      .then(r => { if (!cancelled && r.data?.downloadUrl) setSignedUrl(r.data.downloadUrl); })
      .catch(() => { /* show initials fallback on error */ });
    return () => { cancelled = true; };
  }, [p.profilePhotoFileId]);

  const hasPhoto = !!signedUrl && !imgBroken;
  const avatarStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: 16, objectFit: 'cover', flexShrink: 0,
    border: '2px solid rgba(15,23,42,0.08)',
  };
  const fallbackStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: 16, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg,#e7e5e4,#d6d3d1)',
    color: 'rgba(28,25,23,0.75)', fontWeight: 800,
    fontSize: Math.max(16, Math.round(size * 0.36)),
    border: '2px solid rgba(15,23,42,0.07)',
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {hasPhoto
        ? <img src={signedUrl!} alt="" onError={() => setImgBroken(true)} style={avatarStyle} />
        : <div aria-hidden style={fallbackStyle}>{initials(p)}</div>
      }
      {canEdit && onUpload && (
        <button
          type="button"
          onClick={onUpload}
          title="Change profile photo"
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(15,23,42,0.75)', border: '1.5px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{ fontSize: 12 }}>📷</span>
        </button>
      )}
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
  const [createStudentLoginOpen, setCreateStudentLoginOpen] = useState(false);
  const [moreOpen, setMoreOpen]           = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating]   = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const moreMenuRef                       = useRef<HTMLDivElement>(null);
  const photoInputRef                     = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError]       = useState<string | null>(null);

  // Close More menu on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

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
          {/* Hidden file input for profile photo — triggered by the 📷 button on the avatar */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              // Client-side validation: 2 MB, jpeg/png/webp only
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
                await api.post(`/api/students/${id}/profile-photo`, form, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                profile.refetch();
              } catch (err: any) {
                setPhotoError(err?.response?.data?.error ?? err?.message ?? 'Upload failed.');
              } finally {
                setPhotoUploading(false);
                if (photoInputRef.current) photoInputRef.current.value = '';
              }
            }}
          />

          {/* ── Profile Header ── */}
          <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ProfileAvatar
                p={p}
                size={80}
                canEdit={perms.canEdit}
                onUpload={() => { setPhotoError(null); photoInputRef.current?.click(); }}
              />
              {photoUploading && (
                <span style={{ fontSize: 10, color: 'rgba(15,23,42,0.45)' }}>Uploading…</span>
              )}
              {photoError && (
                <span style={{ fontSize: 10, color: '#b91c1c', maxWidth: 84, textAlign: 'center' }}>{photoError}</span>
              )}
            </div>

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

            {/* ── Primary + More Actions ── */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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

              {/* More menu */}
              <div ref={moreMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button" className="btn secondary"
                  style={{ fontSize: 13, padding: '8px 12px' }}
                  onClick={() => setMoreOpen((o) => !o)}
                  aria-haspopup="menu" aria-expanded={moreOpen}
                >
                  More ▾
                </button>
                {moreOpen && (
                  <div className="sp-more-menu" role="menu">
                    {perms.canManageParentLogin && (
                      <button type="button" className="sp-more-item" role="menuitem"
                        onClick={() => { setMoreOpen(false); handleTabClick('access'); }}
                      >
                        🔑 Manage Logins
                      </button>
                    )}
                    <button type="button" className="sp-more-item" role="menuitem"
                      onClick={() => { setMoreOpen(false); handleTabClick('documents'); }}
                    >
                      📄 Manage Documents
                    </button>
                    <hr className="sp-more-sep" />
                    <button
                      type="button" className="sp-more-item sp-more-item--disabled" role="menuitem"
                      disabled title="ID card generation is not yet available for this school."
                    >
                      🪪 Generate ID Card
                    </button>
                    <button
                      type="button" className="sp-more-item sp-more-item--disabled" role="menuitem"
                      disabled title="Transfer certificate generation is not yet available."
                    >
                      📋 Transfer Certificate
                    </button>
                    {perms.canEdit && (
                      <>
                        <hr className="sp-more-sep" />
                        <button
                          type="button" className="sp-more-item sp-more-item--danger" role="menuitem"
                          onClick={() => { setMoreOpen(false); setDeactivateConfirm(true); }}
                        >
                          🚫 Deactivate Student
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deactivate confirmation */}
          {deactivateConfirm && (
            <div className="sw-drawer-backdrop" onClick={() => { if (!deactivating) setDeactivateConfirm(false); }}>
              <div className="sw-drawer" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
                <div className="sw-drawer-head">
                  <h3>Deactivate Student</h3>
                  <button type="button" className="btn secondary sw-drawer-close" onClick={() => setDeactivateConfirm(false)}>✕</button>
                </div>
                <div className="sw-drawer-body" style={{ display: 'grid', gap: 14 }}>
                  <div style={{ fontSize: 14, color: 'rgba(15,23,42,0.72)', lineHeight: 1.6 }}>
                    This will set <strong>{name}</strong>'s status to <strong>Inactive</strong>. The student will no longer appear in active rosters. This action can be reversed by editing the profile.
                  </div>
                  {deactivateError && <div style={{ color: '#b91c1c', fontSize: 13 }}>{deactivateError}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn secondary" onClick={() => setDeactivateConfirm(false)} disabled={deactivating} style={{ flex: 1 }}>Cancel</button>
                    <button
                      type="button" className="btn"
                      style={{ flex: 1, background: 'linear-gradient(180deg,#dc2626,#b91c1c)', borderColor: '#b91c1c' }}
                      disabled={deactivating}
                      onClick={async () => {
                        setDeactivating(true);
                        setDeactivateError(null);
                        try {
                          await api.put(`/api/students/${id}`, { status: 'INACTIVE' });
                          profile.refetch();
                          setDeactivateConfirm(false);
                        } catch (e: any) {
                          setDeactivateError(e?.response?.data?.message ?? 'Failed to deactivate. Please try again.');
                        } finally {
                          setDeactivating(false);
                        }
                      }}
                    >
                      {deactivating ? 'Deactivating…' : 'Confirm Deactivate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
          {activeTab === 'documents'  && (
            <DocumentsTab
              p={p}
              studentId={id}
              onRefresh={() => profile.refetch()}
              canEdit={perms.canEdit}
            />
          )}
          {activeTab === 'access' && (
            <AccessTab
              p={p}
              onCreateParentLogin={(g) => setCreateLoginGuardian(g)}
              onCreateStudentLogin={() => setCreateStudentLoginOpen(true)}
              canManageParentLogin={perms.canManageParentLogin}
              canManageStudentLogin={perms.canManageStudentLogin}
            />
          )}
          {activeTab === 'fees' && (
            <PlaceholderState icon="💰" title="Fee module not enabled" body="Fee statements and due amounts will appear here once the fee module is configured for this school." />
          )}
          {activeTab === 'activity' && (
            <PlaceholderState icon="🕓" title="Activity log not yet available" body="A complete audit trail of changes to this student's profile will appear here once the activity log module is enabled." />
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

      {/* Create Student Login Modal */}
      {createStudentLoginOpen && p && (
        <CreateStudentLoginModal
          studentId={id}
          studentName={fullName(p)}
          admissionNo={p.admissionNo}
          onClose={() => setCreateStudentLoginOpen(false)}
          onDone={() => { profile.refetch(); setCreateStudentLoginOpen(false); }}
        />
      )}
    </div>
  );
}
