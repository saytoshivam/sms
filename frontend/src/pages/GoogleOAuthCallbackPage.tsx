import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBranding } from '../lib/branding';

/** One exchange per auth code (React StrictMode runs effects twice in dev). */
const googleJwtByCode = new Map<string, Promise<string>>();

function fetchGoogleJwtOnce(code: string): Promise<string> {
  const existing = googleJwtByCode.get(code);
  if (existing) return existing;
  const p = api
    .get<{ token: string }>('/auth/google/callback', { params: { code } })
    .then((res) => {
      const token = res.data?.token;
      if (!token) throw new Error('Invalid response from server (no token).');
      return token;
    })
    .finally(() => {
      googleJwtByCode.delete(code);
    });
  googleJwtByCode.set(code, p);
  return p;
}

export function GoogleOAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { refresh } = useBranding();
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');
    const oauthErrorDesc = searchParams.get('error_description');

    if (oauthError) {
      setMessage(oauthErrorDesc || oauthError || 'Google sign-in was cancelled or failed.');
      return;
    }
    if (!code) {
      setMessage('Missing authorization code. Return to login and try again.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        try {
          await refresh();
        } catch {
          // branding is optional
        }
        const token = await fetchGoogleJwtOnce(code);
        if (cancelled) return;
        login(token);
        navigate('/app', { replace: true });
      } catch (err: unknown) {
        if (cancelled) return;
        const ax = err as { response?: { data?: unknown }; message?: string };
        const data = ax.response?.data;
        setMessage(
          typeof data === 'string'
            ? data
            : ax.message || 'Google sign-in failed. Try username/password or contact an admin.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, login, navigate, refresh]);

  return (
    <div className="container">
      <div className="stack" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2 style={{ margin: 0 }}>Google sign-in</h2>
        <div className="card">
          <p style={{ margin: 0 }}>{message}</p>
          <button type="button" className="btn secondary" onClick={() => navigate('/login', { replace: true })}>
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
