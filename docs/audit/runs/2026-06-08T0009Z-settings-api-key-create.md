# Audit run — 2026-06-08T00:09:40Z
**Mode:** TEST_ONE
**Subject:** settings-api-key-create
**Result:** IMPROVED+PENDING

Re-exercised the `/settings` API keys "New key" flow end-to-end on prod.
Functional pass at desktop and 375x812: open dialog, disabled-on-empty
and disabled-on-whitespace Mint button, mint a 39-char token, clipboard
copy, revoke. No page errors and no application console errors.

UI finding: the "New key" button rendered with `type: 'submit'` instead
of `'button'`. The shared `Btn` atom in `src/components/ui/atoms.tsx`
omits a `type` default, so the underlying `<button>` falls through to
the HTML default of `submit`. Most call sites are dialog action buttons
(Cancel, Close, Done, secondary actions) whose intent is to interact with
the surrounding component, NOT to submit any enclosing form. Inside a
form a stray Enter key on any focused control would route to the first
`type="submit"` button, leading to unexpected submissions; outside a
form it's harmless but still incorrect semantics. Fix: default the `Btn`
component to `type="button"`. The nine call sites that legitimately want
`submit` already set `type="submit"` explicitly, and props-spread keeps
them working unchanged.

Verification: typecheck clean, `npm test` 48/48, audit spec on the PR
branch passes against prod (the prod build still emits the old default,
but the spec only logs the observed `type` — it does not assert on it —
so the spec remains green).
