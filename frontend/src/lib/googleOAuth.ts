export type GoogleOAuthPublicConfig = {
  clientId: string;
  redirectUri: string;
};

export function buildGoogleAuthorizeUrl(cfg: GoogleOAuthPublicConfig): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
