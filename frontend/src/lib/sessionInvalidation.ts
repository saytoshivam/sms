import { clearToken } from './storage';
import { useSessionStore } from '../stores/sessionStore';

const listeners = new Set<() => void>();

export function subscribeSessionInvalidation(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Clears access token, refresh token, and notifies AuthProvider (and any other subscribers). */
export function invalidateSession() {
  clearToken();
  useSessionStore.getState().setRefreshToken(null);
  listeners.forEach((fn) => {
    fn();
  });
}

/** True if JWT `exp` is in the past (opaque tokens return false). */
export function isAccessTokenExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    if (payload.exp == null) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}
