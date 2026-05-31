import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useBranding } from '../lib/branding';
import { APP_THEME } from '../theme/appTheme';
import { formatApiError } from '../lib/errors';
import { toast } from '../lib/toast';

type Me = {
  roles: string[];
  schoolId?: number | null;
};

const BRAND_SWATCHES = [
  '#ea580c', '#f97316', '#f59e0b', '#eab308', '#16a34a', '#059669',
  '#0ea5e9', '#2563eb', '#4f46e5', '#7c3aed', '#db2777', '#dc2626',
];

const SURFACE_SWATCHES = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#fffbeb', '#fef3c7', '#ecfeff',
  '#eff6ff', '#f5f3ff', '#0f172a', '#1e293b', '#334155', '#475569',
];

function pickerValue(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback;
}

function ColorField({
  label,
  value,
  onChange,
  swatches,
  fallback,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches: string[];
  fallback: string;
}) {
  const safePickerValue = pickerValue(value, fallback);
  return (
    <div style={{ flex: 1, minWidth: 240 }} className="stack">
      <label>{label}</label>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={safePickerValue}
          onChange={(e) => onChange(e.target.value)}
          title={`Pick ${label.toLowerCase()} color`}
          style={{ width: 44, height: 38, padding: 2, cursor: 'pointer' }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          style={{ flex: 1, minWidth: 120 }}
        />
        <span
          aria-label={`${label} preview`}
          title={value}
          style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(15,23,42,0.18)', background: safePickerValue, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)' }}
        />
      </div>
      <div className="muted" style={{ fontSize: 11 }}>Color chart</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 24px)', gap: 6 }}>
        {swatches.map((color) => {
          const selected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={`${label}-${color}`}
              type="button"
              aria-label={`Use ${color} for ${label}`}
              title={color}
              onClick={() => onChange(color)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                border: selected ? '2px solid #0f172a' : '1px solid rgba(15,23,42,0.18)',
                background: color,
                cursor: 'pointer',
                boxShadow: selected ? '0 0 0 2px rgba(14,165,233,0.25)' : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SchoolThemePage() {
  const qc = useQueryClient();
  const { refresh } = useBranding();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>('/user/me')).data,
  });

  const isSuperAdmin = (me.data?.roles ?? []).includes('SUPER_ADMIN');

  const [schoolId, setSchoolId] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState<string>(APP_THEME.primaryColor);
  const [accentColor, setAccentColor] = useState<string>(APP_THEME.accentColor);
  const [backgroundColor, setBackgroundColor] = useState<string>(APP_THEME.backgroundColor);
  const [textColor, setTextColor] = useState<string>(APP_THEME.textColor);
  const [navTextColor, setNavTextColor] = useState<string>(APP_THEME.navTextColor);

  const defaults = useMemo(() => ({ ...APP_THEME }), []);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        primaryColor,
        accentColor,
        backgroundColor,
        textColor,
        navTextColor,
      };
      if (isSuperAdmin) payload.schoolId = Number(schoolId);
      return (await api.put('/api/school/theme', payload)).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      await refresh();
      toast.success('Saved', 'Theme updated.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>School theme</h2>
      <div className="card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Platform default palette lives in <code>frontend/src/theme/appTheme.ts</code> (and Java{' '}
          <code>AppThemeDefaults</code>). Per-school values override it for everyone using that school code.
        </div>

        {isSuperAdmin ? (
          <div className="stack" style={{ marginBottom: 12 }}>
            <label>School id (platform)</label>
            <input value={schoolId} onChange={(e) => setSchoolId(e.target.value)} placeholder="e.g. 3" />
            <div className="muted" style={{ fontSize: 12 }}>
              School admins can update their own school without entering an id.
            </div>
          </div>
        ) : null}

        <div className="row">
          <ColorField label="Primary" value={primaryColor} onChange={setPrimaryColor} swatches={BRAND_SWATCHES} fallback={defaults.primaryColor} />
          <ColorField label="Accent" value={accentColor} onChange={setAccentColor} swatches={BRAND_SWATCHES} fallback={defaults.accentColor} />
        </div>
        <div className="row">
          <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} swatches={SURFACE_SWATCHES} fallback={defaults.backgroundColor} />
          <ColorField label="Text" value={textColor} onChange={setTextColor} swatches={SURFACE_SWATCHES} fallback={defaults.textColor} />
        </div>
        <div className="row">
          <ColorField label="Nav text" value={navTextColor} onChange={setNavTextColor} swatches={SURFACE_SWATCHES} fallback={defaults.navTextColor} />
          <div style={{ alignSelf: 'end' }} className="row">
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setPrimaryColor(defaults.primaryColor);
                setAccentColor(defaults.accentColor);
                setBackgroundColor(defaults.backgroundColor);
                setTextColor(defaults.textColor);
                setNavTextColor(defaults.navTextColor);
              }}
            >
              Reset fields
            </button>
            <button
              className="btn"
              disabled={save.isPending || (isSuperAdmin && !schoolId)}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Save theme'}
            </button>
          </div>
        </div>

        {save.error ? <div style={{ color: '#b91c1c' }}>{formatApiError(save.error)}</div> : null}
      </div>
    </div>
  );
}
