import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, getToken, setToken } from './storage';
import { subscribeSessionInvalidation } from './sessionInvalidation';

type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());

  useEffect(() => {
    return subscribeSessionInvalidation(() => setTokenState(null));
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sms.token' && e.newValue == null) setTokenState(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login: (t) => {
        setToken(t);
        setTokenState(t);
      },
      logout: () => {
        clearToken();
        setTokenState(null);
      },
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

