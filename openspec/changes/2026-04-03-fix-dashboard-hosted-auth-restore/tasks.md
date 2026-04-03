## 1. Implementation

- [x] 1.1 Remove dashboard runtime dependence on `@insforge/react` / `@insforge/react-router` provider restore.
- [x] 1.2 Move `App.jsx` to repository-owned hosted-auth load/sign-out state on top of `@insforge/sdk`.
- [x] 1.3 Remove dashboard runtime dependencies and update lockfile/tests to guard the new boundary.
- [x] 1.4 Update repository navigation docs for the new dashboard auth/session restore entrypoint.

## 2. Verification

- [x] 2.1 Run `cd dashboard && npm test -- --run src/lib/__tests__/vibeusage-api.test.ts src/lib/__tests__/insforge-auth-client.test.ts src/lib/__tests__/insforge-client.test.ts src/lib/__tests__/oauth-redirect-init.test.ts`
- [x] 2.2 Run `node --test test/dashboard-session-expired-banner.test.js`
- [x] 2.3 Run `node --test test/dashboard-typescript-guardrails.test.js`
- [x] 2.4 Run `cd dashboard && npm run build`
- [x] 2.5 Run `openspec validate 2026-04-03-fix-dashboard-hosted-auth-restore --strict`
- [x] 2.6 Run `npm run ci:local`
