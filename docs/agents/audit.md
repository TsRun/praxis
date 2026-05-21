# Praxis UI + Backend Audit

Phase 1 of the agent loop. The loop picks the next unchecked area each hour, audits it (code + optional Playwright runtime), and appends findings under the area's heading. When every box is ticked it writes `## Audit complete` at the bottom and the loop switches to `RUNBOOK.md`.

## Areas

- [x] Landing + auth (email/password + Google sign-in) — `src/pages/Landing*`, `src/pages/SignIn*`, `server/routes-auth*` <!-- claimed: done -->
- [ ] Tour route (90-second standalone) — `src/tour/*`, route `/tour`
- [ ] Trainer: opening studies list — `src/trainer/OpeningStudies*`, list page + create flow
- [ ] Trainer: opening study editor (chapters + tree modes) — `src/trainer/OpeningStudyEditor.tsx`, `src/components/opening/*`
- [ ] Trainer: students + assign — `src/trainer/Students*`, `src/trainer/Assign*`
- [ ] Trainer: import games — `src/trainer/ImportGamesPage.tsx`, `server/import-sources.ts`
- [ ] Trainer: tactic sets — `src/trainer/Tactics*`, `server/routes-tactics*`
- [ ] Student: assignments + drill — `src/student/Assignments*`, `src/student/Drill*`
- [ ] Student: opening study viewer (incl. chapter walker) — `src/student/OpeningStudyViewer.tsx`, `src/components/opening/ChapterWalker.tsx`
- [ ] Backend API surface — `server/routes-*.ts`, auth/role middleware, error envelopes
- [ ] Cross-cutting: design tokens, theming, dark mode — `src/index.css`, shared chrome
- [ ] Cross-cutting: tests + types — coverage gaps, `tsconfig` strictness, dead test files

## Findings

_(Loop appends `### Findings — <area> (<ts>)` blocks under here as it goes.)_

### Findings — Landing + auth (2026-05-21 17:52 +0200)

Files audited: `src/auth/LandingPage.tsx`, `src/auth/SignInUpForm.tsx`, `src/auth/InvitePage.tsx`, `src/auth/RolePicker.tsx`, `src/auth/RequireRole.tsx`, `src/auth/AuthContext.tsx`, `src/auth/routing.ts`, `server/routes-auth.ts`, `server/routes-oauth.ts`, `server/oauth-providers.ts`, `server/auth.ts`, `src/lib/api.ts` (auth surface).

Runtime audit: **skipped**. The runbook requires both Playwright MCP and a runnable `npm run dev`. Playwright tools are present, but I have no signal that Postgres/seed are available in this worktree and the audit phase forbids state-changing setup. Code-level only.

- **Severity: high** — Sign-in via the invite landing drops the invite. (`src/auth/InvitePage.tsx:99-104`, `src/auth/SignInUpForm.tsx:71-72`, `src/lib/api.ts:40-42`)
  `SignInUpForm` is rendered with `inviteToken` but only forwards it on the *signup* branch (`auth.signup` adds the `X-Invite-Token` header). If the recipient already has an account and switches the tab to "Sign in", `auth.signin` is called with no token, so the mentor link is never created. The user is then redirected to their dashboard with no indication that the invite was lost. Fix: when `inviteToken` is set, either auto-claim it via `invites.link(token)` immediately after a successful signin, or hide the "Sign in" tab and instead show a "Sign in then accept" link that lands back on `/invite/:token` so the existing `user && user.email === info.student_email` accept branch fires.

- **Severity: high** — Invite page is a dead-end when signed in as the wrong account. (`src/auth/InvitePage.tsx:46-75`)
  The accept-card branch only renders when `user.email === info.student_email`. If a user is signed into a different account, the page falls through to `SignInUpForm` again with no message — no "this invite is for foo@bar, sign out to claim it" affordance and no sign-out button. End result: a stuck-looking page with the recipient's email pre-filled but no path forward. Good-looks-like: detect mismatch and render an explicit "signed in as X, sign out to claim invite for Y" panel with a Sign-out button.

- **Severity: high** — Signin timing oracle for email enumeration. (`server/routes-auth.ts:99-109`)
  When `rows.length !== 1`, the handler returns 401 immediately without invoking `verifyPassword`. Known-user vs unknown-user responses therefore differ by ~hundreds of ms (one bcrypt at cost 12). Combined with the generic 400 on duplicate signup ("could not create account") the team clearly cares about enumeration, but this side-channel reverses that. Fix: run a constant-time dummy `bcrypt.compare` against a fixed hash when no user matches, or just always compute against `rows[0]?.password_hash ?? DUMMY_HASH`.

- **Severity: high** — OAuth-only accounts can crash signin handler. (`server/routes-auth.ts:101-108`, `server/auth.ts:15`)
  `resolveOAuthUser` inserts an `app_user` with `password_hash = NULL` (`server/routes-oauth.ts:131`). The signin handler then queries `password_hash` and passes the (typed-as-string) value to `verifyPassword` → `bcrypt.compare(plain, null)`. bcryptjs is documented to throw on a non-string hash. The TypeScript types `string` in `verifyPassword` mask this. Fix: type `password_hash` as `string | null`, short-circuit to 401 when null (or fall through to the dummy-hash branch above so the response stays timing-equivalent).

- **Severity: med** — Two concurrent OAuth callbacks for a new email both create rows. (`server/routes-oauth.ts:116-152`)
  Inside the transaction, the `SELECT id FROM app_user WHERE email = $1` is unlocked, so two callbacks (e.g. a user double-clicking "Continue with Google", or two devices on the same redirect) can both miss and both `INSERT`. The unique constraint on `app_user.email` will fail one transaction, surfaced to the user as the generic `oauth-failed` redirect. Fix: use `INSERT ... ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id` (or `SELECT ... FOR UPDATE` after taking an advisory lock on the email).

- **Severity: med** — `?error=` from OAuth callback is invisible when already signed in. (`server/routes-oauth.ts:239-242`, `src/auth/SignInUpForm.tsx:40-51`, `src/auth/LandingPage.tsx:16-18`)
  Failed callbacks redirect to `/?error=<code>`. The error-reader lives in `SignInUpForm`'s `useEffect`. But `LandingPage` short-circuits with `<Navigate to=...>` before `SignInUpForm` mounts when `user` is set. So a partial-failure path (e.g. invite claim threw, session was already created) silently swallows the error and the user lands on their dashboard wondering why. Fix: read & display `?error=` in `LandingPage` itself (before the redirect), or move the param-strip + error surfacing into `AuthProvider` so it survives navigation.

- **Severity: med** — Server signup does not validate email shape. (`server/routes-auth.ts:43-92`)
  Profile updates check `if (!lower.includes('@'))` (`:163-165`) but signup only lowercases and trims. A user could create an account with `email = "no-at"`, which would then be impossible to recover (the password-reset flow doesn't exist yet, and Resend would refuse to deliver invitations to that account). Fix: extract a shared `validateEmail` and apply on both signup and profile update; reject empties and missing `@`.

- **Severity: med** — Labels are not associated with inputs (a11y). (`src/auth/SignInUpForm.tsx:175-242`, `src/auth/RolePicker.tsx:103-114`)
  The "Email" / "Nickname" / "Password" `<label>` elements are siblings of their `<input>`s and carry no `htmlFor`, and the inputs have no `id`. Clicking the label doesn't focus the input, and screen readers see two unrelated nodes. Fix: either wrap the input in the label, or pair `<label htmlFor="email">` with `<input id="email">`.

- **Severity: med** — Sign-in/sign-up tab toggle and role buttons lack ARIA state (a11y). (`src/auth/SignInUpForm.tsx:101-135`, `:262-283`; `src/auth/RolePicker.tsx:123-145`)
  The mode tabs are just `<button>`s with a coloured background to indicate selection — no `role="tab"` / `aria-selected`, no `aria-pressed`. Role pickers are a multi-select but rendered as plain `<button>`s with no `aria-pressed` either, so VoiceOver/NVDA announces "button, Trainer" with no on/off state. Color is the only signal in light mode. Fix: add `role="tab"`/`role="tablist"` (or just `aria-pressed={on}`) to the toggle and `aria-pressed={picked.has(r)}` to each role tile.

- **Severity: med** — Inline-`style` everything is the entire form surface. (`src/auth/SignInUpForm.tsx`, `src/auth/LandingPage.tsx`, `src/auth/RolePicker.tsx`)
  Every button, every divider, every input wrapper uses inline `style={{ ... }}` rather than the shared CSS tokens or atom components, despite there being an `atoms` module (`Btn`, `Card`) and design tokens (`--text`, `--accent`, etc.). Side effects: dark-mode tweaks have to be done by hand, hover/focus states are skipped (no `:focus-visible` on the mode toggle buttons or role tiles), and the same look is reimplemented in `RolePicker` vs `SignInUpForm` with slightly different magic numbers (e.g. padding `14px 10px` vs `16px 10px`). Fix: lift the "segmented toggle" and "role tile" into reusable atoms; move the bare inline pieces into a stylesheet or CSS module.

- **Severity: med** — `SignInUpForm` is doing too much. (`src/auth/SignInUpForm.tsx` — 332 LOC)
  One component renders: tab switcher, OAuth button, OAuth error decoder + URL rewriter, OAuth href builder, mode-aware form fields, role multi-select, submit handler, terms footer, and an inline SVG logo. The OAuth-error effect mutates `window.history.state` from inside a leaf form — surprising for a "form" component, and it fires on every mount regardless of whether the form is even visible (it lives inside `InvitePage` too, so an invite landing strips `?error=` from the URL). Fix: split into `<AuthTabs>`, `<OAuthButton>`, and a thin `<CredentialFields>`; lift the `?error=` reader to the route/`LandingPage` level.

- **Severity: low** — Footer "terms" / "privacy" links are `href="#"`. (`src/auth/SignInUpForm.tsx:316-317`)
  Either drop the line, link to real pages, or gate behind a "TODO" comment. Currently a click jumps to top of page with no feedback.

- **Severity: low** — Default role pre-selection assumes trainer. (`src/auth/SignInUpForm.tsx:32-34`)
  Non-invite signups default `roles = new Set(['trainer'])`. The product copy in the role grid suggests all three are equal, but the default biases adoption toward the trainer dashboard. Either default to empty (forcing the user to pick) or surface the default in the UI (e.g. visually mark the trainer card pre-selected) so the user knows they can deselect it.

- **Severity: low** — Loading state is a single faint string. (`src/auth/LandingPage.tsx:13`, `src/auth/RolePicker.tsx:27`, `src/auth/RequireRole.tsx:16`, `src/auth/InvitePage.tsx:38-44`)
  Three different "Loading…" treatments across files: padded grey text, padded grey text with different padding, Tailwind-style classes (`p-8 text-zinc-500` in `RequireRole.tsx` — but the rest of the project is not on Tailwind). At minimum normalise to one shared `<PageSpinner />`; the Tailwind one is dead-on-arrival styling.

- **Severity: low** — `OAuth start` returns JSON on unknown provider while callback redirects. (`server/routes-oauth.ts:196-201`, `:243`)
  `/api/auth/oauth/foo/start` → `{ "error": "unknown provider" }` 404. `/api/auth/oauth/foo/callback` → 302 to `/?error=oauth-failed`. The start endpoint is always invoked from a browser anchor (`<a href=...>`), so JSON output is a UX dead-end. Make both redirect.

- **Severity: low** — `email-unverified` / `google-unverified` naming drift. (`server/routes-oauth.ts:103-104`, `:277-279`, `src/auth/SignInUpForm.tsx:14-18`)
  The internal error code is `email-unverified` but it is mapped to the wire code `google-unverified`. Fine today because Google is the only provider; the moment a second provider lands, the client-side `OAUTH_ERROR_MESSAGES` table will need a parallel `lichess-unverified` entry. Make the wire code `email-unverified` and let the client copy mention the provider via state if needed.

- **Severity: low** — Bcrypt 72-byte truncation is not documented. (`server/auth.ts:11-13`)
  Passwords longer than 72 bytes are silently truncated by bcrypt. A user setting a 200-char passphrase + small typo at the end would still authenticate. Trivial fix is a hard cap at 72 bytes on signup/change with a clear "password too long" 400.

- **Severity: low** — `auth.routing.ts` is two lines of logic in its own file. (`src/auth/routing.ts`)
  Not wrong, but a one-function module makes navigation flow harder to read. Either inline `defaultLandingForRoles` into `AuthContext` (it's the only consumer outside `LandingPage`/`RolePicker`/`InvitePage`) or expand the file to own all post-auth navigation rules.

- **Severity: low** — Landing nav "Features" / "Sign in" use `<a href="#anchor">`. (`src/auth/LandingPage.tsx:37-69`)
  Works, but it bypasses React Router and forces a full hash navigation; on slow connections the user can click "Sign in" and watch the page jump *before* the form is even on screen. Consider `scrollIntoView({ behavior: 'smooth' })` on click, plus updating the hash via `history.replaceState` for bookmarkability.

