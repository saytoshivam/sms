/**
 * StudentProfileFlows.tsx
 *
 * Three self-contained drawer components consumed by StudentProfilePage:
 *  1. EditProfileDrawer   – PUT /api/students/{id}  +  PUT /api/students/{id}/medical
 *  2. GuardianFlowDrawer  – add / edit guardian, set-primary, toggle preferences
 *  3. TransferSectionDrawer – POST /api/students/{id}/transfer-section
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SelectKeeper } from '../SelectKeeper';
import { DateKeeper } from '../DateKeeper';
import { useClassGroupsCatalog } from '../ClassGroupSearchCombobox';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import type { StudentLifecycleStatus } from './studentListTypes';
import type {
  StudentProfilePayload,
  GuardianSummary,
} from '../../pages/StudentProfilePage';

// ─── Shared style atoms ───────────────────────────────────────────────────────

export const labelCss: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'rgba(15,23,42,0.52)',
  marginBottom: 5,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelCss}>{label}</label>
      {children}
    </div>
  );
}

function InlineError({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return <div style={{ color: '#b91c1c', fontSize: 13 }}>{msg}</div>;
}

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="sw-drawer-head">
      <h3>{title}</h3>
      <button type="button" className="btn secondary sw-drawer-close" onClick={onClose}>✕</button>
    </div>
  );
}

function DrawerFooter({
  onCancel,
  onConfirm,
  pending,
  confirmLabel,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  confirmLabel: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
      <button type="button" className="btn secondary" onClick={onCancel} disabled={pending} style={{ flex: 1 }}>
        Cancel
      </button>
      <button type="button" className="btn" onClick={onConfirm} disabled={pending || disabled} style={{ flex: 1 }}>
        {pending ? 'Saving…' : confirmLabel}
      </button>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(15,23,42,0.38)', padding: '8px 0 4px', borderTop: '1px solid rgba(15,23,42,0.07)', marginTop: 6 }}>
      {label}
    </div>
  );
}

// ─── 1. Edit Profile Drawer ───────────────────────────────────────────────────

type EditProfileProps = {
  p: StudentProfilePayload;
  onClose: () => void;
};

export function EditProfileDrawer({ p, onClose }: EditProfileProps) {
  const id = p.id;
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  // Core fields
  const [firstName, setFirstName]   = useState(p.firstName ?? '');
  const [middleName, setMiddleName] = useState(p.middleName ?? '');
  const [lastName, setLastName]     = useState(p.lastName ?? '');
  const [dob, setDob]               = useState(p.dateOfBirth ?? '');
  const [gender, setGender]         = useState(p.gender ?? '');
  const [bloodGroup, setBloodGroup] = useState(p.bloodGroup ?? '');
  const [photoUrl, setPhotoUrl]     = useState(p.photoUrl ?? '');
  const [status, setStatus]         = useState<StudentLifecycleStatus | ''>(p.status ?? '');
  const [phone, setPhone]           = useState(p.phone ?? '');
  const [address, setAddress]       = useState(p.address ?? '');

  // Medical fields
  const med = p.medical;
  const [allergies, setAllergies]                   = useState(med?.allergies ?? '');
  const [medicalConditions, setMedicalConditions]   = useState(med?.medicalConditions ?? '');
  const [emergencyContactName, setEmergencyName]    = useState(med?.emergencyContactName ?? '');
  const [emergencyContactPhone, setEmergencyPhone]  = useState(med?.emergencyContactPhone ?? '');
  const [doctorContact, setDoctorContact]           = useState(med?.doctorContact ?? '');
  const [medicationNotes, setMedicationNotes]       = useState(med?.medicationNotes ?? '');

  // Client-side validation
  const dobInFuture = dob && dob > today;
  const canSave = firstName.trim().length > 0 && !dobInFuture;

  const saveCore = useMutation({
    mutationFn: () =>
      api.put<StudentProfilePayload>(`/api/students/${id}`, {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim() || null,
        dateOfBirth: dob || null,
        gender: gender.trim() || null,
        bloodGroup: bloodGroup.trim() || null,
        photoUrl: photoUrl.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        ...(status ? { status } : {}),
      }).then((r) => r.data),
  });

  const saveMed = useMutation({
    mutationFn: () =>
      api.put<StudentProfilePayload>(`/api/students/${id}/medical`, {
        allergies: allergies.trim() || null,
        medicalConditions: medicalConditions.trim() || null,
        emergencyContactName: emergencyContactName.trim() || null,
        emergencyContactPhone: emergencyContactPhone.trim() || null,
        doctorContact: doctorContact.trim() || null,
        medicationNotes: medicationNotes.trim() || null,
      }).then((r) => r.data),
  });

  async function handleSave() {
    try {
      const updated = await saveCore.mutateAsync();
      const hasMedical = [allergies, medicalConditions, emergencyContactName, emergencyContactPhone, doctorContact, medicationNotes].some((v) => v.trim());
      let final = updated;
      if (hasMedical || p.medical) {
        final = await saveMed.mutateAsync();
      }
      qc.setQueryData(['student-profile', id], final);
      await qc.invalidateQueries({ queryKey: ['students'], exact: false });
      onClose();
    } catch {
      // errors shown inline
    }
  }

  const isPending = saveCore.isPending || saveMed.isPending;
  const error = saveCore.error ?? saveMed.error;

  return (
    <div className="sw-drawer-backdrop" onClick={onClose}>
      <div className="sw-drawer" onClick={(e) => e.stopPropagation()}>
        <DrawerHeader title="Edit Profile" onClose={onClose} />
        <div className="sw-drawer-body" style={{ display: 'grid', gap: 12 }}>

          <Divider label="Personal Information" />
          <Field label="First name *">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Middle name">
            <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </Field>
          <Field label="Last name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Date of birth">
            <DateKeeper id="ep-dob" value={dob} onChange={setDob} emptyLabel="Not set" clearable />
            {dobInFuture && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 4 }}>Date of birth cannot be in the future.</div>}
          </Field>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Gender">
              <input value={gender} onChange={(e) => setGender(e.target.value)} placeholder="e.g. Male" />
            </Field>
            <Field label="Blood group">
              <input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. O+" />
            </Field>
          </div>

          <Divider label="Contact" />
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" />
          </Field>
          <Field label="Address">
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="Full address" />
          </Field>

          <Divider label="Account" />
          <Field label="Photo URL">
            <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Status">
            <SelectKeeper
              id="ep-status"
              value={status}
              onChange={(v) => setStatus(v as StudentLifecycleStatus | '')}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'TRANSFERRED', label: 'Transferred' },
                { value: 'ALUMNI', label: 'Alumni' },
              ]}
              emptyValueLabel="Unchanged"
            />
          </Field>

          <Divider label="Medical Information" />
          <Field label="Allergies">
            <textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="Known allergies…" />
          </Field>
          <Field label="Medical Conditions">
            <textarea value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="Chronic conditions, disabilities…" />
          </Field>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Emergency Contact Name">
              <input value={emergencyContactName} onChange={(e) => setEmergencyName(e.target.value)} />
            </Field>
            <Field label="Emergency Contact Phone">
              <input value={emergencyContactPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="Doctor Contact">
            <input value={doctorContact} onChange={(e) => setDoctorContact(e.target.value)} placeholder="Name / clinic / phone" />
          </Field>
          <Field label="Medication Notes">
            <textarea value={medicationNotes} onChange={(e) => setMedicationNotes(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
          </Field>

          <InlineError msg={error ? formatApiError(error) : null} />

          <DrawerFooter
            onCancel={onClose}
            onConfirm={handleSave}
            pending={isPending}
            confirmLabel="Save Changes"
            disabled={!canSave}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 2. Guardian Flow Drawer ──────────────────────────────────────────────────

type GuardianFlowMode = 'add' | 'edit';

type GuardianFlowProps = {
  studentId: number;
  mode: GuardianFlowMode;
  /** Populated when mode === 'edit' */
  guardian?: GuardianSummary;
  onClose: () => void;
  onSaved: (updated: StudentProfilePayload) => void;
};

export function GuardianFlowDrawer({ studentId, mode, guardian, onClose, onSaved }: GuardianFlowProps) {
  const qc = useQueryClient();

  const [name, setName]         = useState(guardian?.name ?? '');
  const [phone, setPhone]       = useState(guardian?.phone ?? '');
  const [email, setEmail]       = useState(guardian?.email ?? '');
  const [relation, setRelation] = useState(guardian?.relation ?? 'Parent');
  const [occupation, setOccupation] = useState('');
  const [isPrimary, setIsPrimary] = useState(guardian?.primaryGuardian ?? false);
  const [notifs, setNotifs]     = useState(guardian?.receivesNotifications ?? true);
  const [canLogin, setCanLogin] = useState(guardian?.canLogin ?? false);

  const title = mode === 'add' ? 'Add Guardian' : 'Edit Guardian';

  const save = useMutation({
    mutationFn: (): Promise<StudentProfilePayload> => {
      if (mode === 'add') {
        return api.post('/api/guardians', {
          studentId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          relation: relation.trim(),
          occupation: occupation.trim() || null,
          primaryGuardian: isPrimary,
          receivesNotifications: notifs,
          canLogin,
        }).then(() => api.get<StudentProfilePayload>(`/api/students/${studentId}`).then((r) => r.data));
      } else {
        // edit
        return api.put<StudentProfilePayload>(`/api/students/${studentId}/guardians/${guardian!.id}`, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          relation: relation.trim(),
          occupation: occupation.trim() || null,
          receivesNotifications: notifs,
          canLogin,
        }).then((r) => r.data);
      }
    },
    onSuccess: async (updated) => {
      qc.setQueryData(['student-profile', studentId], updated);
      await qc.invalidateQueries({ queryKey: ['students'], exact: false });
      onSaved(updated);
    },
  });

  const canSave = name.trim().length > 0 && phone.trim().length > 0 && relation.trim().length > 0;

  return (
    <div className="sw-drawer-backdrop" onClick={onClose}>
      <div className="sw-drawer" onClick={(e) => e.stopPropagation()}>
        <DrawerHeader title={title} onClose={onClose} />
        <div className="sw-drawer-body" style={{ display: 'grid', gap: 12 }}>
          <Field label="Full name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guardian's legal name" />
          </Field>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Phone *">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Relation *">
              <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Father / Mother / Guardian" />
            </Field>
            <Field label="Occupation">
              <input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Optional" />
            </Field>
          </div>

          <Divider label="Preferences" />
          <ToggleRow
            label="Primary Guardian"
            description="Receives all official communications and is the first contact"
            on={isPrimary}
            disabled={mode === 'edit' && guardian?.primaryGuardian}
            onChange={setIsPrimary}
          />
          <ToggleRow
            label="Receives Notifications"
            description="SMS / email alerts for attendance, fees, and announcements"
            on={notifs}
            onChange={setNotifs}
          />
          <ToggleRow
            label="Portal Login Access"
            description="Can log in to the parent portal (account provisioning handled separately)"
            on={canLogin}
            onChange={setCanLogin}
          />

          <InlineError msg={save.error ? formatApiError(save.error) : null} />

          <DrawerFooter
            onCancel={onClose}
            onConfirm={() => save.mutate()}
            pending={save.isPending}
            confirmLabel={mode === 'add' ? 'Add Guardian' : 'Save Changes'}
            disabled={!canSave}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  on,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <label className="sms-switch" style={{ marginTop: 2, flexShrink: 0 }}>
        <input
          type="checkbox"
          className="sms-switch__input"
          checked={on}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="sms-switch__ui"><span className="sms-switch__thumb" /></span>
      </label>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: disabled ? 'rgba(15,23,42,0.4)' : 'rgba(15,23,42,0.85)' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.46)', lineHeight: 1.45, marginTop: 2 }}>{description}</div>}
        {disabled && <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.38)', marginTop: 2 }}>Cannot unset — at least one primary guardian required.</div>}
      </div>
    </div>
  );
}

// ─── 3. Transfer Section Drawer ───────────────────────────────────────────────

type AcademicYearOption = { id: number; label: string };

type TransferSectionProps = {
  studentId: number;
  currentClassGroupDisplayName?: string | null;
  currentEnrollmentAcademicYearId?: number | null;
  onClose: () => void;
  onSaved: (updated: StudentProfilePayload) => void;
};

export function TransferSectionDrawer({
  studentId,
  currentClassGroupDisplayName,
  currentEnrollmentAcademicYearId,
  onClose,
  onSaved,
}: TransferSectionProps) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [academicYearId, setAcademicYearId] = useState(
    currentEnrollmentAcademicYearId ? String(currentEnrollmentAcademicYearId) : '',
  );
  const [newClassGroupId, setNewClassGroupId] = useState('');
  const [rollNo, setRollNo]                   = useState('');
  const [effectiveDate, setEffectiveDate]     = useState(today);
  const [reason, setReason]                   = useState('');
  const [confirming, setConfirming]           = useState(false);

  // Load academic years
  const yearsQuery = useQuery({
    queryKey: ['academic-years-list'],
    staleTime: 60_000,
    queryFn: async () =>
      (await api.get<AcademicYearOption[]>('/api/academic-years')).data,
  });

  // Load class groups
  const classCatalog = useClassGroupsCatalog();
  const classOptions = classCatalog.data?.content ?? [];
  const yearOptions: AcademicYearOption[] = yearsQuery.data ?? [];

  const selectedClass = classOptions.find((c) => String(c.id) === newClassGroupId);

  const canProceed =
    academicYearId !== '' &&
    newClassGroupId !== '' &&
    reason.trim().length > 0 &&
    effectiveDate !== '';

  const transfer = useMutation({
    mutationFn: () =>
      api.post<StudentProfilePayload>(`/api/students/${studentId}/transfer-section`, {
        academicYearId: Number(academicYearId),
        newClassGroupId: Number(newClassGroupId),
        rollNo: rollNo.trim() || null,
        effectiveDate: effectiveDate || null,
        reason: reason.trim(),
      }).then((r) => r.data),
    onSuccess: async (updated) => {
      qc.setQueryData(['student-profile', studentId], updated);
      await qc.invalidateQueries({ queryKey: ['students'], exact: false });
      onSaved(updated);
    },
  });

  if (confirming) {
    return (
      <div className="sw-drawer-backdrop" onClick={() => setConfirming(false)}>
        <div className="sw-drawer" onClick={(e) => e.stopPropagation()}>
          <DrawerHeader title="Confirm Transfer" onClose={() => setConfirming(false)} />
          <div className="sw-drawer-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.18)', borderRadius: 10, padding: 16, lineHeight: 1.6, fontSize: 14 }}>
              <strong>This will move the student</strong> from{' '}
              <em>{currentClassGroupDisplayName || 'current class'}</em> to{' '}
              <em>{selectedClass?.displayName || 'selected class'}</em>
              {effectiveDate && (
                <> effective from <strong>{new Date(effectiveDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></>
              )}.
              <br />
              The student will appear in the new section for attendance from the effective date onward.
              This action will preserve existing attendance history.
            </div>

            <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'rgba(15,23,42,0.7)' }}>
              <ConfirmRow label="From" value={currentClassGroupDisplayName ?? '—'} />
              <ConfirmRow label="To" value={selectedClass?.displayName ?? '—'} />
              {rollNo && <ConfirmRow label="New Roll No." value={rollNo} />}
              <ConfirmRow label="Effective Date" value={effectiveDate} />
              <ConfirmRow label="Reason" value={reason} />
            </div>

            <InlineError msg={transfer.error ? formatApiError(transfer.error) : null} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn secondary" onClick={() => setConfirming(false)} disabled={transfer.isPending} style={{ flex: 1 }}>
                Back
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => transfer.mutate()}
                disabled={transfer.isPending}
                style={{ flex: 1, background: 'linear-gradient(180deg,#ea580c,#c2410c)', borderColor: '#c2410c' }}
              >
                {transfer.isPending ? 'Transferring…' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-drawer-backdrop" onClick={onClose}>
      <div className="sw-drawer" onClick={(e) => e.stopPropagation()}>
        <DrawerHeader title="Change Section" onClose={onClose} />
        <div className="sw-drawer-body" style={{ display: 'grid', gap: 12 }}>

          <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.04)', borderRadius: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.42)', display: 'block', marginBottom: 3 }}>Current Class / Section</span>
            <span>{currentClassGroupDisplayName || '—'}</span>
          </div>

          <Field label="Academic Year *">
            <SelectKeeper
              value={academicYearId}
              onChange={setAcademicYearId}
              options={yearOptions.map((y) => ({ value: String(y.id), label: y.label }))}
              emptyValueLabel="Select academic year…"
            />
          </Field>

          <Field label="New Class / Section *">
            <SelectKeeper
              value={newClassGroupId}
              onChange={setNewClassGroupId}
              options={classOptions.map((c) => ({ value: String(c.id), label: c.displayName }))}
              emptyValueLabel="Select new class…"
              searchable
            />
          </Field>

          <Field label="New Roll No. (optional)">
            <input
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              placeholder="Leave blank to keep unassigned"
            />
          </Field>

          <Field label="Effective Date *">
            <DateKeeper id="ts-date" value={effectiveDate} onChange={setEffectiveDate} emptyLabel="Select date" />
          </Field>

          <Field label="Reason for transfer *">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Section rebalancing, parental request, capacity adjustment…"
              style={{ resize: 'vertical' }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button type="button" className="btn secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canProceed}
              onClick={() => setConfirming(true)}
              style={{ flex: 1 }}
            >
              Review & Confirm →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ fontWeight: 700, minWidth: 120, color: 'rgba(15,23,42,0.52)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── 4. Create Parent Login Modal ─────────────────────────────────────────────

type ParentLoginResult = {
  outcome: 'CREATED' | 'LINKED';
  parentUserId: number;
  username: string;
  temporaryPassword?: string | null;
  message: string;
};

type CreateParentLoginModalProps = {
  studentId: number;
  guardian: GuardianSummary;
  onClose: () => void;
  onDone: () => void;
};

export function CreateParentLoginModal({ studentId, guardian, onClose, onDone }: CreateParentLoginModalProps) {
  const [result, setResult] = useState<ParentLoginResult | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: (): Promise<ParentLoginResult> =>
      api.post<ParentLoginResult>(`/api/students/${studentId}/guardians/${guardian.id}/create-login`)
        .then((r) => r.data),
    onSuccess: (data) => setResult(data),
  });

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="sw-drawer-backdrop" onClick={result ? undefined : onClose}>
      <div
        className="sw-drawer"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <DrawerHeader
          title={result ? 'Login Ready' : `Create Login — ${guardian.name}`}
          onClose={result ? onDone : onClose}
        />

        <div className="sw-drawer-body" style={{ display: 'grid', gap: 16 }}>

          {/* — Pre-confirm state — */}
          {!result && !create.isPending && (
            <>
              <div style={{ fontSize: 14, color: 'rgba(15,23,42,0.72)', lineHeight: 1.6 }}>
                This will create a <strong>parent login account</strong> for:
                <br />
                <strong>{guardian.name}</strong>
                {guardian.email && <> &nbsp;·&nbsp; {guardian.email}</>}
                {!guardian.email && guardian.phone && <> &nbsp;·&nbsp; {guardian.phone}</>}
              </div>
              <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
                {guardian.email
                  ? 'A temporary password will be generated. Share it securely with the guardian.'
                  : 'No email on file — a phone-based username will be used. Make sure you share the credentials safely.'}
              </div>
              <InlineError msg={create.error ? formatApiError(create.error) : null} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                <button type="button" className="btn" onClick={() => create.mutate()} style={{ flex: 1 }}>
                  Confirm & Create
                </button>
              </div>
            </>
          )}

          {create.isPending && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(15,23,42,0.5)', fontSize: 14 }}>
              Creating login…
            </div>
          )}

          {/* — Result state — */}
          {result && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: result.outcome === 'CREATED' ? 'rgba(22,163,74,0.08)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${result.outcome === 'CREATED' ? 'rgba(22,163,74,0.3)' : 'rgba(59,130,246,0.3)'}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <span style={{ fontSize: 22 }}>{result.outcome === 'CREATED' ? '✅' : '🔗'}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: result.outcome === 'CREATED' ? '#166534' : '#1e40af' }}>
                    {result.message}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', marginTop: 2 }}>
                    {result.outcome === 'CREATED' ? 'New account created with PARENT role.' : 'Existing parent account is now linked to this student.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 700, minWidth: 120, color: 'rgba(15,23,42,0.52)' }}>Username</span>
                  <span style={{ wordBreak: 'break-all' }}>{result.username}</span>
                </div>
              </div>

              {result.temporaryPassword && (
                <div style={{ background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.10)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(15,23,42,0.4)', marginBottom: 6 }}>
                    Temporary Password — shown once only
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <code style={{ flex: 1, fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(15,23,42,0.88)', wordBreak: 'break-all' }}>
                      {result.temporaryPassword}
                    </code>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ fontSize: 12, padding: '5px 10px', flexShrink: 0 }}
                      onClick={() => handleCopy(result.temporaryPassword!)}
                    >
                      {copied ? 'Copied ✓' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: '#b45309', marginTop: 8 }}>
                    Share this password securely. It will not be shown again.
                  </div>
                </div>
              )}

              <button type="button" className="btn" onClick={onDone} style={{ width: '100%' }}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}





