// Spurs SSO — a small OpenID Connect client for the `accounts` provider.
// Authorization-code flow with PKCE. No external OIDC library needed.

const issuer = (process.env.SPURS_ISSUER ?? "").replace(/\/$/, "");

export const oidc = {
  issuer,
  authorizeUrl: `${issuer}/oauth/authorize`,
  tokenUrl: `${issuer}/oauth/token`,
  userinfoUrl: `${issuer}/oauth/userinfo`,
  clientId: process.env.SPURS_CLIENT_ID ?? "",
  clientSecret: process.env.SPURS_CLIENT_SECRET ?? "",
  redirectUri: process.env.SPURS_REDIRECT_URI ?? "",
  scopes: "openid profile email",
};

export interface SpursUser {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: oidc.clientId,
    redirect_uri: oidc.redirectUri,
    scope: oidc.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${oidc.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCode(code: string, codeVerifier: string) {
  const res = await fetch(oidc.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: oidc.redirectUri,
      client_id: oidc.clientId,
      client_secret: oidc.clientSecret,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in: number }>;
}

export async function fetchUserInfo(accessToken: string): Promise<SpursUser> {
  const res = await fetch(oidc.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`UserInfo failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<SpursUser>;
}
