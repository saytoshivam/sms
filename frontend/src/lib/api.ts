import axios from 'axios';
import { getToken } from './storage';
import { invalidateSession, isAccessTokenExpired } from './sessionInvalidation';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080',
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

