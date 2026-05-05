import axios from 'axios';
import { getToken } from './storage';
import { invalidateSession, isAccessTokenExpired } from './sessionInvalidation';

/**
 * Prefer same-origin `/api` so Vite dev server and `vite preview` can proxy to Spring Boot (`vite.config.ts`).
 * Set `VITE_API_BASE_URL` when the UI and API are on different origins (CDN + API host, etc.).
 * Empty string in env is treated as “unset”.
 *
 * Hardcoding `localhost:8080` for production bundles breaks as soon as the API runs on another port
 * or only the browser origin should receive proxied `/api` traffic (common with `vite preview`).
 */
function resolveApiBaseURL(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed) return trimmed;
  if (typeof window !== 'undefined') {
    return '';
  }
  if (import.meta.env.DEV) return '';
  return 'http://localhost:8080';
}

export const api = axios.create({
  baseURL: resolveApiBaseURL(),
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    if (isAccessTokenExpired(token)) {
      invalidateSession();
      return Promise.reject(new axios.Cancel('Session expired'));
    }
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status as number | undefined;
    if (status === 401) {
      invalidateSession();
    }
    return Promise.reject(error);
  },
);

