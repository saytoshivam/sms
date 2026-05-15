import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import './bulkImport.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowStatus = 'VALID' | 'INVALID' | 'DUPLICATE';

interface ImportRowResult {
  rowNumber: number;
  admissionNo: string | null;
  firstName: string | null;
  lastName: string | null;
  classCode: string | null;
  academicYear: string | null;
  status: RowStatus;
  errors: string[];
}

interface PreviewResponse {
  importToken: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ImportRowResult[];
}

interface CommitResponse {
  importedCount: number;
  skippedCount: number;
  failedRows: ImportRowResult[];
}

// ─── CSV Template ─────────────────────────────────────────────────────────────

const CSV_TEMPLATE_HEADER =
  'admissionNo,rollNo,firstName,middleName,lastName,gender,dateOfBirth,classCode,sectionCode,academicYear,guardianName,guardianRelation,guardianPhone,guardianEmail,addressLine1,city,state,pincode';

const CSV_TEMPLATE_EXAMPLE =
  'ADM-001,1,Riya,Devi,Sharma,Female,2012-06-15,GRADE6,A,2024-25,Sunita Sharma,Mother,9876543210,sunita@example.com,12 MG Road,Indore,Madhya Pradesh,452001';

function downloadTemplate() {
  const content = `${CSV_TEMPLATE_HEADER}\n${CSV_TEMPLATE_EXAMPLE}\n`;
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(rows: ImportRowResult[]) {
  const bad = rows.filter((r) => r.status !== 'VALID');
  if (!bad.length) return;
  const lines = [
    'rowNumber,admissionNo,firstName,lastName,classCode,academicYear,status,errors',
    ...bad.map((r) =>
      [
        r.rowNumber,
        r.admissionNo ?? '',
        r.firstName ?? '',
        r.lastName ?? '',
        r.classCode ?? '',
        r.academicYear ?? '',
        r.status,
        `"${r.errors.join('; ')}"`,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-errors-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'danger' | 'warn' | 'neutral';
}) {
  return (
    <div className={`bi-summary-card bi-summary-card--${tone ?? 'neutral'}`}>
      <div className="bi-summary-card__value">{value.toLocaleString()}</div>
      <div className="bi-summary-card__label">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === 'VALID') return <span className="bi-badge bi-badge--valid">Valid</span>;
  if (status === 'DUPLICATE') return <span className="bi-badge bi-badge--dup">Duplicate</span>;
  return <span className="bi-badge bi-badge--invalid">Invalid</span>;
}

function PreviewTable({ rows }: { rows: ImportRowResult[] }) {
  const [showOnly, setShowOnly] = useState<'all' | 'invalid' | 'valid' | 'duplicate'>('all');

  const filtered = rows.filter((r) => {
    if (showOnly === 'all') return true;
    if (showOnly === 'invalid') return r.status === 'INVALID';
    if (showOnly === 'valid') return r.status === 'VALID';
    if (showOnly === 'duplicate') return r.status === 'DUPLICATE';
    return true;
  });

  const tabs: { key: typeof showOnly; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'valid', label: 'Valid', count: rows.filter((r) => r.status === 'VALID').length },
    { key: 'invalid', label: 'Invalid', count: rows.filter((r) => r.status === 'INVALID').length },
    { key: 'duplicate', label: 'Duplicate', count: rows.filter((r) => r.status === 'DUPLICATE').length },
  ];

  return (
    <div className="bi-table-section">
      <div className="bi-table-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`bi-table-tab${showOnly === t.key ? ' bi-table-tab--active' : ''}`}
            onClick={() => setShowOnly(t.key)}
          >
            {t.label}
            <span className="bi-table-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="bi-table-wrap">
        <table className="bi-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Admission No</th>
              <th>Name</th>
              <th>Class / Year</th>
              <th>Guardian Phone</th>
              <th>Status</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="bi-table-empty">
                  No rows match the selected filter.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr
                key={row.rowNumber}
                className={
                  row.status === 'INVALID'
                    ? 'bi-row--invalid'
                    : row.status === 'DUPLICATE'
                      ? 'bi-row--dup'
                      : ''
                }
              >
                <td className="bi-td-num">{row.rowNumber}</td>
                <td className="bi-td-mono">{row.admissionNo ?? <span className="bi-empty">—</span>}</td>
                <td>
                  {[row.firstName, row.lastName].filter(Boolean).join(' ') || (
                    <span className="bi-empty">—</span>
                  )}
                </td>
                <td>
                  {row.classCode ? (
                    <span>
                      {row.classCode}
                      {row.academicYear ? <span className="bi-muted"> · {row.academicYear}</span> : null}
                    </span>
                  ) : (
                    <span className="bi-empty">—</span>
                  )}
                </td>
                <td className="bi-muted">—</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  {row.errors.length > 0 ? (
                    <ul className="bi-error-list">
                      {row.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.filter((r) => r.status !== 'VALID').length > 0 && (
        <div className="bi-table-footer">
          <button
            type="button"
            className="btn secondary"
            onClick={() => downloadErrorReport(rows)}
          >
            ↓ Download error report
          </button>
        </div>
      )}
    </div>
  );
}

function CommitResultView({
  result,
  onReset,
}: {
  result: CommitResponse;
  onReset: () => void;
}) {
  const success = result.importedCount > 0 && result.failedRows.length === 0;
  const partial = result.importedCount > 0 && result.failedRows.length > 0;
  const allFailed = result.importedCount === 0 && result.failedRows.length > 0;

  return (
    <div className="bi-result">
      <div className={`bi-result-banner bi-result-banner--${success ? 'success' : partial ? 'warn' : 'danger'}`}>
        {success && (
          <>
            <div className="bi-result-icon">✓</div>
            <div>
              <strong>{result.importedCount} student{result.importedCount !== 1 ? 's' : ''} imported successfully.</strong>
              <p className="bi-result-sub">All valid rows were added to the roster.</p>
            </div>
          </>
        )}
        {partial && (
          <>
            <div className="bi-result-icon bi-result-icon--warn">⚠</div>
            <div>
              <strong>
                {result.importedCount} imported, {result.skippedCount} skipped.
              </strong>
              <p className="bi-result-sub">
                Some rows failed at write-time (e.g. concurrent duplicate). Check the table below.
              </p>
            </div>
          </>
        )}
        {allFailed && (
          <>
            <div className="bi-result-icon bi-result-icon--danger">✗</div>
            <div>
              <strong>Import failed — no rows were saved.</strong>
              <p className="bi-result-sub">All rows encountered errors at commit time.</p>
            </div>
          </>
        )}
      </div>

      {result.failedRows.length > 0 && (
        <div className="bi-result-fails">
          <h4 className="bi-section-title">Rows that failed at write-time</h4>
          <PreviewTable rows={result.failedRows} />
        </div>
      )}

      <div className="bi-actions">
        <button type="button" className="btn" onClick={onReset}>
          Import another file
        </button>
        <Link className="btn secondary" to="/app/students">
          Go to Students
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Phase = 'upload' | 'previewing' | 'preview' | 'committing' | 'done';

export function BulkImportStudentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  const [dragOver, setDragOver] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function reset() {
    setPhase('upload');
    setPreview(null);
    setCommitResult(null);
    setUploadError(null);
    setCommitError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFile(file: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a .csv file.');
      return;
    }

    setUploadError(null);
    setPhase('previewing');

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await api.post<PreviewResponse>('/api/students/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
      setPhase('preview');
    } catch (err) {
      setUploadError(formatApiError(err));
      setPhase('upload');
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function commitImport() {
    if (!preview?.importToken) return;
    setCommitError(null);
    setPhase('committing');

    try {
      const res = await api.post<CommitResponse>('/api/students/import/commit', {
        importToken: preview.importToken,
        strictMode: false,
      });
      setCommitResult(res.data);
      setPhase('done');
    } catch (err) {
      setCommitError(formatApiError(err));
      setPhase('preview');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="workspace-feature-page stack bi-page">
      {/* ── Header ── */}
      <header className="bi-header">
        <div>
          <h2 className="workspace-feature-page__title">Bulk Import Students</h2>
          <p className="workspace-feature-page__lead" style={{ margin: 0 }}>
            Upload a CSV file to preview, validate, and import multiple students at once.
          </p>
        </div>
      </header>

      {/* ── Step indicator ── */}
      <div className="bi-steps">
        {(['upload', 'preview', 'done'] as const).map((step, i) => {
          const labels: Record<string, string> = {
            upload: '1. Upload',
            preview: '2. Preview & Validate',
            done: '3. Import',
          };
          const stepDone =
            (step === 'upload' && (phase === 'preview' || phase === 'done' || phase === 'previewing' || phase === 'committing')) ||
            (step === 'preview' && (phase === 'done' || phase === 'committing')) ||
            step === phase;
          const stepActive = step === phase || (step === 'preview' && (phase === 'previewing' || phase === 'committing'));
          return (
            <div
              key={step}
              className={`bi-step${stepActive || stepDone ? ' bi-step--done' : ''}${stepActive ? ' bi-step--active' : ''}`}
            >
              <div className="bi-step-num">{i + 1}</div>
              <span>{labels[step]}</span>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════ PHASE: UPLOAD ═══════════════════════ */}
      {(phase === 'upload' || phase === 'previewing') && (
        <div className="bi-section card">
          <div className="bi-section-inner">
            {/* Drop zone */}
            <div
              className={`bi-dropzone${dragOver ? ' bi-dropzone--over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !phase.includes('preview') && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload CSV file"
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={onFileInputChange}
              />
              {phase === 'previewing' ? (
                <div className="bi-dropzone-loading">
                  <div className="bi-spinner" />
                  <span>Parsing and validating CSV…</span>
                </div>
              ) : (
                <>
                  <div className="bi-dropzone-icon">📄</div>
                  <div className="bi-dropzone-title">
                    Drag & drop a CSV file here, or{' '}
                    <span className="bi-dropzone-link">click to browse</span>
                  </div>
                  <div className="bi-dropzone-hint">Accepts .csv files only · UTF-8 encoding</div>
                </>
              )}
            </div>

            {uploadError && (
              <div className="bi-alert bi-alert--danger">
                <strong>Upload failed:</strong> {uploadError}
              </div>
            )}

            {/* Actions row */}
            <div className="bi-upload-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={downloadTemplate}
              >
                ↓ Download CSV template
              </button>
            </div>

            {/* Format reference */}
            <details className="bi-format-helper">
              <summary>CSV column reference</summary>
              <div className="bi-format-table-wrap">
                <table className="bi-format-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Required</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['admissionNo', '✓', 'Must be unique per school'],
                      ['rollNo', '', 'Must be unique per class + academic year if provided'],
                      ['firstName', '✓', ''],
                      ['middleName', '', ''],
                      ['lastName', '', ''],
                      ['gender', '', 'Male / Female / Other'],
                      ['dateOfBirth', '', 'Format: yyyy-MM-dd (e.g. 2012-06-15)'],
                      ['classCode', '✓', 'Must match a class code in the system (e.g. GRADE6)'],
                      ['sectionCode', '', 'Must match the section of the class (e.g. A)'],
                      ['academicYear', '✓', 'Must match an academic year label (e.g. 2024-25)'],
                      ['guardianName', '✓', ''],
                      ['guardianRelation', '', 'e.g. Mother, Father, Guardian'],
                      ['guardianPhone', '✓', ''],
                      ['guardianEmail', '', ''],
                      ['addressLine1', '', ''],
                      ['city', '', ''],
                      ['state', '', ''],
                      ['pincode', '', ''],
                    ].map(([col, req, note]) => (
                      <tr key={col}>
                        <td className="bi-td-mono">{col}</td>
                        <td className="bi-td-center">{req}</td>
                        <td className="bi-muted" style={{ fontSize: 12 }}>{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* ═══════════════════════ PHASE: PREVIEW ═══════════════════════ */}
      {(phase === 'preview' || phase === 'committing') && preview && (
        <>
          {/* Summary cards */}
          <div className="bi-summary-grid">
            <SummaryCard label="Total rows" value={preview.totalRows} tone="neutral" />
            <SummaryCard label="Valid" value={preview.validRows} tone="success" />
            <SummaryCard label="Invalid" value={preview.invalidRows} tone="danger" />
            <SummaryCard label="Duplicates" value={preview.duplicateRows} tone="warn" />
          </div>

          {/* Status callout */}
          {preview.validRows === 0 && (
            <div className="bi-alert bi-alert--warn">
              No valid rows found. Fix the errors in your CSV and re-upload.
            </div>
          )}
          {preview.validRows > 0 && preview.invalidRows === 0 && preview.duplicateRows === 0 && (
            <div className="bi-alert bi-alert--success">
              All {preview.totalRows} rows are valid and ready to import.
            </div>
          )}
          {preview.validRows > 0 && (preview.invalidRows > 0 || preview.duplicateRows > 0) && (
            <div className="bi-alert bi-alert--info">
              <strong>{preview.validRows} row{preview.validRows !== 1 ? 's' : ''}</strong> will be
              imported. {preview.invalidRows + preview.duplicateRows} row
              {preview.invalidRows + preview.duplicateRows !== 1 ? 's' : ''} will be skipped.
            </div>
          )}

          {commitError && (
            <div className="bi-alert bi-alert--danger">
              <strong>Commit failed:</strong> {commitError}
            </div>
          )}

          {/* Action bar */}
          <div className="bi-actions">
            <button
              type="button"
              className="btn"
              disabled={preview.validRows === 0 || phase === 'committing'}
              onClick={commitImport}
            >
              {phase === 'committing' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bi-spinner bi-spinner--sm" />
                  Importing…
                </span>
              ) : (
                `Import ${preview.validRows} valid row${preview.validRows !== 1 ? 's' : ''}`
              )}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={phase === 'committing'}
              onClick={reset}
            >
              Upload another file
            </button>
            {(preview.invalidRows > 0 || preview.duplicateRows > 0) && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => downloadErrorReport(preview.rows)}
              >
                ↓ Download error report
              </button>
            )}
          </div>

          {/* Row-level preview table */}
          <div className="card bi-preview-card">
            <h3 className="bi-section-title" style={{ marginBottom: 12 }}>
              Row preview — {preview.totalRows} rows
            </h3>
            <PreviewTable rows={preview.rows} />
          </div>
        </>
      )}

      {/* ═══════════════════════ PHASE: DONE ═══════════════════════ */}
      {phase === 'done' && commitResult && (
        <CommitResultView result={commitResult} onReset={reset} />
      )}
    </div>
  );
}

