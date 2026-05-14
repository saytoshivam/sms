import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  const tabFromUrl = (searchParams.get('tab') ?? 'browse') as 'browse' | 'add';
  const [tab, setTab] = useState<'browse' | 'add'>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  const [gradeRows, setGradeRows] = useState<GradeSectionsRow[]>(() => INITIAL_ROWS.map((r) => ({ ...r })));
  const [defaultCapacity, setDefaultCapacity] = useState<number | ''>('');

  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

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

  const setTabUrl = (next: 'browse' | 'add') => {
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
      <button type="button" className="btn" onClick={() => setTabUrl('add')}>
        + Add class
      </button>
    </>
  );

  return (
    <ModulePage
      title="Classes & sections"
      subtitle="Browse and edit saved sections below. Use Add new for the grade + sections flow, or Bulk import to upload a CSV."
      status={status}
      headerActions={headerActions}
      tabs={[
        { id: 'browse', label: 'Browse', badge: list.length || null },
        { id: 'add', label: 'Add new' },
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
        Same grid as the setup wizard — only{' '}
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
