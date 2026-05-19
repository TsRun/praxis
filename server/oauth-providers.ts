import { createRemoteJWKSet, jwtVerify } from 'jose';

// Provider-agnostic OAuth shape. Each provider knows how to:
//   1. point the browser at the authorize endpoint (authorizeUrl + scope)
//   2. exchange the code for tokens (tokenUrl)
//   3. extract a stable identity from those tokens (verify)
//
// Adding a new provider is one entry here + (if needed) a small verify fn.
// E.g. lichess: same shape, but verify hits the userinfo endpoint with the
// access token instead of decoding an id_token.

export interface OAuthProfile {
  subject: string;        // stable per-provider user id (Google 'sub', lichess id, …)
  email: string;          // lowercased
  emailVerified: boolean; // provider's claim — we hard-refuse if false
  name: string;           // raw provider-supplied name; caller sanitises
}

export interface OAuthProvider {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  // Verifies the token response and returns a normalised profile.
  // Receives the nonce that was sent with the authorize request (to check
  // against the id_token's nonce claim, when applicable).
  verify: (tokenResponse: TokenResponse, expectedNonce: string) => Promise<OAuthProfile>;
}

export interface TokenResponse {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

// ── Google ──────────────────────────────────────────────────────────────
// Standard OIDC. The id_token carries everything we need (sub, email,
// email_verified, name) signed by Google. We don't store the access token.

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const GOOGLE_ISSUER = 'https://accounts.google.com';

async function verifyGoogle(
  tokens: TokenResponse,
  expectedNonce: string,
): Promise<OAuthProfile> {
  if (!tokens.id_token) throw new Error('google: missing id_token in response');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');
  const { payload } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUER,
    audience: clientId,
  });
  if (payload.nonce !== expectedNonce) {
    throw new Error('google: nonce mismatch');
  }
  const subject = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === 'string' ? payload.name : email.split('@')[0];
  if (!subject || !email) throw new Error('google: id_token missing sub/email');
  return { subject, email, emailVerified, name };
}

export const providers: Record<string, OAuthProvider> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    verify: verifyGoogle,
  },
};

export function getProvider(name: string): OAuthProvider | null {
  return providers[name] ?? null;
}
