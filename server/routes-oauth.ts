import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { createHash, randomBytes } from 'node:crypto';
import { createSession } from './auth.js';
import { sanitizeName } from './routes-auth.js';
import { getProvider, type OAuthProfile, type TokenResponse } from './oauth-providers.js';
import { claimInviteForUser } from './routes-auth.js';

const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 5 * 60 * 1000;
const SESSION_COOKIE = 'sid';
const COOKIE_SECURE = process.env.ALLOW_INSECURE_COOKIE === '1' ? false : true;

interface StateCookie {
  state: string;
  code_verifier: string;
  nonce: string;
  invite_token: string | null;
  created_at: number;
  provider: string;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function redirectBaseUrl(): string {
  return process.env.OAUTH_REDIRECT_BASE_URL
      ?? process.env.APP_BASE_URL
      ?? 'http://localhost:5173';
}

function callbackUrl(provider: string): string {
  return `${redirectBaseUrl()}/api/auth/oauth/${provider}/callback`;
}

function setStateCookie(reply: FastifyReply, payload: StateCookie): void {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  reply.setCookie(STATE_COOKIE, encoded, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/api/auth/oauth',
    maxAge: STATE_TTL_MS / 1000,
    signed: true,
  });
}

function readStateCookie(req: FastifyRequest): StateCookie | null {
  const raw = req.cookies?.[STATE_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;
  try {
    const json = Buffer.from(unsigned.value, 'base64url').toString('utf8');
    const obj = JSON.parse(json) as StateCookie;
    if (Date.now() - obj.created_at > STATE_TTL_MS) return null;
    return obj;
  } catch {
    return null;
  }
}

function clearStateCookie(reply: FastifyReply): void {
  reply.clearCookie(STATE_COOKIE, { path: '/api/auth/oauth' });
}

function setSessionCookie(reply: FastifyReply, sid: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
    expires: expiresAt,
    signed: true,
  });
}

/**
 * Find or create the app_user that owns this provider identity.
 *
 * 1. (provider, subject) hit → existing oauth_identity row, return its user.
 * 2. email match in app_user  → link the identity, return that user.
 * 3. neither                  → create app_user (no password) + oauth_identity.
 *
 * email_verified=false is a hard refusal — otherwise an attacker could
 * register a sloppy Workspace identity claiming someone else's verified
 * password account.
 */
async function resolveOAuthUser(
  pool: Pool,
  provider: string,
  profile: OAuthProfile,
): Promise<{ userId: number; isNew: boolean; email: string }> {
  if (!profile.emailVerified) {
    const e = new Error('email-unverified');
    (e as Error & { code?: string }).code = 'email-unverified';
    throw e;
  }
  const email = profile.email;

  const byIdentity = await pool.query<{ user_id: number }>(
    `SELECT user_id FROM oauth_identity WHERE provider = $1 AND subject = $2`,
    [provider, profile.subject],
  );
  if (byIdentity.rowCount) {
    return { userId: byIdentity.rows[0].user_id, isNew: false, email };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const byEmail = await client.query<{ id: number }>(
      `SELECT id FROM app_user WHERE email = $1`,
      [email],
    );
    let userId: number;
    let isNew = false;
    if (byEmail.rowCount) {
      userId = byEmail.rows[0].id;
    } else {
      const name = sanitizeName(profile.name) ?? email.split('@')[0];
      const ins = await client.query<{ id: number }>(
        `INSERT INTO app_user (email, password_hash, name, roles)
         VALUES ($1, NULL, $2, ARRAY[]::TEXT[])
         RETURNING id`,
        [email, name],
      );
      userId = ins.rows[0].id;
      isNew = true;
    }
    await client.query(
      `INSERT INTO oauth_identity (provider, subject, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider, subject) DO NOTHING`,
      [provider, profile.subject, userId],
    );
    await client.query('COMMIT');
    return { userId, isNew, email };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function exchangeCode(
  provider: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`${provider}: client credentials not configured`);
  }
  const p = getProvider(provider);
  if (!p) throw new Error(`${provider}: unknown provider`);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  const res = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${provider}: token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function oauthRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  // ── start: build authorize URL, set state cookie, 302 to provider ─────
  app.get<{ Params: { provider: string }; Querystring: { invite?: string } }>(
    '/api/auth/oauth/:provider/start',
    async (req, reply) => {
      const providerName = req.params.provider;
      const provider = getProvider(providerName);
      if (!provider) return reply.code(404).send({ error: 'unknown provider' });

      const clientId = process.env[`${providerName.toUpperCase()}_CLIENT_ID`];
      if (!clientId) {
        return reply.code(503).send({ error: `${providerName} not configured` });
      }

      const state = randomBytes(16).toString('hex');
      const nonce = randomBytes(16).toString('hex');
      const { verifier, challenge } = pkce();
      const invite = (req.query?.invite ?? '').trim() || null;

      setStateCookie(reply, {
        state,
        code_verifier: verifier,
        nonce,
        invite_token: invite,
        created_at: Date.now(),
        provider: providerName,
      });

      const url = new URL(provider.authorizeUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', callbackUrl(providerName));
      url.searchParams.set('scope', provider.scope);
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('access_type', 'online');
      url.searchParams.set('prompt', 'select_account');
      return reply.redirect(url.toString());
    },
  );

  // ── callback: validate state, exchange code, resolve user, set session ─
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>('/api/auth/oauth/:provider/callback', async (req, reply) => {
    const providerName = req.params.provider;
    const provider = getProvider(providerName);
    const failTo = (code: string) => {
      clearStateCookie(reply);
      return reply.redirect(`/?error=${encodeURIComponent(code)}`);
    };
    if (!provider) return failTo('oauth-failed');

    if (req.query.error) return failTo('oauth-cancelled');

    const stateCookie = readStateCookie(req);
    if (!stateCookie || stateCookie.provider !== providerName) return failTo('oauth-state');
    if (!req.query.state || stateCookie.state !== req.query.state) return failTo('oauth-state');
    if (!req.query.code) return failTo('oauth-failed');

    let tokens: TokenResponse;
    try {
      tokens = await exchangeCode(
        providerName,
        req.query.code,
        stateCookie.code_verifier,
        callbackUrl(providerName),
      );
    } catch (e) {
      console.warn(`[oauth/${providerName}] token exchange failed:`, (e as Error).message);
      return failTo('oauth-failed');
    }

    let profile: OAuthProfile;
    try {
      profile = await provider.verify(tokens, stateCookie.nonce);
    } catch (e) {
      console.warn(`[oauth/${providerName}] verify failed:`, (e as Error).message);
      return failTo('oauth-failed');
    }

    let resolved: { userId: number; isNew: boolean; email: string };
    try {
      resolved = await resolveOAuthUser(pool, providerName, profile);
    } catch (e) {
      const code = (e as Error & { code?: string }).code === 'email-unverified'
        ? 'google-unverified'
        : 'oauth-failed';
      console.warn(`[oauth/${providerName}] resolve failed:`, (e as Error).message);
      return failTo(code);
    }

    if (stateCookie.invite_token) {
      try {
        await claimInviteForUser(
          pool,
          stateCookie.invite_token,
          resolved.userId,
          resolved.email,
        );
      } catch (e) {
        console.warn(`[oauth/${providerName}] invite claim failed:`, (e as Error).message);
      }
    }

    const session = await createSession(pool, resolved.userId);
    setSessionCookie(reply, session.id, session.expiresAt);
    clearStateCookie(reply);

    // Look up current roles to decide landing target. Brand-new users
    // (empty roles[]) go to /role-picker; everyone else to /.
    const { rows } = await pool.query<{ roles: string[] }>(
      `SELECT roles FROM app_user WHERE id = $1`,
      [resolved.userId],
    );
    const noRoles = !rows[0] || rows[0].roles.length === 0;
    return reply.redirect(noRoles ? '/role-picker' : '/');
  });
}
