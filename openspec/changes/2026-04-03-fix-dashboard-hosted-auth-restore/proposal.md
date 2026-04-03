# Change: Fix dashboard hosted-auth session restore on the upgraded InsForge baseline

## Why

PR `#124` intentionally stopped at the upgraded InsForge baseline and recorded the remaining blocker for issue `#118`: the installed `@insforge/sdk@1.2.2` exposes `auth.refreshSession()` and `auth.getCurrentUser()`, while the installed React adapter still restores state through `auth.getCurrentSession()`, which is not part of the upgraded SDK contract.

As long as the dashboard runtime depends on that provider restore path, stored sessions can fail to restore even though repository-owned SDK hydration already converged on the current official auth primitives. We need a follow-up PR that fixes the remaining restore boundary without rolling back the baseline or reintroducing the removed refresh hacks.

## What Changes

- Remove dashboard runtime dependence on `@insforge/react` / `@insforge/react-router` as the hosted-auth restore source.
- Make repository-owned SDK session hydration the only dashboard restore source of truth.
- Keep GitHub OAuth redirect and SDK callback exchange on the official `@insforge/sdk` client.
- Add regression checks that prevent reintroducing the broken provider restore layer or its runtime dependencies.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code:
  - `dashboard/src/main.jsx`
  - `dashboard/src/App.jsx`
  - `dashboard/package.json`
  - `dashboard/package-lock.json`
  - `dashboard/src/lib/__tests__/vibeusage-api.test.ts`
  - `test/dashboard-session-expired-banner.test.js`
  - `test/dashboard-typescript-guardrails.test.js`
  - `docs/repo-sitemap.md`
