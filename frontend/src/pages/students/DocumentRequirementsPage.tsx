import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentTargetType = 'STUDENT' | 'TEACHER' | 'GUARDIAN' | 'STAFF' | 'GENERAL';

type DocumentRequirementStatus = 'REQUIRED' | 'OPTIONAL' | 'NOT_REQUIRED';

type DocumentTypeDTO = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  targetType: DocumentTargetType;
  systemDefined: boolean;
  active: boolean;
  sortOrder: number;
};

type SchoolDocumentRequirementDTO = {
  id?: number;
  documentTypeId: number;
  documentTypeCode: string;
  documentTypeName: string;
  documentTypeDescription?: string | null;
  targetType: DocumentTargetType;
  requirementStatus: DocumentRequirementStatus;
  active: boolean;
  sortOrder: number;
};

type SavePayloadItem = {
  documentTypeId?: number;
  code?: string;
  name?: string;
  requirementStatus: DocumentRequirementStatus;
  sortOrder: number;
};

type ApplyResult = {
  studentsProcessed: number;
  documentRowsCreated: number;
  message: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REQ_LABELS: Record<DocumentRequirementStatus, string> = {
  REQUIRED:     'Required',
  OPTIONAL:     'Optional',
  NOT_REQUIRED: 'Not Required',
};

const REQ_COLOR: Record<DocumentRequirementStatus, { bg: string; color: string }> = {
  REQUIRED:     { bg: 'rgba(22,163,74,0.11)',  color: '#166534' },
  OPTIONAL:     { bg: 'rgba(59,130,246,0.11)', color: '#1e40af' },
  NOT_REQUIRED: { bg: 'rgba(15,23,42,0.07)',   color: 'rgba(15,23,42,0.45)' },
};

// ─── RequirementRow ───────────────────────────────────────────────────────────

type WorkingRow = {
  /** null for new custom rows not yet in the DB */
  documentTypeId: number | null;
  code: string;
  name: string;
  description: string;
  requirementStatus: DocumentRequirementStatus;
  sortOrder: number;
  isCustom: boolean;
};

function buildWorkingRows(
  allTypes: DocumentTypeDTO[],
  schoolReqs: SchoolDocumentRequirementDTO[],
): WorkingRow[] {
  const reqByTypeId = new Map(schoolReqs.map((r) => [r.documentTypeId, r]));
  // All system types + any custom school types that aren't in the system catalogue
  const systemTypeIds = new Set(allTypes.map((t) => t.id));

  const rows: WorkingRow[] = allTypes.map((t) => {
    const req = reqByTypeId.get(t.id);
    return {
      documentTypeId: t.id,
      code: t.code,
      name: t.name,
      description: t.description ?? '',
      requirementStatus: req?.requirementStatus ?? 'NOT_REQUIRED',
      sortOrder: req?.sortOrder ?? t.sortOrder,
      isCustom: !t.systemDefined,
    };
  });

  // Add any school-configured types that aren't in the system catalogue (custom types)
  for (const req of schoolReqs) {
    if (!systemTypeIds.has(req.documentTypeId)) {
      rows.push({
        documentTypeId: req.documentTypeId,
        code: req.documentTypeCode,
        name: req.documentTypeName,
        description: req.documentTypeDescription ?? '',
        requirementStatus: req.requirementStatus,
        sortOrder: req.sortOrder,
        isCustom: true,
      });
    }
  }

  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── Tab panel ────────────────────────────────────────────────────────────────

function RequirementsPanel({
  targetType,
  tabLabel,
}: {
  targetType: DocumentTargetType;
  tabLabel: string;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<WorkingRow[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const allTypesQ = useQuery<DocumentTypeDTO[]>({
    queryKey: ['document-types', targetType],
    queryFn: async () =>
      (await api.get<DocumentTypeDTO[]>('/api/document-types', { params: { targetType } })).data,
  });

  const schoolReqsQ = useQuery<SchoolDocumentRequirementDTO[]>({
    queryKey: ['school-document-requirements', targetType],
    queryFn: async () =>
      (await api.get<SchoolDocumentRequirementDTO[]>('/api/schools/document-requirements', {
        params: { targetType },
      })).data,
  });

  // Re-build working rows when both queries succeed and rows haven't been touched yet
  React.useEffect(() => {
    if (allTypesQ.data && schoolReqsQ.data && rows === null) {
      setRows(buildWorkingRows(allTypesQ.data, schoolReqsQ.data));
    }
  }, [allTypesQ.data, schoolReqsQ.data, rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        targetType,
        requirements: (rows ?? [])
          .filter((r) => r.requirementStatus !== 'NOT_REQUIRED' || r.documentTypeId != null)
          .map((r, idx): SavePayloadItem => ({
            documentTypeId: r.documentTypeId ?? undefined,
            code: r.documentTypeId == null ? r.code : undefined,
            name: r.documentTypeId == null ? r.name : undefined,
            requirementStatus: r.requirementStatus,
            sortOrder: r.sortOrder || (idx + 1) * 10,
          })),
      };
      return (await api.put<SchoolDocumentRequirementDTO[]>(
        '/api/schools/document-requirements',
        payload,
      )).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['school-document-requirements', targetType], data);
      // Rebuild working rows from saved data
      if (allTypesQ.data) {
        setRows(buildWorkingRows(allTypesQ.data, data));
      }
      setDirty(false);
      setSaveError(null);
    },
    onError: (e: any) => {
      setSaveError(e?.response?.data?.error ?? e?.message ?? 'Save failed.');
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () =>
      (await api.post<ApplyResult>('/api/schools/document-requirements/apply-to-students')).data,
    onSuccess: (data) => setApplyResult(data),
    onError: (e: any) => setSaveError(e?.response?.data?.error ?? e?.message ?? 'Apply failed.'),
  });

  function setStatus(idx: number, status: DocumentRequirementStatus) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], requirementStatus: status };
      return next;
    });
    setDirty(true);
    setSaveError(null);
  }

  function addCustomDocument() {
    const name = newDocName.trim();
    if (!name) { setAddError('Document name is required.'); return; }
    const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    if ((rows ?? []).some((r) => r.code === code)) {
      setAddError('A document with this code already exists.');
      return;
    }
    setRows((prev) => [
      ...(prev ?? []),
      {
        documentTypeId: null,
        code,
        name,
        description: '',
        requirementStatus: 'REQUIRED',
        sortOrder: ((prev?.length ?? 0) + 1) * 10,
        isCustom: true,
      },
    ]);
    setNewDocName('');
    setAddError(null);
    setDirty(true);
  }

  const isLoading = allTypesQ.isLoading || schoolReqsQ.isLoading;
  const isSaving = saveMutation.isPending || applyMutation.isPending;

  if (isLoading) {
    return (
      <div style={{ padding: '32px 0', color: 'rgba(15,23,42,0.45)', textAlign: 'center', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  const workingRows = rows ?? [];
  const enabledCount = workingRows.filter((r) => r.requirementStatus !== 'NOT_REQUIRED').length;

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* Teacher tab contextual note */}
      {targetType === 'TEACHER' && (
        <div style={{ padding: '10px 14px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 9, fontSize: 13, color: '#1e3a8a', fontWeight: 500 }}>
          📋 Documents marked <strong>Required</strong> or <strong>Optional</strong> here will be shown in each teacher's profile under the <strong>Documents</strong> tab. Documents marked <strong>Not Required</strong> will be hidden from all teacher profiles.
        </div>
      )}

      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.5)' }}>
          <strong style={{ color: 'rgba(15,23,42,0.8)' }}>{enabledCount}</strong> of {workingRows.length} document types required or optional for {tabLabel.toLowerCase()}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {targetType === 'STUDENT' && (
            <button
              type="button"
              disabled={isSaving || dirty}
              onClick={() => { setApplyResult(null); setSaveError(null); setShowApplyConfirm(true); }}
              title={dirty ? 'Save changes first before applying to students' : 'Create missing document rows for all active students'}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.35)',
                background: 'rgba(59,130,246,0.07)', color: '#1d4ed8', fontSize: 12, fontWeight: 600,
                cursor: isSaving || dirty ? 'not-allowed' : 'pointer', opacity: dirty ? 0.5 : 1,
              }}
            >
              {applyMutation.isPending ? 'Applying…' : 'Apply to Existing Students'}
            </button>
          )}
          <button
            type="button"
            disabled={isSaving || !dirty}
            onClick={() => saveMutation.mutate()}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: dirty ? 'var(--color-primary, #4f46e5)' : 'rgba(15,23,42,0.12)',
              color: dirty ? '#fff' : 'rgba(15,23,42,0.35)', fontSize: 13, fontWeight: 700,
              cursor: isSaving || !dirty ? 'not-allowed' : 'pointer',
            }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Apply result banner */}
      {applyResult && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,163,74,0.09)', border: '1px solid rgba(22,163,74,0.25)', fontSize: 13, color: '#166534' }}>
          ✓ {applyResult.message}
        </div>
      )}

      {/* Confirmation dialog — shown before Apply to Existing Students */}
      {showApplyConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 480, width: '92%',
            boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
          }}>
            <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 10, color: 'rgba(15,23,42,0.88)' }}>
              Apply requirements to existing students?
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: 'rgba(234,179,8,0.09)',
              border: '1px solid rgba(234,179,8,0.3)', fontSize: 13, color: '#854d0e', marginBottom: 18, lineHeight: 1.6,
            }}>
              ⚠ This will create missing checklist rows for <strong>all active students</strong>.<br />
              Existing uploaded documents will <strong>not be deleted</strong>.
            </div>
            <div style={{ fontSize: 13, color: 'rgba(15,23,42,0.55)', marginBottom: 22, lineHeight: 1.55 }}>
              Only documents that are currently <strong>missing</strong> from a student's checklist will be added.
              Documents already collected, uploaded, or verified are untouched.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowApplyConfirm(false)}
                disabled={applyMutation.isPending}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.18)', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'rgba(15,23,42,0.65)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={applyMutation.isPending}
                onClick={() => {
                  setShowApplyConfirm(false);
                  applyMutation.mutate();
                }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 13, fontWeight: 700, cursor: applyMutation.isPending ? 'not-allowed' : 'pointer' }}
              >
                {applyMutation.isPending ? 'Applying…' : 'Confirm — Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {saveError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', fontSize: 13, color: '#991b1b' }}>
          ⚠ {saveError}
        </div>
      )}

      {/* Document type table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.09)' }}>
                <th style={TH}>Document</th>
                <th style={TH}>Description</th>
                <th style={{ ...TH, width: 220 }}>Requirement</th>
              </tr>
            </thead>
            <tbody>
              {workingRows.map((row, idx) => (
                <tr key={row.code} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: row.requirementStatus === 'NOT_REQUIRED' ? 'rgba(15,23,42,0.015)' : undefined }}>
                  <td style={TD}>
                    <span style={{ fontWeight: 700, color: 'rgba(15,23,42,0.85)' }}>{row.name}</span>
                    {row.isCustom && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(79,70,229,0.11)', color: '#4338ca', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>
                        Custom
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: 'rgba(15,23,42,0.38)', marginTop: 1 }}>{row.code}</div>
                  </td>
                  <td style={{ ...TD, color: 'rgba(15,23,42,0.5)', fontSize: 12 }}>
                    {row.description || '—'}
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(['REQUIRED', 'OPTIONAL', 'NOT_REQUIRED'] as DocumentRequirementStatus[]).map((s) => {
                        const active = row.requirementStatus === s;
                        const c = REQ_COLOR[s];
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(idx, s)}
                            style={{
                              padding: '4px 10px', borderRadius: 999, border: active ? '2px solid currentColor' : '1px solid rgba(15,23,42,0.12)',
                              background: active ? c.bg : 'transparent', color: active ? c.color : 'rgba(15,23,42,0.4)',
                              fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
                            }}
                          >
                            {REQ_LABELS[s]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add custom document */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Add Custom Document Type</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newDocName}
            onChange={(e) => { setNewDocName(e.target.value); setAddError(null); }}
            placeholder="Document name (e.g. NOC Letter)"
            style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.18)', fontSize: 13 }}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustomDocument(); }}
          />
          <button
            type="button"
            onClick={addCustomDocument}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--color-primary, #4f46e5)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Add
          </button>
        </div>
        {addError && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>{addError}</div>
        )}
      </div>
    </div>
  );
}

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px',
  fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'rgba(15,23,42,0.4)', background: 'rgba(15,23,42,0.02)',
};

const TD: React.CSSProperties = {
  padding: '12px 14px', verticalAlign: 'middle',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabDef = { key: DocumentTargetType; label: string };
const TABS: TabDef[] = [
  { key: 'STUDENT', label: 'Student Documents' },
  { key: 'TEACHER', label: 'Teacher Documents' },
];

export function DocumentRequirementsPage() {
  const [activeTab, setActiveTab] = useState<DocumentTargetType>('STUDENT');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(15,23,42,0.4)', marginBottom: 4 }}>
          Settings
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'rgba(15,23,42,0.88)' }}>
          Document Requirements
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(15,23,42,0.5)', lineHeight: 1.55 }}>
          Configure which documents are required, optional, or not needed for each person type.
          Student checklists are generated from this configuration when a student is onboarded.
          Teacher document checklists are shown on the staff profile <strong>Documents</strong> tab based on the <strong>Teacher Documents</strong> configuration below.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid rgba(15,23,42,0.08)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '9px 18px', border: 'none', background: 'none',
              fontWeight: activeTab === tab.key ? 800 : 500,
              fontSize: 14,
              color: activeTab === tab.key ? 'var(--color-primary, #4f46e5)' : 'rgba(15,23,42,0.5)',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary, #4f46e5)' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active tab panel */}
      {TABS.filter((t) => t.key === activeTab).map((tab) => (
        <RequirementsPanel key={tab.key} targetType={tab.key} tabLabel={tab.label} />
      ))}
    </div>
  );
}


