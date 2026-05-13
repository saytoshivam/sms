/**
 * Staff & Teachers — Production directory page.
 *
 * Data: GET /api/v1/onboarding/staff + academic-structure for workload
 * Features: summary tiles, multi-filter, desktop table, mobile cards,
 *           kebab menu with real/stub actions clearly distinguished.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { useApiTags } from '../../lib/apiTags';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StaffOnboardingWizard } from '../../components/StaffOnboardingWizard';
import { StaffReadinessDashboard } from '../../components/StaffReadinessDashboard';
import { buildEffectiveAllocRows, type ClassSubjectConfigRow, type SectionSubjectOverrideRow } from '../../lib/academicStructureUtils';
import { isWorkspaceReadOnly } from '../../lib/workspaceViewMode';

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffRow = {
  staffId: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  employeeNo: string | null;
  designation: string | null;
  roles: string[];
  subjectCodes: string[];
  hasLoginAccount: boolean;
  maxWeeklyLectureLoad?: number | null;
  preferredClassGroupIds?: number[];
  // New fields from upgraded API (gracefully absent for old responses)
  staffType?: string | null;   // TEACHING | NON_TEACHING | ADMIN | SUPPORT
  status?: string | null;      // DRAFT | ACTIVE | INACTIVE | EXITED | etc.
  department?: string | null;
  loginStatus?: string | null; // NONE | ACTIVE
  timetableEligible?: boolean;
};

type SubjectCatalogRow = { id: number; code: string; name: string };

type AcademicStructure = {
  classGroups: { classGroupId: number }[];
  classSubjectConfigs: ClassSubjectConfigRow[];
  sectionSubjectOverrides: SectionSubjectOverrideRow[];
  allocations: { classGroupId: number; subjectId: number; weeklyFrequency: number; staffId: number | null; roomId: number | null }[];
};

// ─── Visual helpers ───────────────────────────────────────────────────────────

const BASE_BADGE: React.CSSProperties = {
  display: 'inline-block', padding: '2px 7px', borderRadius: 999,
  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
};

function initials(name: string) { return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase(); }

function avatarColor(name: string): string {
  const c = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#9333ea','#0284c7'];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38, userSelect: 'none' }}>
      {initials(name)}
    </div>
  );
}

function effectiveStaffType(row: StaffRow): string {
  if (row.staffType) return row.staffType;
  if (row.roles.some(r => r === 'TEACHER')) return 'TEACHING';
  if (row.roles.some(r => ['PRINCIPAL','VICE_PRINCIPAL','HOD','ACCOUNTANT','SCHOOL_ADMIN'].includes(r))) return 'ADMIN';
  return 'NON_TEACHING';
}

function effectiveStatus(row: StaffRow): string { return row.status ?? 'ACTIVE'; }

function effectiveTimetableEligible(row: StaffRow): boolean {
  if (typeof row.timetableEligible === 'boolean') return row.timetableEligible;
  return effectiveStaffType(row) === 'TEACHING' && row.roles.includes('TEACHER') && row.subjectCodes.length > 0;
}

function typeBadge(type: string): React.CSSProperties {
  return { ...BASE_BADGE, ...({ TEACHING: { background: 'rgba(37,99,235,0.1)', color: '#1e40af' }, NON_TEACHING: { background: 'rgba(124,58,237,0.1)', color: '#6d28d9' }, ADMIN: { background: 'rgba(8,145,178,0.1)', color: '#0e7490' }, SUPPORT: { background: 'rgba(15,23,42,0.07)', color: '#475569' } }[type] ?? { background: 'rgba(15,23,42,0.07)', color: '#475569' }) };
}

function typeLabel(type: string): string { return { TEACHING: 'Teaching', NON_TEACHING: 'Non-Teaching', ADMIN: 'Admin', SUPPORT: 'Support' }[type] ?? type; }

function statusBadge(status: string): React.CSSProperties {
  return { ...BASE_BADGE, ...({ ACTIVE: { background: 'rgba(22,163,74,0.12)', color: '#166534' }, DRAFT: { background: 'rgba(234,179,8,0.12)', color: '#854d0e' }, INACTIVE: { background: 'rgba(15,23,42,0.07)', color: '#64748b' }, ON_LEAVE: { background: 'rgba(8,145,178,0.1)', color: '#0e7490' }, EXITED: { background: 'rgba(15,23,42,0.07)', color: '#64748b' }, SUSPENDED: { background: 'rgba(220,38,38,0.1)', color: '#991b1b' } }[status] ?? { background: 'rgba(15,23,42,0.07)', color: '#64748b' }) };
}

function loginBadge(hasLogin: boolean, loginStatus?: string | null): React.CSSProperties {
  const s = loginStatus ?? (hasLogin ? 'ACTIVE' : 'NONE');
  return { ...BASE_BADGE, ...({ ACTIVE: { background: 'rgba(22,163,74,0.12)', color: '#166534' }, INVITED: { background: 'rgba(234,179,8,0.1)', color: '#92400e' }, DISABLED: { background: 'rgba(220,38,38,0.08)', color: '#991b1b' }, NONE: { background: 'rgba(15,23,42,0.06)', color: '#64748b' } }[s] ?? { background: 'rgba(15,23,42,0.06)', color: '#64748b' }) };
}

function loginLabel(hasLogin: boolean, loginStatus?: string | null): string {
  return ({ ACTIVE: 'Active', INVITED: 'Invited', DISABLED: 'Disabled', NONE: 'No login' }[loginStatus ?? (hasLogin ? 'ACTIVE' : 'NONE')] ?? 'No login');
}

function roleBadge(role: string): React.CSSProperties {
  return { ...BASE_BADGE, ...({ TEACHER: { background: 'rgba(37,99,235,0.1)', color: '#1e40af' }, HOD: { background: 'rgba(124,58,237,0.1)', color: '#6d28d9' }, PRINCIPAL: { background: 'rgba(220,38,38,0.09)', color: '#991b1b' }, VICE_PRINCIPAL: { background: 'rgba(220,38,38,0.06)', color: '#b91c1c' }, ACCOUNTANT: { background: 'rgba(5,150,105,0.1)', color: '#065f46' }, SCHOOL_ADMIN: { background: 'rgba(234,88,12,0.1)', color: '#7c2d12' } }[role] ?? { background: 'rgba(15,23,42,0.07)', color: '#334155' }) };
}

function fmtStatus(s: string) { return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '); }

// ─── Summary tile ─────────────────────────────────────────────────────────────

function Tile({ label, value, color, note }: { label: string; value: number | string; color?: string; note?: string }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.025)', border: '1px solid rgba(15,23,42,0.07)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? 'rgba(15,23,42,0.8)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>{label}</div>
      {note && <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.35)', marginTop: 2 }}>{note}</div>}
    </div>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────

function FSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)', background: '#fff', minWidth: 110 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// ─── Row kebab menu ───────────────────────────────────────���───────────────────

function RowMenu({ canEdit, staffId, onEdit, onDelete }: { canEdit: boolean; staffId: number; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const Btn = ({ onClick, danger = false, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: danger ? '#991b1b' : 'rgba(15,23,42,0.8)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(220,38,38,0.06)' : 'rgba(15,23,42,0.04)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
    >{children}</button>
  );

  const Stub = ({ label, reason }: { label: string; reason: string }) => (
    <button type="button" disabled title={reason} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'not-allowed', color: 'rgba(15,23,42,0.3)' }}>
      {label} <span style={{ fontSize: 10 }}>· coming soon</span>
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(v => !v)} title="More actions"
        style={{ width: 30, height: 30, border: '1px solid rgba(15,23,42,0.13)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.5)', fontSize: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>⋯</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 4, zIndex: 9999, background: '#fff', border: '1px solid rgba(15,23,42,0.11)', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.15)', minWidth: 190, padding: '4px 0' }}>
            <Link to={`/app/teachers/${staffId}`} style={{ display: 'block', textDecoration: 'none' }}>
              <Btn onClick={() => setOpen(false)}>👤 View Profile</Btn>
            </Link>
            {canEdit && <Btn onClick={() => { setOpen(false); onEdit(); }}>✏️ Edit</Btn>}
            {canEdit && <Btn onClick={() => { setOpen(false); onDelete(); }} danger>🗑 Delete</Btn>}
          <div style={{ borderTop: '1px solid rgba(15,23,42,0.07)', margin: '4px 0' }} />
          <Stub label="📋 Documents" reason="Staff document module not yet implemented" />
          <Stub label="💰 Payroll"   reason="Payroll module not yet implemented" />
          <Stub label="📅 Leave"     reason="Leave management not yet implemented" />
        </div>
      )}
    </div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

const ROLE_CHOICES = ['TEACHER','HOD','VICE_PRINCIPAL','PRINCIPAL','ACCOUNTANT','CLERK','SCHOOL_ADMIN'] as const;
const inputSt: React.CSSProperties = { fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)', width: '100%', boxSizing: 'border-box' };

type EditDraft = { fullName: string; email: string; phone: string; designation: string; employeeNo: string; roles: string[]; teachableSubjectIds: number[]; createLoginAccount: boolean; maxWeeklyLectureLoad: number | ''; };
function EF({ label, flex, children }: { label: string; flex?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: flex ?? '1 1 200px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

function EditModal({ staffId, initial, subjects, busy, onSave, onClose }: { staffId: number; initial: EditDraft; subjects: SubjectCatalogRow[]; busy: boolean; onSave: (id: number, body: object) => void; onClose: () => void; }) {
  const [d, setD] = useState(initial);

  const save = () => {
    if (!d.fullName.trim()) { toast.error('Validation', 'Full name is required.'); return; }
    if (!d.phone.trim())    { toast.error('Validation', 'Phone is required.'); return; }
    if (!d.designation.trim()) { toast.error('Validation', 'Designation is required.'); return; }
    if (d.roles.length === 0)  { toast.error('Validation', 'At least one role is required.'); return; }
    const isTeacher = d.roles.includes('TEACHER');
    // Build structured StaffOnboardingRequest body matching PUT /api/v1/onboarding/staff/{id}/onboard
    onSave(staffId, {
      identity: {
        fullName: d.fullName.trim(),
        phone: d.phone.trim(),
        email: d.email.trim() || null,
        employeeNo: d.employeeNo.trim() || null,
      },
      employment: {
        staffType: 'TEACHING',
        designation: d.designation.trim(),
      },
      rolesAndAccess: {
        roles: d.roles,
        createLoginAccount: d.createLoginAccount,
      },
      academicCapabilities: isTeacher ? {
        teachableSubjectIds: d.teachableSubjectIds,
        maxWeeklyLectureLoad: d.maxWeeklyLectureLoad === '' ? null : Math.max(0, Math.trunc(Number(d.maxWeeklyLectureLoad))),
        preferredClassGroupIds: [],
      } : null,
    });
  };

  const toggleRole = (r: string) => setD(p => ({ ...p, roles: p.roles.includes(r) ? p.roles.filter(x => x !== r) : [...p.roles, r] }));
  const toggleSub  = (id: number) => setD(p => ({ ...p, teachableSubjectIds: p.teachableSubjectIds.includes(id) ? p.teachableSubjectIds.filter(x => x !== id) : [...p.teachableSubjectIds, id] }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 16, boxShadow: '0 28px 60px rgba(15,23,42,0.2)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Edit Staff</div>
          <button type="button" onClick={onClose} disabled={busy} style={{ width: 28, height: 28, border: 'none', background: 'rgba(15,23,42,0.07)', borderRadius: 6, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <EF label="Full name *" flex="2 1 200px"><input value={d.fullName} onChange={e => setD({ ...d, fullName: e.target.value })} style={inputSt} /></EF>
            <EF label="Employee no" flex="1 1 130px"><input value={d.employeeNo} onChange={e => setD({ ...d, employeeNo: e.target.value })} style={inputSt} /></EF>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <EF label="Phone *" flex="1 1 150px"><input value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} style={inputSt} /></EF>
            <EF label="Email" flex="2 1 200px"><input value={d.email} onChange={e => setD({ ...d, email: e.target.value })} style={inputSt} /></EF>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <EF label="Designation *" flex="2 1 180px"><input value={d.designation} onChange={e => setD({ ...d, designation: e.target.value })} style={inputSt} /></EF>
            <EF label="Max weekly periods" flex="1 1 140px"><input type="number" min={0} max={60} value={d.maxWeeklyLectureLoad === '' ? '' : d.maxWeeklyLectureLoad} onChange={e => setD({ ...d, maxWeeklyLectureLoad: e.target.value === '' ? '' : Math.max(0, Math.trunc(Number(e.target.value))) })} style={inputSt} /></EF>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Roles *</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ROLE_CHOICES.map(r => { const on = d.roles.includes(r); return (
              <button key={r} type="button" onClick={() => toggleRole(r)}
                style={{ padding: '4px 11px', borderRadius: 999, border: on ? '1.5px solid #ea580c' : '1px solid rgba(15,23,42,0.15)', background: on ? 'rgba(234,88,12,0.12)' : '#fff', color: on ? '#7c2d12' : '#475569', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {r}
              </button>
            ); })}
          </div>
        </div>

        {d.roles.includes('TEACHER') && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Teachable Subjects ({d.teachableSubjectIds.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 150, overflowY: 'auto', padding: 6, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 8 }}>
              {subjects.length === 0
                ? <span style={{ fontSize: 12, color: 'rgba(15,23,42,0.4)' }}>No subjects yet.</span>
                : subjects.map(s => { const on = d.teachableSubjectIds.includes(s.id); return (
                    <button key={s.id} type="button" title={s.name} onClick={() => toggleSub(s.id)}
                      style={{ padding: '3px 9px', borderRadius: 999, border: on ? '1.5px solid #16a34a' : '1px solid rgba(15,23,42,0.13)', background: on ? 'rgba(22,163,74,0.1)' : '#fff', color: on ? '#166534' : '#475569', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {s.code}
                    </button>
                  ); })}
            </div>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.createLoginAccount} onChange={e => setD({ ...d, createLoginAccount: e.target.checked })} />
          Maintain login account
          {!d.email.trim() && d.createLoginAccount && <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>⚠ Email required</span>}
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy} style={{ fontSize: 13, padding: '8px 16px' }}>Cancel</button>
          <button type="button" className="btn" onClick={save} disabled={busy} style={{ fontSize: 13, padding: '8px 16px' }}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV export helper ───────────────────────────────────────────────────────

function downloadStaffCsv(rows: StaffRow[]) {
  const headers = [
    'staffId', 'fullName', 'email', 'phone', 'employeeNo', 'designation',
    'staffType', 'status', 'department', 'employmentType', 'roles', 'subjects',
    'hasLoginAccount', 'maxWeeklyLectureLoad',
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.staffId,
      r.fullName,
      r.email ?? '',
      r.phone ?? '',
      r.employeeNo ?? '',
      r.designation ?? '',
      effectiveStaffType(r),
      effectiveStatus(r),
      r.department ?? '',
      (r as StaffRow & { employmentType?: string | null }).employmentType ?? '',
      r.roles.join('|'),
      r.subjectCodes.join('|'),
      r.hasLoginAccount ? 'true' : 'false',
      r.maxWeeklyLectureLoad ?? '',
    ].map(esc).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `staff-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TeachersModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canEdit = !isWorkspaceReadOnly(searchParams);
  const invalidate = useApiTags();
  const navigate = useNavigate();

  // ── View tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'directory' | 'readiness'>('directory');

  // ── Queries ──────────────────────────────────────────────────────────────────
  const staffQ = useQuery({ queryKey: ['onboarding-staff-view'], queryFn: async () => (await api.get<StaffRow[]>('/api/v1/onboarding/staff')).data });
  const subjectsQ = useQuery({ queryKey: ['subjects-catalog'], queryFn: async () => (await api.get<{ content: SubjectCatalogRow[] }>('/api/subjects?size=1000&sort=name,asc')).data, staleTime: 60_000 });
  const academicQ = useQuery({ queryKey: ['onboarding-academic-structure'], queryFn: async () => (await api.get<AcademicStructure>('/api/v1/onboarding/academic-structure')).data, staleTime: 60_000 });

  const allStaff: StaffRow[] = staffQ.data ?? [];
  const subjects: SubjectCatalogRow[] = subjectsQ.data?.content ?? [];

  // ── Workload map ──────────────────────────────────────────────────────────────
  const usageByStaff = useMemo(() => {
    const d = academicQ.data;
    if (!d) return new Map<number, { periods: number }>();
    const rows = (d.classSubjectConfigs?.length ?? 0) > 0
      ? buildEffectiveAllocRows(d.classGroups as any, d.classSubjectConfigs, d.sectionSubjectOverrides).map(r => ({ staffId: r.staffId, wf: r.weeklyFrequency }))
      : (d.allocations ?? []).map(a => ({ staffId: a.staffId, wf: a.weeklyFrequency }));
    const m = new Map<number, { periods: number }>();
    for (const r of rows) {
      if (r.staffId == null) continue;
      const cur = m.get(r.staffId) ?? { periods: 0 };
      cur.periods += r.wf > 0 ? r.wf : 0;
      m.set(r.staffId, cur);
    }
    return m;
  }, [academicQ.data]);

  // ── Filters ───────────────────────────────────────────────────────────────────
  const [search,     setSearch]     = useState('');
  const [fType,      setFType]      = useState('ALL');
  const [fRole,      setFRole]      = useState('ALL');
  const [fDept,      setFDept]      = useState('ALL');
  const [fStatus,    setFStatus]    = useState('ALL');
  const [fLogin,     setFLogin]     = useState('ALL');
  const [fTimetable, setFTimetable] = useState('ALL');

  const departments = useMemo(() => Array.from(new Set(allStaff.map(s => s.department).filter(Boolean) as string[])).sort(), [allStaff]);
  const allRoles    = useMemo(() => Array.from(new Set(allStaff.flatMap(s => s.roles))).sort(), [allStaff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStaff.filter(s => {
      if (q && ![s.fullName, s.email ?? '', s.phone ?? '', s.employeeNo ?? ''].some(v => v.toLowerCase().includes(q))) return false;
      if (fType !== 'ALL' && effectiveStaffType(s) !== fType) return false;
      if (fRole !== 'ALL' && !s.roles.includes(fRole)) return false;
      if (fDept !== 'ALL' && s.department !== fDept) return false;
      if (fStatus !== 'ALL' && effectiveStatus(s) !== fStatus) return false;
      if (fLogin === 'HAS' && !s.hasLoginAccount) return false;
      if (fLogin === 'NONE' &&  s.hasLoginAccount) return false;
      if (fTimetable === 'YES' && !effectiveTimetableEligible(s)) return false;
      if (fTimetable === 'NO'  &&  effectiveTimetableEligible(s)) return false;
      return true;
    });
  }, [allStaff, search, fType, fRole, fDept, fStatus, fLogin, fTimetable]);

  const activeStaff  = allStaff.filter(s => effectiveStatus(s) === 'ACTIVE');
  const teaching     = allStaff.filter(s => effectiveStaffType(s) === 'TEACHING');
  const nonTeaching  = allStaff.filter(s => effectiveStaffType(s) !== 'TEACHING');
  const missingLogin = allStaff.filter(s => !s.hasLoginAccount);
  const ttEligible   = allStaff.filter(s => effectiveTimetableEligible(s));
  const hasFilters   = search || fType !== 'ALL' || fRole !== 'ALL' || fDept !== 'ALL' || fStatus !== 'ALL' || fLogin !== 'ALL' || fTimetable !== 'ALL';

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const [showWizard, setShowWizard] = useState(false);
  const [delConfirm, setDelConfirm] = useState<{ open: boolean; staffId?: number; fullName?: string }>({ open: false });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/api/v1/onboarding/staff/${id}`); },
    onSuccess: async () => { toast.success('Staff removed.'); setDelConfirm({ open: false }); await invalidate(['staff']); },
    onError: (e) => toast.error('Could not remove', formatApiError(e)),
  });

  const [editTarget, setEditTarget] = useState<{ staffId: number; draft: EditDraft } | null>(null);

  const openEdit = useCallback((row: StaffRow) => setEditTarget({
    staffId: row.staffId,
    draft: {
      fullName: row.fullName, email: row.email ?? '', phone: row.phone ?? '',
      designation: row.designation ?? '', employeeNo: row.employeeNo ?? '',
      roles: [...row.roles],
      teachableSubjectIds: subjects.filter(s => row.subjectCodes.includes(s.code)).map(s => s.id),
      createLoginAccount: row.hasLoginAccount,
      maxWeeklyLectureLoad: row.maxWeeklyLectureLoad ?? '',
    },
  }), [subjects]);

  // ── Open edit modal when ?edit=<staffId> is in the URL ──────────────────────
  // Used by the "Edit Profile" button on StaffProfilePage which navigates to
  // /app/teachers?edit=<id> to open the edit form for a specific staff member.
  const editIdParam = searchParams.get('edit');
  useEffect(() => {
    if (!editIdParam || staffQ.isLoading || !staffQ.data || !subjectsQ.data) return;
    const id = parseInt(editIdParam, 10);
    if (isNaN(id)) return;
    const row = staffQ.data.find((s: StaffRow) => s.staffId === id);
    if (!row) return;
    openEdit(row);
    setSearchParams(params => { params.delete('edit'); return params; }, { replace: true });
  }, [editIdParam, staffQ.isLoading, staffQ.data, subjectsQ.data, openEdit, setSearchParams]);

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: object }) => { await api.put(`/api/v1/onboarding/staff/${id}/onboard`, body); },
    onSuccess: async () => { toast.success('Staff updated.'); setEditTarget(null); await invalidate(['staff']); },
    onError: (e) => toast.error('Could not update', formatApiError(e)),
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  if (staffQ.isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(15,23,42,0.4)' }}>Loading staff…</div>;
  if (staffQ.isError)   return <div style={{ padding: 24, color: '#b91c1c' }}>⚠ Failed to load staff. {formatApiError(staffQ.error)}</div>;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(12px,3vw,24px)', display: 'grid', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(18px,3vw,24px)', fontWeight: 950, letterSpacing: '-0.02em', color: 'rgba(15,23,42,0.9)' }}>Staff &amp; Teachers</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(15,23,42,0.5)', fontWeight: 600 }}>{allStaff.length} total · {activeStaff.length} active · {teaching.length} teachers</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && (
            <button type="button" className="btn" style={{ fontSize: 13, padding: '7px 14px' }}
              onClick={() => setShowWizard(true)}>
              + Add Staff
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn secondary" style={{ fontSize: 13, padding: '7px 14px' }}
              title="Bulk CSV import is in Setup Wizard → Staff"
              onClick={() => toast.info('Bulk Import', 'Use Setup Wizard → Staff step to import staff via CSV.')}>
              ↑ Bulk Import
            </button>
          )}
          <button type="button" className="btn secondary" style={{ fontSize: 13, padding: '7px 14px' }}
            title={`Export ${filtered.length} staff member(s) to CSV`}
            onClick={() => {
              if (filtered.length === 0) { toast.info('Nothing to export', 'No staff match the current filters.'); return; }
              downloadStaffCsv(filtered);
              toast.success('Exported', `${filtered.length} staff member(s) downloaded.`);
            }}>
            ↓ Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid rgba(15,23,42,0.08)' }}>
        {([
          { id: 'directory', label: '👥 Directory' },
          { id: 'readiness', label: '✅ Onboarding Readiness' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 700,
              background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? '#2563eb' : 'transparent'}`,
              color: activeTab === tab.id ? '#2563eb' : 'rgba(15,23,42,0.5)',
              cursor: 'pointer', marginBottom: -2, whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Readiness tab ──────────────────────────────────────────────── */}
      {activeTab === 'readiness' && <StaffReadinessDashboard />}

      {/* ── Directory tab ──────────────────────────────────────────────── */}
      {activeTab === 'directory' && (<>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        <Tile label="Total Active"  value={activeStaff.length}  color="rgba(15,23,42,0.85)" />
        <Tile label="Teachers"      value={teaching.length}     color="#1e40af" />
        <Tile label="Non-Teaching"  value={nonTeaching.length}  color="#6d28d9" />
        <Tile label="Missing Login" value={missingLogin.length} color={missingLogin.length > 0 ? '#92400e' : '#166534'} note={missingLogin.length > 0 ? 'Without login accounts' : undefined} />
        <Tile label="TT Eligible"   value={ttEligible.length}   color="#0e7490" note="Timetable-ready" />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(15,23,42,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, employee no, phone, email…"
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)', background: '#fff' }} />
        </label>
        <FSelect label="Type" value={fType} onChange={setFType} options={[{ value: 'ALL', label: 'All types' }, { value: 'TEACHING', label: 'Teaching' }, { value: 'NON_TEACHING', label: 'Non-Teaching' }, { value: 'ADMIN', label: 'Admin' }, { value: 'SUPPORT', label: 'Support' }]} />
        <FSelect label="Role" value={fRole} onChange={setFRole} options={[{ value: 'ALL', label: 'All roles' }, ...allRoles.map(r => ({ value: r, label: r }))]} />
        {departments.length > 0 && <FSelect label="Department" value={fDept} onChange={setFDept} options={[{ value: 'ALL', label: 'All depts' }, ...departments.map(d => ({ value: d, label: d }))]} />}
        <FSelect label="Status" value={fStatus} onChange={setFStatus} options={[{ value: 'ALL', label: 'All statuses' }, { value: 'ACTIVE', label: 'Active' }, { value: 'DRAFT', label: 'Draft' }, { value: 'INACTIVE', label: 'Inactive' }, { value: 'ON_LEAVE', label: 'On Leave' }, { value: 'EXITED', label: 'Exited' }, { value: 'SUSPENDED', label: 'Suspended' }]} />
        <FSelect label="Login" value={fLogin} onChange={setFLogin} options={[{ value: 'ALL', label: 'All' }, { value: 'HAS', label: 'Has login' }, { value: 'NONE', label: 'No login' }]} />
        <FSelect label="Timetable" value={fTimetable} onChange={setFTimetable} options={[{ value: 'ALL', label: 'All' }, { value: 'YES', label: 'Eligible' }, { value: 'NO', label: 'Not eligible' }]} />
        {hasFilters && (
          <button type="button" onClick={() => { setSearch(''); setFType('ALL'); setFRole('ALL'); setFDept('ALL'); setFStatus('ALL'); setFLogin('ALL'); setFTimetable('ALL'); }}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)', background: 'rgba(15,23,42,0.04)', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-end', marginBottom: 1 }}>
            Clear filters
          </button>
        )}
      </div>

      {hasFilters && (
        <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', fontWeight: 600, marginTop: -10 }}>
          Showing {filtered.length} of {allStaff.length} staff
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(15,23,42,0.5)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{allStaff.length === 0 ? 'No staff added yet' : 'No match for these filters'}</div>
          <div style={{ fontSize: 13 }}>{allStaff.length === 0 ? 'Use "+ Add Staff" or the setup wizard to add your team.' : 'Try adjusting the filters above.'}</div>
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <div className="card staff-dir-table-wrap" style={{ padding: 0, overflow: 'visible' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Staff', 'Type / Designation', 'Roles', 'Subjects', 'Workload', 'Login', 'Status', ''].map(col => (
                    <th key={col} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(15,23,42,0.45)', whiteSpace: 'nowrap', background: 'rgba(250,250,249,0.98)', borderBottom: '1px solid rgba(15,23,42,0.07)', position: 'sticky', top: 0 }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const usage  = usageByStaff.get(row.staffId);
                  const cap    = row.maxWeeklyLectureLoad ?? 0;
                  const over   = cap > 0 && usage && usage.periods > cap;
                  const type   = effectiveStaffType(row);
                  const status = effectiveStatus(row);

                  return (
                    <tr key={row.staffId} style={{ borderBottom: '1px solid rgba(15,23,42,0.055)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.018)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={row.fullName} size={36} />
                          <div style={{ minWidth: 0 }}>
                            <Link to={`/app/teachers/${row.staffId}`} style={{ fontWeight: 700, color: 'rgba(15,23,42,0.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>{row.fullName}</Link>
                            <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)', fontWeight: 600 }}>{row.employeeNo ?? '—'}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', minWidth: 140 }}>
                        <span style={typeBadge(type)}>{typeLabel(type)}</span>
                        {row.designation && <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.45)', marginTop: 3, fontWeight: 600 }}>{row.designation}</div>}
                        {row.department  && <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.35)', fontWeight: 500 }}>{row.department}</div>}
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', minWidth: 140 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {row.roles.length === 0
                            ? <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.3)' }}>—</span>
                            : row.roles.slice(0, 3).map(r => <span key={r} style={roleBadge(r)}>{r}</span>)}
                          {row.roles.length > 3 && <span style={{ ...BASE_BADGE, background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>+{row.roles.length - 3}</span>}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', minWidth: 110 }}>
                        {row.subjectCodes.length === 0
                          ? <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.3)' }}>—</span>
                          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {row.subjectCodes.slice(0, 4).map(c => <span key={c} style={{ ...BASE_BADGE, background: 'rgba(5,150,105,0.09)', color: '#065f46', fontSize: 10 }}>{c}</span>)}
                              {row.subjectCodes.length > 4 && <span style={{ ...BASE_BADGE, background: 'rgba(15,23,42,0.05)', color: '#64748b', fontSize: 10 }}>+{row.subjectCodes.length - 4}</span>}
                            </div>}
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', minWidth: 90, fontVariantNumeric: 'tabular-nums' }}>
                        {usage
                          ? <div>
                              <span style={{ fontWeight: 700, color: over ? '#b91c1c' : 'rgba(15,23,42,0.8)' }}>{usage.periods}</span>
                              {cap > 0 && <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.4)' }}>/{cap}</span>}
                              <div style={{ fontSize: 10, color: 'rgba(15,23,42,0.4)' }}>per week</div>
                              {over && <span style={{ ...BASE_BADGE, background: 'rgba(220,38,38,0.08)', color: '#991b1b', fontSize: 10, marginTop: 2 }}>Over cap</span>}
                            </div>
                          : <span style={{ fontSize: 11, color: 'rgba(15,23,42,0.3)' }}>—</span>}
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <span style={loginBadge(row.hasLoginAccount, row.loginStatus)}>{loginLabel(row.hasLoginAccount, row.loginStatus)}</span>
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                        <span style={statusBadge(status)}>{fmtStatus(status)}</span>
                      </td>

                      <td style={{ padding: '10px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <RowMenu canEdit={canEdit} staffId={row.staffId} onEdit={() => openEdit(row)} onDelete={() => setDelConfirm({ open: true, staffId: row.staffId, fullName: row.fullName })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile card list */}
      {filtered.length > 0 && (
        <div className="staff-dir-card-list" style={{ display: 'grid', gap: 12 }}>
          {filtered.map(row => {
            const usage  = usageByStaff.get(row.staffId);
            const cap    = row.maxWeeklyLectureLoad ?? 0;
            const over   = cap > 0 && usage && usage.periods > cap;
            const type   = effectiveStaffType(row);
            const status = effectiveStatus(row);

            return (
              <div key={row.staffId} className="card" style={{ padding: '14px 16px', display: 'grid', gap: 10, backdropFilter: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Avatar name={row.fullName} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'rgba(15,23,42,0.88)' }}>{row.fullName}</div>
                    <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.5)', fontWeight: 600 }}>{row.employeeNo ?? row.designation ?? '—'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                      <span style={typeBadge(type)}>{typeLabel(type)}</span>
                      <span style={statusBadge(status)}>{fmtStatus(status)}</span>
                      <span style={loginBadge(row.hasLoginAccount, row.loginStatus)}>{loginLabel(row.hasLoginAccount, row.loginStatus)}</span>
                    </div>
                  </div>
                  <RowMenu canEdit={canEdit} staffId={row.staffId} onEdit={() => openEdit(row)} onDelete={() => setDelConfirm({ open: true, staffId: row.staffId, fullName: row.fullName })} />
                </div>

                {row.roles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {row.roles.map(r => <span key={r} style={roleBadge(r)}>{r}</span>)}
                  </div>
                )}

                {row.subjectCodes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {row.subjectCodes.map(c => <span key={c} style={{ ...BASE_BADGE, background: 'rgba(5,150,105,0.09)', color: '#065f46', fontSize: 11 }}>{c}</span>)}
                  </div>
                )}

                {usage && (
                  <div style={{ fontSize: 12, color: over ? '#b91c1c' : 'rgba(15,23,42,0.55)', fontWeight: 600 }}>
                    {usage.periods}{cap > 0 ? `/${cap}` : ''} periods/week
                    {over && <span style={{ marginLeft: 6, ...BASE_BADGE, background: 'rgba(220,38,38,0.08)', color: '#991b1b', fontSize: 10 }}>Over capacity</span>}
                  </div>
                )}

                {(row.phone || row.email) && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'rgba(15,23,42,0.5)', fontWeight: 600 }}>
                    {row.phone && <span>📞 {row.phone}</span>}
                    {row.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>✉ {row.email}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {/* Delete confirm */}
      <ConfirmDialog
        open={delConfirm.open}
        title={`Remove ${delConfirm.fullName ?? 'staff member'}?`}
        description="This removes the staff record and login account. Academic structure references are cleared. Timetable entries block deletion."
        confirmLabel="Remove" danger
        onConfirm={() => { if (delConfirm.staffId != null) deleteMut.mutate(delConfirm.staffId); }}
        onClose={() => setDelConfirm({ open: false })}
      />

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          staffId={editTarget.staffId}
          initial={editTarget.draft}
          subjects={subjects}
          busy={updateMut.isPending}
          onSave={(id, body) => updateMut.mutate({ id, body })}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Staff Onboarding Wizard */}
      {showWizard && (
        <StaffOnboardingWizard
          onClose={() => setShowWizard(false)}
          onSuccess={async (staffId) => {
            setShowWizard(false);
            await invalidate(['staff']);
            navigate(`/app/teachers/${staffId}`);
          }}
        />
      )}
    </div>
  );
}
