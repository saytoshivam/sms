import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ModulePage, type StatusLevel } from '../../components/module/ModulePage';
import { SavedClassesSectionsCatalogPanel } from '../../components/catalog/SavedClassesSectionsCatalogPanel';
import { api } from '../../lib/api';
import { pageContent, type SpringPage } from '../../lib/springPageContent';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';

type ClassGroupLite = { id: number };

/** Match {@code SchoolOnboardingService#generateClasses}: trim, uppercase, distinct, max length 16. */
function parseCommaSections(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(',')) {
    const t = raw.trim().toUpperCase();
    if (!t || t.length > 16) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

type GradeSectionsRow = {
  gradeLevel: number | '';
  sectionsText: string;
};

const INITIAL_ROWS: GradeSectionsRow[] = [{ gradeLevel: '', sectionsText: '' }];

export function ClassesSectionsModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') ?? 'browse') as 'browse' | 'add' | 'generate';
  const [tab, setTab] = useState<'browse' | 'add' | 'generate'>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  const [gradeRows, setGradeRows] = useState<GradeSectionsRow[]>(() => INITIAL_ROWS.map((r) => ({ ...r })));
  const [defaultCapacity, setDefaultCapacity] = useState<number | ''>('');

  // Bulk generator state (fromGrade / toGrade / same sections or per-grade)
  const [fromGrade, setFromGrade] = useState(1);
  const [toGrade, setToGrade] = useState(12);
  const [sectionsText, setSectionsText] = useState('A,B');
  const [usePerGradeSections, setUsePerGradeSections] = useState(false);
  const [perGradeRows, setPerGradeRows] = useState<{ gradeLevel: number; sectionsText: string }[]>([
    { gradeLevel: 1, sectionsText: 'A,B' },
  ]);
  const [bulkDefaultCapacity, setBulkDefaultCapacity] = useState<number | ''>('');
  const [bulkResult, setBulkResult] = useState<{ createdCount: number; skippedExistingCount: number } | null>(null);

  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);
  const qc = useQueryClient();

  const cg = useQuery({
    queryKey: ['class-groups'],
    queryFn: async () =>
      (await api.get<SpringPage<ClassGroupLite> | ClassGroupLite[]>('/api/class-groups?size=500')).data,
  });

  const list = pageContent(cg.data ?? null);

  const status: { level: StatusLevel; label: string } = useMemo(() => {
    if (cg.isLoading) return { level: 'idle', label: 'Loading' };
    if (cg.isError) return { level: 'error', label: 'Load failed' };
    if (list.length === 0) return { level: 'idle', label: 'No sections yet' };
    return { level: 'ok', label: `${list.length} section${list.length === 1 ? '' : 's'}` };
  }, [cg.isLoading, cg.isError, list.length]);

  const createSections = useMutation({
    mutationFn: async () => {
      const tasks: { gradeLevel: number; section: string }[] = [];
      for (const r of gradeRows) {
        const g = r.gradeLevel === '' ? NaN : Number(r.gradeLevel);
        if (!Number.isFinite(g) || g < 1 || g > 12) continue;
        const gi = Math.trunc(g);
        for (const sec of parseCommaSections(r.sectionsText)) {
          tasks.push({ gradeLevel: gi, section: sec });
        }
      }
      if (tasks.length === 0) {
        throw new Error('Add at least one grade (1–12) with comma-separated sections (e.g. A,B,C).');
      }

      const cap = defaultCapacity === '' ? undefined : Math.max(0, Math.trunc(Number(defaultCapacity)));
      const capPayload = cap != null && cap > 0 ? cap : undefined;

      let created = 0;
      let skipped = 0;
      const newIds: number[] = [];

      for (const t of tasks) {
        const code = `${t.gradeLevel}-${t.section}`;
        const displayName = `Grade ${t.gradeLevel} — Section ${t.section}`;
        try {
          const res = await api.post<{ id: number }>('/api/class-groups', {
            code,
            displayName,
            gradeLevel: t.gradeLevel,
            section: t.section,
            ...(capPayload != null ? { capacity: capPayload } : {}),
          });
          newIds.push(res.data.id);
          created += 1;
        } catch (e) {
          if (axios.isAxiosError(e) && e.response?.status === 409) skipped += 1;
          else throw e;
        }
      }

      return { created, skipped, newIds };
    },
    onSuccess: async ({ created, skipped, newIds }) => {
      if (created === 0 && skipped > 0) {
        toast.info('No new sections', `All ${skipped} code(s) already exist.`);
      } else {
        toast.success(
          'Sections created',
          `${created} new · ${skipped} already existed${skipped ? ' (skipped)' : ''}`,
        );
      }
      setGradeRows(INITIAL_ROWS.map((r) => ({ ...r })));
      setDefaultCapacity('');
      if (newIds.length) {
        recordChange({
          id: `classes:add-bulk:${newIds[0]}-${newIds.length}`,
          scope: 'classes',
          severity: 'soft',
          message: `Added ${newIds.length} class section(s)`,
          refs: { classGroupIds: newIds },
        });
      }
      await invalidate(['classes']);
    },
    onError: (e) => toast.error('Could not create sections', formatApiError(e)),
  });

  const generateClassesBulk = useMutation({
    mutationFn: async () => {
      const sections = sectionsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const gradeSections = usePerGradeSections
        ? perGradeRows
            .map((r) => ({
              gradeLevel: Number(r.gradeLevel),
              sections: r.sectionsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }))
            .filter((r) => Number.isFinite(r.gradeLevel) && r.sections.length > 0)
        : null;
      return (
        await api.post<{ createdCount: number; createdCodes: string[]; skippedExistingCount: number }>(
          '/api/v1/onboarding/classes/generate',
          {
            fromGrade,
            toGrade,
            sections,
            gradeSections,
            defaultCapacity: bulkDefaultCapacity === '' ? null : bulkDefaultCapacity,
          },
        )
      ).data;
    },
    onSuccess: async (data) => {
      setBulkResult({ createdCount: data.createdCount, skippedExistingCount: data.skippedExistingCount });
      toast.success(
        'Classes generated',
        `Created ${data.createdCount} · Skipped ${data.skippedExistingCount} existing`,
      );
      await qc.invalidateQueries({ queryKey: ['class-groups'] });
      await qc.invalidateQueries({ queryKey: ['class-groups-catalog'] });
      await invalidate(['classes']);
    },
    onError: (e) => {
      setBulkResult(null);
      toast.error('Generate failed', formatApiError(e));
    },
  });

  const setTabUrl = (next: 'browse' | 'add' | 'generate') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'browse') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const headerActions = (
    <>
      <Link to="/app" className="btn secondary">
        Back to hub
      </Link>
      <Link to="/app/classes-sections/bulk-import" className="btn secondary">
        Bulk import
      </Link>
    </>
  );

  return (
    <ModulePage
      title="Classes & sections"
      subtitle="Browse and edit saved sections below. Use Add new for the grade + sections flow, Bulk generate for quick range creation, or Bulk import to upload a CSV."
      status={status}
      headerActions={headerActions}
      tabs={[
        { id: 'browse', label: 'Browse', badge: list.length || null },
        { id: 'add', label: 'Add new' },
        { id: 'generate', label: 'Bulk generate' },
      ]}
      activeTabId={tab}
      tabHrefBase="/app/classes-sections"
    >
      {tab === 'add' ? (
        <AddGradesSectionsCard
          rows={gradeRows}
          setRows={setGradeRows}
          defaultCapacity={defaultCapacity}
          setDefaultCapacity={setDefaultCapacity}
          onGenerate={() => createSections.mutate()}
          busy={createSections.isPending}
        />
      ) : null}

      {tab === 'generate' ? (
        <BulkGenerateClassesCard
          fromGrade={fromGrade}
          setFromGrade={setFromGrade}
          toGrade={toGrade}
          setToGrade={setToGrade}
          sectionsText={sectionsText}
          setSectionsText={setSectionsText}
          usePerGradeSections={usePerGradeSections}
          setUsePerGradeSections={setUsePerGradeSections}
          perGradeRows={perGradeRows}
          setPerGradeRows={setPerGradeRows}
          defaultCapacity={bulkDefaultCapacity}
          setDefaultCapacity={setBulkDefaultCapacity}
          onGenerate={() => generateClassesBulk.mutate()}
          busy={generateClassesBulk.isPending}
          result={bulkResult}
          isError={generateClassesBulk.isError}
          error={generateClassesBulk.error}
        />
      ) : null}

      {tab === 'browse' ? (
        <div
          className="card stack"
          style={{ gap: 12, padding: 12, marginTop: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}
        >
          <SavedClassesSectionsCatalogPanel />
        </div>
      ) : null}
    </ModulePage>
  );
}

function AddGradesSectionsCard({
  rows,
  setRows,
  defaultCapacity,
  setDefaultCapacity,
  onGenerate,
  busy,
}: {
  rows: GradeSectionsRow[];
  setRows: (fn: (p: GradeSectionsRow[]) => GradeSectionsRow[]) => void;
  defaultCapacity: number | '';
  setDefaultCapacity: (v: number | '') => void;
  onGenerate: () => void;
  busy: boolean;
}) {
  const hasTasks = rows.some((r) => {
    const g = r.gradeLevel === '' ? NaN : Number(r.gradeLevel);
    return Number.isFinite(g) && g >= 1 && g <= 12 && parseCommaSections(r.sectionsText).length > 0;
  });

  return (
    <div className="card stack" style={{ gap: 12, padding: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 14 }}>Add grades & sections</div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Add individual grade rows with their sections.{' '}
        <strong style={{ fontWeight: 850, color: 'var(--color-text)' }}>Grade</strong> and{' '}
        <strong style={{ fontWeight: 850, color: 'var(--color-text)' }}>Sections (comma-separated)</strong> matter per row.
        Empty grades or rows without sections are skipped. Codes become <code>{"{grade}-{section}"}</code>.
      </p>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="stack" style={{ gap: 6, flex: '0 0 160px' }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Default capacity (optional)
          </span>
          <input
            type="number"
            min={1}
            value={defaultCapacity}
            onChange={(e) => {
              const v = e.target.value;
              setDefaultCapacity(v === '' ? '' : Math.max(1, Math.trunc(Number(v))));
            }}
            placeholder="e.g. 40"
          />
        </label>
      </div>

      <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
        Add only the grades you run. Grades without section text will be skipped.
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {rows.map((r, idx) => (
          <div key={idx} className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="stack" style={{ gap: 6, flex: '0 0 140px' }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                Grade
              </span>
              <input
                type="number"
                min={1}
                max={12}
                value={r.gradeLevel}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((p) =>
                    p.map((x, j) =>
                      j === idx ? { ...x, gradeLevel: v === '' ? '' : Math.trunc(Number(v)) } : x,
                    ),
                  );
                }}
              />
            </label>
            <label className="stack" style={{ gap: 6, flex: '2 1 260px' }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                Sections (comma-separated)
              </span>
              <input
                value={r.sectionsText}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((p) => p.map((x, j) => (j === idx ? { ...x, sectionsText: v } : x)));
                }}
                placeholder="A,B,C"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="btn secondary"
              disabled={busy || rows.length <= 1}
              onClick={() => setRows((p) => p.filter((_, j) => j !== idx))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => setRows((p) => [...p, { gradeLevel: '', sectionsText: '' }])}
        >
          Add grade row
        </button>
        <button type="button" className="btn" disabled={busy || !hasTasks} onClick={onGenerate}>
          {busy ? 'Creating…' : 'Create sections'}
        </button>
      </div>
    </div>
  );
}

function BulkGenerateClassesCard({
  fromGrade,
  setFromGrade,
  toGrade,
  setToGrade,
  sectionsText,
  setSectionsText,
  usePerGradeSections,
  setUsePerGradeSections,
  perGradeRows,
  setPerGradeRows,
  defaultCapacity,
  setDefaultCapacity,
  onGenerate,
  busy,
  result,
  isError,
  error,
}: {
  fromGrade: number;
  setFromGrade: (v: number) => void;
  toGrade: number;
  setToGrade: (v: number) => void;
  sectionsText: string;
  setSectionsText: (v: string) => void;
  usePerGradeSections: boolean;
  setUsePerGradeSections: (v: boolean) => void;
  perGradeRows: { gradeLevel: number; sectionsText: string }[];
  setPerGradeRows: (fn: (p: { gradeLevel: number; sectionsText: string }[]) => { gradeLevel: number; sectionsText: string }[]) => void;
  defaultCapacity: number | '';
  setDefaultCapacity: (v: number | '') => void;
  onGenerate: () => void;
  busy: boolean;
  result: { createdCount: number; skippedExistingCount: number } | null;
  isError: boolean;
  error: unknown;
}) {
  return (
    <div className="card stack" style={{ gap: 14, padding: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 14 }}>Bulk generate classes by grade range</div>
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
        Generate section groups like <strong>10-A</strong>, <strong>10-B</strong>… across a grade range. This is
        idempotent — existing class groups are skipped.
      </p>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="stack" style={{ flex: '1 1 180px' }}>
          <label className="muted" style={{ fontSize: 12, fontWeight: 800 }}>From grade</label>
          <input
            type="number"
            min={1}
            max={12}
            value={fromGrade}
            onChange={(e) => setFromGrade(Number(e.target.value))}
          />
        </div>
        <div className="stack" style={{ flex: '1 1 180px' }}>
          <label className="muted" style={{ fontSize: 12, fontWeight: 800 }}>To grade</label>
          <input
            type="number"
            min={1}
            max={12}
            value={toGrade}
            onChange={(e) => setToGrade(Number(e.target.value))}
          />
        </div>
        <div className="stack" style={{ flex: '1 1 200px' }}>
          <label className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Default capacity (optional)</label>
          <input
            type="number"
            min={1}
            value={defaultCapacity}
            onChange={(e) => {
              const v = e.target.value;
              setDefaultCapacity(v === '' ? '' : Number(v));
            }}
            placeholder="40"
          />
        </div>
      </div>

      <div className="stack" style={{ flex: '2 1 260px', gap: 8 }}>
        <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Sections mode</span>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={!usePerGradeSections ? 'btn' : 'btn secondary'}
            onClick={() => setUsePerGradeSections(false)}
          >
            Same for all grades
          </button>
          <button
            type="button"
            className={usePerGradeSections ? 'btn' : 'btn secondary'}
            onClick={() => setUsePerGradeSections(true)}
          >
            Different per grade
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Use "Different per grade" when Grade 11 has A–D but Grade 1 only has A–B.
        </p>
      </div>

      {!usePerGradeSections ? (
        <div className="stack" style={{ gap: 8 }}>
          <label className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Sections (comma-separated)</label>
          <input value={sectionsText} onChange={(e) => setSectionsText(e.target.value)} placeholder="A,B,C" />
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Applies to all grades in the selected range.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Per-grade sections</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Add only the grades you run. Grades without rows will be skipped.
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {perGradeRows.map((r, idx) => (
              <div key={idx} className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="stack" style={{ flex: '0 0 140px', gap: 6 }}>
                  <label className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Grade</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={r.gradeLevel}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPerGradeRows((p) => p.map((x, j) => (j === idx ? { ...x, gradeLevel: v } : x)));
                    }}
                  />
                </div>
                <div className="stack" style={{ flex: '2 1 260px', gap: 6 }}>
                  <label className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Sections (comma-separated)</label>
                  <input
                    value={r.sectionsText}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPerGradeRows((p) => p.map((x, j) => (j === idx ? { ...x, sectionsText: v } : x)));
                    }}
                    placeholder="A,B,C"
                  />
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setPerGradeRows((p) => p.filter((_, j) => j !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setPerGradeRows((p) => [...p, { gradeLevel: fromGrade, sectionsText: 'A' }])}
            >
              Add grade row
            </button>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <button
          type="button"
          className="btn"
          disabled={busy || !Number.isFinite(fromGrade) || !Number.isFinite(toGrade)}
          onClick={onGenerate}
        >
          {busy ? 'Generating…' : 'Generate classes'}
        </button>
        {result && !isError ? (
          <div className="sms-alert sms-alert--success" style={{ flex: '1 1 280px' }}>
            <div>
              <div className="sms-alert__title">Classes generated</div>
              <div className="sms-alert__msg">
                Created {result.createdCount} · Skipped {result.skippedExistingCount} existing
              </div>
            </div>
          </div>
        ) : null}
        {isError ? (
          <div className="sms-alert sms-alert--error" style={{ flex: '1 1 280px' }}>
            <div>
              <div className="sms-alert__title">Generate failed</div>
              <div className="sms-alert__msg">{formatApiError(error)}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

