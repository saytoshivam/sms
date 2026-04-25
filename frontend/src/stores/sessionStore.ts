import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Cross-cutting session state (refresh token for /api/v1/auth/refresh).
 * Access JWT remains in {@link ../lib/storage} for the Axios interceptor.
 */
type SessionState = {
  refreshToken: string | null;
  setRefreshToken: (token: string | null) => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      refreshToken: null,
      setRefreshToken: (refreshToken) => set({ refreshToken }),
    }),
    { name: 'sms-session', partialize: (s) => ({ refreshToken: s.refreshToken }) },
  ),
);
