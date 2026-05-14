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
  /** Human-readable name from the document_types master table. Falls back to documentType code when null. */
  documentTypeName?: string | null;
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
  /** How the document was verified: PHYSICAL_ORIGINAL | UPLOADED_COPY. Null if not yet verified. */
  verificationSource?: string | null;
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

function normDocStatus(doc: StudentDocumentSummary): string {
  if (doc.displayStatus) return doc.displayStatus;
  const s = doc.status;
  if (!s) return 'PENDING_COLLECTION';
  if (s === 'PENDING') return 'PENDING_COLLECTION';
  if (s === 'SUBMITTED') return 'UPLOADED';
  return s;
}

/** Convert snake_case / UPPER_CASE / lower strings to Title Case. */
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|[\s_-])\S/g, c => c.toUpperCase()).replace(/_/g, ' ');
}

/** Human-readable, title-cased document name. */
function fmtDocName(doc: StudentDocumentSummary): string {
  const raw = doc.documentTypeName ?? (doc.documentType?.replace(/_/g, ' ') ?? '—');
  if (raw === '—') return raw;
  return toTitleCase(raw);
}

function fmtFilename(name: string | null | undefined): string {
  if (!name) return '';
  if (name.length <= 22) return name;
  const dot = name.lastIndexOf('.');
  if (dot > 0) return name.slice(0, 12) + '…' + name.slice(dot - 3);
  return name.slice(0, 18) + '…';
}

/**
 * Three-axis status display: Collection · Upload · Verification
 * Verification is always shown based on verificationStatus, independent of uploadStatus.
 */
function CombinedStatusText({ doc }: { doc: StudentDocumentSummary }) {
  const coll = doc.collectionStatus ?? 'PENDING_COLLECTION';
  const up   = doc.uploadStatus ?? 'NOT_UPLOADED';
  const ver  = doc.verificationStatus ?? 'NOT_VERIFIED';
  const src  = doc.verificationSource;

  if (coll === 'NOT_REQUIRED') {
    return <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.35)', fontStyle: 'italic' }}>Not required</span>;
  }
  if (coll === 'PENDING_COLLECTION') {
    return (
      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(234,179,8,0.1)', color: '#854d0e', whiteSpace: 'nowrap' }}>
        Pending Collection
      </span>
    );
  }

  // Collected — build parts: Collection · Upload · Verification (independently)
  const parts: { text: string; color: string }[] = [
    { text: 'Collected', color: '#1e40af' },
  ];

  // Upload axis
  if (up === 'UPLOADED') {
    parts.push({ text: 'Uploaded', color: '#4338ca' });
  } else {
    parts.push({ text: 'No file', color: 'rgba(15,23,42,0.35)' });
  }

  // Verification axis — independent of upload
  if (ver === 'VERIFIED') {
    const verLabel = src === 'PHYSICAL_ORIGINAL' ? 'Verified from original ✓' : 'Verified from upload ✓';
    parts.push({ text: verLabel, color: '#166534' });
  } else if (ver === 'REJECTED') {
    parts.push({ text: 'Rejected', color: '#991b1b' });
  } else {
    parts.push({ text: 'Not verified', color: '#92400e' });
  }

  return (
    <span style={{ fontSize: 11, lineHeight: 1.6, display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 1px' }}>
      {parts.map((pt, i) => (
        <React.Fragment key={pt.text}>
          {i > 0 && <span style={{ color: 'rgba(15,23,42,0.22)', padding: '0 3px' }}>·</span>}
          <span style={{ color: pt.color, fontWeight: 600 }}>{pt.text}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

// ─── Kebab "More" dropdown ────────────────────────────────────────────────────
function DocMoreMenu({
  doc, canEdit, isBusy, align = 'right',
  onCollect, onMarkPending, onMarkNotRequired, onUpload, onVerifyPhysical, onVerifyUploaded,
  onReject, onEditRemark, onView, onSaveDownload,
}: {
  doc: StudentDocumentSummary; canEdit: boolean; isBusy: boolean;
  /** 'right' (default): dropdown extends leftward — use when button is at the right edge (table).
   *  'left': dropdown extends rightward — use when button is near left edge (mobile cards). */
  align?: 'left' | 'right';
  onCollect: () => void; onMarkPending: () => void; onMarkNotRequired: () => void;
  onUpload: () => void; onVerifyPhysical: () => void; onVerifyUploaded: () => void; onReject: () => void;
  onEditRemark: () => void; onView: () => void; onSaveDownload: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const coll = doc.collectionStatus ?? 'PENDING_COLLECTION';
  const up   = doc.uploadStatus ?? 'NOT_UPLOADED';
  const ver  = doc.verificationStatus ?? 'NOT_VERIFIED';
  const hasFile = !!(doc.fileId || doc.fileUrl);

  /**
   * Mirror the primary-action priority used in the table so the More menu
   * never duplicates the primary button.
   *   collect         → PENDING_COLLECTION                                → "Mark Collected" is primary
   *   verifyPhysical  → COLLECTED_PHYSICAL + NOT_UPLOADED + NOT_VERIFIED  → "Verify Physical" is primary
   *   verifyUploaded  → UPLOADED + NOT_VERIFIED                           → "Verify" is primary
   *   replace         → REJECTED                                          → "Replace File" is primary
   *   none            → VERIFIED / NOT_REQUIRED / etc.
   */
  const primaryType: 'collect' | 'verifyPhysical' | 'verifyUploaded' | 'replace' | 'none' =
    !canEdit || coll === 'NOT_REQUIRED'                                                     ? 'none'
    : coll === 'PENDING_COLLECTION'                                                         ? 'collect'
    : coll === 'COLLECTED_PHYSICAL' && up !== 'UPLOADED' && ver === 'NOT_VERIFIED'          ? 'verifyPhysical'
    : up === 'UPLOADED' && ver === 'NOT_VERIFIED'                                            ? 'verifyUploaded'
    : ver === 'REJECTED'                                                                    ? 'replace'
    : 'none';

  // canVerify across both axes (physical collected OR uploaded)
  const canV = canEdit && ver === 'NOT_VERIFIED' && (coll === 'COLLECTED_PHYSICAL' || up === 'UPLOADED');

  const items = ([
    // ── File access ──
    { label: 'View / Open',           onClick: onView,              show: hasFile },
    { label: 'Download',              onClick: onSaveDownload,      show: !!doc.fileId },
    // Upload file — show for any document that can still receive a file (pending or collected, not yet uploaded, not rejected)
    { label: 'Upload file',           onClick: onUpload,            show: canEdit && coll !== 'NOT_REQUIRED' && up !== 'UPLOADED' && ver !== 'REJECTED' },
    // Replace file — secondary when file exists but REJECTED is handled as primary elsewhere
    { label: 'Replace file',          onClick: onUpload,            show: canEdit && hasFile && coll !== 'NOT_REQUIRED' && primaryType !== 'replace' },
    // ── Verification (secondary — appears in More only when not already primary) ──
    // "Verify from original" — secondary when verifyPhysical is NOT the primary (e.g. file uploaded, verify from upload is primary)
    { label: 'Verify from original',  onClick: onVerifyPhysical,    show: canEdit && canV && coll === 'COLLECTED_PHYSICAL' && primaryType !== 'verifyPhysical' },
    // "Verify from upload" — secondary when verifyUploaded is NOT the primary (e.g. only physically collected is primary)
    { label: 'Verify from upload',    onClick: onVerifyUploaded,    show: canEdit && canV && up === 'UPLOADED' && primaryType !== 'verifyUploaded' },
    // Reject is always secondary
    { label: 'Reject',                onClick: onReject, danger: true, show: canEdit && canV },
    // ── Status transitions ──
    { label: 'Mark Pending',          onClick: onMarkPending,       show: canEdit && (coll === 'COLLECTED_PHYSICAL' || coll === 'NOT_REQUIRED') },
    { label: 'Mark Not Required',     onClick: onMarkNotRequired,   show: canEdit && coll !== 'NOT_REQUIRED' },
    // ── Remarks ──
    { label: doc.remarks ? 'Edit Remark' : 'Add Remark', onClick: onEditRemark, show: canEdit },
  ] as { label: string; onClick: () => void; show: boolean; danger?: boolean }[]).filter(i => i.show);

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" disabled={isBusy} onClick={() => setOpen(v => !v)}
        style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(15,23,42,0.13)', background: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', color: 'rgba(15,23,42,0.5)', fontSize: 18, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        title="More actions">⋯</button>
      {open && (
        <div style={{ position: 'absolute', ...(align === 'left' ? { left: 0 } : { right: 0 }), bottom: '100%', marginBottom: 4, zIndex: 9999, background: '#fff', border: '1px solid rgba(15,23,42,0.11)', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.18)', minWidth: 180, padding: '4px 0' }}>
          {items.map(item => (
            <button key={item.label} type="button"
              onClick={() => { setOpen(false); item.onClick(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: item.danger ? '#991b1b' : 'rgba(15,23,42,0.8)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = item.danger ? 'rgba(220,38,38,0.06)' : 'rgba(15,23,42,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const TH_STYLE: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontWeight: 800, fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.5)',
  whiteSpace: 'nowrap', background: 'rgba(250,250,249,0.98)',
  borderBottom: '1px solid rgba(15,23,42,0.07)', position: 'sticky', top: 0,
};
const TD_STYLE: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };

// ─── DocumentsTab ─────────────────────────────────────────────────────────────
function DocumentsTab({ p, studentId, onRefresh, canEdit }: {
  p: StudentProfilePayload; studentId: number; onRefresh: () => void; canEdit: boolean;
}) {
  const docs = p.documents ?? [];
  const [busy, setBusy]             = useState<number | null>(null);
  const [rowError, setRowError]     = useState<{ docId: number; msg: string } | null>(null);
  const [rejectDoc, setRejectDoc]   = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editRemarkDoc, setEditRemarkDoc]       = useState<number | null>(null);
  const [editRemarkValue, setEditRemarkValue]   = useState('');
  const [uploadingDoc, setUploadingDoc] = useState<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function callAction(docId: number, endpoint: string, body?: object) {
    setBusy(docId); setRowError(null);
    try { await api.post(`/api/students/${studentId}/documents/${docId}/${endpoint}`, body ?? {}); onRefresh(); }
    catch (e: any) { setRowError({ docId, msg: e?.response?.data?.error ?? e?.message ?? 'Action failed.' }); }
    finally { setBusy(null); }
  }

  async function submitReject(docId: number) {
    if (!rejectReason.trim()) return;
    setBusy(docId); setRowError(null);
    try { await api.post(`/api/students/${studentId}/documents/${docId}/reject`, { remarks: rejectReason.trim() }); setRejectDoc(null); setRejectReason(''); onRefresh(); }
    catch (e: any) { setRowError({ docId, msg: e?.response?.data?.error ?? e?.message ?? 'Rejection failed.' }); }
    finally { setBusy(null); }
  }

  async function submitEditRemark(docId: number) {
    setBusy(docId); setRowError(null);
    try { await api.patch(`/api/students/${studentId}/documents/${docId}`, { remarks: editRemarkValue.trim() || null }); setEditRemarkDoc(null); setEditRemarkValue(''); onRefresh(); }
    catch (e: any) { setRowError({ docId, msg: e?.response?.data?.error ?? e?.message ?? 'Update failed.' }); }
    finally { setBusy(null); }
  }

  async function handleFileSelected(docId: number, file: File) {
    if (file.size > 10 * 1024 * 1024) { setRowError({ docId, msg: 'File must be less than 10 MB.' }); if (uploadInputRef.current) uploadInputRef.current.value = ''; setUploadingDoc(null); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setRowError({ docId, msg: 'Only PDF, JPG, PNG allowed.' }); if (uploadInputRef.current) uploadInputRef.current.value = ''; setUploadingDoc(null); return; }
    setUploadingDoc(docId); setBusy(docId); setRowError(null);
    try {
      const form = new FormData(); form.append('file', file);
      await api.post(`/api/students/${studentId}/documents/${docId}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onRefresh();
    } catch (e: any) { setRowError({ docId, msg: e?.response?.data?.error ?? e?.message ?? 'Upload failed.' }); }
    finally { setUploadingDoc(null); setBusy(null); if (uploadInputRef.current) uploadInputRef.current.value = ''; }
  }

  async function handleDownload(fileId: number, docId: number) {
    setBusy(docId); setRowError(null);
    try {
      const resp = await api.get(`/api/files/${fileId}/content`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { setRowError({ docId, msg: e?.message ?? 'Could not load document.' }); }
    finally { setBusy(null); }
  }

  async function handleSaveDownload(fileId: number, filename: string) {
    try {
      const resp = await api.get(`/api/files/${fileId}/content`, { responseType: 'blob', params: { download: true } });
      const url = URL.createObjectURL(new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' }));
      const a = document.createElement('a'); a.href = url; a.download = filename || 'document';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }

  function triggerUpload(docId: number) { setUploadingDoc(docId); setTimeout(() => uploadInputRef.current?.click(), 0); }

  // ── Summary counts (use raw lifecycle fields for accuracy) ──────────────────
  const active    = docs.filter(d => (d.collectionStatus ?? 'PENDING_COLLECTION') !== 'NOT_REQUIRED');
  const collected = active.filter(d => (d.collectionStatus ?? 'PENDING_COLLECTION') === 'COLLECTED_PHYSICAL').length;
  const uploaded  = active.filter(d => (d.uploadStatus ?? 'NOT_UPLOADED') === 'UPLOADED').length;
  // Verified = verificationStatus VERIFIED regardless of upload status (physical verify counts too)
  const verified  = active.filter(d => (d.verificationStatus ?? 'NOT_VERIFIED') === 'VERIFIED').length;
  const pending   = active.filter(d => (d.collectionStatus ?? 'PENDING_COLLECTION') === 'PENDING_COLLECTION').length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Hidden file input */}
      <input ref={uploadInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; const id = uploadingDoc; if (f && id != null) handleFileSelected(id, f); }} />

      {/* Header */}
      <div style={{ fontWeight: 800, fontSize: 15 }}>
        Documents<span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(15,23,42,0.45)', marginLeft: 6 }}>({docs.length})</span>
      </div>

      {/* Summary tiles */}
      {active.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
          {([
            { label: 'Required',  value: active.length, color: 'rgba(15,23,42,0.7)' },
            { label: 'Collected', value: collected,     color: '#1e40af' },
            { label: 'Uploaded',  value: uploaded,      color: '#4338ca' },
            { label: 'Verified',  value: verified,      color: '#166534' },
            { label: 'Pending',   value: pending,       color: '#854d0e' },
          ] as {label:string;value:number;color:string}[]).map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.07)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.45)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Progress bars */}
      {active.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {([
            { label: 'Collection', value: collected, color: '#1d4ed8' },
            { label: 'Verification', value: verified, color: '#16a34a' },
          ] as {label:string;value:number;color:string}[]).map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'rgba(15,23,42,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <span>{label} progress</span><span>{value}/{active.length}</span>
              </div>
              <div style={{ height: 5, borderRadius: 9999, background: 'rgba(15,23,42,0.07)' }}>
                <div style={{ height: '100%', borderRadius: 9999, background: color, width: `${active.length ? (value / active.length) * 100 : 0}%`, transition: 'width 0.35s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {docs.length === 0 && (
        <PlaceholderState icon="📄" title="No documents on record"
          body="Document requirements will appear here once the student profile is set up." />
      )}

      {/* ── Desktop table — hidden on mobile via .doc-card-list/.doc-table-wrap CSS ── */}
      {docs.length > 0 && (
        <div className="card doc-table-wrap" style={{ padding: 0, overflow: 'visible' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, minWidth: 160 }}>Document</th>
                  <th style={{ ...TH_STYLE, minWidth: 130 }}>Status</th>
                  <th style={{ ...TH_STYLE, minWidth: 150 }}>File</th>
                  {canEdit && <th style={{ ...TH_STYLE, minWidth: 140 }}>Next Action</th>}
                  <th style={{ ...TH_STYLE, width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => {
                  const isBusy = busy === doc.id;
                  const err    = rowError?.docId === doc.id ? rowError.msg : null;
                  const coll   = doc.collectionStatus ?? 'PENDING_COLLECTION';
                  const up     = doc.uploadStatus     ?? 'NOT_UPLOADED';
                  const ver    = doc.verificationStatus ?? 'NOT_VERIFIED';
                  const hasFile = !!(doc.fileId || doc.fileUrl);
                  const isRejecting = rejectDoc === doc.id;
                  const isEditingRemark = editRemarkDoc === doc.id;

                  /**
                   * Primary-action priority (spec order):
                   *  1. PENDING_COLLECTION                                  → Mark Collected
                   *  2. COLLECTED_PHYSICAL + NOT_UPLOADED + NOT_VERIFIED    → Verify Physical
                   *  3. UPLOADED + NOT_VERIFIED                             → Verify
                   *  4. REJECTED                                            → Replace File
                   *  5. VERIFIED / NOT_REQUIRED                             → no action button
                   */
                  type PA = { label: string; isPrimary?: boolean; onClick: () => void } | null;
                  let pa: PA = null;
                  if (coll !== 'NOT_REQUIRED' && canEdit) {
                    if (coll === 'PENDING_COLLECTION')
                      pa = { label: isBusy ? '…' : 'Mark Collected', isPrimary: true, onClick: () => callAction(doc.id, 'collect') };
                    else if (coll === 'COLLECTED_PHYSICAL' && up !== 'UPLOADED' && ver === 'NOT_VERIFIED')
                      pa = { label: isBusy ? '…' : 'Verify Physical', isPrimary: true, onClick: () => callAction(doc.id, 'verify', { verificationSource: 'PHYSICAL_ORIGINAL' }) };
                    else if (up === 'UPLOADED' && ver === 'NOT_VERIFIED')
                      pa = { label: isBusy ? '…' : 'Verify', isPrimary: true, onClick: () => callAction(doc.id, 'verify', { verificationSource: 'UPLOADED_COPY' }) };
                    else if (ver === 'REJECTED')
                      pa = { label: isBusy && uploadingDoc === doc.id ? '…' : 'Replace File', onClick: () => triggerUpload(doc.id) };
                  }

                  const dimName = fmtDocName(doc);

                  return (
                    <React.Fragment key={doc.id}>
                      <tr style={{ borderBottom: err ? 'none' : '1px solid rgba(15,23,42,0.06)', background: coll === 'NOT_REQUIRED' ? 'rgba(15,23,42,0.013)' : undefined }}>
                        {/* Document name */}
                        <td style={{ ...TD_STYLE, fontWeight: 600, color: coll === 'NOT_REQUIRED' ? 'rgba(15,23,42,0.38)' : 'rgba(15,23,42,0.85)' }}>
                          {dimName}
                          {doc.remarks && <span title={doc.remarks} style={{ marginLeft: 5, fontSize: 11, color: 'rgba(15,23,42,0.35)' }}>💬</span>}
                        </td>

                        {/* Unified status — Collection · Upload · Verification */}
                        <td style={TD_STYLE}>
                          <CombinedStatusText doc={doc} />
                          {ver === 'VERIFIED' && doc.verifiedAt && (
                            <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.38)', marginTop: 3 }}>{fmtDate(doc.verifiedAt)}</div>
                          )}
                        </td>

                        {/* File chip */}
                        <td style={TD_STYLE}>
                          {doc.fileId ? (
                            <button type="button" disabled={isBusy} onClick={() => handleDownload(doc.fileId!, doc.id)}
                              title={doc.originalFilename ?? undefined}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', color: '#1d4ed8', fontSize: 11, fontWeight: 600, cursor: isBusy ? 'wait' : 'pointer', maxWidth: 160, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtFilename(doc.originalFilename) || 'View file'}</span>
                              {doc.fileSize && <span style={{ flexShrink: 0, opacity: 0.6 }}>· {fmtFileSize(doc.fileSize)}</span>}
                            </button>
                          ) : doc.fileUrl ? (
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>View ↗</a>
                          ) : (
                            <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.28)' }}>No file</span>
                          )}
                        </td>

                        {/* Primary action / inline forms */}
                        {canEdit && (
                          <td style={TD_STYLE}>
                            {isRejecting ? (
                              <div style={{ display: 'grid', gap: 5, minWidth: 180 }}>
                                <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                                  style={{ fontSize: 12, resize: 'vertical', width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.35)' }}
                                  placeholder="Reason (required)…" />
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button type="button" className="btn" disabled={isBusy || !rejectReason.trim()}
                                    style={{ fontSize: 11, padding: '3px 9px', background: 'rgba(220,38,38,0.09)', color: '#991b1b', borderColor: 'rgba(220,38,38,0.22)' }}
                                    onClick={() => submitReject(doc.id)}>{isBusy ? '…' : 'Confirm'}</button>
                                  <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 9px' }}
                                    onClick={() => { setRejectDoc(null); setRejectReason(''); }}>Cancel</button>
                                </div>
                              </div>
                            ) : isEditingRemark ? (
                              <div style={{ display: 'grid', gap: 5, minWidth: 180 }}>
                                <textarea autoFocus value={editRemarkValue} onChange={e => setEditRemarkValue(e.target.value)} rows={2}
                                  style={{ fontSize: 12, resize: 'vertical', width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.18)' }}
                                  placeholder="Enter remark…" />
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button type="button" className="btn" disabled={isBusy} style={{ fontSize: 11, padding: '3px 9px' }}
                                    onClick={() => submitEditRemark(doc.id)}>{isBusy ? '…' : 'Save'}</button>
                                  <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 9px' }}
                                    onClick={() => { setEditRemarkDoc(null); setEditRemarkValue(''); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                                {pa && (
                                  <button type="button" className={pa.isPrimary ? 'btn' : 'btn secondary'} disabled={isBusy}
                                    onClick={pa.onClick}
                                    style={{ fontSize: 11, padding: '4px 12px', whiteSpace: 'nowrap', ...(isBusy ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
                                    {pa.label}
                                  </button>
                                )}
                                {/* Upload button — always visible when file hasn't been uploaded yet */}
                                {coll !== 'NOT_REQUIRED' && up !== 'UPLOADED' && ver !== 'REJECTED' && (
                                  <button type="button" className="btn secondary" disabled={isBusy}
                                    onClick={() => triggerUpload(doc.id)}
                                    title="Upload a scanned copy (PDF, JPG, PNG — max 10 MB)"
                                    style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap', ...(isBusy ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>
                                    {uploadingDoc === doc.id && isBusy ? '…' : '↑ Upload'}
                                  </button>
                                )}
                                {!pa && coll === 'NOT_REQUIRED' && (
                                  <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.28)', fontStyle: 'italic' }}>Not required</span>
                                )}
                                {!pa && ver === 'VERIFIED' && coll !== 'NOT_REQUIRED' && up === 'UPLOADED' && (
                                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>✓ Verified</span>
                                )}
                              </div>
                            )}
                          </td>
                        )}

                        {/* Kebab */}
                        <td style={{ ...TD_STYLE, textAlign: 'right' }}>
                          <DocMoreMenu doc={doc} canEdit={canEdit} isBusy={isBusy}
                            onCollect={() => callAction(doc.id, 'collect')}
                            onMarkPending={() => callAction(doc.id, 'mark-pending')}
                            onMarkNotRequired={() => callAction(doc.id, 'mark-not-required')}
                            onUpload={() => triggerUpload(doc.id)}
                            onVerifyPhysical={() => callAction(doc.id, 'verify', { verificationSource: 'PHYSICAL_ORIGINAL' })}
                            onVerifyUploaded={() => callAction(doc.id, 'verify', { verificationSource: 'UPLOADED_COPY' })}
                            onReject={() => { setRejectDoc(doc.id); setRejectReason(''); setEditRemarkDoc(null); }}
                            onEditRemark={() => { setEditRemarkDoc(doc.id); setEditRemarkValue(doc.remarks ?? ''); setRejectDoc(null); }}
                            onView={() => { if (doc.fileId) handleDownload(doc.fileId, doc.id); else if (doc.fileUrl) window.open(doc.fileUrl, '_blank'); }}
                            onSaveDownload={() => { if (doc.fileId) handleSaveDownload(doc.fileId, doc.originalFilename ?? 'document'); }}
                          />
                        </td>
                      </tr>
                      {err && (
                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                          <td colSpan={canEdit ? 5 : 4} style={{ padding: '4px 12px 10px', color: '#b91c1c', fontSize: 12 }}>⚠ {err}</td>
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

      {docs.length > 0 && (
        <div className="doc-card-list">
          {docs.map(doc => {
            const isBusy  = busy === doc.id;
            const err     = rowError?.docId === doc.id ? rowError.msg : null;
            const coll    = doc.collectionStatus ?? 'PENDING_COLLECTION';
            const up      = doc.uploadStatus ?? 'NOT_UPLOADED';
            const ver     = doc.verificationStatus ?? 'NOT_VERIFIED';
            const hasFile = !!(doc.fileId || doc.fileUrl);
            const isRej   = rejectDoc === doc.id;
            const isEditR = editRemarkDoc === doc.id;
            const dimName = fmtDocName(doc);

            // Same priority as the table — physical verify is now highest when collected but not uploaded
            let cardLabel = ''; let cardIsPrimary = false;
            let cardAction: (() => void) | null = null;
            if (coll !== 'NOT_REQUIRED' && canEdit) {
              if (coll === 'PENDING_COLLECTION')
                { cardLabel = 'Mark Collected';  cardIsPrimary = true;  cardAction = () => callAction(doc.id, 'collect'); }
              else if (coll === 'COLLECTED_PHYSICAL' && up !== 'UPLOADED' && ver === 'NOT_VERIFIED')
                { cardLabel = 'Verify Physical'; cardIsPrimary = true;  cardAction = () => callAction(doc.id, 'verify', { verificationSource: 'PHYSICAL_ORIGINAL' }); }
              else if (up === 'UPLOADED' && ver === 'NOT_VERIFIED')
                { cardLabel = 'Verify';          cardIsPrimary = true;  cardAction = () => callAction(doc.id, 'verify', { verificationSource: 'UPLOADED_COPY' }); }
              else if (ver === 'REJECTED')
                { cardLabel = 'Replace File';    cardIsPrimary = false; cardAction = () => triggerUpload(doc.id); }
            }

            return (
              <div key={doc.id} className="card" style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: coll === 'NOT_REQUIRED' ? 'rgba(15,23,42,0.38)' : 'rgba(15,23,42,0.85)' }}>
                    {dimName}{doc.remarks && <span title={doc.remarks} style={{ marginLeft: 5 }}>💬</span>}
                  </span>
                  <div style={{ flexShrink: 0 }}><CombinedStatusText doc={doc} /></div>
                </div>

                {hasFile && (
                  <button type="button" disabled={isBusy}
                    onClick={() => { if (doc.fileId) handleDownload(doc.fileId, doc.id); else if (doc.fileUrl) window.open(doc.fileUrl, '_blank'); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: isBusy ? 'wait' : 'pointer', width: 'fit-content' }}>
                    {fmtFilename(doc.originalFilename) || 'View file'}
                    {doc.fileSize && <span style={{ opacity: 0.6 }}>· {fmtFileSize(doc.fileSize)}</span>}
                  </button>
                )}

                {isRej && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                      style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.35)', resize: 'vertical', width: '100%' }} placeholder="Reason (required)…" />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn" disabled={isBusy || !rejectReason.trim()}
                        style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(220,38,38,0.09)', color: '#991b1b', borderColor: 'rgba(220,38,38,0.22)' }}
                        onClick={() => submitReject(doc.id)}>{isBusy ? '…' : 'Confirm Reject'}</button>
                      <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '5px 10px' }}
                        onClick={() => { setRejectDoc(null); setRejectReason(''); }}>Cancel</button>
                    </div>
                  </div>
                )}

                {isEditR && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <textarea autoFocus value={editRemarkValue} onChange={e => setEditRemarkValue(e.target.value)} rows={2}
                      style={{ fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.18)', resize: 'vertical', width: '100%' }} placeholder="Enter remark…" />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn" disabled={isBusy} style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => submitEditRemark(doc.id)}>{isBusy ? '…' : 'Save'}</button>
                      <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '5px 10px' }}
                        onClick={() => { setEditRemarkDoc(null); setEditRemarkValue(''); }}>Cancel</button>
                    </div>
                  </div>
                )}

                {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>⚠ {err}</div>}

                {!isRej && !isEditR && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {cardAction ? (
                      <button type="button" className={cardIsPrimary ? 'btn' : 'btn secondary'} disabled={isBusy}
                        onClick={cardAction} style={{ fontSize: 12, padding: '5px 14px' }}>
                        {isBusy ? '…' : cardLabel}
                      </button>
                    ) : ver === 'VERIFIED' ? (
                      <span style={{ fontSize: 12, color: '#166534', fontWeight: 700 }}>✓ Verified</span>
                    ) : coll === 'NOT_REQUIRED' ? (
                      <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.35)', fontStyle: 'italic' }}>Not required</span>
                    ) : null}
                    {/* Upload button always visible when file hasn't been uploaded yet */}
                    {coll !== 'NOT_REQUIRED' && up !== 'UPLOADED' && ver !== 'REJECTED' && canEdit && (
                      <button type="button" className="btn secondary" disabled={isBusy}
                        onClick={() => triggerUpload(doc.id)}
                        title="Upload a scanned copy (PDF, JPG, PNG — max 10 MB)"
                        style={{ fontSize: 12, padding: '5px 12px' }}>
                        {uploadingDoc === doc.id && isBusy ? '…' : '↑ Upload'}
                      </button>
                    )}
                    <DocMoreMenu doc={doc} canEdit={canEdit} isBusy={isBusy} align="left"
                      onCollect={() => callAction(doc.id, 'collect')}
                      onMarkPending={() => callAction(doc.id, 'mark-pending')}
                      onMarkNotRequired={() => callAction(doc.id, 'mark-not-required')}
                      onUpload={() => triggerUpload(doc.id)}
                      onVerifyPhysical={() => callAction(doc.id, 'verify', { verificationSource: 'PHYSICAL_ORIGINAL' })}
                      onVerifyUploaded={() => callAction(doc.id, 'verify', { verificationSource: 'UPLOADED_COPY' })}
                      onReject={() => { setRejectDoc(doc.id); setRejectReason(''); setEditRemarkDoc(null); }}
                      onEditRemark={() => { setEditRemarkDoc(doc.id); setEditRemarkValue(doc.remarks ?? ''); setRejectDoc(null); }}
                      onView={() => { if (doc.fileId) handleDownload(doc.fileId, doc.id); else if (doc.fileUrl) window.open(doc.fileUrl, '_blank'); }}
                      onSaveDownload={() => { if (doc.fileId) handleSaveDownload(doc.fileId, doc.originalFilename ?? 'document'); }}
                    />
                  </div>
                )}
              </div>
            );
          })}
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
                          style={{ fontSize: 12, padding: '6px 12px', opacity: 0.55, cursor: 'not-allowed' }}
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

  // Fetch profile photo as an authenticated blob so the browser Authorization header is sent.
  // Never use /download-url directly in <img src> — browser requests bypass Axios interceptor.
  useEffect(() => {
    setSignedUrl(null);
    setImgBroken(false);
    if (!p.profilePhotoFileId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    api.get(`/api/files/${p.profilePhotoFileId}/content`, { responseType: 'blob' })
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
                      style={{ flex: 1, background: 'linear-gradient(180deg,#dc2626,#b91c1b)', borderColor: '#b91c1b' }}
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
