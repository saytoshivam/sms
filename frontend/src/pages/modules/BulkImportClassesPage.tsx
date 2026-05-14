import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import '../students/bulkImport.css';

type RowStatus = 'VALID' | 'INVALID' | 'DUPLICATE';

interface ImportRowResult {
  rowNumber: number;
  code: string | null;
  displayName: string | null;
  gradeLevel: string | null;
  section: string | null;
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

const CSV_TEMPLATE_HEADER = 'code,displayName,gradeLevel,section,capacity';
const CSV_TEMPLATE_EXAMPLE = '6-A,Grade 6 A,6,A,45\n6-B,Grade 6 B,6,B,45\n7-A,Grade 7 A,7,A,40\n10-B,Grade 10 B,10,B,35';

function downloadTemplate() {
  const blob = new Blob([`${CSV_TEMPLATE_HEADER}\n${CSV_TEMPLATE_EXAMPLE}\n`], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'classes-import-template.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function downloadErrorReport(rows: ImportRowResult[]) {
  const bad = rows.filter(r => r.status !== 'VALID');
  if (!bad.length) return;
  const lines = ['rowNumber,code,displayName,status,errors', ...bad.map(r => [r.rowNumber, r.code ?? '', r.displayName ?? '', r.status, `"${r.errors.join('; ')}"`].join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `classes-import-errors-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === 'VALID') return <span className="bi-badge bi-badge--valid">Valid</span>;
  if (status === 'DUPLICATE') return <span className="bi-badge bi-badge--dup">Duplicate</span>;
  return <span className="bi-badge bi-badge--invalid">Invalid</span>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' | 'warn' | 'neutral' }) {
  return <div className={`bi-summary-card bi-summary-card--${tone ?? 'neutral'}`}><div className="bi-summary-card__value">{value.toLocaleString()}</div><div className="bi-summary-card__label">{label}</div></div>;
}

function PreviewTable({ rows }: { rows: ImportRowResult[] }) {
  const [showOnly, setShowOnly] = useState<'all' | 'invalid' | 'valid' | 'duplicate'>('all');
  const filtered = rows.filter(r => showOnly === 'all' || (showOnly === 'invalid' && r.status === 'INVALID') || (showOnly === 'valid' && r.status === 'VALID') || (showOnly === 'duplicate' && r.status === 'DUPLICATE'));
  const tabs = [
    { key: 'all' as const, label: 'All', count: rows.length },
    { key: 'valid' as const, label: 'Valid', count: rows.filter(r => r.status === 'VALID').length },
    { key: 'invalid' as const, label: 'Invalid', count: rows.filter(r => r.status === 'INVALID').length },
    { key: 'duplicate' as const, label: 'Duplicate', count: rows.filter(r => r.status === 'DUPLICATE').length },
  ];
  return (
    <div className="bi-table-section">
      <div className="bi-table-tabs">
        {tabs.map(t => <button key={t.key} type="button" className={`bi-table-tab${showOnly === t.key ? ' bi-table-tab--active' : ''}`} onClick={() => setShowOnly(t.key)}>{t.label}<span className="bi-table-tab-count">{t.count}</span></button>)}
      </div>
      <div className="bi-table-wrap">
        <table className="bi-table">
          <thead><tr><th>#</th><th>Code</th><th>Display Name</th><th>Grade</th><th>Section</th><th>Status</th><th>Errors</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="bi-table-empty">No rows match this filter.</td></tr>}
            {filtered.map(row => (
              <tr key={row.rowNumber} className={row.status === 'INVALID' ? 'bi-row--invalid' : row.status === 'DUPLICATE' ? 'bi-row--dup' : ''}>
                <td className="bi-td-num">{row.rowNumber}</td>
                <td className="bi-td-mono">{row.code ?? <span className="bi-empty">—</span>}</td>
                <td>{row.displayName ?? <span className="bi-empty">—</span>}</td>
                <td className="bi-muted">{row.gradeLevel ?? '—'}</td>
                <td className="bi-muted">{row.section ?? '—'}</td>
                <td><StatusBadge status={row.status} /></td>
                <td>{row.errors?.length > 0 && <ul className="bi-error-list">{row.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.filter(r => r.status !== 'VALID').length > 0 && <div className="bi-table-footer"><button type="button" className="btn secondary" onClick={() => downloadErrorReport(rows)}>↓ Download error report</button></div>}
    </div>
  );
}

function CommitResultView({ result, onReset }: { result: CommitResponse; onReset: () => void }) {
  const success = result.importedCount > 0 && result.failedRows.length === 0;
  const partial = result.importedCount > 0 && result.failedRows.length > 0;
  return (
    <div className="bi-result">
      <div className={`bi-result-banner bi-result-banner--${success ? 'success' : partial ? 'warn' : 'danger'}`}>
        {success && <><div className="bi-result-icon">✓</div><div><strong>{result.importedCount} class{result.importedCount !== 1 ? 'es' : ''} imported successfully.</strong></div></>}
        {partial && <><div className="bi-result-icon bi-result-icon--warn">⚠</div><div><strong>{result.importedCount} imported, {result.skippedCount} skipped.</strong></div></>}
        {!success && !partial && <><div className="bi-result-icon bi-result-icon--danger">✗</div><div><strong>Import failed — no rows saved.</strong></div></>}
      </div>
      {result.failedRows.length > 0 && <div className="bi-result-fails"><h4 className="bi-section-title">Failed rows</h4><PreviewTable rows={result.failedRows} /></div>}
      <div className="bi-actions">
        <button type="button" className="btn" onClick={onReset}>Import another file</button>
        <Link className="btn secondary" to="/app/classes-sections">Go to Classes &amp; Sections</Link>
      </div>
    </div>
  );
}

type Phase = 'upload' | 'previewing' | 'preview' | 'committing' | 'done';

export function BulkImportClassesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('upload');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function reset() {
    setPhase('upload'); setPreview(null); setCommitResult(null); setUploadError(null); setCommitError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) { setUploadError('Please upload a .csv file.'); return; }
    setUploadError(null); setPhase('previewing');
    const form = new FormData(); form.append('file', file);
    try {
      const res = await api.post<PreviewResponse>('/api/class-groups/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(res.data); setPhase('preview');
    } catch (err) { setUploadError(formatApiError(err)); setPhase('upload'); }
  }

  async function commitImport() {
    if (!preview?.importToken) return;
    setCommitError(null); setPhase('committing');
    try {
      const res = await api.post<CommitResponse>('/api/class-groups/import/commit', { importToken: preview.importToken });
      setCommitResult(res.data); setPhase('done');
    } catch (err) { setCommitError(formatApiError(err)); setPhase('preview'); }
  }

  return (
    <div className="workspace-feature-page stack bi-page">
      <header className="bi-header">
        <div>
          <h2 className="workspace-feature-page__title">Bulk Import Classes &amp; Sections</h2>
          <p className="workspace-feature-page__lead" style={{ margin: 0 }}>Upload a CSV to preview, validate, and import classes and sections at once.</p>
        </div>
        <div className="bi-header-actions"><Link className="btn secondary" to="/app/classes-sections">← Back to Classes &amp; Sections</Link></div>
      </header>

      <div className="bi-steps">
        {(['upload', 'preview', 'done'] as const).map((step, i) => {
          const labels: Record<string, string> = { upload: '1. Upload', preview: '2. Preview & Validate', done: '3. Import' };
          const stepDone = (step === 'upload' && ['preview','done','previewing','committing'].includes(phase)) || (step === 'preview' && ['done','committing'].includes(phase)) || step === phase;
          const stepActive = step === phase || (step === 'preview' && ['previewing','committing'].includes(phase));
          return <div key={step} className={`bi-step${stepDone ? ' bi-step--done' : ''}${stepActive ? ' bi-step--active' : ''}`}><div className="bi-step-num">{i + 1}</div><span>{labels[step]}</span></div>;
        })}
      </div>

      {(phase === 'upload' || phase === 'previewing') && (
        <div className="bi-section card">
          <div className="bi-section-inner">
            <div className={`bi-dropzone${dragOver ? ' bi-dropzone--over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {phase === 'previewing' ? <div className="bi-dropzone-loading"><div className="bi-spinner" /><span>Parsing and validating CSV…</span></div> : (
                <><div className="bi-dropzone-icon">📄</div><div className="bi-dropzone-title">Drag & drop a CSV file here, or <span className="bi-dropzone-link">click to browse</span></div><div className="bi-dropzone-hint">Accepts .csv files only · UTF-8 encoding</div></>
              )}
            </div>
            {uploadError && <div className="bi-alert bi-alert--danger"><strong>Upload failed:</strong> {uploadError}</div>}
            <div className="bi-upload-actions"><button type="button" className="btn secondary" onClick={downloadTemplate}>↓ Download CSV template</button></div>
            <details className="bi-format-helper">
              <summary>CSV column reference</summary>
              <div className="bi-format-table-wrap">
                <table className="bi-format-table">
                  <thead><tr><th>Column</th><th>Required</th><th>Notes</th></tr></thead>
                  <tbody>
                    {[
                      ['code', '✓', 'Unique identifier e.g. 6-A, GRADE6_B (letters, digits, - or _)'],
                      ['displayName', '✓', 'Human-friendly name e.g. Grade 6 A'],
                      ['gradeLevel', '', 'Numeric grade/standard e.g. 6, 10'],
                      ['section', '', 'Section label e.g. A, B, Red'],
                      ['capacity', '', 'Seating capacity (integer)'],
                    ].map(([col, req, note]) => <tr key={col}><td className="bi-td-mono">{col}</td><td className="bi-td-center">{req}</td><td className="bi-muted" style={{ fontSize: 12 }}>{note}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>
      )}

      {(phase === 'preview' || phase === 'committing') && preview && (
        <>
          <div className="bi-summary-grid">
            <SummaryCard label="Total rows" value={preview.totalRows} tone="neutral" />
            <SummaryCard label="Valid" value={preview.validRows} tone="success" />
            <SummaryCard label="Invalid" value={preview.invalidRows} tone="danger" />
            <SummaryCard label="Duplicates" value={preview.duplicateRows} tone="warn" />
          </div>
          {preview.validRows === 0 && <div className="bi-alert bi-alert--warn">No valid rows found. Fix errors and re-upload.</div>}
          {preview.validRows > 0 && preview.invalidRows === 0 && preview.duplicateRows === 0 && <div className="bi-alert bi-alert--success">All {preview.totalRows} rows are valid and ready to import.</div>}
          {preview.validRows > 0 && (preview.invalidRows > 0 || preview.duplicateRows > 0) && <div className="bi-alert bi-alert--info"><strong>{preview.validRows} row{preview.validRows !== 1 ? 's' : ''}</strong> will be imported. {preview.invalidRows + preview.duplicateRows} skipped.</div>}
          {commitError && <div className="bi-alert bi-alert--danger"><strong>Commit failed:</strong> {commitError}</div>}
          <div className="bi-actions">
            <button type="button" className="btn" disabled={preview.validRows === 0 || phase === 'committing'} onClick={commitImport}>
              {phase === 'committing' ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="bi-spinner bi-spinner--sm" />Importing…</span> : `Import ${preview.validRows} valid row${preview.validRows !== 1 ? 's' : ''}`}
            </button>
            <button type="button" className="btn secondary" disabled={phase === 'committing'} onClick={reset}>Upload another file</button>
          </div>
          <div className="card bi-preview-card">
            <h3 className="bi-section-title" style={{ marginBottom: 12 }}>Row preview — {preview.totalRows} rows</h3>
            <PreviewTable rows={preview.rows} />
          </div>
        </>
      )}

      {phase === 'done' && commitResult && <CommitResultView result={commitResult} onReset={reset} />}
    </div>
  );
}

