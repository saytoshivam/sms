import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBranding } from '../lib/branding';
import { buildGoogleAuthorizeUrl, type GoogleOAuthPublicConfig } from '../lib/googleOAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { setSchoolCode, refresh } = useBranding();
  const [schoolCode, setSchoolCodeInput] = useState(() => localStorage.getItem('sms.schoolCode') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleCfg, setGoogleCfg] = useState<GoogleOAuthPublicConfig | null>(null);
  const [googleCfgError, setGoogleCfgError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<GoogleOAuthPublicConfig>('/public/oauth/google-config');
        if (!cancelled) {
          setGoogleCfg(data);
          setGoogleCfgError(false);
        }
      } catch {
        if (!cancelled) {
          setGoogleCfg(null);
          setGoogleCfgError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const googleReady = Boolean(googleCfg?.clientId?.trim() && googleCfg?.redirectUri?.trim());

  async function persistSchoolBranding() {
    setSchoolCode(schoolCode);
    try {
      await refresh();
    } catch {
      // optional
    }
  }

  return (
    <div className="container">
      <div className="stack" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2 style={{ margin: 0 }}>Login</h2>
        <div className="card stack">
          <div className="stack">
            <div className="stack" style={{ gap: 6 }}>
              <label>School code</label>
              <input
                value={schoolCode}
                onChange={(e) => setSchoolCodeInput(e.target.value)}
                placeholder="greenwood-high"
                autoComplete="organization"
              />
              <div className="muted" style={{ fontSize: 12 }}>
                Used to load your school’s branding theme before login. Demo school code <code>greenwood-demo</code>, password{' '}
                <code>demo123</code>. Examples: <code>grade8@gmail.com</code> (Grade 8 student), <code>student1@gmail.com</code>{' '}
                (Grade 10), <code>schooladmin@gmail.com</code> (school admin), <code>superadmin@myhaimi.com</code> (platform owner).
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setSchoolCodeInput('');
                  setSchoolCode(null);
                }}
              >
                Clear school code (MyHaimi admin)
              </button>
            </div>
          </div>

          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              try {
                await persistSchoolBranding();
                const res = await api.post<string>('/public/login', { username, password });
                login(res.data);
                navigate('/app');
              } catch (err: unknown) {
                const ax = err as { response?: { data?: unknown } };
                setError(String(ax.response?.data ?? 'Login failed'));
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="stack">
              <div className="stack" style={{ gap: 6 }}>
                <label>Username or email</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <label>Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                />
              </div>
            </div>
            {error ? <div style={{ color: '#b91c1c' }}>{String(error)}</div> : null}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <div className="muted" style={{ fontSize: 12, textAlign: 'right', maxWidth: 240 }}>
                School onboarding is restricted to <strong>MyHaimi</strong> platform administrators.
              </div>
            </div>
          </form>

          <div className="oauth-divider" aria-hidden>
            <span className="muted" style={{ fontSize: 13 }}>
              or
            </span>
          </div>

          <button
            type="button"
            className="btn btn-google"
            disabled={!googleReady}
            onClick={async () => {
              if (!googleCfg) return;
              await persistSchoolBranding();
              window.location.assign(buildGoogleAuthorizeUrl(googleCfg));
            }}
          >
            <GoogleMark size={18} />
            Continue with Google
          </button>
          {!googleReady ? (
            <div className="muted" style={{ fontSize: 12 }}>
              {googleCfgError
                ? 'Could not load Google sign-in settings. Check that the API is running.'
                : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server, and add the redirect URI in Google Cloud Console (see sms.oauth.google.redirect-uri).'}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GoogleMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.02 0 24c0 3.98.92 7.53 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
