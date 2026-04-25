import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { APP_THEME } from '../theme/appTheme';

export type SchoolBranding = {
  name: string;
  code: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  navTextColor: string;
};

type BrandingContextValue = {
  schoolCode: string | null;
  branding: SchoolBranding | null;
  setSchoolCode: (code: string | null) => void;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

const STORAGE_KEY = 'sms.schoolCode';

function applyCssVars(b: SchoolBranding | null) {
  const root = document.documentElement;
  const src = b ?? {
    name: '',
    code: '',
    ...APP_THEME,
  };
  root.style.setProperty('--color-primary', src.primaryColor);
  root.style.setProperty('--color-accent', src.accentColor);
  root.style.setProperty('--color-bg', src.backgroundColor);
  root.style.setProperty('--color-text', src.textColor);
  root.style.setProperty('--color-nav-text', src.navTextColor);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [schoolCode, setSchoolCodeState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [branding, setBranding] = useState<SchoolBranding | null>(null);

  const refresh = useCallback(async () => {
    if (!schoolCode) {
      setBranding(null);
      applyCssVars(null);
      return;
    }
    const res = await api.get<SchoolBranding>(`/public/schools/${encodeURIComponent(schoolCode)}/branding`);
    setBranding(res.data);
    applyCssVars(res.data);
  }, [schoolCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSchoolCode = useCallback((code: string | null) => {
    const normalized = code?.trim() ? code.trim().toLowerCase() : null;
    setSchoolCodeState(normalized);
    if (normalized) localStorage.setItem(STORAGE_KEY, normalized);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<BrandingContextValue>(
    () => ({
      schoolCode,
      branding,
      setSchoolCode,
      refresh,
    }),
    [schoolCode, branding, setSchoolCode, refresh],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}
