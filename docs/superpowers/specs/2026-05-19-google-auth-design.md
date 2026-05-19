# Google sign-in — design

Add "Continue with Google" alongside the existing email + password auth.
Provider-agnostic data model so adding lichess later is additive.

## Decisions locked in (from brainstorming)

| Question | Decision |
| --- | --- |
| Scope | Add Google alongside email/password (do not replace) |
| Email collision with existing password user | Auto-link if Google returns `email_verified: true` |
| Role selection for brand-new Google users | Role-picker screen after the first Google callback |
| Identity model | Provider-agnostic `oauth_identity` table — lichess (or anything else) plugs in later |
| Implementation | Hand-rolled OAuth 2.0 auth-code flow with PKCE; `jose` for `id_token` JWT verification; no third-party JS on the page |

## Non-goals

- Replacing passwords / forced migration of existing accounts.
- Linking Google to an account that already exists with a password but where
  Google's `email_verified=false`. Refuse the sign-in and ask the user to verify
  the Google email first.
- Multi-provider account merging UI ("connect another login"). Re-using the
  same Google account on the same email is enough for v1.
- Token refresh. We only need Google long enough to get one `id_token`; we
  don't store refresh tokens. Sessions on Praxis stay as the existing
  signed-cookie `session` row.

## Invariants

1. **One `app_user` per email.** Enforced server-side by `SELECT … WHERE email = $1`
   before any `INSERT`. The DB `UNIQUE(email)` constraint stays.
2. The OAuth flow never modifies an existing user's `password_hash`, `name`,
   or `roles`. It only creates a session for an existing or freshly-created
   `app_user`, and inserts an `oauth_identity` row linking the two.
3. State cookie carries everything that survives the redirect. The server
   keeps no per-flow state — the cookie is the source of truth.
4. `email_verified=false` from Google ⇒ refuse the sign-in. No way for an
   attacker to claim someone else's password account by registering it on a
   sloppy Google Workspace tenant.

## Architecture

```
[Browser]                                        [Praxis backend]                  [Google]
   |--click "Continue with Google" → /api/auth/oauth/google/start?invite=…→        |
   |   ← set oauth_state (signed, 5min, HttpOnly, /api/auth/oauth),                 |
   |     302 to https://accounts.google.com/o/oauth2/v2/auth?...                    |
   |--user consents on Google ────────────────────────────────────────────→         |
   |   ← 302 to /api/auth/oauth/google/callback?code=…&state=…                     |
   |--GET callback →                                                                |
   |                                  validate signed state cookie & matching state |
   |                                  POST /token (PKCE code_verifier) ──────→     |
   |                                                                ←── id_token── |
   |                                  verify id_token via Google JWKS (jose)        |
   |                                  enforce email_verified=true                   |
   |                                  resolve user (see §Resolution)                |
   |                                  create session, set 'sid'                     |
   |   ← 302 to /role-picker (new) or to / (existing)                              |
```

## Data model

One migration. File:
`server/migrations/2026-05-19-oauth-identity.sql`.

```sql
-- Multiple OAuth identities can point at one app_user. Composite PK on
-- (provider, subject) makes lookup O(1) and prevents the same Google account
-- from being linked twice.
CREATE TABLE IF NOT EXISTS oauth_identity (
  provider   TEXT   NOT NULL,
  subject    TEXT   NOT NULL,
  user_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_oauth_identity_user ON oauth_identity(user_id);

-- Allow Google-only accounts to exist with no password.
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;
```

Schema.sql is updated to match (the bootstrap DDL stays in sync for local dev).

## Resolution (`resolveOAuthUser`)

Input: `{ provider, subject, email, emailVerified, name }`.

1. If `!emailVerified` ⇒ `throw OAuthError('google-unverified')`.
2. `SELECT user_id FROM oauth_identity WHERE provider=$1 AND subject=$2`.
   Hit ⇒ return that `user_id`.
3. `SELECT id FROM app_user WHERE email=$1`.
   Hit ⇒ `INSERT INTO oauth_identity(provider, subject, user_id)` linking to that
   user; return `user_id`.
4. Else: `INSERT INTO app_user(email, password_hash, name, roles)`
   `VALUES ($1, NULL, $2, ARRAY[]::TEXT[]) RETURNING id`;
   `INSERT INTO oauth_identity(provider, subject, user_id)`;
   return `user_id`.

Steps 3 and 4 are wrapped in a transaction. On race (two callbacks for the
same brand-new email), the second one hits the `UNIQUE(email)` constraint and
falls back to step 2.

`name` is run through the existing `sanitizeName()` helper before insert. If
Google's name fails the sanitizer (control chars, oversized), fall back to the
local-part of the email.

## Endpoints

### `GET /api/auth/oauth/google/start`

Query: optional `?invite=<token>`.

Behavior:
1. Generate `state` (32 bytes hex), `code_verifier` (32 bytes base64url),
   `code_challenge = base64url(sha256(code_verifier))`, `nonce` (16 bytes hex).
2. Set `oauth_state` cookie (signed):
   ```ts
   {
     state, code_verifier, nonce,
     invite_token: req.query.invite ?? null,
     created_at: Date.now(),
   }
   ```
   Cookie flags: `HttpOnly`, `Secure` (matching `COOKIE_SECURE`),
   `SameSite=Lax`, `Path=/api/auth/oauth`, `Max-Age=300`.
3. Redirect to
   `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={GOOGLE_CLIENT_ID}&redirect_uri={OAUTH_REDIRECT_BASE_URL}/api/auth/oauth/google/callback&scope=openid+email+profile&state={state}&nonce={nonce}&code_challenge={code_challenge}&code_challenge_method=S256&access_type=online&prompt=select_account`.

### `GET /api/auth/oauth/google/callback`

Query: `?code=…&state=…` (also `?error=…` on Google-side cancel).

Behavior:
1. If `error` present ⇒ clear `oauth_state` cookie, 302 `/auth?error=oauth-cancelled`.
2. Read + unsign `oauth_state` cookie. Missing / invalid signature / older than
   5 min ⇒ 302 `/auth?error=oauth-state`.
3. Cookie's `state` !== query `state` ⇒ 302 `/auth?error=oauth-state`.
4. POST to `https://oauth2.googleapis.com/token`:
   - `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`, `code_verifier`.
5. Response gives `id_token`. Verify via `jose.jwtVerify(token, JWKS, { issuer: 'https://accounts.google.com', audience: GOOGLE_CLIENT_ID })`.
   JWKS comes from `jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))`. Verify `nonce` matches the cookie's `nonce`.
6. Pull `sub`, `email`, `email_verified`, `name` from the verified JWT.
7. `resolveOAuthUser({ provider:'google', subject:sub, email, emailVerified:email_verified, name })`.
   - On `OAuthError('google-unverified')` ⇒ 302 `/auth?error=google-unverified`.
8. If `invite_token` is in the cookie, run the existing `claimInviteForUser`
   with the resolved `user_id` and `email`. Failure is best-effort logged.
9. Create session (existing `createSession` helper), set the `sid` cookie.
10. Clear the `oauth_state` cookie.
11. Decide redirect target:
    - If `app_user.roles` is empty ⇒ 302 `/role-picker`.
    - Else ⇒ 302 `/`.

### Provider registry (forward-looking)

In a single `server/oauth-providers.ts`:

```ts
export interface OAuthProvider {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  verify: (tokens: TokenResponse) => Promise<{ subject: string; email: string; emailVerified: boolean; name: string }>;
}

export const providers: Record<string, OAuthProvider> = {
  google: { /* … */ },
  // lichess: { … }  ← added later
};
```

Routes index providers by `:provider` parameter and 404 unknown ones.

## Frontend

### Files touched

- `src/auth/SignInUpForm.tsx`
  - Add a "Continue with Google" `<a>` button above the email field, with an
    "or" divider. The href is
    `/api/auth/oauth/google/start?invite={inviteToken ?? ''}` (omit the param
    when empty). Plain anchor, not `fetch` — we need a full-page navigation
    for the redirect dance.
  - When the page mounts with `?error=…` in the URL, surface a small inline
    error banner (mapping codes to human strings).
- `src/auth/AuthContext.tsx`
  - No changes to the context shape. `auth.me()` already returns the user
    object; if `roles.length === 0`, the routing module sends them to
    `/role-picker`.
- `src/auth/routing.ts`
  - Add: if `user.roles.length === 0`, the home target is `/role-picker`.
- **New** `src/auth/RolePicker.tsx`
  - Extracted from the role section of `SignInUpForm.tsx` (multi-select chips
    + Continue button). On submit calls existing `PUT /api/auth/roles` with the
    selected roles. On success, navigates to `/`.
- `src/App.tsx`
  - Add `<Route path="/role-picker" element={…} />`.

### Error banner mapping

| URL `?error` | Message |
| --- | --- |
| `oauth-cancelled` | "Google sign-in was cancelled." |
| `oauth-state` | "Your sign-in link expired. Please try again." |
| `oauth-failed` | "We couldn't finish signing you in with Google. Please try again." |
| `google-unverified` | "Your Google email isn't verified yet. Verify it on Google, then try again." |

## Error handling

- Token exchange HTTP non-2xx ⇒ 302 `/auth?error=oauth-failed`. Log the
  Google response body server-side for diagnosis (no PII in there).
- `jose.jwtVerify` throws ⇒ 302 `/auth?error=oauth-failed`. Log the reason.
- `nonce` mismatch ⇒ 302 `/auth?error=oauth-state` (same handling as a
  forged state).
- DB error during resolution ⇒ 500 with generic message; let Fastify's error
  hook log the full trace.
- Invite-claim failure is non-fatal: the user is signed in regardless; we
  just log and skip.

## Security notes

- The signed state cookie is the CSRF defence for the OAuth callback. Without
  it an attacker can't trick a victim into starting a flow with attacker-
  controlled state.
- PKCE blocks code interception even if the redirect URI is somehow
  exfiltrated, because the `code_verifier` only lives in the signed cookie on
  the user's browser.
- `audience: GOOGLE_CLIENT_ID` on `jwtVerify` rejects `id_token`s minted for a
  different client. `issuer` is pinned to `https://accounts.google.com`.
- `email_verified=false` is treated as a hard refusal, full stop.
- The new `oauth_identity` table is keyed on `(provider, subject)`, not on
  `email`, so a user changing their Google email doesn't break the linkage.
- We re-use the same `sid` cookie + session row as password sign-ins. All the
  signed-cookie / 14d TTL / Secure-by-default hardening from the recent
  security PR applies automatically.

## Config

### Server env vars (set on Railway)

- `GOOGLE_CLIENT_ID` — from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET` — from Google Cloud Console.
- `OAUTH_REDIRECT_BASE_URL` — defaults to `APP_BASE_URL` if unset. The
  callback URL registered with Google is
  `{OAUTH_REDIRECT_BASE_URL}/api/auth/oauth/google/callback`.

### Google Cloud Console

Manual one-time setup (outside the codebase):

1. Create / pick a Google Cloud project.
2. **APIs & Services → OAuth consent screen** → External → fill name + support email.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Web application.
4. Authorized redirect URIs:
   - `https://praxis.tsrun.dev/api/auth/oauth/google/callback`
   - `http://localhost:5173/api/auth/oauth/google/callback` (local dev)
     — the SPA's Vite port. Vite proxies `/api/*` to `:5174` (Fastify),
     so the callback request lands on the backend; but the `oauth_state`
     cookie was set on `localhost:5173`, so the registered redirect URI
     must be on that origin or the cookie won't be sent.
5. Copy Client ID + Client Secret into Railway env (and `.env.local` for dev).

## Dependencies

- New: `jose` (^5) — JWT verification with remote JWKS rotation. ~3M weekly
  downloads, the de-facto JWT lib on Node.
- No other new deps. PKCE / base64url / sha256 are stdlib (`node:crypto`).

## Testing

- `tests/unit/server/oauth-google.test.ts`
  - `verifyGoogleIdToken` with a mock JWKS + known good / bad tokens.
  - `resolveOAuthUser` paths:
    - `oauth_identity` hit returns the user.
    - email match links the existing user.
    - brand-new email creates the user with empty roles.
    - `email_verified=false` throws.
    - race on email insert falls back to the email-match path.
  - State cookie sign + unsign roundtrip.
- Manual smoke checklist (post-deploy):
  - Brand-new Google account → role-picker → role saved → roster page works.
  - Returning Google account → straight to `/`.
  - Existing password account with same email → Google sign-in lands on the
    same user; password still works.
  - Open `/api/auth/oauth/google/callback?state=garbage` directly → redirects
    to `/auth?error=oauth-state`.
  - Click "Continue with Google" from an invite link → role-picker (if new)
    → mentor link present on the inviting trainer's roster.

## Risks and rollback

- Wrong redirect URI registered with Google ⇒ Google returns
  `redirect_uri_mismatch`. Mitigation: document the exact URL in this spec and
  in `.env.example`; smoke-test in dev first.
- Email collision UX surprise: a power user with `alice@example.com + password`
  signs in with Google's `alice@example.com` and finds her roles unchanged
  (good) but never sees a "you've now linked Google" confirmation. v2: small
  one-time banner. Out of scope for this PR.
- Rollback path: dropping `oauth_identity` and re-asserting
  `password_hash NOT NULL` is a destructive migration (would orphan Google-only
  users). Instead, rollback = revert the PR + delete the env vars; existing
  password users keep working.

## Out of scope (call out, do not build)

- "Sign in with Apple", lichess, chess.com — designed for, not built. Each
  later provider adds one entry to the registry and one verify function.
- "Disconnect Google" UI in UserMenu.
- Forced email re-verification when Google's `email_verified` flips false on
  a re-sign-in (very unusual; defer).
- Refresh tokens / long-lived Google access. We don't need them; we only
  read identity claims once per sign-in.
