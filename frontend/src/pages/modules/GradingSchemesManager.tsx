import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { StatusChip, type StatusLevel } from '../../components/module/ModulePage';
import { SmartSelect } from '../../components/SmartSelect';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';

type AcademicYear = { id: number; label: string };
type ClassGroup = { id: number; gradeLevel: number | null; section: string | null; displayName: string | null };

type GradingBand = {
  id: number;
  grade: string;
  minPercent: number;
  maxPercent: number;
  label?: string | null;
  resultType?: 'PASS' | 'FAIL' | string | null;
  gradePoint?: number | null;
  remarks?: string | null;
  sequence: number;
};

type GradingScheme = {
  id: number;
  name: string;
  academicYearId: number | null;
  effectiveFromAcademicYearId?: number | null;
  effectiveToAcademicYearId?: number | null;
  scope?: 'SCHOOL' | 'CLASS_GROUP' | string | null;
  classGroupId?: number | null;
  classGroupLabel?: string | null;
  classGroupIds?: number[] | null;
  classGroupLabels?: string[] | null;
  defaultScheme?: boolean;
  passingPercent?: number | string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | string | null;
  active: boolean;
  conflict?: boolean;
  conflictMessage?: string | null;
  bands: GradingBand[];
};

type DraftBand = {
  id?: number | null;
  grade: string;
  minPercent: number;
  maxPercent: number;
  label: string;
  resultType: 'PASS' | 'FAIL';
  gradePoint?: number | null;
  remarks?: string | null;
  sequence: number;
};

type FormState = {
  name: string;
  scope: 'SCHOOL' | 'CLASS' | 'SECTION';
  classGroupIds: number[];
  effectiveFromAcademicYearId: string;
  effectiveToAcademicYearId: string;
  passingPercent: string;
  defaultScheme: boolean;
  bands: DraftBand[];
};

// ─── Multi-select dropdown ───────────────────────────────────────────────────
type MultiSelectOption = { value: string; label: string };

function MultiSelectDropdown({
  values,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

  const showSearch = options.length > 6;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open) { setMenuStyle(null); return; }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 4;
      const maxList = 300;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const spaceBelow = vh - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(maxList, Math.max(120, openUp ? spaceAbove : spaceBelow));
      const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - rect.width - 8));
      setMenuStyle({
        position: 'fixed',
        left,
        top: openUp ? Math.max(8, rect.top - gap - maxHeight) : rect.bottom + gap,
        width: rect.width,
        maxHeight,
        zIndex: 40000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 5,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false); setQuery('');
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); setQuery(''); } }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (open && showSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, showSearch]);

  function toggle(val: string) {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);
  }

  const triggerLabel = values.length === 0
    ? placeholder
    : values.length === 1
      ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${values.length} selected`;

  return (
    <div className="select-keeper catalog-combobox">
      <div className="catalog-combobox__field">
        <button
          ref={triggerRef}
          type="button"
          className="catalog-combobox__input"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ color: values.length === 0 ? '#94a3b8' : undefined, fontWeight: values.length > 0 ? 700 : 500 }}
        >
          <span className="catalog-combobox__text">{triggerLabel}</span>
        </button>
        <span className="select-keeper__chev" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      {open && menuStyle && createPortal(
        <div ref={menuRef} className="select-keeper__menu--portal" style={menuStyle}>
          {showSearch && (
            <div style={{ paddingBottom: 4, borderBottom: '1px solid rgba(15,23,42,0.08)', marginBottom: 4 }}>
              <input
                ref={searchRef}
                type="text"
                className="select-keeper__search"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ margin: 0 }}
              />
            </div>
          )}
          <ul className="select-keeper__menu-list" role="listbox" aria-multiselectable="true">
            {values.length > 0 && (
              <li role="presentation">
                <button
                  type="button"
                  className="select-keeper__option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChange([])}
                  style={{ fontStyle: 'italic', color: '#64748b', borderBottom: '1px solid rgba(15,23,42,0.07)', borderRadius: 0, marginBottom: 2 }}
                >
                  <span className="catalog-combobox__text">— Clear all —</span>
                </button>
              </li>
            )}
            {filtered.length === 0 && (
              <li className="muted" style={{ padding: '8px 12px', fontSize: 12 }}>No matches</li>
            )}
            {filtered.map((opt) => {
              const checked = values.includes(opt.value);
              return (
                <li key={opt.value} role="presentation">
                  <label
                    className={checked ? 'select-keeper__option select-keeper__option--selected' : 'select-keeper__option'}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      style={{ accentColor: '#ea580c', flexShrink: 0, width: 14, height: 14 }}
                    />
                    <span className="catalog-combobox__text">{opt.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const STANDARD_BANDS: DraftBand[] = [
  { grade: 'A1', minPercent: 91, maxPercent: 100, label: 'Outstanding', resultType: 'PASS', sequence: 1 },
  { grade: 'A2', minPercent: 81, maxPercent: 90, label: 'Excellent', resultType: 'PASS', sequence: 2 },
  { grade: 'B1', minPercent: 71, maxPercent: 80, label: 'Very Good', resultType: 'PASS', sequence: 3 },
  { grade: 'B2', minPercent: 61, maxPercent: 70, label: 'Good', resultType: 'PASS', sequence: 4 },
  { grade: 'C1', minPercent: 51, maxPercent: 60, label: 'Average', resultType: 'PASS', sequence: 5 },
  { grade: 'C2', minPercent: 41, maxPercent: 50, label: 'Below Average', resultType: 'PASS', sequence: 6 },
  { grade: 'D', minPercent: 33, maxPercent: 40, label: 'Pass', resultType: 'PASS', sequence: 7 },
  { grade: 'E', minPercent: 0, maxPercent: 32, label: 'Fail', resultType: 'FAIL', sequence: 8 },
];

function standardBands(): DraftBand[] {
  return STANDARD_BANDS.map((b) => ({ ...b, gradePoint: null, remarks: null }));
}

function formatAcademicYear(label: string | null | undefined): string {
  const raw = (label ?? '').trim();
  if (!raw) return 'Academic year';
  const match = raw.match(/(\d{4})\D+(\d{2}|\d{4})/);
  if (!match) return raw.replace(/-/g, '–');
  const start = match[1];
  const end = match[2].length === 2 ? `${start.slice(0, 2)}${match[2]}` : match[2];
  return `${start}–${end}`;
}

function yearLabel(academicYears: AcademicYear[], id: number | null): string {
  if (id == null) return '';
  const label = academicYears.find((y) => y.id === id)?.label;
  return label ? formatAcademicYear(label) : `Year ${id}`;
}

function effectivePeriodLabel(scheme: GradingScheme, academicYears: AcademicYear[]): string {
  const fromId = scheme.effectiveFromAcademicYearId ?? scheme.academicYearId ?? null;
  const toId = scheme.effectiveToAcademicYearId ?? scheme.academicYearId ?? null;
  if (fromId == null && toId == null) return 'Always';
  // Detect invalid period: from is after to
  if (fromId != null && toId != null && fromId > toId) return 'Invalid period';
  const from = fromId == null ? 'Beginning' : yearLabel(academicYears, fromId);
  const to = toId == null ? 'No end' : yearLabel(academicYears, toId);
  return fromId === toId ? from : `${from} → ${to}`;
}

function isInvalidPeriod(scheme: GradingScheme): boolean {
  const fromId = scheme.effectiveFromAcademicYearId ?? scheme.academicYearId ?? null;
  const toId = scheme.effectiveToAcademicYearId ?? scheme.academicYearId ?? null;
  return fromId != null && toId != null && fromId > toId;
}

function defaultLabelForGrade(grade: string): string {
  const found = STANDARD_BANDS.find((b) => b.grade.toUpperCase() === grade.toUpperCase());
  return found?.label ?? grade;
}

function formFromScheme(scheme?: GradingScheme | null, classGroups: ClassGroup[] = []): FormState {
  if (!scheme) {
    return {
      name: 'Default Grading Scheme',
      scope: 'SCHOOL',
      classGroupIds: [],
      effectiveFromAcademicYearId: '',
      effectiveToAcademicYearId: '',
      passingPercent: '33',
      defaultScheme: true,
      bands: standardBands(),
    };
  }
  const classGroupIds = scheme.classGroupIds?.length ? scheme.classGroupIds : scheme.classGroupId ? [scheme.classGroupId] : [];
  let scope: 'SCHOOL' | 'CLASS' | 'SECTION' = 'SCHOOL';
  if (scheme.scope === 'CLASS_GROUP') {
    const { sections } = deriveClassSelection(classGroupIds, classGroups);
    scope = sections.length > 0 ? 'SECTION' : 'CLASS';
  }
  return {
    name: scheme.name,
    scope,
    classGroupIds,
    effectiveFromAcademicYearId: scheme.effectiveFromAcademicYearId ? String(scheme.effectiveFromAcademicYearId) : '',
    effectiveToAcademicYearId: scheme.effectiveToAcademicYearId ? String(scheme.effectiveToAcademicYearId) : '',
    passingPercent: scheme.passingPercent != null ? String(scheme.passingPercent) : '33',
    defaultScheme: Boolean(scheme.defaultScheme),
    bands: scheme.bands?.length
      ? scheme.bands.map((b, i) => ({
          id: b.id,
          grade: b.grade,
          minPercent: Number(b.minPercent),
          maxPercent: Number(b.maxPercent),
          label: b.label || defaultLabelForGrade(b.grade),
          resultType: b.resultType === 'FAIL' ? 'FAIL' : 'PASS',
          gradePoint: b.gradePoint ?? null,
          remarks: b.remarks ?? null,
          sequence: b.sequence ?? i + 1,
        }))
      : standardBands(),
  };
}

function payload(form: FormState, status: 'DRAFT' | 'ACTIVE') {
  const isClassScope = form.scope === 'CLASS' || form.scope === 'SECTION';
  return {
    name: form.name.trim(),
    scope: isClassScope ? 'CLASS_GROUP' : 'SCHOOL',
    classGroupId: isClassScope ? form.classGroupIds[0] ?? null : null,
    classGroupIds: isClassScope ? form.classGroupIds : [],
    defaultScheme: form.defaultScheme,
    passingPercent: Number(form.passingPercent),
    effectiveFromAcademicYearId: form.effectiveFromAcademicYearId ? Number(form.effectiveFromAcademicYearId) : null,
    effectiveToAcademicYearId: form.effectiveToAcademicYearId ? Number(form.effectiveToAcademicYearId) : null,
    status,
    active: status === 'ACTIVE',
    bands: form.bands.map((b, i) => ({
      grade: b.grade.trim(),
      minPercent: Number(b.minPercent),
      maxPercent: Number(b.maxPercent),
      label: b.label.trim(),
      resultType: b.resultType,
      gradePoint: b.gradePoint ?? null,
      remarks: b.remarks ?? null,
      sequence: i + 1,
    })),
  };
}

function validateForm(form: FormState, strict: boolean): string[] {
  const issues: string[] = [];
  if (!form.name.trim()) issues.push('Scheme name is required.');
  if (!form.scope) issues.push('Scope is required.');
  const passing = Number(form.passingPercent);
  if (!Number.isFinite(passing) || passing < 0 || passing > 100) issues.push('Passing percentage must be between 0 and 100.');
  if ((form.scope === 'CLASS' || form.scope === 'SECTION') && form.classGroupIds.length === 0) issues.push('Class scope requires at least one class selected.');
  const from = form.effectiveFromAcademicYearId ? Number(form.effectiveFromAcademicYearId) : null;
  const to = form.effectiveToAcademicYearId ? Number(form.effectiveToAcademicYearId) : null;
  if (from != null && to != null && from > to) issues.push('Effective From must be before or equal to Effective To.');
  if (form.bands.length === 0) issues.push('At least one grade band is required.');
  const codes = new Set<string>();
  const sorted = [...form.bands].sort((a, b) => Number(a.minPercent) - Number(b.minPercent));
  for (const band of sorted) {
    const code = band.grade.trim().toUpperCase();
    if (!code) issues.push('Grade code is required.');
    else if (codes.has(code)) issues.push(`Grade code must be unique: ${band.grade}`);
    codes.add(code);
    if (!band.label.trim()) issues.push(`${band.grade || 'Band'}: label is required.`);
    if (!['PASS', 'FAIL'].includes(band.resultType)) issues.push(`${band.grade || 'Band'}: result must be PASS or FAIL.`);
    if (!Number.isFinite(Number(band.minPercent)) || !Number.isFinite(Number(band.maxPercent))) issues.push(`${band.grade || 'Band'}: percentages are required.`);
    if (Number(band.minPercent) < 0 || Number(band.maxPercent) > 100) issues.push(`${band.grade || 'Band'}: percentages must be between 0 and 100.`);
    if (Number(band.minPercent) > Number(band.maxPercent)) issues.push(`${band.grade || 'Band'}: Min % must be <= Max %.`);
  }
  if (strict && sorted.length > 0) {
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (Number(cur.minPercent) <= Number(prev.maxPercent)) issues.push(`${prev.grade}/${cur.grade}: overlapping percentage ranges.`);
      if (Number(cur.minPercent) > Number(prev.maxPercent) + 1) issues.push(`${prev.grade}/${cur.grade}: missing percentage gap.`);
    }
    if (Number(sorted[0].minPercent) > 0) issues.push('Bands must cover 0–100: missing 0%.');
    if (Number(sorted[sorted.length - 1].maxPercent) < 100) issues.push('Bands must cover 0–100: missing 100%.');
  }
  return Array.from(new Set(issues));
}

function statusForScheme(scheme: GradingScheme): { label: 'Active' | 'Draft' | 'Archived' | 'Has Conflict' | 'Needs Setup'; level: StatusLevel } {
  if (scheme.conflict) return { label: 'Has Conflict', level: 'error' };
  if (scheme.status === 'ARCHIVED') return { label: 'Archived', level: 'idle' };
  if (validateForm(formFromScheme(scheme), true).length > 0) return { label: 'Needs Setup', level: 'warn' };
  if (scheme.status === 'ACTIVE' || scheme.active) return { label: 'Active', level: 'ok' };
  return { label: 'Draft', level: 'warn' };
}

function scopeLabel(scheme: GradingScheme | FormState): string {
  if (scheme.scope === 'SECTION') return 'Section';
  if (scheme.scope === 'CLASS' || scheme.scope === 'CLASS_GROUP') return 'Class';
  return 'School-wide';
}

function appliesToLabel(scheme: GradingScheme): string {
  if (scheme.scope !== 'CLASS_GROUP') return 'All classes';
  const labels = scheme.classGroupLabels?.filter(Boolean) ?? [];
  if (labels.length > 0) return labels.join(', ');
  return scheme.classGroupLabel ?? 'Selected class';
}

function passingPercent(scheme: GradingScheme): number | null {
  if (scheme.passingPercent != null && Number.isFinite(Number(scheme.passingPercent))) return Number(scheme.passingPercent);
  return null;
}

function rowHelper(scheme: GradingScheme): string {
  if (scheme.conflictMessage) return scheme.conflictMessage;
  if (scheme.scope === 'CLASS_GROUP') return 'Overrides school-wide for selected grades/classes';
  if (scheme.defaultScheme) return 'Default for all classes';
  return 'School-wide grading configuration';
}

function BandEditor({ bands, onChange }: { bands: DraftBand[]; onChange: (bands: DraftBand[]) => void }) {
  const update = (idx: number, patch: Partial<DraftBand>) => onChange(bands.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>Grade bands</div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onChange([...bands, { grade: '', minPercent: 0, maxPercent: 0, label: '', resultType: 'PASS', sequence: bands.length + 1 }])}>Add Band</button>
          <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onChange(standardBands())}>Reset to Standard A1–E Bands</button>
          <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onChange([...bands].sort((a, b) => Number(b.maxPercent) - Number(a.maxPercent)).map((b, i) => ({ ...b, sequence: i + 1 })))}>Auto-sort by Max % descending</button>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)' }}>{['Grade', 'Min %', 'Max %', 'Label', 'Result', 'Actions'].map((h) => <th key={h} style={{ padding: 6 }}>{h}</th>)}</tr></thead>
        <tbody>
          {bands.map((b, idx) => (
            <tr key={`${b.id ?? 'new'}-${idx}`} style={{ borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
              <td style={{ padding: 4 }}><input value={b.grade} onChange={(e) => update(idx, { grade: e.target.value })} style={{ width: 70 }} /></td>
              <td style={{ padding: 4 }}><input type="number" min={0} max={100} value={b.minPercent} onChange={(e) => update(idx, { minPercent: Number(e.target.value) })} style={{ width: 80 }} /></td>
              <td style={{ padding: 4 }}><input type="number" min={0} max={100} value={b.maxPercent} onChange={(e) => update(idx, { maxPercent: Number(e.target.value) })} style={{ width: 80 }} /></td>
              <td style={{ padding: 4 }}><input value={b.label} onChange={(e) => update(idx, { label: e.target.value })} style={{ minWidth: 150 }} /></td>
              <td style={{ padding: 4, minWidth: 110 }}><SmartSelect value={b.resultType} onChange={(v) => update(idx, { resultType: v === 'FAIL' ? 'FAIL' : 'PASS' })} options={[{ value: 'PASS', label: 'PASS' }, { value: 'FAIL', label: 'FAIL' }]} /></td>
              <td style={{ padding: 4 }}><button type="button" className="btn secondary" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => onChange(bands.filter((_, i) => i !== idx).map((row, i) => ({ ...row, sequence: i + 1 })))}>Delete</button></td>
            </tr>
          ))}
          {bands.length === 0 ? <tr><td colSpan={6} className="muted" style={{ padding: 12 }}>No grade bands configured.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/** Derive selected grade levels and specific sections from a list of classGroupIds */
function deriveClassSelection(ids: number[], classGroups: ClassGroup[]): { grades: string[]; sections: number[] } {
  if (ids.length === 0) return { grades: [], sections: [] };
  const levels = new Set<string>();
  ids.forEach((id) => {
    const cg = classGroups.find((c) => c.id === id);
    if (cg?.gradeLevel != null) levels.add(String(cg.gradeLevel));
  });
  const grades = Array.from(levels);
  // If ALL classGroups for those grade levels are included → "all sections" mode (no specific sections)
  const allForLevels = classGroups.filter((cg) => cg.gradeLevel != null && levels.has(String(cg.gradeLevel)));
  const allIncluded = allForLevels.length > 0 && allForLevels.every((cg) => ids.includes(cg.id));
  return { grades, sections: allIncluded ? [] : ids };
}

function SchemeForm({
  initial,
  academicYears,
  classGroups,
  saving,
  submitError,
  onCancel,
  onSaveDraft,
  onPublish,
}: {
  initial: FormState;
  academicYears: AcademicYear[];
  classGroups: ClassGroup[];
  saving: boolean;
  submitError?: unknown;
  onCancel: () => void;
  onSaveDraft: (form: FormState) => void;
  onPublish: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);

  // selGrades: which grade levels are checked (multi-select)
  // selSections: specific section ClassGroup IDs checked (empty = all sections of selGrades)
  const [selGrades, setSelGrades] = useState<string[]>(() => deriveClassSelection(initial.classGroupIds, classGroups).grades);
  const [selSections, setSelSections] = useState<number[]>(() => deriveClassSelection(initial.classGroupIds, classGroups).sections);

  useEffect(() => {
    setForm(initial);
    const { grades, sections } = deriveClassSelection(initial.classGroupIds, classGroups);
    setSelGrades(grades);
    setSelSections(sections);
  }, [initial, classGroups]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Resolve final classGroupIds for submission
  function resolveClassGroupIds(): number[] {
    if (form.scope === 'SCHOOL') return [];
    if (selGrades.length === 0) return [];
    if (form.scope === 'SECTION') {
      // Specific sections only
      return selSections;
    }
    // CLASS scope → all sections of selected grade levels
    return classGroups
      .filter((cg) => cg.gradeLevel != null && selGrades.includes(String(cg.gradeLevel)))
      .map((cg) => cg.id);
  }

  function buildSubmitForm(): FormState {
    return { ...form, classGroupIds: resolveClassGroupIds() };
  }

  const submitForm = buildSubmitForm();
  const draftIssues = validateForm(submitForm, false);
  const publishIssues = validateForm(submitForm, true);

  // Unique sorted grade level options
  const gradeLevelOptions = useMemo(() => {
    const seen = new Set<number>();
    return classGroups
      .filter((cg) => cg.gradeLevel != null && !seen.has(cg.gradeLevel!) && seen.add(cg.gradeLevel!))
      .sort((a, b) => (a.gradeLevel ?? 0) - (b.gradeLevel ?? 0))
      .map((cg) => ({ value: String(cg.gradeLevel), label: `Class ${cg.gradeLevel}` }));
  }, [classGroups]);

  // Sections for all currently selected grade levels (grouped by class for display)
  const sectionsByGrade = useMemo(() => {
    return selGrades
      .sort((a, b) => Number(a) - Number(b))
      .map((grade) => ({
        grade,
        label: `Class ${grade}`,
        sections: classGroups.filter((cg) => String(cg.gradeLevel) === grade),
      }))
      .filter((g) => g.sections.length > 0);
  }, [classGroups, selGrades]);

  const hasSections = sectionsByGrade.some((g) => g.sections.length > 0);

  // Applied-to summary text
  const appliedSummary = useMemo(() => {
    if (selGrades.length === 0) return null;
    const sortedGrades = [...selGrades].sort((a, b) => Number(a) - Number(b));
    if (form.scope === 'CLASS') {
      return `Applies to all sections of ${sortedGrades.map((g) => `Class ${g}`).join(', ')}`;
    }
    if (form.scope === 'SECTION') {
      if (selSections.length === 0) return `Select sections to apply to`;
      const labels = selSections.map((id) => {
        const cg = classGroups.find((c) => c.id === id);
        return cg ? `Class ${cg.gradeLevel}${cg.section ? ` – ${cg.section}` : ''}` : `#${id}`;
      });
      return `Applies to: ${labels.join(', ')}`;
    }
    return null;
  }, [selGrades, selSections, classGroups, form.scope]);

  return (
    <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label className="stack" style={{ gap: 6 }}><span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scheme name</span><input value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Scope</span>
          <SmartSelect
            value={form.scope}
            onChange={(v) => {
              const scope = (v || 'SCHOOL') as 'SCHOOL' | 'CLASS' | 'SECTION';
              set({ scope, classGroupIds: [] });
              setSelGrades([]);
              setSelSections([]);
            }}
            options={[
              { value: 'SCHOOL', label: 'School-wide' },
              { value: 'CLASS', label: 'Class' },
              { value: 'SECTION', label: 'Section' },
            ]}
          />
        </label>
        <label className="stack" style={{ gap: 6 }}><span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Passing percentage</span><input type="number" min={0} max={100} step="0.01" value={form.passingPercent} onChange={(e) => set({ passingPercent: e.target.value })} /></label>
        <label className="stack" style={{ gap: 6 }}><span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Effective From (optional)</span><SmartSelect value={form.effectiveFromAcademicYearId} onChange={(v) => set({ effectiveFromAcademicYearId: v })} options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))} placeholder="Always" allowClear /></label>
        <label className="stack" style={{ gap: 6 }}><span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Effective To (optional)</span><SmartSelect value={form.effectiveToAcademicYearId} onChange={(v) => set({ effectiveToAcademicYearId: v })} options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))} placeholder="Always" allowClear /></label>
        <label className="row" style={{ gap: 8, alignItems: 'center', marginTop: 22 }}><input type="checkbox" checked={form.defaultScheme} onChange={(e) => set({ defaultScheme: e.target.checked })} /><span style={{ fontSize: 13 }}>Default scheme</span></label>
      </div>

      {(form.scope === 'CLASS' || form.scope === 'SECTION') ? (
        <div style={{ marginTop: 12, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 6, padding: 12, background: 'rgba(15,23,42,0.01)' }}>
          {/* Class multi-select dropdown */}
          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Class <span style={{ fontWeight: 400 }}>(select one or more)</span></div>
            <MultiSelectDropdown
              values={selGrades}
              onChange={(grades) => {
                const removed = selGrades.filter((g) => !grades.includes(g));
                const removedIds = classGroups.filter((cg) => cg.gradeLevel != null && removed.includes(String(cg.gradeLevel))).map((cg) => cg.id);
                setSelSections((prev) => prev.filter((id) => !removedIds.includes(id)));
                setSelGrades(grades);
              }}
              options={gradeLevelOptions}
              placeholder="Select class(es)…"
            />
          </div>

          {/* Section multi-select dropdown — only shown when scope = SECTION */}
          {form.scope === 'SECTION' && selGrades.length > 0 && hasSections ? (
            <div style={{ marginBottom: 10 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Section</div>
              <MultiSelectDropdown
                values={selSections.map(String)}
                onChange={(vals) => setSelSections(vals.map(Number))}
                options={sectionsByGrade.flatMap(({ grade, label: gradeLabel, sections }) =>
                  sections.map((cg) => ({
                    value: String(cg.id),
                    label: `${gradeLabel} – ${cg.section ?? cg.displayName ?? `#${cg.id}`}`,
                  }))
                )}
                placeholder="Select section(s)…"
              />
            </div>
          ) : null}

          {/* Summary */}
          {appliedSummary ? (
            <div style={{ marginTop: 8, fontSize: 12, color: '#0369a1', background: '#f0f9ff', borderRadius: 4, padding: '5px 10px', border: '1px solid #bae6fd' }}>
              ℹ {appliedSummary}
            </div>
          ) : null}

          {/* Override hierarchy hint */}
          <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
            Override hierarchy: <strong>Section</strong> overrides <strong>Class</strong>, <strong>Class</strong> overrides <strong>School-wide</strong>
          </div>
        </div>
      ) : null}

      <BandEditor bands={form.bands} onChange={(bands) => set({ bands })} />
      {publishIssues.length > 0 ? <div style={{ marginTop: 10, color: '#991b1b', fontSize: 12 }}><div style={{ fontWeight: 800 }}>Validation</div><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{publishIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : null}
      {submitError ? <div style={{ color: '#b91c1c', marginTop: 8 }}>{formatApiError(submitError)}</div> : null}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        <button type="button" className="btn secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn secondary" onClick={() => onSaveDraft(buildSubmitForm())} disabled={saving || draftIssues.length > 0}>{saving ? 'Saving…' : 'Save Draft'}</button>
        <button type="button" className="btn" onClick={() => onPublish(buildSubmitForm())} disabled={saving || publishIssues.length > 0}>{saving ? 'Saving…' : 'Publish'}</button>
      </div>
    </div>
  );
}

type MenuAction = { label: string; icon?: string; danger?: boolean; disabled?: boolean; onClick: () => void };

function PortalMenu({ anchorRef, open, onClose, actions }: { anchorRef: React.RefObject<HTMLButtonElement | null>; open: boolean; onClose: () => void; actions: MenuAction[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', top: 0, right: 0, zIndex: 9999 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const OFFSET = 6;
    const menuHeight = 240; // approximate
    const menuWidth = 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > menuHeight ? rect.bottom + OFFSET : rect.top - OFFSET - menuHeight;
    const right = window.innerWidth - rect.right;
    setStyle({ position: 'fixed', top: Math.max(8, top), right: Math.max(8, right), zIndex: 9999, minWidth: menuWidth });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div ref={menuRef} style={{ ...style, background: '#fff', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 6, boxShadow: '0 8px 24px rgba(15,23,42,0.16)', padding: '4px 0', minWidth: style.minWidth }}>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={action.disabled}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, background: 'none', border: 'none', cursor: action.disabled ? 'default' : 'pointer', color: action.danger ? '#b45309' : '#0f172a', opacity: action.disabled ? 0.5 : 1, whiteSpace: 'nowrap' }}
          onMouseOver={(e) => { if (!action.disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.05)'; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          onClick={() => { action.onClick(); onClose(); }}
        >
          {action.icon ? `${action.icon} ` : ''}{action.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

function RowActions({ g, onView, onEdit, onPublish, onClone, onSetDefault, onArchive, publishPending, clonePending, setDefaultPending, archivePending }: {
  g: GradingScheme; onView: () => void; onEdit: () => void; onPublish: () => void; onClone: () => void; onSetDefault: () => void; onArchive: () => void;
  publishPending: boolean; clonePending: boolean; setDefaultPending: boolean; archivePending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const archived = g.status === 'ARCHIVED';
  const isDraft = g.status === 'DRAFT';
  const isActive = g.status === 'ACTIVE' || g.active;

  const actions: MenuAction[] = [];
  if (!archived) actions.push({ label: 'Edit', icon: '✎', onClick: onEdit });
  if (isDraft) actions.push({ label: 'Publish', icon: '✓', onClick: onPublish, disabled: publishPending });
  actions.push({ label: 'Clone', icon: '⎘', onClick: onClone, disabled: clonePending });
  if (isActive && !g.defaultScheme && g.scope !== 'CLASS_GROUP') actions.push({ label: 'Set as Default', icon: '★', onClick: onSetDefault, disabled: setDefaultPending });
  if (!archived) actions.push({ label: isDraft ? 'Discard Draft' : 'Archive', icon: isDraft ? '✕' : '▾', danger: true, onClick: onArchive, disabled: archivePending });

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={onView}>View</button>
      <button
        ref={btnRef}
        type="button"
        style={{ background: 'none', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: '#64748b' }}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="More actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        ⋯
      </button>
      <PortalMenu anchorRef={btnRef} open={open} onClose={() => setOpen(false)} actions={actions} />
    </div>
  );
}

export function GradingSchemesManager({ gradingSchemes, academicYears, classGroups, onChanged }: { gradingSchemes: GradingScheme[]; academicYears: AcademicYear[]; classGroups: ClassGroup[]; onChanged: () => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterState, setFilterState] = useState('');
  const selected = gradingSchemes.find((g) => g.id === selectedId) ?? null;

  const save = useMutation({
    mutationFn: async ({ id, form, status }: { id?: number; form: FormState; status: 'DRAFT' | 'ACTIVE' }) => {
      const body = payload(form, status);
      return id ? (await api.put<GradingScheme>(`/api/exams/grading-schemes/${id}`, body)).data : (await api.post<GradingScheme>('/api/exams/grading-schemes', body)).data;
    },
    onSuccess: async (_data, vars) => { toast.success(vars.status === 'ACTIVE' ? 'Grading scheme published' : 'Draft saved'); setCreateOpen(false); setEditing(false); await onChanged(); },
    onError: (e) => toast.error('Could not save grading scheme', formatApiError(e)),
  });
  const publish = useMutation({ mutationFn: async (id: number) => (await api.post<GradingScheme>(`/api/exams/grading-schemes/${id}/publish`)).data, onSuccess: async () => { toast.success('Grading scheme published'); await onChanged(); }, onError: (e) => toast.error('Could not publish grading scheme', formatApiError(e)) });
  const clone = useMutation({ mutationFn: async (id: number) => (await api.post<GradingScheme>(`/api/exams/grading-schemes/${id}/clone`)).data, onSuccess: async () => { toast.success('Grading scheme cloned'); await onChanged(); }, onError: (e) => toast.error('Could not clone grading scheme', formatApiError(e)) });
  const archive = useMutation({ mutationFn: async (id: number) => (await api.post<GradingScheme>(`/api/exams/grading-schemes/${id}/archive`)).data, onSuccess: async () => { toast.success('Grading scheme archived'); setSelectedId(null); await onChanged(); }, onError: (e) => toast.error('Could not archive grading scheme', formatApiError(e)) });
  const setDefault = useMutation({ mutationFn: async (id: number) => (await api.post<GradingScheme>(`/api/exams/grading-schemes/${id}/set-default`)).data, onSuccess: async () => { toast.success('Default grading scheme updated'); await onChanged(); }, onError: (e) => toast.error('Could not set default grading scheme', formatApiError(e)) });

  const filtered = useMemo(() => gradingSchemes.filter((g) => {
    const q = search.trim().toLowerCase();
    const state = statusForScheme(g).label;
    if (q && !g.name.toLowerCase().includes(q) && !appliesToLabel(g).toLowerCase().includes(q)) return false;
    if (filterScope && g.scope !== filterScope) return false;
    if (filterYear) {
      const yearId = Number(filterYear);
      const from = g.effectiveFromAcademicYearId ?? g.academicYearId ?? null;
      const to = g.effectiveToAcademicYearId ?? g.academicYearId ?? null;
      if (!((from == null || yearId >= from) && (to == null || yearId <= to))) return false;
    }
    if (filterState && state !== filterState) return false;
    return true;
  }), [gradingSchemes, search, filterScope, filterYear, filterState]);

  if (selected) {
    const state = statusForScheme(selected);
    const issues = validateForm(formFromScheme(selected, classGroups), true);
    const pp = passingPercent(selected);
    const archived = selected.status === 'ARCHIVED';
    if (editing) {
      return <div className="stack" style={{ gap: 12 }}><div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><button type="button" className="btn secondary" onClick={() => setEditing(false)}>← Back to view</button><div style={{ fontWeight: 900 }}>Edit Grading Scheme</div></div><SchemeForm initial={formFromScheme(selected, classGroups)} academicYears={academicYears} classGroups={classGroups} saving={save.isPending} submitError={save.error} onCancel={() => setEditing(false)} onSaveDraft={(form) => save.mutate({ id: selected.id, form, status: 'DRAFT' })} onPublish={(form) => save.mutate({ id: selected.id, form, status: 'ACTIVE' })} /></div>;
    }
    return (
      <div className="stack" style={{ gap: 12 }}>
        <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <button type="button" className="btn secondary" onClick={() => setSelectedId(null)} style={{ marginBottom: 10 }}>← Back to grading schemes</button>
              <h2 style={{ margin: 0, fontSize: 18 }}>{selected.name}</h2>
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Effective Period: {effectivePeriodLabel(selected, academicYears)} · Scope: {scopeLabel(selected)} · Applies To: {appliesToLabel(selected)} · Default: {selected.defaultScheme ? 'Yes' : 'No'}</div>
              {isInvalidPeriod(selected) ? <div style={{ marginTop: 4, fontSize: 12, color: '#b91c1c' }}>⚠ Effective from cannot be after effective to.</div> : null}
              {!isInvalidPeriod(selected) && effectivePeriodLabel(selected, academicYears) === 'Always' ? <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>Applies across academic years.</div> : null}
              <div className="muted" style={{ marginTop: 5, fontSize: 12 }}>Used in result calculation after weighted scores are computed. Class-group schemes override the school-wide default when applicable.</div>
              <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <StatusChip level={state.level} label={state.label} />
                {selected.status === 'ACTIVE' && selected.defaultScheme ? <StatusChip level="info" label="Default" /> : null}
                {selected.status === 'ARCHIVED' && selected.defaultScheme ? <StatusChip level="idle" label="Was default" /> : null}
                <StatusChip level={pp != null ? 'ok' : 'warn'} label={pp != null ? `Passing rule: ${pp}% and above` : 'Passing rule missing'} />
                {selected.conflict ? <StatusChip level="error" label={selected.conflictMessage ?? 'Conflict'} /> : null}
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!archived ? <button type="button" className="btn" onClick={() => setEditing(true)}>Edit</button> : null}
              {selected.status === 'DRAFT' ? <button type="button" className="btn secondary" onClick={() => publish.mutate(selected.id)} disabled={publish.isPending}>Publish</button> : null}
              <button type="button" className="btn secondary" onClick={() => clone.mutate(selected.id)} disabled={clone.isPending}>Clone</button>
              {!archived ? <button type="button" className="btn secondary" onClick={() => archive.mutate(selected.id)} disabled={archive.isPending}>Archive</button> : null}
              {!archived && (selected.status === 'ACTIVE' || selected.active) && !selected.defaultScheme && selected.scope !== 'CLASS_GROUP' ? <button type="button" className="btn secondary" onClick={() => setDefault.mutate(selected.id)} disabled={setDefault.isPending}>Set as Default</button> : null}
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}><div style={{ fontWeight: 900, marginBottom: 10 }}>Grade Bands</div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.12)' }}>{['Grade', 'Min %', 'Max %', 'Label', 'Result'].map((h) => <th key={h} style={{ padding: '8px 6px' }}>{h}</th>)}</tr></thead><tbody>{[...(selected.bands ?? [])].sort((a, b) => Number(b.maxPercent) - Number(a.maxPercent)).map((b) => <tr key={b.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}><td style={{ padding: '8px 6px', fontWeight: 800 }}>{b.grade}</td><td style={{ padding: '8px 6px' }}>{b.minPercent}</td><td style={{ padding: '8px 6px' }}>{b.maxPercent}</td><td style={{ padding: '8px 6px' }}>{b.label || defaultLabelForGrade(b.grade)}</td><td style={{ padding: '8px 6px' }}><StatusChip level={(b.resultType ?? '').toUpperCase() === 'FAIL' ? 'error' : 'ok'} label={(b.resultType ?? 'PASS').toUpperCase()} /></td></tr>)}</tbody></table></div></div>
        <div className="card" style={{ padding: 12, border: `1px solid ${issues.length || selected.conflict ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}` }}><div style={{ fontWeight: 900, marginBottom: 10 }}>Validation</div>{selected.conflictMessage ? <div style={{ color: '#991b1b', fontSize: 12, marginBottom: 8 }}>{selected.conflictMessage}</div> : null}{issues.length > 0 ? <ul style={{ margin: 0, paddingLeft: 18, color: '#991b1b', fontSize: 12 }}>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <div className="muted" style={{ fontSize: 12 }}>All grade band validations passed.</div>}</div>
      </div>
    );
  }

  const activeCount = gradingSchemes.filter((g) => g.status === 'ACTIVE' || g.active).length;
  const draftCount = gradingSchemes.filter((g) => statusForScheme(g).label === 'Draft').length;
  const conflictCount = gradingSchemes.filter((g) => statusForScheme(g).label === 'Has Conflict').length;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.1)' }}><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}><div><div style={{ fontWeight: 950, fontSize: 18 }}>Grading Schemes</div><div className="muted" style={{ marginTop: 5, fontSize: 13 }}>Create and manage grade bands used for result calculation.</div><div className="muted" style={{ marginTop: 4, fontSize: 12 }}>Grading schemes define grade bands used after weighted score calculation.</div></div><button type="button" className="btn" onClick={() => setCreateOpen((v) => !v)} disabled={save.isPending}>{createOpen ? 'Close form' : 'Create Grading Scheme'}</button></div></div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>{[{ label: 'Total grading schemes', value: gradingSchemes.length, bg: '#eff6ff', color: '#1d4ed8' }, { label: 'Active schemes', value: activeCount, bg: '#d1fae5', color: '#065f46' }, { label: 'Draft schemes', value: draftCount, bg: '#fef3c7', color: '#92400e' }, { label: 'Conflicts', value: conflictCount, bg: conflictCount > 0 ? '#fee2e2' : '#f1f5f9', color: conflictCount > 0 ? '#991b1b' : '#475569' }].map((card) => <div key={card.label} className="card" style={{ padding: 14, border: '1px solid rgba(15,23,42,0.08)', background: card.bg }}><div style={{ fontSize: 11, fontWeight: 900, color: card.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div><div style={{ fontSize: 26, fontWeight: 950, color: card.color, marginTop: 4 }}>{card.value}</div></div>)}</div>
      {createOpen ? <SchemeForm initial={formFromScheme(null)} academicYears={academicYears} classGroups={classGroups} saving={save.isPending} submitError={save.error} onCancel={() => setCreateOpen(false)} onSaveDraft={(form) => save.mutate({ form, status: 'DRAFT' })} onPublish={(form) => save.mutate({ form, status: 'ACTIVE' })} /> : null}
      <div className="card" style={{ padding: 12, border: '1px solid rgba(15,23,42,0.1)' }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 12 }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search grading scheme..." style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.2)', gridColumn: 'span 2' }} /><SmartSelect value={filterScope} onChange={setFilterScope} options={[{ value: 'SCHOOL', label: 'School-wide' }, { value: 'CLASS_GROUP', label: 'Class Group' }]} placeholder="All scopes" allowClear /><SmartSelect value={filterYear} onChange={setFilterYear} options={academicYears.map((y) => ({ value: String(y.id), label: y.label }))} placeholder="All academic years" allowClear /><SmartSelect value={filterState} onChange={setFilterState} options={['Active', 'Draft', 'Archived', 'Needs Setup', 'Has Conflict'].map((s) => ({ value: s, label: s }))} placeholder="All states" allowClear /></div>
        <div style={{ overflowX: 'auto' }} >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(15,23,42,0.1)', background: 'rgba(15,23,42,0.02)' }}>
                {['Scheme Name', 'Scope', 'Applies To', 'Effective Period', 'Bands', 'Passing %', 'State'].map((h) => (
                  <th key={h} style={{ padding: '8px 8px', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                <th style={{ padding: '8px 8px', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 16 }}>No grading schemes match the current filters.</td></tr>
              ) : filtered.map((g) => {
                const state = statusForScheme(g);
                const pp = passingPercent(g);
                const periodLabel = effectivePeriodLabel(g, academicYears);
                const periodInvalid = isInvalidPeriod(g);
                return (
                  <tr key={g.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.07)', cursor: 'pointer' }} onClick={() => setSelectedId(g.id)}>
                    <td style={{ padding: '9px 8px', fontWeight: 800 }}>
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <span>{g.name}</span>
                        {g.status === 'ACTIVE' && g.defaultScheme ? <StatusChip level="info" label="Default" /> : null}
                        {g.status === 'ARCHIVED' && g.defaultScheme ? <StatusChip level="idle" label="Was default" /> : null}
                        {g.conflict ? <StatusChip level="error" label="Conflict" /> : null}
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{rowHelper(g)}</div>
                    </td>
                    <td style={{ padding: '9px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{scopeLabel(g)}</td>
                    <td style={{ padding: '9px 8px' }}>{appliesToLabel(g)}</td>
                    <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>
                      {periodInvalid
                        ? <span style={{ color: '#b91c1c', fontSize: 12 }}>⚠ Invalid period</span>
                        : periodLabel}
                    </td>
                    <td style={{ padding: '9px 8px', textAlign: 'center' }}>{g.bands?.length ?? 0}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center' }}>{pp != null ? `${pp}%` : '—'}</td>
                    <td style={{ padding: '9px 8px' }}><StatusChip level={state.level} label={state.label} /></td>
                    <td style={{ padding: '9px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <RowActions
                        g={g}
                        onView={() => setSelectedId(g.id)}
                        onEdit={() => { setSelectedId(g.id); setEditing(true); }}
                        onPublish={() => publish.mutate(g.id)}
                        onClone={() => clone.mutate(g.id)}
                        onSetDefault={() => setDefault.mutate(g.id)}
                        onArchive={() => archive.mutate(g.id)}
                        publishPending={publish.isPending}
                        clonePending={clone.isPending}
                        setDefaultPending={setDefault.isPending}
                        archivePending={archive.isPending}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
