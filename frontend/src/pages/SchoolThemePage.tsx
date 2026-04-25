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
          <div style={{ flex: 1, minWidth: 180 }} className="stack">
            <label>Primary</label>
            <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }} className="stack">
            <label>Accent</label>
            <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 180 }} className="stack">
            <label>Background</label>
            <input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }} className="stack">
            <label>Text</label>
            <input value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 180 }} className="stack">
            <label>Nav text</label>
            <input value={navTextColor} onChange={(e) => setNavTextColor(e.target.value)} />
          </div>
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
